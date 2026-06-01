import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { requireAuth, UserFacingError, errorResponse } from '../_shared/auth.ts';
import { createParcel } from '../_shared/sendcloud.ts';

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const CORS_ORIGIN = Deno.env.get('APP_CORS_ORIGIN') || '*';
const corsHeaders = {
  'Access-Control-Allow-Origin':  CORS_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Peso por defecto en kg si no hay dato del producto
const DEFAULT_WEIGHT_KG = 0.5;

// true = etiqueta real (producción), false = sin coste (pruebas)
const REQUEST_LABEL = Deno.env.get('SENDCLOUD_REQUEST_LABEL') === 'true';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const userId = await requireAuth(req);
    const { orderId } = await req.json() as { orderId: string };
    if (!orderId) throw new UserFacingError('orderId es obligatorio');

    // Obtener el pedido con dirección de entrega
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select(`
        id, store_id, customer_name, shipping_phone,
        shipping_name, shipping_street, shipping_number,
        shipping_postal_code, shipping_city, shipping_province, shipping_country,
        shipping_label_url, sendcloud_parcel_id
      `)
      .eq('id', orderId)
      .single();

    if (!order) throw new UserFacingError('Pedido no encontrado', 404);
    if (order.shipping_label_url) throw new UserFacingError('Este pedido ya tiene etiqueta generada');

    // Verificar que el colaborador es dueño de la tienda
    const { data: store } = await supabaseAdmin
      .from('stores')
      .select('id, name, owner_id, address_street, address_number, address_postal_code, address_city, address_country')
      .eq('id', order.store_id)
      .single();

    if (!store) throw new UserFacingError('Tienda no encontrada', 404);
    if (store.owner_id !== userId) throw new UserFacingError('No autorizado', 403);

    // Validar que la tienda tiene dirección estructurada
    if (!store.address_street || !store.address_postal_code || !store.address_city) {
      throw new UserFacingError('La tienda no tiene dirección completa configurada. Actualiza tu perfil de tienda.');
    }

    // Validar que el pedido tiene dirección de entrega
    if (!order.shipping_street || !order.shipping_postal_code || !order.shipping_city) {
      throw new UserFacingError('El pedido no tiene dirección de entrega registrada.');
    }

    const parcel = await createParcel({
      orderNumber:  orderId,
      weight:       DEFAULT_WEIGHT_KG,
      requestLabel: REQUEST_LABEL,
      sender: {
        name:         store.name,
        street:       store.address_street,
        house_number: store.address_number ?? 's/n',
        postal_code:  store.address_postal_code,
        city:         store.address_city,
        country:      store.address_country ?? 'ES',
      },
      recipient: {
        name:         order.shipping_name ?? order.customer_name,
        street:       order.shipping_street,
        house_number: order.shipping_number ?? 's/n',
        postal_code:  order.shipping_postal_code,
        city:         order.shipping_city,
        country:      order.shipping_country ?? 'ES',
        telephone:    order.shipping_phone ?? '',
      },
    });

    // Guardar datos de tracking en el pedido
    const labelUrl = parcel.label?.normal_printer?.[0] ?? null;
    await supabaseAdmin
      .from('orders')
      .update({
        sendcloud_parcel_id: parcel.id,
        shipping_label_url:  labelUrl,
        tracking_number:     parcel.tracking_number,
        carrier:             parcel.carrier?.code ?? 'desconocido',
      })
      .eq('id', orderId);

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
    console.error('[generate-shipping-label]', err instanceof Error ? err.message : String(err));
    return errorResponse(err, corsHeaders);
  }
});
