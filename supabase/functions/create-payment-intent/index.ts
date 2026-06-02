import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
// ── inline _shared/auth.ts ──────────────────────────────────────────────────
class AuthError extends Error {
  readonly status = 401;
  constructor() { super('No autorizado'); this.name = 'AuthError'; }
}
class UserFacingError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) { super(message); this.name = 'UserFacingError'; this.status = status; }
}
async function tryGetAuth(req: Request): Promise<string | null> {
  const h = req.headers.get('Authorization');
  if (!h) return null;
  if (!h.startsWith('Bearer ')) throw new AuthError();
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(h.slice(7));
  if (error || !user) throw new AuthError();
  return user.id;
}
function errorResponse(err: unknown, corsHeaders: Record<string, string>): Response {
  if (err instanceof AuthError)       return new Response(JSON.stringify({ error: 'No autorizado' }),              { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  if (err instanceof UserFacingError) return new Response(JSON.stringify({ error: err.message }),                  { status: err.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  return new Response(JSON.stringify({ error: 'Error interno del servidor' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
// ────────────────────────────────────────────────────────────────────────────

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// En producción establece APP_CORS_ORIGIN al dominio exacto de la app web
const CORS_ORIGIN = Deno.env.get('APP_CORS_ORIGIN') || '*';
const corsHeaders = {
  'Access-Control-Allow-Origin': CORS_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOCALSHOP_FEE_CENTS = 399;

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // El userId se obtiene siempre del JWT, nunca del cuerpo de la petición.
    // tryGetAuth devuelve null para compras de invitado (sin cabecera Authorization).
    // Si hay cabecera pero el token es inválido lanza AuthError (evita suplantación).
    const authenticatedUserId = await tryGetAuth(req);

    const { amount, storeId, metadata, paymentMethodId } = await req.json() as {
      amount: number;
      storeId?: string;
      metadata?: Record<string, string>;
      paymentMethodId?: string;
    };

    if (!amount || amount <= 0) throw new UserFacingError('Importe inválido');

    let stripeCustomerId: string | undefined;
    let stripeConnectAccountId: string | undefined;

    if (authenticatedUserId) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('stripe_customer_id, name, email')
        .eq('id', authenticatedUserId)
        .single();

      if (profile?.stripe_customer_id) {
        stripeCustomerId = profile.stripe_customer_id;
      } else if (profile) {
        const customer = await stripe.customers.create({
          email: profile.email,
          name: profile.name,
          metadata: { userId: authenticatedUserId },
        });
        stripeCustomerId = customer.id;
        await supabaseAdmin
          .from('profiles')
          .update({ stripe_customer_id: stripeCustomerId })
          .eq('id', authenticatedUserId);
      }
    }

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

    if (paymentMethodId && stripeCustomerId) {
      try {
        await stripe.paymentMethods.attach(paymentMethodId, { customer: stripeCustomerId });
      } catch (_e) {
        // Ya estaba adjunta
      }
    }

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
      // on_behalf_of: el fee de Stripe sale del vendedor, no de LocalShop
      paymentIntentParams.on_behalf_of = stripeConnectAccountId;
      paymentIntentParams.application_fee_amount = LOCALSHOP_FEE_CENTS;
      paymentIntentParams.transfer_data = { destination: stripeConnectAccountId };
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

    return new Response(
      JSON.stringify({ clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    // Surface Stripe API errors as UserFacingError so the client sees the real message
    if (err && typeof err === 'object' && 'type' in err) {
      const stripeErr = err as { type: string; message?: string; code?: string };
      console.error('[create-payment-intent] Stripe error', stripeErr.type, stripeErr.code, stripeErr.message);
      return errorResponse(new UserFacingError(stripeErr.message ?? 'Error de Stripe', 402), corsHeaders);
    }
    console.error('[create-payment-intent]', err instanceof Error ? err.message : String(err));
    return errorResponse(err, corsHeaders);
  }
});
