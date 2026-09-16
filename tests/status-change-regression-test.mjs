import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Execute the real controller entry point, including its early returns.
const source = readFileSync(new URL('../crm-app/src/hooks/useCrmController.js', import.meta.url), 'utf8');
const entry = source.slice(source.indexOf('  async function updateLead('), source.indexOf('  function openAppointmentModal('));
for (const status of ['Contactado', 'Respondió', 'No Respondió']) {
  const calls = [];
  const context = {
    profile: { clinic_id: 'tenant' }, leads: [{ id: 'lead', status: 'Nuevo' }],
    setError() {}, setNotice() {}, LEAD_STATUS: { scheduled: 'Consulta Agendada' },
    APPOINTMENT_OUTCOME_LEAD_STATUSES: ['Confirmado', 'Asistió', 'No Asistió'],
    taskConfigForLeadStatus: () => ({ title: 'Seguimiento', due_at: '2026-10-01' }),
    saveLeadFollowup: async (lead, options) => { calls.push({ lead, options }); return true; },
    supabase: { from() { throw new Error('Status must use the atomic RPC, never a second direct write'); } },
  };
  vm.createContext(context);
  vm.runInContext(`${entry}\nglobalThis.update = updateLead;`, context);
  await context.update('lead', { status });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.status, status);
}
console.log('PASS DF-009: real updateLead routes contact transitions exclusively through the atomic workflow');
