import { Webhook } from "standardwebhooks";

export function verifyPey(raw: string, headers: Headers, secret: string) {
  const id = headers.get("webhook-id");
  if (!id) throw new Error("Missing delivery id");
  const payload = new Webhook(secret).verify(raw, {
    "webhook-id": id,
    "webhook-timestamp": headers.get("webhook-timestamp") ?? "",
    "webhook-signature": headers.get("webhook-signature") ?? "",
  });
  return { id, payload };
}

export async function verifyKapso(raw: string, signature: string | null, secret: string) {
  if (!signature || !/^[a-f0-9]{64}$/.test(signature)) throw new Error("Invalid signature");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const result = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
  const supplied = new Uint8Array(signature.match(/.{2}/g)?.map((v) => parseInt(v, 16)) ?? []);
  let diff = result.length ^ supplied.length;
  for (let i = 0; i < result.length; i++) diff |= result[i] ^ (supplied[i] ?? 0);
  if (diff !== 0) throw new Error("Invalid signature");
}

export async function readBoundedBody(request: Request, maxBytes = 1024 * 1024) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Empty body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const next = await reader.read();
    if (next.done) break;
    size += next.value.length;
    if (size > maxBytes) {
      await reader.cancel();
      throw new Error("Body too large");
    }
    chunks.push(next.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}