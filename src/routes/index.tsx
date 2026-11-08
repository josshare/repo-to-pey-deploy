import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MessageCircle, CreditCard, RotateCcw, ArrowUp } from "lucide-react";
import { PaymentCelebration, PaymentQR } from "@/components/payment-experience";
import { remainingSeconds } from "@/lib/pey/experience";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { money, type Action, type Actor } from "@/lib/pey/domain";
import heroIllustration from "@/assets/pey-demo-ilustracion.png.asset.json";
import type { getState } from "@/lib/pey/engine.server";
import {
  activateDemoAccount,
  getDemoState,
  replayEvent,
  resolveAttempt,
  sendDemoMessage,
  startDemo,
} from "@/lib/pey/demo.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pey + WhatsApp · Demo de cobros" },
      { name: "description", content: "Prueba los dos lados del chat: registra un negocio, comparte un cobro y recibe la confirmación del pago simulado." },
      { property: "og:title", content: "Pey + WhatsApp · Demo de cobros" },
      { property: "og:description", content: "Del “te transfiero” al “ya recibí”. Demo de cobros conversacionales." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type State = Awaited<ReturnType<typeof getState>>;
type Charge = NonNullable<State["merchant"]>["charges"][number];

const stateQuery = { queryKey: ["demo-state"], queryFn: () => getDemoState() };

function Index() {
  const qc = useQueryClient();
  const { data } = useQuery(stateQuery);
  const [busy, setBusy] = useState(false);
  const [bankAttempt, setBankAttempt] = useState<string | null>(null);
  const [chatActor, setChatActor] = useState<Actor>("MERCHANT");
  const [now, setNow] = useState(0);
  const starting = useRef(false);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (data && !data.ok && !starting.current) {
      starting.current = true;
      startDemo().then(() => qc.invalidateQueries({ queryKey: ["demo-state"] })).finally(() => (starting.current = false));
    }
  }, [data, qc]);

  const state: State | null = data && data.ok ? (data as unknown as State) : null;

  async function run(fn: () => Promise<unknown>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo completar la operación.");
    } finally {
      await qc.invalidateQueries({ queryKey: ["demo-state"] });
      setBusy(false);
    }
  }
  const send = (actor: Actor, text: string) => run(() => sendDemoMessage({ data: { actor, text, messageId: crypto.randomUUID() } }));

  const findAttempt = (id: string) => {
    for (const c of state?.merchant?.charges ?? []) {
      const a = c.attempts.find((x) => x.id === id);
      if (a) return { charge: c, attempt: a };
    }
    return null;
  };
  const isOpen = (id: string) => {
    const f = findAttempt(id);
    return !!f && f.attempt.status === "PENDING" && f.charge.status !== "PAID" && remainingSeconds(f.attempt.expires_at, now) > 0;
  };
  const openBank = (id: string) => {
    if (!isOpen(id)) {
      toast.error("Esta solicitud ya no está pendiente. Revisa el chat del cliente.");
      return;
    }
    setBankAttempt(id);
  };

  const onAction = (actor: Actor, a: Action) => {
    if (a.kind === "share" && a.id) void send("CUSTOMER", `pagar ${a.id}`);
    else if (a.kind === "bank" && a.id) openBank(a.id);
    else if (a.text) void send(actor, a.text);
  };

  const charge = state?.merchant?.charges[0];
  const account = state?.merchant?.account;
  const latestPaymentEvent = state?.events.find((e) => e.type === "payment.result" && e.status === "DONE");
  const pendingAttempt = charge?.attempts.find((a) => a.status === "PENDING");
  const bank = bankAttempt ? findAttempt(bankAttempt) : null;
  const paymentIds = state?.merchant?.charges.flatMap(c => c.attempts.filter(a => a.payment).map(a => a.id)) ?? [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex h-20 items-center gap-2 border-b border-border bg-card px-[4%] sm:gap-6">
        <a href="/" className="flex items-center gap-2 font-display text-3xl font-bold" aria-label="Pey demo, inicio">
          <span className="grid size-9 place-items-center rounded-lg bg-primary pb-1 text-3xl leading-none text-primary-foreground">p</span>
          pey<span className="ml-1 hidden font-sans text-sm font-medium text-muted-foreground sm:inline">+ WhatsApp</span>
        </a>
        <span className="ml-auto hidden items-center gap-2 rounded-full border border-border px-3 py-1.5 text-xs sm:flex">
          <span className="size-1.5 rounded-full bg-primary" /> Demo · Sin dinero real
        </span>
        {state && <PaymentCelebration paymentIds={paymentIds} />}
        <Button variant="ghost" className="ml-auto sm:ml-0" onClick={() => run(startDemo)} disabled={busy}>
          <RotateCcw /> Nueva demo
        </Button>
      </header>

      <main className="mx-auto max-w-[1570px] px-[4%] pb-6 pt-8">
        <section className="mb-8 grid items-center gap-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm lg:grid-cols-2" aria-label="Cómo funciona la demo">
          <div className="p-6 sm:p-8">
            <p className="mb-2 text-[10px] font-bold tracking-[0.12em] text-primary">ASÍ SE USA LA DEMO</p>
            <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Genera un código, paga en segundos</h2>
            <ol className="mt-5 space-y-4">
              <li className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">1</span>
                <p className="text-sm text-muted-foreground"><strong className="text-foreground">Registra tu negocio</strong> en el chat del Negocio y activa la cuenta demo.</p>
              </li>
              <li className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">2</span>
                <p className="text-sm text-muted-foreground"><strong className="text-foreground">Crea un cobro o anticipo</strong> y compártelo con el Cliente por el chat.</p>
              </li>
              <li className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary font-display text-sm font-bold text-primary-foreground">3</span>
                <p className="text-sm text-muted-foreground"><strong className="text-foreground">El cliente paga</strong> desde el banco simulado y ambos ven la confirmación al instante.</p>
              </li>
            </ol>
          </div>
          <img src={heroIllustration.url} alt="Ilustración: una clienta paga con un código QR de Pey en el mostrador de una tienda" className="h-full w-full object-cover" loading="eager" />
        </section>

        <section className="mb-7 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-2 text-[10px] font-bold tracking-[0.12em] text-primary">DEL “TE TRANSFIERO” AL “YA RECIBÍ”</p>
            <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
              Cobrar se conversa<span className="text-primary">.</span>
            </h1>
            <p className="mt-2 max-w-xl text-muted-foreground">Prueba los dos lados del chat. Registra un negocio, comparte un cobro y recibe la confirmación.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={`size-2 rounded-full ${busy || !state ? "bg-sun" : "bg-primary"}`} />
            {!state ? "Conectando con tu demo…" : busy ? "Procesando tu conversación…" : "Guardado en la nube"}
          </div>
        </section>

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
          <div className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold"><MessageCircle className="size-5 text-primary" /> WhatsApp</h2>
              <div role="group" aria-label="Vista del chat" className="flex rounded-lg bg-secondary p-1">
                <Button size="sm" variant={chatActor === "MERCHANT" ? "default" : "ghost"} aria-pressed={chatActor === "MERCHANT"} onClick={() => setChatActor("MERCHANT")}>Negocio</Button>
                <Button size="sm" variant={chatActor === "CUSTOMER" ? "default" : "ghost"} aria-pressed={chatActor === "CUSTOMER"} onClick={() => setChatActor("CUSTOMER")}>Cliente</Button>
              </div>
            </div>
            <div className="mx-auto max-w-[530px]">
              <ChatCard key={chatActor} n={chatActor === "MERCHANT" ? "01" : "02"} title={chatActor === "MERCHANT" ? "El negocio" : "El cliente"} subtitle={chatActor === "MERCHANT" ? "Vende productos, servicios o citas" : "Paga desde su aplicación bancaria"} actor={chatActor} state={state} busy={busy} onSend={send} onAction={onAction} isOpen={isOpen} />
            </div>
          </div>

          <aside className="space-y-4" aria-label="Panel de prueba">
            <div>
              <p className="mb-1 text-[10px] font-bold tracking-[0.12em] text-primary">PEY / TERMINAL DEMO</p>
              <h2 className="flex items-center gap-2 font-display text-xl font-bold"><CreditCard className="size-5 text-primary" /> Tu cobro, en vivo</h2>
            </div>

            <div className="space-y-2 border-y border-border py-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Cuenta del negocio</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${account?.status === "ACTIVE" ? "bg-accent text-primary-deep" : account ? "bg-sun/40 text-foreground" : "bg-muted"}`}>
                  {account?.status === "ACTIVE" ? "Activa" : account ? "Pendiente" : "Sin vincular"}
                </span>
              </div>
              <strong className="block font-display text-lg">{state?.merchant?.name ?? "Tu próximo negocio"}</strong>
              <span className="block text-xs text-muted-foreground">{account ? `${account.label} · •••• ${account.last4}` : "Completa el registro en el chat del negocio."}</span>
              <Button className="mt-2 w-full" disabled={!account || account.status !== "PENDING" || busy} onClick={() => run(activateDemoAccount)}>
                {account?.status === "ACTIVE" ? "Cuenta demo activa ✓" : "Activar cuenta demo"}
              </Button>
            </div>

            <Ticket charge={charge} />

            <PaymentQR attempt={pendingAttempt ?? charge?.attempts[0]} amount={charge?.amount_cents ?? 0} paid={charge?.status === "PAID"} busy={busy} onOpen={() => pendingAttempt && openBank(pendingAttempt.id)} />
            <Button variant="ghost" className="w-full" disabled={!latestPaymentEvent || busy} onClick={() => latestPaymentEvent && run(() => replayEvent({ data: { eventId: latestPaymentEvent.id } }))}>
              Repetir evento de pago
            </Button>
            <p className="text-[11px] text-muted-foreground">Repite el evento para comprobar que no se duplica el pago.</p>

            <details className="border-t border-border py-3 text-sm">
              <summary className="cursor-pointer font-semibold">Actividad de la prueba ({state?.events.length ?? 0})</summary>
              <ol className="mt-2 space-y-2">
                {state?.events.map((e) => (
                  <li key={e.id} className="text-xs">
                    <strong className="block">{EVENT_NAMES[e.type] ?? e.type}</strong>
                    <span className="text-muted-foreground">
                      {EVENT_STATUS[e.status] ?? e.status} · {e.attempts} intento(s){e.last_error ? ` · ${e.last_error}` : ""}
                    </span>
                  </li>
                ))}
              </ol>
            </details>
          </aside>
        </div>

        <footer className="mt-8 flex flex-wrap justify-between gap-2 border-t border-border pt-4 text-xs text-muted-foreground">
          <span><b className="text-foreground">Los chats, las cuentas y los pagos son simulados.</b> No se envían WhatsApps ni se mueve dinero.</span>
           <span>Pey + Kapso · Integración pendiente</span>
        </footer>
      </main>

      <Dialog open={!!bank} onOpenChange={(o) => !o && setBankAttempt(null)}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <p className="text-[10px] font-bold tracking-[0.12em] text-primary">BANCO SIMULADO</p>
            <DialogTitle className="font-display text-2xl">Autoriza tu pago</DialogTitle>
            <DialogDescription>Pago a {state?.merchant?.name}</DialogDescription>
          </DialogHeader>
          {bank && (
            <>
              <strong className="font-display text-4xl">{money(bank.charge.amount_cents)}</strong>
              <p className="text-sm text-muted-foreground">{bank.charge.concept}</p>
              <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">Cuenta ficticia •••• 4242. Esta prueba no mueve dinero ni abre tu banco real.</div>
              {!isOpen(bank.attempt.id) && <p className="text-sm text-destructive">Solicitud cerrada. Pide otra solicitud en el chat.</p>}
              <Button disabled={busy || !isOpen(bank.attempt.id)} onClick={() => { if (!isOpen(bank.attempt.id)) return; void run(async () => { await resolveAttempt({ data: { attemptId: bank.attempt.id, outcome: "PAID" } }); setBankAttempt(null); }); }}>
                Confirmar pago simulado
              </Button>
              <div className="flex justify-center gap-2">
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(async () => { await resolveAttempt({ data: { attemptId: bank.attempt.id, outcome: "REJECTED" } }); setBankAttempt(null); })}>Simular rechazo</Button>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => run(async () => { await resolveAttempt({ data: { attemptId: bank.attempt.id, outcome: "EXPIRED" } }); setBankAttempt(null); })}>Simular vencimiento</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const EVENT_NAMES: Record<string, string> = { "message.received": "Mensaje recibido", "bank.account.activated": "Activación de cuenta", "payment.result": "Resultado del pago" };
const EVENT_STATUS: Record<string, string> = { DONE: "Procesado", PENDING: "En cola", REJECTED: "Rechazado por validación", FAILED: "Requiere revisión" };

function Ticket({ charge }: { charge: Charge | undefined }) {
  const received = charge?.attempts.reduce((s, a) => s + (a.payment?.amount_cents ?? 0), 0) ?? 0;
  const payments = charge?.attempts.filter((a) => a.payment).length ?? 0;
  return (
    <div className="ticket space-y-1 p-4">
      <div className="flex justify-between font-mono text-[10px] text-muted-foreground"><span>COMPROBANTE DEMO</span><span>MXN</span></div>
      <span className="block text-xs text-muted-foreground">{charge ? (charge.kind === "DEPOSIT" ? "Anticipo" : "Pago completo") : "Tu primer cobro"}</span>
      <strong className="block font-display text-3xl">{money(charge?.amount_cents ?? 0)}</strong>
      <p className="text-sm text-muted-foreground">{charge?.concept ?? "Aquí verás el cobro que crees en el chat."}</p>
      <div className={`my-2 rounded-md px-2 py-1 text-xs font-semibold ${charge?.status === "PAID" ? "bg-accent text-primary-deep" : charge ? "bg-sun/40" : "bg-muted text-muted-foreground"}`}>
        {charge ? (charge.status === "PAID" ? "✓ Pago simulado confirmado" : "Esperando el pago") : "Aún no hay cobros"}
      </div>
      <Row label="Total acordado" value={charge ? money(charge.total_cents) : "—"} />
      <Row label="Saldo después del pago" value={charge ? money(Math.max(0, charge.total_cents - received)) : "—"} />
      <Row label="Pagos confirmados" value={String(payments)} />
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-t border-dashed border-border pt-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ChatCard(props: {
  n: string; title: string; subtitle: string; actor: Actor; state: State | null; busy: boolean;
  onSend: (actor: Actor, text: string) => void; onAction: (actor: Actor, a: Action) => void; isOpen: (id: string) => boolean;
}) {
  const { actor, state, busy } = props;
  const [text, setText] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const messages = state?.messages.filter((m) => m.actor === actor) ?? [];
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    props.onSend(actor, t);
    setText("");
  };

  return (
    <section className="demo-phone overflow-hidden border border-border bg-card shadow-sm" aria-label={`Conversación de ${props.title.toLowerCase()}`}>
      <div className="flex h-9 items-center justify-between px-6 font-mono text-[10px]"><span>9:41</span><span className="phone-camera" aria-hidden="true" /><span>▮▮▮ ▰</span></div>
      <div className="flex items-center gap-3 px-5 py-4">
        <span className="rounded-lg border border-border bg-muted px-2 py-1.5 font-mono text-[11px]">{props.n}</span>
        <div>
          <h2 className="font-display text-lg font-bold leading-tight">{props.title}</h2>
          <p className="text-[11px] text-muted-foreground">{props.subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-2.5 bg-primary-deep px-4 py-3 text-primary-foreground">
        <span className="grid size-8 place-items-center rounded-full bg-primary-foreground/15 pb-1 font-display text-2xl font-bold">p</span>
        <div>
          <strong className="block text-sm">Asistente Pey</strong>
          <span className="block text-[10px] opacity-80">Cuenta de demostración</span>
        </div>
      </div>
      <div ref={listRef} role="log" aria-live="polite" className="chat-pattern flex h-[420px] flex-col gap-3 overflow-y-auto px-4 py-5">
        {!messages.length && <p className="m-auto text-xs text-muted-foreground">Preparando conversación…</p>}
        {messages.map((m) => (
          <div key={m.id} className={`max-w-[92%] whitespace-pre-wrap break-words px-3 pb-1.5 pt-2.5 text-xs leading-relaxed shadow-sm ${m.direction === "IN" ? "self-end rounded-[13px_2px_13px_13px] bg-accent" : "self-start rounded-[2px_13px_13px_13px] bg-card"}`}>
            <span>{m.body}</span>
            {m.actions.length > 0 && (
              <div className="mt-2 flex flex-col gap-1.5">
                {m.actions.map((a, i) => {
                  if (a.url) return <a key={i} href={a.url} className="rounded-lg border border-primary/30 px-3 py-2 text-center font-semibold text-primary hover:bg-accent">{a.label}</a>;
                  const closed = a.kind === "bank" && a.id ? !props.isOpen(a.id) : false;
                  return (
                    <Button variant="outline" key={i} disabled={busy || closed} onClick={() => props.onAction(actor, a)} className="h-auto whitespace-normal border-primary/30 px-3 py-2 text-xs font-semibold text-primary">
                      {closed ? "Solicitud cerrada" : a.label}
                    </Button>
                  );
                })}
              </div>
            )}
            <time className="mt-1 block text-right text-[9px] text-muted-foreground">
              {new Date(m.created_at).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}{m.direction === "IN" ? " ✓✓" : ""}
            </time>
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-border p-3">
        <label className="sr-only" htmlFor={`${actor}-input`}>Mensaje</label>
        <input id={`${actor}-input`} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Escribe aquí…" autoComplete="off"
          className="min-w-0 flex-1 rounded-full border border-input bg-background px-4 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        <Button type="submit" size="icon" disabled={busy || !state} aria-label="Enviar mensaje" className="size-10 shrink-0 rounded-full"><ArrowUp /></Button>
      </form>
    </section>
  );
}
