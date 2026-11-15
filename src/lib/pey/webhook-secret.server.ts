// The legacy name holds a Pey secret confirmed by the project owner, not Stripe credentials.
export function getPeyWebhookSecret() {
  return process.env["PEY_WEBHOOK_SECRET"] || process.env["STRIPE_WEBHOOK_SECRET"];
}