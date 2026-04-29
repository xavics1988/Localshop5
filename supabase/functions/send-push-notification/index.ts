import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'https://esm.sh/web-push@3.6.7';

const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
const VAPID_SUBJECT     = Deno.env.get('VAPID_SUBJECT')!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Supabase Database Webhook payload: { type, table, record, ... }
    const record = body.record ?? body;
    const orderId: string = record.id;
    const total: number   = record.total;

    // Leer store_id directamente (columna añadida en migración 006)
    // Fallback: parsear items JSONB (formato anterior)
    const storeId: string | undefined =
      record.store_id ??
      record.items?.[0]?.product?.storeId ??
      record.items?.[0]?.product?.store_id;

    if (!storeId) {
      return new Response(JSON.stringify({ skipped: 'no storeId in record' }), { status: 200 });
    }

    // Buscar owner de la tienda
    const { data: store } = await supabaseAdmin
      .from('stores').select('owner_id').eq('id', storeId).single();
    if (!store?.owner_id) {
      return new Response(JSON.stringify({ skipped: 'store not found' }), { status: 200 });
    }
    const ownerId: string = store.owner_id;

    // Verificar que es colaborador
    const { data: profile } = await supabaseAdmin
      .from('profiles').select('role').eq('id', ownerId).single();
    if (profile?.role !== 'colaborador') {
      return new Response(JSON.stringify({ skipped: 'not a colaborador' }), { status: 200 });
    }

    // Obtener todas las suscripciones push del colaborador
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', ownerId);
    if (subError) throw subError;
    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no subscriptions' }), { status: 200 });
    }

    const payload = JSON.stringify({
      title: '¡Nueva venta! 🛍️',
      body:  `Has recibido un pedido por €${Number(total).toFixed(2)}`,
      icon:  '/icon-192.png',
      badge: '/icon-96.png',
      data:  { orderId, url: '/orders' },
    });

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: 86400 },
        )
      )
    );

    // Limpiar suscripciones expiradas (HTTP 410 = subscription ya no válida)
    const expiredEndpoints: string[] = [];
    results.forEach((result, idx) => {
      if (result.status === 'rejected') {
        const err = result.reason as { statusCode?: number };
        if (err?.statusCode === 410) expiredEndpoints.push(subscriptions[idx].endpoint);
      }
    });
    if (expiredEndpoints.length > 0) {
      await supabaseAdmin.from('push_subscriptions').delete().in('endpoint', expiredEndpoints);
    }

    const sent   = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return new Response(JSON.stringify({ sent, failed }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[send-push-notification]', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
