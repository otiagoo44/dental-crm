import { useId, useState } from 'react';
import { useSearchParams } from 'react-router';
import Button from '../../components/ui/Button';
import ModalShell from '../../components/ui/ModalShell';
import useSavedViews, { savedViewService } from './useSavedViews';
import { savedViewError } from './savedViewService';
import { snapshotView, viewSearchParams } from './viewState';

export default function SavedViews({ entity, profile }) {
  const [params, setParams] = useSearchParams();
  const { rows, loading, error, refresh } = useSavedViews(profile, entity);
  const [editor, setEditor] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [failure, setFailure] = useState('');
  const titleId = useId();
  const canAdmin = ['owner', 'admin'].includes(profile?.role);
  const open = (view = null, remove = false) => {
    setFailure(''); setNotice('');
    try { setEditor(view ? { ...view, remove } : { name: '', visibility: 'private', ...snapshotView(entity, params) }); }
    catch (e) { setFailure(e.message); }
  };
  const apply = (view) => { try { setParams(viewSearchParams(entity, view)); setFailure(''); } catch (e) { setFailure(e.message); } };
  const save = async (event) => {
    event.preventDefault(); if (busy) return; setBusy(true); setFailure('');
    try {
      if (editor.remove) await savedViewService.remove(editor.id);
      else if (editor.id) await savedViewService.update(editor);
      else await savedViewService.create(entity, editor);
      setNotice(editor.remove ? 'Vista eliminada.' : 'Vista guardada.'); setEditor(null); refresh();
    } catch (e) { setFailure(savedViewError(e)); } finally { setBusy(false); }
  };
  return <section aria-label="Vistas guardadas" className="space-y-3 rounded-xl border border-slate-200 bg-card p-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Mis vistas y equipo</h2><Button type="button" variant="secondary" onClick={() => open()}>Guardar vista</Button></div>
    {loading ? <p role="status" className="text-sm text-textMuted">Cargando vistas…</p> : null}
    {error ? <div role="alert" className="text-sm">{error} <button type="button" className="min-h-11 underline" onClick={refresh}>Reintentar vistas</button></div> : null}
    {!loading && !error && !rows.length ? <p className="text-sm text-textMuted">Guardá tus filtros actuales para volver a usarlos.</p> : null}
    <div className="flex flex-wrap gap-2">{rows.map((view) => {
      const editable = view.visibility === 'private' ? view.user_id === profile?.id : canAdmin;
      return <div key={view.id} className="flex max-w-full items-center gap-1 rounded-lg border border-slate-200 px-2">
        <button type="button" onClick={() => apply(view)} className="min-h-11 min-w-0 break-words px-1 text-left text-sm font-semibold">{view.name}<span className="block text-xs font-normal text-textMuted">{view.visibility === 'team' ? 'Equipo' : 'Privada'}</span></button>
        {editable ? <><button type="button" aria-label={`Renombrar ${view.name}`} onClick={() => open(view)} className="min-h-11 px-2 text-xs underline">Editar</button><button type="button" aria-label={`Eliminar ${view.name}`} onClick={() => open(view, true)} className="min-h-11 px-2 text-xs text-danger">Eliminar</button></> : null}
      </div>;
    })}</div>
    {notice ? <p role="status" className="text-sm">{notice}</p> : null}
    {failure && !editor ? <p role="alert">{failure}</p> : null}
    {editor ? <ModalShell titleId={titleId} onSubmit={save} onClose={() => setEditor(null)} closeDisabled={busy} className="max-w-md space-y-4 rounded-xl p-5">
      <h2 id={titleId} className="text-xl font-bold">{editor.remove ? 'Eliminar vista' : editor.id ? 'Editar vista' : 'Guardar vista'}</h2>
      {editor.remove ? <p>¿Eliminar «{editor.name}»? Los pacientes y sus datos se conservan.</p> : <>
        <label className="block space-y-2">Nombre de la vista<input data-autofocus required maxLength={80} value={editor.name} onChange={(e) => setEditor({ ...editor, name: e.target.value })} className="min-h-11 w-full rounded-lg border border-slate-200 bg-input px-3" /></label>
        {canAdmin && (!editor.id || editor.user_id === profile?.id) ? <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={editor.visibility === 'team'} onChange={(e) => setEditor({ ...editor, visibility: e.target.checked ? 'team' : 'private' })} />Compartir con equipo</label> : null}
        <p className="text-sm text-textMuted">{editor.visibility === 'team' ? 'Visible para la clínica. Owner y administradores pueden editarla.' : 'Sólo vos podés ver y editar esta vista.'}</p>
      </>}
      {failure ? <p role="alert">{failure}</p> : null}
      <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" disabled={busy} onClick={() => setEditor(null)}>Cancelar</Button><Button type="submit" disabled={busy || (!editor.remove && !editor.name.trim())}>{busy ? 'Guardando…' : editor.remove ? 'Eliminar vista' : 'Guardar'}</Button></div>
    </ModalShell> : null}
  </section>;
}
