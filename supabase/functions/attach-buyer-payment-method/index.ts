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

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id, name, email')
      .eq('id', userId)
      .single();

    if (!profile?.stripe_customer_id) throw new Error('No se encontró la cuenta Stripe del comprador');

    try {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: profile.stripe_customer_id });
    } catch (_e) {
      // Ya estaba adjunta — ignorar
    }

    return new Response(
      JSON.stringify({ ok: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[attach-buyer-payment-method]', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
