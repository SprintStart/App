import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';

export function TermsOfService() {
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
          <FileText className="w-12 h-12 text-blue-600" />
          <h1 className="text-5xl font-black text-gray-900">Terms of Service</h1>
        </div>

        <p className="text-sm text-gray-600 mb-8">Last updated: 2nd February 2026</p>

        <div className="prose prose-lg max-w-none space-y-6 text-gray-700">
          <p className="text-xl">
            These Terms of Service govern your use of StartSprint. By creating an account, you agree to these terms.
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">1. Service Description</h2>
          <p>
            StartSprint is a subscription-based online platform that enables teachers to create, publish, and analyse interactive quizzes for students.
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">2. Account Eligibility</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>You must be 18 years or older to create a teacher account</li>
            <li>You must provide accurate information during registration</li>
            <li>You are responsible for maintaining the security of your account credentials</li>
            <li>One teacher account per person</li>
          </ul>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">3. Subscription & Billing</h2>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Plans Available:</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Monthly Plan:</strong> £10 per month, billed monthly on a recurring basis</li>
            <li><strong>Annual Plan:</strong> £99.99 per year, billed annually on a recurring basis</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Billing Terms:</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>All payments are processed securely through Stripe</li>
            <li>Subscriptions automatically renew unless cancelled</li>
            <li>You will be notified before each renewal</li>
            <li>You may cancel at any time from your account dashboard</li>
            <li>Cancellation takes effect at the end of the current billing period</li>
          </ul>

          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6 my-8">
            <h2 className="text-2xl font-bold text-red-900 mb-3">4. No Refund Policy</h2>
            <p className="text-red-800 font-semibold">
              Due to the digital nature of StartSprint and immediate access to premium features, all payments are non-refundable once a subscription is activated.
            </p>
            <ul className="list-disc pl-6 space-y-2 mt-4 text-red-800">
              <li>No refunds are provided for partial months or unused time</li>
              <li>No refunds for early cancellation</li>
              <li>No refunds if your account is suspended for terms violations</li>
            </ul>
            <p className="mt-4 text-red-800">
              We recommend trying our service before committing to longer subscription periods.
            </p>
          </div>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">5. Content Ownership & Responsibility</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Your Content:</strong> You retain ownership of quizzes and content you create</li>
            <li><strong>Your Responsibility:</strong> You are solely responsible for content you create and publish</li>
            <li><strong>Prohibited Content:</strong> You must not create content that is illegal, harmful, defamatory, obscene, or violates intellectual property rights</li>
            <li><strong>Educational Use:</strong> Content must be appropriate for educational purposes</li>
          </ul>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">6. Acceptable Use</h2>
          <p>You agree NOT to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Share your account credentials with others</li>
            <li>Use the service for any unlawful purpose</li>
            <li>Attempt to hack, disrupt, or reverse engineer the platform</li>
            <li>Upload malicious code or viruses</li>
            <li>Scrape or harvest data from the platform</li>
            <li>Create content that violates safeguarding or child protection standards</li>
            <li>Impersonate others or provide false information</li>
          </ul>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">7. Platform Provided "As Is"</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>StartSprint is provided on an "as is" and "as available" basis</li>
            <li>We do not guarantee uninterrupted or error-free service</li>
            <li>We are not responsible for loss of data, though we make reasonable efforts to prevent it</li>
            <li>We reserve the right to modify or discontinue features with reasonable notice</li>
          </ul>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">8. Account Suspension & Termination</h2>
          <p>We may suspend or terminate your account if:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>You violate these Terms of Service</li>
            <li>Your payment fails and is not rectified within 7 days</li>
            <li>You create inappropriate or harmful content</li>
            <li>Your conduct violates safeguarding principles</li>
            <li>You engage in fraudulent activity</li>
          </ul>
          <p className="mt-4">
            <strong>Effect of Suspension:</strong> Your account will be locked, and all published content will be unpublished until the issue is resolved.
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">9. Intellectual Property</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>StartSprint platform, code, and branding are owned by StartSprint</li>
            <li>You grant us a non-exclusive license to host and display your quiz content</li>
            <li>This license terminates when you delete content or close your account</li>
          </ul>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">10. Limitation of Liability</h2>
          <p>To the maximum extent permitted by law:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>StartSprint is not liable for indirect, incidental, or consequential damages</li>
            <li>Our total liability is limited to the amount you paid in the last 12 months</li>
            <li>We are not responsible for third-party services (e.g., payment processors)</li>
            <li>Teachers are responsible for appropriate classroom use</li>
          </ul>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">11. Fair Usage Policy</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Unlimited quiz creation does not mean unlimited storage</li>
            <li>We reserve the right to implement reasonable limits to prevent abuse</li>
            <li>Commercial use beyond standard teaching requires discussion</li>
          </ul>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">12. Changes to Terms</h2>
          <p>
            We may update these Terms from time to time. Material changes will be notified via email at least 30 days in advance. Continued use after changes take effect constitutes acceptance.
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">13. Governing Law</h2>
          <p>
            These Terms are governed by the laws of England and Wales. Any disputes will be subject to the exclusive jurisdiction of the courts of England and Wales.
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">14. Contact</h2>
          <p>
            For questions about these Terms:
          </p>
          <p className="font-semibold mt-2">Email: <a href="mailto:info@startsprint.app" className="text-blue-600 hover:underline">info@startsprint.app</a></p>

          <div className="bg-gray-100 rounded-lg p-6 mt-12">
            <h3 className="text-xl font-bold text-gray-900 mb-3">Key Points Summary</h3>
            <ul className="space-y-2 text-gray-700">
              <li>✓ Subscription-based access for teachers</li>
              <li>✓ Monthly (£10) and Annual (£99.99) plans available</li>
              <li>✓ All payments are non-refundable</li>
              <li>✓ You own your content, but are responsible for it</li>
              <li>✓ Platform provided "as is"</li>
              <li>✓ Fair usage applies</li>
              <li>✓ Governed by laws of England & Wales</li>
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
