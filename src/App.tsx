import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { NotificationProvider } from './contexts/NotificationContext';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import AdminLogin from './pages/AdminLogin';
import Register from './pages/Register';
import ChangePassword from './pages/ChangePassword';
import RiderDashboard from './pages/RiderDashboard';
import TechnicianDashboard from './pages/TechnicianDashboard';
import AdminDashboard from './pages/AdminDashboard';
import HubManagement from './pages/admin/HubManagement';
import ActiveTickets from './pages/admin/ActiveTickets';
import CompletedTickets from './pages/admin/CompletedTickets';
import UserManagement from './pages/admin/UserManagement';
import CancelledTickets from './pages/admin/CancelledTickets';
import { AdminTicketList } from './components/admin/AdminTicketList';
import { Loader2 } from 'lucide-react';
import RiderManagement from './pages/admin/RiderManagement';
import ActivityDashboard from './pages/admin/ActivityDashboard';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-900 text-white">
        <Loader2 className="animate-spin text-cyan-500" size={48} />
      </div>
    );
  }

  if (!session) {
    const portal = localStorage.getItem('portal_type');
    if (portal === 'admin') {
      return <Navigate to="/secure-admin-panel" replace />;
    }
    return <Navigate to="/login" replace />;
  }

  // Check for Suspended Account
  const { profile } = useAuth();
  if (profile?.status === 'suspended') {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
        <div className="bg-red-500/10 p-6 rounded-2xl border border-red-500/50 text-center max-w-md">
          <h1 className="text-2xl font-bold text-red-500 mb-2">Account Suspended</h1>
          <p className="text-gray-300 mb-6">Your account has been suspended by the administrator.</p>
          <button
            onClick={() => window.location.href = '/login'} // Full reload to clear state/auth
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const RoleBasedRedirect: React.FC = () => {
  const { profile, loading } = useAuth();

  if (loading) return null;

  if (profile?.force_password_change) return <Navigate to="/change-password" replace />;
  if (profile?.role === 'admin') return <Navigate to="/admin" replace />;
  if (profile?.role === 'hub_tech' || profile?.role === 'rsa_tech') return <Navigate to="/tech" replace />;
  return <Navigate to="/rider" replace />;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ThemeProvider>
        <LanguageProvider>
          <NotificationProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/secure-admin-panel" element={<AdminLogin />} />
                {/* <Route path="/admin/login" element={<AdminLoginPage />} />  Deprecated public admin route if needed, or keep for legacy */}
                <Route path="/register" element={<Register />} />

                <Route path="/" element={<ProtectedRoute><MainLayout /></ProtectedRoute>}>
                  <Route index element={<RoleBasedRedirect />} />
                  <Route path="change-password" element={<ChangePassword />} />
                  <Route path="rider" element={<RiderDashboard />} />
                  <Route path="tech" element={<TechnicianDashboard />} />
                  <Route path="admin" element={<AdminDashboard />} />
                  <Route path="admin/hubs" element={<HubManagement />} />
                  <Route path="admin/upcoming-tickets" element={<AdminTicketList title="Upcoming Tickets" initialStatus={['PENDING']} />} />
                  <Route path="admin/active-tickets" element={<ActiveTickets />} />
                  <Route path="admin/completed-tickets" element={<CompletedTickets />} />
                  <Route path="admin/tickets/cancelled" element={<CancelledTickets />} />
                  <Route path="admin/users" element={<UserManagement />} />
                  <Route path="admin/riders" element={<RiderManagement />} />
                  <Route path="admin/activity" element={<ActivityDashboard />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </NotificationProvider>
        </LanguageProvider>
      </ThemeProvider>
    </AuthProvider>
  );
};

export default App;
