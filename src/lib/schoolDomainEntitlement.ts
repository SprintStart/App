import { supabase } from './supabase';

export interface SchoolMatch {
  matched: boolean;
  schoolId?: string;
  schoolName?: string;
  domain?: string;
}

/**
 * Extract domain from email address
 * @param email - Email address (e.g., "teacher@school.ac.uk")
 * @returns Domain part (e.g., "school.ac.uk")
 */
export function extractDomain(email: string): string | null {
  const parts = email.toLowerCase().trim().split('@');
  if (parts.length !== 2) return null;
  return parts[1];
}

/**
 * Check if an email domain matches an active school with auto-approval
 * @param email - Teacher email address
 * @returns School match information
 */
export async function checkSchoolDomainMatch(email: string): Promise<SchoolMatch> {
  console.log('[School Domain] Checking email:', email);

  const domain = extractDomain(email);
  if (!domain) {
    console.log('[School Domain] Invalid email format');
    return { matched: false };
  }

  console.log('[School Domain] Extracted domain:', domain);

  try {
    // Check if domain matches any active school
    const { data: schools, error } = await supabase
      .from('schools')
      .select('id, name, email_domains, is_active, auto_approve_teachers')
      .eq('is_active', true);

    if (error) {
      console.error('[School Domain] Error fetching schools:', error);
      return { matched: false };
    }

    if (!schools || schools.length === 0) {
      console.log('[School Domain] No active schools found');
      return { matched: false };
    }

    // Find school with matching domain
    for (const school of schools) {
      if (school.email_domains && Array.isArray(school.email_domains)) {
        const domainMatch = school.email_domains.some(
          (schoolDomain: string) => schoolDomain.toLowerCase() === domain
        );

        if (domainMatch) {
          console.log('[School Domain] Match found:', school.name);
          console.log('[School Domain] Auto-approve enabled:', school.auto_approve_teachers);

          return {
            matched: true,
            schoolId: school.id,
            schoolName: school.name,
            domain: domain,
          };
        }
      }
    }

    console.log('[School Domain] No matching school found for domain:', domain);
    return { matched: false };
  } catch (error) {
    console.error('[School Domain] Unexpected error:', error);
    return { matched: false };
  }
}

/**
 * Attach teacher to school and create entitlement
 * @param teacherId - Teacher user ID
 * @param schoolId - School ID
 * @param schoolName - School name (for logging)
 */
export async function attachTeacherToSchool(
  teacherId: string,
  schoolId: string,
  schoolName: string
): Promise<{ success: boolean; error?: string }> {
  console.log('[School Attach] Attaching teacher', teacherId, 'to school', schoolName);

  try {
    // Create teacher-school membership
    const { error: membershipError } = await supabase
      .from('teacher_school_membership')
      .insert({
        teacher_id: teacherId,
        school_id: schoolId,
        joined_via: 'email_domain',
        premium_granted: true,
        premium_granted_at: new Date().toISOString(),
        is_active: true,
      });

    if (membershipError) {
      console.error('[School Attach] Membership creation failed:', membershipError);
      return { success: false, error: membershipError.message };
    }

    // Create entitlement record
    const { error: entitlementError } = await supabase
      .from('teacher_entitlements')
      .insert({
        teacher_user_id: teacherId,
        source: 'school_domain',
        status: 'active',
        expires_at: null, // School licenses don't expire unless manually revoked
        metadata: {
          school_id: schoolId,
          school_name: schoolName,
        },
      });

    if (entitlementError) {
      console.error('[School Attach] Entitlement creation failed:', entitlementError);
      return { success: false, error: entitlementError.message };
    }

    // Update profile with school info
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        school_id: schoolId,
        school_name: schoolName,
      })
      .eq('id', teacherId);

    if (profileError) {
      console.error('[School Attach] Profile update failed:', profileError);
      // Don't fail the whole operation if profile update fails
    }

    console.log('[School Attach] Successfully attached teacher to school');
    return { success: true };
  } catch (error: any) {
    console.error('[School Attach] Unexpected error:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}
