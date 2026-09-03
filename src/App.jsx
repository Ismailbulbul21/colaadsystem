import { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

import { useAuth } from './contexts/AuthContext'
import { OfficeSettingsProvider } from './contexts/OfficeSettingsContext'
import ProtectedRoute from './routes/ProtectedRoute'
import DashboardLayout from './layouts/DashboardLayout'
import FullPageLoader from './components/feedback/FullPageLoader'
import { HOME_BY_ROLE } from './constants'

// Every route is split so Finance never downloads Admin's code and vice versa.
const Login          = lazy(() => import('./pages/auth/Login'))
const ChangePassword = lazy(() => import('./pages/auth/ChangePassword'))

const AdminDashboard   = lazy(() => import('./pages/admin/Dashboard'))
const Employees        = lazy(() => import('./pages/admin/Employees'))
const Services         = lazy(() => import('./pages/admin/Services'))
const ServiceFields    = lazy(() => import('./pages/admin/ServiceFields'))
const PendingDiscounts = lazy(() => import('./pages/admin/PendingDiscounts'))
const OfficeSettings   = lazy(() => import('./pages/admin/OfficeSettings'))
const ActivityLogs     = lazy(() => import('./pages/admin/ActivityLogs'))
const Backup           = lazy(() => import('./pages/admin/Backup'))
const FeeRules         = lazy(() => import('./pages/admin/FeeRules'))
const DocTemplates     = lazy(() => import('./pages/admin/DocumentTemplates'))
const NotaryServices   = lazy(() => import('./pages/notary/NotaryServices'))
const NewNotaryService = lazy(() => import('./pages/notary/NewNotaryService'))
const Archive          = lazy(() => import('./pages/archive/Archive'))
const Sabarlog         = lazy(() => import('./pages/sabarlog/Sabarlog'))
const CreateInvoice    = lazy(() => import('./pages/finance/CreateInvoice'))
const RecordIncome     = lazy(() => import('./pages/finance/RecordIncome'))
const Drafts           = lazy(() => import('./pages/registration/Drafts'))

const RegistrationDashboard = lazy(() => import('./pages/registration/Dashboard'))
const NewClient             = lazy(() => import('./pages/registration/NewClient'))
const MyClients             = lazy(() => import('./pages/registration/MyClients'))

const AltDashboard  = lazy(() => import('./pages/alt/Dashboard'))
const WorkQueue     = lazy(() => import('./pages/alt/WorkQueue'))
const DocumentCenter= lazy(() => import('./pages/alt/DocumentCenter'))

const FinanceDashboard = lazy(() => import('./pages/finance/Dashboard'))
const Ledger           = lazy(() => import('./pages/finance/Ledger'))
const DailyReport      = lazy(() => import('./pages/finance/DailyReport'))
const LedgerSetup      = lazy(() => import('./pages/finance/LedgerSetup'))
const LedgerInvoices   = lazy(() => import('./pages/finance/Invoices'))
const LedgerReceipts   = lazy(() => import('./pages/finance/Receipts'))
const PendingPayments  = lazy(() => import('./pages/finance/PendingPayments'))
const LegacyReceipts   = lazy(() => import('./pages/finance/LegacyReceipts'))
const LegacyInvoices   = lazy(() => import('./pages/finance/LegacyInvoices'))
const Expenses         = lazy(() => import('./pages/finance/Expenses'))
const Reports          = lazy(() => import('./pages/finance/Reports'))

const ClientSearch  = lazy(() => import('./pages/shared/ClientSearch'))
const ClientProfile = lazy(() => import('./pages/shared/ClientProfile'))
const Notifications = lazy(() => import('./pages/shared/Notifications'))
const Profile       = lazy(() => import('./pages/shared/Profile'))
const NotFound      = lazy(() => import('./pages/shared/NotFound'))

function RoleHome() {
  const { role } = useAuth()
  return <Navigate to={HOME_BY_ROLE[role] ?? '/login'} replace />
}

export default function App() {
  const { loading, session, profile, mustChangePassword } = useAuth()

  if (loading) return <FullPageLoader />

  return (
    <Suspense fallback={<FullPageLoader />}>
      <Routes>
        <Route
          path="/login"
          element={session && profile ? <RoleHome /> : <Login />}
        />

        {/* The password gate sits OUTSIDE the dashboard shell on purpose:
            until it is passed there is no sidebar and no data is fetched. */}
        <Route
          path="/change-password"
          element={
            !session ? (
              <Navigate to="/login" replace />
            ) : mustChangePassword ? (
              <ChangePassword />
            ) : (
              <RoleHome />
            )
          }
        />

        <Route
          element={
            <OfficeSettingsProvider>
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            </OfficeSettingsProvider>
          }
        >
          <Route path="/" element={<RoleHome />} />

          {/* ---------- Admin ---------- */}
          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/employees" element={<Employees />} />
            <Route path="/admin/services" element={<Services />} />
            <Route path="/admin/services/:serviceId/fields" element={<ServiceFields />} />
            <Route path="/admin/discounts" element={<PendingDiscounts />} />
            <Route path="/admin/settings" element={<OfficeSettings />} />
            <Route path="/admin/logs" element={<ActivityLogs />} />
            <Route path="/admin/backup" element={<Backup />} />
            <Route path="/admin/fee-rules" element={<FeeRules />} />
            <Route path="/admin/templates" element={<DocTemplates />} />
          </Route>

          {/* Archive: the paper backlog, open to Admin and the Archive officer */}
          <Route element={<ProtectedRoute roles={['admin', 'archive']} />}>
            <Route path="/archive" element={<Archive />} />
          </Route>

          {/* Sabarlog: land deeds, open to Admin and the Sabarlog officer */}
          <Route element={<ProtectedRoute roles={['admin', 'sabarlog']} />}>
            <Route path="/sabarlog" element={<Sabarlog />} />
          </Route>

          {/* ---------- Notary: one officer, one workflow ---------- */}
          <Route element={<ProtectedRoute roles={['admin', 'nootaayo']} />}>
            <Route path="/notary" element={<NotaryServices />} />
            <Route path="/notary/new" element={<NewNotaryService />} />
            <Route path="/notary/:serviceId" element={<NewNotaryService />} />
          </Route>

          {/* ---------- Registration ---------- */}
          <Route element={<ProtectedRoute roles={['admin', 'nootaayo']} />}>
            <Route path="/registration" element={<RegistrationDashboard />} />
            <Route path="/registration/new" element={<NewClient />} />
            <Route path="/registration/drafts" element={<Drafts />} />
            {/* Same form, reopened on a saved draft */}
            <Route path="/registration/draft/:draftId" element={<NewClient />} />
            <Route path="/registration/clients" element={<MyClients />} />
          </Route>

          {/* ---------- ALT ---------- */}
          <Route element={<ProtectedRoute roles={['admin', 'nootaayo']} />}>
            <Route path="/alt" element={<AltDashboard />} />
            <Route path="/alt/queue" element={<WorkQueue />} />
            <Route path="/alt/documents" element={<DocumentCenter />} />
          </Route>

          {/* ---------- Finance ---------- */}
          <Route element={<ProtectedRoute roles={['admin', 'finance']} />}>
            <Route path="/finance" element={<Ledger />} />
            <Route path="/finance/daily-report" element={<DailyReport />} />
            <Route path="/finance/setup" element={<LedgerSetup />} />
            <Route path="/finance/invoices" element={<LedgerInvoices />} />
            <Route path="/finance/receipts" element={<LedgerReceipts />} />
            {/* Superseded by the ledger above, kept reachable by URL so the
                client-payment workflow and its receipts are not lost. */}
            <Route path="/finance/old" element={<FinanceDashboard />} />
            <Route path="/finance/old/receipts" element={<LegacyReceipts />} />
            <Route path="/finance/old/invoices" element={<LegacyInvoices />} />
            <Route path="/finance/pending" element={<PendingPayments />} />
            <Route path="/finance/old/invoices/new" element={<CreateInvoice />} />
            <Route path="/finance/income/new" element={<RecordIncome />} />
            <Route path="/finance/expenses" element={<Expenses />} />
            <Route path="/finance/reports" element={<Reports />} />
          </Route>

          {/* ---------- Shared ---------- */}
          <Route path="/clients" element={<ClientSearch />} />
          <Route path="/clients/:id" element={<ClientProfile />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
