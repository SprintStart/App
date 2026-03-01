import { Link } from 'react-router-dom';
import {
  Gamepad2,
  Sparkles,
  BarChart3,
  Globe,
  FileText,
  CheckCircle,
  TrendingUp,
  Users,
  Brain,
  Target,
  Award
} from 'lucide-react';

export function TeachersPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-2">
            <img src="/startsprint_logo.png" alt="StartSprint Logo" className="h-10 w-auto" />
          </Link>
          <Link
            to="/teacher-login"
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </nav>

      <section className="max-w-7xl mx-auto px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full font-medium mb-6">
          <Award className="w-5 h-5" />
          For Educators
        </div>
        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
          Teach Smarter.<br />
          Measure Better.<br />
          Reach Further.
        </h1>
        <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
          Turn your knowledge into high-impact quizzes students actually want to play.
        </p>
        <p className="text-lg text-gray-700 mb-12 max-w-4xl mx-auto leading-relaxed">
          StartSprint empowers teachers to create gamified, VR-friendly quizzes and gain AI-powered insights into how students really learn — without student logins, admin overhead, or technical headaches.
        </p>
        <Link
          to="/teacher-login"
          className="inline-block px-10 py-5 bg-blue-600 text-white text-xl font-bold rounded-lg hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
        >
          Start Creating Today
        </Link>
        <p className="mt-4 text-gray-500">£99.99/year · Unlimited quizzes · Cancel anytime</p>
      </section>

      <section className="bg-white py-20 border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Why StartSprint for Teachers?
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Students play instantly. You get the insight.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-red-600 rounded-lg flex items-center justify-center">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">Traditional Tools</h3>
              </div>
              <p className="text-lg text-gray-700">Tell you what you uploaded.</p>
            </div>

            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
                  <Brain className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900">StartSprint</h3>
              </div>
              <p className="text-lg text-gray-700">Tells you what students understood.</p>
            </div>
          </div>

          <div className="mt-16 max-w-4xl mx-auto">
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-xl p-10">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">With one annual subscription, you can:</h3>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                  <span className="text-lg text-gray-700">Create interactive quizzes in minutes</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                  <span className="text-lg text-gray-700">Publish instantly to a global student audience</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                  <span className="text-lg text-gray-700">Track real engagement and learning outcomes</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                  <span className="text-lg text-gray-700">Use AI to improve question quality and impact</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-4xl font-bold text-gray-900 mb-4 text-center">What You Can Do</h2>
          <p className="text-xl text-gray-600 mb-16 text-center">Everything you need to create impactful learning experiences</p>

          <div className="grid md:grid-cols-2 gap-12">
            <div className="bg-white rounded-2xl shadow-lg p-10 border border-gray-200 hover:shadow-xl transition-shadow">
              <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center mb-6">
                <Gamepad2 className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-4">Create Gamified Quizzes Easily</h3>
              <div className="space-y-4 text-gray-700">
                <p className="text-lg">Create quizzes by subject and topic</p>
                <div>
                  <p className="font-semibold text-gray-900 mb-2">Add:</p>
                  <ul className="space-y-2 ml-5">
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                      Multiple Choice questions
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                      True / False questions
                    </li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 mb-2">Designed for:</p>
                  <ul className="space-y-2 ml-5">
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                      Large screens
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                      VR / immersive classrooms
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                      High engagement, low friction
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-10 border border-gray-200 hover:shadow-xl transition-shadow">
              <div className="w-16 h-16 bg-emerald-100 rounded-xl flex items-center justify-center mb-6">
                <Sparkles className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-4">Generate Quizzes with AI</h3>
              <div className="space-y-4 text-gray-700">
                <p className="text-lg">No time to write questions? Let AI help.</p>
                <div>
                  <p className="font-semibold text-gray-900 mb-2">You can:</p>
                  <ul className="space-y-2 ml-5">
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full"></div>
                      Upload a document (PDF or Word)
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full"></div>
                      Or describe a topic and learning goal
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full"></div>
                      AI generates questions instantly
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full"></div>
                      You review, edit, and publish
                    </li>
                  </ul>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                  <p className="text-emerald-900 font-medium">You stay in control. AI saves you time.</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-10 border border-gray-200 hover:shadow-xl transition-shadow">
              <div className="w-16 h-16 bg-amber-100 rounded-xl flex items-center justify-center mb-6">
                <BarChart3 className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-4">AI-Powered Analytics</h3>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <p className="text-amber-900 font-bold text-lg">The Real Value</p>
                <p className="text-amber-800">This is why teachers choose StartSprint.</p>
              </div>
              <div className="space-y-4 text-gray-700">
                <div>
                  <p className="font-semibold text-gray-900 mb-2">See:</p>
                  <ul className="space-y-2 ml-5">
                    <li className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      How many students played each quiz
                    </li>
                    <li className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      Where students struggle or drop off
                    </li>
                    <li className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      Which questions are too easy or too hard
                    </li>
                    <li className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      Completion rates and average scores
                    </li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 mb-2">Get AI insights, not just numbers:</p>
                  <ul className="space-y-2 ml-5">
                    <li className="text-sm bg-gray-50 p-3 rounded border border-gray-200 italic">
                      "This question may be confusing"
                    </li>
                    <li className="text-sm bg-gray-50 p-3 rounded border border-gray-200 italic">
                      "Students consistently fail option C"
                    </li>
                    <li className="text-sm bg-gray-50 p-3 rounded border border-gray-200 italic">
                      "Consider rephrasing this question"
                    </li>
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-gray-900 mb-2">Download reports for:</p>
                  <ul className="space-y-2 ml-5">
                    <li className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      Self-reflection
                    </li>
                    <li className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      Department reviews
                    </li>
                    <li className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      Evidence of impact
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-lg p-10 border border-gray-200 hover:shadow-xl transition-shadow">
              <div className="w-16 h-16 bg-cyan-100 rounded-xl flex items-center justify-center mb-6">
                <Globe className="w-8 h-8 text-cyan-600" />
              </div>
              <h3 className="text-3xl font-bold text-gray-900 mb-4">Reach Students Instantly</h3>
              <div className="space-y-4 text-gray-700">
                <p className="text-lg">Your quizzes appear automatically on the public student platform</p>
                <ul className="space-y-2 ml-5">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-cyan-600 rounded-full"></div>
                    Grouped by subject and topic
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-cyan-600 rounded-full"></div>
                    No student accounts required
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-cyan-600 rounded-full"></div>
                    No setup needed on your side
                  </li>
                </ul>
                <div>
                  <p className="font-semibold text-gray-900 mb-2">Students simply:</p>
                  <div className="flex items-center gap-3 text-lg">
                    <span className="font-bold text-cyan-600">Enter</span>
                    <span className="text-gray-400">→</span>
                    <span className="font-bold text-cyan-600">Pick a subject</span>
                    <span className="text-gray-400">→</span>
                    <span className="font-bold text-cyan-600">Start playing</span>
                  </div>
                </div>
                <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4 mt-6">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-5 h-5 text-cyan-700" />
                    <p className="font-semibold text-cyan-900">Zero-Friction Access</p>
                  </div>
                  <p className="text-cyan-800 text-sm">Students can start learning in seconds, from anywhere in the world.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-gradient-to-r from-blue-600 to-cyan-600 py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Ready to transform your teaching?</h2>
          <p className="text-xl text-blue-100 mb-10">Join educators who are creating engaging, data-driven learning experiences.</p>
          <Link
            to="/teacher-login"
            className="inline-block px-12 py-5 bg-white text-blue-600 text-xl font-bold rounded-lg hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            Get Started for £99.99/year
          </Link>
          <p className="mt-6 text-blue-100">Unlimited quizzes · AI-powered insights · Cancel anytime</p>
        </div>
      </section>

      <footer className="bg-gray-900 text-gray-400 py-12">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <div className="flex items-center justify-center mb-4">
            <img src="/startsprint_logo.png" alt="StartSprint Logo" className="h-12 w-auto" />
          </div>
          <p className="text-sm">© 2024 StartSprint. Empowering educators worldwide.</p>
        </div>
      </footer>
    </div>
  );
}
