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
    const { storeId } = await req.json() as { storeId: string };
    if (!storeId) throw new Error('storeId es obligatorio');

    const { data: store, error: storeErr } = await supabaseAdmin
      .from('stores')
      .select('stripe_connect_account_id')
      .eq('id', storeId)
      .single();

    if (storeErr || !store?.stripe_connect_account_id) {
      return new Response(
        JSON.stringify({ onboarded: false, reason: 'no_account' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const account = await stripe.accounts.retrieve(store.stripe_connect_account_id);
    const onboarded = account.payouts_enabled === true && account.details_submitted === true;

    if (onboarded) {
      await supabaseAdmin
        .from('stores')
        .update({ stripe_connect_onboarded: true })
        .eq('id', storeId);
    }

    return new Response(
      JSON.stringify({ onboarded, chargesEnabled: account.charges_enabled }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[check-connect-status]', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
