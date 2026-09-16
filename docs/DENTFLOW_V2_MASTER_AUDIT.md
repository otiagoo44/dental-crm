# DentFlow V2 — foundation audit
Date: 2026-09-15. Branch: feature/operational-maturity-v1. Base inspected: main...8bfcae7, plus local changes. No reset, checkout, new branch or production operation.

## Reconciliation
| Existing change | Reason | Decision |
|---|---|---|
| App.jsx + React Router | Auth/public boundaries and persistent navigation | KEEP shell |
| CrmRoutes, paths, PatientPage | Contact/opportunity deep links | MODIFY contact reads; keep nested opportunity compatibility |
| useCrmController | Earlier extraction of App workflows | KEEP commands; remove proven dead branches. Concentration remains |
| useClinicWorkspace + crmApi | Shared data for legacy views | MODIFY enable gate; KEEP fallback for legacy |
| WorkspaceModals | Isolated lazy modal rendering | KEEP; create from Patients opens legacy opportunity workflow |
| CI + Playwright | Reproducible auth/routing checks | KEEP; extend existing suites |
| Graphify + AGENTS.md | Persistent architecture map and project rules | KEEP |
| Wholesale rewrite / new dependencies | No evidence of need | REJECT |

## Findings
| ID | Severity | Area | Finding | Evidence | Change | Status |
|---|---|---|---|---|---|---|
| DF-001 | HIGH | Queries | Full tenant fetch, nine resources | crmApi.getClinicWorkspace; staging measurement | Paginated Contacts and scoped Contact360; legacy explicitly marked | PASS migrated slice; VERIFIED STATIC remaining legacy |
| DF-002 | HIGH | Realtime | Eight handlers refresh whole workspace | useClinicWorkspace | Legacy disabled on contact routes; dedicated authoritative invalidations | PASS browser mocked races; staging validation recorded separately |
| DF-003 | MEDIUM | Analytics | Arrays aggregated client-side | analytics.js; graph relationships | Deferred server aggregate contracts | VERIFIED STATIC |
| DF-004 | MEDIUM | Work | Pending/Followups/Tasks overlap | routing, nextActions and server projection | Canonical `/trabajo` projection; legacy routes retained for parity/debug | PASS parity decision + staging browser 375/768/1440 |
| DF-005 | HIGH | Controller | App shell simplified, domain still concentrated in controller | useCrmController remains >1,200 lines | Independent query/resource modules; no split just for size | VERIFIED STATIC; commands extraction deferred |
| DF-006 | MEDIUM | Routing | Existing real routes; inaccessible 404 heading and flawed new-tab test | Baseline 30/36, missing heading and popup timeout | Real h1, native modifier click, paginated patient routes, URL date | PASS original 36; expanded final run in release evidence |
| DF-007 | MEDIUM | CI | Existing npm ci, tests, Playwright, build, diff check | GitHub Actions run 35130921068 | Feature branch push trigger and Work contracts | PASS hosted |
| DF-008 | MEDIUM | Migrations | No automated from-zero / base-release upgrade job | GitHub run 35131364971 | Isolated Supabase reset plus schema/RLS/grant/FK checks | PASS from-zero; upgrade BLOCKED by historical version mismatch |
| DF-009 | HIGH | Correctness | statusChanged returns before contact counters/events/task branches | updateLead test + SQL regression | Remove dead branches; make repeated Contactado assignment idempotent in existing atomic RPC | PASS JS + staging SQL |
| DF-010 | HIGH | Permissions | Authenticated same-clinic lead edits could not evaluate the open-opportunity expression index | Real owner update failed with 42501 on normalize_domain_text | Grant EXECUTE only on the immutable, table-free normalizer; keep table RLS and guarded update policy | PASS staging edit + Contact sync |
| DF-011 | HIGH | Work data | Three client queues produced competing definitions of required work | PendingPage, FollowupsPage, TasksPage | `list_work_items_v1` projection with canonical types/views and bounded keyset query | PASS contracts + staging isolation |
| DF-012 | MEDIUM | Migration history | Local 20260904201956 differs in version from staging 20260904203022 | Supabase migration list | No repair; temporary staging apply mapping used only after dry-run selected one new migration | OPEN; blocks automated upgrade test, does not block from-zero |
| DF-013 | HIGH | Appointment workflow | Cancel attempted to persist `Cancelado` into constrained opportunity status | Staging workflow QA returned 23514 | Forward migration preserves commercial status while recording appointment cancellation and recovery task | PASS staging regression |

DF-009 nuance: unreachable browser code did NOT prove missing contact timestamps. The existing RPC already updated last_contact_at/contact_attempts. The reproducible failure was repeating Contactado incremented attempts twice. The migration keeps SELECT FOR UPDATE, tenant/role checks, fixed search_path and the existing transaction. Explicit mark_lead_contacted still records real additional attempts. Notes remain a separate existing command; no claim that a combined note/status edit is one transaction.

## Executed evidence
- Baseline npm ci/build/contracts PASS. Baseline routing 30 PASS, 6 FAIL.
- contact-query-rls.sql: 61 tied-date contacts across pages, no duplicates, search/filter, two opportunities, invalid limits/cursors/filter, literal wildcard, cross-tenant contact/opportunity checks PASS. Fixtures rolled back.
- status-change-regression.sql: FAIL before migration for duplicate Contactado; PASS after migration including invalid due-date rollback.
- operational-workflows-e2e.sql: PASS after both migrations; rollback fixtures.
- contact-staging-test.mjs: authenticated HTTP list/detail/all related tabs and tenant isolation PASS.
- staging-smoke.mjs: initial 13/14; test raced subscription. Replaced fixed sleep with SUBSCRIBED handshake; final 14/14 PASS, including live intake event.
- New mocked browser race suite: PASS at 375/768/1440. Tests assert no legacy fetch, stale responses discarded, duplicate events coalesced.
- Moving an opportunity away from an open Contact360 record is covered even when Realtime's old row omits contact_id.
- index-normalizer-permission-staging.mjs: authenticated same-clinic edit and trigger-driven Contact sync PASS; name restored.
- Final full suite/build/deployment/browser statuses: see migration plan and DENTFLOW_V2_STAGING_SMOKE.json.

## Performance
See DENTFLOW_V2_PERFORMANCE.json for the captured dataset: legacy 9 requests, 309 rows, 320,700 JSON bytes; Contacts 1 request, 26 rows (25 rendered + sentinel), 12,552 bytes. Excludes common auth/profile/clinic bootstrap, HTTP headers and compression. This is an observed payload reduction on this staging dataset, not a universal latency claim.
Authenticated EXPLAIN ANALYZE of list_contacts_page with profile lookup: 26 rows, 12.999 ms, 1,374 shared hits, no disk reads. One sample, not a load benchmark. Search is a literal server substring; future larger-tenant plans may justify trigram indexing.

## Residual risks
- Existing npm audit: build-tool transitive browserslist HIGH and baseline-browser-mapping MODERATE (full install also reports one LOW). No dependency upgrades bundled here.
- Existing Supabase advisories: 16 authenticated SECURITY DEFINER workflow functions; save_lead_followup retains required guarded domain writes. New read function is INVOKER. Auth leaked-password protection is disabled. No auth settings changed.
- Legacy analytics/opportunity detail/workspace still have unbounded fetches.
- Contact summary responsibility is the owner of the earliest active opportunity, not a new patient-owner model.
- Graphify used as discovery map, followed by source inspection and execution. Real Codex token savings not measured.
