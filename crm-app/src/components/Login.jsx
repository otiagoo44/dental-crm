import { useState } from 'react';
import { Mail } from 'lucide-react';
import { hasSupabaseConfig, supabase } from '../lib/supabase';
import { publicConfigError } from '../lib/publicConfig';
import { humanizeCrmError } from '../lib/errors';
import PasswordInput from './auth/PasswordInput';

export default function Login({ recoveryMode = false, onRecoveryComplete }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotMode, setForgotMode] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!supabase) {
      setError(publicConfigError || 'La configuración de la CRM no es válida.');
      return;
    }

    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      console.error('Supabase login error', signInError);
      setError(humanizeCrmError(signInError, 'No pudimos iniciar sesión. Revisá tus datos e intentá de nuevo.'));
    }
    setLoading(false);
  }

  async function handleRecoveryRequest(event) {
    event.preventDefault();
    setError('');
    setNotice('');

    if (!supabase) {
      setError(publicConfigError || 'La configuración de la CRM no es válida.');
      return;
    }

    setLoading(true);
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (resetError) console.error('Supabase password recovery error', resetError);
    setNotice('Si existe una cuenta con ese correo, recibirás instrucciones para restablecer tu contraseña.');
    setLoading(false);
  }

  async function handleNewPassword(event) {
    event.preventDefault();
    setError('');
    setNotice('');

    if (password.length < 8) {
      setError('La nueva contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      console.error('Supabase password update error', updateError);
      setError('No pudimos actualizar la contraseña. Solicitá un nuevo enlace e intentá otra vez.');
      setLoading(false);
      return;
    }

    await supabase.auth.signOut();
    window.history.replaceState({}, '', '/');
    onRecoveryComplete?.();
    setLoading(false);
  }

  const title = recoveryMode ? 'Elegí una nueva contraseña' : forgotMode ? 'Recuperar contraseña' : 'Acceso a la clínica';
  const subtitle = recoveryMode
    ? 'Ingresá y confirmá tu nueva contraseña para proteger tu cuenta.'
    : forgotMode
      ? 'Te enviaremos un enlace seguro de recuperación.'
      : 'Sistema anti-pérdida de pacientes. Ingresá para ver las oportunidades que necesitan atención.';

  return (
    <main className="flex min-h-screen items-center justify-center bg-app px-4 py-10 text-cream">
      <section className="modal-enter w-full max-w-md rounded-3xl border border-slate-200 bg-card/95 p-8 shadow-premium backdrop-blur">
        <div className="mb-8">
          <div className="mb-6 h-0.5 w-12 rounded-full bg-mint" />
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-mint">Dental CRM</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-cream">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</p>
        </div>

        {!hasSupabaseConfig ? (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            La configuración de la CRM no es válida. Pedí ayuda al administrador.
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={recoveryMode ? handleNewPassword : forgotMode ? handleRecoveryRequest : handleSubmit}>
          {!recoveryMode ? (
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-slate-700">Email</span>
              <span className="flex items-center gap-3 rounded-xl border border-slate-200 bg-input px-3 py-3 transition hover:border-slate-300 focus-within:border-mint focus-within:ring-4 focus-within:ring-mint/10">
                <Mail className="h-4 w-4 text-mint" aria-hidden="true" />
                <input
                  className="w-full bg-transparent text-cream outline-none placeholder:text-slate-400"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="usuario@clinica.com"
                  autoComplete="email"
                  required
                />
              </span>
            </label>
          ) : null}

          {!forgotMode ? (
            <PasswordInput
              label={recoveryMode ? 'Nueva contraseña' : 'Contraseña'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={recoveryMode ? 'new-password' : 'current-password'}
            />
          ) : null}

          {recoveryMode ? (
            <PasswordInput
              label="Confirmar nueva contraseña"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
            />
          ) : null}

          {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          {notice ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}

          <button
            className="button-primary w-full rounded-xl px-4 py-3 font-bold transition disabled:cursor-not-allowed"
            type="submit"
            disabled={loading || !hasSupabaseConfig}
          >
            {loading ? 'Procesando...' : recoveryMode ? 'Guardar nueva contraseña' : forgotMode ? 'Recuperar contraseña' : 'Ingresar'}
          </button>

          {!recoveryMode ? (
            <button
              className="w-full rounded-lg px-3 py-2 text-sm font-semibold text-mint hover:text-goldHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint"
              type="button"
              onClick={() => { setForgotMode((current) => !current); setError(''); setNotice(''); }}
            >
              {forgotMode ? 'Volver al login' : '¿Olvidaste tu contraseña?'}
            </button>
          ) : null}
        </form>
      </section>
    </main>
  );
}
