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

const PRICE_FOUNDING = Deno.env.get('STRIPE_PRICE_FOUNDING')!;
const PRICE_STANDARD = Deno.env.get('STRIPE_PRICE_STANDARD')!;

// Ventana de socio fundador: primeros 6 meses desde el lanzamiento (23 abril 2025)
const LAUNCH_DATE = new Date('2025-04-23T00:00:00Z');
const FOUNDING_WINDOW_END = new Date(LAUNCH_DATE);
FOUNDING_WINDOW_END.setMonth(FOUNDING_WINDOW_END.getMonth() + 6);

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { userId } = await req.json() as { userId: string };
    if (!userId) throw new Error('userId es obligatorio');

    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('email, name, created_at, stripe_customer_id')
      .eq('id', userId)
      .single();

    if (profileErr || !profile) throw new Error('Usuario no encontrado');

    // Crear o recuperar Stripe Customer
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

    // Calcular trial_end (6 meses desde la fecha de registro)
    const joinedAt = new Date(profile.created_at);
    const trialEnd = new Date(joinedAt);
    trialEnd.setMonth(trialEnd.getMonth() + 6);
    const trialEndUnix = Math.floor(trialEnd.getTime() / 1000);

    // Determinar precio según si es socio fundador
    const isFoundingMember = joinedAt <= FOUNDING_WINDOW_END;
    const priceId = isFoundingMember ? PRICE_FOUNDING : PRICE_STANDARD;

    // Crear suscripción en Stripe en estado "trialing" (sin cobrar, sin pedir tarjeta)
    const subscription = await stripe.subscriptions.create({
      customer:         stripeCustomerId,
      items:            [{ price: priceId }],
      trial_end:        trialEndUnix,
      payment_settings: { save_default_payment_method: 'on_subscription' },
      metadata:         { userId },
    });

    // Guardar en DB
    await supabaseAdmin
      .from('collaborator_subscriptions')
      .upsert({
        user_id:                userId,
        stripe_subscription_id: subscription.id,
        stripe_customer_id:     stripeCustomerId,
        status:                 'trial',
      }, { onConflict: 'user_id' });

    return new Response(
      JSON.stringify({ ok: true, subscriptionId: subscription.id, trialEnd: trialEnd.toISOString() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[init-collaborator-trial]', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
