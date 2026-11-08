# Pey + Kapso

- [x] Connect Pey credentials and verify read-only access; docs offer production only, not a payment sandbox.
- [x] Connect Kapso credentials and identify the Sandbox WhatsApp sender.
- [ ] Replace simulated onboarding and payment requests with verified Pey operations.
- [ ] Persist and verify Pey and Kapso callbacks; reconcile payment and message states safely.
  - [x] Create isolated locked inbox and signature-verifying receivers; fail closed while live processing is not activated.
- [ ] Test a complete WhatsApp charge and confirmed payment without simulated bank controls.

Current blockers: provider callback signing secrets and setup, publication for external callbacks, and explicit consent before testing any real-money payment. Receivers are prepared locally but intentionally return 503 while setup or business processing is incomplete. Real onboarding, sending, reconciliation, and end-to-end flow are not implemented yet.