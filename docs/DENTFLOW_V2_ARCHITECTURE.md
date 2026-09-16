# DentFlow V2 — contact data slice
## Decisions
Keep React/Vite/Tailwind, Supabase and Contact 1:N Opportunity. No clinical record, horizontal metadata engine or new runtime dependency.

### Queries
contactQueries.js accepts an authenticated client and authorized clinic ID. Every read includes clinic scope; RLS remains authoritative even when a caller supplies another clinic. Input allowlists reject arbitrary filters, malformed UUIDs/cursors and page sizes outside 1–100. Default page size is 25.

listContacts uses list_contacts_page (SECURITY INVOKER, fixed search_path, authenticated-only grant). Keyset order: created_at DESC, id DESC; one sentinel row indicates the next page. Search is literal name/phone substring in Postgres. Filters: all, active, unassigned. A materialized page bounds lateral opportunity summaries. Reuse leads_clinic_contact_created_idx; add contacts_clinic_created_id_idx only.

The existing open-opportunity expression index calls app_private.normalize_domain_text. Authenticated same-clinic edits already pass a guarded RLS policy, but Postgres must evaluate that index as the caller. The helper is immutable, reads no tables and receives only supplied text, so authenticated gets EXECUTE on that one helper. No broader app_private or table privilege is added.

getContact360 loads one contact and the first bounded opportunity page. Citas/Trabajo/Presupuestos/Notas/Timeline load only when opened, independently paginated. Explicit fields, mandatory contact and tenant filters; quotes names its composite clinic/lead foreign key to avoid ambiguous PostgREST embedding.

Timeline projects existing lead_events across the contact's opportunities. Existing workflows already emit appointment/quote/interactions there. Do not duplicate events or infer a clinical timeline. Legacy rows without events are available in their source tabs; a future unified projection needs stable source identity and deduplication.

### Contact operating record
`get_contact_operating_summary_v1` returns one tenant-scoped operating summary: responsible person, last interaction, next action, active opportunities and next appointment. `list_contact_timeline_v1` projects the immutable `lead_events` stream across every authorized opportunity for the Contact. It uses `(created_at, id)` keyset pagination, a default limit of 25 and explicit output fields. Related tabs remain lazy and bounded.

`register_contact_interaction_v1` is a SECURITY INVOKER command. It validates channel/outcome combinations and contact/opportunity/assignee ownership, then delegates contact, outcome, follow-up and assignment changes to the existing transactional workflow RPCs. Administrative notes add only an immutable `administrative_note` event. The command accepts no clinical fields. Row locking in the delegated workflows and recent-event checks make immediate retries semantically idempotent.

### Commands
Existing workflow RPCs remain the write boundary. DF-009 changes only repeated Contactado assignment to avoid incrementing contact_attempts twice. Row locking serializes updates. Direct explicit contact attempts retain their existing semantics.
Future extraction candidates are opportunity/appointment/task/quote commands, only when it reduces coupling/test difficulty. The large controller is acknowledged, not disguised as completed architecture work.

### Realtime
useContactResource owns the current query key. Contacts/leads events invalidate the active page/contact; it re-reads authoritative rows rather than merging unordered payloads. Generation numbers and AbortController reject older responses. Duplicate events debounce 150 ms.
A contact page ignores other contacts when payload identity is available. Related tabs listen to their source table while open. A new/reconnected subscription invalidates; focus/online/visible also reconcile; unhealthy subscriptions poll every 25s.
`lead_events` is not in the current publication: timeline changes caused by lead workflows refresh through `leads`; successful interaction commands invalidate the Contact resource directly; focus/reconnect reloads standalone historical changes. There is no claim of instant delivery for an event inserted by another client without a corresponding published source-row change.
No generic cache engine. No new Redis/queues. No global refresh on contact slice events.

### Legacy coexistence
useClinicWorkspace always loads identity + clinic; full workspace and its Realtime channel are enabled only outside /pacientes and /pacientes/:contactId.
Legacy agenda, pending, analytics and opportunity details continue unchanged in data ownership. Re-entering a legacy view loads current data. Session-generation checks prevent old-tenant responses from applying. Badges based on legacy arrays are suppressed on migrated routes.
Nueva consulta navigates to the existing opportunity creation workflow so profile/settings options are available before its modal opens. It intentionally leaves the migrated path.

### Routing and UX
Existing nested opportunity URLs remain canonical for the legacy detail. /oportunidades is the legacy management view; /oportunidades/:id resolves an authorized row and redirects to that detail. /trabajo aliases /pendientes until Work Center exists; /analitica aliases /analisis. / remains compatible with /resumen. Agenda date persists in search parameters.
Reception navigation: Inicio, Pacientes, Trabajo, Agenda. Owner additionally sees Oportunidades and Analítica. Configuration moves to gear links. New patient interfaces use semantic headings, labels, buttons, visible focus, minimum 44px controls and responsive structured rows.
No global search engine added; patient search is scoped and URL-driven.

### Incremental types
No app-wide TypeScript migration. Query parameter validation and executable contracts are introduced now. Next type boundary: query result/parameter declarations and critical command/RPC responses. Keep JS consumers compatible.

## Read-only reference evidence
Inspected actual source, no copied implementation:
- Frappe CRM at 9bb05b2def1e866ef1fe768611f58a37a045ddca: crm/api/doc.py server pagination/filter/order, frontend/src/pages/Contacts.vue list ergonomics, .github/workflows/migration-test.yml base-release upgrade.
- Twenty at 3033965952bc2e8ff88e79a82d3c173bd8833bab: view.entity.ts, workflow-run.workspace-entity.ts, RecordShowResourceLoader.tsx. Adopt scoped record loading and future observable run states; defer rich View metadata/workflow canvas.
Sources: https://github.com/frappe/crm and https://github.com/twentyhq/twenty.

## Deferred contracts
WorkItem will be a projection of existing nextActions/tasks/appointments/quotes, with contact/opportunity/source identity, reason, due, priority, owner and allowed actions. Build system views before saved views.
Analytics queries will return value, definition and drilldown filter, aggregated server-side.
Agenda schema proposal: clinic_locations, professionals, professional_locations, availability_rules, availability_exceptions. CRM user is not a professional. No migration in this slice.
Automations/Ops remain future design; no implementation or backdoor.
