import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { DashboardLayout } from '../components/teacher-dashboard/DashboardLayout';
import { OverviewPage } from '../components/teacher-dashboard/OverviewPage';
import { MyQuizzesPage } from '../components/teacher-dashboard/MyQuizzesPage';
import { ReportsPage } from '../components/teacher-dashboard/ReportsPage';
import { ComingSoon } from '../components/teacher-dashboard/ComingSoon';
import { ProfilePage } from '../components/teacher-dashboard/ProfilePage';
import { SubscriptionPage } from '../components/teacher-dashboard/SubscriptionPage';
import { SupportPage } from '../components/teacher-dashboard/SupportPage';
import { MyTicketsPage } from '../components/teacher-dashboard/MyTicketsPage';
import { AnalyticsPageV2 } from '../components/teacher-dashboard/AnalyticsPageV2';
import { TeacherDashboardProvider, useTeacherDashboard } from '../contexts/TeacherDashboardContext';
import { CreateQuizWizard } from '../components/teacher-dashboard/CreateQuizWizard';
import { EditQuizPage } from '../components/teacher-dashboard/EditQuizPage';

function TeacherDashboardContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { accessResult } = useTeacherDashboard();
  const [currentView, setCurrentView] = useState('overview');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    if (tab) {
      setCurrentView(tab);
    }
  }, [location.search]);

  function handleViewChange(view: string) {
    setCurrentView(view);
    navigate(`/teacherdashboard?tab=${view}`);
  }

  return (
    <DashboardLayout currentView={currentView} onViewChange={handleViewChange}>
      {currentView === 'overview' && <OverviewPage />}
      {currentView === 'my-quizzes' && <MyQuizzesPage />}
      {currentView === 'create-quiz' && <CreateQuizWizard />}
      {currentView === 'edit-quiz' && <EditQuizPage />}
      {currentView === 'analytics' && <AnalyticsPageV2 />}
      {currentView === 'reports' && <ReportsPage />}
      {currentView === 'ai-generator' && (
        <ComingSoon
          icon="\u{2728}"
          title="\u{2728} AI Generate (Coming Soon)"
          message="AI-powered quiz generation is on the way."
          bullets={[
            'Reliable content extraction',
            'Question quality checks',
            'School-safe publishing rules',
          ]}
          statusLine="Manual quiz creation is fully available and recommended for now."
        />
      )}
      {currentView === 'upload-document' && (
        <ComingSoon
          icon="\u{1F4C4}"
          title="\u{1F4C4} Upload Document (Coming Soon)"
          message="Document-based quiz creation is currently in development."
          bullets={[
            'Paste or upload teaching materials',
            'Generate editable questions automatically',
            'Safe and accurate content extraction',
          ]}
          statusLine="This feature will allow you to paste or upload teaching materials and generate editable questions — safely and accurately."
        />
      )}
      {currentView === 'profile' && <ProfilePage />}
      {currentView === 'subscription' && <SubscriptionPage />}
      {currentView === 'support' && <SupportPage entitlement={{ isPremium: accessResult?.isPremium || false }} />}
      {currentView === 'tickets' && <MyTicketsPage />}
    </DashboardLayout>
  );
}

export function TeacherDashboard() {
  return (
    <TeacherDashboardProvider>
      <TeacherDashboardContent />
    </TeacherDashboardProvider>
  );
}
