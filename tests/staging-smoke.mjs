import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../crm-app/package.json', import.meta.url));
const { createClient } = require('@supabase/supabase-js');

const requiredNames = [
  'QA_STAGING_PROJECT_REF',
  'QA_STAGING_SUPABASE_URL',
  'QA_STAGING_SUPABASE_ANON_KEY',
  'QA_STAGING_EDGE_URL',
  'QA_STAGING_ALLOWED_ORIGIN',
  'QA_STAGING_CLINIC_SLUG',
  'QA_STAGING_FORM_TOKEN',
  'QA_OTHER_ALLOWED_ORIGIN',
  'QA_OTHER_CLINIC_ID',
  'QA_OTHER_CLINIC_SLUG',
  'QA_OTHER_FORM_TOKEN',
  'QA_OWNER_A_EMAIL',
  'QA_OWNER_A_PASSWORD',
  'QA_RECEPTION_A_EMAIL',
  'QA_RECEPTION_A_PASSWORD',
  'QA_OWNER_B_EMAIL',
  'QA_OWNER_B_PASSWORD',
  'QA_RECEPTION_B_EMAIL',
  'QA_RECEPTION_B_PASSWORD',
];

const missing = requiredNames.filter((name) => !String(process.env[name] || '').trim());
if (missing.length) {
  throw new Error(`Missing staging QA environment variables: ${missing.join(', ')}`);
}

const config = Object.fromEntries(requiredNames.map((name) => [name, String(process.env[name]).trim()]));
const projectUrl = new URL(config.QA_STAGING_SUPABASE_URL);
const edgeUrl = new URL(config.QA_STAGING_EDGE_URL);
const projectRef = projectUrl.hostname.match(/^([a-z0-9]+)\.supabase\.co$/i)?.[1];
assert.equal(projectRef, config.QA_STAGING_PROJECT_REF, 'QA staging URL does not match QA_STAGING_PROJECT_REF');
assert.equal(edgeUrl.origin, projectUrl.origin, 'Edge Function and Supabase URL target different projects');
assert.equal(edgeUrl.pathname, '/functions/v1/lead-intake');
assert.ok(!/service[_-]?role|sb_secret_/i.test(config.QA_STAGING_SUPABASE_ANON_KEY), 'Use only a publishable/anon key');

let passed = 0;
let failed = 0;

async function check(name, operation) {
  try {
    await operation();
    passed += 1;
    process.stdout.write(`PASS ${name}\n`);
  } catch (error) {
    failed += 1;
    process.stderr.write(`FAIL ${name}: ${error instanceof Error ? error.message : 'unknown'}\n`);
  }
}

