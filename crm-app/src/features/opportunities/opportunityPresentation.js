export function opportunityActionLabel(action) {
  const labels = {
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
  return labels[action?.actionType] || 'Registrar resultado';
}

export function opportunityPriorityLabel(action, labels) {
  return action ? labels[action.priorityGroup] || 'Prioridad operativa' : 'Sin acción pendiente';
}
