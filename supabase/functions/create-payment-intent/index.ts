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

const LOCALSHOP_FEE_CENTS = 399; // 3,99 € comisión LocalShop

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { amount, userId, storeId, metadata, paymentMethodId } = await req.json() as {
      amount: number;
      userId?: string;
      storeId?: string;
      metadata?: Record<string, string>;
      paymentMethodId?: string;
    };

    if (!amount || amount <= 0) throw new Error('Importe inválido');

    let stripeCustomerId: string | undefined;
    let stripeConnectAccountId: string | undefined;

    // Buscar/crear cliente Stripe para usuarios registrados
    if (userId) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('stripe_customer_id, name, email')
        .eq('id', userId)
        .single();

      if (profile?.stripe_customer_id) {
        stripeCustomerId = profile.stripe_customer_id;
      } else if (profile) {
        const customer = await stripe.customers.create({
          email: profile.email,
          name: profile.name,
          metadata: { userId },
        });
        stripeCustomerId = customer.id;
        await supabaseAdmin
          .from('profiles')
          .update({ stripe_customer_id: stripeCustomerId })
          .eq('id', userId);
      }
    }

    // Obtener cuenta Connect del vendedor si hay storeId
    if (storeId) {
      const { data: store } = await supabaseAdmin
        .from('stores')
        .select('stripe_connect_account_id, stripe_connect_onboarded')
        .eq('id', storeId)
        .single();

      if (store?.stripe_connect_onboarded && store?.stripe_connect_account_id) {
        stripeConnectAccountId = store.stripe_connect_account_id;
      }
    }

    // Si viene una tarjeta guardada, adjuntarla al cliente (por si no lo estaba)
    if (paymentMethodId && stripeCustomerId) {
      try {
        await stripe.paymentMethods.attach(paymentMethodId, { customer: stripeCustomerId });
      } catch (_e) {
        // Ya estaba adjunta — ignorar el error
      }
    }

    // Crear PaymentIntent con o sin reparto según si el vendedor tiene Connect
    const paymentIntentParams: Stripe.PaymentIntentCreateParams = {
      amount: Math.round(amount),
      currency: 'eur',
      ...(stripeCustomerId ? { customer: stripeCustomerId } : {}),
      ...(paymentMethodId
        ? { payment_method: paymentMethodId, confirm: false }
        : { automatic_payment_methods: { enabled: true } }),
      metadata: metadata ?? {},
    };

    if (stripeConnectAccountId) {
      // Con Connect: el pago va al vendedor, LocalShop se queda la comisión
      paymentIntentParams.application_fee_amount = LOCALSHOP_FEE_CENTS;
      paymentIntentParams.transfer_data = { destination: stripeConnectAccountId };
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

    return new Response(
      JSON.stringify({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[create-payment-intent]', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