function client() {
  return createClient(config.QA_STAGING_SUPABASE_URL, config.QA_STAGING_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function authenticatedClient(email, password) {
  const supabase = client();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) throw error || new Error('QA sign-in returned no user');
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id,clinic_id,role,active')
    .eq('id', data.user.id)
    .single();
  if (profileError || !profile?.active) throw profileError || new Error('QA profile missing or inactive');
  return { supabase, user: data.user, profile };
}

const sessions = {};
await check('authenticate four real QA users', async () => {
  sessions.ownerA = await authenticatedClient(config.QA_OWNER_A_EMAIL, config.QA_OWNER_A_PASSWORD);
  sessions.receptionA = await authenticatedClient(config.QA_RECEPTION_A_EMAIL, config.QA_RECEPTION_A_PASSWORD);
  sessions.ownerB = await authenticatedClient(config.QA_OWNER_B_EMAIL, config.QA_OWNER_B_PASSWORD);
  sessions.receptionB = await authenticatedClient(config.QA_RECEPTION_B_EMAIL, config.QA_RECEPTION_B_PASSWORD);
  assert.equal(sessions.ownerA.profile.clinic_id, sessions.receptionA.profile.clinic_id);
  assert.equal(sessions.ownerB.profile.clinic_id, sessions.receptionB.profile.clinic_id);
  assert.notEqual(sessions.ownerA.profile.clinic_id, sessions.ownerB.profile.clinic_id);
  assert.match(sessions.ownerA.profile.role, /owner|admin/);
  assert.equal(sessions.receptionA.profile.role, 'receptionist');
});

if (!sessions.ownerA) {
  process.stderr.write(`RESULT ${passed} passed, ${failed} failed\n`);
  process.exit(1);
}

const clinicA = sessions.ownerA.profile.clinic_id;
const clinicB = sessions.ownerB.profile.clinic_id;
assert.equal(clinicB, config.QA_OTHER_CLINIC_ID, 'Clinic B fixture does not match the authenticated profile');

await check('RLS Reception A cannot read Clinic B', async () => {
  for (const table of ['leads', 'appointments', 'tasks', 'quotes']) {
    const { data, error } = await sessions.receptionA.supabase.from(table).select('id').eq('clinic_id', clinicB);
    if (error) throw error;
    assert.equal(data.length, 0, `${table} exposed cross-tenant rows`);
  }
  const { data: forms, error: formsError } = await sessions.receptionA.supabase.from('clinic_public_forms').select('id');
  if (formsError) throw formsError;
  assert.equal(forms.length, 0, 'receptionist can read administrative form configuration');
});

await check('RLS Owner A cannot read Clinic B', async () => {
  const { data, error } = await sessions.ownerA.supabase.from('leads').select('id').eq('clinic_id', clinicB);
  if (error) throw error;
  assert.equal(data.length, 0);
});

await check('RLS Clinic B users cannot read Clinic A', async () => {
  for (const session of [sessions.ownerB, sessions.receptionB]) {
    const { data, error } = await session.supabase.from('leads').select('id').eq('clinic_id', clinicA);
    if (error) throw error;
    assert.equal(data.length, 0);
  }
});

await check('RLS both clinics can work only with their own operational data', async () => {
  for (const [label, session, ownClinic, foreignClinic] of [
    ['Reception A', sessions.receptionA, clinicA, clinicB],
    ['Owner A', sessions.ownerA, clinicA, clinicB],
    ['Reception B', sessions.receptionB, clinicB, clinicA],
    ['Owner B', sessions.ownerB, clinicB, clinicA],
  ]) {
    for (const table of ['leads', 'appointments', 'tasks', 'quotes']) {
      const { data: own, error: ownError } = await session.supabase.from(table).select('id').eq('clinic_id', ownClinic).limit(1);
      if (ownError) throw ownError;
      assert.ok(own.length >= 1, `${label} cannot read own ${table}`);

      const { data: foreign, error: foreignError } = await session.supabase.from(table).select('id').eq('clinic_id', foreignClinic);
      if (foreignError) throw foreignError;
      assert.equal(foreign.length, 0, `${label} can read foreign ${table}`);
    }
  }

  for (const [owner, ownClinic] of [[sessions.ownerA, clinicA], [sessions.ownerB, clinicB]]) {
    const { data: forms, error } = await owner.supabase.from('clinic_public_forms').select('id,clinic_id');
    if (error) throw error;
    assert.ok(forms.length >= 1);
    assert.ok(forms.every((form) => form.clinic_id === ownClinic));
  }
});

async function firstId(session, table, clinicId) {
  const { data, error } = await session.supabase.from(table).select('id').eq('clinic_id', clinicId).limit(1).single();
  if (error) throw error;
  return data.id;
}

async function assertCrossTenantWritesBlocked(attacker, verifier, targetClinic) {
  const targets = {
    leads: await firstId(verifier, 'leads', targetClinic),
    appointments: await firstId(verifier, 'appointments', targetClinic),
    tasks: await firstId(verifier, 'tasks', targetClinic),
    quotes: await firstId(verifier, 'quotes', targetClinic),
    profiles: await firstId(verifier, 'profiles', targetClinic),
    clinic_public_forms: await firstId(verifier, 'clinic_public_forms', targetClinic),
  };
  const probes = [
    ['leads', { notes: 'CROSS TENANT WRITE MUST NOT PERSIST' }],
    ['appointments', { notes: 'CROSS TENANT WRITE MUST NOT PERSIST' }],
    ['tasks', { description: 'CROSS TENANT WRITE MUST NOT PERSIST' }],
    ['quotes', { notes: 'CROSS TENANT WRITE MUST NOT PERSIST' }],
    ['profiles', { active: false }],
    ['clinic_public_forms', { is_active: false }],
  ];
  for (const [table, values] of probes) {
    const { data, error } = await attacker.supabase.from(table).update(values).eq('id', targets[table]).select('id');
    if (!error) assert.equal(data.length, 0, `${table} cross-tenant update returned a row`);
  }

  const [{ data: lead }, { data: appointment }, { data: task }, { data: quote }, { data: profile }, { data: form }] = await Promise.all([
    verifier.supabase.from('leads').select('notes').eq('id', targets.leads).single(),
    verifier.supabase.from('appointments').select('notes').eq('id', targets.appointments).single(),
    verifier.supabase.from('tasks').select('description').eq('id', targets.tasks).single(),
    verifier.supabase.from('quotes').select('notes').eq('id', targets.quotes).single(),
    verifier.supabase.from('profiles').select('active').eq('id', targets.profiles).single(),
    verifier.supabase.from('clinic_public_forms').select('is_active').eq('id', targets.clinic_public_forms).single(),
  ]);
  assert.notEqual(lead.notes, 'CROSS TENANT WRITE MUST NOT PERSIST');
  assert.notEqual(appointment.notes, 'CROSS TENANT WRITE MUST NOT PERSIST');
  assert.notEqual(task.description, 'CROSS TENANT WRITE MUST NOT PERSIST');
  assert.notEqual(quote.notes, 'CROSS TENANT WRITE MUST NOT PERSIST');
  assert.equal(profile.active, true);
  assert.equal(form.is_active, true);
}

await check('RLS blocks A writes to B lead, appointment, task, quote, responsible and form', async () => {
  await assertCrossTenantWritesBlocked(sessions.receptionA, sessions.ownerB, clinicB);
  await assertCrossTenantWritesBlocked(sessions.ownerA, sessions.ownerB, clinicB);
});

await check('RLS blocks B writes to A lead, appointment, task, quote, responsible and form', async () => {
  await assertCrossTenantWritesBlocked(sessions.receptionB, sessions.ownerA, clinicA);
  await assertCrossTenantWritesBlocked(sessions.ownerB, sessions.ownerA, clinicA);
});

let qaManualLead;
await check('RLS/RPC assignment stays inside Clinic A', async () => {
  const suffix = Date.now();
  const { data, error } = await sessions.receptionA.supabase.rpc('create_manual_lead_v2', {
    p_name: `QA RC assignment ${suffix}`,
    p_phone: `0981${String(suffix).slice(-6)}`,
    p_phone_plus: `+595981${String(suffix).slice(-6)}`,
    p_treatment: 'Implante dental',
    p_urgency: 'Hoy',
    p_consultation_reason: 'Release candidate staging smoke',
    p_source: 'WhatsApp directo',
    p_consent_contact: true,
    p_notes: 'QA staging-smoke; dato sintético',
    p_next_action: 'Responder nueva consulta',
    p_next_followup_at: new Date(Date.now() + 3_600_000).toISOString(),
    p_assigned_to: sessions.receptionA.user.id,
    p_situation: 'Quiere agendar una consulta',
    p_evaluation_previous: 'No',
    p_estimated_value: null,
  });
  if (error) throw error;
  qaManualLead = Array.isArray(data) ? data[0] : data;
  assert.equal(qaManualLead.clinic_id, clinicA);
  assert.equal(qaManualLead.assigned_to, sessions.receptionA.user.id);

  const { error: ownReassignError } = await sessions.ownerA.supabase.rpc('reassign_lead_owner', {
    p_lead_id: qaManualLead.id,
    p_assigned_to: sessions.receptionA.user.id,
  });
  if (ownReassignError) throw ownReassignError;

  const { error: crossReassignError } = await sessions.ownerA.supabase.rpc('reassign_lead_owner', {
    p_lead_id: qaManualLead.id,
    p_assigned_to: sessions.receptionB.user.id,
  });
  assert.ok(crossReassignError, 'cross-tenant reassignment unexpectedly succeeded');

  const { data: visibleFromB, error: visibleFromBError } = await sessions.ownerB.supabase
    .from('leads').select('id').eq('id', qaManualLead.id);
  if (visibleFromBError) throw visibleFromBError;
  assert.equal(visibleFromB.length, 0);
});

if (process.env.QA_RLS_ONLY === '1') {
  await Promise.all(Object.values(sessions).map(async ({ supabase }) => {
    await supabase.removeAllChannels();
    supabase.realtime.disconnect();
    await supabase.auth.signOut();
  }));
  if (!failed) process.stdout.write('INFO cross_tenant_leaks=0\n');
  process.stdout.write(`RESULT ${passed} passed, ${failed} failed\n`);
  if (failed) process.exit(1);
  process.exit(0);
}

let phoneCounter = Number(String(Date.now()).slice(-6));
function nextPhone() {
  phoneCounter = (phoneCounter + 1) % 1_000_000;
  return `0981${String(phoneCounter).padStart(6, '0')}`;
}

function payload(overrides = {}) {
  return {
    clinic_slug: config.QA_STAGING_CLINIC_SLUG,
    landing_token: config.QA_STAGING_FORM_TOKEN,
    nombre: `QA RC intake ${Date.now()}`,
    telefono: nextPhone(),
    tratamiento: 'Implante dental',
    urgencia: 'Hoy',
    evaluacion_previa: 'No',
    situacion: 'Quiero agendar una consulta',
    consultation_reason: 'Release candidate staging smoke',
    origen: 'tests/staging-smoke.mjs',
    pagina: 'qa-release-candidate',
    consentimiento_contacto: true,
    website: '',
    company: '',
    ...overrides,
  };
}

async function intake(body, origin = config.QA_STAGING_ALLOWED_ORIGIN) {
  const response = await fetch(config.QA_STAGING_EDGE_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', Origin: origin },
    body: JSON.stringify(body),
  });
  let data = null;
  try { data = await response.json(); } catch { data = null; }
  return { response, data };
}

