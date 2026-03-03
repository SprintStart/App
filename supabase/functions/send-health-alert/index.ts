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
  severity?: 'critical' | 'warning';
  http_status?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { check_name, target, error_message, failure_count, severity = 'critical', http_status }: AlertPayload = await req.json();

    const timestamp = new Date().toISOString();
    const severityLabel = severity === 'critical' ? 'CRITICAL' : 'WARNING';
    const alertSubject = `${severityLabel}: ${check_name} - ${failure_count} Consecutive Failures`;

    // Enhanced error message with root cause analysis
    let enhancedErrorMessage = error_message;

    if (http_status) {
      if (http_status >= 500) {
        enhancedErrorMessage = `Server Error (${http_status}): The application server is experiencing issues. Check server logs and deployment status.`;
      } else if (http_status === 404) {
        enhancedErrorMessage = `Route Not Found (404): The URL "${target}" does not exist. Verify routing configuration.`;
      } else if (http_status === 403) {
        enhancedErrorMessage = `Access Forbidden (403): Permission denied accessing "${target}". Check authentication/authorization.`;
      } else if (http_status === 401) {
        enhancedErrorMessage = `Unauthorized (401): Authentication required for "${target}". Check API keys or auth tokens.`;
      } else if (http_status >= 400) {
        enhancedErrorMessage = `Client Error (${http_status}): ${error_message}`;
      }
    } else if (error_message?.includes('certificate')) {
      enhancedErrorMessage = `SSL Certificate Error: "${error_message}". Verify domain configuration and SSL certificates.`;
    } else if (error_message?.includes('DNS')) {
      enhancedErrorMessage = `DNS Resolution Failed: "${error_message}". Check domain DNS records and nameservers.`;
    } else if (error_message?.includes('timeout')) {
      enhancedErrorMessage = `Request Timeout: "${error_message}". Server may be overloaded or unresponsive.`;
    } else if (error_message?.includes('ECONNREFUSED')) {
      enhancedErrorMessage = `Connection Refused: Server is not accepting connections. Check if service is running.`;
    }

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
      <div class="value">${enhancedErrorMessage || 'No error message provided'}</div>
    </div>

    ${http_status ? `
    <div class="detail">
      <div class="label">HTTP Status:</div>
      <div class="value">${http_status}</div>
    </div>
    ` : ''}

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
${severityLabel} HEALTH CHECK FAILURE

Check: ${check_name}
Target: ${target}
Consecutive Failures: ${failure_count}
${http_status ? `HTTP Status: ${http_status}` : ''}
Error: ${enhancedErrorMessage || 'No error message provided'}
Timestamp: ${timestamp}

This check has failed ${failure_count} times consecutively.
${severity === 'critical' ? 'IMMEDIATE INVESTIGATION REQUIRED.' : 'Performance degradation detected.'}

View details: https://startsprint.app/admin/system-health

Next steps:
1. Check application logs in Supabase dashboard
2. Verify DNS and SSL certificate configuration
3. Test the endpoint manually: ${target}
4. Check recent deployments for breaking changes
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
