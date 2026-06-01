// Sendcloud API helper — envíos salientes y retornos

const SENDCLOUD_API = 'https://panel.sendcloud.sc/api/v2';

function authHeader(): string {
  const pub = Deno.env.get('SENDCLOUD_PUBLIC_KEY')!;
  const sec = Deno.env.get('SENDCLOUD_SECRET_KEY')!;
  return `Basic ${btoa(`${pub}:${sec}`)}`;
}

export interface SendcloudAddress {
  name:         string;
  company_name?: string;
  street:       string;
  house_number: string;
  postal_code:  string;
  city:         string;
  country:      string; // 'ES'
  email?:       string;
  telephone?:   string;
}

export interface CreateParcelParams {
  orderNumber:    string;
  weight:         number; // kg
  sender:         SendcloudAddress;
  recipient:      SendcloudAddress;
  requestLabel:   boolean; // false = sin coste (pruebas), true = etiqueta real
  shipmentMethod?: number; // ID del método de envío de Sendcloud
}

export interface SendcloudParcel {
  id:              number;
  tracking_number: string;
  label:           { normal_printer: string[] };
  carrier:         { code: string };
  shipment:        { name: string };
  status:          { message: string };
}

export async function createParcel(params: CreateParcelParams): Promise<SendcloudParcel> {
  const senderAddressId = parseInt(Deno.env.get('SENDCLOUD_SENDER_ADDRESS_ID')!);

  const body = {
    parcel: {
      name:              params.recipient.name,
      company_name:      params.recipient.company_name ?? '',
      address:           params.recipient.street,
      house_number:      params.recipient.house_number,
      postal_code:       params.recipient.postal_code,
      city:              params.recipient.city,
      country:           params.recipient.country,
      email:             params.recipient.email ?? '',
      telephone:         params.recipient.telephone ?? '',
      order_number:      params.orderNumber,
      weight:            params.weight.toFixed(3),
      sender_address:    senderAddressId,
      request_label:     params.requestLabel,
      ...(params.shipmentMethod ? { shipment: { id: params.shipmentMethod } } : {}),
    },
  };

  const res = await fetch(`${SENDCLOUD_API}/parcels`, {
    method:  'POST',
    headers: {
      'Authorization': authHeader(),
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sendcloud createParcel error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.parcel as SendcloudParcel;
}

export interface CreateReturnParcelParams {
  orderNumber:   string;
  weight:        number;
  sender:        SendcloudAddress; // cliente (origen del retorno)
  requestLabel:  boolean;
  shipmentMethod?: number;
}

export async function createReturnParcel(params: CreateReturnParcelParams): Promise<SendcloudParcel> {
  const senderAddressId = parseInt(Deno.env.get('SENDCLOUD_SENDER_ADDRESS_ID')!);

  const body = {
    parcel: {
      name:           params.sender.name,
      address:        params.sender.street,
      house_number:   params.sender.house_number,
      postal_code:    params.sender.postal_code,
      city:           params.sender.city,
      country:        params.sender.country,
      email:          params.sender.email ?? '',
      telephone:      params.sender.telephone ?? '',
      order_number:   `RET-${params.orderNumber}`,
      weight:         params.weight.toFixed(3),
      sender_address: senderAddressId,
      is_return:      true,
      request_label:  params.requestLabel,
      ...(params.shipmentMethod ? { shipment: { id: params.shipmentMethod } } : {}),
    },
  };

  const res = await fetch(`${SENDCLOUD_API}/parcels`, {
    method:  'POST',
    headers: {
      'Authorization': authHeader(),
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Sendcloud createReturnParcel error ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.parcel as SendcloudParcel;
}

export async function getShippingMethods(): Promise<{ id: number; name: string; carrier: string; price: number }[]> {
  const res = await fetch(`${SENDCLOUD_API}/shipping_methods?to_country=ES`, {
    headers: { 'Authorization': authHeader() },
  });

  if (!res.ok) throw new Error(`Sendcloud getShippingMethods error ${res.status}`);

  const data = await res.json();
  return (data.shipping_methods ?? []).map((m: any) => ({
    id:      m.id,
    name:    m.name,
    carrier: m.carrier,
    price:   m.price,
  }));
}