await check('HTTP valid intake creates one complete opportunity', async () => {
  const body = payload();
  const first = await intake(body);
  assert.equal(first.response.status, 200);
  assert.ok(first.data?.lead_id);
  const duplicate = await intake(body);
  assert.equal(duplicate.response.status, 200);
  assert.equal(duplicate.data?.lead_id, first.data.lead_id);

  const [{ data: leads }, { data: events }, { data: tasks }, { data: jobs }] = await Promise.all([
    sessions.ownerA.supabase.from('leads').select('id,assigned_to').eq('id', first.data.lead_id),
    sessions.ownerA.supabase.from('lead_events').select('id').eq('lead_id', first.data.lead_id).eq('event_type', 'lead_created_from_landing'),
    sessions.ownerA.supabase.from('tasks').select('id').eq('lead_id', first.data.lead_id).eq('type', 'contact').in('status', ['pendiente', 'vencido', 'Vencida']),
    sessions.ownerA.supabase.from('automation_jobs').select('id').eq('lead_id', first.data.lead_id),
  ]);
  assert.equal(leads.length, 1);
  assert.ok(leads[0].assigned_to);
  assert.equal(events.length, 1);
  assert.equal(tasks.length, 1);
  assert.ok(jobs.length >= 1);
});

await check('HTTP Form B resolves only Clinic B and browser tenant injection is rejected', async () => {
  const bodyB = payload({
    clinic_slug: config.QA_OTHER_CLINIC_SLUG,
    landing_token: config.QA_OTHER_FORM_TOKEN,
    nombre: `QA RC Clinic B ${Date.now()}`,
  });
  const createdB = await intake(bodyB, config.QA_OTHER_ALLOWED_ORIGIN);
  assert.equal(createdB.response.status, 200);
  assert.ok(createdB.data?.lead_id);

  const [{ data: visibleFromB, error: errorB }, { data: visibleFromA, error: errorA }] = await Promise.all([
    sessions.ownerB.supabase.from('leads').select('id,clinic_id').eq('id', createdB.data.lead_id),
    sessions.ownerA.supabase.from('leads').select('id,clinic_id').eq('id', createdB.data.lead_id),
  ]);
  if (errorA || errorB) throw errorA || errorB;
  assert.equal(visibleFromB.length, 1);
  assert.equal(visibleFromB[0].clinic_id, clinicB);
  assert.equal(visibleFromA.length, 0);

  const injectedTenant = await intake(payload({ clinic_id: clinicB }));
  assert.equal(injectedTenant.response.status, 400);

  const missingTokenBody = payload();
  delete missingTokenBody.landing_token;
  const missingToken = await intake(missingTokenBody);
  assert.equal(missingToken.response.status, 400);
});

