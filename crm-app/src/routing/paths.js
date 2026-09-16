export const VIEW_PATHS = Object.freeze({
  dashboard: '/resumen', leads: '/pacientes', pending: '/trabajo',
  agenda: '/agenda', metrics: '/analisis', settings: '/configuracion',
  followups: '/seguimientos', tasks: '/tareas',
  opportunities: '/oportunidades',
});

export const patientPath = (contactId) => `/pacientes/${encodeURIComponent(contactId)}`;
export const opportunityPath = (contactId, leadId) => `${patientPath(contactId)}/oportunidades/${encodeURIComponent(leadId)}`;
export const viewPath = (view) => VIEW_PATHS[view] || '/resumen';
export function viewForPath(pathname) {
  if (pathname.startsWith('/pacientes/')) return 'lead-detail';
  return Object.keys(VIEW_PATHS).find((view) => VIEW_PATHS[view] === pathname) || 'dashboard';
}
