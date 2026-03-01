import { createContext, useContext, ReactNode } from 'react';
import { useSubscription } from '../hooks/useSubscription';

interface TeacherAccessContextValue {
  isActive: boolean;
  isPaid: boolean;
  isTrialing: boolean;
  isExpired: boolean;
  isExpiringSoon: boolean;
  daysUntilExpiry: number | null;
  planType: string;
  loading: boolean;
  error: string | null;
  subscription: any;
  entitlement: any;
}

const TeacherAccessContext = createContext<TeacherAccessContextValue | null>(null);

export function TeacherAccessProvider({ children }: { children: ReactNode }) {
  const subscriptionData = useSubscription();

  return (
    <TeacherAccessContext.Provider value={subscriptionData}>
      {children}
    </TeacherAccessContext.Provider>
  );
}

export function useTeacherAccess() {
  const context = useContext(TeacherAccessContext);
  if (!context) {
    throw new Error('useTeacherAccess must be used within TeacherAccessProvider');
  }
  return context;
}
