import { useEffect, useMemo, useState } from 'react';
import { CalendarPlus, ChevronDown, MessageCircle, MessageSquarePlus, Plus } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router';
import { supabase } from '../lib/supabase';
import { formatDateTime } from '../lib/formatters';
import { createContactQueries } from '../services/contactQueries';
import useContactResource from '../hooks/useContactResource';
import { opportunityPath } from '../routing/paths';
import InteractionModal from '../features/contacts/InteractionModal';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import StatusBadge from '../components/ui/StatusBadge';
import { QueryError, PageControls } from '../components/patients/QueryState';
import NotFoundPage from './NotFoundPage';

const PRIMARY_SECTIONS = { summary: 'Resumen', activity: 'Actividad', opportunities: 'Oportunidades' };
const MORE_SECTIONS = { appointments: 'Citas', tasks: 'Trabajo', quotes: 'Presupuestos', notes: 'Notas' };
const SECTIONS = { ...PRIMARY_SECTIONS, ...MORE_SECTIONS };
const TABLES = { activity: 'lead_events', appointments: 'appointments', tasks: 'tasks', quotes: 'quotes', notes: 'leads' };

function RelatedSection({ queries, clinicId, contactId, section, cursor, change, revision }) {
  const querySection = section === 'activity' ? 'timeline' : section;
  const table = TABLES[section];
  const result = useContactResource({
    clinicId,
    contactId,
    resourceKey: `${querySection}:${cursor || ''}:${revision}`,
    tables: ['contacts', 'leads', ...(table && table !== 'leads' ? [table] : [])],
    load: (signal) => section === 'opportunities'
      ? queries.listOpportunities({ contactId, cursor, signal })
      : queries.listRelated({ contactId, section: querySection, cursor, signal }),
  });
  return <section aria-label={SECTIONS[section]} className="space-y-3">
    <h2 className="text-lg font-bold">{SECTIONS[section]}</h2>
    {result.error ? <QueryError error={result.error} retry={result.refresh} /> : null}
    {result.loading ? <p role="status">Cargando…</p> : null}
    {result.data?.rows.map((row) => section === 'opportunities'
      ? <Opportunity key={row.id} contactId={contactId} lead={row} />
      : section === 'activity'
        ? <TimelineItem key={row.id} contactId={contactId} item={row} />
        : <RelatedCard key={row.id} contactId={contactId} section={section} row={row} />)}
    {!result.loading && !result.error && !result.data?.rows.length ? <p className="rounded-xl border border-dashed border-slate-200 p-5 text-sm text-textMuted">No hay registros en esta sección.</p> : null}
    <PageControls nextCursor={result.data?.nextCursor} loading={result.loading} onFirst={() => change(null)} onNext={() => change(result.data.nextCursor)} />
  </section>;
}

