import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRef = 'aqdufiycayedsfldljjq';
const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const linkedRef = process.env.QA_STAGING_PROJECT_REF || projectRef;
assert.equal(linkedRef, projectRef, 'QA setup is restricted to the staging project');

const keyResult = spawnSync(
  process.env.ComSpec || 'cmd.exe',
  ['/d', '/s', '/c', `npx.cmd supabase projects api-keys --project-ref ${projectRef} --output json`],
  { cwd: repoRoot, encoding: 'utf8', windowsHide: true },
);
assert.equal(keyResult.status, 0, 'Could not load staging API keys');
const keys = JSON.parse(keyResult.stdout);
const publishableKey = keys.find((key) => key.type === 'publishable' && !key.disabled)?.api_key
  || keys.find((key) => key.id === 'anon')?.api_key;
const serviceRoleKey = keys.find((key) => key.id === 'service_role')?.api_key;
assert.ok(publishableKey, 'Staging publishable key is missing');
assert.ok(serviceRoleKey, 'Staging service role key is missing');

const require = createRequire(new URL('../crm-app/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = `https://${projectRef}.supabase.co`;
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const password = `${randomBytes(24).toString('base64url')}Aa1!`;
const users = [
  { key: 'ownerA', email: 'qa.owner.a@dental-crm.invalid', fullName: 'QA Owner A', role: 'owner' },
  { key: 'receptionA', email: 'qa.reception.a@dental-crm.invalid', fullName: 'QA Reception A', role: 'receptionist' },
  { key: 'ownerB', email: 'qa.owner.b@dental-crm.invalid', fullName: 'QA Owner B', role: 'owner' },
  { key: 'receptionB', email: 'qa.reception.b@dental-crm.invalid', fullName: 'QA Reception B', role: 'receptionist' },
];

const { data: existingUsers, error: listUsersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listUsersError) throw listUsersError;
for (const fixture of users) {
  const existing = existingUsers.users.find((user) => user.email?.toLowerCase() === fixture.email);
  if (existing) {
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: fixture.fullName, qa_fixture: true },
    });
    if (error) throw error;
    fixture.id = data.user.id;
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: fixture.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fixture.fullName, qa_fixture: true },
    });
    if (error) throw error;
    fixture.id = data.user.id;
  }
}

const clinics = {
  A: '10000000-0000-4000-8000-0000000000a1',
  B: '10000000-0000-4000-8000-0000000000b2',
};
const forms = {
  A: '20000000-0000-4000-8000-0000000000a1',
  B: '20000000-0000-4000-8000-0000000000b2',
};
const formConfig = {
  A: {
    slug: 'qa-first-clinic-a',
    token: 'lf_qa_first_clinic_a_0123456789abcdef0123456789',
    origin: 'https://qa-clinic-a.example.test',
  },
  B: {
    slug: 'qa-first-clinic-b',
    token: 'lf_qa_first_clinic_b_0123456789abcdef0123456789',
    origin: 'https://qa-clinic-b.example.test',
  },
};

async function upsert(table, rows, options = {}) {
  const { error } = await admin.from(table).upsert(rows, options);
  if (error) throw new Error(`${table}: ${error.message}`);
}

await upsert('clinics', [
  {
    id: clinics.A,
    name: 'QA First Clinic A',
    slug: formConfig.A.slug,
    doctor_name: 'Dra. QA A',
    business_hours: { weekdays: '08:00-18:00' },
    timezone: 'America/Asuncion',
    status: 'active',
    is_active: true,
  },
  {
    id: clinics.B,
    name: 'QA First Clinic B',
    slug: formConfig.B.slug,
    doctor_name: 'Dra. QA B',
    business_hours: { weekdays: '08:00-18:00' },
    timezone: 'America/Asuncion',
    status: 'active',
    is_active: true,
  },
]);

for (const user of users) {
  user.clinicId = user.key.endsWith('A') ? clinics.A : clinics.B;
}
await upsert('profiles', users.map((user) => ({
  id: user.id,
  clinic_id: user.clinicId,
  full_name: user.fullName,
  email: user.email,
  role: user.role,
  active: true,
})));

