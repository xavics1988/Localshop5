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

// URL base de la app (configura APP_BASE_URL en Supabase Secrets)
const APP_BASE_URL = Deno.env.get('APP_BASE_URL') || 'http://localhost:3000';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { storeId, email, returnUrl } = await req.json() as { storeId: string; email: string; returnUrl?: string };

    if (!storeId || !email) throw new Error('storeId y email son obligatorios');

    const { data: store } = await supabaseAdmin
      .from('stores')
      .select('stripe_connect_account_id')
      .eq('id', storeId)
      .single();

    let accountId = store?.stripe_connect_account_id as string | null;

    if (!accountId) {
      const account = await stripe.accounts.create({
        type:          'express',
        country:       'ES',
        email,
        capabilities: {
          card_payments: { requested: true },
          transfers:     { requested: true },
        },
        business_type: 'individual',
        metadata:      { storeId },
      });
      accountId = account.id;
      await supabaseAdmin
        .from('stores')
        .update({ stripe_connect_account_id: accountId })
        .eq('id', storeId);
    }

    const baseUrl = returnUrl || APP_BASE_URL;
    const accountLink = await stripe.accountLinks.create({
      account:     accountId,
      refresh_url: `${baseUrl}/payment-methods`,
      return_url:  `${baseUrl}/payment-methods?connect=success`,
      type:        'account_onboarding',
    });

    return new Response(
      JSON.stringify({ onboardingUrl: accountLink.url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[create-connect-account]', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
