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
    const { payoutId } = await req.json() as { payoutId: string };
    if (!payoutId) throw new Error('payoutId es obligatorio');

    const { data: payout } = await supabaseAdmin
      .from('payouts')
      .select('id, gross_amount, store_id, seller_id, status')
      .eq('id', payoutId)
      .single();

    if (!payout)               throw new Error('Payout no encontrado');
    if (payout.status !== 'pending') throw new Error(`No se puede procesar un payout en estado: ${payout.status}`);

    const { data: store } = await supabaseAdmin
      .from('stores')
      .select('stripe_connect_account_id, stripe_connect_onboarded')
      .eq('id', payout.store_id)
      .single();

    if (!store?.stripe_connect_account_id) {
      throw new Error('La tienda no tiene cuenta Stripe Connect configurada');
    }
    if (!store.stripe_connect_onboarded) {
      throw new Error('La cuenta Stripe Connect de la tienda no ha completado el onboarding');
    }

    const amountInCents = Math.round(payout.gross_amount * 100);

    const transfer = await stripe.transfers.create({
      amount:      amountInCents,
      currency:    'eur',
      destination: store.stripe_connect_account_id,
      metadata: {
        payoutId:  payout.id,
        storeId:   payout.store_id,
        sellerId:  payout.seller_id,
      },
    });

    await supabaseAdmin
      .from('payouts')
      .update({ stripe_transfer_id: transfer.id, status: 'processing' })
      .eq('id', payoutId);

    return new Response(
      JSON.stringify({ transferId: transfer.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[create-payout]', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
