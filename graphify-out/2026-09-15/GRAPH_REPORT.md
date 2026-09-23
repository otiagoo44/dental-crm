# Graph Report - dental-crm  (2026-09-15)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 1149 nodes · 2251 edges · 104 communities (50 shown, 28 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 34 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e12d1103`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- analytics.js
- LeadFormModal.jsx
- SettingsPage.jsx
- 20260515021456_create_dental_crm_schema.sql
- staging-qa-setup.mjs
- 20260821180858_rebuild_new_supabase_production_schema.sql
- useCrmController
- App.jsx
- 20260824162341_enforce_operational_integrity_and_quotes.sql
- realtime-capacity.mjs
- staging-workflow.mjs
- AgendaPage.jsx
- 20260612142000_edge_function_support_indexes.sql
- crmDomain.js
- scripts
- LeadsPage.jsx
- intake-abuse-load.mjs
- fixtures.js
- multitenant-load.mjs
- MetricsPage.jsx
- CrmRoutes.jsx
- 20260612140000_production_schema_hardening.sql
- Login.jsx
- formatters.js
- index.ts
- 20260612141000_rls_professional_policies.sql
- data-volume-benchmark.sql
- 20260904201956_contact_opportunity_model.sql
- FollowupsPage.jsx
- visual-harness/main.jsx
- 20260827162541_clarity_priority_upgrade.sql
- 20260822213000_link_contact_tasks_and_whatsapp_templates.sql
- useClinicWorkspace.js
- PendingPage.jsx
- lead-intake-test.ps1
- package.json
- staging-http-linked-smoke.mjs
- dependencies
- 20260822230000_add_retention_insights.sql
- vercel.json
- appointment-modal-flow-test.mjs
- fromDatetimeLocalAsuncion
- crm-app/vite.config.js
- 20260828120000_harden_public_intake_rate_limit.sql
- standalone-deployment-test.mjs
- status-change-regression-test.mjs
- devDependencies
- 20260831190000_split_open_opportunities_by_treatment.sql
- postgres-migration-smoke.mjs
- public.save_lead_followup
- stored-xss-contract-test.mjs
- public.create_manual_lead
- publicEnvironments.js
- edge-intake-contract-test.mjs
- production-public-smoke.mjs
- visual-responsive-smoke.mjs
- public.appointments
- public.audit_logs
- public.automation_jobs
- public.campaigns
- public.clinic_public_forms
- public.clinic_settings
- public.clinics
- public.daily_reports
- public.form_submission_logs
- public.lead_events
- public.leads
- public.message_templates
- public.messages
- public.tasks
- public.treatment_prices
- public.campaigns
- public.clinic_settings
- public.clinics
- public.daily_reports
- public.message_templates
- public.treatment_prices
- public.leads

