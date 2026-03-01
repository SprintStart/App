import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Shield, Users, Target } from 'lucide-react';

export function AboutPage() {
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
        <h1 className="text-5xl font-black text-gray-900 mb-8">About StartSprint</h1>

        <div className="space-y-8 text-lg text-gray-700 leading-relaxed">
          <p>
            StartSprint is an education technology platform designed to help teachers assess learning
            quickly, clearly, and fairly.
          </p>

          <p>
            Built with classrooms in mind, StartSprint enables teachers to create interactive quizzes,
            analyse learner understanding in real time, and make informed teaching decisions using
            AI-supported insights.
          </p>

          <div className="grid md:grid-cols-2 gap-6 my-12">
            <div className="bg-white p-6 rounded-lg border-2 border-gray-200">
              <Building2 className="w-10 h-10 text-blue-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">For UK Schools & Colleges</h3>
              <p className="text-gray-600">
                Designed to meet the needs of UK educational institutions with safeguarding and GDPR
                compliance built in.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg border-2 border-gray-200">
              <Users className="w-10 h-10 text-green-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">Individual Educators</h3>
              <p className="text-gray-600">
                Perfect for individual teachers who want powerful tools without complex setup or
                administration.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg border-2 border-gray-200">
              <Building2 className="w-10 h-10 text-purple-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">Multi-Academy Trusts</h3>
              <p className="text-gray-600">
                Bulk licensing options available for MATs and school groups looking for consistent
                assessment tools.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg border-2 border-gray-200">
              <Shield className="w-10 h-10 text-orange-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-2">Classroom-Safe Environments</h3>
              <p className="text-gray-600">
                No student accounts, no messaging, no advertising to learners. Built with safeguarding
                as a priority.
              </p>
            </div>
          </div>

          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-8 my-12">
            <div className="flex items-start gap-4">
              <Target className="w-12 h-12 text-blue-600 flex-shrink-0" />
              <div>
                <h2 className="text-3xl font-black text-gray-900 mb-4">Our Mission</h2>
                <p className="text-xl text-gray-700">
                  To empower teachers with simple, intelligent tools that improve learning outcomes
                  without adding workload.
                </p>
              </div>
            </div>
          </div>

          <h2 className="text-3xl font-black text-gray-900 mt-12 mb-6">We believe assessment should be:</h2>

          <div className="space-y-4">
            <div className="flex items-start gap-4 bg-white p-6 rounded-lg border-2 border-gray-200">
              <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">
                ✓
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1">Fast to create</h3>
                <p className="text-gray-600">
                  Teachers should spend time teaching, not building assessments from scratch.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 bg-white p-6 rounded-lg border-2 border-gray-200">
              <div className="bg-green-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">
                ✓
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1">Easy to understand</h3>
                <p className="text-gray-600">
                  Clear insights that inform teaching decisions, not just raw data dumps.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 bg-white p-6 rounded-lg border-2 border-gray-200">
              <div className="bg-purple-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">
                ✓
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1">Safe for learners</h3>
                <p className="text-gray-600">
                  No accounts, no data collection, no advertising. Student welfare first.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 bg-white p-6 rounded-lg border-2 border-gray-200">
              <div className="bg-orange-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold flex-shrink-0">
                ✓
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1">Useful for teaching, not just grading</h3>
                <p className="text-gray-600">
                  Assessment should improve learning, not just measure it.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-100 rounded-lg p-8 mt-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Get in Touch</h2>
            <p className="text-gray-700 mb-4">
              Interested in StartSprint for your school or trust? We'd love to hear from you.
            </p>
            <button
              onClick={() => navigate('/contact')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
            >
              Contact Us
            </button>
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
