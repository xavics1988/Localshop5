import { createClient } from '@supabase/supabase-js';
import { Product, Store, Order, Review, UserProfile, BankAccount, PaymentCard, OrderItem } from '../../types';

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  as string;
const supabaseAnon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnon) {
  throw new Error('[Supabase] VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY deben estar en .env.local');
}

export const supabase = createClient(supabaseUrl, supabaseAnon, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// ---- Tipos de filas de la base de datos ----

export type DbProfile = {
  id: string;
  name: string;
  location: string;
  email: string;
  bio: string;
  phone: string;
  avatar: string | null;
  store_id: string | null;
  role: 'cliente' | 'colaborador';
  referral_code: string | null;
  referred_by: string | null;
  referral_balance: number;
  created_at: string;
};

export type DbProduct = {
  id: string;
  name: string;
  price: number;
  store_name: string;
  store_id: string;
  image_url: string;
  description: string | null;
  sizes: string[] | null;
  images: string[] | null;
  category: string | null;
  gender: 'Hombre' | 'Mujer' | 'Niños' | null;
  color: string | null;
  stock: number;
  stock_per_size: Record<string, number> | null;
  barcode: string | null;
  is_deleted: boolean;
};

export type DbStore = {
  id: string;
  name: string;
  business_name: string | null;
  category: string;
  image_url: string;
  address: string | null;
  description: string | null;
  rating: number | null;
  cif: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  iban: string | null;
  owner_id: string | null;
};

export type DbOrder = {
  id: string;
  customer_id: string;
  customer_name: string;
  date: string;
  status: string;
  items: any[];
  total: number;
  destination_iban: string | null;
  history: any[];
};

export type DbCartItem = {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  variant: string | null;
  products: DbProduct;
};

// ---- Mappers DB → TypeScript ----

export function dbProfileToUserProfile(p: DbProfile): UserProfile {
  return {
    id:              p.id,
    name:            p.name,
    location:        p.location,
    email:           p.email,
    bio:             p.bio,
    phone:           p.phone,
    avatar:          p.avatar ?? undefined,
    storeId:         p.store_id ?? undefined,
    role:            p.role,
    referralCode:    p.referral_code ?? undefined,
    referredBy:      p.referred_by ?? undefined,
    referralBalance: Number(p.referral_balance) || 0,
    joinedAt:        p.created_at,
  };
}

export function dbProductToProduct(p: DbProduct): Product {
  return {
    id:           p.id,
    name:         p.name,
    price:        Number(p.price),
    storeName:    p.store_name,
    storeId:      p.store_id,
    imageUrl:     p.image_url,
    description:  p.description ?? undefined,
    sizes:        p.sizes ?? undefined,
    images:       p.images ?? undefined,
    category:     p.category ?? undefined,
    gender:       p.gender ?? undefined,
    color:        p.color ?? undefined,
    stock:        p.stock,
    stockPerSize: p.stock_per_size ?? undefined,
    barcode:      p.barcode ?? undefined,
  };
}

export function dbStoreToStore(s: DbStore): Store {
  return {
    id:           s.id,
    name:         s.name,
    businessName: s.business_name ?? undefined,
    category:     s.category,
    imageUrl:     s.image_url,
    address:      s.address ?? undefined,
    description:  s.description ?? undefined,
    rating:       s.rating ?? undefined,
    cif:          s.cif ?? undefined,
    contactEmail: s.contact_email ?? undefined,
    contactPhone: s.contact_phone ?? undefined,
    iban:         s.iban ?? undefined,
  };
}

export function dbOrderToOrder(o: DbOrder): Order {
  return {
    id:              o.id,
    customerId:      o.customer_id,
    customerName:    o.customer_name,
    date:            o.date,
    status:          o.status as Order['status'],
    items:           o.items || [],
    total:           Number(o.total),
    destinationIban: o.destination_iban ?? undefined,
    history:         o.history || [],
  };
}

export function dbCartItemToOrderItem(c: DbCartItem): OrderItem {
  return {
    product:  dbProductToProduct(c.products),
    quantity: c.quantity,
    variant:  c.variant ?? undefined,
  };
}

export function productToDb(p: Product): Omit<DbProduct, 'is_deleted'> {
  return {
    id:            p.id,
    name:          p.name,
    price:         p.price,
    store_name:    p.storeName,
    store_id:      p.storeId,
    image_url:     p.imageUrl,
    description:   p.description ?? null,
    sizes:         p.sizes ?? null,
    images:        p.images ?? null,
    category:      p.category ?? null,
    gender:        p.gender ?? null,
    color:         p.color ?? null,
    stock:         p.stock ?? 0,
    stock_per_size: p.stockPerSize ?? null,
    barcode:       p.barcode ?? null,
  };
}

export function storeToDb(s: Store, ownerId?: string): DbStore & { owner_id?: string } {
  return {
    id:            s.id,
    name:          s.name,
    business_name: s.businessName ?? null,
    category:      s.category,
    image_url:     s.imageUrl,
    address:       s.address ?? null,
    description:   s.description ?? null,
    rating:        s.rating ?? null,
    cif:           s.cif ?? null,
    contact_email: s.contactEmail ?? null,
    contact_phone: s.contactPhone ?? null,
    iban:          s.iban ?? null,
    owner_id:      ownerId ?? null,
  };
}

// ---- Helper: subir imagen de producto a Supabase Storage ----

export async function uploadProductImage(file: File, storeId: string): Promise<string> {
  const ext  = file.name.split('.').pop();
  const path = `${storeId}/${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from('product-images')
    .upload(path, file, { upsert: true });

  if (error) throw error;

  const { data } = supabase.storage.from('product-images').getPublicUrl(path);
  return data.publicUrl;
}
