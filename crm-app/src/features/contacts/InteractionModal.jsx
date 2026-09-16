import { useMemo, useState } from 'react';
import { MessageSquareText } from 'lucide-react';
import { addDaysAsuncion, fromDatetimeLocalAsuncion, toDatetimeLocalAsuncion } from '../../lib/formatters';
import { Field, Select, TextArea } from '../../components/crm/CrmPrimitives';
import { ModalActions, ModalHeader } from '../../components/modals/ModalParts';
import ModalShell from '../../components/ui/ModalShell';

const CHANNELS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'call', label: 'Llamada' },
  { value: 'email', label: 'Email' },
  { value: 'in_person', label: 'Contacto presencial' },
  { value: 'note', label: 'Nota administrativa' },
];

const OUTCOMES = {
  whatsapp: [{ value: 'sent', label: 'Mensaje enviado' }, { value: 'responded', label: 'Paciente respondió' }, { value: 'no_response', label: 'No respondió' }],
  call: [{ value: 'completed', label: 'Llamada realizada' }, { value: 'responded', label: 'Paciente respondió' }, { value: 'no_response', label: 'No respondió' }],
  email: [{ value: 'sent', label: 'Email enviado' }, { value: 'responded', label: 'Paciente respondió' }, { value: 'no_response', label: 'No respondió' }],
  in_person: [{ value: 'completed', label: 'Contacto realizado' }, { value: 'responded', label: 'Paciente respondió' }],
  note: [{ value: 'note', label: 'Nota registrada' }],
};

export default function InteractionModal({ contact, opportunities, assignees, canAssign, saving, onClose, onSubmit }) {
  const available = useMemo(() => opportunities.filter((item) => !item.is_archived), [opportunities]);
  const initialOpportunity = available[0] || opportunities[0];
  const [form, setForm] = useState({
    opportunityId: initialOpportunity?.id || '',
    channel: 'whatsapp',
    outcome: 'sent',
    note: '',
    scheduleNext: false,
    nextAction: 'Hacer seguimiento',
    nextFollowupAt: toDatetimeLocalAsuncion(addDaysAsuncion(1, 9)),
    assignedTo: initialOpportunity?.assigned_to || '',
  });
  const [error, setError] = useState('');

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function changeChannel(channel) {
    setForm((current) => ({ ...current, channel, outcome: OUTCOMES[channel][0].value }));
  }

  async function submit(event) {
    event.preventDefault();
    if (!form.opportunityId) return setError('Elegí la oportunidad relacionada.');
    if (form.channel === 'note' && !form.note.trim()) return setError('Escribí la nota administrativa.');
    if (form.scheduleNext && (!form.nextAction.trim() || !form.nextFollowupAt)) return setError('Completá la próxima acción y su fecha.');
    const nextFollowupAt = form.scheduleNext ? fromDatetimeLocalAsuncion(form.nextFollowupAt) : null;
    if (nextFollowupAt && new Date(nextFollowupAt) < new Date(Date.now() - 5 * 60_000)) return setError('La próxima acción no puede quedar en el pasado.');
    setError('');
    try {
      await onSubmit({
        contactId: contact.id,
        opportunityId: form.opportunityId,
        channel: form.channel,
        outcome: form.outcome,
        note: form.note,
        nextAction: form.scheduleNext ? form.nextAction : '',
        nextFollowupAt,
        assignedTo: canAssign ? form.assignedTo || null : null,
      });
    } catch (submitError) {
      setError(submitError.message || 'No se pudo registrar la interacción.');
    }
  }

  return <ModalShell className="max-w-2xl p-4 sm:p-6" onClose={onClose} closeDisabled={saving} titleId="interaction-title" descriptionId="interaction-description" onSubmit={submit}>
    <ModalHeader title="Registrar interacción" subtitle={contact.name} onClose={onClose} disabled={saving} titleId="interaction-title" />
    <p id="interaction-description" className="mb-5 text-sm leading-6 text-textMuted">Dejá una evidencia breve y prepará el próximo paso cuando corresponda. No registres información clínica.</p>
    {error ? <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
    <div className="grid gap-4 sm:grid-cols-2">
      <Select label="Oportunidad" value={form.opportunityId} onChange={(value) => {
        const opportunity = opportunities.find((item) => item.id === value);
        setForm((current) => ({ ...current, opportunityId: value, assignedTo: opportunity?.assigned_to || current.assignedTo }));
      }} options={opportunities.map((item) => ({ value: item.id, label: item.treatment || 'Tratamiento por definir' }))} disabled={saving} />
      <Select label="Tipo" value={form.channel} onChange={changeChannel} options={CHANNELS} disabled={saving} />
      <Select label="Resultado" value={form.outcome} onChange={(value) => update('outcome', value)} options={OUTCOMES[form.channel]} disabled={saving} />
      {canAssign ? <Select label="Responsable" value={form.assignedTo} onChange={(value) => update('assignedTo', value)} options={assignees.map((item) => ({ value: item.id, label: item.full_name }))} placeholder="Sin cambiar" disabled={saving} /> : null}
      <TextArea label="Nota breve (opcional)" value={form.note} onChange={(value) => update('note', value)} maxLength={2000} disabled={saving} className="sm:col-span-2" placeholder="Contexto administrativo útil, sin información clínica sensible." />
    </div>
    <label className="mt-4 flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-soft px-3 text-sm font-semibold text-textSoft">
      <input type="checkbox" checked={form.scheduleNext} onChange={(event) => update('scheduleNext', event.target.checked)} disabled={saving} />
      Dejar próxima acción
    </label>
    {form.scheduleNext ? <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <Field label="Próxima acción" value={form.nextAction} onChange={(value) => update('nextAction', value)} maxLength={160} disabled={saving} />
      <Field label="Fecha y hora" type="datetime-local" value={form.nextFollowupAt} onChange={(value) => update('nextFollowupAt', value)} disabled={saving} />
    </div> : null}
    <div className="mt-4 flex items-start gap-3 rounded-xl border border-mint/20 bg-mint/[0.06] p-3 text-sm text-textSoft"><MessageSquareText className="mt-0.5 h-4 w-4 shrink-0 text-mint" /><span>La actividad quedará en el historial de la persona y de la oportunidad elegida.</span></div>
    <ModalActions saving={saving} onClose={onClose} submitLabel="Guardar interacción" />
  </ModalShell>;
}
