import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { supabase, Profile } from './lib/supabase';
import { ImmersiveProvider } from './contexts/ImmersiveContext';
import { LowBandwidthProvider } from './contexts/LowBandwidthContext';
import { LowBandwidthIndicator } from './components/LowBandwidthIndicator';
import { TeacherApp } from './components/TeacherApp';
import { MissionPage } from './components/MissionPage';
import { PricingPage } from './components/PricingPage';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { TeacherPage } from './components/TeacherPage';
import { AdminLogin } from './components/AdminLogin';
import { Success } from './pages/Success';
import { TeacherDashboard as NewTeacherDashboard } from './pages/TeacherDashboard';
import { AdminDashboard as NewAdminDashboard } from './pages/AdminDashboard';
import { SignupSuccess } from './components/auth/SignupSuccess';
import { EmailConfirmed } from './pages/EmailConfirmed';
import { ResetPassword } from './pages/ResetPassword';
import { AuthCallback } from './pages/AuthCallback';
import { TeacherCheckout } from './pages/TeacherCheckout';
import { PaymentSuccess } from './pages/PaymentSuccess';
import { PaymentCancelled } from './pages/PaymentCancelled';
import { AdminResetPassword } from './pages/AdminResetPassword';
import { ShareResult } from './pages/ShareResult';
import { TeacherConfirm } from './pages/TeacherConfirm';
import { TeacherPostVerify } from './pages/TeacherPostVerify';
import { AboutPage as AboutPageNew } from './pages/AboutPage';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { TermsOfService } from './pages/TermsOfService';
import { AIPolicy } from './pages/AIPolicy';
import { SafeguardingStatement } from './pages/SafeguardingStatement';
import { ContactPage } from './pages/ContactPage';
import { Logout } from './pages/Logout';
import { QuizPreview } from './pages/QuizPreview';
import { QuizPlay } from './pages/QuizPlay';

import { PublicHomepage } from './components/PublicHomepage';
import { GlobalHome } from './pages/global/GlobalHome';
import { GlobalQuizzesPage } from './pages/global/GlobalQuizzesPage';
import { SubjectsListPage } from './pages/global/SubjectsListPage';
import { SubjectTopicsPage } from './pages/global/SubjectTopicsPage';
import { ExamPage } from './pages/global/ExamPage';
import { SubjectPage } from './pages/global/SubjectPage';
import { TopicPage } from './pages/global/TopicPage';
import { StandaloneTopicPage } from './pages/global/StandaloneTopicPage';

import { SchoolHome } from './pages/school/SchoolHome';
import { SchoolSubjectPage } from './pages/school/SchoolSubjectPage';
import { SchoolTopicPage } from './pages/school/SchoolTopicPage';

function OldTeacherDashboard() {
  const navigate = useNavigate();

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate('/');
  }

  return (
    <div className="relative">
      <button
        onClick={handleSignOut}
        className="fixed top-4 left-4 z-50 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-lg"
      >
        Sign Out
      </button>
      <TeacherApp />
    </div>
  );
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('[NAV] Route changed to:', location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setProfile(data);
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
    } finally {
      setLoading(false);
    }
  }


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-2xl">Loading...</div>
      </div>
    );
  }

  return (
    <LowBandwidthProvider>
      <ImmersiveProvider>
        <LowBandwidthIndicator />
        <Routes>
        {/* Immersive Hero Homepage */}
        <Route path="/" element={<PublicHomepage />} />

        {/* Global Discovery Routes */}
        <Route path="/explore" element={<GlobalHome />} />
        <Route path="/explore/global" element={<GlobalQuizzesPage />} />
        <Route path="/subjects" element={<SubjectsListPage />} />
        <Route path="/subjects/:subjectId" element={<SubjectTopicsPage />} />
        <Route path="/exams/:examSlug" element={<ExamPage />} />
        <Route path="/exams/:examSlug/:subjectSlug" element={<SubjectPage />} />
        <Route path="/exams/:examSlug/:subjectSlug/:topicSlug" element={<TopicPage />} />
        <Route path="/topics/:topicSlug" element={<StandaloneTopicPage />} />

        {/* Quiz and Sharing Routes */}
        <Route path="/quiz/:slug" element={<QuizPreview />} />
        <Route path="/play/:quizId" element={<QuizPlay />} />
        <Route path="/share/session/:sessionId" element={<ShareResult />} />

        {/* Static Content Pages */}
        <Route path="/about" element={<AboutPageNew />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/ai-policy" element={<AIPolicy />} />
        <Route path="/safeguarding" element={<SafeguardingStatement />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/mission" element={<MissionPage />} />
        <Route path="/pricing" element={<PricingPage />} />

        {/* Auth Routes */}
        <Route path="/signup-success" element={<SignupSuccess />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/auth/confirmed" element={<EmailConfirmed />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/logout" element={<Logout />} />

        {/* Admin Routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/reset-password" element={<AdminResetPassword />} />
        <Route path="/admin" element={<Navigate to="/admindashboard" replace />} />
        <Route path="/admindashboard" element={<NewAdminDashboard />} />
        <Route path="/admindashboard/overview" element={<NewAdminDashboard />} />
        <Route path="/admindashboard/analytics" element={<NewAdminDashboard />} />
        <Route path="/admindashboard/feedback" element={<NewAdminDashboard />} />
        <Route path="/admindashboard/teachers" element={<NewAdminDashboard />} />
        <Route path="/admindashboard/quizzes" element={<NewAdminDashboard />} />
        <Route path="/admindashboard/subjects" element={<NewAdminDashboard />} />
        <Route path="/admindashboard/schools" element={<NewAdminDashboard />} />
        <Route path="/admindashboard/sponsors" element={<NewAdminDashboard />} />
        <Route path="/admindashboard/subscriptions" element={<NewAdminDashboard />} />
        <Route path="/admindashboard/system-health" element={<NewAdminDashboard />} />
        <Route path="/admindashboard/support" element={<NewAdminDashboard />} />
        <Route path="/admindashboard/reports" element={<NewAdminDashboard />} />
        <Route path="/admindashboard/audit" element={<NewAdminDashboard />} />
        <Route path="/admindashboard/settings" element={<NewAdminDashboard />} />

        {/* Teacher Routes */}
        <Route path="/teacher" element={<TeacherPage />} />
        <Route path="/teacher/confirm" element={<TeacherConfirm />} />
        <Route path="/teacher/post-verify" element={<TeacherPostVerify />} />
        <Route path="/teacher/checkout" element={<TeacherCheckout />} />
        <Route path="/teacher/payment/success" element={<PaymentSuccess />} />
        <Route path="/teacher/payment/cancelled" element={<PaymentCancelled />} />
        <Route path="/teacherdashboard" element={<NewTeacherDashboard />} />
        <Route
          path="/dashboard"
          element={
            user && profile ? <OldTeacherDashboard /> : <TeacherPage />
          }
        />
        <Route
          path="/analytics"
          element={
            user && profile ? <AnalyticsDashboard /> : <TeacherPage />
          }
        />

        {/* Legacy Routes */}
        <Route path="/success" element={<Success />} />

        {/* School Wall Routes - MUST BE LAST (catch-all patterns) */}
        <Route path="/:schoolSlug/:subjectSlug/:topicSlug" element={<SchoolTopicPage />} />
        <Route path="/:schoolSlug/:subjectSlug" element={<SchoolSubjectPage />} />
        <Route path="/:schoolSlug" element={<SchoolHome />} />
        </Routes>
      </ImmersiveProvider>
    </LowBandwidthProvider>
  );
}

export default App;
