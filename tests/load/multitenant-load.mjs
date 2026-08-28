import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';

const endpoint = String(process.env.LOAD_EDGE_URL || '').trim();
const supabaseUrl = String(process.env.LOAD_SUPABASE_URL || '').trim();
const serviceRoleKey = String(process.env.LOAD_SERVICE_ROLE_KEY || '').trim();
const origin = String(process.env.LOAD_ORIGIN || '').trim();
const allowedHost = String(process.env.LOAD_ALLOWED_HOST || '').trim();
const target = String(process.env.LOAD_TARGET || '').trim().toLowerCase();
const remoteConfirmation = String(process.env.LOAD_CONFIRM_NON_PRODUCTION || '').trim();
const scenarioText = String(process.env.LOAD_SCENARIOS || '10,20,50,100');
const perClinic = Number(process.env.LOAD_PER_CLINIC || '1');

assert.ok(endpoint, 'LOAD_EDGE_URL is required');
assert.ok(supabaseUrl, 'LOAD_SUPABASE_URL is required for cross-tenant verification');
assert.ok(serviceRoleKey, 'LOAD_SERVICE_ROLE_KEY is required only in this local/staging test process');
assert.ok(origin, 'LOAD_ORIGIN is required');
assert.ok(['local', 'staging'].includes(target), 'LOAD_TARGET must be local or staging');
assert.ok(Number.isInteger(perClinic) && perClinic >= 1 && perClinic <= 10, 'LOAD_PER_CLINIC must be between 1 and 10');

const endpointUrl = new URL(endpoint);
const apiUrl = new URL(supabaseUrl);
assert.equal(endpointUrl.pathname, '/functions/v1/lead-intake', 'LOAD_EDGE_URL must point to lead-intake');
assert.equal(endpointUrl.origin, apiUrl.origin, 'Edge and REST verification must use the same Supabase project');
assert.ok(allowedHost && endpointUrl.host === allowedHost, 'LOAD_ALLOWED_HOST must exactly match the target host');

const isLocalHost = ['localhost', '127.0.0.1'].includes(endpointUrl.hostname);
if (!isLocalHost) {
  assert.equal(target, 'staging', 'Remote load tests are allowed only with LOAD_TARGET=staging');
  assert.equal(remoteConfirmation, 'I_ACKNOWLEDGE_STAGING', 'Set LOAD_CONFIRM_NON_PRODUCTION=I_ACKNOWLEDGE_STAGING');
}

const scenarios = scenarioText.split(',').map((value) => Number(value.trim()));
assert.ok(scenarios.length > 0 && scenarios.every((value) => [10, 20, 50, 100].includes(value)), 'LOAD_SCENARIOS supports 10,20,50,100');

function fixture(index) {
  const padded = String(index).padStart(3, '0');
  return {
    index,
    slug: `load-qa-${padded}`,
    token: `lf_load_${createHash('md5').update(`dental-crm-load-form-${index}`).digest('hex')}`,
    clinicId: uuidFromText(`dental-crm-load-clinic-${index}`),
  };
}

