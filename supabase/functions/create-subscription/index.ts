import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { requireAuth, UserFacingError, errorResponse } from '../_shared/auth.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const CORS_ORIGIN = Deno.env.get('APP_CORS_ORIGIN') || '*';
const corsHeaders = {
  'Access-Control-Allow-Origin': CORS_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // userId siempre del JWT — nunca del cuerpo
    const userId = await requireAuth(req);

    const { priceId } = await req.json() as { priceId: string };
    if (!priceId) throw new UserFacingError('priceId es obligatorio');

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id, name, email')
      .eq('id', userId)
      .single();

    if (!profile) throw new UserFacingError('Perfil no encontrado');

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
      .upsert({
        user_id:                userId,
        stripe_subscription_id: subscription.id,
        stripe_customer_id:     stripeCustomerId,
        status:                 'incomplete',
      }, { onConflict: 'user_id' });

    return new Response(
      JSON.stringify({
        clientSecret:   paymentIntent.client_secret,
        subscriptionId: subscription.id,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    console.error('[create-subscription]', err instanceof Error ? err.message : String(err));
    return errorResponse(err, corsHeaders);
  }
});
