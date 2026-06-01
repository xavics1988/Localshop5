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

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const CORS_ORIGIN  = Deno.env.get('APP_CORS_ORIGIN') || '*';
const corsHeaders  = {
  'Access-Control-Allow-Origin': CORS_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Variables de entorno requeridas en Supabase Dashboard → Edge Function Secrets:
//   ADMIN_EMAIL   → mx.localshop@gmail.com  (o el correo del admin)
//   RESEND_API_KEY → clave de API de Resend (https://resend.com)
const ADMIN_EMAIL    = Deno.env.get('ADMIN_EMAIL')    || 'mx.localshop@gmail.com';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    await requireAuth(req);

    const { returnId } = await req.json() as { returnId: string };
    if (!returnId) throw new UserFacingError('returnId requerido');

    // Obtener datos de la mediación creada por resolve_return('rechazado')
    const { data: mediation, error: medErr } = await supabaseAdmin
      .from('mediations')
      .select('id, order_id, customer_reason, created_at')
      .eq('return_id', returnId)
      .eq('status', 'pendiente')
      .maybeSingle();

    if (medErr) throw new Error(medErr.message);
    if (!mediation) {
      // La mediación puede no existir aún si hay latencia; se registra pero no falla
      console.warn('[notify-mediation] mediación no encontrada para returnId:', returnId);
      return new Response(
        JSON.stringify({ success: true, warning: 'mediación no encontrada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Datos adicionales del pedido y la devolución
    const { data: returnReq } = await supabaseAdmin
      .from('return_requests')
      .select('type, reason')
      .eq('id', returnId)
      .single();

    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('total')
      .eq('id', mediation.order_id)
      .single();

    const returnType = returnReq?.type === 'error_tara' ? 'Error / Tara' : 'Desistimiento';
    const orderTotal = order?.total ? `€${Number(order.total).toFixed(2)}` : '—';
    const fechaStr   = new Date(mediation.created_at).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });

    if (RESEND_API_KEY) {
      const html = `
        <h2 style="color:#d97706">⚠️ Mediación requerida — LocalShop</h2>
        <table style="border-collapse:collapse;width:100%;font-family:sans-serif;font-size:14px">
          <tr><td style="padding:6px 12px;font-weight:bold">Mediación ID</td><td>${mediation.id}</td></tr>
          <tr style="background:#f9fafb"><td style="padding:6px 12px;font-weight:bold">Pedido ID</td><td>${mediation.order_id}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold">Tipo de devolución</td><td>${returnType}</td></tr>
          <tr style="background:#f9fafb"><td style="padding:6px 12px;font-weight:bold">Motivo del cliente</td><td>${mediation.customer_reason || '—'}</td></tr>
          <tr><td style="padding:6px 12px;font-weight:bold">Importe del pedido</td><td>${orderTotal}</td></tr>
          <tr style="background:#f9fafb"><td style="padding:6px 12px;font-weight:bold">Fecha</td><td>${fechaStr}</td></tr>
        </table>
        <p style="margin-top:16px;font-family:sans-serif;font-size:13px;color:#6b7280">
          El colaborador ha rechazado la solicitud de devolución.<br>
          Por favor, accede al panel de administración para revisar el caso e intervenir como mediador.
        </p>
      `;

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from:    'LocalShop <noreply@localshop.es>',
          to:      [ADMIN_EMAIL],
          subject: `⚠️ Mediación requerida — Pedido ${mediation.order_id}`,
          html,
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        console.error('[notify-mediation] Resend error:', res.status, body);
      }
    } else {
      // Sin RESEND_API_KEY: registrar en logs (visible en Supabase Edge Function Logs)
      console.log('[notify-mediation] RESEND_API_KEY no configurado. Datos de la mediación:', {
        mediationId:    mediation.id,
        orderId:        mediation.order_id,
        returnType,
        customerReason: mediation.customer_reason,
        orderTotal,
        fecha:          fechaStr,
      });
    }

    return new Response(
      JSON.stringify({ success: true, mediationId: mediation.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[notify-mediation]', err instanceof Error ? err.message : String(err));
    return errorResponse(err, corsHeaders);
  }
});
