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
async function requireAuth(req: Request): Promise<string> {
  const h = req.headers.get('Authorization');
  if (!h?.startsWith('Bearer ')) throw new AuthError();
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

const CORS_ORIGIN = Deno.env.get('APP_CORS_ORIGIN') || '*';
const corsHeaders = {
  'Access-Control-Allow-Origin': CORS_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const userId = await requireAuth(req);
    const { orderId, paymentIntentId } = await req.json() as {
      orderId: string;
      paymentIntentId: string;
    };

    if (!orderId || !paymentIntentId) {
      throw new UserFacingError('orderId y paymentIntentId son obligatorios');
    }

    // Verificar que el pedido pertenece al usuario autenticado
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('id, customer_id')
      .eq('id', orderId)
      .single();

    if (!order || order.customer_id !== userId) {
      throw new UserFacingError('Pedido no encontrado', 404);
    }

    // Obtener chargeId desde el PaymentIntent para vincular transfers
    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
    const chargeId = typeof pi.latest_charge === 'string'
      ? pi.latest_charge
      : (pi.latest_charge as Stripe.Charge | null)?.id;

    // Buscar sub_orders sin transfer (idempotencia)
    const { data: subOrders } = await supabaseAdmin
      .from('sub_orders')
      .select('id, store_id, collaborator_id, subtotal, shipping_fee')
      .eq('parent_order_id', orderId)
      .is('stripe_transfer_id', null);

    if (!subOrders || subOrders.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, transfers: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const results: Array<{ subOrderId: string; status: string; transferId?: string; reason?: string }> = [];

    for (const sub of subOrders) {
      const { data: store } = await supabaseAdmin
        .from('stores')
        .select('stripe_connect_account_id, stripe_connect_onboarded')
        .eq('id', sub.store_id)
        .single();

      if (!store?.stripe_connect_onboarded || !store?.stripe_connect_account_id) {
        results.push({ subOrderId: sub.id, status: 'skipped', reason: 'sin Connect' });
        continue;
      }

      const transferAmount = Math.round(((sub.subtotal ?? 0) * 0.90 + (sub.shipping_fee ?? 0)) * 100);

      try {
        const transfer = await stripe.transfers.create({
          amount:      transferAmount,
          currency:    'eur',
          destination: store.stripe_connect_account_id,
          ...(chargeId ? { source_transaction: chargeId } : {}),
          metadata: {
            subOrderId:    sub.id,
            orderId,
            storeId:       sub.store_id,
            sellerId:      sub.collaborator_id ?? '',
          },
        });

        await supabaseAdmin
          .from('sub_orders')
          .update({ stripe_transfer_id: transfer.id })
          .eq('id', sub.id);

        results.push({ subOrderId: sub.id, status: 'ok', transferId: transfer.id });
      } catch (transferErr) {
        console.error(`[create-multistore-transfers] sub_order ${sub.id}:`, transferErr);
        results.push({ subOrderId: sub.id, status: 'failed', reason: String(transferErr) });
      }
    }

    return new Response(
      JSON.stringify({ ok: true, transfers: results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    console.error('[create-multistore-transfers]', err instanceof Error ? err.message : String(err));
    return errorResponse(err, corsHeaders);
  }
});
