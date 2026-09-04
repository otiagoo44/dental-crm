import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appSource = readFileSync(new URL('../crm-app/src/App.jsx', import.meta.url), 'utf8');
const saveFlow = appSource.match(/async function saveAppointmentSchedule[\s\S]*?async function updateAppointmentOutcome/)?.[0] || '';

assert.ok(saveFlow, 'Appointment save flow is missing');
const closeModalAt = saveFlow.indexOf('setAppointmentModal(null)');
const unlockModalAt = saveFlow.indexOf('setAppointmentSaving(false)');
const refreshAt = saveFlow.indexOf('void refreshClinicData().then');
const abortSignalAt = saveFlow.indexOf('.abortSignal(requestController.signal)');
const clearTimeoutAt = saveFlow.indexOf('window.clearTimeout(requestTimeout)');

assert.ok(closeModalAt >= 0 && closeModalAt < refreshAt, 'Appointment modal must close before workspace refresh');
assert.ok(unlockModalAt >= 0 && unlockModalAt < refreshAt, 'Appointment modal must unlock before workspace refresh');
assert.equal(saveFlow.includes('await refreshClinicData()'), false, 'Appointment submit must not wait for workspace refresh');
assert.ok(abortSignalAt >= 0, 'Appointment save must have an abortable request timeout');
assert.ok(clearTimeoutAt > abortSignalAt, 'Appointment save must always clear its request timeout');
assert.match(saveFlow, /La solicitud tardó demasiado/, 'Appointment timeout must show a recoverable error');

console.log('PASS appointment modal closes before workspace refresh');
