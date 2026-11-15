import { z } from "zod";
import { readBoundedBody, verifyKapso, verifyPey } from "./live-webhooks";
import { getPeyWebhookSecret } from "./webhook-secret.server";

const objectPayload = z.object({}).passthrough();

export async function receiveLiveWebhook(request: Request, provider: "pey" | "kapso") {
  // Reject unsigned probes before checking server setup. They are invalid callers,
  // not service outages, and must never be persisted or trigger privileged access.
  const signed = provider === "pey"
    ? request.headers.get("webhook-id") && request.headers.get("webhook-timestamp") && request.headers.get("webhook-signature")
    : request.headers.get("x-webhook-signature") && request.headers.get("x-webhook-event");
  if (!signed) return new Response("Invalid webhook", { status: 401 });
  const secret = provider === "pey" ? getPeyWebhookSecret() : process.env["KAPSO_WEBHOOK_SECRET"];
  if (!secret) return new Response("Webhook signing is not configured", { status: 503 });
  let raw: string;
  try { raw = await readBoundedBody(request); }
  catch { return new Response("Invalid body", { status: 413 }); }
  let deliveryId: string;
  let payload: z.infer<typeof objectPayload>;
  let eventType: string;
  try {
    if (provider === "pey") {
      const verified = verifyPey(raw, request.headers, secret);
      deliveryId = verified.id;
      payload = objectPayload.parse(verified.payload);
      eventType = z.string().min(1).max(200).parse(payload["type"]);
    } else {
      await verifyKapso(raw, request.headers.get("x-webhook-signature"), secret);
      payload = objectPayload.parse(JSON.parse(raw));
      eventType = z.string().min(1).max(200).parse(request.headers.get("x-webhook-event"));
      // Kapso's payload hash deduplicates identical deliveries without assuming a delivery header exists.
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(eventType + "\n" + raw));
      deliveryId = Array.from(new Uint8Array(digest), (v) => v.toString(16).padStart(2, "0")).join("");
    }
    z.string().min(1).max(500).parse(deliveryId);
  } catch { return new Response("Invalid webhook", { status: 401 }); }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("live_provider_events").upsert({
    provider, delivery_id: deliveryId, event_type: eventType,
    payload: JSON.parse(JSON.stringify(payload)),
  }, { onConflict: "provider,delivery_id", ignoreDuplicates: true });
  if (error) {
    console.error("Provider inbox write failed", error.code);
    return new Response("Unable to persist delivery", { status: 503 });
  }
  if (provider === "pey" && eventType === "codi.qr.payment_received") {
    try {
      const { processPeyPayment } = await import("./live-orders.server");
      const result = await processPeyPayment(payload);
      if (["READY", "DUPLICATE", "REVIEW"].includes(result)) {
        const { error: processedError } = await supabaseAdmin.from("live_provider_events")
          .update({ processed_at: new Date().toISOString(), processing_error: null })
          .eq("provider", provider).eq("delivery_id", deliveryId);
        if (processedError) return new Response("Unable to mark delivery processed", { status: 503 });
        return new Response("Payment reconciled", { status: 200 });
      }
      await supabaseAdmin.from("live_provider_events").update({ processing_error: result })
        .eq("provider", provider).eq("delivery_id", deliveryId);
      return new Response("Payment requires reconciliation", { status: 503 });
    } catch {
      return new Response("Unable to reconcile payment", { status: 503 });
    }
  }
  // Kapso and unrelated event types remain fail-closed. Demo records are never touched.
  return new Response("Delivery stored; live processing is not activated", { status: 503 });
}