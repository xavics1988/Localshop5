
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Product, OrderItem, Order, OrderStatus, Review, Store, BankAccount, PaymentCard, SavedAddress, PlatformAccount, OrderContextType, OrderEvent, UserProfile, CollaboratorSubscription, Invoice, Payout, ReturnRequest, ReturnMessage, DevolucionTipo, MultiStoreSubOrderInput } from './types';
import { CLOTHING_CATEGORIES } from './data';
import {
  supabase,
  dbProfileToUserProfile, dbProductToProduct, dbStoreToStore,
  dbOrderToOrder, dbCartItemToOrderItem,
  productToDb, storeToDb,
  DbCartItem,
} from './src/lib/supabase';
import {
  isPushSupported,
  registerServiceWorker,
  requestNotificationPermission,
  subscribeToPush,
  unsubscribeFromPush,
  showBrowserNotification,
} from './src/lib/pushSubscription';

export { CLOTHING_CATEGORIES };

export const LOCALSHOP_PLATFORM_ACCOUNT: PlatformAccount = {
  holder:   import.meta.env.VITE_PLATFORM_HOLDER || "LOCAL SHOP GLOBAL S.L.",
  iban:     import.meta.env.VITE_PLATFORM_IBAN   || "ES00 0000 0000 0000 0000 0000",
  bankName: import.meta.env.VITE_PLATFORM_BANK   || "Banco Central Clouey"
};

// ── Cuenta propia de Clouey para comisiones (envío + suscripciones) ──────────
// ⚠️  Cuando tengas el IBAN real de empresa, añádelo en .env.local con VITE_COMPANY_IBAN
export const LOCALSHOP_COMPANY_ACCOUNT: PlatformAccount = {
  holder:   import.meta.env.VITE_COMPANY_HOLDER || "LOCAL SHOP GLOBAL S.L.",
  iban:     import.meta.env.VITE_COMPANY_IBAN   || "PENDIENTE — configura VITE_COMPANY_IBAN en .env.local",
  bankName: import.meta.env.VITE_COMPANY_BANK   || "Cuenta Empresa Clouey",
};

// ── Modelo de negocio ────────────────────────────────────────────────────────
export const IVA_RATE                  = 0.21;  // 21 % IVA España
export const CLOUEY_FEE_RATE        = 0.10;  // 10% comisión Clouey sobre el subtotal del producto
export function calcCloueyFee(subtotal: number): { fee_total: number; fee_base: number; fee_iva: number } {
  const fee_total = parseFloat((subtotal * CLOUEY_FEE_RATE).toFixed(2));
  const fee_base  = parseFloat((fee_total / (1 + IVA_RATE)).toFixed(2));
  const fee_iva   = parseFloat((fee_total - fee_base).toFixed(2));
  return { fee_total, fee_base, fee_iva };
}
export const SHIPPING_FEE              = 4.50;  // € gastos de envío cobrados al cliente si subtotal < FREE_SHIPPING_THRESHOLD
export const FREE_SHIPPING_THRESHOLD   = 70;    // € — por encima el colaborador gestiona el envío (gratis para el cliente)
export const SUBSCRIPTION_MONTHLY_FEE       = 7.99;  // € /mes tarifa estándar (IVA incluido)
export const SUBSCRIPTION_MONTHLY_FEE_BASE  = parseFloat((SUBSCRIPTION_MONTHLY_FEE / (1 + IVA_RATE)).toFixed(2)); // 6.60 base imponible
export const SUBSCRIPTION_MONTHLY_FEE_IVA   = parseFloat((SUBSCRIPTION_MONTHLY_FEE - SUBSCRIPTION_MONTHLY_FEE_BASE).toFixed(2)); // 1.39 IVA
export const FOUNDING_MEMBER_FEE             = 3.99;  // € /mes tarifa Socio Fundador de por vida (IVA incluido)
export const FOUNDING_MEMBER_FEE_BASE        = parseFloat((FOUNDING_MEMBER_FEE / (1 + IVA_RATE)).toFixed(2)); // 3.30 base imponible
export const FOUNDING_MEMBER_FEE_IVA         = parseFloat((FOUNDING_MEMBER_FEE - FOUNDING_MEMBER_FEE_BASE).toFixed(2)); // 0.69 IVA
// Fecha límite para ser Socio Fundador (0€ hasta 1/1/27, luego 3,99€/mes de por vida)
export const FOUNDING_WINDOW_END = new Date('2026-12-31T23:59:59Z');

// Fecha de lanzamiento oficial de la plataforma.
export const APP_LAUNCH_DATE = new Date(
  import.meta.env.VITE_APP_LAUNCH_DATE || '2025-04-23'
);

export function getCollaboratorSubscription(joinedAt: string): CollaboratorSubscription {
  const joinedDate  = new Date(joinedAt);

  // Es socio fundador si se registró antes del 31 dic 2026
  const isFoundingMember = joinedDate <= FOUNDING_WINDOW_END;

  // Socios fundadores: gratis hasta el 31 dic 2026. Estándar: pagan desde el registro.
  const trialEndsAt = isFoundingMember
    ? new Date(FOUNDING_WINDOW_END)
    : new Date(joinedDate);

  const now = new Date();
  const daysRemaining = Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86_400_000);
  const monthlyFee     = isFoundingMember ? FOUNDING_MEMBER_FEE      : SUBSCRIPTION_MONTHLY_FEE;
  const monthlyFeeBase = isFoundingMember ? FOUNDING_MEMBER_FEE_BASE  : SUBSCRIPTION_MONTHLY_FEE_BASE;
  const monthlyFeeIva  = isFoundingMember ? FOUNDING_MEMBER_FEE_IVA   : SUBSCRIPTION_MONTHLY_FEE_IVA;
  return {
    status:               now < trialEndsAt ? 'trial' : 'active',
    trialEndsAt,
    daysRemainingInTrial: daysRemaining,
    monthlyFee,
    monthlyFeeBase,
    monthlyFeeIva,
    isFoundingMember,
  };
}

const INITIAL_USER_PROFILE: UserProfile = {
  id: '', name: '', email: '', location: '', bio: '', phone: '',
  referralCode: '', referralBalance: 0,
  role: 'cliente'
};

// --- Interfaces de Context ---
interface UserContextType {
  user: UserProfile;
  updateUser: (data: Partial<UserProfile>) => void;
  logout: () => void;
  reloadProfile: (userId: string) => Promise<void>;
  paymentMethods: PaymentCard[];
  addPaymentMethod: (card: Omit<PaymentCard, 'id'>) => void;
  removePaymentMethod: (id: string) => void;
  savedAddresses: SavedAddress[];
  addSavedAddress: (addr: Omit<SavedAddress, 'id'>) => Promise<SavedAddress | null>;
  removeSavedAddress: (id: string) => void;
  bankAccounts: BankAccount[];
  addBankAccount: (account: Omit<BankAccount, 'id' | 'userId'>) => void;
  removeBankAccount: (id: string) => void;
  setDefaultBankAccount: (id: string) => void;
  useReferralBalance: (amount: number) => void;
  isBootstrapping: boolean;
  hasAuthSession: boolean;
}

interface StoreContextType {
  stores: Store[];
  addStore: (store: Store) => void;
  updateStore: (id: string, data: Partial<Store>) => void;
  getStoreById: (id: string) => Store | undefined;
}

interface ReviewContextType {
  addReview: (review: Omit<Review, 'id' | 'date'>) => void;
  getStoreReviews: (storeId: string) => Review[];
  getUserReviews: (userName: string) => Review[];
}

interface ProductContextType {
  products: Product[];
  addProduct: (product: Product) => boolean;
  updateProduct: (id: string, data: Partial<Product>) => boolean;
  deleteProduct: (id: string) => void;
  getProductById: (id: string) => Product | undefined;
  clearLocalProducts: () => void;
}

interface CartContextType {
  cartItems: OrderItem[];
  addToCart: (product: Product, variant: string | null, quantity?: number) => void;
  removeFromCart: (productId: string, variant?: string) => void;
  updateQuantity: (productId: string, newQuantity: number, variant?: string) => void;
  clearCart: () => void;
}

interface FavoritesContextType {
  favorites: string[];
  toggleFavorite: (productId: string) => void;
  isFavorite: (productId: string) => boolean;
}

interface FollowedStoresContextType {
  followedStoreIds: string[];
  toggleFollow: (storeId: string) => void;
  isFollowing: (storeId: string) => boolean;
}

interface NotificationSettings {
  push: boolean;
  email: boolean;
  storeUpdates: boolean;
  followerActivity: boolean;
}

