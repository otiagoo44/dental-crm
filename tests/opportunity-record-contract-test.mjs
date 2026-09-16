import assert from 'node:assert/strict';
import { opportunityActionLabel, opportunityPriorityLabel } from '../crm-app/src/features/opportunities/opportunityPresentation.js';

const cases = {
  initial_contact: 'Registrar contacto',
  followup: 'Registrar seguimiento',
  confirm_appointment: 'Confirmar cita',
  attendance: 'Registrar asistencia',
  no_show_recovery: 'Recuperar no-show',
  quote_followup: 'Seguimiento presupuesto',
  quote_registration: 'Crear presupuesto',
  reactivation: 'Registrar reactivación',
  manual_task: 'Resolver tarea',
  assign_owner: 'Asignar responsable',
};

for (const [actionType, label] of Object.entries(cases)) {
  assert.equal(opportunityActionLabel({ actionType }), label);
}
assert.equal(opportunityActionLabel({ actionType: 'future_type' }), 'Registrar resultado');
assert.equal(opportunityPriorityLabel({ priorityGroup: 'urgent' }, { urgent: 'Ahora' }), 'Ahora');
assert.equal(opportunityPriorityLabel(null, {}), 'Sin acción pendiente');

console.log('Opportunity record contract: PASS');
