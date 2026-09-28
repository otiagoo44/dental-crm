# Gate A operational evidence — 2026-09-28

**Gate A: OPEN / BLOCKED for real browser evidence. No authorization to advance to B inferred.**

This is a continuation of the current gate, not a new general audit. HTTP RPC,
isolated SQL, mocked Playwright and real browser observations are distinct evidence.

## Source and baseline

- Executed `git fetch --all --prune`, checkout of the requested branch, `git pull --ff-only`, status and log before inspection.
- Local and remote HEAD: `9899db9deafd92d6922a585d3ab2c760a5ea369d` on `feature/dentflow-v2-maturity-2`; initially clean. No new upstream commits.
- Versus `origin/main`: 30 ahead, 1 behind. No rebase, reset, new branch or backup branch access.
- `npm ci` initially failed at repository root because no package exists there. Correct execution in `crm-app/`: PASS, 152 packages installed, 0 reported vulnerabilities.
- `npm test` in `crm-app/`: PASS, all contracts and **75/75 Playwright tests**, 375/768/1440, 3.2 minutes. These browser tests use mocked API fixtures on localhost; they do not close real Reception QA.
- `npm run build`: PASS, Vite 7.3.6, 11.93 seconds; `build.sourcemap: false` unchanged.
- `git diff --check`: PASS before edits. No lint script is defined.
- Isolated PGlite: all **30 migrations** and seven SQL suites PASS: database-from-zero, contact-interactions-rls, global-search-rls, saved-views-rls, operational-integrity, operational-workflows-e2e, clarity-scoring. Used the existing PGlite installation outside the repository. PGlite uses the existing test harness's Auth bootstrap and pgcrypto adaptation; it is not a full hosted Supabase stack.

## Independently reverified hosted checks

GitHub API queried by exact SHA and `event=push`; not the connector helper that
only returns PR-triggered runs. Jobs and steps were independently retrieved.

