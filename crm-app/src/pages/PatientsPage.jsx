import { Link, useSearchParams } from 'react-router';
import { useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { formatDateTime } from '../lib/formatters';
import { createContactQueries } from '../services/contactQueries';
import useContactResource from '../hooks/useContactResource';
import { patientPath } from '../routing/paths';
import Button from '../components/ui/Button';
import { QueryError, PageControls } from '../components/patients/QueryState';

export default function PatientsPage({ profile, onCreate }) {
  const [params, setParams] = useSearchParams();
  const search = params.get('q') || '';
  const filter = params.get('view') || 'all';
  const cursor = params.get('cursor');
  const queries = useMemo(() => createContactQueries(supabase, profile.clinic_id), [profile.clinic_id]);
  const result = useContactResource({ clinicId: profile.clinic_id, resourceKey: params.toString(),
    load: (signal) => queries.listContacts({ search, filter, cursor, signal }) });
  const change = (patch) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) value ? next.set(key, value) : next.delete(key);
    setParams(next);
  };
  return <section className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">Pacientes</h1>
      <p className="text-textMuted">Una persona, todas sus oportunidades de tratamiento.</p></div><Button onClick={onCreate}>Nueva consulta</Button></header>
    <form key={search} className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); change({ q: new FormData(event.currentTarget).get('q'), cursor: null }); }}>
      <label className="min-w-0 flex-1 space-y-1">Nombre o teléfono<input name="q" aria-label="Buscar pacientes" defaultValue={search} maxLength={160} className="min-h-11 w-full rounded-xl border border-slate-200 bg-card px-3" /></label>
      <Button type="submit">Buscar</Button>
      <label className="space-y-1">Mostrar<select aria-label="Filtrar pacientes" value={filter} onChange={(e) => change({ view: e.target.value, cursor: null })} className="ml-2 min-h-11 rounded-xl border border-slate-200 bg-card px-3">
        <option value="all">Todos</option><option value="active">Con oportunidades activas</option><option value="unassigned">Sin responsable</option>
      </select></label>
    </form>
    {result.error ? <QueryError error={result.error} retry={result.refresh} /> : null}
    {result.loading ? <p role="status">Cargando pacientes…</p> : null}
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-card" aria-busy={result.loading}>
      <div className="hidden grid-cols-[2fr_1fr_2fr_1fr] gap-4 border-b border-slate-200 px-5 py-3 text-sm font-semibold md:grid"><span>Paciente</span><span>Oportunidades activas</span><span>Próxima acción</span><span>Responsable</span></div>
      {result.data?.rows.map((contact) => <Link key={contact.id} to={patientPath(contact.id)} className="grid gap-3 border-b border-slate-200 p-5 last:border-0 hover:bg-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-mint md:grid-cols-[2fr_1fr_2fr_1fr]">
        <div className="min-w-0"><h2 className="break-words font-bold">{contact.name}</h2><p className="text-sm text-textMuted">{contact.phone_plus || contact.phone || 'Sin teléfono'}</p><p className="text-xs text-textMuted">Último contacto: {contact.last_contact_at ? formatDateTime(contact.last_contact_at) : 'Sin registrar'}</p></div>
        <p className="text-sm"><span className="md:hidden">Oportunidades activas: </span>{contact.active_opportunity_count}</p>
        <div className="text-sm"><p>{contact.next_action || 'Sin próxima acción'}</p>{contact.next_followup_at ? <p className="text-textMuted">{formatDateTime(contact.next_followup_at)}</p> : null}</div>
        <p className="text-sm">{contact.responsible_name || 'Sin responsable'}</p>
      </Link>)}
      {!result.loading && !result.error && !result.data?.rows.length ? <p className="p-6">No hay pacientes para esta búsqueda.</p> : null}
    </div>
    <PageControls nextCursor={result.data?.nextCursor} loading={result.loading} onFirst={() => change({ cursor: null })} onNext={() => change({ cursor: result.data.nextCursor })} />
  </section>;
}
