import { lazy, Suspense } from 'react';
import { getTreatmentOptions } from '../lib/crmDomain';
const AppointmentModal = lazy(() => import('../components/modals/AppointmentModal'));
const ArchiveLeadModal = lazy(() => import('../components/modals/ArchiveLeadModal'));
const ContactOutcomeModal = lazy(() => import('../components/modals/ContactOutcomeModal'));
const LeadFormModal = lazy(() => import('../components/modals/LeadFormModal'));
const QuoteModal = lazy(() => import('../components/modals/QuoteModal'));
const TaskFormModal = lazy(() => import('../components/modals/TaskFormModal'));

export default function WorkspaceModals({ controller }) {
  const {
    profile,    clinic,    leads,    appointments,    quotes,    clinicSettings,    treatmentPrices,    clinicProfiles,    canAdmin,    activeLeads,    appointmentModal,    appointmentSaving,    leadModal,    leadFormSaving,    archiveModal,    archiveSaving,    taskModal,    taskFormSaving,    contactOutcomeModal,    contactOutcomeSaving,    quoteModal,    quoteSaving,    setAppointmentModal,    setLeadModal,    setArchiveModal,    setTaskModal,    setContactOutcomeModal,    setQuoteModal,    saveAppointmentSchedule,    saveLeadForm,    saveLeadLoss,    saveTaskForm,    submitContactOutcome,    saveQuote
  } = controller;
  return <Suspense fallback={null}>
      {/* Unmount closed dialogs immediately so an exiting portal cannot block the next action. */}
      {appointmentModal ? (
        <AppointmentModal
          key="appointment-modal"
          clinic={clinic}
          lead={appointmentModal.lead}
          appointment={appointmentModal.appointment}
          appointments={appointments}
          profiles={clinicProfiles}
          clinicSettings={clinicSettings}
          mode={appointmentModal.mode}
          saving={appointmentSaving}
          onClose={() => setAppointmentModal(null)}
          onSubmit={saveAppointmentSchedule}
        />
      ) : null}
      {leadModal ? (
        <LeadFormModal
          key="lead-modal"
          mode={leadModal.mode}
          lead={leadModal.lead}
          canAdmin={canAdmin}
          profiles={clinicProfiles}
          currentUserId={profile?.id}
          treatmentOptions={getTreatmentOptions(clinicSettings, treatmentPrices)}
          saving={leadFormSaving}
          onClose={() => setLeadModal(null)}
          onSubmit={saveLeadForm}
        />
      ) : null}
      {archiveModal ? <ArchiveLeadModal key="archive-modal" lead={archiveModal.lead} archive={archiveModal.archive} saving={archiveSaving} onClose={() => setArchiveModal(null)} onSubmit={saveLeadLoss} /> : null}
      {taskModal ? (
        <TaskFormModal
          key="task-modal"
          mode={taskModal.mode}
          task={taskModal.task}
          initialLeadId={taskModal.leadId}
          leads={activeLeads}
          saving={taskFormSaving}
          onClose={() => setTaskModal(null)}
          onSubmit={saveTaskForm}
        />
      ) : null}
      {contactOutcomeModal ? (
        <ContactOutcomeModal
          key="contact-outcome-modal"
          context={contactOutcomeModal}
          saving={contactOutcomeSaving}
          quotes={quotes}
          onClose={() => setContactOutcomeModal(null)}
          onSubmit={submitContactOutcome}
        />
      ) : null}
      {quoteModal ? (
        <QuoteModal
          key="quote-modal"
          context={quoteModal}
          treatmentPrices={treatmentPrices}
          saving={quoteSaving}
          onClose={() => setQuoteModal(null)}
          onSubmit={saveQuote}
        />
      ) : null}

  </Suspense>;
}
