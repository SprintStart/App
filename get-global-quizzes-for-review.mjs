import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://quhugpgfrnzvqugwibfp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1aHVncGdmcm56dnF1Z3dpYmZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4Mjk2MTAsImV4cCI6MjA4NTQwNTYxMH0.jzbvDz4Tg32ncuU-fFIvSjSU_NVyIt-JqJk3QMN8CUU';

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('\n🔍 Fetching GLOBAL quizzes with exam keywords...\n');

// Get all GLOBAL quizzes with exam keywords
const { data: quizzes, error } = await supabase
  .from('question_sets')
  .select(`
    id,
    title,
    country_code,
    exam_code,
    approval_status,
    created_at,
    topics!inner(
      name,
      subject
    )
  `)
  .is('school_id', null)
  .or('title.ilike.%AQA%,title.ilike.%OCR%,title.ilike.%Edexcel%,title.ilike.%GCSE%,title.ilike.%A-Level%,title.ilike.%A Level%,title.ilike.%WASSCE%,title.ilike.%SAT%,title.ilike.%AP %,title.ilike.%IB %,title.ilike.%IGCSE%,title.ilike.%International Baccalaureate%')
  .order('title');

if (error) {
  console.error('Error:', error);
  process.exit(1);
}

// Function to suggest mapping based on keywords
function suggestMapping(title) {
  const t = title.toLowerCase();

  if (t.includes('aqa')) return { country: 'GB', exam: 'A_LEVEL', board: 'AQA' };
  if (t.includes('ocr')) return { country: 'GB', exam: 'A_LEVEL', board: 'OCR' };
  if (t.includes('edexcel')) return { country: 'GB', exam: 'A_LEVEL', board: 'Edexcel' };
  if (t.includes('gcse')) return { country: 'GB', exam: 'GCSE', board: '' };
  if (t.includes('a-level') || t.includes('a level')) return { country: 'GB', exam: 'A_LEVEL', board: '' };
  if (t.includes('wassce')) return { country: 'GH', exam: 'WASSCE', board: '' };
  if (t.includes('sat')) return { country: 'US', exam: 'SAT', board: '' };
  if (t.includes('ap ')) return { country: 'US', exam: 'AP', board: '' };
  if (t.includes('ib ') || t.includes('international baccalaureate')) return { country: 'INTL', exam: 'IB', board: '' };
  if (t.includes('igcse')) return { country: 'INTL', exam: 'IGCSE', board: '' };

  return { country: 'REVIEW', exam: 'REVIEW', board: '' };
}

// Group by suggested mapping
const grouped = {};
quizzes.forEach(quiz => {
  const suggestion = suggestMapping(quiz.title);
  const key = `${suggestion.country}/${suggestion.exam}`;

  if (!grouped[key]) {
    grouped[key] = [];
  }

  grouped[key].push({
    id: quiz.id,
    title: quiz.title,
    current_country: quiz.country_code || 'NULL',
    current_exam: quiz.exam_code || 'NULL',
    suggested_country: suggestion.country,
    suggested_exam: suggestion.exam,
    board: suggestion.board,
    topic: quiz.topics?.name || 'N/A',
    subject: quiz.topics?.subject || 'N/A',
    status: quiz.approval_status
  });
});

// Output results
console.log('═══════════════════════════════════════════════════════════════');
console.log('GLOBAL QUIZZES WITH EXAM KEYWORDS - MAPPING REVIEW');
console.log('═══════════════════════════════════════════════════════════════\n');

let totalCount = 0;
Object.keys(grouped).sort().forEach(mapping => {
  const quizzes = grouped[mapping];
  totalCount += quizzes.length;

  console.log(`\n📍 ${mapping} (${quizzes.length} quizzes)`);
  console.log('─'.repeat(70));

  quizzes.forEach(q => {
    console.log(`\n  ID: ${q.id}`);
    console.log(`  Title: ${q.title}`);
    console.log(`  Subject/Topic: ${q.subject} > ${q.topic}`);
    console.log(`  Current: country_code=${q.current_country}, exam_code=${q.current_exam}`);
    console.log(`  Suggested: country_code=${q.suggested_country}, exam_code=${q.suggested_exam}`);
    if (q.board) console.log(`  Exam Board: ${q.board}`);
    console.log(`  Status: ${q.status}`);
  });
});

console.log('\n\n═══════════════════════════════════════════════════════════════');
console.log(`TOTAL GLOBAL QUIZZES WITH EXAM KEYWORDS: ${totalCount}`);
console.log('═══════════════════════════════════════════════════════════════\n');

// Summary statistics
console.log('\n📊 SUMMARY BY MAPPING:\n');
Object.keys(grouped).sort().forEach(mapping => {
  console.log(`  ${mapping.padEnd(20)} → ${grouped[mapping].length} quizzes`);
});

console.log('\n\n✅ Review complete. Approve mappings before running updates.\n');
