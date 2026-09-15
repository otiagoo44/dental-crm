import { lazy, Suspense } from 'react';
import { BrowserRouter, useLocation, useNavigate } from 'react-router';
import { AnimatePresence } from 'motion/react';
import AppLayout from './components/AppLayout';
import Login from './components/Login';
import { Banner, FullScreenLoader } from './components/feedback/AppFeedback';
import useSupabaseSession from './hooks/useSupabaseSession';
import useCrmController from './hooks/useCrmController';
import { INVALID_PASSWORD_RECOVERY_MESSAGE } from './lib/authRecovery';
import { getPublicFormRoute } from './lib/crmDomain';
import CrmRoutes from './routing/CrmRoutes';
import WorkspaceModals from './components/WorkspaceModals';

const PublicEmbedLeadForm = lazy(() => import('./features/public-form/PublicEmbedLeadForm'));

export default function App() {
  return <BrowserRouter><AppBoundary /></BrowserRouter>;
}

export function AppBoundary() {
  useLocation();
  const publicFormRoute = getPublicFormRoute();
  if (publicFormRoute) {
    return <Suspense fallback={<FullScreenLoader label="Cargando formulario…" />}>
      <PublicEmbedLeadForm clinicSlug={publicFormRoute.clinicSlug} landingToken={publicFormRoute.landingToken} />
    </Suspense>;
  }
  return <AuthBoundary />;
}

function AuthBoundary() {
  const { session, loading: authLoading, error: authError, passwordRecovery, passwordRecoveryError, completePasswordRecovery } = useSupabaseSession();
  const navigate = useNavigate();
  if (authLoading) return <FullScreenLoader label="Cargando sesión..." />;
  if (passwordRecoveryError) return <Login recoveryError={passwordRecoveryError} />;
  if (session && passwordRecovery) return <Login recoveryMode onRecoveryComplete={() => {
    completePasswordRecovery();
    navigate('/', { replace: true });
  }} />;
  if (!session && passwordRecovery) return <Login recoveryError={INVALID_PASSWORD_RECOVERY_MESSAGE} />;
  if (!session) return <Login />;
  return <ClinicWorkspace key={session.user.id} session={session} authError={authError} />;
}

function ClinicWorkspace({ session, authError }) {
  const controller = useCrmController({ session, authError });
  const { bootLoading, profile, clinic, canAdmin, navCounts, activeView, navigateView, handleLogout, error, notice, setError, setNotice } = controller;
  if (bootLoading || !profile) return error
    ? <div className="p-6"><Banner tone="danger" text={error} /><button type="button" onClick={handleLogout}>Cerrar sesión</button></div>
    : <FullScreenLoader label="Cargando clínica..." />;
  return <AppLayout activeView={activeView} setActiveView={navigateView} clinic={clinic} profile={profile} isAdmin={canAdmin} navCounts={navCounts} onLogout={handleLogout}>
    <AnimatePresence>
      {error ? <Banner key="error" tone="danger" text={error} onClose={() => setError('')} /> : null}
      {notice ? <Banner key="notice" tone="mint" text={notice} onClose={() => setNotice('')} /> : null}
    </AnimatePresence>
    <CrmRoutes controller={controller} />
    <WorkspaceModals controller={controller} />
  </AppLayout>;
}
