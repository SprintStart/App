import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Brain } from 'lucide-react';

export function AIPolicy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <button onClick={() => navigate('/')} className="flex items-center gap-2">
              <img src="/startsprint_logo.png" alt="StartSprint Logo" className="h-10 w-auto" />
            </button>
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-2 text-gray-700 hover:text-blue-600 font-medium"
            >
              <ArrowLeft className="w-5 h-5" />
              Back
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <div className="flex items-center gap-4 mb-8">
          <Brain className="w-12 h-12 text-purple-600" />
          <h1 className="text-5xl font-black text-gray-900">AI Policy</h1>
        </div>

        <p className="text-sm text-gray-600 mb-8">Last updated: 2nd February 2026</p>

        <div className="prose prose-lg max-w-none space-y-6 text-gray-700">
          <p className="text-xl">
            StartSprint uses artificial intelligence to assist teachers in creating educational content and analyzing student performance. This policy explains how we use AI and our commitments to responsible AI use.
          </p>

          <div className="bg-purple-50 border-2 border-purple-200 rounded-lg p-6 my-8">
            <h2 className="text-2xl font-bold text-purple-900 mb-3">Core Principle</h2>
            <p className="text-purple-800 text-lg font-semibold">
              AI assists teachers; it does not replace professional judgement.
            </p>
          </div>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">1. How We Use AI</h2>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">AI-Assisted Quiz Generation:</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Generate quiz questions from topics or uploaded documents</li>
            <li>Suggest multiple-choice answers and distractors</li>
            <li>Extract key concepts from educational materials</li>
            <li>Teachers review and approve all AI-generated content before publication</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Performance Analytics:</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Identify patterns in student performance data</li>
            <li>Suggest areas where students may need additional support</li>
            <li>Highlight questions with unusual difficulty patterns</li>
            <li>Provide insights to inform teaching decisions</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Content Recommendations:</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Suggest related topics for quiz creation</li>
            <li>Recommend adjustments to question difficulty</li>
            <li>Identify gaps in curriculum coverage</li>
          </ul>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">2. What AI Does NOT Do</h2>
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
            <ul className="space-y-3 text-red-900">
              <li className="flex items-start gap-2">
                <span className="font-bold">✗</span>
                <span><strong>AI does not independently assess or label students.</strong> All student data is anonymous. AI analyzes patterns, not individuals.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">✗</span>
                <span><strong>AI does not make educational decisions.</strong> Teachers remain fully responsible for all teaching and assessment decisions.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">✗</span>
                <span><strong>AI does not interact directly with students.</strong> There is no AI chatbot or direct AI-student communication.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">✗</span>
                <span><strong>AI does not use student personal data for training.</strong> Student gameplay is anonymous and not used to train AI models.</span>
              </li>
            </ul>
          </div>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">3. Teacher Responsibilities</h2>
          <p>When using AI-assisted features:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Review all AI-generated content</strong> before publishing to students</li>
            <li><strong>Verify factual accuracy</strong> of AI-generated questions and answers</li>
            <li><strong>Ensure age-appropriate content</strong> and language</li>
            <li><strong>Check for bias</strong> or inappropriate material</li>
            <li><strong>Use professional judgement</strong> when interpreting AI insights</li>
            <li><strong>Understand AI limitations</strong> - AI can make mistakes</li>
          </ul>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">4. Data Privacy & AI</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>No student personal data</strong> is used to train AI models</li>
            <li><strong>Gameplay data is anonymized</strong> before any AI analysis</li>
            <li><strong>Teacher-created content</strong> may be analyzed to improve suggestions (opt-out available)</li>
            <li><strong>AI processing happens securely</strong> within our infrastructure</li>
            <li><strong>Third-party AI services</strong> (if used) comply with UK GDPR</li>
          </ul>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">5. Transparency & Explainability</h2>
          <p>We are committed to transparency:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>AI-generated content is clearly labeled as such</li>
            <li>AI recommendations include explanations where possible</li>
            <li>Teachers can always choose to ignore AI suggestions</li>
            <li>We document which features use AI</li>
          </ul>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">6. AI Model Selection</h2>
          <p>We use AI models that:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Are appropriate for educational contexts</li>
            <li>Comply with UK data protection requirements</li>
            <li>Have been tested for bias and accuracy</li>
            <li>Are regularly updated and monitored</li>
          </ul>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">7. Handling AI Errors</h2>
          <p>AI can make mistakes. We commit to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Clear labeling of AI-generated content</li>
            <li>Easy reporting mechanisms for incorrect AI outputs</li>
            <li>Rapid response to reports of inappropriate content</li>
            <li>Continuous improvement of AI accuracy</li>
            <li>Never claiming AI is infallible</li>
          </ul>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">8. Safeguarding & AI</h2>
          <p>In line with our safeguarding commitments:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>AI does not have access to student identities</li>
            <li>AI cannot send messages to students</li>
            <li>AI-generated content is filtered for inappropriate material</li>
            <li>Teachers review all AI content before student exposure</li>
          </ul>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">9. Future AI Development</h2>
          <p>As AI technology evolves:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>We will update this policy to reflect new AI uses</li>
            <li>Teachers will be notified of significant AI feature changes</li>
            <li>We will maintain our human-in-the-loop approach</li>
            <li>Education and professional judgement remain central</li>
          </ul>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">10. Contact & Feedback</h2>
          <p>
            We welcome feedback on our AI features:
          </p>
          <p className="font-semibold mt-2">Email: <a href="mailto:ai@startsprint.app" className="text-blue-600 hover:underline">ai@startsprint.app</a></p>

          <div className="bg-gray-100 rounded-lg p-6 mt-12">
            <h3 className="text-xl font-bold text-gray-900 mb-3">Summary</h3>
            <ul className="space-y-2 text-gray-700">
              <li>✓ AI assists teachers; it does not replace professional judgement</li>
              <li>✓ AI does not independently assess or label students</li>
              <li>✓ Teachers remain responsible for educational decisions</li>
              <li>✓ AI outputs should be reviewed before classroom use</li>
              <li>✓ No student personal data is used to train AI models</li>
              <li>✓ AI-generated content is clearly labeled</li>
              <li>✓ We are transparent about AI capabilities and limitations</li>
            </ul>
          </div>
        </div>
      </main>

      <footer className="bg-gray-900 text-white py-12 mt-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-gray-400">© 2026 StartSprint. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
