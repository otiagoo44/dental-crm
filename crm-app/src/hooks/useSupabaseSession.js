import { useEffect, useState } from 'react';
import { readPasswordRecoveryRedirect } from '../lib/authRecovery';
import { humanizeCrmError } from '../lib/errors';
import { supabase } from '../lib/supabase';

export default function useSupabaseSession() {
  const [initialRecovery] = useState(() => readPasswordRecoveryRedirect());
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [passwordRecovery, setPasswordRecovery] = useState(initialRecovery.isRecoveryRoute);
  const [passwordRecoveryError, setPasswordRecoveryError] = useState(initialRecovery.recoveryError);

  useEffect(() => {
    let active = true;

    if (!supabase) {
      setLoading(false);
      return undefined;
    }

    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError) {
        console.error('Error restoring Supabase session', sessionError);
        if (active) setError(humanizeCrmError(sessionError, 'No pudimos recuperar tu sesión. Volvé a ingresar.'));
      }

      if (active) {
        setSession(data.session);
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
        setPasswordRecoveryError('');
      }
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return {
    session,
    loading,
    error,
    passwordRecovery,
    passwordRecoveryError,
    completePasswordRecovery: () => {
      setPasswordRecovery(false);
      setPasswordRecoveryError('');
    },
  };
}
