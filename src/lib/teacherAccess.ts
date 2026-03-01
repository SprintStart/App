import { supabase } from './supabase';
import { authenticatedPost } from './authenticatedFetch';

export type TeacherAccessState =
  | 'logged_out'
  | 'unverified'
  | 'verified_unpaid'
  | 'verified_paid'
  | 'blocked';

export interface TeacherAccessResult {
  state: TeacherAccessState;
  isTeacher: boolean;
  isAdmin: boolean;
  isPremium: boolean;
  redirectTo: string | null;
  role?: string;
}

export async function resolveTeacherAccess(): Promise<TeacherAccessResult> {
  try {
    console.log('[TeacherAccess] Starting resolution...');

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      console.log('[TeacherAccess] State: logged_out');
      return {
        state: 'logged_out',
        isTeacher: false,
        isAdmin: false,
        isPremium: false,
        redirectTo: null,
      };
    }

    console.log('[TeacherAccess] Session found, calling verify-teacher...');

    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-teacher`;
    const { data: result, error: verifyError } = await authenticatedPost(apiUrl, {});

    if (verifyError || !result) {
      console.error('[TeacherAccess] Verification failed:', verifyError);
      return {
        state: 'logged_out',
        isTeacher: false,
        isAdmin: false,
        isPremium: false,
        redirectTo: null,
      };
    }

    console.log('[TeacherAccess] Verification result:', result);

    const isTeacher = result.is_teacher === true;
    const isAdmin = result.is_admin === true;

    if (!isTeacher && !isAdmin) {
      console.log('[TeacherAccess] State: logged_out (not a teacher)');
      return {
        state: 'logged_out',
        isTeacher: false,
        isAdmin: false,
        isPremium: false,
        redirectTo: null,
        role: result.role,
      };
    }

    console.log('[TeacherAccess] Checking teacher state via edge function...');

    const stateApiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-teacher-state`;
    const { data: stateData, error: stateError } = await authenticatedPost(stateApiUrl, {
      email: session.user.email
    });

    if (stateError || !stateData) {
      console.error('[TeacherAccess] State check failed:', stateError);
      return {
        state: 'blocked',
        isTeacher,
        isAdmin,
        isPremium: false,
        redirectTo: null,
        role: result.role,
      };
    }

    console.log('[TeacherAccess] State data:', stateData);

    const isPremium = stateData.state === 'ACTIVE' || isAdmin;

    let state: TeacherAccessState;
    let redirectTo: string | null = null;

    switch (stateData.state) {
      case 'ACTIVE':
        state = 'verified_paid';
        redirectTo = '/teacherdashboard';
        break;
      case 'NEEDS_VERIFICATION':
        state = 'unverified';
        redirectTo = '/teacher/post-verify';
        break;
      case 'NEEDS_PAYMENT':
        state = 'verified_unpaid';
        redirectTo = '/teacher/checkout';
        break;
      case 'INACTIVE':
      case 'EXPIRED':
        state = 'blocked';
        redirectTo = '/teacher';
        break;
      default:
        state = 'logged_out';
        redirectTo = null;
    }

    if (isAdmin) {
      state = 'verified_paid';
      redirectTo = '/teacherdashboard';
    }

    console.log('[TeacherAccess] Final state:', state, 'redirectTo:', redirectTo);

    return {
      state,
      isTeacher,
      isAdmin,
      isPremium,
      redirectTo,
      role: result.role,
    };

  } catch (error) {
    console.error('[TeacherAccess] Error:', error);
    return {
      state: 'logged_out',
      isTeacher: false,
      isAdmin: false,
      isPremium: false,
      redirectTo: null,
    };
  }
}
