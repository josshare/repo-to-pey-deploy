import { peyPaymentEvent, peyQrResponse, qrRequest } from "./live-orders";

export async function requestLiveQr(concept: string, accountId: string, orderId: string) {
  const key = process.env["LOVABLE_API_KEY"];
  const connection = process.env["UDC_PEY_API_KEY"];
  if (!key || !connection) throw new Error("La conexión de Pey no está disponible.");
  // A QR creation is not automatically retried: Pey does not document an idempotency key.
  const response = await fetch("https://connector-gateway.lovable.dev/udc_pey/codi/qr", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "X-Connection-Api-Key": connection, "Content-Type": "application/json" },
    body: JSON.stringify(qrRequest(concept, accountId, orderId)),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    const body = await response.text();
    console.error(`Pey QR failed [${response.status}]: ${body}`);
    throw new Error(`Pey [${response.status}]: ${body}`);
  }
  return peyQrResponse.parse(await response.json());
}

export async function processPeyPayment(payload: unknown) {
  const parsed = peyPaymentEvent.safeParse(payload);
  if (!parsed.success) return "INVALID";
  const event = parsed.data;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("confirm_live_pey_order", {
    p_qr_id: event.codiQrId, p_account_id: event.bankAccountId, p_amount: event.amount,
    p_transaction_id: event.transactionId, p_paid_at: new Date(event.datePaid * 1000).toISOString(),
  });
  if (error) throw new Error("No se pudo conciliar el pago de Pey.");
  return data;
}