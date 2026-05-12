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
    const { userId, paymentMethodId } = await req.json() as { userId: string; paymentMethodId: string };
    if (!userId || !paymentMethodId) throw new Error('userId y paymentMethodId son obligatorios');

    // Obtener datos del colaborador
    const { data: sub } = await supabaseAdmin
      .from('collaborator_subscriptions')
      .select('stripe_subscription_id, stripe_customer_id')
      .eq('user_id', userId)
      .single();

    if (!sub?.stripe_customer_id) throw new Error('No se encontró la cuenta Stripe del colaborador');

    // Vincular la tarjeta al cliente de Stripe
    await stripe.paymentMethods.attach(paymentMethodId, { customer: sub.stripe_customer_id });

    // Establecer como método de pago por defecto
    await stripe.customers.update(sub.stripe_customer_id, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });

    // Vincular a la suscripción si existe
    if (sub.stripe_subscription_id) {
      await stripe.subscriptions.update(sub.stripe_subscription_id, {
        default_payment_method: paymentMethodId,
      });
    }

    // Marcar en DB que ya tiene método de pago
    await supabaseAdmin
      .from('collaborator_subscriptions')
      .update({ payment_method_attached: true })
      .eq('user_id', userId);

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[attach-payment-method]', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
