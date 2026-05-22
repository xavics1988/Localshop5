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
    // Verify the request comes from an authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No autorizado');

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', ''),
    );
    if (authError || !user) throw new Error('Token inválido o expirado');

    const userId = user.id;

    // Fetch profile and store data
    const [profileResult, subscriptionResult, storeResult] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('stripe_customer_id, role')
        .eq('id', userId)
        .single(),
      supabaseAdmin
        .from('collaborator_subscriptions')
        .select('stripe_subscription_id, stripe_customer_id')
        .eq('user_id', userId)
        .maybeSingle(),
      supabaseAdmin
        .from('stores')
        .select('stripe_connect_account_id')
        .eq('owner_id', userId)
        .maybeSingle(),
    ]);

    const profile = profileResult.data;
    const subscription = subscriptionResult.data;
    const store = storeResult.data;

    // --- Stripe cleanup (best-effort, do not block deletion if Stripe fails) ---

    // 1. Cancel active Stripe subscription
    const stripeSubscriptionId = subscription?.stripe_subscription_id;
    if (stripeSubscriptionId) {
      try {
        const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        if (sub.status !== 'canceled') {
          await stripe.subscriptions.cancel(stripeSubscriptionId, {
            prorate: false,
          });
        }
      } catch (e) {
        console.warn('[delete-account] Could not cancel subscription:', e);
      }
    }

    // 2. Delete Stripe customer (removes all payment methods and invoices)
    const stripeCustomerId = profile?.stripe_customer_id ?? subscription?.stripe_customer_id;
    if (stripeCustomerId) {
      try {
        await stripe.customers.del(stripeCustomerId);
      } catch (e) {
        console.warn('[delete-account] Could not delete Stripe customer:', e);
      }
    }

    // 3. Delete Stripe Connect account (collaborators only)
    const stripeConnectAccountId = store?.stripe_connect_account_id;
    if (stripeConnectAccountId) {
      try {
        await stripe.accounts.del(stripeConnectAccountId);
      } catch (e) {
        console.warn('[delete-account] Could not delete Connect account:', e);
      }
    }

    // --- Delete auth user (CASCADE deletes profiles + all related rows) ---
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) throw new Error(`Error al eliminar usuario: ${deleteError.message}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[delete-account]', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
