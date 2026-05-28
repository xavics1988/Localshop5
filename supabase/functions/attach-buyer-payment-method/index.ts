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

    const { paymentMethodId } = await req.json() as { paymentMethodId: string };
    if (!paymentMethodId) throw new UserFacingError('paymentMethodId es obligatorio');

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id, name, email')
      .eq('id', userId)
      .single();

    if (!profile?.stripe_customer_id) throw new UserFacingError('No se encontró la cuenta Stripe del comprador');

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
    console.error('[attach-buyer-payment-method]', err instanceof Error ? err.message : String(err));
    return errorResponse(err, corsHeaders);
  }
});