function TimelineItem({ contactId, item }) {
  return <article className="rounded-xl border border-slate-200 bg-card p-4">
    <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
      <div><h3 className="font-semibold text-cream">{item.title}</h3><p className="mt-1 text-xs text-textMuted">{item.actor_name} · {formatDateTime(item.occurred_at)}</p></div>
      <span className="text-xs font-semibold text-textMuted">{item.opportunity_label}</span>
    </div>
    {item.description ? <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-textSoft">{item.description}</p> : null}
    <Link className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-mint" to={opportunityPath(contactId, item.opportunity_id)}>Abrir oportunidad</Link>
  </article>;
}

function RelatedCard({ contactId, section, row }) {
  return <Card className="space-y-2 p-4">
    <h3 className="font-semibold">{row.title || row.treatment_scheduled || row.treatment || SECTIONS[section]}</h3>
    {row.status ? <StatusBadge value={row.status} /> : null}
    <p className="whitespace-pre-wrap break-words text-sm">{row.notes || row.description || (section === 'notes' ? 'Sin resumen comercial.' : '')}</p>
    <p className="text-sm text-textMuted">{row.appointment_date ? `${row.appointment_date} · ${row.appointment_time || ''}` : formatDateTime(row.due_at || row.issued_at || row.created_at)}</p>
    {row.amount != null ? <p>{row.amount} {row.currency}</p> : null}
    {row.lead_id ? <Link className="inline-flex min-h-11 items-center font-semibold text-mint" to={opportunityPath(contactId, row.lead_id)}>Abrir oportunidad</Link> : null}
  </Card>;
}

function Opportunity({ contactId, lead }) {
  return <Card><Link className="block rounded-xl p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint hover:bg-elevated" to={opportunityPath(contactId, lead.id)}>
    <h3 className="font-bold">{lead.treatment || 'Tratamiento por definir'}</h3>
    <div className="my-2"><StatusBadge value={lead.status} /></div>
    <p className="text-sm">{lead.next_action || 'Sin próxima acción'}</p>
    {lead.next_followup_at ? <p className="text-sm text-textMuted">{formatDateTime(lead.next_followup_at)}</p> : null}
  </Link></Card>;
}

function Summary({ contact, opportunities, contactId }) {
  return <section className="space-y-4" aria-label="Resumen operativo">
    <div className="grid gap-3 sm:grid-cols-2">
      <SummaryCard label="Próxima acción" value={contact.next_action || 'Sin definir'} detail={contact.next_followup_at ? formatDateTime(contact.next_followup_at) : 'Sin fecha'} />
      <SummaryCard label="Próxima cita" value={contact.next_appointment_treatment || 'Sin cita próxima'} detail={contact.next_appointment_at ? formatDateTime(contact.next_appointment_at) : 'Agendá desde una oportunidad'} />
      <SummaryCard label="Última interacción" value={contact.last_interaction_title || 'Sin interacciones'} detail={contact.last_interaction_at ? formatDateTime(contact.last_interaction_at) : 'Registrá el primer contacto'} />
      <SummaryCard label="Responsable" value={contact.responsible_name || 'Sin responsable'} detail={`${contact.active_opportunity_count} oportunidades activas`} />
    </div>
    <div className="space-y-3"><h2 className="text-lg font-bold">Oportunidades ({contact.opportunity_count})</h2>
      <div className="grid gap-3 sm:grid-cols-2">{opportunities.rows.slice(0, 4).map((lead) => <Opportunity key={lead.id} contactId={contactId} lead={lead} />)}</div>
      {!opportunities.rows.length ? <p>Este paciente todavía no tiene oportunidades.</p> : null}
    </div>
  </section>;
}

function SummaryCard({ label, value, detail }) {
  return <div className="rounded-xl border border-slate-200 bg-card p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-textMuted">{label}</p><p className="mt-2 font-bold text-cream">{value}</p><p className="mt-1 text-sm text-textMuted">{detail}</p></div>;
}

function whatsappHref(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : '';
}

export default function PatientPage({ profile }) {
  const { contactId } = useParams();
  const [params, setParams] = useSearchParams();
  const section = params.get('section') || 'summary';
  const cursor = params.get('cursor');
  const [interactionOpen, setInteractionOpen] = useState(false);
  const [interactionSaving, setInteractionSaving] = useState(false);
  const [assignees, setAssignees] = useState([]);
  const [revision, setRevision] = useState(0);
  const queries = useMemo(() => createContactQueries(supabase, profile.clinic_id), [profile.clinic_id]);
  const result = useContactResource({
    clinicId: profile.clinic_id,
    contactId,
    resourceKey: `header:${revision}`,
    tables: ['contacts', 'leads', 'appointments', 'lead_events'],
    load: (signal) => queries.getContact360(contactId, { signal }),
  });
  const canAssign = ['owner', 'admin'].includes(profile.role);

  useEffect(() => {
    if (!interactionOpen || !canAssign) return undefined;
    const controller = new AbortController();
    queries.listAssignees({ signal: controller.signal }).then(setAssignees).catch(() => setAssignees([]));
    return () => controller.abort();
  }, [interactionOpen, canAssign, queries]);

  if (result.error) return <QueryError error={result.error} retry={result.refresh} />;
  if (!result.data && result.loading) return <p role="status">Cargando paciente…</p>;
  if (!result.data) return <NotFoundPage entity="Paciente" />;
  const { contact, opportunities } = result.data;
  const primaryOpportunity = opportunities.rows.find((item) => !item.is_archived) || opportunities.rows[0];
  const whatsApp = whatsappHref(contact.phone_plus || contact.phone);
  const change = (nextSection, nextCursor = null) => {
    const next = new URLSearchParams();
    if (nextSection !== 'summary') next.set('section', nextSection);
    if (nextCursor) next.set('cursor', nextCursor);
    setParams(next);
  };

  async function saveInteraction(payload) {
    setInteractionSaving(true);
    try {
      await queries.registerInteraction(payload);
      setInteractionOpen(false);
      setRevision((value) => value + 1);
      change('activity');
    } finally {
      setInteractionSaving(false);
    }
  }

  return <section className="mx-auto max-w-5xl space-y-4">
    <Link className="inline-flex min-h-11 items-center text-sm font-semibold text-mint" to="/pacientes">Volver a pacientes</Link>
    <Card className="space-y-4 p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0"><h1 className="break-words text-2xl font-bold">{contact.name}</h1><p className="mt-1">{contact.phone_plus || contact.phone || 'Sin teléfono'}</p><p className="mt-2 text-sm text-textMuted">Responsable: {contact.responsible_name || 'Sin responsable'} · {contact.active_opportunity_count} oportunidades activas</p></div>
        <div className="flex flex-wrap gap-2">
          {whatsApp ? <a className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-emerald-300/30 bg-emerald-400/10 px-3 text-sm font-semibold text-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint" href={whatsApp} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" />WhatsApp</a> : null}
          <Button type="button" onClick={() => setInteractionOpen(true)}><MessageSquarePlus className="h-4 w-4" />Registrar interacción</Button>
          <details className="relative">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg border border-slate-200 bg-card px-3 text-sm font-semibold text-textSoft"><Plus className="h-4 w-4" />Más acciones<ChevronDown className="h-4 w-4" /></summary>
            <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-card p-2 shadow-xl">
              <Link className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-textSoft hover:bg-elevated" to="/oportunidades?new=1" state={{ contactPrefill: contact }}><Plus className="h-4 w-4" />Crear oportunidad</Link>
              {primaryOpportunity ? <Link className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-textSoft hover:bg-elevated" to={opportunityPath(contactId, primaryOpportunity.id)} state={{ action: 'schedule' }}><CalendarPlus className="h-4 w-4" />Agendar</Link> : null}
            </div>
          </details>
        </div>
      </div>
    </Card>
    <nav aria-label="Secciones del paciente" className="flex flex-wrap gap-2">
      {Object.entries(PRIMARY_SECTIONS).map(([key, label]) => <button type="button" key={key} aria-current={section === key ? 'page' : undefined} onClick={() => change(key)} className={`min-h-11 rounded-xl px-3 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint ${section === key ? 'bg-mint text-inverse' : 'bg-card text-textSoft'}`}>{label}</button>)}
      <details className="relative"><summary className={`flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-xl px-3 font-semibold ${MORE_SECTIONS[section] ? 'bg-mint text-inverse' : 'bg-card text-textSoft'}`}>Más<ChevronDown className="h-4 w-4" /></summary><div className="absolute left-0 z-10 mt-2 w-48 rounded-xl border border-slate-200 bg-card p-2 shadow-xl">{Object.entries(MORE_SECTIONS).map(([key, label]) => <button type="button" key={key} onClick={() => change(key)} className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm font-semibold text-textSoft hover:bg-elevated">{label}</button>)}</div></details>
    </nav>
    {section === 'summary' ? <Summary contact={contact} opportunities={opportunities} contactId={contactId} /> : SECTIONS[section] ? <RelatedSection key={`${contactId}:${section}:${revision}`} queries={queries} clinicId={profile.clinic_id} contactId={contactId} section={section} cursor={cursor} revision={revision} change={(nextCursor) => change(section, nextCursor)} /> : <NotFoundPage entity="Sección" />}
    {interactionOpen ? <InteractionModal contact={contact} opportunities={opportunities.rows} assignees={assignees} canAssign={canAssign} saving={interactionSaving} onClose={() => setInteractionOpen(false)} onSubmit={saveInteraction} /> : null}
  </section>;
}
