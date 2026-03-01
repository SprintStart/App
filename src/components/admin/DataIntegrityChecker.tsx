import { useState } from 'react';
import { AlertTriangle, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface IntegrityIssue {
  severity: 'error' | 'warning' | 'info';
  category: string;
  description: string;
  count: number;
  affectedIds?: string[];
}

export function DataIntegrityChecker() {
  const [checking, setChecking] = useState(false);
  const [issues, setIssues] = useState<IntegrityIssue[]>([]);
  const [lastCheckTime, setLastCheckTime] = useState<string | null>(null);

  async function runIntegrityCheck() {
    setChecking(true);
    const foundIssues: IntegrityIssue[] = [];

    try {
      // Check 1: Quizzes without school_id
      const { data: quizzesNoSchool } = await supabase
        .from('question_sets')
        .select('id')
        .is('school_id', null);

      if (quizzesNoSchool && quizzesNoSchool.length > 0) {
        foundIssues.push({
          severity: 'info',
          category: 'Quiz Assignment',
          description: 'Global quizzes without school assignment (this is expected for global content)',
          count: quizzesNoSchool.length,
          affectedIds: quizzesNoSchool.map(q => q.id).slice(0, 5),
        });
      }

      // Check 2: Teachers without school_id
      const { data: teachersNoSchool } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('role', 'teacher')
        .is('school_id', null);

      if (teachersNoSchool && teachersNoSchool.length > 0) {
        foundIssues.push({
          severity: 'error',
          category: 'Teacher Assignment',
          description: 'Teachers without school assignment',
          count: teachersNoSchool.length,
          affectedIds: teachersNoSchool.map(t => t.id).slice(0, 5),
        });
      }

      // Check 3: Topics without school_id (if required)
      const { data: topicsNoSchool } = await supabase
        .from('topics')
        .select('id, name')
        .is('school_id', null);

      if (topicsNoSchool && topicsNoSchool.length > 0) {
        foundIssues.push({
          severity: 'info',
          category: 'Topic Assignment',
          description: 'Global topics without school assignment (expected for shared content)',
          count: topicsNoSchool.length,
        });
      }

      // Check 4: Orphaned quiz references (question_sets with invalid topic_id)
      const { data: orphanedQuizzes } = await supabase
        .from('question_sets')
        .select('id, topic_id')
        .not('topic_id', 'is', null);

      if (orphanedQuizzes) {
        const topicIds = [...new Set(orphanedQuizzes.map(q => q.topic_id))];
        const { data: validTopics } = await supabase
          .from('topics')
          .select('id')
          .in('id', topicIds);

        const validTopicIds = new Set(validTopics?.map(t => t.id) || []);
        const orphaned = orphanedQuizzes.filter(q => !validTopicIds.has(q.topic_id));

        if (orphaned.length > 0) {
          foundIssues.push({
            severity: 'error',
            category: 'Orphaned Quizzes',
            description: 'Quizzes referencing non-existent topics',
            count: orphaned.length,
            affectedIds: orphaned.map(q => q.id).slice(0, 5),
          });
        }
      }

      // Check 5: School mismatch (question_set.school_id != topic.school_id)
      const { data: quizzesWithSchool } = await supabase
        .from('question_sets')
        .select('id, school_id, topic_id')
        .not('school_id', 'is', null)
        .not('topic_id', 'is', null);

      if (quizzesWithSchool && quizzesWithSchool.length > 0) {
        const topicIds = [...new Set(quizzesWithSchool.map(q => q.topic_id))];
        const { data: topics } = await supabase
          .from('topics')
          .select('id, school_id')
          .in('id', topicIds);

        const topicSchoolMap = new Map(topics?.map(t => [t.id, t.school_id]) || []);
        const mismatched = quizzesWithSchool.filter(q => {
          const topicSchoolId = topicSchoolMap.get(q.topic_id);
          return topicSchoolId !== undefined && topicSchoolId !== q.school_id;
        });

        if (mismatched.length > 0) {
          foundIssues.push({
            severity: 'error',
            category: 'School Mismatch',
            description: 'Quizzes with school_id different from their topic school_id',
            count: mismatched.length,
            affectedIds: mismatched.map(q => q.id).slice(0, 5),
          });
        }
      }

      // Check 6: Quiz sessions without quiz_session_id
      const { data: orphanedRuns } = await supabase
        .from('public_quiz_runs')
        .select('id')
        .is('quiz_session_id', null);

      if (orphanedRuns && orphanedRuns.length > 0) {
        foundIssues.push({
          severity: 'error',
          category: 'Orphaned Quiz Runs',
          description: 'Quiz runs without valid quiz_session_id',
          count: orphanedRuns.length,
          affectedIds: orphanedRuns.map(r => r.id).slice(0, 5),
        });
      }

      // Check 7: Questions without question_set_id
      const { data: orphanedQuestions } = await supabase
        .from('topic_questions')
        .select('id')
        .is('question_set_id', null);

      if (orphanedQuestions && orphanedQuestions.length > 0) {
        foundIssues.push({
          severity: 'error',
          category: 'Orphaned Questions',
          description: 'Questions without a question set',
          count: orphanedQuestions.length,
          affectedIds: orphanedQuestions.map(q => q.id).slice(0, 5),
        });
      }

      // Check 8: Invalid question_sets (no questions)
      const { data: allQuestionSets } = await supabase
        .from('question_sets')
        .select('id');

      if (allQuestionSets) {
        const setIds = allQuestionSets.map(qs => qs.id);
        const { data: questionsCount } = await supabase
          .from('topic_questions')
          .select('question_set_id')
          .in('question_set_id', setIds);

        const setsWithQuestions = new Set(questionsCount?.map(q => q.question_set_id) || []);
        const emptySets = allQuestionSets.filter(qs => !setsWithQuestions.has(qs.id));

        if (emptySets.length > 0) {
          foundIssues.push({
            severity: 'warning',
            category: 'Empty Quizzes',
            description: 'Question sets with no questions',
            count: emptySets.length,
            affectedIds: emptySets.map(s => s.id).slice(0, 5),
          });
        }
      }

      setIssues(foundIssues);
      setLastCheckTime(new Date().toISOString());
    } catch (error) {
      console.error('Integrity check error:', error);
      foundIssues.push({
        severity: 'error',
        category: 'Check Failed',
        description: 'Failed to complete integrity check: ' + (error as Error).message,
        count: 0,
      });
      setIssues(foundIssues);
    } finally {
      setChecking(false);
    }
  }

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const totalIssues = errorCount + warningCount;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Data Integrity Checker</h2>
          <p className="text-sm text-gray-600 mt-1">
            Verify database consistency and identify data issues
          </p>
        </div>
        <button
          onClick={runIntegrityCheck}
          disabled={checking}
          className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
        >
          {checking ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <AlertTriangle className="w-5 h-5" />
              Run Integrity Check
            </>
          )}
        </button>
      </div>

      {lastCheckTime && (
        <div className="mb-4 text-sm text-gray-600">
          Last checked: {new Date(lastCheckTime).toLocaleString()}
        </div>
      )}

      {issues.length === 0 && lastCheckTime && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 flex items-center gap-4">
          <CheckCircle className="w-8 h-8 text-green-600 flex-shrink-0" />
          <div>
            <h3 className="font-semibold text-green-900">All Checks Passed</h3>
            <p className="text-sm text-green-700">No data integrity issues found</p>
          </div>
        </div>
      )}

      {issues.length > 0 && (
        <>
          <div className="mb-6 flex gap-4">
            {errorCount > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex-1">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <span className="font-semibold text-red-900">{errorCount} Errors</span>
                </div>
              </div>
            )}
            {warningCount > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex-1">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  <span className="font-semibold text-yellow-900">{warningCount} Warnings</span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {issues.map((issue, index) => (
              <div
                key={index}
                className={`border rounded-lg p-4 ${
                  issue.severity === 'error'
                    ? 'bg-red-50 border-red-200'
                    : issue.severity === 'warning'
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  {issue.severity === 'error' ? (
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  ) : issue.severity === 'warning' ? (
                    <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-semibold text-gray-900">{issue.category}</h4>
                      <span
                        className={`text-sm font-medium ${
                          issue.severity === 'error'
                            ? 'text-red-700'
                            : issue.severity === 'warning'
                            ? 'text-yellow-700'
                            : 'text-blue-700'
                        }`}
                      >
                        {issue.count} affected
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{issue.description}</p>
                    {issue.affectedIds && issue.affectedIds.length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-600 cursor-pointer">
                          Show affected IDs (first 5)
                        </summary>
                        <div className="mt-2 bg-white bg-opacity-50 rounded p-2 text-xs font-mono">
                          {issue.affectedIds.map(id => (
                            <div key={id} className="text-gray-700">
                              {id}
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
