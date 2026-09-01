import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appSource = readFileSync(new URL('../crm-app/src/App.jsx', import.meta.url), 'utf8');
const saveFlow = appSource.match(/async function saveAppointmentSchedule[\s\S]*?async function updateAppointmentOutcome/)?.[0] || '';

assert.ok(saveFlow, 'Appointment save flow is missing');
const closeModalAt = saveFlow.indexOf('setAppointmentModal(null)');
const unlockModalAt = saveFlow.indexOf('setAppointmentSaving(false)');
const refreshAt = saveFlow.indexOf('await refreshClinicData()');

assert.ok(closeModalAt >= 0 && closeModalAt < refreshAt, 'Appointment modal must close before workspace refresh');
assert.ok(unlockModalAt >= 0 && unlockModalAt < refreshAt, 'Appointment modal must unlock before workspace refresh');

console.log('PASS appointment modal closes before workspace refresh');
