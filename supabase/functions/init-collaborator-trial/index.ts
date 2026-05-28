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

const PRICE_FOUNDING = Deno.env.get('STRIPE_PRICE_FOUNDING')!;
const PRICE_STANDARD = Deno.env.get('STRIPE_PRICE_STANDARD')!;

const FOUNDING_WINDOW_END = new Date('2026-12-31T23:59:59Z');

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // userId siempre del JWT — nunca del cuerpo
    const userId = await requireAuth(req);

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('email, name, created_at, stripe_customer_id')
      .eq('id', userId)
      .single();

    if (profileErr || !profile) throw new UserFacingError('Perfil no encontrado');

    let stripeCustomerId = profile.stripe_customer_id as string | null;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email:    profile.email,
        name:     profile.name,
        metadata: { userId },
      });
      stripeCustomerId = customer.id;
      await supabaseAdmin
        .from('profiles')
        .update({ stripe_customer_id: stripeCustomerId })
        .eq('id', userId);
    }

    const joinedAt = new Date(profile.created_at);
    const isFoundingMember = joinedAt <= FOUNDING_WINDOW_END;
    const priceId = isFoundingMember ? PRICE_FOUNDING : PRICE_STANDARD;
    const trialEndUnix = isFoundingMember
      ? Math.floor(FOUNDING_WINDOW_END.getTime() / 1000)
      : undefined;

    const { data: existingSub } = await supabaseAdmin
      .from('collaborator_subscriptions')
      .select('stripe_subscription_id')
      .eq('user_id', userId)
      .single();

    let subscriptionId: string;

    if (existingSub?.stripe_subscription_id) {
      const updated = await stripe.subscriptions.update(existingSub.stripe_subscription_id, {
        ...(trialEndUnix ? { trial_end: trialEndUnix } : { trial_end: 'now' }),
      });
      subscriptionId = updated.id;
    } else {
      const subscription = await stripe.subscriptions.create({
        customer:         stripeCustomerId,
        items:            [{ price: priceId }],
        ...(trialEndUnix ? { trial_end: trialEndUnix } : {}),
        payment_settings: { save_default_payment_method: 'on_subscription' },
        metadata:         { userId },
      });
      subscriptionId = subscription.id;
    }

    await supabaseAdmin
      .from('collaborator_subscriptions')
      .upsert({
        user_id:                userId,
        stripe_subscription_id: subscriptionId,
        stripe_customer_id:     stripeCustomerId,
        status:                 isFoundingMember ? 'trial' : 'active',
      }, { onConflict: 'user_id' });

    return new Response(
      JSON.stringify({ ok: true, subscriptionId, trialEnd: isFoundingMember ? FOUNDING_WINDOW_END.toISOString() : null }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    console.error('[init-collaborator-trial]', err instanceof Error ? err.message : String(err));
    return errorResponse(err, corsHeaders);
  }
});
