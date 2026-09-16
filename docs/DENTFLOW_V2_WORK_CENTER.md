# DentFlow V2 — Work Center

## Canonical model
`WorkItem` is a read projection, not a table. Sources remain `tasks`, `appointments`, `quotes` and opportunities requiring assignment. The RPC returns explicit patient, opportunity, reason, due, responsibility, source, allowed actions and stable sort fields. It is `SECURITY INVOKER`, clinic scoped, RLS backed, limited to 1–100 and ordered by operational time bucket, due date, priority and key.

Canonical mapping:
- open contact task + Nuevo/No Contactado → `initial_contact`;
- open contact/follow-up task → `followup`;
- other open task → `manual_task`;
- Agendado → `confirm_appointment`; Confirmado due/past → `attendance`;
- No Asistió → `no_show_recovery`;
- pending quote → `quote_followup`;
- Reactivar 30d task → `reactivation`;
- opportunity without owner → `assign_owner`.

The source key (`task:`, `appointment:`, `quote:`, `owner:`) prevents source duplicates. Multiple genuinely independent tasks remain separate. Priority commercial is not the primary order.

## System views and permissions
Views: Mi trabajo, Vencidos, Hoy, Próximos, Primer contacto, Seguimientos, Confirmaciones, No-show, Presupuestos, Reactivaciones, Sin responsable and Equipo. Owner/admin may use Equipo. Reception receives `42501` from the RPC and the UI omits that view. View, assignee, cursor and limit are validated server-side.

## Guided actions and Realtime
The row exposes one primary action. It reuses existing atomic workflows: contact, confirm appointment, complete task or record outcome. Each row links to Contact 360 and the opportunity. Work Realtime listens only to leads/tasks/appointments/quotes, coalesces bursts for 150 ms and discards stale query responses. `/trabajo` disables `getClinicWorkspace`; legacy pages keep their own path.

## Legacy parity
Pending legacy combined one item per lead through `buildNextActionQueue`; Followups inferred missing next steps client-side; Tasks exposed each task. Work makes these product decisions explicit:
- source records are authoritative and server filtered;
- distinct sources may produce distinct items for one opportunity;
- commercial score does not outrank overdue work;
- unassigned work is an explicit item;
- completed/cancelled tasks and terminal quote states disappear.

Legacy files and routes remain for regression/debug. Differences are intentional product changes unless controlled fixtures prove a projection defect.

## Release safety and migration history
From-zero uses an isolated local Supabase in GitHub and applies every local migration. Staging records contact model as `20260904203022`; the repository has equivalent intended migration `20260904201956`. The staging schema already contains its objects and subsequent contact tests pass, but remote stored SQL could not be retrieved without Docker. No migration was renamed, edited or repaired. Automated previous-release upgrade testing is BLOCKED until the history mapping is explicitly approved.

## Dependency audit
`browserslist` and `baseline-browser-mapping` are transitive build/tooling dependencies reached through Autoprefixer/Babel/Vite. The reported issues require repeated/untrusted Browserslist queries or invalid mapping input; DentFlow does not execute them in the browser runtime. Fixes exist, but updating the toolchain is separated from this feature to avoid an unrelated lockfile change.

## Staging evidence
Authenticated owner Team query: 26 returned rows including sentinel, 21,024 JSON bytes, 208.30 ms client-observed. Reception Team blocked; foreign clinic, assignee, cursor, limit and invalid view rejected; cross-tenant leaks 0. PostgREST EXPLAIN media type is disabled, so plan-level EXPLAIN is NOT RUN.
