import { ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Plus,
  BarChart3,
  FileDown,
  User,
  CreditCard,
  HelpCircle,
  Ticket,
  LogOut,
  Menu,
  X,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTeacherDashboard } from '../../contexts/TeacherDashboardContext';
import { ENABLE_ANALYTICS } from '../../lib/featureFlags';

interface DashboardLayoutProps {
  children: ReactNode;
  currentView: string;
  onViewChange: (view: string) => void;
}

export function DashboardLayout({ children, currentView, onViewChange }: DashboardLayoutProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isActive, isExpiringSoon, isExpired, daysUntilExpiry, school } = useTeacherDashboard();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, disabled: false },
    { id: 'my-quizzes', label: 'My Quizzes', icon: FileText, disabled: false },
    { id: 'create-quiz', label: 'Create Quiz', icon: Plus, disabled: false },
    { id: 'analytics', label: 'Analytics', icon: ENABLE_ANALYTICS ? BarChart3 : Lock, disabled: !ENABLE_ANALYTICS, badge: ENABLE_ANALYTICS ? undefined : 'Soon' },
    { id: 'reports', label: 'Reports', icon: ENABLE_ANALYTICS ? FileDown : Lock, disabled: !ENABLE_ANALYTICS, badge: ENABLE_ANALYTICS ? undefined : 'Soon' },
    { id: 'profile', label: 'Profile', icon: User, disabled: false },
    { id: 'subscription', label: 'Subscription', icon: CreditCard, disabled: false },
    { id: 'support', label: 'Support', icon: HelpCircle, disabled: false },
    { id: 'tickets', label: 'My Tickets', icon: Ticket, disabled: false },
  ];

  const handleLogout = async () => {
    try {
      await logout();
      // Navigate with replace to prevent back button access
      navigate('/teacher', { replace: true });
      // Force hard navigation to clear all state
      setTimeout(() => {
        window.location.href = '/teacher';
      }, 100);
    } catch (error) {
      console.error('[Dashboard] Logout failed:', error);
      // Even on error, redirect to teacher page
      window.location.href = '/teacher';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-gray-200">
            <img src="/startsprint_logo.png" alt="StartSprint Logo" className="h-12 w-auto mb-2" />
            <p className="text-sm text-gray-600">Teacher Dashboard</p>
            {school && (
              <p className="text-xs text-blue-600 font-medium mt-1 truncate">{school.name}</p>
            )}
          </div>

          <nav className="flex-1 overflow-y-auto p-4">
            <div className="space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.disabled) return;
                      onViewChange(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition ${
                      item.disabled
                        ? 'text-gray-400 cursor-not-allowed'
                        : currentView === item.id
                        ? 'bg-blue-50 text-blue-600 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className="text-[10px] font-semibold uppercase tracking-wide bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>

          <div className="p-4 border-t border-gray-200">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-700 hover:bg-gray-50 transition"
            >
              <LogOut className="w-5 h-5" />
              Logout
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  {isActive && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Active
                    </span>
                  )}
                  {isExpiringSoon && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Expires in {daysUntilExpiry} days
                    </span>
                  )}
                  {isExpired && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      Expired
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        {isExpiringSoon && (
          <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-3">
            <div className="flex items-center gap-2 text-yellow-800">
              <AlertTriangle className="w-5 h-5" />
              <span className="text-sm font-medium">
                Your subscription expires in {daysUntilExpiry} days.{' '}
                <button
                  onClick={() => onViewChange('subscription')}
                  className="underline hover:no-underline"
                >
                  Renew now
                </button>
              </span>
            </div>
          </div>
        )}

        {isExpired && (
          <div className="bg-red-50 border-b border-red-200 px-6 py-4">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="w-5 h-5" />
              <div>
                <p className="font-medium">Subscription expired</p>
                <p className="text-sm mt-1">
                  Renew to unlock dashboard and republish your quizzes.{' '}
                  <button
                    onClick={() => navigate('/teacher')}
                    className="underline hover:no-underline"
                  >
                    View pricing
                  </button>
                </p>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}
