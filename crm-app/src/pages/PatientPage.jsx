import { useMemo } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { supabase } from '../lib/supabase';
import { formatDateTime } from '../lib/formatters';
import { createContactQueries } from '../services/contactQueries';
import useContactResource from '../hooks/useContactResource';
import { opportunityPath } from '../routing/paths';
import Card from '../components/ui/Card';
import StatusBadge from '../components/ui/StatusBadge';
import { QueryError, PageControls } from '../components/patients/QueryState';
import NotFoundPage from './NotFoundPage';

const SECTIONS = { summary: 'Resumen', opportunities: 'Oportunidades', timeline: 'Timeline', appointments: 'Citas', tasks: 'Trabajo', quotes: 'Presupuestos', notes: 'Notas' };
const TABLES = { timeline: 'lead_events', appointments: 'appointments', tasks: 'tasks', quotes: 'quotes', notes: 'leads' };

function RelatedSection({ queries, clinicId, contactId, section, cursor, change }) {
  const result = useContactResource({ clinicId, contactId, resourceKey: `${section}:${cursor || ''}`,
    tables: ['contacts', 'leads', ...(TABLES[section] && TABLES[section] !== 'leads' ? [TABLES[section]] : [])],
    load: (signal) => section === 'opportunities' ? queries.listOpportunities({ contactId, cursor, signal })
      : queries.listRelated({ contactId, section, cursor, signal }) });
  return <section aria-label={SECTIONS[section]} className="space-y-3">
    <h2 className="text-lg font-bold">{SECTIONS[section]}</h2>
    {result.error ? <QueryError error={result.error} retry={result.refresh} /> : null}
    {result.loading ? <p role="status">Cargando…</p> : null}
    {result.data?.rows.map((row) => section === 'opportunities' ? <Opportunity key={row.id} contactId={contactId} lead={row} />
      : <Card key={row.id} className="space-y-2 p-4">
        <h3 className="font-semibold">{row.title || row.treatment_scheduled || row.treatment || SECTIONS[section]}</h3>
        {row.status ? <StatusBadge value={row.status} /> : null}
        <p className="whitespace-pre-wrap break-words text-sm">{row.notes || row.description || (section === 'notes' ? 'Sin notas comerciales.' : '')}</p>
        <p className="text-sm text-textMuted">{row.appointment_date ? `${row.appointment_date} · ${row.appointment_time || ''}` : formatDateTime(row.due_at || row.issued_at || row.created_at)}</p>
        {row.amount != null ? <p>{row.amount} {row.currency}</p> : null}
        {row.lead_id ? <Link className="inline-flex min-h-11 items-center font-semibold text-mint" to={opportunityPath(contactId, row.lead_id)}>Abrir oportunidad</Link> : null}
      </Card>)}
    {!result.loading && !result.error && !result.data?.rows.length ? <p>No hay registros en esta sección.</p> : null}
    <PageControls nextCursor={result.data?.nextCursor} loading={result.loading} onFirst={() => change(null)} onNext={() => change(result.data.nextCursor)} />
  </section>;
}

function Opportunity({ contactId, lead }) {
  return <Card><Link className="block rounded-xl p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint hover:bg-elevated" to={opportunityPath(contactId, lead.id)}>
    <h3 className="font-bold">{lead.treatment || 'Tratamiento por definir'}</h3>
    <div className="my-2"><StatusBadge value={lead.status} /></div>
    <p className="text-sm">{lead.next_action || 'Sin próxima acción'}</p>
    {lead.next_followup_at ? <p className="text-sm text-textMuted">{formatDateTime(lead.next_followup_at)}</p> : null}
  </Link></Card>;
}

export default function PatientPage({ profile }) {
  const { contactId } = useParams();
  const [params, setParams] = useSearchParams();
  const section = params.get('section') || 'summary';
  const cursor = params.get('cursor');
  const queries = useMemo(() => createContactQueries(supabase, profile.clinic_id), [profile.clinic_id]);
  const result = useContactResource({ clinicId: profile.clinic_id, contactId, resourceKey: 'header', load: (signal) => queries.getContact360(contactId, { signal }) });
  if (result.error) return <QueryError error={result.error} retry={result.refresh} />;
  if (!result.data && result.loading) return <p role="status">Cargando paciente…</p>;
  if (!result.data) return <NotFoundPage entity="Paciente" />;
  const { contact, opportunities } = result.data;
  const change = (nextSection, nextCursor = null) => {
    const next = new URLSearchParams();
    if (nextSection !== 'summary') next.set('section', nextSection);
    if (nextCursor) next.set('cursor', nextCursor);
    setParams(next);
  };
  return <section className="mx-auto max-w-5xl space-y-4">
    <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-mint" to="/pacientes">Volver a pacientes</Link>
    <Card className="space-y-3 p-5 sm:p-6">
      <h1 className="break-words text-2xl font-bold">{contact.name}</h1>
      <p>{contact.phone_plus || contact.phone || 'Sin teléfono'}</p>
      <div className="grid gap-3 text-sm sm:grid-cols-2"><p>Responsable: {contact.responsible_name || 'Sin responsable'}</p><p>{contact.active_opportunity_count} oportunidades activas</p>
        <p>Último contacto: {contact.last_contact_at ? formatDateTime(contact.last_contact_at) : 'Sin registrar'}</p>
        <p>Próxima acción: {contact.next_action || 'Sin definir'}{contact.next_followup_at ? ` · ${formatDateTime(contact.next_followup_at)}` : ''}</p></div>
    </Card>
    <nav aria-label="Secciones del paciente" className="flex flex-wrap gap-2">
      {Object.entries(SECTIONS).map(([key, label]) => <button type="button" key={key} aria-current={section === key ? 'page' : undefined} onClick={() => change(key)} className={`min-h-11 rounded-xl px-3 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint ${section === key ? 'bg-mint text-inverse' : 'bg-card text-textSoft'}`}>{label}</button>)}
    </nav>
    {section === 'summary' ? <section className="space-y-3"><h2 className="text-lg font-bold">Oportunidades ({contact.opportunity_count})</h2>
      <div className="grid gap-3 sm:grid-cols-2">{opportunities.rows.map((lead) => <Opportunity key={lead.id} contactId={contactId} lead={lead} />)}</div>
      {!opportunities.rows.length ? <p>Este paciente todavía no tiene oportunidades.</p> : null}
      {opportunities.nextCursor ? <button type="button" className="min-h-11 font-semibold text-mint" onClick={() => change('opportunities')}>Ver todas las oportunidades</button> : null}
    </section> : SECTIONS[section] ? <RelatedSection key={`${contactId}:${section}`} queries={queries} clinicId={profile.clinic_id} contactId={contactId} section={section} cursor={cursor} change={(nextCursor) => change(section, nextCursor)} /> : <NotFoundPage entity="Sección" />}
  </section>;
}
