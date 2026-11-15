import { z } from "zod";

export const liveOrderInput = z.object({
  requestId: z.string().uuid(),
  concept: z.string().trim().min(1).max(40),
  amountCents: z.literal(1),
  consent: z.literal(true),
});

export const peyQrResponse = z.object({ id: z.string().min(1), qrString: z.string().min(1) });

export const peyPaymentEvent = z.object({
  type: z.literal("codi.qr.payment_received"),
  amount: z.literal(0.01),
  bankAccountId: z.string().min(1),
  codiQrId: z.string().min(1),
  transactionId: z.string().min(1),
  datePaid: z.number().int().positive().max(8640000000000),
});

export function qrRequest(concept: string, bankAccountId: string, orderId: string) {
  return { amount: 0.01, concept, bankAccountId, expiration: 600, generateImage: false, metadata: { orderId } };
}