## God Nodes (most connected - your core abstractions)
1. `useCrmController()` - 57 edges
2. `humanizeCrmError()` - 48 edges
3. `react` - 32 edges
4. `lucide-react` - 27 edges
5. `fromDatetimeLocalAsuncion()` - 24 edges
6. `scripts` - 24 edges
7. `getEffectiveNextAction()` - 21 edges
8. `todayIsoDate()` - 20 edges
9. `normalizeText()` - 17 edges
10. `cleanOptionalText()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `snapshot()` --calls--> `buildNextActionQueue()`  [EXTRACTED]
  tests/staging-workflow.mjs → crm-app/src/lib/nextActions.js
- `handleSubmit()` --calls--> `humanizeCrmError()`  [EXTRACTED]
  crm-app/src/components/modals/LeadFormModal.jsx → crm-app/src/lib/errors.js
- `handleSubmit()` --calls--> `humanizeCrmError()`  [EXTRACTED]
  crm-app/src/components/modals/TaskFormModal.jsx → crm-app/src/lib/errors.js
- `handleSave()` --calls--> `humanizeCrmError()`  [EXTRACTED]
  crm-app/src/pages/SettingsPage.jsx → crm-app/src/lib/errors.js
- `handleSave()` --calls--> `humanizeCrmError()`  [EXTRACTED]
  crm-app/src/pages/SettingsPage.jsx → crm-app/src/lib/errors.js

## Import Cycles
- None detected.

## Communities (104 total, 28 thin omitted)

### Community 0 - "analytics.js"
Cohesion: 0.05
Nodes (78): appointmentMoment(), ATTENDED_EVENTS, beforeEnd(), BOOKING_EVENTS, buildAnalytics(), buildBottleneck(), buildCohortStages(), buildFunnel() (+70 more)

### Community 1 - "LeadFormModal.jsx"
Cohesion: 0.05
Nodes (53): PublicEmbedLeadForm, Field(), TextArea(), followupPresetValue(), getLeadFormDefaults(), LeadFormModal(), handleSubmit(), ModalActions() (+45 more)

### Community 2 - "SettingsPage.jsx"
Cohesion: 0.06
Nodes (39): getRiskAlerts(), formatAllowedOrigins(), generatePublicToken(), publicFormFetchSnippet(), publicFormPayloadExample(), slugify(), buildLeadMessage(), buildMessageFromTemplate() (+31 more)

### Community 3 - "20260515021456_create_dental_crm_schema.sql"
Cohesion: 0.08
Nodes (45): app_private.current_user_clinic_id(), app_private.is_clinic_admin(), app_private.is_clinic_member(), appointments_clinic_date_time_idx, appointments_clinic_status_idx, appointments_lead_id_idx, daily_reports_clinic_date_idx, lead_events_clinic_lead_created_idx (+37 more)

### Community 4 - "staging-qa-setup.mjs"
Cohesion: 0.05
Nodes (37): @supabase/supabase-js, anon, { createClient }, needed, require, admin, byKey, clinics (+29 more)

### Community 5 - "20260821180858_rebuild_new_supabase_production_schema.sql"
Cohesion: 0.06
Nodes (35): app_private.current_clinic_id(), app_private.current_profile(), app_private.has_role(), app_private.is_clinic_member(), appointments_active_slot_unique_idx, appointments_lead_id_prod_idx, audit_logs_actor_id_idx, automation_jobs_lead_id_idx (+27 more)

### Community 6 - "useCrmController"
Cohesion: 0.11
Nodes (31): handleSubmit(), ArchiveLeadModal(), handleSubmit(), useCrmController(), confirmAppointmentById(), createLeadEvent(), createManualLead(), handleLeadSelect() (+23 more)

### Community 7 - "App.jsx"
Cohesion: 0.08
Nodes (22): App(), AppBoundary(), AuthBoundary(), ClinicWorkspace(), AppLayout(), icons, NavButton(), Banner() (+14 more)

### Community 8 - "20260824162341_enforce_operational_integrity_and_quotes.sql"
Cohesion: 0.10
Nodes (32): public.update_updated_at_column, app_private.default_clinic_assignee(), app_private.resolve_clinic_assignee(), appointments_clinic_lead_id_unique_idx, leads_clinic_assigned_open_idx, leads_clinic_id_id_unique_idx, leads_clinic_open_phone_plus_unique_idx, public.complete_task() (+24 more)

### Community 9 - "realtime-capacity.mjs"
Cohesion: 0.06
Nodes (30): allowedHost, anonKey, apiUrl, authClient, authMode, clinicSlug, confirmation, { createClient } (+22 more)

### Community 10 - "staging-workflow.mjs"
Cohesion: 0.08
Nodes (28): admin, appointmentDate, client(), { createClient }, createPriorityLead(), env, futureQueue, hot (+20 more)

### Community 11 - "AgendaPage.jsx"
Cohesion: 0.21
Nodes (13): formatActionMoment(), PendingActionCard(), WhatsAppButton(), Button(), variants, Card(), EmptyState(), PageHeader() (+5 more)

### Community 12 - "20260612142000_edge_function_support_indexes.sql"
Cohesion: 0.09
Nodes (27): appointments_clinic_date_time_prod_idx, audit_logs_clinic_created_desc_idx, automation_jobs_clinic_status_idx, automation_jobs_status_retry_idx, campaigns_clinic_active_idx, clinic_public_forms_slug_token_active_idx, form_submission_logs_form_ip_created_desc_idx, form_submission_logs_form_phone_created_desc_idx (+19 more)

### Community 13 - "crmDomain.js"
Cohesion: 0.13
Nodes (25): completeTask(), handleWhatsAppOpened(), CONTACT_ATTEMPT_STATUSES, addDaysIso(), APPOINTMENT_OUTCOME_LEAD_STATUSES, APPOINTMENT_STATUS, appointmentDueIso(), ARCHIVED_STATUS (+17 more)

### Community 14 - "scripts"
Cohesion: 0.08
Nodes (24): scripts, build, build:production, build:staging, dev, preview, test, test:appointment (+16 more)

### Community 15 - "LeadsPage.jsx"
Cohesion: 0.14
Nodes (17): temperature, TemperatureBadge(), buildCommercialTimeline(), EVENT_COPY, getLeadPriority(), PRIORITY_FILTERS, displayConsultationReason(), isArchivedLead() (+9 more)

### Community 16 - "intake-abuse-load.mjs"
Cohesion: 0.09
Nodes (23): allowedHost, baseBody(), burstRows, burstSizes, burstText, confirmation, defaultBurstForms, endpoint (+15 more)

### Community 17 - "fixtures.js"
Cohesion: 0.15
Nodes (18): accessToken, baseLead, contactA, contactB, expectWorkspace(), leadA, leadA2, leadB (+10 more)

### Community 18 - "multitenant-load.mjs"
Cohesion: 0.10
Nodes (18): allowedHost, apiUrl, endpoint, endpointUrl, fixture(), isLocalHost, origin, perClinic (+10 more)

### Community 19 - "MetricsPage.jsx"
Cohesion: 0.12
Nodes (12): formatDurationMinutes(), buildWeeklyReportText(), formatMoney(), greeting(), ReceptionHome(), AnalysisCards(), FunnelAnalysis(), MetricsView() (+4 more)

### Community 20 - "CrmRoutes.jsx"
Cohesion: 0.16
Nodes (13): NotFoundPage(), PatientPage(), AgendaView, Dashboard, FollowupsView, LeadDetail, LeadsView, MetricsView (+5 more)

### Community 21 - "20260612140000_production_schema_hardening.sql"
Cohesion: 0.25
Nodes (17): clinic_public_forms_clinic_slug_unique_idx, clinic_public_forms_public_token_unique_idx, clinics_slug_unique_idx, public.appointments, public.audit_logs, public.automation_jobs, public.campaigns, public.clinic_public_forms (+9 more)

### Community 22 - "Login.jsx"
Cohesion: 0.16
Nodes (10): PasswordInput(), Login(), handleSubmit(), hasPublicConfig, publicConfig, publicConfigError, publicLeadWebhookUrl, supabaseAnonKey (+2 more)

### Community 23 - "formatters.js"
Cohesion: 0.27
Nodes (14): AppointmentModal(), buildTimeSlots(), getAppointmentFormDefaults(), isToday(), startOfAsuncionDate(), uniqueStrings(), dateTimeParts(), normalizeText() (+6 more)

### Community 24 - "index.ts"
Cohesion: 0.15
Nodes (13): corsHeaders(), dbErrorCode(), FORBIDDEN_ROUTING_FIELDS, hashWithSalt(), IntakeBody, isHoneypotFilled(), jsonResponse(), normalizeClinicSlug() (+5 more)

### Community 25 - "20260612141000_rls_professional_policies.sql"
Cohesion: 0.13
Nodes (11): app_private.current_clinic_id(), app_private.current_profile(), app_private.has_role(), app_private.is_clinic_member(), enforce_leads_update_permissions, enforce_tasks_insert_permissions, enforce_tasks_update_permissions, app_private.enforce_leads_update_permissions (+3 more)

### Community 26 - "data-volume-benchmark.sql"
Cohesion: 0.18
Nodes (17): qa_appointments, qa_appointments_clinic_date_time_idx, qa_audit, qa_audit_clinic_created_idx, qa_events, qa_events_clinic_lead_created_idx, qa_leads, qa_leads_clinic_assigned_idx (+9 more)

### Community 27 - "20260904201956_contact_opportunity_model.sql"
Cohesion: 0.16
Nodes (15): app_private.sync_lead_contact, app_private.sync_lead_contact(), contacts_clinic_name_idx, leads_clinic_contact_created_idx, leads_clinic_open_contact_treatment_unique_idx, public.contacts, public.create_manual_lead(), public.create_public_lead_intake() (+7 more)

### Community 28 - "FollowupsPage.jsx"
Cohesion: 0.17
Nodes (11): Info(), LeadMiniCard(), Select(), FilterPanel(), PriorityBadge(), styles, StatusBadge(), statusStyles (+3 more)

### Community 29 - "visual-harness/main.jsx"
Cohesion: 0.12
Nodes (13): Dashboard(), appointments, common, hour, isOwner, leads, now, params (+5 more)

### Community 30 - "20260827162541_clarity_priority_upgrade.sql"
Cohesion: 0.14
Nodes (9): app_private.derive_lead_score_and_source, app_private.lead_score_config(), public.create_manual_lead_v2(), public.create_public_lead_intake_v2(), public.clinic_public_forms, public.clinic_settings, public.profiles, public.treatment_prices (+1 more)

### Community 31 - "20260822213000_link_contact_tasks_and_whatsapp_templates.sql"
Cohesion: 0.22
Nodes (10): completed, message_templates_clinic_key_unique_idx, public.complete_task(), public.mark_lead_contacted(), public.record_contact_attempt(), public.record_whatsapp_opened(), public.save_lead_followup(), public.leads (+2 more)

### Community 32 - "useClinicWorkspace.js"
Cohesion: 0.37
Nodes (11): useClinicWorkspace(), bootstrapUser(), loadPublicFormConfig(), normalizeRole(), ROLE, supabase, getClinic(), getClinicWorkspace() (+3 more)

### Community 33 - "PendingPage.jsx"
Cohesion: 0.21
Nodes (9): ActiveFilterChips(), FilterSheet(), PRIORITY_GROUP_LABEL, actionLabel(), actionTypeOptions(), EMPTY_FILTERS, GROUPS, PendingPage() (+1 more)

### Community 34 - "lead-intake-test.ps1"
Cohesion: 0.27
Nodes (7): Assert-CorsOrigin(), Assert-Status(), Assert-True(), Convert-HttpError(), Convert-HttpResult(), Invoke-EdgeRequest(), Invoke-LeadIntake()

### Community 35 - "package.json"
Cohesion: 0.20
Nodes (9): name, private, type, version, autoprefixer, motion, postcss, react-dom (+1 more)

### Community 36 - "staging-http-linked-smoke.mjs"
Cohesion: 0.22
Nodes (8): allowedOrigin, base, config, csvRow(), expectedRef, linkedRef, repoRoot, runSqlFile()

### Community 37 - "dependencies"
Cohesion: 0.22
Nodes (9): dependencies, lucide-react, motion, react, react-dom, react-router, @supabase/supabase-js, vite (+1 more)

### Community 38 - "20260822230000_add_retention_insights.sql"
Cohesion: 0.32
Nodes (6): app_private.enforce_lead_loss_reason, enforce_lead_loss_reason_before_write, leads_clinic_lost_reason_idx, public.mark_lead_lost(), public.record_message_copied(), public.leads

### Community 39 - "vercel.json"
Cohesion: 0.25
Nodes (7): buildCommand, framework, headers, installCommand, outputDirectory, rewrites, $schema

### Community 40 - "appointment-modal-flow-test.mjs"
Cohesion: 0.29
Nodes (6): abortSignalAt, appSource, clearTimeoutAt, closeModalAt, refreshAt, unlockModalAt

### Community 41 - "fromDatetimeLocalAsuncion"
Cohesion: 0.60
Nodes (6): ContactOutcomeModal(), selectedFollowupAt(), submit(), postponeLeadFollowup(), addDaysAsuncion(), fromDatetimeLocalAsuncion()

### Community 42 - "crm-app/vite.config.js"
Cohesion: 0.47
Nodes (4): configResolved(), validateBuildEnvironment(), vite, @vitejs/plugin-react

### Community 43 - "20260828120000_harden_public_intake_rate_limit.sql"
Cohesion: 0.47
Nodes (4): form_submission_logs_form_rate_created_idx, form_submission_logs_form_rate_ip_created_idx, form_submission_logs_form_rate_phone_created_idx, public.form_submission_logs

### Community 44 - "standalone-deployment-test.mjs"
Cohesion: 0.33
Nodes (5): crmRoot, envNames, packageJson, securityHeaders, vercelConfig

### Community 46 - "devDependencies"
Cohesion: 0.40
Nodes (5): devDependencies, autoprefixer, @playwright/test, postcss, tailwindcss

### Community 47 - "20260831190000_split_open_opportunities_by_treatment.sql"
Cohesion: 0.40
Nodes (4): leads_clinic_open_phone_treatment_unique_idx, public.create_public_lead_intake(), public.clinic_public_forms, public.leads

### Community 48 - "postgres-migration-smoke.mjs"
Cohesion: 0.40
Nodes (4): database, migrationNames, migrationsDir, projectRoot

### Community 49 - "public.save_lead_followup"
Cohesion: 0.50
Nodes (3): public.save_lead_followup(), public.leads, public.tasks

### Community 50 - "stored-xss-contract-test.mjs"
Cohesion: 0.67
Nodes (3): root, sourceFiles(), violations

## Knowledge Gaps
- **288 isolated node(s):** `IntakeBody`, `PhoneResult`, `ATTENDED_EVENTS`, `BOOKING_EVENTS`, `CONTACT_EVENTS` (+283 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 493 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **28 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `AgendaPage.jsx` to `useClinicWorkspace.js`, `LeadFormModal.jsx`, `PendingPage.jsx`, `package.json`, `SettingsPage.jsx`, `App.jsx`, `crmDomain.js`, `LeadsPage.jsx`, `MetricsPage.jsx`, `CrmRoutes.jsx`, `Login.jsx`, `formatters.js`, `FollowupsPage.jsx`, `visual-harness/main.jsx`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Why does `@supabase/supabase-js` connect `staging-qa-setup.mjs` to `staging-workflow.mjs`, `package.json`, `Login.jsx`?**
  _High betweenness centrality (0.029) - this node is a cross-community bridge._
- **Why does `useCrmController()` connect `useCrmController` to `useClinicWorkspace.js`, `analytics.js`, `SettingsPage.jsx`, `App.jsx`, `fromDatetimeLocalAsuncion`, `crmDomain.js`, `LeadsPage.jsx`, `CrmRoutes.jsx`, `formatters.js`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Are the 29 inferred relationships involving `useCrmController()` (e.g. with `completeTask()` and `confirmAppointmentById()`) actually correct?**
  _`useCrmController()` has 29 INFERRED edges - model-reasoned connections that need verification._
- **What connects `IntakeBody`, `PhoneResult`, `ATTENDED_EVENTS` to the rest of the system?**
  _288 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `analytics.js` be split into smaller, more focused modules?**
  _Cohesion score 0.050286058416139714 - nodes in this community are weakly interconnected._
- **Should `LeadFormModal.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.051929824561403506 - nodes in this community are weakly interconnected._