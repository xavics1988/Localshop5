
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
  customerName: string;
  date: string;
  status: OrderStatus;
  items: OrderItem[];
  total: number;
  destinationIban?: string; // IBAN donde se recibió el pago (LocalShop)
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
}

export interface PlatformAccount {
  holder: string;
  iban: string;
  bankName: string;
}

export interface OrderContextType {
    orders: Order[];
    addOrder: (order: Omit<Order, 'id' | 'date' | 'status'>) => void;
    requestReturn: (orderId: string) => void;
    processReturn: (orderId: string) => void;
    updateOrderStatus: (orderId: string, status: OrderStatus) => void;
}