await check('HTTP duplicate open phone reuses one opportunity', async () => {
  const body = payload();
  const first = await intake(body);
  assert.equal(first.response.status, 200);
  const duplicatePhone = await intake({ ...body, nombre: `${body.nombre} updated`, consultation_reason: 'Same open phone, changed payload' });
  assert.equal(duplicatePhone.response.status, 200);
  assert.equal(duplicatePhone.data?.lead_id, first.data?.lead_id);
});

await check('HTTP rejects token, origin, consent, payload and spam', async () => {
  const badToken = await intake(payload({ landing_token: 'lf_invalid_release_candidate_token' }));
  assert.equal(badToken.response.status, 403);
  const badOrigin = await intake(payload(), 'https://invalid-origin.example');
  assert.equal(badOrigin.response.status, 403);
  const noConsent = await intake(payload({ consentimiento_contacto: false }));
  assert.equal(noConsent.response.status, 400);
  const invalidPayload = await intake(payload({ nombre: '' }));
  assert.equal(invalidPayload.response.status, 400);
  const spam = await intake(payload({ website: 'https://spam.example' }));
  assert.equal(spam.response.status, 403);
});

await check('terminal phone creates a new opportunity without deleting history', async () => {
  const body = payload();
  const first = await intake(body);
  assert.equal(first.response.status, 200);
  const { error } = await sessions.receptionA.supabase.rpc('register_lead_outcome', {
    p_lead_id: first.data.lead_id,
    p_outcome: 'treatment_started',
    p_note: 'QA terminal staging smoke',
    p_followup_at: null,
  });
  if (error) throw error;
  const second = await intake(body);
  assert.equal(second.response.status, 200);
  assert.notEqual(second.data.lead_id, first.data.lead_id);
  const { data: history, error: historyError } = await sessions.ownerA.supabase
    .from('leads').select('id,status').in('id', [first.data.lead_id, second.data.lead_id]);
  if (historyError) throw historyError;
  assert.equal(history.length, 2);
});

