# Gate A — technical evidence, 2026-09-28

## Git and baseline

The four local commits aa74fa1, c544f37, 0d25223 and 75d2c11 were present on the requested branch. origin/feature/dentflow-v2-maturity-2 at 9899db9 was their ancestor. Reviewed the four-commit diff and scanned added lines for private keys and token formats (no matches; not a full secret-scanner certification). Normal fast-forward push succeeded. Local and remote reconciled at 75d2c11fdceab7563e820ad38f0db0ff76333090.

At that SHA: npm ci PASS (152 packages, zero reported vulnerabilities); build PASS; npm test full rerun 75/75 PASS. First cold run had two 375px initial-render timeouts (Agenda date and navigation); both passed isolated and the subsequent full run passed without changing timeout/code. Preserve this as a test stability observation.

GitHub push CI run 36428167342 and Database from zero run 36428167272: independently verified completed/success for **75d2c11**. Vercel status success for the same SHA. These runs do not certify later commits. Branch protection was not changed.

## Real Staging authenticated tests

Project aqdufiycayedsfldljjq only. A new synthetic qa.reception.a2 account was created using the existing Staging admin provisioning mechanism, with a random password in the gitignored local environment. Its clinic derives from the authenticated QA Owner profile. It is active, receptionist, distinct from Reception A1, and belongs to Clinic A. Reception B remains in Clinic B. No existing password or user clinic changed. Provisioning script never sends the admin key to a browser or prints credentials.

`node --env-file=.env.qa-staging.local tests/saved-views-staging.mjs`: real authenticated HTTP PASS for private create/read/rename/persist in Work, Patients and Opportunities; Owner, Reception A2 and Clinic B cannot list/select/mutate the private fixture. Team creation/update by Owner, Reception visibility, denied mutation/deletion, injected clinic/user, foreign assignee and malformed UUID checks PASS. Four synthetic views deleted and absence verified.

`tests/reception-activity-staging.mjs`: Reception creates a synthetic administrative note, retries, reads exactly one event through independent requests, and Clinic B is denied. PASS. The immutable QA note is retained under synthetic QA interaction contact c7396514-6d1b-4fa7-a799-ef92ddf1775f. This proves RPC persistence, not visible UI refresh.

## Activity content policy and negative tests

Current domain: operational `lead_events`, including administrative notes, are shared with active clinic members. There is no existing Owner-only note classification. Owner/Admin-only technical audit lives in `audit_logs`; public form configuration is also Owner/Admin-only. Quotes are clinic-readable, so quote amount in a shared event does not establish a role leak.

Observed event inventory: administrative_note; appointment_attended/cancelled/confirmed/no_show/rescheduled/scheduled; contact_attempted; followup_postponed/scheduled; lead_contacted/created_from_landing/created_manual/duplicate_submission/reassigned; new_opportunity_after_terminal; quote_accepted/created/updated; status_changed; task_completed/completed_auto; treatment_started.

`tests/activity-content-permissions.sql` executed both against an isolated PGlite database after all 30 migrations and against Staging PostgreSQL in a transaction that rolled back all synthetic fixtures: PASS. Owner, Admin, two Reception users, foreign clinic and inactive profile tested. All 23 shared types preserve allowed title/description, safe actor name/id and related identifiers. Technical metadata canary is absent from the timeline projection. Restricted audit/form and foreign clinic sentinels are absent from the serialized response and checked errors. Positive controls prove Owner/Admin can read restricted fixtures while Reception cannot through direct RLS. Anonymous execute is denied.

Important limit: raw lead-event metadata **is readable through the existing same-clinic record API**. Timeline excludes its full JSON but exposes channel/outcome. This test does not claim arbitrary secrets would be safe if producers put them in shared title/description/channel/outcome or lead-event metadata. No restricted content leak was demonstrated under the current policy; no schema correction was introduced.

Realtime publication assertion: lead_events, audit_logs and clinic_public_forms are not published in supabase_realtime. This is database configuration evidence, not a browser delivery test. A future publication change must trigger a new runtime privacy matrix.

All eight SQL suites PASS locally: database-from-zero, contact-interactions-rls, activity-content-permissions, global-search-rls, saved-views-rls, operational-integrity, operational-workflows-e2e and clarity-scoring. Database-from-zero is not an upgrade certification.

## Reference patterns reviewed

- [Frappe activity permission regression test](https://github.com/frappe/crm/blob/develop/crm/tests/test_activity_permlevel.py): negative sentinels plus a visible positive control detect content leaks. DentFlow adopts the test technique at its existing RLS boundaries; it does not copy dynamic field permission levels.
- [Frappe activity API](https://github.com/frappe/crm/blob/develop/crm/api/activities.py): related-record visibility matters when assembling an activity stream. DentFlow already joins within clinic and tests the foreign-contact path; no generic activity engine introduced.
- [Twenty messaging timeline service](https://github.com/twentyhq/twenty/blob/main/packages/twenty-server/src/engine/core-modules/messaging/services/timeline-messaging.service.ts): content visibility depends on the underlying record/channel policy. DentFlow keeps its existing shared operational-note policy; no messaging model, system-auth bypass or metadata framework copied.

## Browser sign-off pending

Chrome integration was available, but opening https://crm-odontologia-staging.vercel.app was rejected by the browser tool's **saved user permission setting**, before navigation. This is not evidence of an app, Vercel or Auth failure. User intends to enable the domain; latest attempt remained rejected. No alternate browser/CDP/Playwright bypass attempted.

Manual procedure (only Staging, separate Owner/A1/A2/B browser contexts; no logout or password reset):

1. Reception A1, Work: set a filter; create Private; apply; reload; back/forward; paste its deep link. Expect the same filter/query state. Rename and verify persistence; keep one private fixture for isolation checks. Repeat essential create/apply/reload/rename/delete in Patients and Opportunities.
2. A2 and Owner same clinic: A1 private fixture is absent; direct saved-view URL must not reveal its content. Clinic B cannot access any Clinic A fixture.
3. Owner creates Team in Work. A1/A2 see/apply it but cannot rename/delete. Owner changes it; Reception reload sees the updated configuration.
4. Reception A1 opens a synthetic QA Contact 360, records an administrative note, sees it immediately, reloads and sees it exactly once with the correct actor. No admin session needed.
5. Check 375/768/1440 layouts, keyboard Tab/Enter/Escape, dialog labels and focus return. Record browser/version, role, time, expected/actual result and screenshots without credentials. Delete only the synthetic saved views at completion.

Gate A technical: **TECHNICALLY VERIFIED** for executed SQL/RLS/RPC checks. Browser real: **NOT RUN — tool permission blocked**. Overall: **MANUAL BROWSER SIGN-OFF PENDING**, not FULL PASS. Independent Block B engineering is allowed by the latest user instruction; no open demonstrated content-security defect blocks it.

Production modified: NO. Historical migrations/history modified: NO.
