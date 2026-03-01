import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  CreditCard,
  Megaphone,
  Building2,
  BarChart3,
  FileText,
  Settings,
  LogOut,
  Shield,
  Menu,
  X,
  Layers,
  Ticket,
  Mail,
  MessageSquare,
  AlertTriangle
} from 'lucide-react';

interface AdminDashboardLayoutProps {
  children: React.ReactNode;
  currentView: string;
}

export function AdminDashboardLayout({
  children,
  currentView,
}: AdminDashboardLayoutProps) {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, path: '/admindashboard' },
    { id: 'analytics', label: 'Analytics', icon: BarChart3, path: '/admindashboard/analytics' },
    { id: 'feedback', label: 'Quiz Feedback', icon: MessageSquare, path: '/admindashboard/feedback' },
    { id: 'system-health', label: 'System Health', icon: Shield, path: '/admindashboard/system-health' },
    { id: 'data-integrity', label: 'Data Integrity', icon: AlertTriangle, path: '/admindashboard/data-integrity' },
    { id: 'teachers', label: 'Teachers', icon: Users, path: '/admindashboard/teachers' },
    { id: 'quizzes', label: 'Quizzes', icon: BookOpen, path: '/admindashboard/quizzes' },
    { id: 'subjects', label: 'Subjects & Topics', icon: Layers, path: '/admindashboard/subjects' },
    { id: 'subscriptions', label: 'Subscriptions', icon: CreditCard, path: '/admindashboard/subscriptions' },
    { id: 'sponsors', label: 'Sponsored Ads', icon: Megaphone, path: '/admindashboard/sponsors' },
    { id: 'schools', label: 'Schools', icon: Building2, path: '/admindashboard/schools' },
    { id: 'support', label: 'Support Inbox', icon: Ticket, path: '/admindashboard/support' },
    { id: 'reports', label: 'Email Reports', icon: Mail, path: '/admindashboard/reports' },
    { id: 'audit', label: 'Audit Logs', icon: FileText, path: '/admindashboard/audit' },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/admindashboard/settings' },
  ];

  async function handleLogout() {
    console.log('[Admin Dashboard] Logging out');

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        await supabase.from('audit_logs').insert({
          actor_admin_id: user.id,
          action_type: 'admin_logout',
          target_entity_type: 'auth',
          target_entity_id: user.id,
          metadata: { timestamp: new Date().toISOString() },
        });
      }

      await supabase.auth.signOut();
      navigate('/admin/login');

    } catch (err) {
      console.error('[Admin Dashboard] Logout error:', err);
      navigate('/admin/login');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 w-64 bg-gray-900 text-white transform transition-transform duration-300 z-50 lg:transform-none ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-3">
                <img src="/startsprint_logo.png" alt="StartSprint Logo" className="h-10 w-auto" />
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-red-500" />
                  <p className="text-sm font-semibold text-gray-300">Admin Portal</p>
                </div>
              </div>

              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto p-4">
            <ul className="space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id || (currentView === 'admindashboard' && item.id === 'overview');

                return (
                  <li key={item.id}>
                    <Link
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-red-900 text-white'
                          : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-sm font-medium">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="p-4 border-t border-gray-800">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-gray-600 hover:text-gray-900"
            >
              <Menu className="w-6 h-6" />
            </button>

            <div className="flex items-center gap-4">
              <div className="hidden lg:block">
                <h2 className="text-xl font-bold text-gray-900">
                  {menuItems.find((item) => item.id === currentView)?.label || 'Dashboard'}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden sm:block text-sm text-gray-600">
                <span className="font-medium">Admin</span>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
