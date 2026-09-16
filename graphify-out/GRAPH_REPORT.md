# Graph Report - dental-crm  (2026-09-16)

## Corpus Check
- 238 files · ~126,729 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 8 file(s) not represented in the graph (top: (none) 5, .example 1, .css 1)

## Summary
- 1642 nodes · 2790 edges · 184 communities (91 shown, 64 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 40 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `66945d6a`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- analytics.js
- react
- messages.js
- 20260515021456_create_dental_crm_schema.sql
- staging-qa-setup.mjs
- 20260821180858_rebuild_new_supabase_production_schema.sql
- useCrmController
- AgendaPage.jsx
- 20260824162341_enforce_operational_integrity_and_quotes.sql
- realtime-capacity.mjs
- staging-workflow.mjs
- formatters.js
- 20260612142000_edge_function_support_indexes.sql
- visual-harness/main.jsx
- scripts
- LeadsPage.jsx
- intake-abuse-load.mjs
- fixtures.js
- multitenant-load.mjs
- MetricsPage.jsx
- constants.js
- 20260612140000_production_schema_hardening.sql
- contactQueries.js
- humanizeCrmError
- index.ts
- 20260612141000_rls_professional_policies.sql
- data-volume-benchmark.sql
- 20260904201956_contact_opportunity_model.sql
- SettingsPage.jsx
- crmDomain.js
- 20260827162541_clarity_priority_upgrade.sql
- 20260822213000_link_contact_tasks_and_whatsapp_templates.sql
- PublicFormSettings
- Dental CRM
- lead-intake-test.ps1
- package.json
- staging-http-linked-smoke.mjs
- dependencies
- 20260822230000_add_retention_insights.sql
- vercel.json
- appointment-modal-flow-test.mjs
- WorkPage.jsx
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
- Supabase
- staging-smoke.mjs
- Changelog
- useClinicWorkspace.js
- Changelog
- Writing Guidelines for Postgres References
- contact-browser-staging.mjs
- FIRST CLINIC PRODUCTION READINESS
- taskConfigForLeadStatus
- @supabase/supabase-js
- Decisions
- Section Definitions
- contact-interaction-staging.mjs
- App.jsx
- Arquitectura y seguridad auditadas
- Despliegue seguro a staging
- Capacidad y escalamiento
- Manual Acceptance Test — CRM Dental
- Rollback Plan
- dedupe-fix-smoke.mjs
- DentFlow V2 — foundation audit
- DentFlow V2 — rollout and validation
- Integración de landings con `lead-intake`
- Pruebas no productivas de carga y seguridad
- Reglas de desarrollo del proyecto
- Supabase Postgres Best Practices
- CRM React/Vite
- Auditoría de recuperación de capacidades
- Production Release Checklist
- Supabase backend
- Backup y recuperación
- n8n Asincronico
- DentFlow V2 — Work Center
- public.get_contact_operating_summary_v1
- public.save_lead_followup
- lead-intake
- advanced-full-text-search.md
- advanced-jsonb-indexing.md
- conn-idle-timeout.md
- conn-limits.md
- conn-pooling.md
- conn-prepared-statements.md
- data-batch-inserts.md
- data-n-plus-one.md
- data-pagination.md
- data-upsert.md
- lock-advisory.md
- lock-deadlock-prevention.md
- lock-short-transactions.md
- lock-skip-locked.md
- monitor-explain-analyze.md
- monitor-pg-stat-statements.md
- monitor-vacuum-analyze.md
- query-composite-indexes.md
- query-covering-indexes.md
- query-index-types.md
- query-missing-indexes.md
- query-partial-indexes.md
- schema-constraints.md
- schema-data-types.md
- schema-foreign-key-indexes.md
- schema-lowercase-identifiers.md
- schema-partitioning.md
- schema-primary-keys.md
- security-privileges.md
- security-rls-basics.md
- security-rls-performance.md
- _template.md
- FIRST_CLIENT_MONITORING.md
- public.list_work_items_v1
- work-staging-test.mjs
- TreatmentPricesSettings
- PatientPage.jsx
- owner-metrics-test.mjs
- work-browser-staging.mjs
- work-workflow-staging.mjs
- public.update_appointment_outcome

## God Nodes (most connected - your core abstractions)
1. `humanizeCrmError()` - 47 edges
2. `useCrmController()` - 44 edges
3. `react` - 38 edges
4. `lucide-react` - 29 edges
5. `fromDatetimeLocalAsuncion()` - 25 edges
6. `scripts` - 24 edges
7. `formatDateTime` - 22 edges
8. `todayIsoDate()` - 20 edges
9. `getEffectiveNextAction()` - 19 edges
10. `Button()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `snapshot()` --calls--> `buildNextActionQueue()`  [EXTRACTED]
  tests/staging-workflow.mjs → crm-app/src/lib/nextActions.js
- `ClinicWorkspace()` --calls--> `useCrmController()`  [EXTRACTED]
  crm-app/src/App.jsx → crm-app/src/hooks/useCrmController.js
- `handleSubmit()` --calls--> `humanizeCrmError()`  [EXTRACTED]
  crm-app/src/components/modals/AppointmentModal.jsx → crm-app/src/lib/errors.js
- `handleSave()` --calls--> `humanizeCrmError()`  [EXTRACTED]
  crm-app/src/pages/SettingsPage.jsx → crm-app/src/lib/errors.js
- `handleSave()` --calls--> `humanizeCrmError()`  [EXTRACTED]
  crm-app/src/pages/SettingsPage.jsx → crm-app/src/lib/errors.js

## Import Cycles
- None detected.

## Communities (184 total, 64 thin omitted)

### Community 0 - "analytics.js"
Cohesion: 0.05
Nodes (78): appointmentMoment(), ATTENDED_EVENTS, beforeEnd(), BOOKING_EVENTS, buildAnalytics(), buildBottleneck(), buildCohortStages(), buildFunnel() (+70 more)

### Community 1 - "react"
Cohesion: 0.19
Nodes (18): Field(), Select(), TextArea(), ModalActions(), ModalHeader(), ModalShell(), AppointmentModal, ArchiveLeadModal (+10 more)

### Community 2 - "messages.js"
Cohesion: 0.17
Nodes (19): WhatsAppButton(), buildLeadMessage(), buildMessageFromTemplate(), buildWhatsAppMessage(), buildWhatsappUrl(), getWhatsAppTemplate(), normalizeWhatsAppPhone(), selectWhatsAppTemplateKey() (+11 more)

### Community 3 - "20260515021456_create_dental_crm_schema.sql"
Cohesion: 0.08
Nodes (45): app_private.current_user_clinic_id(), app_private.is_clinic_admin(), app_private.is_clinic_member(), appointments_clinic_date_time_idx, appointments_clinic_status_idx, appointments_lead_id_idx, daily_reports_clinic_date_idx, lead_events_clinic_lead_created_idx (+37 more)

### Community 4 - "staging-qa-setup.mjs"
Cohesion: 0.12
Nodes (17): admin, byKey, clinics, commercialTemplates, { createClient }, env, formConfig, forms (+9 more)

### Community 5 - "20260821180858_rebuild_new_supabase_production_schema.sql"
Cohesion: 0.06
Nodes (35): app_private.current_clinic_id(), app_private.current_profile(), app_private.has_role(), app_private.is_clinic_member(), appointments_active_slot_unique_idx, appointments_lead_id_prod_idx, audit_logs_actor_id_idx, automation_jobs_lead_id_idx (+27 more)

### Community 6 - "useCrmController"
Cohesion: 0.13
Nodes (16): useCrmController(), confirmAppointmentById(), createLeadEvent(), createManualLead(), openAppointmentModal(), openLostLeadModal(), openQuoteModal(), openRescheduleModal() (+8 more)

### Community 7 - "AgendaPage.jsx"
Cohesion: 0.10
Nodes (29): formatActionMoment(), PendingActionCard(), Button(), variants, Card(), EmptyState(), FilterPanel(), ActiveFilterChips() (+21 more)

### Community 8 - "20260824162341_enforce_operational_integrity_and_quotes.sql"
Cohesion: 0.10
Nodes (32): public.update_updated_at_column, app_private.default_clinic_assignee(), app_private.resolve_clinic_assignee(), appointments_clinic_lead_id_unique_idx, leads_clinic_assigned_open_idx, leads_clinic_id_id_unique_idx, leads_clinic_open_phone_plus_unique_idx, public.complete_task() (+24 more)

### Community 9 - "realtime-capacity.mjs"
Cohesion: 0.06
Nodes (30): allowedHost, anonKey, apiUrl, authClient, authMode, clinicSlug, confirmation, { createClient } (+22 more)

### Community 10 - "staging-workflow.mjs"
Cohesion: 0.07
Nodes (36): QuoteModal(), submit(), updateTreatment(), findTreatmentPrice(), normalizeTreatmentKey(), quoteTreatmentOptions(), options, prices (+28 more)

### Community 11 - "formatters.js"
Cohesion: 0.17
Nodes (16): ContactOutcomeModal(), selectedFollowupAt(), submit(), followupPresetValue(), getLeadFormDefaults(), LeadFormModal(), defaults(), getTaskFormDefaults() (+8 more)

### Community 12 - "20260612142000_edge_function_support_indexes.sql"
Cohesion: 0.09
Nodes (27): appointments_clinic_date_time_prod_idx, audit_logs_clinic_created_desc_idx, automation_jobs_clinic_status_idx, automation_jobs_status_retry_idx, campaigns_clinic_active_idx, clinic_public_forms_slug_token_active_idx, form_submission_logs_form_ip_created_desc_idx, form_submission_logs_form_phone_created_desc_idx (+19 more)

### Community 13 - "visual-harness/main.jsx"
Cohesion: 0.11
Nodes (26): AppointmentModal(), handleSubmit(), buildTimeSlots(), getAppointmentFormDefaults(), isToday(), daysBetween(), startOfAsuncionDate(), uniqueStrings() (+18 more)

### Community 14 - "scripts"
Cohesion: 0.08
Nodes (24): scripts, build, build:production, build:staging, dev, preview, test, test:appointment (+16 more)

### Community 15 - "LeadsPage.jsx"
Cohesion: 0.09
Nodes (25): opportunityActionLabel(), opportunityPriorityLabel(), buildCommercialTimeline(), buildWeeklyReportText(), EVENT_COPY, getRiskAlerts(), LOST_REASONS, PRIORITY_FILTERS (+17 more)

### Community 16 - "intake-abuse-load.mjs"
Cohesion: 0.09
Nodes (23): allowedHost, baseBody(), burstRows, burstSizes, burstText, confirmation, defaultBurstForms, endpoint (+15 more)

### Community 17 - "fixtures.js"
Cohesion: 0.18
Nodes (17): accessToken, baseLead, contactA, contactB, expectWorkspace(), leadA, leadA2, leadB (+9 more)

### Community 18 - "multitenant-load.mjs"
Cohesion: 0.10
Nodes (18): allowedHost, apiUrl, endpoint, endpointUrl, fixture(), isLocalHost, origin, perClinic (+10 more)

### Community 19 - "MetricsPage.jsx"
Cohesion: 0.14
Nodes (10): formatDurationMinutes(), formatMoney(), greeting(), ReceptionHome(), AnalysisCards(), FunnelAnalysis(), MoneyMetric(), TABS (+2 more)

### Community 20 - "constants.js"
Cohesion: 0.18
Nodes (10): CLASSIFICATIONS, CONTACT_ATTEMPT_STATUSES, CONTACTED_STATUSES, EVALUATION_OPTIONS, LEAD_SOURCE_OPTIONS, LEAD_STATUSES, NEXT_ACTION_OPTIONS, SCHEDULED_STATUSES (+2 more)

### Community 21 - "20260612140000_production_schema_hardening.sql"
Cohesion: 0.25
Nodes (17): clinic_public_forms_clinic_slug_unique_idx, clinic_public_forms_public_token_unique_idx, clinics_slug_unique_idx, public.appointments, public.audit_logs, public.automation_jobs, public.campaigns, public.clinic_public_forms (+9 more)

### Community 22 - "contactQueries.js"
Cohesion: 0.11
Nodes (33): checked(), CONTACT_FILTERS, CONTACT_PAGE_SIZE, createContactQueries(), getContact360(), listAssignees(), listContacts(), listOpportunities() (+25 more)

### Community 23 - "humanizeCrmError"
Cohesion: 0.14
Nodes (17): Login(), handleSubmit(), ArchiveLeadModal(), handleSubmit(), handleSubmit(), TaskFormModal(), handleSubmit(), completeTask() (+9 more)

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

### Community 28 - "SettingsPage.jsx"
Cohesion: 0.11
Nodes (12): Info(), roleLabel(), TeamSettings(), AgendaView, Dashboard, FollowupsView, LeadDetail, LeadsView (+4 more)

### Community 29 - "crmDomain.js"
Cohesion: 0.16
Nodes (22): handleWhatsAppOpened(), APPOINTMENT_OUTCOME_LEAD_STATUSES, APPOINTMENT_STATUS, ARCHIVED_STATUS, buildLeadFormPatch(), isContactTask(), isOpenTask(), LEAD_ADMIN_EDIT_FIELDS (+14 more)

### Community 30 - "20260827162541_clarity_priority_upgrade.sql"
Cohesion: 0.14
Nodes (9): app_private.derive_lead_score_and_source, app_private.lead_score_config(), public.create_manual_lead_v2(), public.create_public_lead_intake_v2(), public.clinic_public_forms, public.clinic_settings, public.profiles, public.treatment_prices (+1 more)

### Community 31 - "20260822213000_link_contact_tasks_and_whatsapp_templates.sql"
Cohesion: 0.22
Nodes (10): completed, message_templates_clinic_key_unique_idx, public.complete_task(), public.mark_lead_contacted(), public.record_contact_attempt(), public.record_whatsapp_opened(), public.save_lead_followup(), public.leads (+2 more)

### Community 32 - "PublicFormSettings"
Cohesion: 0.28
Nodes (7): formatAllowedOrigins(), generatePublicToken(), publicFormFetchSnippet(), publicFormPayloadExample(), getPublicFormDefaults(), PublicFormSettings(), handleSave()

### Community 33 - "Dental CRM"
Cohesion: 0.09
Nodes (21): Alta de la primera clínica, Checklist de datos y configuración, Copy, Datos, Flujo de alta, Fotos, Headers de la landing, Landing template recomendado (+13 more)

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

### Community 41 - "WorkPage.jsx"
Cohesion: 0.25
Nodes (12): useWorkResource(), relativeTime(), TYPE_LABEL, WorkPage(), decodeWorkCursor(), encodeWorkCursor(), listWorkItems(), normalizeWorkView() (+4 more)

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

### Community 91 - "Supabase"
Cohesion: 0.11
Nodes (15): Fix suggestion, Source, What happened, Skill Feedback, Steps, Core Principles, Debugging, Making and Committing Schema Changes (+7 more)

### Community 92 - "staging-smoke.mjs"
Cohesion: 0.13
Nodes (15): assertCrossTenantWritesBlocked(), authenticatedClient(), client(), config, { createClient }, edgeUrl, firstId(), missing (+7 more)

### Community 104 - "Changelog"
Cohesion: 0.12
Nodes (16): [1.2.0](https://github.com/supabase/agent-skills/compare/v1.1.1...v1.2.0) (2026-06-02), [1.3.0](https://github.com/supabase/agent-skills/compare/v1.2.0...v1.3.0) (2026-06-05), [1.4.0](https://github.com/supabase/agent-skills/compare/v1.3.0...v1.4.0) (2026-07-10), [1.5.0](https://github.com/supabase/agent-skills/compare/supabase-postgres-best-practices-v1.4.0...supabase-postgres-best-practices-v1.5.0) (2026-07-30), [1.6.0](https://github.com/supabase/agent-skills/compare/supabase-postgres-best-practices-v1.5.0...supabase-postgres-best-practices-v1.6.0) (2026-07-30), Bug Fixes, Bug Fixes, Bug Fixes (+8 more)

### Community 105 - "useClinicWorkspace.js"
Cohesion: 0.45
Nodes (9): useClinicWorkspace(), bootstrapUser(), loadPublicFormConfig(), normalizeRole(), getClinic(), getClinicWorkspace(), getLeadEvents(), getPublicFormConfig() (+1 more)

### Community 106 - "Changelog"
Cohesion: 0.12
Nodes (15): [0.1.3](https://github.com/supabase/agent-skills/compare/v0.1.2...v0.1.3) (2026-06-02), [0.1.4](https://github.com/supabase/agent-skills/compare/v0.1.3...v0.1.4) (2026-06-05), [0.1.5](https://github.com/supabase/agent-skills/compare/v0.1.4...v0.1.5) (2026-07-10), [0.1.6](https://github.com/supabase/agent-skills/compare/v0.1.5...supabase-v0.1.6) (2026-07-30), [0.1.7](https://github.com/supabase/agent-skills/compare/v0.1.6...supabase-v0.1.7) (2026-08-12), Bug Fixes, Bug Fixes, Bug Fixes (+7 more)

### Community 107 - "Writing Guidelines for Postgres References"
Cohesion: 0.12
Nodes (15): 1. Concrete Transformation Patterns, 2. Error-First Structure, 3. Quantified Impact, 4. Self-Contained Examples, 5. Semantic Naming, Code Example Standards, Comments, Impact Level Guidelines (+7 more)

### Community 108 - "contact-browser-staging.mjs"
Cohesion: 0.22
Nodes (8): artifacts, bypass, {chromium,expect}, client, {createClient}, report, require, writer

### Community 109 - "FIRST CLINIC PRODUCTION READINESS"
Cohesion: 0.13
Nodes (14): Arquitectura, Capacity, Decisión, Estado, First clinic, FIRST CLINIC PRODUCTION READINESS, Landing onboarding, Load (+6 more)

### Community 110 - "taskConfigForLeadStatus"
Cohesion: 0.29
Nodes (8): updateLead(), addDaysIso(), addHoursIso(), appointmentDueIso(), nowIso(), priorityForClassification(), taskConfigForLeadStatus(), tomorrowFollowupAsuncion()

### Community 111 - "@supabase/supabase-js"
Cohesion: 0.22
Nodes (7): @supabase/supabase-js, client, {createClient}, require, client, {createClient}, require

### Community 112 - "Decisions"
Cohesion: 0.15
Nodes (12): Commands, Contact operating record, Decisions, Deferred contracts, DentFlow V2 — contact data slice, Incremental types, Legacy coexistence, Opportunity operating record (+4 more)

### Community 113 - "Section Definitions"
Cohesion: 0.20
Nodes (9): 1. Query Performance (query), 2. Connection Management (conn), 3. Security & RLS (security), 4. Schema Design (schema), 5. Concurrency & Locking (lock), 6. Data Access Patterns (data), 7. Monitoring & Diagnostics (monitor), 8. Advanced Features (advanced) (+1 more)

### Community 114 - "contact-interaction-staging.mjs"
Cohesion: 0.32
Nodes (7): { createClient }, login(), make(), require, rpc(), stamp, tomorrow

### Community 115 - "App.jsx"
Cohesion: 0.07
Nodes (24): App(), AppBoundary(), AuthBoundary(), ClinicWorkspace(), PublicEmbedLeadForm, Banner(), FullScreenLoader(), PageSkeleton() (+16 more)

### Community 116 - "Arquitectura y seguridad auditadas"
Cohesion: 0.20
Nodes (9): Archivos de verificación, Arquitectura y seguridad auditadas, CORS, abuso y contenido hostil, CRM, queries y RLS, Evidencia estática, Flujo real, Landing pública, Realtime y polling (+1 more)

### Community 117 - "Despliegue seguro a staging"
Cohesion: 0.22
Nodes (8): 1. Preparar y vincular staging, 2. Aplicar solamente las migraciones pendientes, 3. Verificar PostgreSQL, RPC, RLS y presupuestos, 4. Desplegar `lead-intake`, 5. Prueba de captación en staging, 6. Desplegar el frontend al final, Criterio de detención, Despliegue seguro a staging

### Community 119 - "Capacidad y escalamiento"
Cohesion: 0.25
Nodes (7): Capacidad y escalamiento, Cuotas de referencia actuales, Cómo medir, Dónde mirar, Estimación de almacenamiento, Modelo de carga actual, Umbrales operativos

### Community 120 - "Manual Acceptance Test — CRM Dental"
Cohesion: 0.25
Nodes (7): Dueño, Manual Acceptance Test — CRM Dental, Métricas de usabilidad, No-show, Prueba especial de usabilidad, Recepción, Resultado

### Community 121 - "Rollback Plan"
Cohesion: 0.25
Nodes (7): Criterio de escalación, Objetos que agrega o cambia la migración RC, Orden de respuesta, Preservación de datos, Principio, Qué no borrar, Rollback Plan

### Community 122 - "dedupe-fix-smoke.mjs"
Cohesion: 0.29
Nodes (4): anon, { createClient }, needed, require

### Community 123 - "DentFlow V2 — foundation audit"
Cohesion: 0.29
Nodes (6): DentFlow V2 — foundation audit, Executed evidence, Findings, Performance, Reconciliation, Residual risks

### Community 124 - "DentFlow V2 — rollout and validation"
Cohesion: 0.29
Nodes (6): DentFlow V2 — rollout and validation, Expand → migrate → switch → retire, Migration CI next step, Release evidence, Reproduce, Rollback

### Community 125 - "Integración de landings con `lead-intake`"
Cohesion: 0.29
Nodes (6): Checklist antes de publicar, Configuración pública de cada landing, Contrato HTTP, Datos que nunca recibe la landing, Ejemplo de configuración por repositorio externo, Integración de landings con `lead-intake`

### Community 126 - "Pruebas no productivas de carga y seguridad"
Cohesion: 0.29
Nodes (6): Abuso 10/50/100/500 y replay, Fixtures 100 clínicas, Intake multi-tenant 10/20/50/100, Pruebas no productivas de carga y seguridad, Realtime 10/25/50/100, Volumen 10k/50k/100k

### Community 127 - "Reglas de desarrollo del proyecto"
Cohesion: 0.33
Nodes (5): Arquitectura, Backend y seguridad, graphify, Reglas de desarrollo del proyecto, UX y calidad

### Community 128 - "Supabase Postgres Best Practices"
Cohesion: 0.33
Nodes (5): How to Use, References, Rule Categories by Priority, Supabase Postgres Best Practices, When to Apply

### Community 129 - "CRM React/Vite"
Cohesion: 0.33
Nodes (5): CRM React/Vite, Desarrollo, Supabase, Vercel, Verificacion

### Community 130 - "Auditoría de recuperación de capacidades"
Cohesion: 0.33
Nodes (5): Auditoría de recuperación de capacidades, Fuente de verdad de precios, Historia revisada, Límites deliberados, Matriz de decisión

### Community 131 - "Production Release Checklist"
Cohesion: 0.33
Nodes (5): Antes, Deploy, Después, Gate obligatorio, Production Release Checklist

### Community 132 - "Supabase backend"
Cohesion: 0.33
Nodes (5): Edge Function, Formularios multi-landing, Migraciones, Seguridad, Supabase backend

### Community 133 - "Backup y recuperación"
Cohesion: 0.40
Nodes (4): Antes del primer cliente, Backup y recuperación, Export de emergencia, Restauración

### Community 134 - "n8n Asincronico"
Cohesion: 0.40
Nodes (4): Errores Visibles, n8n Asincronico, Reglas, Tabla De Entrada

### Community 135 - "DentFlow V2 — Work Center"
Cohesion: 0.22
Nodes (8): Canonical model, DentFlow V2 — Work Center, Dependency audit, Guided actions and Realtime, Legacy parity, Release safety and migration history, Staging evidence, System views and permissions

### Community 136 - "public.get_contact_operating_summary_v1"
Cohesion: 0.23
Nodes (8): public.appointments, public.contacts, public.lead_events, public.leads, public.profiles, contacts_clinic_created_id_idx, public.get_contact_operating_summary_v1(), public.list_contact_timeline_v1()

### Community 137 - "public.save_lead_followup"
Cohesion: 0.50
Nodes (3): public.save_lead_followup(), public.leads, public.tasks

### Community 174 - "public.list_work_items_v1"
Cohesion: 0.27
Nodes (9): public.quotes, appointments_work_queue_idx, public.list_work_items_v1(), quotes_work_queue_idx, public.appointments, public.leads, public.profiles, public.tasks (+1 more)

### Community 175 - "work-staging-test.mjs"
Cohesion: 0.29
Nodes (7): args, {createClient}, login(), make(), payload, require, started

### Community 177 - "PatientPage.jsx"
Cohesion: 0.07
Nodes (36): AppLayout(), icons, NavButton(), PasswordInput(), LeadMiniCard(), PageControls(), QueryError(), useContactResource() (+28 more)

### Community 181 - "owner-metrics-test.mjs"
Cohesion: 0.29
Nodes (6): appointments, leads, now, quotes, summary, workspaceEvents

### Community 186 - "work-browser-staging.mjs"
Cohesion: 0.20
Nodes (6): @playwright/test, bypass, {chromium,expect}, {createClient}, report, require

### Community 187 - "work-workflow-staging.mjs"
Cohesion: 0.22
Nodes (9): c, call(), {createClient}, date, observedNoShow, require, stamp, tomorrow (+1 more)

## Knowledge Gaps
- **567 isolated node(s):** `Queries`, `Contact operating record`, `Commands`, `Opportunity operating record`, `Realtime` (+562 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 852 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **64 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@supabase/supabase-js` connect `@supabase/supabase-js` to `package.json`, `staging-qa-setup.mjs`, `work-browser-staging.mjs`, `staging-workflow.mjs`, `contact-browser-staging.mjs`, `work-staging-test.mjs`, `PatientPage.jsx`, `contact-interaction-staging.mjs`, `contactQueries.js`, `dedupe-fix-smoke.mjs`, `work-workflow-staging.mjs`, `staging-smoke.mjs`?**
  _High betweenness centrality (0.036) - this node is a cross-community bridge._
- **Why does `react` connect `react` to `package.json`, `AgendaPage.jsx`, `WorkPage.jsx`, `useClinicWorkspace.js`, `visual-harness/main.jsx`, `LeadsPage.jsx`, `PatientPage.jsx`, `App.jsx`, `MetricsPage.jsx`, `SettingsPage.jsx`, `crmDomain.js`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `lucide-react` connect `AgendaPage.jsx` to `react`, `messages.js`, `package.json`, `visual-harness/main.jsx`, `LeadsPage.jsx`, `PatientPage.jsx`, `App.jsx`, `MetricsPage.jsx`, `SettingsPage.jsx`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Are the 28 inferred relationships involving `useCrmController()` (e.g. with `completeTask()` and `confirmAppointmentById()`) actually correct?**
  _`useCrmController()` has 28 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Queries`, `Contact operating record`, `Commands` to the rest of the system?**
  _567 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `analytics.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05123456790123457 - nodes in this community are weakly interconnected._
- **Should `20260515021456_create_dental_crm_schema.sql` be split into smaller, more focused modules?**
  _Cohesion score 0.0841813135985199 - nodes in this community are weakly interconnected._