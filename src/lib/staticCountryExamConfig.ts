/**
 * Static Country & Exam System Configuration
 * Used for Create Quiz Wizard destination picker
 * No database queries - fast and deterministic
 */

export interface StaticCountry {
  code: string;
  name: string;
  emoji: string;
  exams: string[];
}

export const COUNTRY_EXAM_CONFIG: Record<string, StaticCountry> = {
  GB: {
    code: 'GB',
    name: 'United Kingdom',
    emoji: '🇬🇧',
    exams: [
      'GCSE',
      'IGCSE',
      'A-Levels',
      'BTEC',
      'T-Levels',
      'Scottish Nationals',
      'Scottish Highers',
      'Scottish Advanced Highers'
    ]
  },
  GH: {
    code: 'GH',
    name: 'Ghana',
    emoji: '🇬🇭',
    exams: [
      'BECE',
      'WASSCE',
      'SSCE',
      'NVTI',
      'TVET'
    ]
  },
  US: {
    code: 'US',
    name: 'United States',
    emoji: '🇺🇸',
    exams: [
      'SAT',
      'ACT',
      'AP Exams',
      'GED',
      'GRE',
      'GMAT'
    ]
  },
  CA: {
    code: 'CA',
    name: 'Canada',
    emoji: '🇨🇦',
    exams: [
      'OSSD',
      'Provincial Exams',
      'CEGEP'
    ]
  },
  NG: {
    code: 'NG',
    name: 'Nigeria',
    emoji: '🇳🇬',
    exams: [
      'WAEC',
      'NECO',
      'JAMB UTME',
      'NABTEB'
    ]
  },
  IN: {
    code: 'IN',
    name: 'India',
    emoji: '🇮🇳',
    exams: [
      'CBSE',
      'ICSE',
      'ISC',
      'JEE',
      'NEET',
      'CUET'
    ]
  },
  AU: {
    code: 'AU',
    name: 'Australia',
    emoji: '🇦🇺',
    exams: [
      'ATAR',
      'HSC',
      'VCE',
      'GAMSAT',
      'UCAT'
    ]
  },
  International: {
    code: 'International',
    name: 'International',
    emoji: '🌍',
    exams: [
      'IELTS',
      'TOEFL',
      'Cambridge International',
      'IB Diploma',
      'PTE Academic'
    ]
  }
};

/**
 * Get all countries as an array
 */
export function getAllCountries(): StaticCountry[] {
  return Object.values(COUNTRY_EXAM_CONFIG);
}

/**
 * Get country by code
 */
export function getCountryByCode(code: string): StaticCountry | null {
  return COUNTRY_EXAM_CONFIG[code] || null;
}

/**
 * Get exams for a specific country
 */
export function getExamsForCountry(countryCode: string): string[] {
  const country = COUNTRY_EXAM_CONFIG[countryCode];
  return country ? country.exams : [];
}
