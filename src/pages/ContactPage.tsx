import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Building2, HelpCircle, Shield } from 'lucide-react';

export function ContactPage() {
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
          <Mail className="w-12 h-12 text-blue-600" />
          <h1 className="text-5xl font-black text-gray-900">Contact Us</h1>
        </div>

        <p className="text-xl text-gray-700 mb-12">
          We're here to help. Choose the best contact method for your query below.
        </p>

        <div className="grid md:grid-cols-2 gap-6 mb-12">
          <div className="bg-white p-8 rounded-xl border-2 border-blue-200 shadow-sm">
            <div className="bg-blue-600 rounded-full p-4 w-fit mb-4">
              <HelpCircle className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">General Support</h2>
            <p className="text-gray-700 mb-4">
              Questions about your account, billing, technical issues, or general inquiries.
            </p>
            <a
              href="mailto:support@startsprint.app"
              className="text-blue-600 hover:text-blue-700 font-semibold text-lg"
            >
              support@startsprint.app
            </a>
            <p className="text-sm text-gray-600 mt-3">
              Response within 1-2 working days
            </p>
          </div>

          <div className="bg-white p-8 rounded-xl border-2 border-green-200 shadow-sm">
            <div className="bg-green-600 rounded-full p-4 w-fit mb-4">
              <Building2 className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Schools & Trusts</h2>
            <p className="text-gray-700 mb-4">
              Bulk licensing, institutional accounts, integration support, or procurement queries.
            </p>
            <a
              href="mailto:info@startsprint.app"
              className="text-green-600 hover:text-green-700 font-semibold text-lg"
            >
              info@startsprint.app
            </a>
            <p className="text-sm text-gray-600 mt-3">
              Priority response for institutional inquiries
            </p>
          </div>

          <div className="bg-white p-8 rounded-xl border-2 border-orange-200 shadow-sm">
            <div className="bg-orange-600 rounded-full p-4 w-fit mb-4">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Safeguarding Concerns</h2>
            <p className="text-gray-700 mb-4">
              Report inappropriate content, user behavior, or safeguarding issues.
            </p>
            <a
              href="mailto:info@startsprint.app"
              className="text-orange-600 hover:text-orange-700 font-semibold text-lg"
            >
              info@startsprint.app
            </a>
            <p className="text-sm text-gray-600 mt-3">
              Urgent concerns addressed within 24 hours
            </p>
          </div>

          <div className="bg-white p-8 rounded-xl border-2 border-purple-200 shadow-sm">
            <div className="bg-purple-600 rounded-full p-4 w-fit mb-4">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">Legal & Privacy</h2>
            <p className="text-gray-700 mb-4">
              GDPR requests, data access, privacy questions, or legal matters.
            </p>
            <a
              href="mailto:info@startsprint.app"
              className="text-purple-600 hover:text-purple-700 font-semibold text-lg"
            >
              info@startsprint.app
            </a>
            <p className="text-sm text-gray-600 mt-3">
              Data subject requests processed within 30 days
            </p>
          </div>
        </div>

        <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-8 mb-12">
          <h2 className="text-2xl font-bold text-blue-900 mb-4">Before You Contact Us</h2>
          <p className="text-blue-800 mb-4">
            You might find answers to common questions in our documentation:
          </p>
          <div className="space-y-2">
            <button
              onClick={() => navigate('/about')}
              className="block text-blue-700 hover:text-blue-900 hover:underline font-medium"
            >
              → About StartSprint & Our Mission
            </button>
            <button
              onClick={() => navigate('/privacy')}
              className="block text-blue-700 hover:text-blue-900 hover:underline font-medium"
            >
              → Privacy Policy & Data Protection
            </button>
            <button
              onClick={() => navigate('/terms')}
              className="block text-blue-700 hover:text-blue-900 hover:underline font-medium"
            >
              → Terms of Service & Refund Policy
            </button>
            <button
              onClick={() => navigate('/ai-policy')}
              className="block text-blue-700 hover:text-blue-900 hover:underline font-medium"
            >
              → AI Policy & How We Use AI
            </button>
            <button
              onClick={() => navigate('/safeguarding')}
              className="block text-blue-700 hover:text-blue-900 hover:underline font-medium"
            >
              → Safeguarding Statement
            </button>
          </div>
        </div>

        <div className="bg-gray-100 rounded-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Response Times</h2>
          <ul className="space-y-3 text-gray-700">
            <li className="flex items-start gap-3">
              <span className="text-green-600 font-bold">✓</span>
              <span><strong>Safeguarding concerns:</strong> Within 24 hours</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-600 font-bold">✓</span>
              <span><strong>Schools & institutional queries:</strong> Priority response, typically same or next working day</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-600 font-bold">✓</span>
              <span><strong>General support:</strong> 1-2 working days</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="text-green-600 font-bold">✓</span>
              <span><strong>GDPR data requests:</strong> Within 30 days as required by law</span>
            </li>
          </ul>
          <p className="text-sm text-gray-600 mt-4">
            Response times are for initial acknowledgment. Resolution times vary by complexity.
          </p>
        </div>

        <div className="bg-green-50 border-2 border-green-300 rounded-lg p-8 mt-12">
          <h2 className="text-2xl font-bold text-green-900 mb-4">For Schools & Multi-Academy Trusts</h2>
          <p className="text-green-800 mb-4">
            If you're considering StartSprint for your school or trust, we'd love to discuss:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-green-800 mb-6">
            <li>Bulk licensing options</li>
            <li>Domain-based automatic access for your teachers</li>
            <li>Integration with your existing systems</li>
            <li>Training and onboarding support</li>
            <li>Custom configurations for your needs</li>
          </ul>
          <a
            href="mailto:info@startsprint.app?subject=Institutional%20Inquiry"
            className="inline-block px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
          >
            Get in Touch About Bulk Licensing
          </a>
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