interface NotificationContextType {
  settings:                 NotificationSettings;
  updateSettings:           (newSettings: Partial<NotificationSettings>) => void;
  notify:                   (title: string, message: string, icon?: string, category?: keyof NotificationSettings, link?: string) => void;
  enablePushNotifications:  () => Promise<boolean>;
  disablePushNotifications: () => Promise<void>;
  pushPermission:           NotificationPermission | 'unsupported';
}

// --- Contexts ---
const UserContext          = createContext<UserContextType | undefined>(undefined);
const StoreContext         = createContext<StoreContextType | undefined>(undefined);
const ProductContext       = createContext<ProductContextType | undefined>(undefined);
const CartContext          = createContext<CartContextType | undefined>(undefined);
const FavoritesContext     = createContext<FavoritesContextType | undefined>(undefined);
const FollowedStoresContext= createContext<FollowedStoresContextType | undefined>(undefined);
const OrderContext         = createContext<OrderContextType | undefined>(undefined);
const NotificationContext  = createContext<NotificationContextType | undefined>(undefined);
const ReviewContext        = createContext<ReviewContextType | undefined>(undefined);

// --- Hooks ---
export const useUser           = () => { const c = useContext(UserContext);           if (!c) throw new Error('useUser must be used within UserProvider');           return c; };
export const useStores         = () => { const c = useContext(StoreContext);          if (!c) throw new Error('useStores must be used within StoreProvider');         return c; };
export const useProducts       = () => { const c = useContext(ProductContext);        if (!c) throw new Error('useProducts must be used within ProductProvider');       return c; };
export const useCart           = () => { const c = useContext(CartContext);           if (!c) throw new Error('useCart must be used within CartProvider');             return c; };
export const useFavorites      = () => { const c = useContext(FavoritesContext);      if (!c) throw new Error('useFavorites must be used within FavoritesProvider');   return c; };
export const useFollowedStores = () => { const c = useContext(FollowedStoresContext); if (!c) throw new Error('useFollowedStores must be used within FollowedStoresProvider'); return c; };
export const useOrders         = () => { const c = useContext(OrderContext);          if (!c) throw new Error('useOrders must be used within OrderProvider');          return c; };
export const useNotifications  = () => { const c = useContext(NotificationContext);   if (!c) throw new Error('useNotifications must be used within NotificationProvider'); return c; };
export const useReviews        = () => { const c = useContext(ReviewContext);         if (!c) throw new Error('useReviews must be used within ReviewProvider');        return c; };

