import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createGlobalSearch, GLOBAL_SEARCH_LIMIT } from '../crm-app/src/services/globalSearch.js';

const clinicId = '77777777-7777-4777-8777-777777777777';
const calls = [];
const client = {
  rpc(name, args) {
    return { async abortSignal(signal) {
      calls.push({ name, args, signal });
      return { data: [{ result_type: 'contact', result_id: '1' }], error: null };
    } };
  },
};
const search = createGlobalSearch(client, clinicId);
const signal = new AbortController().signal;
const rows = await search({ query: '  Florencia  ', signal });
assert.equal(rows.length, 1);
assert.deepEqual(calls[0], {
  name: 'search_dentflow_v1',
  args: { p_clinic_id: clinicId, p_query: 'Florencia', p_limit: GLOBAL_SEARCH_LIMIT },
  signal,
});
await assert.rejects(() => search({ query: 'x' }), /2 y 80/);
await assert.rejects(() => search({ query: 'x'.repeat(81) }), /2 y 80/);
await assert.rejects(() => search({ query: 'valid', limit: 21 }), /Límite/);
assert.throws(() => createGlobalSearch(client, 'not-a-clinic'), /clínica autorizada/);

const migration = await readFile(new URL('../supabase/migrations/20260917002000_global_tenant_search.sql', import.meta.url), 'utf8');
assert.match(migration, /security invoker/i);
assert.match(migration, /set search_path = ''/i);
assert.match(migration, /actor_clinic_id <> p_clinic_id/i);
assert.match(migration, /p_limit < 1 or p_limit > 20/i);
assert.match(migration, /revoke all[\s\S]*from public, anon, authenticated, service_role/i);
assert.doesNotMatch(migration, /\b(c|l)\.notes\b/i);

console.log('Global tenant search contract: PASS');
