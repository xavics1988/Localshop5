import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { userId, priceId } = await req.json() as {
      userId: string;
      priceId: string;
    };

    if (!userId || !priceId) throw new Error('userId y priceId son obligatorios');

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id, name, email')
      .eq('id', userId)
      .single();

    if (!profile) throw new Error('Usuario no encontrado');

    let stripeCustomerId = profile.stripe_customer_id as string | null;

    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: profile.email,
        name:  profile.name,
        metadata: { userId },
      });
      stripeCustomerId = customer.id;
      await supabaseAdmin
        .from('profiles')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', userId);
    }

    const subscription = await stripe.subscriptions.create({
      customer:          stripeCustomerId,
      items:             [{ price: priceId }],
      payment_behavior:  'default_incomplete',
      payment_settings:  { save_default_payment_method: 'on_subscription' },
      expand:            ['latest_invoice.payment_intent'],
      metadata:          { userId },
    });

    const latestInvoice  = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent  = latestInvoice.payment_intent as Stripe.PaymentIntent;

    await supabaseAdmin
      .from('collaborator_subscriptions')
      .update({
        stripe_subscription_id: subscription.id,
        stripe_customer_id:     stripeCustomerId,
      })
      .eq('user_id', userId);

    return new Response(
      JSON.stringify({
        clientSecret:   paymentIntent.client_secret,
        subscriptionId: subscription.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[create-subscription]', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
