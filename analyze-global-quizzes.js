import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeGlobalQuizzes() {
  console.log('='.repeat(80));
  console.log('GLOBAL QUIZ LIBRARY ANALYSIS - BEFORE RESTRUCTURE');
  console.log('='.repeat(80));

  // Get all quizzes with their scope
  const { data: allQuizzes, error } = await supabase
    .from('question_sets')
    .select(`
      id,
      title,
      country_id,
      exam_board_id,
      school_id,
      published,
      play_count,
      topics!inner(title, subject)
    `);

  if (error) {
    console.error('Error fetching quizzes:', error);
    return;
  }

  // Classify quizzes
  const trulyGlobal = allQuizzes.filter(q => !q.country_id && !q.exam_board_id && !q.school_id);
  const countryExam = allQuizzes.filter(q => (q.country_id || q.exam_board_id) && !q.school_id);
  const schoolScoped = allQuizzes.filter(q => q.school_id);

  console.log('\n📊 QUIZ SCOPE DISTRIBUTION:');
  console.log(`Total Quizzes: ${allQuizzes.length}`);
  console.log(`Truly Global (no country/exam/school): ${trulyGlobal.length}`);
  console.log(`Country/Exam Scoped: ${countryExam.length}`);
  console.log(`School Scoped: ${schoolScoped.length}`);

  console.log('\n🌍 TRULY GLOBAL QUIZZES:');
  if (trulyGlobal.length > 0) {
    trulyGlobal.forEach(q => {
      console.log(`  - ${q.title} (${q.topics?.subject || 'N/A'}) | Published: ${q.published} | Plays: ${q.play_count || 0}`);
    });
  } else {
    console.log('  None found');
  }

  console.log('\n🚨 MISCLASSIFIED AS GLOBAL (has country/exam but shown as global):');
  // These would appear in global but shouldn't
  const misclassified = allQuizzes.filter(q =>
    !q.school_id &&
    (q.country_id || q.exam_board_id) &&
    q.published
  );

  if (misclassified.length > 0) {
    misclassified.forEach(q => {
      console.log(`  - ${q.title}`);
      console.log(`    Country ID: ${q.country_id || 'NULL'}, Exam ID: ${q.exam_board_id || 'NULL'}`);
      console.log(`    Subject: ${q.topics?.subject || 'N/A'}, Plays: ${q.play_count || 0}`);
    });
  } else {
    console.log('  None found - good!');
  }

  // Get countries and exam systems
  const { data: countries } = await supabase
    .from('countries')
    .select('id, name, code');

  const { data: exams } = await supabase
    .from('exam_systems')
    .select('id, name, country_id');

  console.log('\n📚 AVAILABLE COUNTRIES & EXAM SYSTEMS:');
  if (countries) {
    countries.forEach(c => {
      console.log(`  ${c.name} (${c.code}): ID=${c.id}`);
      const countryExams = exams?.filter(e => e.country_id === c.id);
      if (countryExams && countryExams.length > 0) {
        countryExams.forEach(e => {
          console.log(`    └─ ${e.name}: ID=${e.id}`);
        });
      }
    });
  }

  console.log('\n' + '='.repeat(80));
}

analyzeGlobalQuizzes().catch(console.error);
