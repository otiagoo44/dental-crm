import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../crm-app/src/hooks/useClinicWorkspace.js', import.meta.url), 'utf8');

assert.equal((source.match(/\.channel\(`/g) || []).length, 1, 'one workspace hook must create one Realtime channel');
assert.equal((source.match(/\.on\('postgres_changes'/g) || []).length, 8, 'the channel must bind INSERT and UPDATE for leads, appointments, tasks and quotes');
assert.equal((source.match(/event: 'INSERT'/g) || []).length, 4, 'every workspace table must subscribe to INSERT explicitly');
assert.equal((source.match(/event: 'UPDATE'/g) || []).length, 4, 'every workspace table must subscribe to UPDATE explicitly');
assert.doesNotMatch(source, /event: '\*'/, 'wildcard Realtime events are not reliable for this workspace');
assert.match(source, /filter: `clinic_id=eq\.\$\{clinicId\}`/, 'Realtime bindings must filter clinic_id');
assert.match(source, /supabase\.removeChannel\(channel\)/, 'Realtime cleanup must remove the channel');
assert.match(source, /!realtimeHealthy && canRefresh\(\)/, 'polling must run only when Realtime is unhealthy and refresh is safe');
assert.match(source, /navigator\.onLine !== false/, 'polling must stop while offline');
assert.match(source, /document\.visibilityState === 'visible'/, 'polling must stop for hidden tabs');
assert.match(source, /25_000/, 'fallback polling interval must remain explicit');
assert.match(source, /refreshInFlightRef\.current/, 'workspace refreshes must be coalesced while one is in flight');

console.log('PASS Realtime channel, cleanup and polling fallback contract');
