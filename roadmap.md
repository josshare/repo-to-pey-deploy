# Pey + Kapso

- [x] Use the existing owner-confirmed Pey webhook secret stored under STRIPE_WEBHOOK_SECRET consistently in setup checks, QR authorization and webhook verification; dedicated Pey configuration takes precedence. Real delivery verification remains pending.

- [x] Add basic Google sign-in while preserving explicit owner authorization. Provider enabled; button, mobile layout and existing tests verified. Complete Google login still requires the user's interaction.
- [ ] Enable the intended payment owner only after identifying their Google account and verifying recipient setup; owner email was not supplied, so activation is blocked.

- [ ] Add repository documentation and Mermaid diagrams matching the reference project's level of clarity, separating demo, prepared real payments and pending activation.

- [x] Prepare a separate owner-only real-order flow: fixed $0.01 QR, verified payment and ready-to-prepare state, without creating a payment during setup.

- [x] Add WhatsApp phone / Pey terminal view, demo QR with persisted expiry countdown, opt-in payment sound and replay-safe confetti.

- [x] Connect Pey credentials and verify read-only access; current linked connection uses production.
- [x] Connect Kapso credentials and identify the Sandbox WhatsApp sender.
- [ ] Replace simulated onboarding and payment requests with verified Pey operations.
- [ ] Persist and verify Pey and Kapso callbacks; reconcile payment and message states safely.
  - [x] Create isolated locked inbox and signature-verifying receivers; fail closed while live processing is not activated.
- [ ] Test a complete WhatsApp charge and confirmed payment without simulated bank controls.

Current blockers: no auth users or enabled live operator, no verified recipient account assigned, missing Pey webhook signing secret and Kapso number/key setup, and publication of the new live-order flow. User consent is limited to $0.01 MXN per payment. Real QR creation and atomic reconciliation are implemented but not activated or tested with a real payment. Unmatched events and Kapso processing still return 503. No automated refunds, real onboarding or WhatsApp sending are implemented. Public desktop/mobile checks and 17 unit tests passed; authenticated and real-payment end-to-end checks remain blocked by setup.