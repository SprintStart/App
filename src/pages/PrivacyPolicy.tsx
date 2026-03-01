import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

export function PrivacyPolicy() {
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
          <Shield className="w-12 h-12 text-blue-600" />
          <h1 className="text-5xl font-black text-gray-900">Privacy Policy</h1>
        </div>

        <p className="text-sm text-gray-600 mb-8">Last updated: 2nd February 2026</p>

        <div className="prose prose-lg max-w-none space-y-6 text-gray-700">
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-blue-900 mb-3">UK GDPR Compliance</h2>
            <p className="text-blue-800">
              StartSprint is committed to complying with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.
            </p>
          </div>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">1. Data We Collect</h2>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">For Teachers:</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Email address (for account creation and communication)</li>
            <li>Password (encrypted)</li>
            <li>Payment information (handled securely by Stripe - we do not store card details)</li>
            <li>Quiz content you create</li>
            <li>Usage analytics (quiz views, student performance data)</li>
          </ul>

          <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">For Students:</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li>Student gameplay does not require accounts</li>
            <li>We collect anonymized gameplay session data (quiz responses, scores, timing)</li>
            <li>No personally identifiable information is collected from students</li>
            <li>Session data is linked to anonymous session IDs, not student identities</li>
          </ul>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">2. How We Use Your Data</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>To provide and maintain the StartSprint service</li>
            <li>To process teacher subscriptions and payments</li>
            <li>To generate performance analytics for teachers</li>
            <li>To improve our service and develop new features</li>
            <li>To communicate important service updates</li>
            <li>To comply with legal obligations</li>
          </ul>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">3. Data Sharing</h2>
          <p>
            <strong>We do not sell or share your personal data with third parties for marketing purposes.</strong>
          </p>
          <p className="mt-4">We may share data with:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Stripe:</strong> Payment processing only (they handle card data securely)</li>
            <li><strong>Supabase:</strong> Our secure hosting provider (UK/EU data centers)</li>
            <li><strong>Law enforcement:</strong> Only when legally required</li>
          </ul>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">4. Data Security</h2>
          <p>We implement industry-standard security measures:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>All data encrypted in transit (HTTPS/TLS)</li>
            <li>All data encrypted at rest in secure databases</li>
            <li>Regular security audits and updates</li>
            <li>Access controls and authentication required for all teacher accounts</li>
            <li>Payment data handled exclusively by PCI-DSS compliant Stripe</li>
          </ul>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">5. Your Rights (UK GDPR)</h2>
          <p>Under UK GDPR, you have the right to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Access:</strong> Request a copy of your personal data</li>
            <li><strong>Rectification:</strong> Correct inaccurate data</li>
            <li><strong>Erasure:</strong> Request deletion of your data (right to be forgotten)</li>
            <li><strong>Portability:</strong> Receive your data in a machine-readable format</li>
            <li><strong>Objection:</strong> Object to certain types of processing</li>
            <li><strong>Restriction:</strong> Request limited processing of your data</li>
          </ul>
          <p className="mt-4">
            To exercise any of these rights, email us at <strong>privacy@startsprint.app</strong>
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">6. Data Retention</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Teacher account data: Retained while account is active, plus 90 days after deletion request</li>
            <li>Quiz content: Retained while account is active, deleted 90 days after account closure</li>
            <li>Student session data: Anonymized gameplay data retained for analytics purposes</li>
            <li>Payment records: Retained for 7 years as required by UK law</li>
          </ul>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">7. Children's Privacy</h2>
          <p>
            StartSprint is designed for use in educational settings. Student gameplay requires no account creation and collects no personally identifiable information. Teachers are responsible for ensuring appropriate use in their classroom contexts.
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">8. Cookies</h2>
          <p>We use essential cookies only:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Authentication cookies (to keep teachers logged in)</li>
            <li>Session cookies (for anonymous student gameplay)</li>
          </ul>
          <p className="mt-4">We do not use advertising or tracking cookies.</p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">9. International Transfers</h2>
          <p>
            Your data is stored on secure servers within the UK/EU. We do not transfer personal data outside the UK/EEA.
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">10. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. We will notify teachers of significant changes via email. Continued use of the service after changes constitutes acceptance.
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">11. Contact & Complaints</h2>
          <p>For privacy concerns or data requests:</p>
          <p className="font-semibold mt-2">Email: <a href="mailto:privacy@startsprint.app" className="text-blue-600 hover:underline">privacy@startsprint.app</a></p>
          <p className="mt-4">
            If you are unhappy with how we handle your data, you have the right to lodge a complaint with the UK Information Commissioner's Office (ICO):
          </p>
          <p className="mt-2">
            <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
              www.ico.org.uk
            </a>
          </p>

          <div className="bg-gray-100 rounded-lg p-6 mt-12">
            <h3 className="text-xl font-bold text-gray-900 mb-3">Summary</h3>
            <ul className="space-y-2 text-gray-700">
              <li>✓ We comply with UK GDPR</li>
              <li>✓ We only collect data necessary to provide the service</li>
              <li>✓ Student gameplay requires no accounts</li>
              <li>✓ Teacher data is never sold or shared for marketing</li>
              <li>✓ Stripe handles all payment data securely</li>
              <li>✓ You can request data access or deletion at any time</li>
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
