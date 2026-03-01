import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

export function SafeguardingStatement() {
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
          <Shield className="w-12 h-12 text-green-600" />
          <h1 className="text-5xl font-black text-gray-900">Safeguarding Statement</h1>
        </div>

        <p className="text-sm text-gray-600 mb-8">Last updated: 2nd February 2026</p>

        <div className="prose prose-lg max-w-none space-y-6 text-gray-700">
          <div className="bg-green-50 border-2 border-green-500 rounded-lg p-6">
            <h2 className="text-2xl font-bold text-green-900 mb-3">Our Commitment</h2>
            <p className="text-green-800 text-lg font-semibold">
              StartSprint is designed for school use with safeguarding at the core of everything we do.
            </p>
          </div>

          <p className="text-xl">
            We recognize our responsibility to protect children and young people who interact with our platform. This statement outlines the safeguarding measures built into StartSprint.
          </p>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">1. Design Principles</h2>
          <p>StartSprint has been designed from the ground up with safeguarding in mind:</p>

          <div className="grid md:grid-cols-2 gap-4 my-6">
            <div className="bg-white p-6 rounded-lg border-2 border-green-200">
              <h3 className="font-bold text-gray-900 mb-2">✓ No Student Accounts Required</h3>
              <p className="text-gray-700">
                Students can participate in quizzes without creating accounts, eliminating risks associated with user-generated content and account management.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg border-2 border-green-200">
              <h3 className="font-bold text-gray-900 mb-2">✓ No Open Chat or Messaging</h3>
              <p className="text-gray-700">
                There is no communication channel between users. Students cannot message teachers, other students, or anyone else.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg border-2 border-green-200">
              <h3 className="font-bold text-gray-900 mb-2">✓ No Student Personal Data</h3>
              <p className="text-gray-700">
                We do not collect names, email addresses, photos, or any personally identifiable information from students.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg border-2 border-green-200">
              <h3 className="font-bold text-gray-900 mb-2">✓ No Advertising to Students</h3>
              <p className="text-gray-700">
                The student-facing platform contains no advertisements, pop-ups, or external links to commercial content.
              </p>
            </div>
          </div>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">2. Content Control</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Teacher-Created Only:</strong> All quiz content is created and controlled by verified teachers</li>
            <li><strong>No User-Generated Student Content:</strong> Students cannot upload files, images, or create content</li>
            <li><strong>Teacher Responsibility:</strong> Teachers are responsible for ensuring content is age-appropriate and curriculum-aligned</li>
            <li><strong>Content Moderation:</strong> We reserve the right to remove inappropriate content</li>
          </ul>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">3. Data Protection & Privacy</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Student gameplay is tracked using anonymous session IDs only</li>
            <li>No personal data is collected from students</li>
            <li>Schools retain control over who can access student performance data</li>
            <li>Full compliance with UK GDPR and Data Protection Act 2018</li>
            <li>See our <button onClick={() => navigate('/privacy')} className="text-blue-600 hover:underline font-semibold">Privacy Policy</button> for details</li>
          </ul>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">4. Teacher Verification</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>All teachers must create accounts with verified email addresses</li>
            <li>Payment verification helps confirm legitimate educational use</li>
            <li>School domain matching available for institutional accounts</li>
            <li>Suspicious accounts are reviewed and may be suspended</li>
          </ul>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">5. Classroom Use Guidelines</h2>
          <p>We expect teachers to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Supervise student use of the platform in classroom settings</li>
            <li>Ensure content is age-appropriate and curriculum-relevant</li>
            <li>Follow their school's safeguarding and acceptable use policies</li>
            <li>Report any concerns immediately</li>
            <li>Not share account credentials with students or unauthorized persons</li>
          </ul>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">6. Technical Safeguards</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Secure Infrastructure:</strong> UK/EU-based secure hosting with encryption</li>
            <li><strong>No External Links:</strong> Student interface contains no links to external websites</li>
            <li><strong>Session Management:</strong> Anonymous sessions expire after inactivity</li>
            <li><strong>Regular Security Audits:</strong> We conduct regular security reviews</li>
            <li><strong>DDoS Protection:</strong> Infrastructure protected against attacks</li>
          </ul>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">7. Reporting & Response</h2>
          <p>If you have safeguarding concerns about content or use of StartSprint:</p>

          <div className="bg-orange-50 border-2 border-orange-300 rounded-lg p-6 my-6">
            <h3 className="text-xl font-bold text-orange-900 mb-3">Immediate Action Required?</h3>
            <p className="text-orange-800 mb-3">
              If you believe a child is in immediate danger, contact your local safeguarding authority or police immediately. Do not wait to contact us.
            </p>
            <p className="text-orange-800">
              UK: Call 999 for emergencies or contact your Local Safeguarding Children Board
            </p>
          </div>

          <p className="font-semibold">To report platform-related concerns:</p>
          <ul className="list-disc pl-6 space-y-2 mt-3">
            <li>Email: <a href="mailto:info@startsprint.app" className="text-blue-600 hover:underline font-semibold">info@startsprint.app</a></li>
            <li>We will respond within 24 hours</li>
            <li>Serious concerns will be escalated immediately</li>
            <li>We will take appropriate action, which may include account suspension</li>
          </ul>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">8. Compliance with UK Safeguarding Expectations</h2>
          <p>StartSprint aligns with:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Keeping Children Safe in Education (KCSIE) guidance</li>
            <li>UK GDPR and Data Protection Act 2018</li>
            <li>The Children Act 1989 and 2004</li>
            <li>Online Safety Act 2023 (where applicable)</li>
            <li>Department for Education guidance on online safety</li>
          </ul>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">9. Limitations & School Responsibilities</h2>
          <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6">
            <p className="text-blue-900 mb-3">
              <strong>Important:</strong> While we build safeguarding into our platform, schools remain responsible for:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-blue-800">
              <li>Supervising student use</li>
              <li>Ensuring content is appropriate</li>
              <li>Following their own safeguarding policies</li>
              <li>Training staff on appropriate use</li>
              <li>Monitoring and responding to concerns in their setting</li>
            </ul>
          </div>

          <h2 className="text-3xl font-bold text-gray-900 mt-12 mb-4">10. Continuous Improvement</h2>
          <p>We are committed to:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Regular review and update of safeguarding measures</li>
            <li>Responding to feedback from schools and safeguarding leads</li>
            <li>Staying informed about evolving safeguarding guidance</li>
            <li>Implementing additional measures as risks are identified</li>
          </ul>

          <div className="bg-gray-100 rounded-lg p-6 mt-12">
            <h3 className="text-xl font-bold text-gray-900 mb-3">Safeguarding Summary</h3>
            <ul className="space-y-2 text-gray-700">
              <li>✓ Designed for school use</li>
              <li>✓ No student accounts required</li>
              <li>✓ No open chat or messaging between users</li>
              <li>✓ No student personal data collected</li>
              <li>✓ No advertising to students</li>
              <li>✓ Teacher-controlled content only</li>
              <li>✓ Compliance with UK safeguarding expectations</li>
              <li>✓ Immediate action on misuse reports</li>
            </ul>
          </div>

          <div className="bg-green-50 border-2 border-green-300 rounded-lg p-6 mt-8">
            <h3 className="text-xl font-bold text-green-900 mb-3">Questions or Concerns?</h3>
            <p className="text-green-800">
              If you have questions about our safeguarding approach or need clarification for your school's due diligence process:
            </p>
            <p className="text-green-800 mt-3 font-semibold">
              Email: <a href="mailto:info@startsprint.app" className="text-green-700 hover:underline">info@startsprint.app</a>
            </p>
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
