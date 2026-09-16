import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import PageHeader from '../../components/ui/PageHeader';
import useWorkResource from './useWorkResource';
import { normalizeWorkView, WORK_VIEWS } from './workQueries';

const TYPE_LABEL = { initial_contact:'Nueva consulta',followup:'Seguimiento',confirm_appointment:'Confirmar cita',attendance:'Registrar asistencia',no_show_recovery:'Recuperar inasistencia',quote_followup:'Presupuesto pendiente',reactivation:'Reactivación',manual_task:'Tarea manual',assign_owner:'Sin responsable' };

function relativeTime(value) {
  if (!value) return 'Sin fecha';
  const minutes = Math.round((new Date(value).getTime() - Date.now()) / 60000);
  if (minutes < -60) return `Atrasado ${Math.max(1, Math.round(-minutes / 1440))} d`;
  if (minutes < 0) return `Atrasado ${-minutes} min`;
  if (minutes < 60) return `En ${minutes} min`;
  return new Intl.DateTimeFormat('es-PY', { dateStyle:'short', timeStyle:'short' }).format(new Date(value));
}

export default function WorkPage({ profile, canAdmin, onContact, onOutcome, onConfirm, onComplete }) {
  const [params, setParams] = useSearchParams();
  const view = normalizeWorkView(params.get('view') || 'my-work', canAdmin);
  const cursor = params.get('cursor');
  const query = useMemo(() => ({ view, cursor }), [view, cursor]);
  const { data, loading, error } = useWorkResource({ clinicId: profile?.clinic_id, query });
  const visibleViews = WORK_VIEWS.filter(([key]) => key !== 'team' || canAdmin);
  const action = async (item) => {
    const lead = { id:item.opportunity_id, contact_id:item.contact_id, name:item.patient_name, phone:item.patient_phone, phone_plus:item.patient_phone, treatment:item.treatment, status:item.status };
    if (item.work_type === 'initial_contact') return onContact(lead);
    if (item.source_type === 'appointment' && item.work_type === 'confirm_appointment') return onConfirm(item.source_id);
    if (item.source_type === 'task' && item.work_type === 'manual_task') return onComplete(item.source_id);
    return onOutcome({ lead, action: { actionType:item.work_type, taskId:item.source_type === 'task' ? item.source_id : null, appointmentId:item.source_type === 'appointment' ? item.source_id : null, quoteId:item.source_type === 'quote' ? item.source_id : null } });
  };
  return <section className="space-y-5">
    <PageHeader eyebrow="Operación diaria" title="Trabajo" subtitle="Pacientes que necesitan atención y el próximo paso recomendado." />
    <nav className="flex gap-2 overflow-x-auto pb-2" aria-label="Vistas de trabajo">
      {visibleViews.map(([key,label]) => <button key={key} type="button" className={`min-h-11 shrink-0 rounded-lg border px-3 text-sm font-semibold ${view===key?'border-mint bg-mint/10 text-cream':'border-slate-200 text-textMuted'}`} aria-pressed={view===key} onClick={() => setParams(key==='my-work'?{}:{view:key})}>{label}</button>)}
    </nav>
    {error ? <p role="alert" className="rounded-lg border border-danger/30 p-4 text-danger">{error}</p> : null}
    {loading && !data ? <p role="status" className="p-4 text-textMuted">Cargando trabajo…</p> : null}
    {data?.items?.length ? <div className="overflow-hidden rounded-xl border border-slate-200 bg-card">
      <div className="hidden grid-cols-[1.3fr_1fr_1.4fr_.9fr_1fr_auto] gap-4 border-b border-slate-200 px-4 py-3 text-xs font-bold uppercase text-textFaint lg:grid"><span>Paciente</span><span>Tratamiento</span><span>Motivo</span><span>Cuándo</span><span>Responsable</span><span>Acción</span></div>
      {data.items.map((item) => <article key={item.work_key} className="grid gap-3 border-b border-slate-200 p-4 last:border-0 lg:grid-cols-[1.3fr_1fr_1.4fr_.9fr_1fr_auto] lg:items-center">
        <div><Link className="font-bold text-cream hover:text-mint" to={`/pacientes/${item.contact_id}`}>{item.patient_name}</Link><Link className="mt-1 block text-xs text-textFaint" to={`/pacientes/${item.contact_id}/oportunidades/${item.opportunity_id}`}>Abrir oportunidad</Link></div>
        <p className="text-sm text-textMuted">{item.treatment || 'Sin definir'}</p>
        <div><p className="text-sm font-semibold text-cream">{TYPE_LABEL[item.work_type] || item.title}</p><p className="mt-1 text-xs text-textMuted">{item.reason}</p></div>
        <p className={`text-sm font-semibold ${item.sort_group===0?'text-warning':'text-textMuted'}`}>{relativeTime(item.due_at)}</p>
        <p className="text-sm text-textMuted">{item.assigned_name || 'Sin responsable'}</p>
        <Button type="button" onClick={() => action(item)}>{item.work_type==='initial_contact'?'Contactar':item.work_type==='confirm_appointment'?'Confirmar':item.work_type==='manual_task'?'Completar':'Registrar'}</Button>
      </article>)}
    </div> : !loading ? <EmptyState title="Todo al día" text="No hay pacientes que requieran atención en esta vista." /> : null}
    {data?.nextCursor ? <Button variant="secondary" type="button" onClick={() => setParams({ view, cursor:data.nextCursor })}>Siguiente página</Button> : null}
  </section>;
}