await upsert('clinic_public_forms', [
  {
    id: forms.A,
    clinic_id: clinics.A,
    clinic_slug: formConfig.A.slug,
    public_token: formConfig.A.token,
    landing_url: formConfig.A.origin,
    allowed_origins: [formConfig.A.origin],
    is_active: true,
  },
  {
    id: forms.B,
    clinic_id: clinics.B,
    clinic_slug: formConfig.B.slug,
    public_token: formConfig.B.token,
    landing_url: formConfig.B.origin,
    allowed_origins: [formConfig.B.origin],
    is_active: true,
  },
]);

await upsert('clinic_settings', [
  {
    clinic_id: clinics.A,
    opening_hours: 'Lunes a viernes 08:00-18:00',
    treatments: ['Implante', 'Blanqueamiento'],
    treatment_prices: { Implante: 8500000, Blanqueamiento: 1200000 },
  },
  {
    clinic_id: clinics.B,
    opening_hours: 'Lunes a viernes 08:00-18:00',
    treatments: ['Implante', 'Blanqueamiento'],
    treatment_prices: { Implante: 8500000, Blanqueamiento: 1200000 },
  },
]);

await upsert('treatment_prices', [
  { id: '30000000-0000-4000-8000-0000000000a1', clinic_id: clinics.A, treatment: 'Implante', estimated_price: 8500000 },
  { id: '30000000-0000-4000-8000-0000000000a2', clinic_id: clinics.A, treatment: 'Blanqueamiento', estimated_price: 1200000 },
  { id: '30000000-0000-4000-8000-0000000000b1', clinic_id: clinics.B, treatment: 'Implante', estimated_price: 8500000 },
  { id: '30000000-0000-4000-8000-0000000000b2', clinic_id: clinics.B, treatment: 'Blanqueamiento', estimated_price: 1200000 },
]);

const commercialTemplates = [
  ['first_contact', 'Primer contacto'],
  ['urgency', 'Urgencia'],
  ['price_inquiry', 'Consulta de precio'],
  ['no_response', 'Sin respuesta'],
  ['appointment_reminder', 'Recordatorio de cita'],
  ['no_show', 'Inasistencia'],
  ['post_consultation', 'Después de consulta'],
  ['cold_reactivation', 'Reactivación'],
  ['attendance_confirmation', 'Confirmación de asistencia'],
];
await upsert('message_templates', ['A', 'B'].flatMap((clinicKey) => commercialTemplates.map(([templateKey, name], index) => ({
  id: `80000000-0000-4000-8000-0000000000${clinicKey.toLowerCase()}${index + 1}`,
  clinic_id: clinics[clinicKey],
  template_key: templateKey,
  name: `${name} QA`,
  message: `Mensaje QA ${name.toLowerCase()} para {{nombre}}.`,
}))), { onConflict: 'clinic_id,template_key' });

const receptionA = users.find((user) => user.key === 'receptionA');
const receptionB = users.find((user) => user.key === 'receptionB');
const seedLeads = {
  A: '40000000-0000-4000-8000-0000000000a1',
  B: '40000000-0000-4000-8000-0000000000b2',
};
await upsert('leads', [
  {
    id: seedLeads.A,
    clinic_id: clinics.A,
    name: 'QA Seed Patient A',
    phone: '0981000101',
    phone_plus: '+595981000101',
    treatment: 'Implante',
    urgency: 'Hoy',
    situation: 'Quiere agendar una cita',
    status: 'Nuevo',
    assigned_to: receptionA.id,
    next_action: 'Responder consulta QA',
    next_followup_at: new Date(Date.now() + 3_600_000).toISOString(),
    consent_contact: true,
    consent_at: new Date().toISOString(),
    source: 'QA release fixture',
  },
  {
    id: seedLeads.B,
    clinic_id: clinics.B,
    name: 'QA Seed Patient B',
    phone: '0982000202',
    phone_plus: '+595982000202',
    treatment: 'Blanqueamiento',
    urgency: 'Esta semana',
    situation: 'Quiere agendar una cita',
    status: 'Nuevo',
    assigned_to: receptionB.id,
    next_action: 'Responder consulta QA',
    next_followup_at: new Date(Date.now() + 3_600_000).toISOString(),
    consent_contact: true,
    consent_at: new Date().toISOString(),
    source: 'QA release fixture',
  },
]);

