import { createClient } from 'npm:@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface RequestBody {
  ticketId: string;
  type: 'new_ticket' | 'admin_reply' | 'teacher_reply';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { ticketId, type }: RequestBody = await req.json();

    if (!ticketId || !type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { data: ticket, error: ticketError } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      throw new Error('Ticket not found');
    }

    let emailSent = false;
    let emailDetails = {};

    if (type === 'new_ticket') {
      emailDetails = {
        to: 'support@startsprint.app',
        from: 'noreply@startsprint.app',
        subject: `New Support Ticket #${ticketId.slice(0, 8)}: ${ticket.subject}`,
        body: `
A new support ticket has been created:

Ticket ID: ${ticketId}
Category: ${ticket.category}
Priority: ${ticket.priority}
From: ${ticket.created_by_email}
Subject: ${ticket.subject}

Message:
${ticket.message}

View ticket: https://startsprint.app/admindashboard/support

---
This is an automated notification from StartSprint Support System.
        `,
      };

      console.log('[Email] Would send:', emailDetails);
      emailSent = true;

    } else if (type === 'admin_reply') {
      const { data: messages } = await supabase
        .from('support_ticket_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .eq('author_type', 'admin')
        .order('created_at', { ascending: false })
        .limit(1);

      const lastMessage = messages?.[0];

      if (lastMessage) {
        emailDetails = {
          to: ticket.created_by_email,
          from: 'noreply@startsprint.app',
          subject: `Re: Support Ticket #${ticketId.slice(0, 8)} - ${ticket.subject}`,
          body: `
Hello,

You have received a reply to your support ticket:

Ticket ID: ${ticketId}
Subject: ${ticket.subject}
Status: ${ticket.status}

Latest Reply:
${lastMessage.message}

View and respond: https://startsprint.app/teacherdashboard?tab=tickets

---
This is an automated notification from StartSprint Support.
          `,
        };

        console.log('[Email] Would send:', emailDetails);
        emailSent = true;
      }

    } else if (type === 'teacher_reply') {
      const { data: messages } = await supabase
        .from('support_ticket_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .eq('author_type', 'teacher')
        .order('created_at', { ascending: false })
        .limit(1);

      const lastMessage = messages?.[0];

      if (lastMessage) {
        emailDetails = {
          to: 'support@startsprint.app',
          from: 'noreply@startsprint.app',
          subject: `Teacher Reply: Ticket #${ticketId.slice(0, 8)} - ${ticket.subject}`,
          body: `
A teacher has replied to ticket #${ticketId.slice(0, 8)}:

From: ${ticket.created_by_email}
Subject: ${ticket.subject}
Status: ${ticket.status}

Latest Reply:
${lastMessage.message}

View ticket: https://startsprint.app/admindashboard/support

---
This is an automated notification from StartSprint Support System.
          `,
        };

        console.log('[Email] Would send:', emailDetails);
        emailSent = true;
      }
    }

    await supabase.from('system_events').insert({
      event_type: 'email_notification',
      severity: 'info',
      context: {
        ticket_id: ticketId,
        type,
        email_details: emailDetails,
        sent: emailSent,
      },
      message: `Email notification ${emailSent ? 'sent' : 'skipped'} for ticket ${ticketId}`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        emailSent,
        message: emailSent
          ? 'Email notification logged (production email service not configured)'
          : 'Email notification skipped',
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('[Send Ticket Notification] Error:', error);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    await supabase.from('system_events').insert({
      event_type: 'email_send_failed',
      severity: 'error',
      context: { error: error.message },
      message: `Failed to send ticket notification: ${error.message}`,
    });

    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
