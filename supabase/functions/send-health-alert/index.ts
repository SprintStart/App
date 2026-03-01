import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AlertPayload {
  check_name: string;
  target: string;
  error_message: string;
  failure_count: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { check_name, target, error_message, failure_count }: AlertPayload = await req.json();

    const timestamp = new Date().toISOString();
    const alertSubject = `CRITICAL: ${check_name} Failed ${failure_count} Times`;

    const alertHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .alert-box { background: #fee; border-left: 4px solid #d00; padding: 20px; margin: 20px 0; }
    .detail { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 4px; }
    .label { font-weight: bold; color: #666; }
    .value { color: #000; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="alert-box">
      <h2 style="color: #d00; margin-top: 0;">🚨 Critical Health Check Failure</h2>
      <p>A critical health check has failed multiple times consecutively and requires immediate attention.</p>
    </div>

    <div class="detail">
      <div class="label">Check Name:</div>
      <div class="value">${check_name}</div>
    </div>

    <div class="detail">
      <div class="label">Target Endpoint:</div>
      <div class="value">${target}</div>
    </div>

    <div class="detail">
      <div class="label">Consecutive Failures:</div>
      <div class="value">${failure_count}</div>
    </div>

    <div class="detail">
      <div class="label">Error Message:</div>
      <div class="value">${error_message || 'No error message provided'}</div>
    </div>

    <div class="detail">
      <div class="label">Timestamp:</div>
      <div class="value">${timestamp}</div>
    </div>

    <p style="margin-top: 30px;">
      <a href="https://startsprint.app/admin/system-health"
         style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
        View System Health Dashboard
      </a>
    </p>

    <div class="footer">
      <p>This is an automated alert from StartSprint Health Monitoring System.</p>
      <p>To stop receiving these alerts, please contact your system administrator.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

    const alertText = `
CRITICAL HEALTH CHECK FAILURE

Check: ${check_name}
Target: ${target}
Consecutive Failures: ${failure_count}
Error: ${error_message || 'No error message provided'}
Timestamp: ${timestamp}

This check has failed ${failure_count} times consecutively.
Please investigate immediately.

View details: https://startsprint.app/admin/system-health
    `.trim();

    console.error('HEALTH ALERT:', alertText);

    // Send email via Resend API
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (resendApiKey) {
      try {
        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'alerts@startsprint.app',
            to: ['support@startsprint.app', 'leslie.addae@startsprint.app'],
            subject: alertSubject,
            html: alertHtml,
            text: alertText,
          }),
        });

        const emailResult = await emailResponse.json();

        if (!emailResponse.ok) {
          console.error('Resend API error:', emailResult);
          throw new Error(`Email sending failed: ${JSON.stringify(emailResult)}`);
        }

        console.log('Email sent successfully:', emailResult);

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Alert email sent successfully',
            email_id: emailResult.id,
            recipients: ['support@startsprint.app', 'leslie.addae@startsprint.app']
          }),
          {
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          },
        );
      } catch (emailError) {
        console.error('Failed to send email:', emailError);

        return new Response(
          JSON.stringify({
            success: false,
            message: 'Alert logged but email sending failed',
            error: emailError.message,
            alert: alertText
          }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          },
        );
      }
    } else {
      console.warn('RESEND_API_KEY not configured. Email not sent.');

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Alert logged (RESEND_API_KEY not configured)',
          alert: alertText,
          note: 'Configure RESEND_API_KEY in Supabase secrets to enable email alerts'
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }
  } catch (error) {
    console.error('Alert function error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
