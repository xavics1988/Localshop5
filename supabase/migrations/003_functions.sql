-- ============================================================
-- RPC: increment_referral_balance
-- Update atómico del saldo de referido por código
-- ============================================================
create or replace function increment_referral_balance(p_referral_code text, p_amount numeric)
returns void language plpgsql security definer as $$
begin
  update profiles
  set referral_balance = referral_balance + p_amount
  where referral_code = p_referral_code;
end;
$$;

-- ============================================================
-- RPC: place_order
-- Inserta pedido + decrementa stock + aplica referral bonus
-- Operación atómica para evitar race conditions
-- ============================================================
create or replace function place_order(
  p_order_id text,
  p_customer_id uuid,
  p_customer_name text,
  p_items jsonb,
  p_total numeric,
  p_destination_iban text,
  p_referred_by text default null,
  p_is_first_purchase boolean default false
)
returns void language plpgsql security definer as $$
declare
  item jsonb;
  product_id text;
  qty integer;
  variant_key text;
begin
  -- Insertar pedido
  insert into orders (id, customer_id, customer_name, items, total, destination_iban, status, history)
  values (
    p_order_id,
    p_customer_id,
    p_customer_name,
    p_items,
    p_total,
    p_destination_iban,
    'Nuevo',
    jsonb_build_array(jsonb_build_object(
      'date', now()::text,
      'status', 'Nuevo',
      'label', 'Pedido Realizado'
    ))
  );

  -- Decrementar stock por cada item
  for item in select * from jsonb_array_elements(p_items) loop
    product_id := item->'product'->>'id';
    qty := (item->>'quantity')::integer;
    variant_key := item->>'variant';

    update products
    set
      stock = greatest(0, stock - qty),
      stock_per_size = case
        when variant_key is not null and variant_key != 'null' and stock_per_size ? variant_key
        then jsonb_set(
          stock_per_size,
          array[variant_key],
          to_jsonb(greatest(0, (stock_per_size->>variant_key)::integer - qty))
        )
        else stock_per_size
      end
    where id = product_id;
  end loop;

  -- Recompensa de referido: solo en primera compra
  if p_is_first_purchase and p_referred_by is not null and p_referred_by != '' then
    perform increment_referral_balance(p_referred_by, 2);
  end if;
end;
$$;

-- ============================================================
-- RPC: process_return
-- Actualiza estado del pedido + incrementa stock de vuelta
-- ============================================================
create or replace function process_return(p_order_id text)
returns void language plpgsql security definer as $$
declare
  v_order orders%rowtype;
  item jsonb;
  product_id text;
  qty integer;
  variant_key text;
begin
  select * into v_order from orders where id = p_order_id;

  if not found then
    raise exception 'Pedido no encontrado';
  end if;

  if v_order.status::text != 'Devolución Solicitada' then
    raise exception 'El pedido no está en estado Devolución Solicitada';
  end if;

  -- Actualizar estado del pedido
  update orders
  set
    status = 'Devuelto',
    history = history || jsonb_build_array(jsonb_build_object(
      'date', now()::text,
      'status', 'Devuelto',
      'label', 'Producto Recibido y Devolución Finalizada'
    ))
  where id = p_order_id;

  -- Incrementar stock por cada item devuelto
  for item in select * from jsonb_array_elements(v_order.items) loop
    product_id := item->'product'->>'id';
    qty := (item->>'quantity')::integer;
    variant_key := item->>'variant';

    update products
    set
      stock = stock + qty,
      stock_per_size = case
        when variant_key is not null and variant_key != 'null' and stock_per_size ? variant_key
        then jsonb_set(
          stock_per_size,
          array[variant_key],
          to_jsonb((stock_per_size->>variant_key)::integer + qty)
        )
        else stock_per_size
      end
    where id = product_id;
  end loop;
end;
$$;

-- ============================================================
-- IDs semilla conocidos para reset_products_to_seed
-- ============================================================
create or replace function reset_products_to_seed()
returns void language plpgsql security definer as $$
declare
  seed_ids text[] := array['1','2','3','4','5','6','chaqueta-lino','8','9','10','11','12','13','14','15','16','17','18','19','20','21'];
begin
  -- Eliminar productos no semilla
  delete from products where id != all(seed_ids);
  -- Reactivar semilla soft-deleted
  update products set is_deleted = false where id = any(seed_ids);
end;
$$;

-- ============================================================
-- Activar Realtime en la tabla orders
-- ============================================================
alter publication supabase_realtime add table orders;
