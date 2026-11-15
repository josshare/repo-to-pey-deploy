import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { liveOrderInput } from "./live-orders";

export const getLiveSetup = createServerFn({ method: "GET" }).handler(async () => ({
  connected: Boolean(process.env["UDC_PEY_API_KEY"] && process.env["LOVABLE_API_KEY"]),
  webhookConfigured: Boolean(process.env["PEY_WEBHOOK_SECRET"]),
}));

export const getLiveOrders = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data: operator, error } = await context.supabase.from("live_payment_operators").select("enabled, bank_account_id").eq("user_id", context.userId).maybeSingle();
  if (error) throw new Error("No se pudo comprobar el acceso del dueño.");
  if (!operator?.enabled) return { authorized: false, orders: [] };
  const { data: orders, error: ordersError } = await context.supabase.from("live_orders").select("id, concept, amount_cents, status, qr_string, expires_at, transaction_id, paid_at, created_at").order("created_at", { ascending: false }).limit(30);
  if (ordersError) throw new Error("No se pudieron consultar los pedidos.");
  return { authorized: true, orders: orders ?? [] };
});

export const createLiveOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(input => liveOrderInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: operator, error: operatorError } = await context.supabase.from("live_payment_operators").select("enabled, bank_account_id").eq("user_id", context.userId).maybeSingle();
    if (operatorError || !operator?.enabled) throw new Error("El dueño y su cuenta receptora todavía no están habilitados.");
    if (!process.env["PEY_WEBHOOK_SECRET"]) throw new Error("Falta configurar la confirmación firmada de Pey.");
    if (!process.env["LOVABLE_API_KEY"] || !process.env["UDC_PEY_API_KEY"]) throw new Error("Pey no está conectado.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: insertError } = await supabaseAdmin.from("live_orders").upsert({
      owner_id: context.userId, request_id: data.requestId, concept: data.concept,
      amount_cents: 1, bank_account_id: operator.bank_account_id,
    }, { onConflict: "owner_id,request_id", ignoreDuplicates: true });
    if (insertError) throw new Error("No se pudo guardar el pedido.");
    const { data: order, error: readError } = await supabaseAdmin.from("live_orders").select("*").eq("owner_id", context.userId).eq("request_id", data.requestId).single();
    if (readError || !order) throw new Error("No se pudo recuperar el pedido.");
    const { data: claimed, error: claimError } = await supabaseAdmin.from("live_orders").update({ status: "CREATING" }).eq("id", order.id).eq("status", "DRAFT").select("id").maybeSingle();
    if (claimError) throw new Error("No se pudo iniciar el cobro.");
    if (!claimed) return { id: order.id };
    const startedAt = Date.now();
    try {
      const { requestLiveQr } = await import("./live-orders.server");
      const qr = await requestLiveQr(order.concept, order.bank_account_id, order.id);
      const { error: saved } = await supabaseAdmin.from("live_orders").update({
        status: "PENDING", provider_qr_id: qr.id, qr_string: qr.qrString,
        expires_at: new Date(startedAt + 600000).toISOString(),
      }).eq("id", order.id).eq("status", "CREATING");
      if (saved) throw new Error("Pey respondió, pero no se pudo guardar el QR; requiere revisión.");
    } catch (error) {
      await supabaseAdmin.from("live_orders").update({ status: "REVIEW" }).eq("id", order.id).eq("status", "CREATING");
      throw error instanceof Error ? error : new Error("No se pudo confirmar la creación del QR. No repitas el cobro.");
    }
    return { id: order.id };
  });