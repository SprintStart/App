import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const stripe = new Stripe(stripeSecret, {
  appInfo: {
    name: 'Bolt Integration',
    version: '1.0.0',
  },
});

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

Deno.serve(async (req) => {
  try {
    console.log('[Webhook] Received request:', req.method);

    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }

    if (req.method !== 'POST') {
      console.error('[Webhook] Invalid method:', req.method);
      return new Response('Method not allowed', { status: 405 });
    }

    // get the signature from the header
    const signature = req.headers.get('stripe-signature');

    if (!signature) {
      console.error('[Webhook] No signature found in headers');
      return new Response('No signature found', { status: 400 });
    }

    // get the raw body
    const body = await req.text();
    console.log('[Webhook] Received body length:', body.length);

    // verify the webhook signature
    let event: Stripe.Event;

    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret);
      console.log('[Webhook] Signature verified, event type:', event.type);
    } catch (error: any) {
      console.error('[Webhook] Signature verification failed:', error.message);
      return new Response(`Webhook signature verification failed: ${error.message}`, { status: 400 });
    }

    try {
      await handleEvent(event);
      console.log('[Webhook] Event processed successfully');
      return Response.json({ received: true });
    } catch (handlerError: any) {
      console.error('[Webhook] Event processing failed:', handlerError);
      return Response.json({ error: handlerError.message }, { status: 500 });
    }
  } catch (error: any) {
    console.error('[Webhook] Error processing webhook:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function handleEvent(event: Stripe.Event) {
  console.log('[handleEvent] Processing event type:', event.type);

  const stripeData = event?.data?.object ?? {};

  if (!stripeData) {
    console.warn('[handleEvent] No data in event');
    return;
  }

  if (!('customer' in stripeData)) {
    console.warn('[handleEvent] No customer field in event data');
    return;
  }

  // for one time payments, we only listen for the checkout.session.completed event
  if (event.type === 'payment_intent.succeeded' && event.data.object.invoice === null) {
    console.log('[handleEvent] Ignoring payment_intent.succeeded without invoice');
    return;
  }

  const { customer: customerId } = stripeData;

  if (!customerId || typeof customerId !== 'string') {
    console.error('[handleEvent] No customer received on event:', JSON.stringify(event));
  } else {
    console.log('[handleEvent] Processing for customer:', customerId);
    let isSubscription = true;

    if (event.type === 'checkout.session.completed') {
      const { mode } = stripeData as Stripe.Checkout.Session;

      isSubscription = mode === 'subscription';

      console.info(`[handleEvent] Processing ${isSubscription ? 'subscription' : 'one-time payment'} checkout session`);
    }

    const { mode, payment_status } = stripeData as Stripe.Checkout.Session;

    if (isSubscription) {
      console.info('[handleEvent] Starting subscription sync for customer:', customerId);
      await syncCustomerFromStripe(customerId);
      console.info('[handleEvent] Subscription sync completed for customer:', customerId);
    } else if (mode === 'payment' && payment_status === 'paid') {
      try {
        console.log('[handleEvent] Processing one-time payment');
        // Extract the necessary information from the session
        const {
          id: checkout_session_id,
          payment_intent,
          amount_subtotal,
          amount_total,
          currency,
        } = stripeData as Stripe.Checkout.Session;

        // Insert the order into the stripe_orders table
        const { error: orderError } = await supabase.from('stripe_orders').insert({
          checkout_session_id,
          payment_intent_id: payment_intent,
          customer_id: customerId,
          amount_subtotal,
          amount_total,
          currency,
          payment_status,
          status: 'completed',
        });

        if (orderError) {
          console.error('[handleEvent] Error inserting order:', orderError);
          return;
        }
        console.info('[handleEvent] Successfully processed one-time payment for session:', checkout_session_id);
      } catch (error) {
        console.error('[handleEvent] Error processing one-time payment:', error);
      }
    }
  }
}

async function syncCustomerFromStripe(customerId: string) {
  try {
    console.log('[syncCustomer] Starting sync for customer:', customerId);

    // fetch latest subscription data from Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 1,
      status: 'all',
      expand: ['data.default_payment_method'],
    });

    console.log('[syncCustomer] Found', subscriptions.data.length, 'subscriptions');

    if (subscriptions.data.length === 0) {
      console.info('[syncCustomer] No active subscriptions found for customer:', customerId);
      const { error: noSubError } = await supabase.from('stripe_subscriptions').upsert(
        {
          customer_id: customerId,
          status: 'not_started',
        },
        {
          onConflict: 'customer_id',
        },
      );

      if (noSubError) {
        console.error('[syncCustomer] Error updating subscription status:', noSubError);
        throw new Error('Failed to update subscription status in database');
      }
      console.log('[syncCustomer] Set status to not_started');
      return;
    }

    const subscription = subscriptions.data[0];
    console.log('[syncCustomer] Syncing subscription:', subscription.id, 'with status:', subscription.status);

    const upsertData = {
      customer_id: customerId,
      subscription_id: subscription.id,
      price_id: subscription.items.data[0].price.id,
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end,
      cancel_at_period_end: subscription.cancel_at_period_end,
      ...(subscription.default_payment_method && typeof subscription.default_payment_method !== 'string'
        ? {
            payment_method_brand: subscription.default_payment_method.card?.brand ?? null,
            payment_method_last4: subscription.default_payment_method.card?.last4 ?? null,
          }
        : {}),
      status: subscription.status,
    };

    console.log('[syncCustomer] Upserting subscription data:', JSON.stringify(upsertData, null, 2));

    const { error: subError } = await supabase.from('stripe_subscriptions').upsert(
      upsertData,
      {
        onConflict: 'customer_id',
      },
    );

    if (subError) {
      console.error('[syncCustomer] Error syncing subscription:', subError);
      throw new Error('Failed to sync subscription in database');
    }

    console.info('[syncCustomer] Successfully synced subscription for customer:', customerId);
    console.info('[syncCustomer] Database trigger will now sync to subscriptions table');
  } catch (error) {
    console.error('[syncCustomer] Failed to sync subscription for customer', customerId, ':', error);
    throw error;
  }
}