import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
});

const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

serve(async (req: Request) => {
  const body      = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return new Response(JSON.stringify({ error: 'Missing stripe-signature header' }), { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid webhook signature' }), { status: 400 });
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi      = event.data.object as Stripe.PaymentIntent;
        const orderId = pi.metadata?.orderId;
        if (!orderId) break;

        await supabaseAdmin
          .from('orders')
          .update({ stripe_payment_intent_id: pi.id })
          .eq('id', orderId);

        // Auto-transfers para pedidos multi-tienda
        const { data: subOrders } = await supabaseAdmin
          .from('sub_orders')
          .select('id, store_id, collaborator_id, subtotal')
          .eq('parent_order_id', orderId)
          .is('stripe_transfer_id', null); // idempotencia

        if (subOrders && subOrders.length > 0) {
          const chargeId = typeof pi.latest_charge === 'string'
            ? pi.latest_charge
            : (pi.latest_charge as Stripe.Charge | null)?.id;

          for (const sub of subOrders) {
            const { data: store } = await supabaseAdmin
              .from('stores')
              .select('stripe_connect_account_id, stripe_connect_onboarded')
              .eq('id', sub.store_id)
              .single();

            if (!store?.stripe_connect_onboarded || !store?.stripe_connect_account_id) {
              console.log(`[stripe-webhook] sub_order ${sub.id}: tienda sin Connect, pendiente de payout quincenal`);
              continue;
            }

            try {
              const transfer = await stripe.transfers.create({
                amount:      Math.round(sub.subtotal * 100),
                currency:    'eur',
                destination: store.stripe_connect_account_id,
                ...(chargeId ? { source_transaction: chargeId } : {}),
                metadata: {
                  subOrderId: sub.id,
                  orderId,
                  storeId:   sub.store_id,
                  sellerId:  sub.collaborator_id ?? '',
                },
              });

              await supabaseAdmin
                .from('sub_orders')
                .update({ stripe_transfer_id: transfer.id })
                .eq('id', sub.id);
            } catch (transferErr) {
              console.error(`[stripe-webhook] Transfer fallido sub_order ${sub.id}:`, transferErr);
              // Continuar con los demás sub_orders aunque uno falle
            }
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub    = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (userId) {
          const status = sub.status === 'active' ? 'active'
            : sub.status === 'canceled' ? 'expired'
            : 'trial';
          await supabaseAdmin
            .from('collaborator_subscriptions')
            .upsert({ user_id: userId, status, stripe_subscription_id: sub.id }, { onConflict: 'user_id' });
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub    = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (userId) {
          await supabaseAdmin
            .from('collaborator_subscriptions')
            .upsert({ user_id: userId, status: 'expired' }, { onConflict: 'user_id' });
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          const sub    = await stripe.subscriptions.retrieve(invoice.subscription as string);
          const userId = sub.metadata?.userId;
          if (userId) {
            const nextBilling = new Date(sub.current_period_end * 1000).toISOString();
            await supabaseAdmin
              .from('collaborator_subscriptions')
              .upsert({
                user_id:           userId,
                status:            'active',
                stripe_subscription_id: sub.id,
                last_payment_at:   new Date().toISOString(),
                next_billing_date: nextBilling,
              }, { onConflict: 'user_id' });
          }
        }
        break;
      }

      case 'account.updated': {
        const account = event.data.object as Stripe.Account;
        if (account.charges_enabled && account.payouts_enabled) {
          await supabaseAdmin
            .from('stores')
            .update({ stripe_connect_onboarded: true })
            .eq('stripe_connect_account_id', account.id);
        }
        break;
      }

      case 'transfer.created': {
        const transfer = event.data.object as Stripe.Transfer;
        const payoutId = transfer.metadata?.payoutId;
        if (payoutId) {
          await supabaseAdmin
            .from('payouts')
            .update({ stripe_transfer_id: transfer.id, status: 'processing' })
            .eq('id', payoutId);
        }
        break;
      }

      default:
        console.log(`[stripe-webhook] Evento no manejado: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[stripe-webhook]', message);
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
});