await check('Realtime delivers a new consultation without F5', async () => {
  const body = payload();
  const startedAt = Date.now();
  let resolveEvent;
  let rejectEvent;
  const eventPromise = new Promise((resolve, reject) => { resolveEvent = resolve; rejectEvent = reject; });
  const timeout = setTimeout(() => rejectEvent(new Error('Realtime event timeout')), 15_000);
  const channel = sessions.receptionA.supabase
    .channel(`qa-release-${startedAt}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'leads', filter: `clinic_id=eq.${clinicA}` }, (event) => resolveEvent(event))
    .subscribe();

  await new Promise((resolve) => setTimeout(resolve, 1_000));
  const created = await intake(body);
  assert.equal(created.response.status, 200);
  const event = await eventPromise;
  clearTimeout(timeout);
  await sessions.receptionA.supabase.removeChannel(channel);
  assert.equal(event.new.id, created.data.lead_id);
  process.stdout.write(`INFO realtime_latency_ms=${Date.now() - startedAt}\n`);
});

await Promise.all(Object.values(sessions).map(async ({ supabase }) => {
  await supabase.removeAllChannels();
  supabase.realtime.disconnect();
  await supabase.auth.signOut();
}));
if (!failed) process.stdout.write('INFO cross_tenant_leaks=0\n');
process.stdout.write(`RESULT ${passed} passed, ${failed} failed\n`);
if (failed) process.exit(1);
