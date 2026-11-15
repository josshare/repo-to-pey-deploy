<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Pey demo
- Payment QR/countdown and celebration are browser-only presentation modules; QR payloads explicitly identify the demo and never represent real provider payment data, while celebrations compare persisted attempt IDs to avoid replay effects.
- Demo logic lives in `src/lib/pey/engine.server.ts`, called only from server functions in `src/lib/pey/demo.functions.ts` with the admin client; why: visitors are anonymous, identified by an httpOnly `pey_demo` cookie, so tables have RLS on with no public policies.
- Simulated provider events are processed synchronously and deduplicated by (provider, external_id) in `webhook_events`; why: replaces the original NestJS outbox/job queue, which cannot run on the edge runtime.

## External providers
- Resolve Pey webhook signing through one server-only helper, preferring PEY_WEBHOOK_SECRET and falling back to the owner-confirmed legacy STRIPE_WEBHOOK_SECRET name; why: setup checks and signature verification must use the same stored Pey credential without exposing or copying it.
- Owner sign-in uses managed Google OAuth with a public origin callback and one shared verified-user listener; login never grants payment-operator privileges, because arbitrary visitors must not spend provider credentials.
- Real Pey and Kapso requests must run server-side through their linked custom connector gateways, using the credential names returned by connector tools; why: private credentials must never reach the browser or bypass gateway-backed connections.
- Verified real-provider notifications are stored in a separate locked inbox; only matched Pey QR payments reconcile isolated live orders atomically, while Kapso and unrelated events fail closed; why: anonymous demo controls must never affect real payments.
- Real orders require an authenticated enabled operator; a null recipient account means the Pey key's linked CoDi account and reconciliation then matches QR and amount only, fixed validated test amount and explicit consent; QR requests are atomically claimed and never automatically retried after uncertainty; why: public visitors cannot spend connector credentials and retries must not duplicate charges.

## Documentation
- Keep repository documentation in README.md and focused docs/*.md guides with embedded Mermaid diagrams, distinguishing simulated, implemented-but-unverified and activated flows; why: GitHub can render the diagrams and reviewers must not mistake prepared integration code for real payment evidence.
