import { z } from "zod";
import { readBoundedBody, verifyKapso, verifyPey } from "./live-webhooks";

const objectPayload = z.object({}).passthrough();

export async function receiveLiveWebhook(request: Request, provider: "pey" | "kapso") {
  // Reject unsigned probes before checking server setup. They are invalid callers,
  // not service outages, and must never be persisted or trigger privileged access.
  const signed = provider === "pey"
    ? request.headers.get("webhook-id") && request.headers.get("webhook-timestamp") && request.headers.get("webhook-signature")
    : request.headers.get("x-webhook-signature") && request.headers.get("x-webhook-event");
  if (!signed) return new Response("Invalid webhook", { status: 401 });
  const secret = provider === "pey" ? process.env["PEY_WEBHOOK_SECRET"] : process.env["KAPSO_WEBHOOK_SECRET"];
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
  // Fail closed during setup: receipt is durable, but business processing is not configured yet.
  // Never acknowledge this as a successfully processed payment or message.
  return new Response("Delivery stored; live processing is not activated", { status: 503 });
}