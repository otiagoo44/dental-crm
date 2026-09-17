# DentFlow V2 — rollout and validation
## Expand → migrate → switch → retire
1. Reconciled existing Frappe branch and ran baseline.
2. Added failing DF-009 regression before correction.
3. Added bounded contact query alongside legacy service.
4. Applied only new staging migrations:
   - 20260915210052_contacts_query_slice.sql
   - 20260915210106_status_transition_contact_idempotency.sql
   - 20260916170139_allow_authenticated_index_normalizer.sql
   MCP assigned the first two versions. During a later MCP OAuth outage, the third migration was executed against the explicitly named staging project with Supabase CLI and that exact new version was marked applied. Local and remote history match. Old migrations remain untouched.
5. Switched only Patients and Contact360 to the dedicated query/resource path.
6. Preserved legacy data loading and fallback elsewhere; getClinicWorkspace remains DEPRECATED INTERNAL.
7. Migrated Work Center and validated it independently; legacy queue routes remain for parity/debug.
8. Expanded Contact 360 into an operating record with a server-side summary, paginated activity projection and interaction command. No new source-of-truth table was introduced.
9. Clarified Opportunity as a treatment operating record. Existing transactional workflows remain its command boundary; no migration was required.
10. Added global bounded search over Contacts and Opportunity treatments. Applied only `20260917002000_global_tenant_search.sql` to Staging after dry-run; no Production operation.

## Release evidence
Staging Supabase: aqdufiycayedsfldljjq. Vercel project: crm-odontologia-staging / prj_XQUi8CtCWRb9wMfE0Wdrbt4Cz3EC.
Deployment uses preview target with explicit staging URL/public key at build time. Existing deployment protection is preserved; browser QA uses its existing bypass only for the staging hostname. No production environment, project, migration, deployment or data changed.

| Check | Status |
|---|---|
| Existing npm ci | PASS |
| Query + DF-009 JS contracts | PASS |
| Rollback SQL contact/RLS + DF-009 + operational workflows | PASS |
| Authenticated staging queries / all lazy source tabs | PASS |
| Existing staging HTTP/Auth/RLS/intake/Reatime smoke | PASS 14/14 |
| Mocked contact pagination/race suites | PASS 9/9 |
| Full final npm test | PASS — 57 Playwright tests |
| Final build + diff review | PASS — production build and `git diff --check` |
| Final deployment + real browser smoke | PASS — deployment `dpl_2QJubbYFscsApkN6gZ1kjqgeLuk1`, 375/768/1440 |
| Hosted GitHub CI | PASS — run 35161627418 |
| Full migration-from-zero | PASS — run 35161627407 |
| Contact interaction staging contract | PASS — summary, timeline pages, idempotency, cross-tenant 0 |
| Contact 360 deployed browser | PASS — deployment `dpl_7b8gn7fD27UtgBg2WRrKfdcsFJP7`, 375/768/1440 |
| Opportunity hosted gates | PASS — CI 35163192886; Database-from-zero 35163192986 |
| Opportunity deployed browser | PASS — deployment `dpl_684pNyHV7dWDtXYxWsogNGLFBVza`, 375/768/1440 |
| Global search staging contract | PASS — Contact, Opportunity, bounds and cross-tenant 0 |
| Global search deployed browser | PASS — deployment `dpl_92GAYkLcpDzQtb5KTrX751EWx9QE`, 375/768/1440 |

## Reproduce
From crm-app: npm ci; npm test; npm run build.
From root: node --env-file=.env.qa-staging.local tests/contact-staging-test.mjs.
Execute tests/contact-query-rls.sql, tests/status-change-regression.sql and tests/operational-workflows-e2e.sql only on disposable/local or explicitly authorized staging; each rolls fixtures back.
Real deployed browser: tests/contact-browser-staging.mjs requires QA_FRONTEND_URL matching the staging preview allowlist, existing staging QA variables and the locally held existing Vercel protection bypass. Never commit credentials, session data or bypass secrets.
Performance evidence: DENTFLOW_V2_PERFORMANCE.json. Browser evidence: DENTFLOW_V2_STAGING_SMOKE.json; screenshots remain local temp artifacts.

## Migration CI next step
Reuse existing CI; first establish a deterministic local Supabase from-zero baseline. Then test base release + synthetic fixtures + only forward PR migrations + integrity/RLS assertions. Do not reset staging or production to simulate an upgrade. Existing historical version mismatch predates this slice and needs an explicit migration-history audit, not an automatic repair.

## Rollback
Application rollback can restore the previous staging deployment while leaving additive query/index/publication changes in place. Revert functional DB behavior only with a new reviewed forward migration; never edit or delete applied migrations.
Continue domain by domain. Retain each legacy path until its replacement has parity, hosted CI and staging browser evidence.