| Check | Evidence | Result |
| --- | --- | --- |
| Frontend tests and build | [CI run 35939465998](https://github.com/otiagoo44/dental-crm/actions/runs/35939465998), job 107443929447 | SUCCESS; npm ci/test/build and whitespace steps SUCCESS |
| Database from zero | [Run 35939466061](https://github.com/otiagoo44/dental-crm/actions/runs/35939466061), job 107443929304 | SUCCESS; isolated database start, migration reset and SQL validation steps SUCCESS |
| Vercel commit status | [Deployment status target](https://vercel.com/ortegatiago733-2656s-projects/dental-crm/DEDn2pijWgnMp4HTVmM73oK9Kbbs) | SUCCESS on exact HEAD; frontend page not reverified in this session |

These are existing runs from September 24, independently read on September 28,
not new CI executions and not CI evidence for the uncommitted test additions.

GitHub branches API confirms `protected: false`. No protection was changed.
Required checks remain NONE according to the supplied external verification;
the branch response alone does not independently establish all ruleset settings.
Future release/production recommendation: require Frontend tests/build,
Database-from-zero, reproducible Upgrade, E2E and Security. Do not enable a
nonexistent Upgrade check or call from-zero an upgrade check.

## Real Staging RPC evidence

Supabase MCP project URL verified as `https://aqdufiycayedsfldljjq.supabase.co`.
Tests also enforce that exact origin before authentication. Ordinary Auth sessions
and the public client key were used; no service role or privileged SQL for role tests.
Existing Owner A, Reception A, Owner B and Reception B credentials authenticated
successfully; all profiles active with the expected roles. Owner A and Reception A
share a clinic. **Reception B belongs to Clinic B**, not Reception A's clinic.

`node --env-file=.env.qa-staging.local tests/saved-views-staging.mjs`

Run completed at **2026-09-28T12:28:41.281Z**:

- Work, Patients, Opportunities: Reception private create/read/rename/persist PASS.
- Each private view hidden from same-clinic Owner and Clinic B by list RPC and direct row SELECT; update/delete RPC denied with `42501`.
- Owner team create and update observed by Reception. Reception create/update/delete team denied with `42501`; foreign clinic cannot see or mutate the team view.
- Caller-supplied foreign clinic/user RPC parameters rejected with `PGRST202` (no such signature). Foreign assignee filter rejected with `22023`. Malformed UUID update/delete rejected with `22P02`.
- All four created synthetic views deleted by their creators; subsequent lists verified absence. No existing view changed.
- Same-clinic second Reception: **NOT RUN**. Optional `QA_RECEPTION_A2_EMAIL` / `QA_RECEPTION_A2_PASSWORD` allow this test without creating or changing Auth accounts. Never supply those values in a report or commit.

`node --env-file=.env.qa-staging.local tests/reception-activity-staging.mjs`

Run completed at **2026-09-28T12:30:14.328Z**:

- Active Reception registered an administrative note on an existing `QA INTERACTION` fixture, retried the same operation, and read exactly one matching event in two independent timeline HTTP requests: PASS.
- Actor identity matched Reception. Bounded result, tenant/contact IDs and exact projected field set verified; no raw `metadata` or full snapshot returned: PASS.
- Clinic B attempts using the foreign clinic ID and its own clinic ID with the foreign contact: denied (`42501` / `P0002`).
- One immutable synthetic note intentionally retained: `Gate A Reception API QA 4eec5b36-9f8b-41b1-afcc-2e6f363ecf68`, contact `c7396514-6d1b-4fa7-a799-ef92ddf1775f`, opportunity `efc360ca-64c4-404e-a707-4c07890f7355`. No patient contact attempt was fabricated.
- This verifies RPC persistence, **not browser refresh**. It does not prove the full restricted-event-content permission matrix: `title` / `description` are returned, so absence of raw metadata alone is insufficient.

Neither test globally signs out QA users; existing browser sessions are preserved.
The Activity script adds one synthetic immutable note each time it is intentionally run.

## Gate matrix and blockers

| Requirement | Current evidence | Gate status |
| --- | --- | --- |
| Owner Saved Views browser | Prior report only; current browser access denied | NOT REVERIFIED |
| Reception Saved Views browser | Local mocked tests + actual HTTP RPC only | BLOCKED |
| Private isolation | Owner and Clinic B actual HTTP PASS; second same-clinic Reception isolated SQL PASS only | INCOMPLETE |
| Team permissions | Actual HTTP PASS; real UI application/edit controls pending | INCOMPLETE |
| Direct RPC | Actual Staging manipulated parameters/IDs PASS | PASS for executed cases |
| Cross tenant | Actual Staging Saved Views/Activity cases PASS | PASS for executed cases |
| Reception Activity | Actual HTTP create/retry/read/persist PASS; browser refresh pending | INCOMPLETE |
| Activity permission | Exact field projection and cross-tenant rejection PASS; restricted content matrix pending | INCOMPLETE |

Browser control rejected opening `https://crm-odontologia-staging.vercel.app`:
permission denied by the user according to the tool. No alternate browser,
raw CDP, injected session or other route was used to bypass the denial. A request
to enable the intended access was issued; no answer received during this evidence run.
After access is restored, maintain separate Owner and Reception contexts and run
the full requested create/apply/refresh/history/deep-link/rename/delete matrix.

No product/schema change, migration, deployment, ENV edit, role/password change,
history repair or Production access was performed. Blocks B–J were not started.
The `20260904201956` / `20260904203022` upgrade discrepancy remains unresolved;
no A/B/C classification is claimed and no `03-upgrade.yml` was created.
**Database-from-zero PASS does not mean Upgrade PASS.**

## Follow-up verification and smoke (same gate)

After the requested continuation, fetch/checkout/ff-only pull again confirmed the
same remote HEAD. The following checks were rerun without product/schema edits:

- `npm test`: contracts and **75/75 Playwright PASS** again (3.2 minutes).
- `npm run build`: PASS again (22.23 seconds).
- All 30 migrations and the same seven isolated SQL suites: PASS again.
- Exact remote SHA push runs and Vercel status: independently queried again, SUCCESS.
- Staging full smoke: first run **13 PASS / 1 FAIL**, Realtime event timeout after
  subscribing. Focused authentication/Realtime run then **2/2 PASS**, 1,751 ms.
- Final full Staging smoke, without concurrent Playwright/build: **14/14 PASS**;
  Realtime subscription-through-delivery measurement **1,449 ms**.
- The first timeout is retained as a warning. Realtime logs in
  `2026-09-28T12:40:00Z`–`12:58:00Z` show service initialization at 12:55:41–42;
  this does not establish the cause. No specific Realtime/WAL/replication
  performance advisory was found. No service configuration was changed.

Full smoke covers four actual QA users, own/foreign clinic RLS read/write checks,
existing manual assignment tenant boundaries, public intake/deduplication,
tenant/token/origin/consent/spam rejection, terminal reintake history and Realtime
delivery. Its synthetic consultation fixtures are retained as in the existing
smoke workflow. This is **API/Realtime service evidence, not browser Work visibility**.
No Assignment V1 policy or concurrency implementation is implied by these checks.

Smoke changes are test-only: pin the allowed Staging origin, close only the test's
own Auth sessions (`scope: local`) instead of globally logging out QA users,
report intake HTTP errors before waiting for Realtime, and match the test's
specific event. `QA_REALTIME_ONLY=1` provides a focused diagnostic mode and does
not claim cross-tenant coverage. The 15-second event timeout was not increased.

Small local commits:

- `aa74fa1` — `test: add reception staging RPC gate evidence`
- `c544f37` — `test: harden staging smoke session and realtime checks`

Documentation and graph refresh follow separately. No push was performed;
hosted CI evidence applies to remote `9899db9`, not these local additions.
No gate was renamed to PASS. Browser access and the other Gate A blockers remain.
