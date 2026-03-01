import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Ticket, MessageCircle, X, Send, Loader2, Clock, CheckCircle, AlertCircle, Ban } from 'lucide-react';

interface SupportTicket {
  id: string;
  created_at: string;
  category: string;
  subject: string;
  message: string;
  status: string;
  priority: string;
  last_reply_at: string;
}

interface TicketMessage {
  id: string;
  created_at: string;
  author_email: string;
  author_type: string;
  message: string;
}

export function MyTicketsPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  useEffect(() => {
    fetchTickets();
  }, []);

  const ticketStats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    waitingOnYou: tickets.filter(t => t.status === 'waiting_on_teacher').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    closed: tickets.filter(t => t.status === 'closed').length,
  };

  async function fetchTickets() {
    try {
      setLoading(true);
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('created_by_user_id', user.user.id)
        .order('last_reply_at', { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (err) {
      console.error('Failed to fetch tickets:', err);
    } finally {
      setLoading(false);
    }
  }

  async function openTicket(ticket: SupportTicket) {
    setSelectedTicket(ticket);
    setLoadingMessages(true);

    try {
      const { data, error } = await supabase
        .from('support_ticket_messages')
        .select('*')
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  }

  async function sendReply() {
    if (!replyMessage.trim() || !selectedTicket) return;

    setSendingReply(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user.user.id)
        .single();

      if (!profile) return;

      const { error } = await supabase
        .from('support_ticket_messages')
        .insert({
          ticket_id: selectedTicket.id,
          author_user_id: user.user.id,
          author_email: profile.email,
          author_type: 'teacher',
          message: replyMessage.trim()
        });

      if (error) throw error;

      try {
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-ticket-notification`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ticketId: selectedTicket.id,
            type: 'teacher_reply'
          })
        });
      } catch (emailErr) {
        console.error('Failed to send email notification:', emailErr);
      }

      setReplyMessage('');
      openTicket(selectedTicket);

      if (selectedTicket.status === 'resolved' || selectedTicket.status === 'closed') {
        await supabase
          .from('support_tickets')
          .update({ status: 'open' })
          .eq('id', selectedTicket.id);
        fetchTickets();
      }
    } catch (err) {
      console.error('Failed to send reply:', err);
      alert('Failed to send reply. Please try again.');
    } finally {
      setSendingReply(false);
    }
  }

  const filteredTickets = tickets.filter(t => {
    if (filterStatus === 'all') return true;
    return t.status === filterStatus;
  });

  function getStatusIcon(status: string) {
    switch (status) {
      case 'open': return <Clock className="w-4 h-4 text-blue-600" />;
      case 'waiting_on_teacher': return <AlertCircle className="w-4 h-4 text-orange-600" />;
      case 'resolved': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'closed': return <Ban className="w-4 h-4 text-gray-600" />;
      default: return <Ticket className="w-4 h-4 text-gray-600" />;
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'open': return 'bg-blue-100 text-blue-800';
      case 'waiting_on_teacher': return 'bg-orange-100 text-orange-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  function getCategoryColor(category: string) {
    switch (category) {
      case 'bug': return 'bg-red-100 text-red-800';
      case 'billing': return 'bg-purple-100 text-purple-800';
      case 'content': return 'bg-yellow-100 text-yellow-800';
      case 'feature': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Support Tickets</h1>
          <p className="text-gray-600 mt-1">View and manage your support requests</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Ticket className="w-5 h-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-600">Total</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{ticketStats.total}</div>
        </div>

        <div className="bg-white rounded-lg border border-blue-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-blue-600">Open</span>
          </div>
          <div className="text-2xl font-bold text-blue-900">{ticketStats.open}</div>
        </div>

        <div className="bg-white rounded-lg border border-orange-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            <span className="text-sm font-medium text-orange-600">Needs Reply</span>
          </div>
          <div className="text-2xl font-bold text-orange-900">{ticketStats.waitingOnYou}</div>
        </div>

        <div className="bg-white rounded-lg border border-green-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-600">Resolved</span>
          </div>
          <div className="text-2xl font-bold text-green-900">{ticketStats.resolved}</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Ban className="w-5 h-5 text-gray-600" />
            <span className="text-sm font-medium text-gray-600">Closed</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{ticketStats.closed}</div>
        </div>
      </div>

      <div className="flex gap-2">
        {['all', 'open', 'waiting_on_teacher', 'resolved', 'closed'].map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterStatus === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {status === 'all' ? 'All' : status.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
          </button>
        ))}
      </div>

      {filteredTickets.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Ticket className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 mb-4">
            {filterStatus === 'all' ? 'No support tickets yet' : `No ${filterStatus} tickets`}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-200">
            {filteredTickets.map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => openTicket(ticket)}
                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono text-xs text-gray-500">#{ticket.id.slice(0, 8)}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(ticket.status)}`}>
                        {getStatusIcon(ticket.status)}
                        {ticket.status.split('_').join(' ')}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(ticket.category)}`}>
                        {ticket.category}
                      </span>
                      {ticket.priority === 'high' && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          High Priority
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">{ticket.subject}</h3>
                    <p className="text-sm text-gray-600 line-clamp-2">{ticket.message}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>Created {new Date(ticket.created_at).toLocaleDateString()}</span>
                      <span>Last updated {new Date(ticket.last_reply_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <MessageCircle className="w-5 h-5 text-gray-400 flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedTicket && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-sm text-gray-500">#{selectedTicket.id.slice(0, 8)}</span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedTicket.status)}`}>
                    {getStatusIcon(selectedTicket.status)}
                    {selectedTicket.status.split('_').join(' ')}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-gray-900">{selectedTicket.subject}</h2>
              </div>
              <button
                onClick={() => setSelectedTicket(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900">You</span>
                  <span className="text-xs text-gray-500">
                    {new Date(selectedTicket.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedTicket.message}</p>
              </div>

              {loadingMessages ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-lg p-4 border ${
                      msg.author_type === 'admin'
                        ? 'bg-blue-50 border-blue-200'
                        : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">
                        {msg.author_type === 'admin' ? 'Support Team' : 'You'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(msg.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{msg.message}</p>
                  </div>
                ))
              )}
            </div>

            {selectedTicket.status !== 'closed' && (
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="space-y-3">
                  <textarea
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    placeholder="Type your reply..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    onClick={sendReply}
                    disabled={sendingReply || !replyMessage.trim()}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sendingReply ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send Reply
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
