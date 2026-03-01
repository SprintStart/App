import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Diagnostic logging to see what Vite bundled
console.log('🔍 Supabase Configuration Diagnostic (from Vite bundle):');
console.log('  Environment Mode:', import.meta.env.MODE);
console.log('  Dev Mode:', import.meta.env.DEV);
console.log('  Prod Mode:', import.meta.env.PROD);
console.log('  VITE_SUPABASE_URL:', supabaseUrl);
console.log('  VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 30)}...` : '(not set)');
console.log('  Raw import.meta.env:', import.meta.env);

// Validate environment variables with helpful error messages
function validateSupabaseConfig() {
  const errors: string[] = [];

  if (!supabaseUrl) {
    errors.push('VITE_SUPABASE_URL is not defined');
  } else if (supabaseUrl.includes('placeholder') || supabaseUrl === 'YOUR_SUPABASE_PROJECT_URL') {
    errors.push('VITE_SUPABASE_URL contains placeholder value - replace with real Supabase project URL');
  } else if (supabaseUrl.startsWith('http://')) {
    errors.push(`VITE_SUPABASE_URL must use HTTPS, not HTTP: "${supabaseUrl}"`);
  } else if (!supabaseUrl.startsWith('https://')) {
    errors.push(`VITE_SUPABASE_URL must start with https://: "${supabaseUrl}"`);
  } else if (!supabaseUrl.includes('.supabase.co')) {
    errors.push(`VITE_SUPABASE_URL must be a valid Supabase domain: "${supabaseUrl}"`);
  }

  if (!supabaseAnonKey) {
    errors.push('VITE_SUPABASE_ANON_KEY is not defined');
  } else if (supabaseAnonKey.includes('placeholder') || supabaseAnonKey === 'YOUR_SUPABASE_ANON_KEY') {
    errors.push('VITE_SUPABASE_ANON_KEY contains placeholder value - replace with real anon key');
  } else if (!supabaseAnonKey.startsWith('eyJ') && !supabaseAnonKey.startsWith('sb_publishable_')) {
    errors.push('VITE_SUPABASE_ANON_KEY has invalid format - should start with "eyJ" (JWT) or "sb_publishable_" (new format)');
  }

  if (errors.length > 0) {
    const errorMessage = [
      '❌ Supabase Configuration Error',
      '',
      'The following environment variables are missing or invalid:',
      ...errors.map(e => `  • ${e}`),
      '',
      '📋 How to fix:',
      '  1. Get credentials from: https://app.netlify.com (Environment Variables)',
      '  2. Or from: https://supabase.com/dashboard (Settings → API)',
      '  3. Update your .env file with real values',
      '  4. Rebuild the project: npm run build',
      '',
      '⚠️  The app cannot function without valid Supabase credentials.',
      '',
      '🔍 Current configuration:',
      `  VITE_SUPABASE_URL: ${supabaseUrl || '(not set)'}`,
      `  VITE_SUPABASE_ANON_KEY: ${supabaseAnonKey ? supabaseAnonKey.substring(0, 20) + '...[REDACTED]' : '(not set)'}`,
    ].join('\n');

    console.error(errorMessage);

    throw new Error('Invalid Supabase configuration - check console for details');
  }

  // Log successful configuration (with redacted key)
  console.log('✅ Supabase client initialized:', {
    url: supabaseUrl,
    keyPrefix: supabaseAnonKey.substring(0, 20) + '...[REDACTED]',
  });
}

// Validate configuration
validateSupabaseConfig();

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
});

export interface Profile {
  id: string;
  role: 'student' | 'teacher' | 'admin';
  full_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Topic {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuestionSet {
  id: string;
  topic_id: string;
  title: string;
  difficulty: string | null;
  is_active: boolean;
  question_count: number;
  shuffle_questions: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TopicQuestion {
  id: string;
  question_set_id: string;
  question_text: string;
  options: string[];
  correct_index?: number;
  explanation: string | null;
  order_index: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TopicRun {
  id: string;
  user_id: string;
  topic_id: string;
  question_set_id: string;
  status: 'in_progress' | 'completed' | 'game_over';
  score_total: number;
  correct_count: number;
  wrong_count: number;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
}

export interface TopicRunAnswer {
  id: string;
  run_id: string;
  question_id: string;
  attempt_number: number;
  selected_index: number;
  is_correct: boolean;
  answered_at: string;
}
