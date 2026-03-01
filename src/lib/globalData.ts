import {
  BookOpen,
  FlaskConical,
  Globe,
  Calculator,
  Briefcase,
  MapPin,
  Clock,
  Languages,
  Wrench,
  Rocket,
  Brain,
  Palette,
} from 'lucide-react';

export interface ExamSystem {
  name: string;
  slug: string;
  emoji: string;
  description: string;
}

export interface Country {
  name: string;
  slug: string;
  emoji: string;
  description: string;
  exams: ExamSystem[];
}

export interface SubjectDef {
  id: string;
  name: string;
  icon: typeof BookOpen;
  color: string;
}

// Fixed subjects for the platform
export const SUBJECTS: SubjectDef[] = [
  { id: 'mathematics', name: 'Mathematics', icon: Calculator, color: 'text-blue-600' },
  { id: 'science', name: 'Science', icon: FlaskConical, color: 'text-green-600' },
  { id: 'english', name: 'English', icon: BookOpen, color: 'text-purple-600' },
  { id: 'computing', name: 'Computing / IT', icon: Brain, color: 'text-cyan-600' },
  { id: 'business', name: 'Business', icon: Briefcase, color: 'text-orange-600' },
  { id: 'geography', name: 'Geography', icon: MapPin, color: 'text-emerald-600' },
  { id: 'history', name: 'History', icon: Clock, color: 'text-amber-600' },
  { id: 'languages', name: 'Languages', icon: Languages, color: 'text-rose-600' },
  { id: 'engineering', name: 'Engineering', icon: Wrench, color: 'text-slate-600' },
  { id: 'physics', name: 'Physics', icon: Rocket, color: 'text-indigo-600' },
  { id: 'chemistry', name: 'Chemistry', icon: FlaskConical, color: 'text-teal-600' },
  { id: 'art', name: 'Art & Design', icon: Palette, color: 'text-pink-600' },
];

