import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envFile = readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...values] = line.split('=');
  if (key && values.length) {
    env[key.trim()] = values.join('=').trim();
  }
});

const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_ANON_KEY
);

async function getCounts() {
  const { data: global, error: gErr } = await supabase
    .from('question_sets')
    .select('id, title, topic_id')
    .is('exam_system_id', null)
    .is('school_id', null);

  const { data: exam, error: eErr } = await supabase
    .from('question_sets')
    .select('id, title, exam_system_id')
    .not('exam_system_id', 'is', null)
    .is('school_id', null);

  const { data: school, error: sErr } = await supabase
    .from('question_sets')
    .select('id, title, school_id')
    .not('school_id', 'is', null);

  console.log('=== BEFORE MIGRATION COUNTS ===');
  console.log('GLOBAL quizzes (exam_system_id=NULL, school_id=NULL):', global?.length || 0);
  console.log('EXAM quizzes (exam_system_id NOT NULL, school_id=NULL):', exam?.length || 0);
  console.log('SCHOOL quizzes (school_id NOT NULL):', school?.length || 0);
  console.log('TOTAL:', (global?.length || 0) + (exam?.length || 0) + (school?.length || 0));
  console.log('');

  const { data: topics } = await supabase
    .from('topics')
    .select('id, name, subject');

  const topicMap = {};
  topics?.forEach(t => { topicMap[t.id] = t; });

  const curriculumInGlobal = global?.filter(q => {
    const topic = topicMap[q.topic_id];
    if (!topic) return false;
    const text = (topic.name + ' ' + topic.subject + ' ' + q.title).toLowerCase();
    return text.includes('gcse') || text.includes('a-level') || text.includes('a level') ||
           text.includes('btec') || text.includes('bece') || text.includes('wassce') ||
           text.includes('as level');
  });

  console.log('=== CURRICULUM QUIZZES CURRENTLY IN GLOBAL ===');
  console.log('Count:', curriculumInGlobal?.length || 0);
  if (curriculumInGlobal && curriculumInGlobal.length > 0) {
    console.log('');
    console.log('Quizzes that will be reassigned:');
    curriculumInGlobal.forEach(q => {
      const topic = topicMap[q.topic_id];
      console.log(`  ${q.id} | "${q.title}" | Topic: ${topic?.name} (${topic?.subject}) | GLOBAL → EXAM`);
    });
  }

  console.log('');
  console.log('=== READY TO APPLY MIGRATION ===');
}

getCounts().catch(err => console.error('Error:', err.message));
