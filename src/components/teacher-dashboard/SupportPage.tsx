import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { HelpCircle, Send, Loader2, Mail, CheckCircle, XCircle, AlertCircle, Ticket } from 'lucide-react';
import type { EntitlementResult } from '../../lib/entitlement';

interface SupportPageProps {
  entitlement: EntitlementResult | null;
}

export function SupportPage({ entitlement }: SupportPageProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('bug');
  const [sending, setSending] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [successTicketId, setSuccessTicketId] = useState<string | null>(null);

  const showDebug = new URLSearchParams(location.search).get('debug') === '1';

  useEffect(() => {
    checkAdminStatus();
  }, []);

  async function checkAdminStatus() {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data } = await supabase
        .from('admin_allowlist')
        .select('is_active')
        .eq('email', user.user.email)
        .eq('is_active', true)
        .maybeSingle();

      setIsAdmin(!!data);
    } catch (err) {
      console.error('Failed to check admin status:', err);
    }
  }

  async function submitTicket() {
    if (!subject.trim() || !message.trim()) {
      alert('Please fill in all fields');
      return;
    }

    setSending(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) {
        alert('You must be logged in to submit a ticket');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('email, school_id')
        .eq('id', user.user.id)
        .single();

      if (!profile) {
        alert('Failed to load your profile');
        return;
      }

      const debugInfo = {
        browser: navigator.userAgent,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        screen: `${window.screen.width}x${window.screen.height}`
      };

      const fullMessage = type === 'bug'
        ? `${message}\n\n---\nDebug Info:\n${JSON.stringify(debugInfo, null, 2)}`
        : message;

      const { data: ticket, error: ticketError } = await supabase
        .from('support_tickets')
        .insert({
          created_by_user_id: user.user.id,
          created_by_email: profile.email,
          school_id: profile.school_id,
          category: type,
          subject: subject.trim(),
          message: fullMessage,
          status: 'open',
          priority: type === 'bug' ? 'high' : 'medium'
        })
        .select('id')
        .single();

      if (ticketError) throw ticketError;

      try {
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-ticket-notification`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ticketId: ticket.id,
            type: 'new_ticket'
          })
        });
      } catch (emailErr) {
        console.error('Failed to send email notification:', emailErr);
        await supabase.from('system_events').insert({
          event_type: 'email_send_failed',
          severity: 'warning',
          context: {
            ticket_id: ticket.id,
            error: String(emailErr)
          },
          message: `Failed to send email for ticket ${ticket.id}`
        });
      }

      setSuccessTicketId(ticket.id);
      setSubject('');
      setMessage('');
    } catch (err: any) {
      console.error('Failed to submit ticket:', err);
      alert(`Failed to submit ticket: ${err.message || 'Please try again'}`);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Success Message */}
      {successTicketId && (
        <div className="bg-green-50 border-2 border-green-500 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-green-900 mb-1">
                Ticket Created Successfully!
              </h3>
              <p className="text-sm text-green-800 mb-3">
                Your support ticket <span className="font-mono font-semibold">#{successTicketId.slice(0, 8)}</span> has been created.
                We'll respond via email within 24 hours.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => navigate('/teacherdashboard?tab=tickets')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm"
                >
                  <Ticket className="w-4 h-4" />
                  View My Tickets
                </button>
                <button
                  onClick={() => setSuccessTicketId(null)}
                  className="px-4 py-2 border border-green-600 text-green-700 rounded-lg hover:bg-green-50 font-medium text-sm"
                >
                  Submit Another Ticket
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Debug View */}
      {showDebug && isAdmin && entitlement && (
        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-500 rounded-lg p-6 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            {entitlement?.isPremium ? (
              <CheckCircle className="w-6 h-6 text-green-600" />
            ) : (
              <XCircle className="w-6 h-6 text-red-600" />
            )}
            <h2 className="text-xl font-bold text-gray-900">🔧 Entitlement Debug (Admin Only)</h2>
            <span className={`ml-auto px-3 py-1 rounded-full text-sm font-semibold ${
              entitlement?.isPremium
                ? 'bg-green-600 text-white'
                : 'bg-red-600 text-white'
            }`}>
              {entitlement?.isPremium ? 'PREMIUM ACCESS' : 'NO ACCESS'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">User ID</div>
              <div className="text-sm font-mono text-gray-900 break-all">
                {entitlement?.userId || 'N/A'}
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Email</div>
              <div className="text-sm font-semibold text-gray-900">
                {entitlement?.email || 'N/A'}
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Premium Status</div>
              <div className={`text-lg font-bold ${
                entitlement?.isPremium ? 'text-green-600' : 'text-red-600'
              }`}>
                {entitlement?.isPremium ? 'TRUE' : 'FALSE'}
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Source</div>
              <div className="text-sm font-semibold text-blue-600">
                {entitlement?.source?.toUpperCase() || 'NONE'}
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Expires At</div>
              <div className="text-sm font-semibold text-gray-900">
                {entitlement?.expiresAt
                  ? new Date(entitlement.expiresAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  : 'NEVER'}
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Raw Rows Count</div>
              <div className="text-lg font-bold text-gray-900">
                {entitlement?.rawRowsCount ?? 0}
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-gray-200 md:col-span-2">
              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Reason</div>
              <div className="text-sm text-gray-900">
                {entitlement?.reason || 'N/A'}
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Last Checked At</div>
              <div className="text-xs font-mono text-gray-700">
                {entitlement?.lastCheckedAt
                  ? new Date(entitlement.lastCheckedAt).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })
                  : 'N/A'}
              </div>
            </div>

            <div className="bg-white rounded-lg p-4 border border-gray-200">
              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Entitlement ID</div>
              <div className="text-xs font-mono text-gray-700 break-all">
                {entitlement?.entitlementId || 'N/A'}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 text-xs text-yellow-800">
            <AlertCircle className="w-4 h-4" />
            <span>This debug view is only visible to admin users with ?debug=1 parameter</span>
          </div>
        </div>
      )}

      {/* Regular Support Content */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
          <HelpCircle className="w-8 h-8 text-blue-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Support</h1>
        <p className="text-gray-600">We're here to help! Get in touch with our team.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
          <Mail className="w-8 h-8 mx-auto text-blue-600 mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">Email Support</h3>
          <p className="text-sm text-gray-600 mb-3">Response within 24 hours</p>
          <a
            href="mailto:support@startsprint.app"
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            support@startsprint.app
          </a>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
          <HelpCircle className="w-8 h-8 mx-auto text-green-600 mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">FAQs</h3>
          <p className="text-sm text-gray-600 mb-3">Quick answers below</p>
          <span className="text-sm text-gray-400">Common questions</span>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
          <Send className="w-8 h-8 mx-auto text-purple-600 mb-3" />
          <h3 className="font-semibold text-gray-900 mb-1">Contact Form</h3>
          <p className="text-sm text-gray-600 mb-3">Use form below</p>
          <span className="text-sm text-gray-400">We'll respond quickly</span>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
        <h2 className="text-xl font-semibold text-gray-900">Contact Us</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="bug">Report a Bug</option>
            <option value="billing">Billing Issue</option>
            <option value="content">Content Issue</option>
            <option value="feature">Feature Request</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Subject *</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Brief description of your issue or question"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Message *</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Provide as much detail as possible..."
            rows={6}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {type === 'bug' && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>Bug Report Tips:</strong> Include steps to reproduce, what you expected vs. what happened,
              and any error messages. Debug information will be attached automatically.
            </p>
          </div>
        )}

        <button
          onClick={submitTicket}
          disabled={sending}
          className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium inline-flex items-center justify-center gap-2"
        >
          {sending ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              Submit Ticket
            </>
          )}
        </button>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 space-y-4">
        <h3 className="font-semibold text-gray-900">Frequently Asked Questions</h3>
        <div className="space-y-3">
          <details className="group">
            <summary className="font-medium text-gray-900 cursor-pointer hover:text-blue-600">
              How do I share a quiz with students?
            </summary>
            <p className="mt-2 text-sm text-gray-600 pl-4">
              Each published quiz has a unique URL. Go to My Quizzes, click the share icon, and copy the link to send to your students via email, LMS, or messaging app.
            </p>
          </details>
          <details className="group">
            <summary className="font-medium text-gray-900 cursor-pointer hover:text-blue-600">
              Can I edit a published quiz?
            </summary>
            <p className="mt-2 text-sm text-gray-600 pl-4">
              Yes! You can edit published quizzes at any time. Changes will apply to all future attempts, but won't affect already-completed attempts.
            </p>
          </details>
          <details className="group">
            <summary className="font-medium text-gray-900 cursor-pointer hover:text-blue-600">
              How do I export student results?
            </summary>
            <p className="mt-2 text-sm text-gray-600 pl-4">
              Go to Analytics or Reports and use the Export button to download results in CSV format.
            </p>
          </details>
          <details className="group">
            <summary className="font-medium text-gray-900 cursor-pointer hover:text-blue-600">
              How does the Create Quiz wizard work?
            </summary>
            <p className="mt-2 text-sm text-gray-600 pl-4">
              The wizard guides you through 5 steps: Select Subject → Select/Create Topic → Enter Quiz Details → Add Questions (manually, AI, or document upload) → Review & Publish. You can save drafts at any time.
            </p>
          </details>
          <details className="group">
            <summary className="font-medium text-gray-900 cursor-pointer hover:text-blue-600">
              What file formats are supported for document upload?
            </summary>
            <p className="mt-2 text-sm text-gray-600 pl-4">
              We support PDF, Word (.doc, .docx), and plain text (.txt) files up to 10MB in size.
            </p>
          </details>
        </div>
      </div>
    </div>
  );
}
