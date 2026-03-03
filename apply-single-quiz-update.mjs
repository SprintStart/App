import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://quhugpgfrnzvqugwibfp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1aHVncGdmcm56dnF1Z3dpYmZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4Mjk2MTAsImV4cCI6MjA4NTQwNTYxMH0.jzbvDz4Tg32ncuU-fFIvSjSU_NVyIt-JqJk3QMN8CUU';

const supabase = createClient(supabaseUrl, supabaseKey);

const QUIZ_ID = '87f1c5ba-359a-403b-9644-d9f55d08ce03';

console.log('\n🔄 Applying taxonomy update to single quiz...\n');
console.log('Quiz ID:', QUIZ_ID);
console.log('Update: country_code → GB, exam_code → A_LEVEL\n');

// Step 1: Get current state
console.log('📋 BEFORE UPDATE:');
const { data: before, error: beforeError } = await supabase
  .from('question_sets')
  .select('id, title, country_code, exam_code, school_id, approval_status, is_active')
  .eq('id', QUIZ_ID)
  .single();

if (beforeError) {
  console.error('❌ Error fetching quiz:', beforeError);
  process.exit(1);
}

console.log('  Title:', before.title);
console.log('  country_code:', before.country_code || 'NULL');
console.log('  exam_code:', before.exam_code || 'NULL');
console.log('  school_id:', before.school_id || 'NULL');
console.log('  approval_status:', before.approval_status);
console.log('  is_active:', before.is_active);
console.log('');

// Step 2: Apply update
console.log('⚙️  Applying update...');
const { error: updateError } = await supabase
  .from('question_sets')
  .update({
    country_code: 'GB',
    exam_code: 'A_LEVEL'
  })
  .eq('id', QUIZ_ID);

if (updateError) {
  console.error('❌ Error updating quiz:', updateError);
  process.exit(1);
}

console.log('✅ Update applied successfully\n');

// Step 3: Verify new state
console.log('📋 AFTER UPDATE:');
const { data: after, error: afterError } = await supabase
  .from('question_sets')
  .select('id, title, country_code, exam_code, school_id, approval_status, is_active')
  .eq('id', QUIZ_ID)
  .single();

if (afterError) {
  console.error('❌ Error fetching updated quiz:', afterError);
  process.exit(1);
}

console.log('  Title:', after.title);
console.log('  country_code:', after.country_code || 'NULL');
console.log('  exam_code:', after.exam_code || 'NULL');
console.log('  school_id:', after.school_id || 'NULL');
console.log('  approval_status:', after.approval_status);
console.log('  is_active:', after.is_active);
console.log('');

// Step 4: Validation
console.log('✅ VALIDATION:');
const checks = [
  { name: 'country_code changed to GB', pass: after.country_code === 'GB' },
  { name: 'exam_code changed to A_LEVEL', pass: after.exam_code === 'A_LEVEL' },
  { name: 'school_id remains NULL', pass: after.school_id === null },
  { name: 'approval_status unchanged', pass: after.approval_status === before.approval_status },
  { name: 'is_active unchanged', pass: after.is_active === before.is_active }
];

let allPassed = true;
checks.forEach(check => {
  const icon = check.pass ? '✅' : '❌';
  console.log(`  ${icon} ${check.name}`);
  if (!check.pass) allPassed = false;
});

console.log('');

if (allPassed) {
  console.log('🎉 All validation checks passed!');
  console.log('');
  console.log('📍 Next Steps:');
  console.log('  1. Visit the quiz in the UI to verify it displays correctly');
  console.log('  2. Check that quiz appears in GB/A_LEVEL filtered views');
  console.log('  3. Verify quiz is playable');
  console.log('  4. If successful, proceed with remaining 7 quizzes');
  console.log('');
} else {
  console.log('⚠️  Some validation checks failed!');
  console.log('Please review the results above.');
  process.exit(1);
}
