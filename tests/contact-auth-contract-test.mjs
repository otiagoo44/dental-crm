import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { groupPatientOpportunities } from '../crm-app/src/lib/patients.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => readFile(path.join(root, relativePath), 'utf8');

const [migration, login, passwordInput, app, sessionHook, leadsPage, pendingPage] = await Promise.all([
  read('supabase/migrations/20260904201956_contact_opportunity_model.sql'),
  read('crm-app/src/components/Login.jsx'),
  read('crm-app/src/components/auth/PasswordInput.jsx'),
  read('crm-app/src/App.jsx'),
  read('crm-app/src/hooks/useSupabaseSession.js'),
  read('crm-app/src/pages/LeadsPage.jsx'),
  read('crm-app/src/pages/PendingPage.jsx'),
]);

assert.match(migration, /create table public\.contacts/i);
assert.match(migration, /alter table public\.leads add column contact_id uuid/i);
assert.match(migration, /foreign key \(clinic_id, contact_id\)[\s\S]*references public\.contacts \(clinic_id, id\)/i);
assert.match(migration, /create unique index leads_clinic_open_contact_treatment_unique_idx/i);
assert.match(migration, /app_private\.is_open_opportunity/i);
assert.match(migration, /create policy contacts_select_same_clinic/i);
assert.match(migration, /create trigger sync_lead_contact/i);
assert.match(migration, /l\.contact_id = contact_id_value/i);
assert.match(migration, /created_new_opportunity/i);

const grouped = groupPatientOpportunities([
  { id: 'lead-a', contact_id: 'contact-1', name: 'Florencia López', phone_plus: '+5951', treatment: 'Implantes', created_at: '2026-09-01T10:00:00Z' },
  { id: 'lead-b', contact_id: 'contact-1', name: 'Florencia López', phone_plus: '+5951', treatment: 'Estética', created_at: '2026-09-02T10:00:00Z' },
  { id: 'lead-c', contact_id: 'contact-2', name: 'Otra persona', phone_plus: '+5952', treatment: 'Ortodoncia', created_at: '2026-09-03T10:00:00Z' },
]);
assert.equal(grouped.length, 2);
assert.equal(grouped.find((item) => item.id === 'contact-1').opportunities.length, 2);
assert.match(leadsPage, /groupPatientOpportunities\(leads\)/);
assert.match(leadsPage, /Oportunidades \(/);
assert.doesNotMatch(pendingPage, /groupPatientOpportunities/);

assert.match(login, /resetPasswordForEmail\(email, \{ redirectTo \}\)/);
assert.match(login, /Si existe una cuenta con ese correo/);
assert.match(login, /updateUser\(\{ password \}\)/);
assert.match(login, /Confirmar nueva contraseña/);
assert.match(sessionHook, /event === 'PASSWORD_RECOVERY'/);
assert.match(app, /passwordRecovery/);
assert.match(passwordInput, /type=\{visible \? 'text' : 'password'\}/);
assert.match(passwordInput, /aria-label=/);
assert.match(passwordInput, /type="button"/);
assert.doesNotMatch(migration, /password\s+(text|varchar)/i);

console.log('contact/auth contract: PASS');
