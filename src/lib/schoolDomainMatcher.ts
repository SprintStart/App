import { supabase } from './supabase';

export interface School {
  id: string;
  name: string;
  slug: string;
  email_domains: string[];
}

export interface Country {
  id: string;
  name: string;
  slug: string;
  emoji: string;
}

export interface ExamSystem {
  id: string;
  name: string;
  slug: string;
  emoji: string;
  country_id: string;
}

export interface TeacherSchoolMatch {
  matchedSchools: School[];
  autoSelectedSchool: School | null;
  isPremiumOrDomainMatch: boolean;
}

/**
 * Extract email domain from email address
 * e.g., "teacher@school.edu" -> "school.edu"
 */
function extractDomain(email: string): string | null {
  const match = email.match(/@(.+)$/);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Check if teacher's email domain matches any school's allowed domains
 * Returns matched schools and auto-selects if exactly one match
 */
export async function matchTeacherToSchools(teacherEmail: string): Promise<TeacherSchoolMatch> {
  const domain = extractDomain(teacherEmail);

  if (!domain) {
    return {
      matchedSchools: [],
      autoSelectedSchool: null,
      isPremiumOrDomainMatch: false
    };
  }

  // Fetch all active schools with their domain lists
  const { data: schools, error } = await supabase
    .from('schools')
    .select('id, name, slug, email_domains')
    .eq('is_active', true);

  if (error || !schools) {
    console.error('[School Matcher] Error fetching schools:', error);
    return {
      matchedSchools: [],
      autoSelectedSchool: null,
      isPremiumOrDomainMatch: false
    };
  }

  // Filter schools where the teacher's domain matches
  const matchedSchools = schools.filter(school =>
    school.email_domains?.some((allowedDomain: string) =>
      allowedDomain.toLowerCase() === domain
    )
  );

  console.log('[School Matcher] Teacher domain:', domain);
  console.log('[School Matcher] Matched schools:', matchedSchools.length);

  return {
    matchedSchools,
    autoSelectedSchool: matchedSchools.length === 1 ? matchedSchools[0] : null,
    isPremiumOrDomainMatch: matchedSchools.length > 0
  };
}

/**
 * Check if teacher has premium access
 * Premium can be from:
 * 1. Active Stripe subscription
 * 2. Admin-granted override
 * 3. School domain match
 */
export async function checkTeacherPremiumStatus(userId: string): Promise<boolean> {
  // Check for active subscription
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', userId)
    .maybeSingle();

  if (subscription?.status === 'active' || subscription?.status === 'trialing') {
    return true;
  }

  // Check for admin-granted premium override
  const { data: override } = await supabase
    .from('teacher_premium_overrides')
    .select('is_active, expires_at')
    .eq('teacher_id', userId)
    .maybeSingle();

  if (override?.is_active) {
    const expiresAt = new Date(override.expires_at);
    if (expiresAt > new Date()) {
      return true;
    }
  }

  // Check for school domain entitlement
  const { data: entitlement } = await supabase
    .from('teacher_entitlements')
    .select('status, expires_at')
    .eq('teacher_user_id', userId)
    .eq('status', 'active')
    .maybeSingle();

  if (entitlement) {
    if (!entitlement.expires_at) {
      return true; // No expiry = permanent
    }
    const expiresAt = new Date(entitlement.expires_at);
    if (expiresAt > new Date()) {
      return true;
    }
  }

  return false;
}

/**
 * Fetch all countries for destination picker
 */
export async function fetchCountries(): Promise<Country[]> {
  const { data, error } = await supabase
    .from('countries')
    .select('id, name, slug, emoji')
    .eq('is_active', true)
    .order('display_order');

  if (error) {
    console.error('[School Matcher] Error fetching countries:', error);
    return [];
  }

  return data || [];
}

/**
 * Fetch exam systems for a specific country
 */
export async function fetchExamSystems(countryId: string): Promise<ExamSystem[]> {
  const { data, error } = await supabase
    .from('exam_systems')
    .select('id, name, slug, emoji, country_id')
    .eq('country_id', countryId)
    .eq('is_active', true)
    .order('display_order');

  if (error) {
    console.error('[School Matcher] Error fetching exam systems:', error);
    return [];
  }

  return data || [];
}

/**
 * Fetch all active schools (for admin/premium users)
 */
export async function fetchAllSchools(): Promise<School[]> {
  const { data, error } = await supabase
    .from('schools')
    .select('id, name, slug, email_domains')
    .eq('is_active', true)
    .order('name');

  if (error) {
    console.error('[School Matcher] Error fetching schools:', error);
    return [];
  }

  return data || [];
}
