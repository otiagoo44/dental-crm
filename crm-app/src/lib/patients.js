export function groupPatientOpportunities(leads = []) {
  const groups = new Map();

  for (const lead of leads) {
    const patientId = lead.contact_id || lead.id;
    const current = groups.get(patientId) || { id: patientId, opportunities: [] };
    current.opportunities.push(lead);
    groups.set(patientId, current);
  }

  return Array.from(groups.values()).map((group) => {
    const opportunities = [...group.opportunities].sort(
      (left, right) => new Date(right.updated_at || right.created_at) - new Date(left.updated_at || left.created_at),
    );
    const latest = opportunities[0];

    return {
      ...group,
      name: latest?.name || 'Paciente sin nombre',
      phone: latest?.phone_plus || latest?.phone || '',
      latest,
      opportunities,
    };
  });
}
