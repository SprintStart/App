import { ArrowRight, Target, Users, Globe } from 'lucide-react';
import { Link } from 'react-router-dom';

export function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">About StartSprint</h1>

        <div className="prose prose-lg max-w-none">
          <p className="text-xl text-gray-700 mb-8">
            StartSprint is transforming how teachers create and deliver educational assessments
            through AI-powered quiz generation and real-time analytics.
          </p>

          <div className="bg-blue-50 border-l-4 border-blue-600 p-6 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Our Story</h2>
            <p className="text-gray-700">
              Founded by educators who experienced firsthand the time-consuming challenge of creating
              quality assessments, StartSprint was built to give teachers back their most valuable
              resource: time. We believe technology should amplify teaching, not complicate it.
            </p>
          </div>

          <h2 className="text-3xl font-bold text-gray-900 mb-6 mt-12">What Makes Us Different</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
              <Target className="w-12 h-12 text-blue-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Teacher-First Design</h3>
              <p className="text-gray-600">
                Built by teachers, for teachers. Every feature is designed to solve real classroom challenges.
              </p>
            </div>

            <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
              <Users className="w-12 h-12 text-green-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Student-Centric</h3>
              <p className="text-gray-600">
                No logins or accounts required for students. Just share a code and they're learning.
              </p>
            </div>

            <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
              <Globe className="w-12 h-12 text-purple-600 mb-4" />
              <h3 className="text-xl font-bold text-gray-900 mb-3">Global Reach</h3>
              <p className="text-gray-600">
                Your quizzes work anywhere, anytime. Perfect for in-class, homework, or remote learning.
              </p>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-gray-900 mb-6">Our Technology</h2>
          <p className="text-gray-700 mb-4">
            StartSprint leverages cutting-edge AI to generate high-quality quiz questions across
            12 subject areas. Our platform uses advanced language models to create questions that
            are pedagogically sound, age-appropriate, and aligned with learning objectives.
          </p>
          <p className="text-gray-700 mb-8">
            Real-time analytics powered by modern data infrastructure give you instant insights
            into student performance, question difficulty, and learning gaps.
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mb-6">Our Commitment</h2>
          <p className="text-gray-700 mb-4">
            We're committed to:
          </p>
          <ul className="list-disc list-inside text-gray-700 mb-8 space-y-2">
            <li>Protecting student privacy with anonymous participation</li>
            <li>Keeping our platform simple and distraction-free</li>
            <li>Supporting teachers with responsive customer service</li>
            <li>Continuously improving based on educator feedback</li>
            <li>Making quality educational tools accessible and affordable</li>
          </ul>

          <div className="bg-gray-50 rounded-lg p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Join Thousands of Teachers</h2>
            <p className="text-gray-700 mb-6">
              Teachers worldwide trust StartSprint to create engaging assessments and track
              student progress. Start your journey today.
            </p>
            <Link
              to="/teachers"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
            >
              Get Started
              <ArrowRight className="w-5 h-5" />
            </Link>
          </div>

          <h2 className="text-3xl font-bold text-gray-900 mb-6">Contact Us</h2>
          <p className="text-gray-700">
            Have questions or feedback? We'd love to hear from you at{' '}
            <a href="mailto:support@startsprint.com" className="text-blue-600 hover:text-blue-800 font-medium">
              support@startsprint.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
