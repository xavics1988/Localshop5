
export interface Review {
  id: string;
  storeId: string;
  userName: string;
  rating: number;
  comment: string;
  date: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  storeName: string;
  storeId: string;
  imageUrl: string;
  description?: string;
  sizes?: string[];
  isFavorite?: boolean;
  images?: string[];
  category?: string;
  gender?: 'Hombre' | 'Mujer' | 'Niños';
  color?: string;
  stock?: number;
  stockPerSize?: Record<string, number>;
  barcode?: string;
  storeCount?: number;
}

export interface Store {
  id: string;
  name: string; // Nombre Comercial (Público)
  businessName?: string; // Nombre Legal/Empresa (Privado)
  category: string;
  imageUrl: string;
  address?: string;
  description?: string;
  products?: Product[];
  reviews?: Review[];
  rating?: number;
  cif?: string;
  contactEmail?: string;
  contactPhone?: string;
  iban?: string;
  ownerId?: string; // FK → profiles.id del colaborador propietario
  stripeConnectAccountId?: string;
  stripeConnectOnboarded?: boolean;
}

export interface UserProfile {
    id: string;
    name: string;
    location: string;
    email: string;
    bio: string;
    phone: string;
    avatar?: string;
    storeId?: string;
    password?: string;
    role?: 'cliente' | 'colaborador';
    referralCode?: string;
    referredBy?: string;
    referralBalance: number;
    joinedAt?: string; // profiles.created_at — usado para calcular periodo de prueba
    stripeCustomerId?: string;
}

export type SubscriptionStatus = 'trial' | 'active' | 'expired';

export interface CollaboratorSubscription {
    status: SubscriptionStatus;
    trialEndsAt: Date;
    daysRemainingInTrial: number; // negativo si ya expiró
    monthlyFee: number;           // 4.00 (fundador) o 7.00 (estándar) — IVA incluido
    monthlyFeeBase: number;       // base imponible (sin IVA)
    monthlyFeeIva: number;        // IVA 21% sobre la cuota
    isFoundingMember: boolean;    // registrado en los 6 primeros meses del lanzamiento
    stripeSubscriptionId?: string;
}

export interface OrderItem {
  product: Product;
  quantity: number;
  variant?: string;
}

export type OrderStatus = 'Nuevo' | 'En Proceso' | 'Completado' | 'Devolución Solicitada' | 'Devuelto' | 'Cancelado';

export interface OrderEvent {
  date: string;
  status: OrderStatus;
  label: string;
}

export interface Order {
  id: string;
  customerId: string;
  customerName: string;
  date: string;
  status: OrderStatus;
  items: OrderItem[];
  total: number;
  shippingFee?: number;             // €3.99 — comisión LocalShop por gestión de envío
  destinationIban?: string;         // IBAN donde se recibió el pago (LocalShop)
  stripePaymentIntentId?: string;   // ID del PaymentIntent de Stripe
  history?: OrderEvent[];
}

export interface BankAccount {
  id: string;
  userId: string;
  holder: string;
  iban: string;
  bankName: string;
  bic?: string;
  isDefault: boolean;
}

export interface PaymentCard {
  id: string;
  last4: string;
  brand: string;
  expiry: string;
  holder: string;
  stripePaymentMethodId?: string;
}

export interface PlatformAccount {
  holder: string;
  iban: string;
  bankName: string;
}

export interface Invoice {
  id: string;
  orderId: string;
  recipientType: 'customer' | 'collaborator';
  recipientId: string;
  invoiceNumber: string;
  // Datos fiscales de la tienda
  storeId?: string;
  storeName?: string;
  storeCif?: string;
  storeAddress?: string;
  // Datos del cliente
  customerName?: string;
  customerEmail?: string;
  // Importes
  subtotal: number;      // productos sin comisión
  feeBase?: number;      // base imponible comisión LocalShop
  feeIva?: number;       // IVA 21% sobre comisión
  feeTotal?: number;     // comisión total
  total: number;         // total pagado por el cliente
  // Desglose de items
  items: OrderItem[];
  // Metadatos
  issuedAt: string;
  autoCompleted: boolean;
}

export interface Payout {
  id: string;
  sellerId: string;
  storeId?: string;
  periodStart: string;
  periodEnd: string;
  grossAmount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  iban?: string;
  reference?: string;
  stripeTransferId?: string;
  processedAt?: string;
  createdAt: string;
}

export type DevolucionTipo = 'desistimiento' | 'error_tara';
export type ReturnStatus = 'pendiente' | 'acordado' | 'rechazado' | 'completado';

export interface ReturnRequest {
  id: string;
  orderId: string;
  customerId: string;
  collaboratorId: string;
  type: DevolucionTipo;
  reason: string;
  status: ReturnStatus;
  returnShippingCost: number;
  refundAmount?: number;
  collaboratorCharge?: number;
  resolvedAt?: string;
  createdAt: string;
}

export interface ReturnMessage {
  id: string;
  returnId: string;
  senderId: string;
  body?: string;
  imageUrl?: string;
  createdAt: string;
}

export interface OrderContextType {
    orders: Order[];
    invoices: Invoice[];
    payouts: Payout[];
    returnRequests: ReturnRequest[];
    addOrder: (order: Omit<Order, 'id' | 'date' | 'status' | 'customerId'>) => Promise<void>;
    initiateVendorPayout: (payoutId: string) => Promise<void>;
    requestReturn: (orderId: string) => void;
    requestReturnWithType: (orderId: string, type: DevolucionTipo, reason: string, collaboratorId: string) => Promise<void>;
    processReturn: (orderId: string) => void;
    updateOrderStatus: (orderId: string, status: OrderStatus) => void;
    refetchInvoices: () => Promise<void>;
    sendReturnMessage: (returnId: string, body?: string, imageFile?: File) => Promise<void>;
    fetchReturnMessages: (returnId: string) => Promise<ReturnMessage[]>;
    resolveReturnDispute: (returnId: string, decision: 'acordado' | 'rechazado') => Promise<void>;
    getReturnForOrder: (orderId: string) => ReturnRequest | undefined;
}
