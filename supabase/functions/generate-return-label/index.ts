import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { requireAuth, UserFacingError, errorResponse } from '../_shared/auth.ts';
import { createReturnParcel } from '../_shared/sendcloud.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const CORS_ORIGIN = Deno.env.get('APP_CORS_ORIGIN') || '*';
const corsHeaders = {
  'Access-Control-Allow-Origin':  CORS_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEFAULT_WEIGHT_KG = 0.5;
const REQUEST_LABEL     = Deno.env.get('SENDCLOUD_REQUEST_LABEL') !== 'false';
const RESEND_API_KEY    = Deno.env.get('RESEND_API_KEY');

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    await requireAuth(req);
    const { returnId } = await req.json() as { returnId: string };
    if (!returnId) throw new UserFacingError('returnId es obligatorio');

    // Obtener la devolución
    const { data: returnReq } = await supabaseAdmin
      .from('return_requests')
      .select('id, order_id, customer_id, type, status, return_label_url')
      .eq('id', returnId)
      .single();

    if (!returnReq) throw new UserFacingError('Devolución no encontrada', 404);
    if (returnReq.type !== 'error_tara') throw new UserFacingError('Solo se generan etiquetas para error/tara');
    if (returnReq.status !== 'esperando_recepcion') throw new UserFacingError('La devolución debe estar en estado esperando_recepcion');
    if (returnReq.return_label_url) throw new UserFacingError('Esta devolución ya tiene etiqueta generada');

    // Obtener el pedido con dirección de entrega (= origen del retorno)
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select(`
        id, store_id, customer_name, shipping_phone,
        shipping_name, shipping_street, shipping_number,
        shipping_postal_code, shipping_city, shipping_country
      `)
      .eq('id', returnReq.order_id)
      .single();

    if (!order) throw new UserFacingError('Pedido no encontrado', 404);

    // Obtener email del cliente para enviarle la etiqueta
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email, phone')
      .eq('id', returnReq.customer_id)
      .single();

    // Validar dirección del cliente
    if (!order.shipping_street || !order.shipping_postal_code || !order.shipping_city) {
      throw new UserFacingError('El pedido no tiene dirección de recogida registrada.');
    }

    const parcel = await createReturnParcel({
      orderNumber:  returnReq.order_id,
      weight:       DEFAULT_WEIGHT_KG,
      requestLabel: REQUEST_LABEL,
      sender: {
        name:         order.shipping_name ?? order.customer_name,
        street:       order.shipping_street,
        house_number: order.shipping_number ?? 's/n',
        postal_code:  order.shipping_postal_code,
        city:         order.shipping_city,
        country:      order.shipping_country ?? 'ES',
        telephone:    order.shipping_phone ?? profile?.phone ?? '',
        email:        profile?.email ?? '',
      },
    });

    const labelUrl = parcel.label?.normal_printer?.[0] ?? null;

    // Guardar datos en return_requests
    await supabaseAdmin
      .from('return_requests')
      .update({
        sendcloud_return_id:    parcel.id,
        return_label_url:       labelUrl,
        return_tracking_number: parcel.tracking_number,
        return_carrier:         parcel.carrier?.code ?? 'desconocido',
        return_label_cost:      DEFAULT_WEIGHT_KG, // se actualiza via webhook con precio real
      })
      .eq('id', returnId);

    // Enviar email al cliente (con PDF si está disponible, con tracking si no)
    if (RESEND_API_KEY && profile?.email) {
      const labelSection = labelUrl
        ? `<p><a href="${labelUrl}" style="background:#c29b88;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Descargar etiqueta PDF</a></p>`
        : `<p>La etiqueta PDF estará disponible en la app en unos minutos. También puedes descargarla desde <strong>Mis Pedidos → Ver etiqueta</strong>.</p>`;
      await fetch('https://api.resend.com/emails', {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          from:    'LocalShop <noreply@localshop.es>',
          to:      [profile.email],
          subject: 'Tu etiqueta de devolución — LocalShop',
          html: `
            <h2>Devolución aceptada — etiqueta prepagada</h2>
            <p>El colaborador ha aceptado la devolución. Hemos generado tu etiqueta de devolución prepagada.</p>
            <p><strong>Instrucciones:</strong></p>
            <ol>
              <li>Imprime la etiqueta y pégala en el paquete bien visible.</li>
              <li>Lleva el paquete a cualquier oficina de Correos.</li>
              <li><strong>No pagas nada</strong> — el envío está prepagado.</li>
              <li>Cuando el colaborador confirme la recepción, recibirás tu reembolso.</li>
            </ol>
            ${labelSection}
            <p>Número de seguimiento: <strong>${parcel.tracking_number}</strong></p>
            <br/>
            <p>El equipo de LocalShop</p>
          `,
        }),
      }).catch(e => console.error('[generate-return-label] email error:', e));
    }

    return new Response(
      JSON.stringify({
        ok:             true,
        parcelId:       parcel.id,
        trackingNumber: parcel.tracking_number,
        labelUrl,
        carrier:        parcel.carrier?.code,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    console.error('[generate-return-label]', err instanceof Error ? err.message : String(err));
    return errorResponse(err, corsHeaders);
  }
});