await upsert('appointments', [
  { id: '50000000-0000-4000-8000-0000000000a1', clinic_id: clinics.A, lead_id: seedLeads.A, appointment_date: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10), appointment_time: '09:00', doctor_assigned: 'Dra. QA A', status: 'Agendado' },
  { id: '50000000-0000-4000-8000-0000000000b2', clinic_id: clinics.B, lead_id: seedLeads.B, appointment_date: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10), appointment_time: '10:00', doctor_assigned: 'Dra. QA B', status: 'Agendado' },
]);
await upsert('quotes', [
  { id: '60000000-0000-4000-8000-0000000000a1', clinic_id: clinics.A, lead_id: seedLeads.A, treatment: 'Implante', amount: 8500000, status: 'pending', next_action_at: new Date(Date.now() + 86_400_000).toISOString() },
  { id: '60000000-0000-4000-8000-0000000000b2', clinic_id: clinics.B, lead_id: seedLeads.B, treatment: 'Blanqueamiento', amount: 1200000, status: 'pending', next_action_at: new Date(Date.now() + 86_400_000).toISOString() },
]);
await upsert('tasks', [
  { id: '70000000-0000-4000-8000-0000000000a1', clinic_id: clinics.A, lead_id: seedLeads.A, title: 'QA Task A', type: 'contact', status: 'pendiente', due_at: new Date(Date.now() + 3_600_000).toISOString(), assigned_to: receptionA.id, created_by: receptionA.id },
  { id: '70000000-0000-4000-8000-0000000000b2', clinic_id: clinics.B, lead_id: seedLeads.B, title: 'QA Task B', type: 'contact', status: 'pendiente', due_at: new Date(Date.now() + 3_600_000).toISOString(), assigned_to: receptionB.id, created_by: receptionB.id },
]);

const byKey = Object.fromEntries(users.map((user) => [user.key, user]));
const env = {
  QA_STAGING_PROJECT_REF: projectRef,
  QA_STAGING_SUPABASE_URL: supabaseUrl,
  QA_STAGING_SUPABASE_ANON_KEY: publishableKey,
  QA_STAGING_EDGE_URL: `${supabaseUrl}/functions/v1/lead-intake`,
  QA_STAGING_ALLOWED_ORIGIN: formConfig.A.origin,
  QA_STAGING_CLINIC_SLUG: formConfig.A.slug,
  QA_STAGING_FORM_TOKEN: formConfig.A.token,
  QA_OTHER_ALLOWED_ORIGIN: formConfig.B.origin,
  QA_OTHER_CLINIC_ID: clinics.B,
  QA_OTHER_CLINIC_SLUG: formConfig.B.slug,
  QA_OTHER_FORM_TOKEN: formConfig.B.token,
  QA_OWNER_A_EMAIL: byKey.ownerA.email,
  QA_OWNER_A_PASSWORD: password,
  QA_RECEPTION_A_EMAIL: byKey.receptionA.email,
  QA_RECEPTION_A_PASSWORD: password,
  QA_OWNER_B_EMAIL: byKey.ownerB.email,
  QA_OWNER_B_PASSWORD: password,
  QA_RECEPTION_B_EMAIL: byKey.receptionB.email,
  QA_RECEPTION_B_PASSWORD: password,
};
writeFileSync(
  resolve(repoRoot, '.env.qa-staging.local'),
  `${Object.entries(env).map(([name, value]) => `${name}=${value}`).join('\n')}\n`,
  { encoding: 'utf8', mode: 0o600 },
);

process.stdout.write(JSON.stringify({
  projectRef,
  authUsers: users.length,
  clinics: Object.keys(clinics).length,
  publicForms: Object.keys(forms).length,
  credentials: 'stored in ignored local QA env file',
}) + '\n');
