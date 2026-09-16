import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

// Invalidations fetch authoritative rows; event payloads never overwrite newer state.
// Serial numbers also discard stale HTTP responses, including events during a fetch.
export default function useContactResource({ clinicId, contactId, resourceKey, load, tables = ['contacts', 'leads'] }) {
  const [state, setState] = useState({ key: '', data: null, loading: true, error: '' });
  const [revision, setRevision] = useState(0);
  const loader = useRef(load);
  loader.current = load;
  const tableKey = tables.join(',');
  const key = `${clinicId}:${contactId || ''}:${resourceKey}`;
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    if (!clinicId) return;
    let alive = true;
    let sequence = 0;
    let controller;
    let timer;
    let healthy = false;
    const visible = () => document.visibilityState === 'visible' && navigator.onLine !== false;
    const run = async () => {
      const ticket = ++sequence;
      controller?.abort();
      controller = new AbortController();
      setState((old) => ({ ...old, key, data: old.key === key ? old.data : null, loading: true, error: '' }));
      try {
        const data = await loader.current(controller.signal);
        if (alive && ticket === sequence) setState({ key, data, loading: false, error: '' });
      } catch (error) {
        if (alive && ticket === sequence && !controller.signal.aborted)
          setState({ key, data: null, loading: false, error: error.message || 'No pudimos cargar los pacientes.' });
      }
    };
    const invalidate = (payload) => {
      // UPDATE may move an opportunity away from this contact. With default
      // replica identity the old contact is absent, so conservatively requery.
      const row = payload?.new;
      if (contactId && row?.contact_id && row.contact_id !== contactId
        && (payload?.eventType === 'INSERT' || (payload?.old?.contact_id && payload.old.contact_id !== contactId))) return;
      if (contactId && payload?.table === 'contacts' && row?.id && row.id !== contactId) return;
      ++sequence;
      controller?.abort();
      clearTimeout(timer);
      if (visible()) timer = setTimeout(run, 150);
    };
    void run();
    let channel = supabase.channel(`contact-slice:${clinicId}:${contactId || 'list'}:${resourceKey}`);
    for (const table of tableKey.split(',')) {
      for (const event of ['INSERT', 'UPDATE']) channel = channel.on('postgres_changes', {
        event, schema: 'public', table, filter: `clinic_id=eq.${clinicId}`,
      }, invalidate);
    }
    channel.subscribe((status) => {
      const reconnect = healthy === false && status === 'SUBSCRIBED';
      healthy = status === 'SUBSCRIBED';
      if (reconnect) invalidate();
    });
    const poll = setInterval(() => { if (!healthy && visible()) invalidate(); }, 25_000);
    const recover = () => { if (visible()) invalidate(); };
    window.addEventListener('focus', recover);
    window.addEventListener('online', recover);
    document.addEventListener('visibilitychange', recover);
    return () => {
      alive = false; ++sequence; controller?.abort(); clearTimeout(timer); clearInterval(poll);
      window.removeEventListener('focus', recover); window.removeEventListener('online', recover);
      document.removeEventListener('visibilitychange', recover);
      void supabase.removeChannel(channel);
    };
  }, [key, clinicId, contactId, tableKey, revision]);
  return { ...(state.key === key ? state : { data: null, loading: true, error: '' }), refresh };
}
