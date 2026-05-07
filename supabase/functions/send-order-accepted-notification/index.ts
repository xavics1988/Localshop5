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

    // Supabase Database Webhook payload on orders UPDATE
    const record = body.record ?? body;

    // Solo actuar cuando el estado cambia a 'En Proceso'
    if (record.status !== 'En Proceso') {
      return new Response(JSON.stringify({ skipped: 'status is not En Proceso' }), { status: 200 });
    }

    const customerId: string | undefined = record.customer_id;
    const orderId: string = record.id;
    const total: number = record.total;

    if (!customerId) {
      return new Response(JSON.stringify({ skipped: 'no customer_id in record' }), { status: 200 });
    }

    // Obtener las suscripciones push del cliente
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', customerId);

    if (subError) throw subError;
    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no subscriptions for customer' }), { status: 200 });
    }

    const payload = JSON.stringify({
      title: '¡Tu pedido está en camino! 🚚',
      body:  `El colaborador ha aceptado tu pedido de €${Number(total).toFixed(2)} y lo está preparando.`,
      icon:  '/icon-192.png',
      badge: '/icon-96.png',
      data:  { orderId, url: '/purchase-history' },
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

    // Limpiar suscripciones expiradas
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
    console.error('[send-order-accepted-notification]', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
