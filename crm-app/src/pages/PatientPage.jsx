import { Link, useParams } from 'react-router';
import { groupPatientOpportunities } from '../lib/patients';
import { getEffectiveNextAction } from '../lib/nextActions';
import { opportunityPath } from '../routing/paths';
import Card from '../components/ui/Card';
import StatusBadge from '../components/ui/StatusBadge';
import NotFoundPage from './NotFoundPage';

export default function PatientPage({ leads, tasks, appointments, quotes }) {
  const { contactId } = useParams();
  const patient = groupPatientOpportunities(leads.filter((lead) => lead.contact_id === contactId))[0];
  if (!patient) return <NotFoundPage entity="Paciente" />;
  return <section className="mx-auto max-w-5xl space-y-4">
    <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-mint" to="/pacientes">Volver a pacientes</Link>
    <Card className="p-5 sm:p-6">
      <h1 className="text-2xl font-bold text-cream">{patient.name}</h1>
      <p className="mt-1 text-base text-textMuted">{patient.phone || 'Sin teléfono'}</p>
    </Card>
    <h2 className="text-lg font-bold text-cream">Oportunidades ({patient.opportunities.length})</h2>
    <div className="grid gap-3 sm:grid-cols-2">
      {patient.opportunities.map((lead) => {
        const action = getEffectiveNextAction(lead, { tasks, appointments, quotes });
        return <Card key={lead.id}>
          <Link className="block rounded-lg p-5 transition hover:bg-elevated" to={opportunityPath(contactId, lead.id)}>
            <h3 className="font-bold text-cream">{lead.treatment || 'Tratamiento por definir'}</h3>
            <div className="mt-2"><StatusBadge value={lead.status} /></div>
            <p className="mt-3 text-sm text-textSoft">{action?.title || lead.next_action || 'Sin próxima acción'}</p>
          </Link>
        </Card>;
      })}
    </div>
  </section>;
}
