import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { createSavedViewService, savedViewError } from './savedViewService';

export const savedViewService = createSavedViewService(supabase);
export default function useSavedViews(profile, entity) {
  const key = `${profile?.clinic_id}:${profile?.id}:${entity}`;
  const [state, setState] = useState({ key: '', rows: [], loading: true, error: '' });
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((n) => n + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    setState({ key, rows: [], loading: true, error: '' });
    savedViewService.list(entity, controller.signal).then((rows) => {
      if (!controller.signal.aborted) setState({ key, rows: rows || [], loading: false, error: '' });
    }).catch((error) => { if (!controller.signal.aborted) setState({ key, rows: [], loading: false, error: savedViewError(error) }); });
    window.addEventListener('focus', refresh);
    return () => { controller.abort(); window.removeEventListener('focus', refresh); };
  }, [key, entity, revision, refresh]);
  return { ...(state.key === key ? state : { rows: [], loading: true, error: '' }), refresh };
}