// Global countries with exam systems
export const COUNTRIES: Country[] = [
  {
    name: 'United Kingdom',
    slug: 'uk',
    emoji: '🇬🇧',
    description: 'Old school chalk + board meets modern hustle.',
    exams: [
      { name: 'GCSE', slug: 'gcse', emoji: '📘', description: 'General Certificate of Secondary Education' },
      { name: 'IGCSE', slug: 'igcse', emoji: '📗', description: 'International GCSE' },
      { name: 'A-Levels', slug: 'a-levels', emoji: '🎓', description: 'Advanced Level qualifications' },
      { name: 'BTEC', slug: 'btec', emoji: '🛠️', description: 'Business and Technology Education Council' },
      { name: 'T-Levels', slug: 't-levels', emoji: '📐', description: 'Technical Level qualifications' },
      { name: 'Scottish Nationals', slug: 'scottish-nationals', emoji: '🏫', description: 'Scottish National qualifications' },
      { name: 'Scottish Highers', slug: 'scottish-highers', emoji: '🏫', description: 'Scottish Higher qualifications' },
      { name: 'Scottish Advanced Highers', slug: 'scottish-advanced-highers', emoji: '🏫', description: 'Scottish Advanced Higher qualifications' },
    ],
  },
  {
    name: 'Ghana',
    slug: 'ghana',
    emoji: '🇬🇭',
    description: 'Building futures through education.',
    exams: [
      { name: 'BECE', slug: 'bece', emoji: '📚', description: 'Basic Education Certificate Examination' },
      { name: 'WASSCE', slug: 'wassce', emoji: '🎓', description: 'West African Senior School Certificate Examination' },
      { name: 'SSCE', slug: 'ssce', emoji: '🎓', description: 'Senior Secondary Certificate Examination' },
      { name: 'NVTI', slug: 'nvti', emoji: '🧪', description: 'National Vocational Training Institute' },
      { name: 'TVET', slug: 'tvet', emoji: '🧪', description: 'Technical and Vocational Education and Training' },
    ],
  },
  {
    name: 'United States',
    slug: 'usa',
    emoji: '🇺🇸',
    description: 'Land of multiple choice and scantron sheets.',
    exams: [
      { name: 'SAT', slug: 'sat', emoji: '📝', description: 'Scholastic Assessment Test' },
      { name: 'ACT', slug: 'act', emoji: '✍️', description: 'American College Testing' },
      { name: 'AP Exams', slug: 'ap', emoji: '🎓', description: 'Advanced Placement Exams' },
      { name: 'GED', slug: 'ged', emoji: '📊', description: 'General Educational Development' },
      { name: 'GRE', slug: 'gre', emoji: '🧠', description: 'Graduate Record Examination' },
      { name: 'GMAT', slug: 'gmat', emoji: '💼', description: 'Graduate Management Admission Test' },
    ],
  },
  {
    name: 'Canada',
    slug: 'canada',
    emoji: '🇨🇦',
    description: 'Polite education excellence.',
    exams: [
      { name: 'OSSD', slug: 'ossd', emoji: '📘', description: 'Ontario Secondary School Diploma' },
      { name: 'Provincial Exams', slug: 'provincial', emoji: '🧮', description: 'Provincial standardized exams' },
      { name: 'CEGEP', slug: 'cegep', emoji: '🎓', description: 'Collège d\'enseignement général et professionnel' },
    ],
  },
  {
    name: 'Nigeria',
    slug: 'nigeria',
    emoji: '🇳🇬',
    description: 'Academic excellence and determination.',
    exams: [
      { name: 'WAEC', slug: 'waec', emoji: '📚', description: 'West African Examinations Council' },
      { name: 'NECO', slug: 'neco', emoji: '📝', description: 'National Examinations Council' },
      { name: 'JAMB', slug: 'jamb', emoji: '🚪', description: 'Joint Admissions and Matriculation Board' },
      { name: 'NABTEB', slug: 'nabteb', emoji: '🛠️', description: 'National Business and Technical Examinations Board' },
    ],
  },
  {
    name: 'India',
    slug: 'india',
    emoji: '🇮🇳',
    description: 'Next-level grind culture.',
    exams: [
      { name: 'CBSE', slug: 'cbse', emoji: '📖', description: 'Central Board of Secondary Education' },
      { name: 'ICSE', slug: 'icse', emoji: '📘', description: 'Indian Certificate of Secondary Education' },
      { name: 'ISC', slug: 'isc', emoji: '📘', description: 'Indian School Certificate' },
      { name: 'JEE', slug: 'jee', emoji: '🧪', description: 'Joint Entrance Examination' },
      { name: 'NEET', slug: 'neet', emoji: '🩺', description: 'National Eligibility cum Entrance Test' },
      { name: 'CUET', slug: 'cuet', emoji: '🎓', description: 'Common University Entrance Test' },
    ],
  },
  {
    name: 'Australia',
    slug: 'australia',
    emoji: '🇦🇺',
    description: 'Down under, on top of education.',
    exams: [
      { name: 'ATAR', slug: 'atar', emoji: '📘', description: 'Australian Tertiary Admission Rank' },
      { name: 'HSC', slug: 'hsc', emoji: '📚', description: 'Higher School Certificate' },
      { name: 'VCE', slug: 'vce', emoji: '🎓', description: 'Victorian Certificate of Education' },
      { name: 'GAMSAT', slug: 'gamsat', emoji: '🧠', description: 'Graduate Australian Medical School Admissions Test' },
      { name: 'UCAT', slug: 'ucat', emoji: '🧠', description: 'University Clinical Aptitude Test' },
    ],
  },
  {
    name: 'International',
    slug: 'international',
    emoji: '🌍',
    description: 'Visa passports of education.',
    exams: [
      { name: 'IELTS', slug: 'ielts', emoji: '🌐', description: 'International English Language Testing System' },
      { name: 'TOEFL', slug: 'toefl', emoji: '🌐', description: 'Test of English as a Foreign Language' },
      { name: 'Cambridge International', slug: 'cambridge', emoji: '🌐', description: 'Cambridge International Examinations' },
      { name: 'IB Diploma', slug: 'ib', emoji: '🌐', description: 'International Baccalaureate Diploma Programme' },
      { name: 'PTE Academic', slug: 'pte', emoji: '🌐', description: 'Pearson Test of English Academic' },
    ],
  },
];

// School wall filter tabs (UK curriculum)
export const SCHOOL_FILTER_TABS = [
  { id: 'recent', label: 'Recently Published', emoji: '🆕' },
  { id: 'gcse', label: 'GCSE', emoji: '📘' },
  { id: 'a-level', label: 'A-Level', emoji: '🎓' },
  { id: 'btec', label: 'BTEC', emoji: '🛠️' },
  { id: 't-level', label: 'T-Level', emoji: '📐' },
];

// Helper functions
export function findExamBySlug(examSlug: string): { exam: ExamSystem; country: Country } | null {
  for (const country of COUNTRIES) {
    const exam = country.exams.find((e) => e.slug === examSlug);
    if (exam) {
      return { exam, country };
    }
  }
  return null;
}

export function findSubjectById(subjectId: string): SubjectDef | undefined {
  return SUBJECTS.find((s) => s.id === subjectId);
}
