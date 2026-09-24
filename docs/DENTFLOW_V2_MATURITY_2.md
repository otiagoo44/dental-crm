# DENTFLOW V2 — MATURITY SPRINT 2

## Git and scope

- Source: `origin/feature/operational-maturity-v1`, verified after fetch as `9585eca2763ab0c3abae10e8b338c62053130c76`.
- Continuation: `feature/dentflow-v2-maturity-2`, created directly from that remote ref with a clean worktree.
- Backup branch used as base: **NO**. Only inspected the saved-view draft at `backup/local-work-20260923:supabase/migrations/20260917013000_saved_views_lite.sql`.
- Dependency fix: cherry-picked lockfile-only `9eb12df` as `db13fea` without conflicts. No merge of main.
- Initial verification: npm ci PASS (0 vulnerabilities), contracts PASS, build PASS (sourcemap false), git diff --check PASS. First browser run: 60/63 PASS with three initial page-load timeouts while build ran concurrently. Those three passed isolated; full rerun without concurrent build: **63/63 PASS**.
- Only authorized remote database: Staging `aqdufiycayedsfldljjq`; confirmed via MCP URL. Production modified: **NO**.

## A — Saved Views design and draft audit

Problem: users repeat useful operational filters. Minimal dental solution: save the existing list filter state; no metadata engine or expressions.

Draft defects: admin could read and modify another user's private view; filter values unvalidated; arbitrary sorts/columns/grouping; no team-name uniqueness, timestamp trigger, update/delete RPCs or quotas. Draft was not applied to Staging. Its intent is recovered in a new CLI-generated migration; no historical migration changed.

System views stay in versioned code. User views store entity, trimmed name, privacy, filters and supported sort. No `is_system`, column customization, group_by or view builder.

Private: only creator can read/edit/delete, including against same-clinic owner/admin. Team: active clinic members can read, owner/admin can create/edit/delete. Only original creator can make a shared view private. Tenant, creator, entity and creation timestamp cannot be reassigned. All RPCs and the validation trigger are SECURITY INVOKER with empty search_path. Existing membership helpers are reused. Table RLS and a central trigger enforce the same constraints for direct writes; frontend uses only four RPCs.

Limits are product bounds, not universal clinical thresholds: **20 private views per user per entity** and **30 team views per clinic per entity**, sufficient for a small set of reusable daily work lists (maximum 60 private per user and 90 team per clinic). Private clinic total scales with authorized membership. Integer slots plus partial unique indexes enforce quotas even under concurrency; advisory locks serialize allocation. Each list is bounded to 50 visible records. Filters <= 2048 bytes; q <=160 characters; domain labels <=80; name 1–80; sorts <=128 bytes and at most one. These bounds keep lists scanable and payloads small without adding a view manager.

Allowed filters derive from existing views: Work view/assignee; Patients q/view; Opportunities q/status/treatment/classification/priority/assignee/source/date/archive. Enum values are checked. Assignees must be active and same-clinic. Treatment/source are literal known tenant labels or product options. Work and Patients retain fixed ordering (`[]`). Opportunities supports existing created_at ascending/descending, name ascending, score descending. No arbitrary field names or directions.

Saved view → existing URL parameters → existing query layer. Cursor and one-shot commands are not saved. Opportunities previously used local filter state; those controls now read/write the URL. Work preserves assignee on pagination and passes authorized Team requests to the backend rather than silently normalizing them to My work.

## Evidence in progress

- Red: SQL runtime suite failed on missing create RPC before implementation.
- Green: all local migrations plus `saved-views-rls.sql` passed on isolated PGlite PostgreSQL. Includes private/admin privacy, team roles, tenant isolation, inactive users, direct-write constraints, invalid entity/filter/sorts/JSON, duplicate name, update/delete and private quota.
- Red: URL contract test failed on absent implementation; green after implementation.
- Hosted Frontend CI and Database-from-zero CI: **PASS**. Staging has the first two audited migrations, but remote runtime verification exposed transport re-encoding of accented literals; the ASCII-only follow-up migration, deployment and real browser QA remain pending. Block A is **not yet PASS**.
- Blocks B–K: not started; no claim of completion.

### Regression discovered by broader SQL verification

`operational-integrity.sql` had an outdated reintake fixture (different treatment). Corrected it to test same-treatment repair and assert the exact original opportunity ID. This exposed **real baseline defects**, confirmed in the live Staging function definition: `20260916180630` used mojibake outcome labels (`AsistiÃ³`), rejecting the UI's canonical UTF-8 attendance and no-show; it also preserved opportunity status on the appointment itself during cancellation. Forward-only `20260924001122_fix_appointment_outcome_encoding.sql` preserves the existing atomic SECURITY DEFINER contract and appointment-state correction, but its remote application demonstrated that non-ASCII SQL literals are re-encoded by the migration transport. A third forward-only migration, `20260924003500_fix_appointment_outcome_unicode_runtime.sql`, constructs canonical labels with `chr(243)` inside PostgreSQL; it is ASCII-only at transport and is pending CI plus Staging verification. No historical rows or old migrations were edited. Operational integrity, workflow E2E and scoring suites pass in the isolated PGlite/database-from-zero verification. Cancellation has a dedicated retry assertion for appointment state, preserved commercial state and no duplicated work/events.

Local frontend: all contracts and **75/75 Playwright** tests PASS, including 12 Saved Views cases at 375/768/1440; production build PASS. No lint script exists in the package. Graph refreshed via `graphify update .` (AST only); community labels were automatically regenerated where communities changed.

## Migration safety

Known history mismatch remains `20260904201956` locally vs `20260904203022` in Staging. No repair, rename, drop or history rewrite performed. Investigation belongs to C. Any Staging apply must target only the new audited SQL, never blindly db push old history.
