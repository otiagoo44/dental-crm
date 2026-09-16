import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { listWorkItems } from './workQueries';

export default function useWorkResource({ clinicId, query }) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const sequence = useRef(0);
  const timer = useRef();
  const load = useCallback(async () => {
    const ticket = ++sequence.current;
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: !current.data, error: '' }));
    try {
      const data = await listWorkItems(supabase, clinicId, { ...query, signal: controller.signal });
      if (ticket === sequence.current) setState({ data, loading: false, error: '' });
    } catch (error) {
      if (ticket === sequence.current && error?.name !== 'AbortError') setState((current) => ({ ...current, loading: false, error: error.message || 'No se pudo cargar Trabajo.' }));
    }
    return () => controller.abort();
  }, [clinicId, query.view, query.cursor, query.assignedTo]);
  useEffect(() => { void load(); return () => { ++sequence.current; clearTimeout(timer.current); }; }, [load]);
  useEffect(() => {
    if (!clinicId) return undefined;
    const invalidate = () => { clearTimeout(timer.current); timer.current = setTimeout(load, 150); };
    const channel = supabase.channel(`work-v2:${clinicId}`);
    for (const table of ['leads', 'tasks', 'appointments', 'quotes']) channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `clinic_id=eq.${clinicId}` }, invalidate);
    channel.subscribe((status) => { if (status === 'SUBSCRIBED') invalidate(); });
    const reconcile = () => { if (!document.hidden) invalidate(); };
    window.addEventListener('focus', reconcile); window.addEventListener('online', reconcile); document.addEventListener('visibilitychange', reconcile);
    return () => { clearTimeout(timer.current); void supabase.removeChannel(channel); window.removeEventListener('focus', reconcile); window.removeEventListener('online', reconcile); document.removeEventListener('visibilitychange', reconcile); };
  }, [clinicId, load]);
  return { ...state, refresh: load };
}
