import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Códigos de estado de Sendcloud → estado en LocalShop
// https://support.sendcloud.com/hc/en-us/articles/360024967432
const STATUS_MAP: Record<number, string | null> = {
  1:   null,           // Pendiente
  2:   null,           // En preparación
  3:   'En Proceso',   // Enviado al transportista
  11:  'En Proceso',   // En tránsito
  12:  'En Proceso',   // En reparto
  15:  'Completado',   // Entregado
  17:  null,           // Sin cambio (intento fallido)
  20:  null,           // Fallo de entrega — notificar
  22:  null,           // Devuelto al remitente
  80:  null,           // Cancelado
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const payload = await req.json();
    const parcel  = payload?.parcel;

    if (!parcel) {
      return new Response('ok', { headers: corsHeaders });
    }

    const parcelId    = parcel.id as number;
    const statusCode  = parcel.status?.id as number;
    const isReturn    = parcel.is_return as boolean;
    const orderNumber = parcel.order_number as string;

    console.log(`[sendcloud-webhook] parcel=${parcelId} status=${statusCode} return=${isReturn} order=${orderNumber}`);

    if (isReturn) {
      // Retorno: buscar por sendcloud_return_id
      const { data: returnReq } = await supabaseAdmin
        .from('return_requests')
        .select('id, order_id')
        .eq('sendcloud_return_id', parcelId)
        .maybeSingle();

      if (returnReq && statusCode === 15) {
        // Retorno entregado al colaborador → marcar orden como Devuelto
        await supabaseAdmin
          .from('orders')
          .update({
            status:  'Devuelto',
            history: supabaseAdmin.rpc('append_order_history', {
              p_order_id: returnReq.order_id,
              p_status:   'Devuelto',
              p_label:    'Artículo devuelto al colaborador',
            }),
          })
          .eq('id', returnReq.order_id);
      }
    } else {
      // Envío normal: buscar por sendcloud_parcel_id
      const { data: order } = await supabaseAdmin
        .from('orders')
        .select('id, status')
        .eq('sendcloud_parcel_id', parcelId)
        .maybeSingle();

      if (order) {
        const newStatus = STATUS_MAP[statusCode];

        if (newStatus && newStatus !== order.status) {
          const label = newStatus === 'Completado'
            ? 'Pedido entregado'
            : 'Pedido en camino';

          await supabaseAdmin
            .from('orders')
            .update({ status: newStatus })
            .eq('id', order.id);

          // Añadir evento al historial
          await supabaseAdmin.rpc('append_order_event', {
            p_order_id: order.id,
            p_status:   newStatus,
            p_label:    label,
          }).maybeSingle();
        }
      }
    }

    return new Response('ok', { status: 200, headers: corsHeaders });
  } catch (err: unknown) {
    console.error('[sendcloud-webhook]', err instanceof Error ? err.message : String(err));
    // Devolver 200 siempre para que Sendcloud no reintente indefinidamente
    return new Response('ok', { status: 200, headers: corsHeaders });
  }
});
