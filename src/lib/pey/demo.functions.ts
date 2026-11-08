import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import { z } from "zod";

const COOKIE = "pey_demo";

async function ctx() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const engine = await import("./engine.server");
  return { db: supabaseAdmin, engine };
}
async function session() {
  const c = await ctx();
  const run = await c.engine.getRun(c.db, getCookie(COOKIE));
  return { ...c, run };
}

export const startDemo = createServerFn({ method: "POST" }).handler(async () => {
  const { db, engine } = await ctx();
  const { token, run } = await engine.createRun(db);
  setCookie(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 12 * 60 * 60 });
  return { id: run.id };
});

export const getDemoState = createServerFn({ method: "GET" }).handler(async () => {
  const c = await ctx();
  try {
    const run = await c.engine.getRun(c.db, getCookie(COOKIE));
    return { ok: true as const, runId: run.id, ...(await c.engine.getState(c.db, run.id)) };
  } catch (e) {
    return { ok: false as const, reason: e instanceof Error ? e.message : "Sin sesión" };
  }
});

export const sendDemoMessage = createServerFn({ method: "POST" })
  .inputValidator(z.object({ actor: z.enum(["MERCHANT", "CUSTOMER"]), text: z.string().trim().min(1, "Escribe un mensaje.").max(1000), messageId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { db, engine, run } = await session();
    return engine.simulated(db, "sent", run.id, "message.received", data, data.messageId);
  });

export const activateDemoAccount = createServerFn({ method: "POST" }).handler(async () => {
  const { db, engine, run } = await session();
  const account = await engine.accountFor(db, run.id);
  if (!account) throw new Error("Primero vincula una cuenta demo.");
  return engine.simulated(db, "pey", run.id, "bank.account.activated", { accountId: account.provider_account_id });
});

export const resolveAttempt = createServerFn({ method: "POST" })
  .inputValidator(z.object({ attemptId: z.string().uuid(), outcome: z.enum(["PAID", "REJECTED", "EXPIRED"]) }))
  .handler(async ({ data }) => {
    const { db, engine, run } = await session();
    const payload = await engine.attemptPayload(db, run.id, data.attemptId, data.outcome);
    return engine.simulated(db, "pey", run.id, "payment.result", { ...payload });
  });

export const replayEvent = createServerFn({ method: "POST" })
  .inputValidator(z.object({ eventId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { db, engine, run } = await session();
    const ev = await engine.eventForReplay(db, run.id, data.eventId);
    return engine.simulated(db, ev.provider as "sent" | "pey", run.id, ev.type as "payment.result", ev.payload as Record<string, unknown>, ev.external_id);
  });

export const inspectOnboarding = createServerFn({ method: "GET" })
  .inputValidator(z.object({ token: z.string().min(16).max(64) }))
  .handler(async ({ data }) => {
    const { db, engine, run } = await session();
    return engine.inspectLink(db, run.id, data.token);
  });

export const submitOnboarding = createServerFn({ method: "POST" })
  .inputValidator(z.object({ token: z.string().min(16).max(64) }))
  .handler(async ({ data }) => {
    const { db, engine, run } = await session();
    return engine.submitLink(db, run.id, data.token);
  });
