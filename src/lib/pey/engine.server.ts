import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/integrations/supabase/types";
import { InvalidEvent, chargeSummary, money, parseMoney, type Action, type Actor, type ChargeDraft } from "./domain";

type Db = SupabaseClient<Database>;
export type Provider = "sent" | "pey";
export type EventType = "message.received" | "bank.account.activated" | "payment.result";

const SESSION_MS = 12 * 60 * 60_000;
const LINK_MS = 15 * 60_000;

function ok<T>(res: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (res.error) throw new Error(res.error.message);
  return res.data as NonNullable<T>;
}
function maybe<T>(res: { data: T; error: { message: string } | null }): T | null {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export function randomToken(bytes: number) {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...arr)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function reply(db: Db, runId: string, actor: Actor, body: string, key: string, actions: Action[] = []) {
  ok(
    await db
      .from("messages")
      .upsert(
        { run_id: runId, actor, direction: "OUT", body, actions: actions as unknown as Json, source_id: `sim_sent_${key}` },
        { onConflict: "source_id", ignoreDuplicates: true },
      ),
  );
}

// ---------- Sesiones ----------
export async function createRun(db: Db) {
  const token = randomToken(32);
  const run = ok(
    await db
      .from("demo_runs")
      .insert({ token_hash: await hashToken(token), expires_at: new Date(Date.now() + SESSION_MS).toISOString() })
      .select()
      .single(),
  );
  ok(await db.from("conversations").insert([{ run_id: run.id, actor: "MERCHANT" }, { run_id: run.id, actor: "CUSTOMER" }]));
  await reply(db, run.id, "MERCHANT", "Tus cobros, aquí mismo. Registra tu negocio y recibe pagos sin pedir capturas de pantalla. Empecemos con una cuenta de demostración.", `welcome:${run.id}:merchant`, [{ label: "Registrar mi negocio", text: "hola" }]);
  await reply(db, run.id, "CUSTOMER", "Aquí aparecerá tu conversación para pagar. Primero el negocio debe compartirte un cobro.", `welcome:${run.id}:customer`);
  return { token, run };
}

export async function getRun(db: Db, token: string | undefined) {
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new Error("Inicia una demo para continuar.");
  const run = maybe(await db.from("demo_runs").select().eq("token_hash", await hashToken(token)).maybeSingle());
  if (!run || new Date(run.expires_at) < new Date()) throw new Error("Tu sesión demo venció. Inicia una nueva.");
  return run;
}

// ---------- Estado ----------
export async function getState(db: Db, runId: string) {
  const merchant = maybe(
    await db
      .from("merchants")
      .select("id, name, account:bank_accounts(id, label, last4, status), charges(id, token, amount_cents, total_cents, concept, kind, status, created_at, attempts:payment_attempts(id, status, amount_cents, created_at, expires_at, payment:payments(amount_cents)))")
      .eq("run_id", runId)
      .maybeSingle(),
  );
  const messages = ok(await db.from("messages").select("id, actor, direction, body, actions, created_at").eq("run_id", runId).order("created_at", { ascending: true }).limit(300));
  const events = ok(await db.from("webhook_events").select("id, type, status, attempts, last_error, created_at").eq("run_id", runId).order("created_at", { ascending: false }).limit(20));
  const m = merchant as unknown as null | {
    id: string; name: string;
    account: { id: string; label: string; last4: string; status: string } | null;
    charges: Array<{ id: string; token: string; amount_cents: number; total_cents: number; concept: string; kind: string; status: string; created_at: string;
      attempts: Array<{ id: string; status: string; amount_cents: number; created_at: string; expires_at: string; payment: { amount_cents: number } | null }> }>;
  };
  return {
    merchant: m && {
      name: m.name,
      account: m.account,
      charges: [...m.charges]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((c) => ({ ...c, attempts: [...c.attempts].sort((a, b) => b.created_at.localeCompare(a.created_at)) })),
    },
    messages: messages.map((x) => ({ ...x, actions: (x.actions ?? []) as unknown as Action[] })),
    events,
  };
}

// ---------- Eventos simulados (idempotentes por proveedor + id externo) ----------
export async function simulated(db: Db, provider: Provider, runId: string, type: EventType, payload: Record<string, unknown>, externalId: string = crypto.randomUUID()) {
  const existing = maybe(await db.from("webhook_events").select().eq("provider", provider).eq("external_id", externalId).maybeSingle());
  if (existing) {
    if (existing.run_id !== runId) throw new Error("Evento no disponible.");
    return { accepted: true, eventId: existing.id, status: existing.status, duplicate: true };
  }
  const inserted = await db.from("webhook_events").insert({ provider, external_id: externalId, run_id: runId, type, payload: payload as Json }).select().single();
  if (inserted.error) {
    if (inserted.error.code === "23505") return { accepted: true, duplicate: true };
    throw new Error(inserted.error.message);
  }
  const event = inserted.data;
  const key = `evt:${event.id}`;
  try {
    if (type === "message.received") {
      const p = payload as { actor: Actor; text: string; messageId: string };
      await receiveMessage(db, runId, p.actor, p.text, p.messageId, key);
    } else if (type === "bank.account.activated") {
      await activateAccount(db, runId, String(payload["accountId"]), key);
    } else {
      await paymentResult(db, runId, payload as unknown as PaymentResult, key);
    }
    ok(await db.from("webhook_events").update({ status: "DONE", attempts: 1, processed_at: new Date().toISOString() }).eq("id", event.id));
    return { accepted: true, eventId: event.id, status: "DONE" };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error desconocido";
    await db.from("webhook_events").update({ status: e instanceof InvalidEvent ? "REJECTED" : "FAILED", attempts: 1, last_error: message }).eq("id", event.id);
    throw e;
  }
}

// ---------- Conversaciones ----------
async function receiveMessage(db: Db, runId: string, actor: Actor, text: string, messageId: string, key: string) {
  const existing = maybe(await db.from("messages").select().eq("source_id", messageId).maybeSingle());
  if (existing) {
    if (existing.run_id !== runId || existing.actor !== actor || existing.body !== text) throw new InvalidEvent("Identificador de mensaje reutilizado con otro contenido.");
    return;
  }
  ok(await db.from("messages").insert({ run_id: runId, actor, direction: "IN", body: text, source_id: messageId }));
  const r = (body: string, actions: Action[] = []) => reply(db, runId, actor, body, key, actions);
  const command = text.trim().toLocaleLowerCase("es-MX");

  if (actor === "CUSTOMER") {
    if (command.startsWith("pagar ")) return requestPayment(db, runId, text.trim().slice(6).trim(), key);
    return r("Abre el cobro que te compartió el negocio para pagar con CoDi. La confirmación llegará aquí cuando el banco lo confirme.");
  }

  const conversation = ok(await db.from("conversations").select().eq("run_id", runId).eq("actor", actor).single());
  const merchant = maybe(await db.from("merchants").select("id, name, account:bank_accounts(id, status)").eq("run_id", runId).maybeSingle()) as unknown as
    | null | { id: string; name: string; account: { id: string; status: string } | null };
  const draft = (conversation.draft ?? {}) as unknown as ChargeDraft;
  const next = async (step: string, d: Partial<ChargeDraft> = {}) => {
    ok(await db.from("conversations").update({ step, draft: d as unknown as Json }).eq("id", conversation.id));
  };
  const active = merchant?.account?.status === "ACTIVE";

  if (command === "cancelar") {
    await next(active ? "READY" : merchant ? "NEEDS_ACCOUNT" : "WELCOME");
    return r("Borrador cancelado. Puedes empezar de nuevo.", [{ label: active ? "Crear cobro" : "Continuar registro", text: active ? "cobrar" : "hola" }]);
  }
  if (command === "vincular" && merchant && !merchant.account) return offerLink(db, runId, key);

  switch (conversation.step) {
    case "WELCOME":
      await next("BUSINESS_NAME");
      return r("¡Hola! Soy tu asistente de cobros. Primero registramos tu negocio. ¿Cómo se llama?", [{ label: "La tiendita de Ana", text: "La tiendita de Ana" }, { label: "Estudio Luna", text: "Estudio Luna" }]);
    case "BUSINESS_NAME":
      if (text.trim().length < 2 || text.trim().length > 80) return r("Escribe un nombre de entre 2 y 80 caracteres.");
      ok(await db.from("merchants").insert({ run_id: runId, name: text.trim() }));
      await next("NEEDS_ACCOUNT");
      return offerLink(db, runId, key);
    case "NEEDS_ACCOUNT":
      if (!merchant?.account) return offerLink(db, runId, key);
      return r("Tu cuenta está pendiente de activación. Usa “Activar cuenta” en el panel de prueba.");
    case "READY":
      if (command !== "cobrar") return r("Para un producto, servicio o anticipo, empieza con “cobrar”.", [{ label: "Crear cobro", text: "cobrar" }]);
      await next("AMOUNT");
      return r("¿Cuánto quieres cobrar hoy? Escribe el monto en pesos.", [{ label: "$250", text: "250" }, { label: "$350", text: "350" }, { label: "$500", text: "500" }]);
    case "AMOUNT": {
      const amount = parseMoney(text);
      if (!amount) return r("Escribe de $1 a $10,000, con hasta dos decimales. Por ejemplo: 250.50.");
      await next("CONCEPT", { amountCents: amount, totalCents: amount });
      return r("¿Qué estás cobrando?", [{ label: "Pedido de productos", text: "Pedido de productos" }, { label: "Servicio de reparación", text: "Servicio de reparación" }, { label: "Anticipo para cita", text: "Anticipo para cita" }]);
    }
    case "CONCEPT":
      if (text.trim().length < 2 || text.trim().length > 100) return r("Describe el concepto en 2 a 100 caracteres.");
      await next("KIND", { ...draft, concept: text.trim() });
      return r("¿Es el pago completo o un anticipo?", [{ label: "Pago completo", text: "completo" }, { label: "Anticipo", text: "anticipo" }]);
    case "KIND": {
      if (!["completo", "anticipo"].includes(command)) return r("Elige “completo” o “anticipo”.");
      const d: ChargeDraft = { ...draft, kind: command === "anticipo" ? "DEPOSIT" : "FULL" };
      if (d.kind === "DEPOSIT") {
        await next("TOTAL", d);
        return r("¿Cuál es el precio total acordado? Debe ser mayor que el anticipo.");
      }
      await next("CONFIRM", d);
      return r(chargeSummary(d), [{ label: "Confirmar cobro", text: "confirmar" }, { label: "Cancelar", text: "cancelar" }]);
    }
    case "TOTAL": {
      const total = parseMoney(text);
      if (!total || total <= draft.amountCents) return r(`Escribe un total mayor que ${money(draft.amountCents)}, hasta $10,000.`);
      const d = { ...draft, totalCents: total };
      await next("CONFIRM", d);
      return r(chargeSummary(d), [{ label: "Confirmar cobro", text: "confirmar" }, { label: "Cancelar", text: "cancelar" }]);
    }
    case "CONFIRM":
      if (command !== "confirmar") return r("Escribe “confirmar” para crear el cobro o “cancelar” para descartarlo.");
      await createCharge(db, runId, draft, key);
      await next("READY");
      return;
    default:
      throw new InvalidEvent("Estado de conversación desconocido.");
  }
}

// ---------- Vinculación ----------
async function offerLink(db: Db, runId: string, key: string) {
  const token = randomToken(24);
  ok(await db.from("onboarding_sessions").insert({ run_id: runId, token_hash: await hashToken(token), expires_at: new Date(Date.now() + LINK_MS).toISOString() }));
  await reply(db, runId, "MERCHANT", "Vamos a vincular tu cuenta. Abre el formulario privado; el enlace dura 15 minutos. En esta demo solo usamos una cuenta ficticia.", key, [{ label: "Vincular cuenta demo", url: `/vincular?token=${token}` }]);
}

async function findLink(db: Db, runId: string, token: string) {
  const session = maybe(await db.from("onboarding_sessions").select().eq("token_hash", await hashToken(token)).maybeSingle());
  if (!session || session.run_id !== runId) throw new Error("Enlace no disponible para esta sesión.");
  if (session.used_at) throw new Error("Este enlace ya se utilizó. Regresa al chat.");
  if (new Date(session.expires_at) < new Date()) throw new Error("El enlace venció. Escribe vincular en el chat para obtener otro.");
  return session;
}

export async function inspectLink(db: Db, runId: string, token: string) {
  await findLink(db, runId, token);
  const merchant = ok(await db.from("merchants").select("name").eq("run_id", runId).single());
  return { businessName: merchant.name, bank: "Banco de demostración", last4: "4242" };
}

export async function submitLink(db: Db, runId: string, token: string) {
  const session = await findLink(db, runId, token);
  // Marca el enlace como usado de forma atómica para evitar dobles envíos.
  const claimed = ok(await db.from("onboarding_sessions").update({ used_at: new Date().toISOString() }).eq("id", session.id).is("used_at", null).select());
  if (!claimed.length) throw new Error("Este enlace ya se utilizó.");
  const merchant = ok(await db.from("merchants").select("id, account:bank_accounts(id)").eq("run_id", runId).single()) as unknown as { id: string; account: { id: string } | null };
  if (merchant.account) throw new Error("El negocio ya tiene una cuenta vinculada.");
  ok(await db.from("bank_accounts").insert({ merchant_id: merchant.id, provider_account_id: `sim_bank_${crypto.randomUUID()}`, label: "Banco de demostración", last4: "4242" }));
  await reply(db, runId, "MERCHANT", "Recibimos tu cuenta demo •••• 4242. Está pendiente de activación. Usa “Activar cuenta” en el panel de prueba para continuar.", `onboarding:${session.id}`);
  return { status: "PENDING" };
}

export async function accountFor(db: Db, runId: string) {
  const m = maybe(await db.from("merchants").select("account:bank_accounts(provider_account_id)").eq("run_id", runId).maybeSingle()) as unknown as null | { account: { provider_account_id: string } | null };
  return m?.account ?? null;
}

async function activateAccount(db: Db, runId: string, providerAccountId: string, key: string) {
  const merchant = maybe(await db.from("merchants").select("name, account:bank_accounts(id, provider_account_id, status)").eq("run_id", runId).maybeSingle()) as unknown as
    | null | { name: string; account: { id: string; provider_account_id: string; status: string } | null };
  if (!merchant?.account || merchant.account.provider_account_id !== providerAccountId) throw new InvalidEvent("La cuenta no corresponde al negocio.");
  if (merchant.account.status === "ACTIVE") return;
  ok(await db.from("bank_accounts").update({ status: "ACTIVE" }).eq("id", merchant.account.id));
  ok(await db.from("conversations").update({ step: "READY", draft: {} }).eq("run_id", runId).eq("actor", "MERCHANT"));
  await reply(db, runId, "MERCHANT", `¡Listo, ${merchant.name}! Tu cuenta demo •••• 4242 está activa. Ya puedes cobrar productos, servicios y anticipos.`, key, [{ label: "Crear un cobro", text: "cobrar" }]);
}

// ---------- Cobros y pagos ----------
async function createCharge(db: Db, runId: string, draft: ChargeDraft, key: string) {
  const merchant = ok(await db.from("merchants").select("id, account:bank_accounts(status)").eq("run_id", runId).single()) as unknown as { id: string; account: { status: string } | null };
  if (merchant.account?.status !== "ACTIVE") throw new InvalidEvent("La cuenta no está activa.");
  const charge = ok(
    await db
      .from("charges")
      .insert({ merchant_id: merchant.id, token: randomToken(9), amount_cents: draft.amountCents, total_cents: draft.totalCents, concept: draft.concept, kind: draft.kind })
      .select()
      .single(),
  );
  await reply(db, runId, "MERCHANT", `Cobro listo: ${money(charge.amount_cents)} por ${charge.concept}.${charge.kind === "DEPOSIT" ? ` Anticipo de ${money(charge.total_cents)}.` : ""}\nComparte este cobro con tu cliente. El dinero de esta demo es simulado.`, key, [{ label: "Compartir con cliente demo", kind: "share", id: charge.token }]);
}

type ChargeRow = { id: string; token: string; amount_cents: number; total_cents: number; concept: string; status: string;
  merchant: { run_id: string; name: string; account: { id: string; status: string; last4: string } | null } };

async function requestPayment(db: Db, runId: string, token: string, key: string) {
  const charge = maybe(await db.from("charges").select("id, token, amount_cents, total_cents, concept, status, merchant:merchants(run_id, name, account:bank_accounts(id, status, last4))").eq("token", token).maybeSingle()) as unknown as ChargeRow | null;
  if (!charge || charge.merchant.run_id !== runId) return reply(db, runId, "CUSTOMER", "No encontré ese cobro. Pide al negocio que vuelva a compartirlo.", key);
  if (charge.status === "PAID") return reply(db, runId, "CUSTOMER", "Este cobro ya está pagado. No necesitas volver a pagar.", key);
  const account = charge.merchant.account;
  if (account?.status !== "ACTIVE") throw new InvalidEvent("Cuenta receptora no activa.");
  const attempts = ok(await db.from("payment_attempts").select().eq("charge_id", charge.id).order("created_at", { ascending: false }));
  let attempt = attempts.find((a) => a.status === "PENDING" && new Date(a.expires_at) > new Date());
  if (!attempt) {
    ok(await db.from("payment_attempts").update({ status: "EXPIRED" }).eq("charge_id", charge.id).eq("status", "PENDING"));
    attempt = ok(
      await db
        .from("payment_attempts")
        .insert({ charge_id: charge.id, account_id: account.id, provider_transaction_id: `sim_codi_${crypto.randomUUID()}`, amount_cents: charge.amount_cents, expires_at: new Date(Date.now() + LINK_MS).toISOString() })
        .select()
        .single(),
    );
  }
  await reply(db, runId, "CUSTOMER", `${charge.merchant.name} te cobra ${money(charge.amount_cents)} por ${charge.concept}.\nReceptor: cuenta demo •••• ${account.last4}.\nAbre el banco simulado y autoriza el pago. No necesitas enviar un comprobante.`, key, [{ label: "Abrir banco simulado", kind: "bank", id: attempt.id }]);
}

export interface PaymentResult { transactionId: string; accountId: string; amountCents: number; outcome: "PAID" | "REJECTED" | "EXPIRED" }

export async function attemptPayload(db: Db, runId: string, attemptId: string, outcome: PaymentResult["outcome"]): Promise<PaymentResult> {
  const a = maybe(await db.from("payment_attempts").select("provider_transaction_id, amount_cents, account:bank_accounts(provider_account_id), charge:charges(merchant:merchants(run_id))").eq("id", attemptId).maybeSingle()) as unknown as
    | null | { provider_transaction_id: string; amount_cents: number; account: { provider_account_id: string }; charge: { merchant: { run_id: string } } };
  if (!a || a.charge.merchant.run_id !== runId) throw new Error("Solicitud no disponible en esta demo.");
  return { transactionId: a.provider_transaction_id, accountId: a.account.provider_account_id, amountCents: a.amount_cents, outcome };
}

async function paymentResult(db: Db, runId: string, data: PaymentResult, key: string) {
  const attempt = maybe(await db.from("payment_attempts").select("id, charge_id, amount_cents, status, account:bank_accounts(provider_account_id, last4), charge:charges(token, concept, status, amount_cents, total_cents, merchant:merchants(run_id, name)), payment:payments(id)").eq("provider_transaction_id", data.transactionId).maybeSingle()) as unknown as
    | null | { id: string; charge_id: string; amount_cents: number; status: string; account: { provider_account_id: string; last4: string };
      charge: { token: string; concept: string; status: string; amount_cents: number; total_cents: number; merchant: { run_id: string; name: string } }; payment: { id: string } | null };
  if (!attempt || attempt.charge.merchant.run_id !== runId || attempt.account.provider_account_id !== data.accountId || attempt.amount_cents !== data.amountCents) {
    throw new InvalidEvent("El evento no coincide con transacción, cuenta e importe.");
  }
  if (attempt.payment) return;
  if (data.outcome !== "PAID") {
    if (attempt.status !== "PENDING") return;
    ok(await db.from("payment_attempts").update({ status: data.outcome }).eq("id", attempt.id));
    return reply(db, runId, "CUSTOMER", data.outcome === "REJECTED" ? "El banco simulado rechazó la solicitud. El cobro sigue pendiente; puedes intentarlo de nuevo." : "La solicitud simulada venció. El cobro sigue pendiente; puedes generar otra.", key, [{ label: "Volver a intentar", text: `pagar ${attempt.charge.token}` }]);
  }
  const ins = await db.from("payments").insert({ attempt_id: attempt.id, provider_transaction_id: data.transactionId, amount_cents: data.amountCents });
  if (ins.error) {
    if (ins.error.code === "23505") return; // ya contabilizado
    throw new Error(ins.error.message);
  }
  ok(await db.from("payment_attempts").update({ status: "PAID" }).eq("id", attempt.id));
  ok(await db.from("charges").update({ status: "PAID" }).eq("id", attempt.charge_id));
  const additional = attempt.charge.status === "PAID";
  const balance = attempt.charge.total_cents - attempt.charge.amount_cents;
  const note = additional ? "\nPago adicional: revisa este cobro antes de continuar." : balance > 0 ? `\nSaldo del servicio: ${money(balance)}. Este pago no reserva una cita en una agenda externa.` : "";
  await reply(db, runId, "MERCHANT", `Pago simulado confirmado: ${money(data.amountCents)} por ${attempt.charge.concept}.\nRecibido en cuenta demo •••• ${attempt.account.last4}.${note}`, `${key}:merchant`);
  await reply(db, runId, "CUSTOMER", `Pago simulado confirmado a ${attempt.charge.merchant.name}: ${money(data.amountCents)}.\nConcepto: ${attempt.charge.concept}. Ya avisamos al negocio.${note}`, `${key}:customer`);
}

export async function eventForReplay(db: Db, runId: string, id: string) {
  const event = maybe(await db.from("webhook_events").select().eq("id", id).maybeSingle());
  if (!event || event.run_id !== runId) throw new Error("Evento no disponible.");
  return event;
}
