/**
 * Global Categories Configuration
 * Used for Global StartSprint Library (non-curriculum quizzes)
 *
 * Global quizzes are NOT curriculum-based. They focus on:
 * - Aptitude & reasoning
 * - Career readiness
 * - General knowledge
 * - Life skills
 */

export interface GlobalCategory {
  id: string;
  name: string;
  description: string;
}

/**
 * Fixed list of Global Categories
 * These are NOT exam subjects - they are skill-based categories
 */
export const GLOBAL_CATEGORIES: GlobalCategory[] = [
  {
    id: 'aptitude-psychometric',
    name: 'Aptitude & Psychometric Tests',
    description: 'Logical reasoning, numerical reasoning, verbal reasoning, abstract thinking'
  },
  {
    id: 'career-employment',
    name: 'Career & Employment Prep',
    description: 'Interview preparation, CV writing, workplace skills, professional development'
  },
  {
    id: 'general-knowledge',
    name: 'General Knowledge / Popular Formats',
    description: 'Current affairs, history, geography, science facts, pub quiz style'
  },
  {
    id: 'life-skills',
    name: 'Life Skills / Study Skills / Digital Literacy / AI basics',
    description: 'Time management, critical thinking, digital tools, AI awareness, learning strategies'
  }
];

/**
 * Get all global categories
 */
export function getGlobalCategories(): GlobalCategory[] {
  return GLOBAL_CATEGORIES;
}

/**
 * Get category by ID
 */
export function getGlobalCategoryById(id: string): GlobalCategory | null {
  return GLOBAL_CATEGORIES.find(cat => cat.id === id) || null;
}

/**
 * Check if a subject/category is a global category
 */
export function isGlobalCategory(subjectId: string): boolean {
  return GLOBAL_CATEGORIES.some(cat => cat.id === subjectId);
}
