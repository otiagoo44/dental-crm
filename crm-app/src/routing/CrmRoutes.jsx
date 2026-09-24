import { lazy, Suspense, useEffect } from 'react';
import { Navigate, Route, Routes, useParams, useNavigate, useLocation } from 'react-router';
import { PageSkeleton } from '../components/feedback/AppFeedback';
import PatientPage from '../pages/PatientPage';
import PatientsPage from '../pages/PatientsPage';
import NotFoundPage from '../pages/NotFoundPage';
const AgendaView = lazy(() => import('../pages/AgendaPage'));
const Dashboard = lazy(() => import('../pages/DashboardPage'));
const FollowupsView = lazy(() => import('../pages/FollowupsPage'));
const PendingView = lazy(() => import('../pages/PendingPage'));
const LeadsView = lazy(() => import('../pages/LeadsPage'));
const LeadDetail = lazy(() => import('../pages/LeadsPage').then((module) => ({ default: module.LeadDetail })));
const MetricsView = lazy(() => import('../pages/MetricsPage'));
const SettingsView = lazy(() => import('../pages/SettingsPage'));
const TasksView = lazy(() => import('../pages/TasksPage'));
const WorkPage = lazy(() => import('../features/work/WorkPage'));

export function AdminOnly({ canAdmin, children }) {
  return canAdmin ? children : <Navigate to="/resumen" replace />;
}

function OpportunityBoundary({ controller, children }) {
  const { contactId, leadId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedLead, profile, loadLeadEvents, openAppointmentModal } = controller;
  useEffect(() => {
    if (selectedLead) void loadLeadEvents(leadId);
  }, [contactId, leadId, profile?.clinic_id, Boolean(selectedLead), loadLeadEvents]);
  useEffect(() => {
    if (!selectedLead || location.state?.action !== 'schedule') return;
    openAppointmentModal(selectedLead);
    navigate(location.pathname, { replace: true, state: null });
  }, [selectedLead, location.state?.action, location.pathname, navigate, openAppointmentModal]);
  if (!selectedLead || selectedLead.contact_id !== contactId) return <NotFoundPage entity="Oportunidad" />;
  return children;
}

function OpportunityRedirect({ leads }) {
  const { opportunityId } = useParams();
  const lead = leads.find((item) => item.id === opportunityId);
  return lead ? <Navigate to={`/pacientes/${lead.contact_id}/oportunidades/${lead.id}`} replace /> : <NotFoundPage entity="Oportunidad" />;
}