// --- Combined Provider ---
export const AppContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

  // ── Notifications (in-memory, sin cambios) ──────────────────────────────
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>({
    push: true, email: true, storeUpdates: true, followerActivity: true
  });
  const [activeNotif, setActiveNotif] = useState<{ title: string; message: string; icon?: string; link?: string } | null>(null);
  const notifTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

  const notify = useCallback((title: string, message: string, icon = 'notifications', category?: keyof NotificationSettings, link?: string) => {
    if (category && !notifSettings[category]) return;
    if (notifTimerRef.current) clearTimeout(notifTimerRef.current);
    setActiveNotif({ title, message, icon, link });
    notifTimerRef.current = setTimeout(() => setActiveNotif(null), 4000);
  }, [notifSettings]);

  // ── Web Push ─────────────────────────────────────────────────────────────
  const [pushPermission, setPushPermission] = useState<NotificationPermission | 'unsupported'>(
    isPushSupported() ? Notification.permission : 'unsupported'
  );

  // ── Bootstrap ────────────────────────────────────────────────────────────
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  // ── User ─────────────────────────────────────────────────────────────────
  const [user, setUser] = useState<UserProfile>(INITIAL_USER_PROFILE);
  const [authUserId, setAuthUserId] = useState<string | null | undefined>(undefined);

  // Listener síncrono — solo actualiza el userId, no hace fetch
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUserId(session?.user?.id ?? null);
    });
    // Sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Carga el perfil cuando cambia el userId (desacoplado del listener)
  useEffect(() => {
    if (authUserId === undefined) return; // aún no determinado
    if (!authUserId) {
      setUser(INITIAL_USER_PROFILE);
      setIsBootstrapping(false);
      return;
    }
    setIsBootstrapping(true); // volver a true mientras carga el perfil (evita redirect prematuro)
    let active = true;
    (async () => {
      const { data: profile, error: profileError } = await supabase
        .from('profiles').select('*').eq('id', authUserId).maybeSingle();
      if (!active) return;
      if (profile) {
        const mapped = dbProfileToUserProfile(profile as any);
        if (mapped.role === 'colaborador' && !mapped.storeId) {
          const { data: ownedStore } = await supabase
            .from('stores').select('id').eq('owner_id', authUserId).maybeSingle();
          if (!active) return;
          if (ownedStore) mapped.storeId = ownedStore.id;
        }
        setUser(mapped);
        // If there's a pending OAuth role the DB trigger couldn't know about,
        // redirect to the profile completion screen to apply it.
        if (localStorage.getItem('oauth_pending_role')) {
          navigate('/complete-profile');
        }
      } else if (!profileError) {
        // Profile row genuinely missing — check auth provider to decide next step.
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!active) return;
        if (authUser) {
          const provider = authUser.app_metadata?.provider;
          const isOAuth = provider === 'google' || provider === 'apple';
          if (isOAuth) {
            // OAuth user: send to profile completion screen to pick role properly
            navigate('/complete-profile');
          } else {
            // Email signup race condition: auto-create from signUp metadata
            const meta = authUser.user_metadata ?? {};
            const nameFromMeta = meta.full_name || meta.name || authUser.email?.split('@')[0] || 'Usuario';
            const roleFromMeta: 'cliente' | 'colaborador' =
              meta.role === 'colaborador' ? 'colaborador' : 'cliente';
            const cleanName = nameFromMeta.replace(/\s+/g, '').toUpperCase().substring(0, 5);
            const referralCode = `${cleanName}${Math.floor(1000 + Math.random() * 9000)}`;
            await supabase.from('profiles').upsert({
              id:               authUserId,
              email:            authUser.email ?? '',
              name:             nameFromMeta,
              location:         '',
              bio:              '',
              phone:            '',
              role:             roleFromMeta,
              store_id:         null,
              referral_code:    referralCode,
              referral_balance: 0,
            }, { onConflict: 'id' });
            if (!active) return;
            const { data: newProfile } = await supabase
              .from('profiles').select('*').eq('id', authUserId).single();
            if (!active) return;
            if (newProfile) setUser(dbProfileToUserProfile(newProfile as any));
          }
        }
      }
      setIsBootstrapping(false);
    })();
    return () => { active = false; };
  }, [authUserId]);

  // ── Web Push handlers (declarados después de user para cerrar sobre user.id/role) ──
  const enablePushNotifications = useCallback(async (): Promise<boolean> => {
    if (!isPushSupported()) return false;
    const perm = await requestNotificationPermission();
    setPushPermission(perm);
    if (perm !== 'granted') {
      notify('Permisos denegados', 'Actívalos en la configuración del navegador.', 'notifications_off');
      return false;
    }
    if (!user.id) return false;
    const ok = await subscribeToPush(user.id);
    if (ok) {
      const msg = user.role === 'colaborador'
        ? 'Recibirás alertas de nuevas ventas.'
        : 'Recibirás actualizaciones de tus pedidos.';
      notify('¡Notificaciones activadas!', msg, 'notifications_active');
    }
    return ok;
  }, [user.id, user.role, notify]);

  const disablePushNotifications = useCallback(async (): Promise<void> => {
    if (!user.id) return;
    await unsubscribeFromPush(user.id);
    notify('Notificaciones desactivadas', 'Ya no recibirás alertas push.', 'notifications_off');
  }, [user.id, notify]);

  // Auto-subscribe: solicita permiso al login (colaboradores y clientes)
  useEffect(() => {
    if (!user.id) return;
    if (!isPushSupported()) return;
    registerServiceWorker().catch(console.error);
    if (Notification.permission === 'granted') {
      subscribeToPush(user.id).catch(console.error);
    } else if (Notification.permission === 'default') {
      requestNotificationPermission().then((perm) => {
        setPushPermission(perm);
        if (perm === 'granted') subscribeToPush(user.id).catch(console.error);
      });
    }
  }, [user.id]);

  const updateUser = useCallback(async (data: Partial<UserProfile>) => {
    setUser(prev => ({ ...prev, ...data }));
    if (!user.id) return;
    const dbData: Record<string, any> = {};
    if (data.name       !== undefined) dbData.name            = data.name;
    if (data.location   !== undefined) dbData.location        = data.location;
    if (data.bio        !== undefined) dbData.bio             = data.bio;
    if (data.phone      !== undefined) dbData.phone           = data.phone;
    if (data.avatar     !== undefined) dbData.avatar          = data.avatar;
    if (data.storeId    !== undefined) dbData.store_id        = data.storeId;
    if (data.referralBalance !== undefined) dbData.referral_balance = data.referralBalance;
    if (Object.keys(dbData).length > 0) {
      await supabase.from('profiles').update(dbData).eq('id', user.id);
    }
  }, [user.id]);

  const reloadProfile = useCallback(async (userId: string) => {
    const { data: profile } = await supabase
      .from('profiles').select('*').eq('id', userId).single();
    if (profile) {
      const mapped = dbProfileToUserProfile(profile as any);
      if (mapped.role === 'colaborador' && !mapped.storeId) {
        const { data: ownedStore } = await supabase
          .from('stores').select('id').eq('owner_id', userId).maybeSingle();
        if (ownedStore) mapped.storeId = ownedStore.id;
      }
      setUser(mapped);
    }
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    notify('Sesión cerrada', 'Has cerrado sesión correctamente.', 'logout');
  }, [notify]);

  // ── Payment Methods ───────────────────────────────────────────────────────
  const [paymentMethods, setPaymentMethods] = useState<PaymentCard[]>([]);

  useEffect(() => {
    if (!user.id) { setPaymentMethods([]); return; }
    supabase.from('payment_cards').select('*').eq('user_id', user.id)
      .then(({ data }) => {
        if (data) setPaymentMethods(data.map((c: any) => ({
          id:                    c.id,
          last4:                 c.last4,
          brand:                 c.brand,
          expiry:                c.expiry,
          holder:                c.holder,
          stripePaymentMethodId: c.stripe_payment_method_id ?? undefined,
        })));
      });
  }, [user.id]);

  const addPaymentMethod = useCallback(async (card: Omit<PaymentCard, 'id'>) => {
    if (!user.id) return;
    const { data, error } = await supabase.from('payment_cards')
      .insert({
        last4:                   card.last4,
        brand:                   card.brand,
        expiry:                  card.expiry,
        holder:                  card.holder,
        stripe_payment_method_id: card.stripePaymentMethodId ?? null,
        user_id:                 user.id,
      })
      .select().single();
    if (!error && data) {
      setPaymentMethods(prev => [...prev, {
        id:                    data.id,
        last4:                 data.last4,
        brand:                 data.brand,
        expiry:                data.expiry,
        holder:                data.holder,
        stripePaymentMethodId: data.stripe_payment_method_id ?? undefined,
      }]);
    }
  }, [user.id]);

  const removePaymentMethod = useCallback(async (id: string) => {
    setPaymentMethods(prev => prev.filter(c => c.id !== id));
    await supabase.from('payment_cards').delete().eq('id', id);
  }, []);

  // ── Saved Addresses ───────────────────────────────────────────────────────
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);

  useEffect(() => {
    if (!user.id) { setSavedAddresses([]); return; }
    supabase.from('saved_addresses').select('*').eq('user_id', user.id).order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data) setSavedAddresses(data.map((a: any) => ({
          id: a.id, label: a.label, name: a.name, street: a.street,
          number: a.number, postalCode: a.postal_code, city: a.city,
          province: a.province, phone: a.phone, isDefault: a.is_default,
        })));
      });
  }, [user.id]);

  const addSavedAddress = useCallback(async (addr: Omit<SavedAddress, 'id'>): Promise<SavedAddress | null> => {
    if (!user.id) return null;
    const { data, error } = await supabase.from('saved_addresses')
      .insert({
        user_id: user.id, label: addr.label, name: addr.name, street: addr.street,
        number: addr.number, postal_code: addr.postalCode, city: addr.city,
        province: addr.province, phone: addr.phone, is_default: addr.isDefault,
      })
      .select().single();
    if (error || !data) return null;
    const saved: SavedAddress = {
      id: data.id, label: data.label, name: data.name, street: data.street,
      number: data.number, postalCode: data.postal_code, city: data.city,
      province: data.province, phone: data.phone, isDefault: data.is_default,
    };
    setSavedAddresses(prev => [...prev, saved]);
    return saved;
  }, [user.id]);

  const removeSavedAddress = useCallback(async (id: string) => {
    setSavedAddresses(prev => prev.filter(a => a.id !== id));
    await supabase.from('saved_addresses').delete().eq('id', id);
  }, []);

  // ── Bank Accounts ─────────────────────────────────────────────────────────
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);

  useEffect(() => {
    if (!user.id) { setBankAccounts([]); return; }
    supabase.from('bank_accounts').select('*').eq('user_id', user.id)
      .then(({ data }) => {
        if (data) setBankAccounts(data.map((a: any) => ({
          id: a.id, userId: a.user_id, holder: a.holder, iban: a.iban,
          bankName: a.bank_name, bic: a.bic ?? undefined, isDefault: a.is_default
        })));
      });
  }, [user.id]);

  const addBankAccount = useCallback(async (account: Omit<BankAccount, 'id' | 'userId'>) => {
    if (!user.id) return;
    const { data, error } = await supabase.from('bank_accounts')
      .insert({ user_id: user.id, holder: account.holder, iban: account.iban, bank_name: account.bankName, bic: account.bic ?? null, is_default: account.isDefault })
      .select().single();
    if (!error && data) {
      setBankAccounts(prev => [...prev, { id: data.id, userId: user.id, holder: data.holder, iban: data.iban, bankName: data.bank_name, bic: data.bic ?? undefined, isDefault: data.is_default }]);
    }
  }, [user.id]);

  const removeBankAccount = useCallback(async (id: string) => {
    setBankAccounts(prev => prev.filter(a => a.id !== id));
    await supabase.from('bank_accounts').delete().eq('id', id);
  }, []);

  const setDefaultBankAccount = useCallback(async (id: string) => {
    if (!user.id) return;
    setBankAccounts(prev => prev.map((a: BankAccount) => ({ ...a, isDefault: a.id === id })));
    await supabase.from('bank_accounts').update({ is_default: false }).eq('user_id', user.id);
    await supabase.from('bank_accounts').update({ is_default: true }).eq('id', id);
  }, [user.id]);

  const useReferralBalance = useCallback(async (amount: number) => {
    const newBalance = Math.max(0, (user.referralBalance || 0) - amount);
    setUser(prev => ({ ...prev, referralBalance: newBalance }));
    await supabase.from('profiles').update({ referral_balance: newBalance }).eq('id', user.id);
  }, [user.referralBalance, user.id]);

  // ── Stores ────────────────────────────────────────────────────────────────
  const [stores, setStores] = useState<Store[]>([]);

  useEffect(() => {
    supabase.from('stores').select('*').then(({ data }) => {
      if (data) setStores(data.map(dbStoreToStore as any));
    });
  }, []);

  const addStore = useCallback(async (store: Store) => {
    setStores(prev => prev.find(s => s.id === store.id) ? prev : [...prev, store]);
    const { error } = await supabase.from('stores').insert(storeToDb(store, user.id || undefined));
    if (error) {
      setStores(prev => prev.filter(s => s.id !== store.id));
      notify('Error', 'No se pudo crear la tienda.', 'error');
    }
  }, [user.id, notify]);

  const updateStore = useCallback(async (id: string, data: Partial<Store>) => {
    setStores(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
    const dbData: Record<string, any> = {};
    if (data.name         !== undefined) dbData.name          = data.name;
    if (data.businessName !== undefined) dbData.business_name = data.businessName;
    if (data.category     !== undefined) dbData.category      = data.category;
    if (data.imageUrl     !== undefined) dbData.image_url     = data.imageUrl;
    if (data.address      !== undefined) dbData.address       = data.address;
    if (data.description  !== undefined) dbData.description   = data.description;
    if (data.contactEmail !== undefined) dbData.contact_email = data.contactEmail;
    if (data.contactPhone !== undefined) dbData.contact_phone = data.contactPhone;
    if (data.iban         !== undefined) dbData.iban          = data.iban;
    if (data.cif          !== undefined) dbData.cif           = data.cif;
    await supabase.from('stores').update(dbData).eq('id', id);
  }, []);

  // ── Products ──────────────────────────────────────────────────────────────
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    supabase.from('products').select('*').eq('is_deleted', false).then(({ data }) => {
      if (data) setProducts(data.map(dbProductToProduct as any));
    });

    const channel = supabase
      .channel('products-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, payload => {
        if (payload.eventType === 'INSERT') {
          const p = payload.new as any;
          if (!p.is_deleted) setProducts(prev => [dbProductToProduct(p) as any, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          const p = payload.new as any;
          if (p.is_deleted) {
            setProducts(prev => prev.filter(x => x.id !== p.id));
          } else {
            setProducts(prev => prev.map(x => x.id === p.id ? dbProductToProduct(p) as any : x));
          }
        } else if (payload.eventType === 'DELETE') {
          setProducts(prev => prev.filter(x => x.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const addProduct = useCallback((p: Product): boolean => {
    setProducts(prev => [p, ...prev]);
    supabase.from('products').insert({ ...productToDb(p), is_deleted: false })
      .then(({ error }) => {
        if (error) {
          setProducts(prev => prev.filter(x => x.id !== p.id));
          notify('Sin espacio', 'No se pudo guardar el producto.', 'storage');
        }
      });
    return true;
  }, [notify]);

  const updateProduct = useCallback((id: string, data: Partial<Product>): boolean => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...data } : p));
    const dbData: Record<string, any> = {};
    if (data.name        !== undefined) dbData.name          = data.name;
    if (data.price       !== undefined) dbData.price         = data.price;
    if (data.description !== undefined) dbData.description   = data.description;
    if (data.imageUrl    !== undefined) dbData.image_url     = data.imageUrl;
    if (data.images      !== undefined) dbData.images        = data.images;
    if (data.category    !== undefined) dbData.category      = data.category;
    if (data.gender      !== undefined) dbData.gender        = data.gender;
    if (data.color       !== undefined) dbData.color         = data.color;
    if (data.stock       !== undefined) dbData.stock         = data.stock;
    if (data.stockPerSize!== undefined) dbData.stock_per_size= data.stockPerSize;
    if (data.sizes       !== undefined) dbData.sizes         = data.sizes;
    if (data.barcode     !== undefined) dbData.barcode       = data.barcode;
    supabase.from('products').update(dbData).eq('id', id)
      .then(({ error }) => {
        if (error) notify('Error', 'No se pudieron guardar los cambios.', 'error');
      });
    return true;
  }, [notify]);

  const deleteProduct = useCallback((id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    supabase.rpc('soft_delete_product', { product_id: id })
      .then(({ error }) => {
        if (error) { console.error('[deleteProduct] Supabase error:', error); notify('Error', 'No se pudo eliminar el producto.', 'error'); }
      });
    notify('Eliminado', 'Producto borrado correctamente.', 'delete');
  }, [notify]);

  const clearLocalProducts = useCallback(async () => {
    await supabase.rpc('reset_products_to_seed');
    const { data } = await supabase.from('products').select('*').eq('is_deleted', false);
    if (data) setProducts(data.map(dbProductToProduct as any));
    notify('Memoria Liberada', 'Se ha restablecido el catálogo original.', 'delete_sweep');
  }, [notify]);

  // ── Cart ──────────────────────────────────────────────────────────────────
  const [cartItems, setCartItems] = useState<OrderItem[]>([]);

  useEffect(() => {
    if (!user.id) { setCartItems([]); return; }
    supabase.from('cart_items').select('*, products(*)').eq('user_id', user.id)
      .then(({ data }) => {
        if (data) setCartItems((data as unknown as DbCartItem[]).map(dbCartItemToOrderItem));
      });
  }, [user.id]);

  const addToCart = useCallback((product: Product, variant: string | null, quantity = 1) => {
    const v = variant || undefined;
    setCartItems(prev => {
      const existing = prev.find(i => i.product.id === product.id && i.variant === v);
      if (existing) return prev.map(i => i === existing ? { ...i, quantity: i.quantity + quantity } : i);
      return [...prev, { product, quantity, variant: v }];
    });
    if (user.id) {
      supabase.from('cart_items').upsert(
        { user_id: user.id, product_id: product.id, variant: variant ?? null, quantity },
        { onConflict: 'user_id,product_id,variant' }
      );
    }
  }, [user.id]);

  const removeFromCart = useCallback((productId: string, variant?: string) => {
    setCartItems(prev => prev.filter(i => !(i.product.id === productId && i.variant === variant)));
    if (user.id) {
      supabase.from('cart_items')
        .delete()
        .eq('user_id', user.id)
        .eq('product_id', productId)
        .eq('variant', variant ?? null);
    }
  }, [user.id]);

  const updateQuantity = useCallback((productId: string, newQuantity: number, variant?: string) => {
    setCartItems(prev => prev.map(i => (i.product.id === productId && i.variant === variant) ? { ...i, quantity: newQuantity } : i));
    if (user.id) {
      supabase.from('cart_items')
        .update({ quantity: newQuantity })
        .eq('user_id', user.id)
        .eq('product_id', productId)
        .eq('variant', variant ?? null);
    }
  }, [user.id]);

  const clearCart = useCallback(() => {
    setCartItems([]);
    if (user.id) {
      supabase.from('cart_items').delete().eq('user_id', user.id);
    }
  }, [user.id]);

  // ── Favorites ─────────────────────────────────────────────────────────────
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    if (!user.id) { setFavorites([]); return; }
    supabase.from('favorites').select('product_id').eq('user_id', user.id)
      .then(({ data }) => {
        if (data) setFavorites(data.map((f: any) => f.product_id));
      });
  }, [user.id]);

  const isFavorite = useCallback((id: string) => favorites.includes(id), [favorites]);
  const toggleFavorite = useCallback((id: string) => {
    if (user.role === 'colaborador' || !user.id) return;
    const isFav = favorites.includes(id);
    setFavorites(prev => isFav ? prev.filter(i => i !== id) : [...prev, id]);
    if (isFav) {
      supabase.from('favorites').delete().eq('user_id', user.id).eq('product_id', id);
    } else {
      supabase.from('favorites').insert({ user_id: user.id, product_id: id });
    }
  }, [user.role, user.id, favorites]);

  // ── Followed Stores ───────────────────────────────────────────────────────
  const [followedIds, setFollowedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!user.id) { setFollowedIds([]); return; }
    supabase.from('followed_stores').select('store_id').eq('user_id', user.id)
      .then(({ data }) => {
        if (data) setFollowedIds(data.map((f: any) => f.store_id));
      });
  }, [user.id]);

  const isFollowing = useCallback((id: string) => followedIds.includes(id), [followedIds]);
  const toggleFollow = useCallback((id: string) => {
    if (!user.id) return;
    const following = followedIds.includes(id);
    setFollowedIds(prev => following ? prev.filter(i => i !== id) : [...prev, id]);
    if (following) {
      supabase.from('followed_stores').delete().eq('user_id', user.id).eq('store_id', id);
    } else {
      supabase.from('followed_stores').insert({ user_id: user.id, store_id: id });
    }
  }, [user.id, followedIds]);

  // ── Orders ────────────────────────────────────────────────────────────────
  const [orders, setOrders] = useState<Order[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const newOrdersNotifShown = useRef<string | null>(null);

  useEffect(() => {
    if (!user.id) { setOrders([]); return; }

    const ordersQuery = user.role === 'colaborador' && user.storeId
      ? supabase.from('orders').select('*').order('date', { ascending: false })
      : supabase.from('orders').select('*').eq('customer_id', user.id).order('date', { ascending: false });

    ordersQuery.then(({ data }) => {
      if (!data) return;
      setOrders(data.map(dbOrderToOrder as any));

      // Notificación al entrar: colaborador ve pedidos nuevos; cliente ve pedidos en proceso
      if (newOrdersNotifShown.current !== user.id) {
        newOrdersNotifShown.current = user.id;
        if (user.role === 'colaborador') {
          const pending = data.filter((o: any) => o.status === 'Nuevo');
          if (pending.length > 0) {
            const s = pending.length > 1 ? 's' : '';
            const title = `${pending.length} pedido${s} nuevo${s}`;
            const body  = `Tienes ${pending.length} pedido${s} pendiente${s} de gestionar.`;
            showBrowserNotification(title, body, '/orders');
            setTimeout(() => notify(title, body, 'shopping_bag', undefined, '/orders'), 5000);
          }
        } else if (user.role === 'cliente') {
          const inProcess = data.filter((o: any) => o.status === 'En Proceso');
          if (inProcess.length > 0) {
            const s = inProcess.length > 1 ? 's' : '';
            const title = `¡Tu${s} pedido${s} está${inProcess.length > 1 ? 'n' : ''} en camino! 🚚`;
            const body  = `${inProcess.length > 1 ? `${inProcess.length} pedidos han sido aceptados` : 'Un colaborador ha aceptado tu pedido'} y los está preparando.`;
            showBrowserNotification(title, body, '/purchase-history');
            setTimeout(() => notify(title, body, 'local_shipping', undefined, '/purchase-history'), 5000);
          }
        }
      }
    });

    // Realtime: actualizaciones de estado en tiempo real
    const channel = supabase
      .channel(`orders:${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const incoming = dbOrderToOrder(payload.new as any);
          setOrders(prev => prev.some((o: Order) => o.id === incoming.id) ? prev : [incoming, ...prev]);
          if (user.role === 'colaborador') {
            showBrowserNotification('¡Nueva venta!', 'Un cliente ha realizado un pedido.', '/orders');
            setTimeout(() => notify('¡Nueva venta!', 'Un cliente ha realizado un pedido.', 'shopping_bag', undefined, '/orders'), 5000);
          }
        } else if (payload.eventType === 'UPDATE') {
          setOrders(prev => prev.map(o =>
            o.id === payload.new.id ? dbOrderToOrder(payload.new as any) : o
          ));
          if (user.role === 'colaborador') {
            if (payload.new.status === 'Devolución Solicitada') {
              showBrowserNotification('Solicitud de devolución', 'Un cliente ha solicitado devolver un pedido.', '/orders');
              setTimeout(() => notify('Solicitud de devolución', 'Un cliente ha solicitado devolver un pedido.', 'assignment_return', undefined, '/orders'), 5000);
            }
          } else if (user.role === 'cliente') {
            if (payload.new.status === 'En Proceso') {
              showBrowserNotification('¡Tu pedido está en camino!', 'El colaborador ha preparado y enviado tu pedido.', '/purchase-history');
              setTimeout(() => notify('¡Tu pedido está en camino!', 'El colaborador ha preparado y enviado tu pedido.', 'local_shipping', undefined, '/purchase-history'), 5000);
            } else if (payload.new.status === 'Completado') {
              showBrowserNotification('Pedido entregado', 'Tu pedido ha sido marcado como entregado. ¡Esperamos que lo disfrutes!', '/purchase-history');
              setTimeout(() => notify('Pedido entregado', 'Tu pedido ha sido marcado como entregado. ¡Esperamos que lo disfrutes!', 'check_circle', undefined, '/purchase-history'), 5000);
            } else {
              showBrowserNotification('Pedido actualizado', `Estado: ${payload.new.status}`, '/purchase-history');
              setTimeout(() => notify('Pedido actualizado', `Estado: ${payload.new.status}`, 'local_shipping', undefined, '/purchase-history'), 5000);
            }
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user.id]);

  const createEvent = useCallback((status: OrderStatus, label: string): OrderEvent => ({
    date: new Date().toISOString(),
    status,
    label
  }), []);

  const addOrder = useCallback(async (orderData: Omit<Order, 'id' | 'date' | 'status' | 'customerId'>) => {
    const newOrder: Order = {
      ...orderData,
      id:                     `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      customerId:             user.id,
      date:                   new Date().toISOString(),
      status:                 'Nuevo',
      shippingFee:            orderData.shippingFee,
      destinationIban:        LOCALSHOP_PLATFORM_ACCOUNT.iban,
      stripePaymentIntentId:  orderData.stripePaymentIntentId,
      history:                [createEvent('Nuevo', 'Pedido Realizado')]
    };

    setOrders(prev => [newOrder, ...prev]);
    setCartItems([]);

    const isFirstPurchase = orders.filter(o => o.customerId === user.id).length === 0;

    const productSubtotal = newOrder.items.reduce((s, i) => s + i.product.price * i.quantity, 0);
    const { error } = await supabase.rpc('place_order', {
      p_order_id:               newOrder.id,
      p_customer_id:            user.id,
      p_customer_name:          user.name,
      p_items:                  newOrder.items,
      p_total:                  newOrder.total,
      p_destination_iban:       LOCALSHOP_PLATFORM_ACCOUNT.iban,
      p_referred_by:            user.referredBy ?? null,
      p_is_first_purchase:      isFirstPurchase,
      p_shipping_fee:           calcCloueyFee(productSubtotal).fee_total,
      p_customer_delivery_fee:  newOrder.customerDeliveryFee ?? 0,
      p_shipping_name:          newOrder.shippingAddress?.name    ?? null,
      p_shipping_street:        newOrder.shippingAddress?.street  ?? null,
      p_shipping_number:        newOrder.shippingAddress?.number  ?? null,
      p_shipping_postal_code:   newOrder.shippingAddress?.postalCode ?? null,
      p_shipping_city:          newOrder.shippingAddress?.city    ?? null,
      p_shipping_province:      newOrder.shippingAddress?.province ?? null,
      p_shipping_country:       newOrder.shippingAddress?.country ?? 'ES',
      p_shipping_phone:         newOrder.shippingAddress?.phone   ?? null,
    });

    if (error) {
      setOrders(prev => prev.filter(o => o.id !== newOrder.id));
      notify('Error', 'No se pudo procesar el pedido. Inténtalo de nuevo.', 'error');
      return;
    }

    // Guardar el stripe_payment_intent_id en la DB si viene informado
    if (newOrder.stripePaymentIntentId) {
      await supabase.from('orders')
        .update({ stripe_payment_intent_id: newOrder.stripePaymentIntentId })
        .eq('id', newOrder.id);
    }

    // Refrescar stock desde la DB
    const productIds = orderData.items.map(i => i.product.id);
    supabase.from('products').select('id,stock,stock_per_size').in('id', productIds)
      .then(({ data }) => {
        if (!data) return;
        setProducts(prev => prev.map(p => {
          const updated = data.find((d: any) => d.id === p.id);
          return updated ? { ...p, stock: updated.stock, stockPerSize: updated.stock_per_size } : p;
        }));
      });

    if (isFirstPurchase && user.referredBy) {
      notify('¡Recompensa!', 'Tu referidor ha ganado 2€ por tu primera compra', 'redeem');
    }
  }, [createEvent, user, orders, notify]);

  // Pedido multi-tienda: un pago, múltiples sub_orders (uno por tienda)
  const addMultiStoreOrder = useCallback(async (
    orderData: Omit<Order, 'id' | 'date' | 'status' | 'customerId'>,
    subOrders: MultiStoreSubOrderInput[],
  ) => {
    const newOrder: Order = {
      ...orderData,
      id:            `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      customerId:    user.id,
      date:          new Date().toISOString(),
      status:        'Nuevo',
      destinationIban: LOCALSHOP_PLATFORM_ACCOUNT.iban,
      history:       [createEvent('Nuevo', 'Pedido Multi-Tienda Realizado')],
    };

    setOrders(prev => [newOrder, ...prev]);
    setCartItems([]);

    const isFirstPurchase = orders.filter(o => o.customerId === user.id).length === 0;

    const subOrdersPayload = subOrders.map(s => ({
      store_id:        s.storeId,
      collaborator_id: s.collaboratorId,
      items:           s.items,
      subtotal:        s.subtotal,
      shipping_fee:    s.shippingFee,
    }));

    const multiStoreSubtotal = subOrders.reduce((s, so) => s + so.subtotal, 0);
    const { error } = await supabase.rpc('place_multi_store_order', {
      p_order_id:              newOrder.id,
      p_customer_id:           user.id,
      p_customer_name:         user.name,
      p_items:                 newOrder.items,
      p_total:                 newOrder.total,
      p_destination_iban:      LOCALSHOP_PLATFORM_ACCOUNT.iban,
      p_sub_orders:            subOrdersPayload,
      p_localshop_fee:         calcCloueyFee(multiStoreSubtotal).fee_total,
      p_customer_delivery_fee: newOrder.customerDeliveryFee ?? 0,
      p_referred_by:           user.referredBy ?? null,
      p_is_first_purchase:     isFirstPurchase,
    });

    if (error) {
      setOrders(prev => prev.filter(o => o.id !== newOrder.id));
      notify('Error', 'No se pudo procesar el pedido multi-tienda. Inténtalo de nuevo.', 'error');
      return;
    }

    if (newOrder.stripePaymentIntentId) {
      await supabase.from('orders')
        .update({ stripe_payment_intent_id: newOrder.stripePaymentIntentId })
        .eq('id', newOrder.id);

      // Disparar transfers a vendedores con Connect onboarded (fire-and-forget)
      supabase.functions.invoke('create-multistore-transfers', {
        body: { orderId: newOrder.id, paymentIntentId: newOrder.stripePaymentIntentId },
      }).catch(e => console.error('[addMultiStoreOrder] transfers trigger failed:', e));
    }

    const productIds = orderData.items.map(i => i.product.id);
    supabase.from('products').select('id,stock,stock_per_size').in('id', productIds)
      .then(({ data }) => {
        if (!data) return;
        setProducts(prev => prev.map(p => {
          const updated = data.find((d: any) => d.id === p.id);
          return updated ? { ...p, stock: updated.stock, stockPerSize: updated.stock_per_size } : p;
        }));
      });
  }, [createEvent, user, orders, notify]);

  const initiateVendorPayout = useCallback(async (payoutId: string) => {
    try {
      const { data: payoutData, error: payoutError } = await supabase.functions.invoke('create-payout', {
        body: { payoutId },
      });
      if (payoutError) throw new Error(payoutError.message);
      if (payoutData?.error) throw new Error(payoutData.error);
      const { transferId } = payoutData;
      setPayouts(prev => prev.map(p => p.id === payoutId ? { ...p, status: 'processing', stripeTransferId: transferId } : p));
      notify('Pago iniciado', 'La transferencia a la cuenta del colaborador está en proceso.', 'payments');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al iniciar el pago';
      notify('Error', message, 'error');
    }
  }, [notify]);

  const updateOrderStatus = useCallback(async (orderId: string, status: OrderStatus) => {
    const labels: Record<OrderStatus, string> = {
      'Nuevo': 'Pedido Recibido',
      'En Proceso': 'Pedido en Preparación',
      'Completado': 'Pedido Entregado',
      'Devolución Solicitada': 'Devolución Solicitada',
      'Devuelto': 'Devolución Finalizada',
      'Cancelado': 'Pedido Cancelado'
    };
    const event = createEvent(status, labels[status] || status);
    setOrders(prev => prev.map(o => {
      if (o.id !== orderId) return o;
      return { ...o, status, history: [...(o.history || []), event] };
    }));
    // Persiste en Supabase con el nuevo estado e historial
    const currentOrder = orders.find(o => o.id === orderId);
    const newHistory = [...(currentOrder?.history || []), event];
    await supabase.from('orders').update({ status, history: newHistory }).eq('id', orderId);
  }, [createEvent]);

  const requestReturn = useCallback(async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    if (order.status !== 'Completado') {
      notify('No disponible', 'Solo se pueden devolver pedidos en estado "Completado".', 'error');
      return;
    }

    const orderDate = new Date(order.date);
    const diffInDays = (Date.now() - orderDate.getTime()) / (1000 * 3600 * 24);
    if (diffInDays > 14) {
      notify('Plazo vencido', 'El periodo de 14 días para devoluciones ha finalizado.', 'error');
      return;
    }

    const event = createEvent('Devolución Solicitada', 'Solicitud de Devolución Enviada');
    const newHistory = [...(order.history || []), event];
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'Devolución Solicitada', history: newHistory } : o));

    await supabase.from('orders').update({
      status: 'Devolución Solicitada',
      history: newHistory
    }).eq('id', orderId);

    notify('Devolución Solicitada', 'Tu solicitud ha sido enviada a la tienda.', 'assignment_return');
  }, [orders, createEvent, notify]);

  const processReturn = useCallback(async (orderId: string) => {
    const { error } = await supabase.rpc('process_return', { p_order_id: orderId });
    if (error) {
      notify('Error', 'No se pudo procesar la devolución.', 'error');
      return;
    }
    // Re-fetch pedido y stock actualizado desde servidor
    const { data: updatedOrder } = await supabase.from('orders').select('*').eq('id', orderId).single();
    if (updatedOrder) {
      setOrders(prev => prev.map(o => o.id === orderId ? dbOrderToOrder(updatedOrder as any) : o));
    }
    // Refrescar productos afectados
    const order = orders.find(o => o.id === orderId);
    if (order) {
      const productIds = order.items.map((i: any) => i.product.id);
      supabase.from('products').select('id,stock,stock_per_size').in('id', productIds)
        .then(({ data }) => {
          if (!data) return;
          setProducts(prev => prev.map(p => {
            const updated = data.find((d: any) => d.id === p.id);
            return updated ? { ...p, stock: updated.stock, stockPerSize: updated.stock_per_size } : p;
          }));
        });
    }
    // Cerrar la disputa: marcar return_request como 'completado' y borrar mensajes del chat
    const { data: rr } = await supabase
      .from('return_requests')
      .select('id, type, stripe_refund_id')
      .eq('order_id', orderId)
      .in('status', ['acordado', 'pendiente', 'completado'])
      .maybeSingle();
    if (rr?.id) {
      const { data: storageFiles } = await supabase.storage.from('return-evidence').list(rr.id);
      if (storageFiles && storageFiles.length > 0) {
        await supabase.storage.from('return-evidence').remove(storageFiles.map(f => `${rr.id}/${f.name}`));
      }
      await supabase.from('return_messages').delete().eq('return_id', rr.id);

      if (!rr.stripe_refund_id) {
        const { error: refundErr } = await supabase.functions.invoke('process-return-refund', {
          body: { returnId: rr.id },
        });
        if (refundErr) {
          await supabase.from('return_requests').update({ status: 'completado' }).eq('id', rr.id);
          setReturnRequests((prev: ReturnRequest[]) => prev.map((r: ReturnRequest) => r.id === rr.id ? { ...r, status: 'completado' as const } : r));
          notify('Aviso', 'Devolución procesada, pero el reembolso Stripe necesita revisión manual.', 'warning');
        } else {
          setReturnRequests((prev: ReturnRequest[]) => prev.map((r: ReturnRequest) => r.id === rr.id ? { ...r, status: 'completado' as const } : r));
          notify('Reembolso emitido', 'El cliente recibirá el importe en su tarjeta.', 'payments');
        }
      } else {
        await supabase.from('return_requests').update({ status: 'completado' }).eq('id', rr.id);
        setReturnRequests((prev: ReturnRequest[]) => prev.map((r: ReturnRequest) => r.id === rr.id ? { ...r, status: 'completado' as const } : r));
      }
    }
  }, [orders, notify]);

  // ── Return Requests ───────────────────────────────────────────────────────
  const [returnRequests, setReturnRequests] = useState<ReturnRequest[]>([]);

  const dbReturnToReturnRequest = (r: any): ReturnRequest => ({
    id:                 r.id,
    orderId:            r.order_id,
    subOrderId:         r.sub_order_id ?? undefined,
    customerId:         r.customer_id,
    collaboratorId:     r.collaborator_id,
    type:               r.type,
    reason:             r.reason,
    status:             r.status,
    returnShippingCost: r.return_shipping_cost,
    refundAmount:       r.refund_amount,
    collaboratorCharge: r.collaborator_charge,
    stripeRefundId:        r.stripe_refund_id ?? undefined,
    resolvedAt:            r.resolved_at,
    createdAt:             r.created_at,
    returnLabelUrl:        r.return_label_url ?? undefined,
    returnTrackingNumber:  r.return_tracking_number ?? undefined,
    returnCarrier:         r.return_carrier ?? undefined,
  });

  useEffect(() => {
    if (!user.id) { setReturnRequests([]); return; }
    const col = user.role === 'colaborador' ? 'collaborator_id' : 'customer_id';
    supabase.from('return_requests').select('*').eq(col, user.id).order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setReturnRequests(data.map(dbReturnToReturnRequest));
      });

    const ch = supabase.channel(`return_requests:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'return_requests', filter: `${col}=eq.${user.id}` }, (payload) => {
        setReturnRequests(prev => [dbReturnToReturnRequest(payload.new), ...prev]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'return_requests', filter: `${col}=eq.${user.id}` }, (payload) => {
        setReturnRequests(prev => prev.map(r => r.id === payload.new.id ? dbReturnToReturnRequest(payload.new) : r));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user.id, user.role]);

  const getReturnForOrder = useCallback((orderId: string) =>
    returnRequests.find(r => r.orderId === orderId),
  [returnRequests]);

  const requestReturnWithType = useCallback(async (orderId: string, type: DevolucionTipo, reason: string, collaboratorId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    if (order.status !== 'Completado') {
      notify('No disponible', 'Solo se pueden devolver pedidos en estado "Completado".', 'error');
      return;
    }
    const diffInDays = (Date.now() - new Date(order.date).getTime()) / (1000 * 3600 * 24);
    if (diffInDays > 14) {
      notify('Plazo vencido', 'El periodo de 14 días para devoluciones ha finalizado.', 'error');
      return;
    }

    const isDesistimiento = type === 'desistimiento';

    // Desistimiento: reembolso = precio del producto únicamente.
    // El cliente paga el envío de retorno directamente en la empresa de transporte (fuera de la app).
    // El reembolso se emite cuando el colaborador confirma que recibió el artículo.
    const desistimientoRefund = Math.max(
      order.total - (order.customerDeliveryFee ?? 0),
      0,
    );

    const { data: rr, error } = await supabase.from('return_requests').insert({
      order_id:             orderId,
      customer_id:          user.id,
      collaborator_id:      collaboratorId,
      type,
      reason,
      return_shipping_cost: 0,
      status:               isDesistimiento ? 'acordado' : 'pendiente',
      refund_amount:        isDesistimiento ? desistimientoRefund : null,
      collaborator_charge:  isDesistimiento ? 0 : null,
      resolved_at:          isDesistimiento ? new Date().toISOString() : null,
    }).select().single();

    if (error || !rr) {
      notify('Error', 'No se pudo crear la solicitud de devolución.', 'error');
      return;
    }

    if (isDesistimiento) {
      const event = createEvent('Devolución Solicitada', 'Devolución por Desistimiento – Envío de vuelta a cargo del cliente');
      const newHistory = [...(order.history || []), event];
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'Devolución Solicitada', history: newHistory } : o));
      await supabase.from('orders').update({ status: 'Devolución Solicitada', history: newHistory }).eq('id', orderId);
      notify('Devolución iniciada', `Recibirás €${desistimientoRefund.toFixed(2)} cuando el colaborador confirme la recepción del artículo. Lleva el paquete a tu empresa de transporte para enviarlo de vuelta.`, 'assignment_return');
    } else {
      notify('Chat abierto', 'Hemos abierto un chat con el colaborador para resolver la incidencia.', 'chat');
    }
  }, [orders, user.id, createEvent, notify]);

  const sendReturnMessage = useCallback(async (returnId: string, body?: string, imageFile?: File) => {
    let imageUrl: string | undefined;
    if (imageFile) {
      const ext = imageFile.name.split('.').pop();
      const path = `${returnId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('return-evidence').upload(path, imageFile);
      if (upErr) { notify('Error', 'No se pudo subir la imagen.', 'error'); return; }
      const { data: signedData } = await supabase.storage.from('return-evidence').createSignedUrl(path, 60 * 60 * 24 * 3650);
      imageUrl = signedData?.signedUrl;
    }
    await supabase.from('return_messages').insert({
      return_id:  returnId,
      sender_id:  user.id,
      body:       body || null,
      image_url:  imageUrl || null,
    });
  }, [user.id, notify]);

  const fetchReturnMessages = useCallback(async (returnId: string): Promise<ReturnMessage[]> => {
    const { data } = await supabase.from('return_messages').select('*').eq('return_id', returnId).order('created_at', { ascending: true });
    if (!data) return [];
    return data.map((m: any) => ({
      id:        m.id,
      returnId:  m.return_id,
      senderId:  m.sender_id,
      body:      m.body,
      imageUrl:  m.image_url,
      createdAt: m.created_at,
    }));
  }, []);

  const resolveReturnDispute = useCallback(async (returnId: string, decision: 'acordado' | 'rechazado') => {
    // Obtener el orderId antes de resolver (necesario para el reembolso Stripe)
    const rr = returnRequests.find(r => r.id === returnId);

    const { error } = await supabase.rpc('resolve_return', { p_return_id: returnId, p_decision: decision });
    if (error) {
      notify('Error', 'No se pudo resolver la disputa.', 'error');
      return;
    }

    if (decision === 'acordado') {
      if (rr?.type === 'desistimiento') {
        notify('Devolución aceptada', 'El cliente debe enviarte el artículo por su cuenta. Cuando lo recibas, confirma la recepción para emitir el reembolso.', 'local_shipping');
        setReturnRequests(prev => prev.map(r => r.id === returnId ? { ...r, status: 'esperando_recepcion' as any } : r));
        return;
      }
      if (rr?.type === 'error_tara' && rr.id) {
        // Etiqueta prepagada enviada al cliente ahora; reembolso cuando el colaborador confirme recepción
        notify('Acuerdo alcanzado', 'Enviando etiqueta prepagada al cliente por email...', 'handshake');
        supabase.functions.invoke('generate-return-label', { body: { returnId: rr.id } })
          .then(({ error: labelErr }) => {
            if (labelErr) {
              notify('Aviso', 'Devolución aceptada, pero la etiqueta necesita generarse manualmente.', 'warning');
            } else {
              notify('Etiqueta enviada', 'El cliente recibirá la etiqueta por email. Confirma la recepción cuando llegue el artículo para emitir el reembolso.', 'local_shipping');
            }
          })
          .catch(e => console.error('[generate-return-label]', e));
        setReturnRequests(prev => prev.map(r => r.id === returnId ? { ...r, status: 'esperando_recepcion' as any } : r));
      }
    } else {
      notify('Disputa cerrada', 'Has rechazado la reclamación. Clouey intervendrá como mediador.', 'cancel');
      // Notificar al admin para iniciar mediación
      supabase.functions.invoke('notify-mediation', { body: { returnId } })
        .catch(e => console.error('[notify-mediation]', e));
    }
  }, [notify, returnRequests]);

  const confirmReturnReceived = useCallback(async (returnId: string) => {
    const rr = returnRequests.find(r => r.id === returnId);
    const { error } = await supabase.rpc('confirm_return_received', { p_return_id: returnId });
    if (error) {
      notify('Error', 'No se pudo confirmar la recepción.', 'error');
      return;
    }
    setReturnRequests(prev => prev.map(r => r.id === returnId ? { ...r, status: 'acordado' as any } : r));
    notify('Recepción confirmada', 'Emitiendo reembolso al cliente...', 'handshake');
    if (rr?.id && !rr.stripeRefundId) {
      const { error: refundErr } = await supabase.functions.invoke('process-return-refund', { body: { returnId } });
      if (refundErr) {
        notify('Aviso', 'Recepción confirmada pero el reembolso Stripe necesita revisión manual.', 'warning');
      } else {
        notify('Reembolso emitido', 'El cliente recibirá el importe en su tarjeta.', 'payments');
      }
    }
  }, [notify, returnRequests]);

  // Cargar facturas del usuario actual
  useEffect(() => {
    if (!user.id) { setInvoices([]); return; }
    supabase.from('invoices').select('*').eq('recipient_id', user.id).order('issued_at', { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        setInvoices(data.map((r: any) => ({
          id:            r.id,
          orderId:       r.order_id,
          recipientType: r.recipient_type,
          recipientId:   r.recipient_id,
          invoiceNumber: r.invoice_number,
          storeId:       r.store_id,
          storeName:     r.store_name,
          storeCif:      r.store_cif,
          storeAddress:  r.store_address,
          customerName:  r.customer_name,
          customerEmail: r.customer_email,
          subtotal:      r.subtotal,
          feeBase:       r.fee_base,
          feeIva:        r.fee_iva,
          feeTotal:      r.fee_total,
          total:         r.total,
          items:         r.items,
          issuedAt:      r.issued_at,
          autoCompleted: r.auto_completed,
        })));
      });

    // Realtime: nueva factura generada (p.ej. auto-complete en BD)
    const ch = supabase.channel(`invoices:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'invoices', filter: `recipient_id=eq.${user.id}` }, (payload) => {
        const r = payload.new as any;
        setInvoices((prev: Invoice[]) => [{
          id: r.id, orderId: r.order_id, recipientType: r.recipient_type,
          recipientId: r.recipient_id, invoiceNumber: r.invoice_number,
          storeId: r.store_id, storeName: r.store_name, storeCif: r.store_cif,
          storeAddress: r.store_address, customerName: r.customer_name,
          customerEmail: r.customer_email, subtotal: r.subtotal,
          feeBase: r.fee_base, feeIva: r.fee_iva, feeTotal: r.fee_total,
          total: r.total, items: r.items, issuedAt: r.issued_at,
          autoCompleted: r.auto_completed,
        }, ...prev]);
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user.id]);

  // ── Payouts ───────────────────────────────────────────────────────────────
  const [payouts, setPayouts] = useState<Payout[]>([]);

  useEffect(() => {
    if (!user.id || user.role !== 'colaborador') { setPayouts([]); return; }
    supabase.from('payouts').select('*').eq('seller_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        setPayouts(data.map((r: any) => ({
          id: r.id, sellerId: r.seller_id, storeId: r.store_id,
          periodStart: r.period_start, periodEnd: r.period_end,
          grossAmount: r.gross_amount, status: r.status,
          iban: r.iban, reference: r.reference,
          processedAt: r.processed_at, createdAt: r.created_at,
        })));
      });

    const ch = supabase.channel(`payouts:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'payouts', filter: `seller_id=eq.${user.id}` }, (payload) => {
        const r = payload.new as any;
        const p: Payout = {
          id: r.id, sellerId: r.seller_id, storeId: r.store_id,
          periodStart: r.period_start, periodEnd: r.period_end,
          grossAmount: r.gross_amount, status: r.status,
          iban: r.iban, reference: r.reference,
          processedAt: r.processed_at, createdAt: r.created_at,
        };
        setPayouts(prev => [p, ...prev]);
        notify('¡Pago generado!', `Tu pago quincenal de €${r.gross_amount.toFixed(2)} está siendo procesado.`, 'payments');
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'payouts', filter: `seller_id=eq.${user.id}` }, (payload) => {
        const r = payload.new as any;
        setPayouts((prev: Payout[]) => prev.map((p: Payout) => p.id === r.id
          ? { ...p, status: r.status, reference: r.reference, processedAt: r.processed_at }
          : p
        ));
        if (r.status === 'completed') {
          notify('¡Pago transferido!', `€${r.gross_amount.toFixed(2)} enviados a tu cuenta. Disponible en 1-2 días hábiles.`, 'payments');
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user.id, user.role, notify]);

  // ── Reviews ───────────────────────────────────────────────────────────────
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    supabase.from('reviews').select('*').then(({ data }) => {
      if (data) setReviews(data.map((r: any) => ({
        id: r.id, storeId: r.store_id, userName: r.user_name,
        rating: r.rating, comment: r.comment, date: r.date
      })));
    });
  }, []);

  const addReview = useCallback(async (reviewData: Omit<Review, 'id' | 'date'>) => {
    const newReview: Review = {
      ...reviewData,
      id:   `REV-${Math.random().toString(36).substr(2, 9)}`,
      date: new Date().toISOString().split('T')[0]
    };
    setReviews(prev => [newReview, ...prev]);
    await supabase.from('reviews').insert({
      id:        newReview.id,
      store_id:  newReview.storeId,
      user_name: newReview.userName,
      rating:    newReview.rating,
      comment:   newReview.comment,
      date:      newReview.date,
      author_id: user.id || null
    });
  }, [user.id]);

  const getStoreReviews = useCallback((storeId: string) => reviews.filter(r => r.storeId === storeId), [reviews]);
  const getUserReviews  = useCallback((userName: string)  => reviews.filter(r => r.userName === userName), [reviews]);

  // ── Memoized context values ───────────────────────────────────────────────
  const userValue          = useMemo(() => ({ user, updateUser, logout, reloadProfile, paymentMethods, addPaymentMethod, removePaymentMethod, savedAddresses, addSavedAddress, removeSavedAddress, bankAccounts, addBankAccount, removeBankAccount, setDefaultBankAccount, useReferralBalance, isBootstrapping, hasAuthSession: authUserId !== null && authUserId !== undefined }), [user, updateUser, logout, reloadProfile, paymentMethods, addPaymentMethod, removePaymentMethod, savedAddresses, addSavedAddress, removeSavedAddress, bankAccounts, addBankAccount, removeBankAccount, setDefaultBankAccount, useReferralBalance, isBootstrapping, authUserId]);
  const storeValue         = useMemo(() => ({ stores, addStore, updateStore, getStoreById: (id: string) => stores.find(s => s.id === id) }), [stores, addStore, updateStore]);
  const productValue       = useMemo(() => ({ products, addProduct, updateProduct, deleteProduct, getProductById: (id: string) => products.find(p => p.id === id), clearLocalProducts }), [products, addProduct, updateProduct, deleteProduct, clearLocalProducts]);
  const cartValue          = useMemo(() => ({ cartItems, addToCart, clearCart, removeFromCart, updateQuantity }), [cartItems, addToCart, clearCart, removeFromCart, updateQuantity]);
  const favoritesValue     = useMemo(() => ({ favorites, toggleFavorite, isFavorite }), [favorites, toggleFavorite, isFavorite]);
  const followedStoresValue= useMemo(() => ({ followedStoreIds: followedIds, toggleFollow, isFollowing }), [followedIds, toggleFollow, isFollowing]);
  const refetchInvoices = useCallback(async () => {
    if (!user.id) return;
    const { data } = await supabase.from('invoices').select('*').eq('recipient_id', user.id).order('issued_at', { ascending: false });
    if (!data) return;
    setInvoices(data.map((r: any) => ({
      id: r.id, orderId: r.order_id, recipientType: r.recipient_type,
      recipientId: r.recipient_id, invoiceNumber: r.invoice_number,
      storeId: r.store_id, storeName: r.store_name, storeCif: r.store_cif,
      storeAddress: r.store_address, customerName: r.customer_name,
      customerEmail: r.customer_email, subtotal: r.subtotal,
      feeBase: r.fee_base, feeIva: r.fee_iva, feeTotal: r.fee_total,
      total: r.total, items: r.items, issuedAt: r.issued_at,
      autoCompleted: r.auto_completed,
    })));
  }, [user.id]);

  const orderValue         = useMemo(() => ({ orders, invoices, payouts, returnRequests, addOrder, addMultiStoreOrder, initiateVendorPayout, requestReturn, requestReturnWithType, processReturn, updateOrderStatus, refetchInvoices, sendReturnMessage, fetchReturnMessages, resolveReturnDispute, confirmReturnReceived, getReturnForOrder }), [orders, invoices, payouts, returnRequests, addOrder, addMultiStoreOrder, initiateVendorPayout, requestReturn, requestReturnWithType, processReturn, updateOrderStatus, refetchInvoices, sendReturnMessage, fetchReturnMessages, resolveReturnDispute, confirmReturnReceived, getReturnForOrder]);
  const reviewValue        = useMemo(() => ({ addReview, getStoreReviews, getUserReviews }), [addReview, getStoreReviews, getUserReviews]);
  const notificationValue  = useMemo(() => ({
    settings:                 notifSettings,
    updateSettings:           (s: Partial<NotificationSettings>) => setNotifSettings(prev => ({ ...prev, ...s })),
    notify,
    enablePushNotifications,
    disablePushNotifications,
    pushPermission,
  }), [notifSettings, notify, enablePushNotifications, disablePushNotifications, pushPermission]);

  if (isBootstrapping) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background-light dark:bg-background-dark">
        <span className="material-symbols-outlined animate-spin text-primary text-5xl">progress_activity</span>
      </div>
    );
  }

  return (
    <UserContext.Provider value={userValue}>
      <StoreContext.Provider value={storeValue}>
        <ProductContext.Provider value={productValue}>
          <CartContext.Provider value={cartValue}>
            <FavoritesContext.Provider value={favoritesValue}>
              <FollowedStoresContext.Provider value={followedStoresValue}>
                <OrderContext.Provider value={orderValue}>
                  <ReviewContext.Provider value={reviewValue}>
                    <NotificationContext.Provider value={notificationValue}>
                      {children}
                      {activeNotif && (
                        <div
                          className={`fixed top-4 left-4 right-4 z-[3000] animate-slide-up bg-white dark:bg-accent-dark border-l-4 border-primary p-4 rounded-xl shadow-2xl flex items-start gap-4 ring-1 ring-black/5 ${activeNotif.link ? 'cursor-pointer hover:brightness-95 active:scale-[0.99] transition-all' : ''}`}
                          onClick={() => {
                            if (activeNotif.link) {
                              setActiveNotif(null);
                              navigate(activeNotif.link);
                            }
                          }}
                        >
                          <span className="material-symbols-outlined text-primary">{activeNotif.icon}</span>
                          <div className="flex-1">
                            <p className="text-sm font-bold">{activeNotif.title}</p>
                            <p className="text-xs text-text-subtle-light">{activeNotif.message}</p>
                          </div>
                          {activeNotif.link && (
                            <span className="material-symbols-outlined text-text-subtle-light text-base self-center">chevron_right</span>
                          )}
                        </div>
                      )}
                    </NotificationContext.Provider>
                  </ReviewContext.Provider>
                </OrderContext.Provider>
              </FollowedStoresContext.Provider>
            </FavoritesContext.Provider>
          </CartContext.Provider>
        </ProductContext.Provider>
      </StoreContext.Provider>
    </UserContext.Provider>
  );
};
