# articles-service — repo conventions

Express + TypeScript (strict) + Zod + Drizzle (postgres.js driver) on Neon. Deployed on Railway.

## Testing

- `npm run test:unit` → `tests/unit/` — pure, no DB. Run these locally.
- `npm run test:integration` → `tests/integration/` — needs a real Postgres with the articles schema.
- **Integration tests are effectively CI-only.** CI (`.github/workflows/test.yml`) spins up a per-PR Neon branch, runs `drizzle-kit push --force` from `src/db/schema.ts` (NOT the migration files), then runs the suite. So integration green depends on `schema.ts` being correct.
- ⚠️ A fresh Conductor workspace has **no** `ARTICLES_SERVICE_DATABASE_URL` and no `.env`. `tests/setup.ts` falls back to `postgresql://test:test@localhost/test` — which in this dev box is **another service's local DB** (e.g. billing), NOT articles. Do NOT point vitest or `drizzle-kit migrate/push` at it; you'll either fail on missing relations or pollute a sibling's DB. Let CI validate integration instead of forcing it locally.

## Migrations

- Hand-authored `drizzle/NNNN_<name>.sql` + a matching entry appended to `drizzle/meta/_journal.json` (`idx`, `version:"7"`, increasing `when`, `tag`). `drizzle-kit generate` is NOT used here (meta only has `0000_snapshot.json`).
- Make every statement idempotent: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, FK adds wrapped in `DO $$ ... EXCEPTION WHEN duplicate_object THEN null; END $$`.
- Applied two ways: boot `migrate()` in `src/index.ts` (skipped when `NODE_ENV=test`) AND `migrate.yml` on push to `main` (paths `drizzle/**`, `src/db/schema.ts`). Keep the SQL migration and `schema.ts` in lockstep.

## Routes & auth

- `src/index.ts` mounts: health + stats + internal BEFORE `requireIdentity`; articles/topics/discoveries/discover/mentions AFTER it. Anything after `requireIdentity` needs `x-org-id` + `x-user-id` + `x-run-id`.
- Org-write routes ALSO take per-route `requireApiKey` (`X-API-Key`). `internal/*` use api-key only; `stats` handles its own auth (public variant = api-key only).
- Identity scoping convention: `org_id` from `x-org-id`, `brand_ids` from comma-split `x-brand-id`, `campaign_id` from `x-campaign-id`, actor from `x-user-id`.
- Tracking-header forwarding: every outbound call to an internal sibling MUST forward the full tracking block — `x-run-id`, `x-workflow-slug`, `x-feature-slug`, `x-brand-id`, `x-campaign-id`, **`x-audience-id`** (per-audience cost attribution; optional, omit when absent, never throw). `x-audience-id` is passthrough-only here: articles-service declares no runs-service cost itself (LLM goes through chat-service which owns the cost), so it tags no cost row — it just reads inbound + re-forwards. NEVER forward tracking headers to a third-party vendor; articles-service makes zero direct vendor calls (all egress is internal), so the strip is satisfied by construction. New outbound call sites must include `x-audience-id` in their header spread (`services/*.ts`, `lib/trace-event.ts`).

## Every new endpoint = 3 edits in one PR

1. Zod schema in `src/schemas.ts` (no `.default()` — fail loud; cross-field checks in the route, not via `.refine` on the openapi schema, to keep zod-to-openapi happy).
2. `registry.registerPath({...})` in `src/schemas.ts`.
3. Regenerate `openapi.json` (`npx tsx scripts/generate-openapi.ts`) and commit it.

## Shipping

No `release.sh`. PR → target branch, `gh pr merge --auto --squash`. Additive, zero-blast-radius changes (new table / new route / new nullable column) ship **hotfix → main** directly per the global prod-direct default.
