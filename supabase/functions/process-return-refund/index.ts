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
    const { returnId } = await req.json() as { returnId: string };
    if (!returnId) throw new UserFacingError('returnId es obligatorio');

    // Obtener la solicitud de devolución con su sub_order si existe
    const { data: returnReq } = await supabaseAdmin
      .from('return_requests')
      .select('id, order_id, sub_order_id, customer_id, collaborator_id, type, refund_amount, status, stripe_refund_id')
      .eq('id', returnId)
      .single();

    if (!returnReq) throw new UserFacingError('Solicitud de devolución no encontrada', 404);
    if (returnReq.customer_id !== userId && returnReq.collaborator_id !== userId) {
      throw new UserFacingError('No autorizado', 403);
    }
    if (returnReq.status !== 'acordado')     throw new UserFacingError('La devolución no está en estado acordado');
    if (returnReq.stripe_refund_id)          throw new UserFacingError('Esta devolución ya fue procesada');
    if (!returnReq.refund_amount || returnReq.refund_amount <= 0) {
      throw new UserFacingError('Importe de reembolso inválido');
    }

    // Obtener el PaymentIntent del pedido
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('stripe_payment_intent_id')
      .eq('id', returnReq.order_id)
      .single();

    if (!order?.stripe_payment_intent_id) {
      throw new UserFacingError('El pedido no tiene PaymentIntent asociado');
    }

    const refundAmountCents = Math.round(returnReq.refund_amount * 100);

    // Parámetros base del reembolso
    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: order.stripe_payment_intent_id,
      amount:         refundAmountCents,
    };

    // Para pedidos de tienda única con Connect:
    // error_tara → devolver también el fee de LocalShop y revertir transfer automáticamente
    if (returnReq.type === 'error_tara' && !returnReq.sub_order_id) {
      refundParams.refund_application_fee = true;
      refundParams.reverse_transfer       = true;
    }

    // 1. Reembolso al cliente
    const refund = await stripe.refunds.create(refundParams);

    // 2. Para pedidos multi-tienda: revertir el transfer del sub_order manualmente
    if (returnReq.sub_order_id) {
      const { data: subOrder } = await supabaseAdmin
        .from('sub_orders')
        .select('stripe_transfer_id, subtotal, shipping_fee')
        .eq('id', returnReq.sub_order_id)
        .single();

      if (subOrder?.stripe_transfer_id) {
        const subOrderTotal   = (subOrder.subtotal ?? 0) + (subOrder.shipping_fee ?? 0);
        const reversalAmount  = Math.min(refundAmountCents, Math.round(subOrderTotal * 100));

        try {
          await stripe.transfers.createReversal(subOrder.stripe_transfer_id, {
            amount: reversalAmount,
          });
        } catch (reversalErr) {
          // Log pero no bloquear — el reembolso al cliente ya se ejecutó
          console.error('[process-return-refund] transfer reversal failed:', reversalErr);
        }
      }
    }

    // 3. Registrar refundId e marcar como completado
    await supabaseAdmin
      .from('return_requests')
      .update({ stripe_refund_id: refund.id, status: 'completado' })
      .eq('id', returnId);

    // 4. Limpiar fotos de prueba del storage
    const { data: storageFiles } = await supabaseAdmin.storage.from('return-evidence').list(returnId);
    if (storageFiles && storageFiles.length > 0) {
      await supabaseAdmin.storage.from('return-evidence').remove(storageFiles.map((f: { name: string }) => `${returnId}/${f.name}`));
    }
    await supabaseAdmin.from('return_messages').delete().eq('return_id', returnId);

    await supabaseAdmin
      .from('orders')
      .update({ status: 'Devuelto' })
      .eq('id', returnReq.order_id);

    return new Response(
      JSON.stringify({ ok: true, refundId: refund.id, amount: returnReq.refund_amount }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    console.error('[process-return-refund]', err instanceof Error ? err.message : String(err));
    return errorResponse(err, corsHeaders);
  }
});