function uuidFromText(value) {
  const hash = createHash('md5').update(value).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`;
}

function percentile(values, quantile) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * quantile) - 1)];
}

function phoneFor(runId, clinicIndex, submissionIndex) {
  const digest = createHash('sha256').update(`${runId}:${clinicIndex}:${submissionIndex}`).digest();
  const suffix = digest.readUInt32BE(0) % 1_000_000;
  return `0981${String(suffix).padStart(6, '0')}`;
}

async function submit(item, scenario, submissionIndex, runId) {
  const started = performance.now();
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json', Origin: origin },
      body: JSON.stringify({
        clinic_slug: item.slug,
        landing_token: item.token,
        nombre: `Load ${runId} clinic ${item.index} submission ${submissionIndex}`,
        telefono: phoneFor(runId, item.index, submissionIndex),
        tratamiento: 'Consulta general',
        urgencia: 'Esta semana',
        situacion: 'Quiero agendar',
        consultation_reason: 'Prueba de carga no productiva',
        origen: `load:${runId}`,
        pagina: 'tests/load/multitenant-load.mjs',
        consentimiento_contacto: true,
        website: '',
      }),
    });
    const data = await response.json().catch(() => null);
    return {
      clinicIndex: item.index,
      expectedClinicId: item.clinicId,
      phone: `+595${phoneFor(runId, item.index, submissionIndex).slice(1)}`,
      status: response.status,
      success: response.ok && data?.success === true,
      latencyMs: Math.round((performance.now() - started) * 100) / 100,
    };
  } catch (error) {
    return {
      clinicIndex: item.index,
      expectedClinicId: item.clinicId,
      phone: `+595${phoneFor(runId, item.index, submissionIndex).slice(1)}`,
      status: 0,
      success: false,
      latencyMs: Math.round((performance.now() - started) * 100) / 100,
      error: error instanceof Error ? error.name : 'request_error',
    };
  }
}

async function fetchCreatedLeads(runId) {
  const query = new URL('/rest/v1/leads', supabaseUrl);
  query.searchParams.set('select', 'id,clinic_id,phone_plus,source');
  query.searchParams.set('source', `eq.load:${runId}`);
  query.searchParams.set('limit', '2000');
  const response = await fetch(query, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  assert.equal(response.ok, true, `REST verification failed with HTTP ${response.status}`);
  return response.json();
}

const rows = [];
for (const clinicCount of scenarios) {
  const runId = `${new Date().toISOString().replace(/[-:.TZ]/g, '')}-${clinicCount}-${randomUUID().slice(0, 8)}`;
  const requests = [];
  const expected = new Map();

  for (let index = 1; index <= clinicCount; index += 1) {
    const item = fixture(index);
    for (let submissionIndex = 1; submissionIndex <= perClinic; submissionIndex += 1) {
      const phone = `+595${phoneFor(runId, index, submissionIndex).slice(1)}`;
      expected.set(`${item.clinicId}:${phone}`, 1);
      requests.push(submit(item, clinicCount, submissionIndex, runId));
    }
  }

  const results = await Promise.all(requests);
  const latencies = results.map((result) => result.latencyMs);
  const success = results.filter((result) => result.success).length;
  const errors = results.length - success;
  const created = await fetchCreatedLeads(runId);
  const actual = new Map();
  let crossTenant = 0;

  for (const lead of created) {
    const key = `${lead.clinic_id}:${lead.phone_plus}`;
    actual.set(key, (actual.get(key) || 0) + 1);
    if (!expected.has(key)) crossTenant += 1;
  }

  for (const result of results.filter((item) => item.success)) {
    if (!created.some((lead) => lead.clinic_id === result.expectedClinicId && lead.phone_plus === result.phone)) {
      crossTenant += 1;
    }
  }

  const duplicates = [...actual.values()].reduce((total, count) => total + Math.max(0, count - 1), 0);
  const row = {
    clinics: clinicCount,
    total: results.length,
    success,
    successRate: Math.round((success / results.length) * 10000) / 100,
    errors,
    p50Ms: percentile(latencies, 0.5),
    p95Ms: percentile(latencies, 0.95),
    p99Ms: percentile(latencies, 0.99),
    dbRows: created.length,
    crossTenant,
    duplicates,
  };
  rows.push(row);

  assert.equal(errors, 0, `Scenario ${clinicCount} had request errors`);
  assert.equal(created.length, results.length, `Scenario ${clinicCount} did not create exactly one lead per request`);
  assert.equal(crossTenant, 0, `Scenario ${clinicCount} had cross-tenant mismatches`);
  assert.equal(duplicates, 0, `Scenario ${clinicCount} had duplicate rows`);
}

console.table(rows);
console.log(JSON.stringify({ target, endpointHost: endpointUrl.host, perClinic, scenarios: rows }, null, 2));