export default function CrmRoutes({ controller }) {
  const navigate = useNavigate();
  const {
    profile,
    clinic,
    leads,
    appointments,
    tasks,
    quotes,
    workspaceEvents,
    clinicSettings,
    treatmentPrices,
    leadEvents,
    publicFormConfig,
    clinicProfiles,
    messageTemplates,
    refreshClinicData,
    setNotice,
    canAdmin,
    activeLeads,
    clinicContext,
    selectedLead,
    selectedContactOpportunities,
    appointmentActionId,
    publicFormSaving,
    templateSaving,
    priceSaving,
    openCreateLeadModal,
    handleLeadSelect,
    openAppointmentModal,
    completeTask,
    markLeadContacted,
    postponeLeadFollowup,
    handleWhatsAppOpened,
    openRegisterOutcome,
    confirmAppointmentById,
    openEditLeadModal,
    openArchiveLeadModal,
    openLostLeadModal,
    updateLead,
    openCreateTaskModal,
    handleMessageCopied,
    openQuoteModal,
    updateAppointmentOutcome,
    openRescheduleModal,
    openEditTaskModal,
    savePublicFormConfig,
    saveMessageTemplates,
    saveTreatmentPrice,
    navigateView
  } = controller;
  return <Suspense fallback={<PageSkeleton />}>
    <Routes>
      <Route path="/" element={<Navigate to="/resumen" replace />} />
      <Route path="/login" element={<Navigate to="/resumen" replace />} />
      <Route path="/pacientes/:contactId" element={<PatientPage profile={profile} />} />
      <Route path="/pacientes" element={<PatientsPage profile={profile} onCreate={() => navigate('/oportunidades?new=1')} />} />
      <Route path="/trabajo" element={<WorkPage profile={profile} canAdmin={canAdmin} onContact={markLeadContacted} onOutcome={openRegisterOutcome} onConfirm={confirmAppointmentById} onComplete={completeTask} />} />
      <Route path="/oportunidades/:opportunityId" element={<OpportunityRedirect leads={leads} />} />
      <Route path="/analitica" element={<Navigate to="/analisis" replace />} />
      <Route path="/resumen" element={
        <Dashboard
          leads={activeLeads}
          appointments={appointments}
          tasks={tasks}
          quotes={quotes}
          workspaceEvents={workspaceEvents}
          profiles={clinicProfiles}
          canAdmin={canAdmin}
          onCreateLead={openCreateLeadModal}
          onOpenLead={handleLeadSelect}
          onScheduleAppointment={openAppointmentModal}
          onCompleteTask={completeTask}
          onMarkContacted={markLeadContacted}
          onPostpone={postponeLeadFollowup}
          onWhatsAppOpened={handleWhatsAppOpened}
          onRegisterOutcome={openRegisterOutcome}
          onConfirmAppointment={confirmAppointmentById}
          onRefresh={() => refreshClinicData()}
          messageTemplates={messageTemplates}
          clinicContext={clinicContext}
          onNavigate={navigateView}
        />
} />
      <Route path="/seguimientos" element={
        <FollowupsView
          leads={activeLeads}
          tasks={tasks}
          appointments={appointments}
          profiles={clinicProfiles}
          onOpenLead={handleLeadSelect}
          onEditLead={openEditLeadModal}
          onMarkContacted={markLeadContacted}
          onScheduleAppointment={openAppointmentModal}
          onCompleteTask={completeTask}
          onPostpone={postponeLeadFollowup}
          onWhatsAppOpened={handleWhatsAppOpened}
          messageTemplates={messageTemplates}
          clinicContext={clinicContext}
        />
} />
      <Route path="/pendientes" element={
        <PendingView
          leads={activeLeads}
          tasks={tasks}
          appointments={appointments}
          quotes={quotes}
          profiles={clinicProfiles}
          onOpenLead={handleLeadSelect}
          onRegisterOutcome={openRegisterOutcome}
          onConfirmAppointment={confirmAppointmentById}
          onCompleteTask={completeTask}
          onWhatsAppOpened={handleWhatsAppOpened}
          messageTemplates={messageTemplates}
          clinicContext={clinicContext}
        />
} />
      <Route path="/oportunidades" element={
        <LeadsView
          profile={profile}
          leads={leads}
          appointments={appointments}
          tasks={tasks}
          quotes={quotes}
          canAdmin={canAdmin}
          onCreateLead={openCreateLeadModal}
          onEditLead={openEditLeadModal}
          onArchiveLead={openArchiveLeadModal}
          onMarkLost={openLostLeadModal}
          onOpenLead={handleLeadSelect}
          onUpdateLead={updateLead}
          onScheduleAppointment={openAppointmentModal}
          onCreateTask={openCreateTaskModal}
          onMarkContacted={markLeadContacted}
          onRegisterOutcome={openRegisterOutcome}
          profiles={clinicProfiles}
          onWhatsAppOpened={handleWhatsAppOpened}
          onMessageCopied={handleMessageCopied}
          messageTemplates={messageTemplates}
          clinicContext={clinicContext}
          setNotice={setNotice}
        />
} />
      <Route path="/pacientes/:contactId/oportunidades/:leadId" element={<OpportunityBoundary controller={controller}>
        <LeadDetail
          lead={selectedLead}
          opportunities={selectedContactOpportunities}
          onSelectOpportunity={handleLeadSelect}
          events={leadEvents.filter((event) => event.lead_id === selectedLead?.id)}
          tasks={tasks}
          appointments={appointments}
          quotes={quotes}
          profiles={clinicProfiles}
          canAdmin={canAdmin}
          onBack={() => navigateView('leads')}
          onEditLead={openEditLeadModal}
          onArchiveLead={openArchiveLeadModal}
          onScheduleAppointment={openAppointmentModal}
          onCreateTask={openCreateTaskModal}
          onRegisterOutcome={openRegisterOutcome}
          onRegisterQuote={openQuoteModal}
          onWhatsAppOpened={handleWhatsAppOpened}
          messageTemplates={messageTemplates}
          clinicContext={clinicContext}
        />
</OpportunityBoundary>} />
      <Route path="/agenda" element={
        <AgendaView
          appointments={appointments}
          quotes={quotes}
          actionId={appointmentActionId}
          onOutcome={updateAppointmentOutcome}
          onReschedule={openRescheduleModal}
          onOpenLead={handleLeadSelect}
          onNavigate={navigateView}
          onRegisterQuote={openQuoteModal}
          onRegisterOutcome={openRegisterOutcome}
          onWhatsAppOpened={handleWhatsAppOpened}
          messageTemplates={messageTemplates}
          clinicContext={clinicContext}
        />
} />
      <Route path="/tareas" element={
        <TasksView tasks={tasks} leads={activeLeads} appointments={appointments} canAdmin={canAdmin} onCreateTask={openCreateTaskModal} onEditTask={openEditTaskModal} onComplete={completeTask} onOpenLead={handleLeadSelect} onWhatsAppOpened={handleWhatsAppOpened} messageTemplates={messageTemplates} clinicContext={clinicContext} />
} />
      <Route path="/analisis" element={<AdminOnly canAdmin={canAdmin}>
        <MetricsView
          leads={leads}
          appointments={appointments}
          tasks={tasks}
          quotes={quotes}
          workspaceEvents={workspaceEvents}
          profiles={clinicProfiles}
          onNavigate={navigateView}
        />
</AdminOnly>} />
      <Route path="/configuracion" element={<AdminOnly canAdmin={canAdmin}>
        <SettingsView clinic={clinic} profile={profile} publicFormConfig={publicFormConfig} savingPublicForm={publicFormSaving} onSavePublicForm={savePublicFormConfig} messageTemplates={messageTemplates} savingTemplates={templateSaving} onSaveMessageTemplates={saveMessageTemplates} treatmentPrices={treatmentPrices} savingPrices={priceSaving} onSaveTreatmentPrice={saveTreatmentPrice} clinicSettings={clinicSettings} profiles={clinicProfiles} setNotice={setNotice} />
</AdminOnly>} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  </Suspense>;
}
