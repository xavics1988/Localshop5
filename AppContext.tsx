
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Product, OrderItem, Order, OrderStatus, Review, Store, BankAccount, PaymentCard, PlatformAccount, OrderContextType, OrderEvent, UserProfile } from './types';
import { products as initialProducts, orders as initialOrders, stores as initialStores } from './data';

/** 
 * CONFIGURACIÓN CENTRAL DE PAGOS LOCALSHOP
 * Aquí se define la cuenta bancaria propia de la empresa donde se recibirán los pagos de los clientes.
 */
export const LOCALSHOP_PLATFORM_ACCOUNT: PlatformAccount = {
    holder: "LOCAL SHOP GLOBAL S.L.",
    iban: "ES00 0000 0000 0000 0000 0000", // Preparado para insertar cuenta real
    bankName: "Banco Central LocalShop"
};

// --- Interfaces ---
interface UserContextType {
    user: UserProfile;
    updateUser: (data: Partial<UserProfile>) => void;
    paymentMethods: PaymentCard[];
    addPaymentMethod: (card: Omit<PaymentCard, 'id'>) => void;
    removePaymentMethod: (id: string) => void;
    bankAccounts: BankAccount[];
    addBankAccount: (account: Omit<BankAccount, 'id' | 'userId'>) => void;
    removeBankAccount: (id: string) => void;
    useReferralBalance: (amount: number) => void;
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
    settings: NotificationSettings;
    updateSettings: (newSettings: Partial<NotificationSettings>) => void;
    notify: (title: string, message: string, icon?: string, category?: keyof NotificationSettings) => void;
}

// --- Contexts ---
const UserContext = createContext<UserContextType | undefined>(undefined);
const StoreContext = createContext<StoreContextType | undefined>(undefined);
const ProductContext = createContext<ProductContextType | undefined>(undefined);
const CartContext = createContext<CartContextType | undefined>(undefined);
const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);
const FollowedStoresContext = createContext<FollowedStoresContextType | undefined>(undefined);
const OrderContext = createContext<OrderContextType | undefined>(undefined);
const NotificationContext = createContext<NotificationContextType | undefined>(undefined);
const ReviewContext = createContext<ReviewContextType | undefined>(undefined);

// --- Hooks ---
export const useUser = () => {
    const c = useContext(UserContext);
    if (!c) throw new Error('useUser must be used within UserProvider');
    return c;
};
export const useStores = () => {
    const c = useContext(StoreContext);
    if (!c) throw new Error('useStores must be used within StoreProvider');
    return c;
};
export const useProducts = () => {
    const c = useContext(ProductContext);
    if (!c) throw new Error('useProducts must be used within ProductProvider');
    return c;
};
export const useCart = () => {
    const c = useContext(CartContext);
    if (!c) throw new Error('useCart must be used within CartProvider');
    return c;
};
export const useFavorites = () => {
    const c = useContext(FavoritesContext);
    if (!c) throw new Error('useFavorites must be used within FavoritesProvider');
    return c;
};
export const useFollowedStores = () => {
    const c = useContext(FollowedStoresContext);
    if (!c) throw new Error('useFollowedStores must be used within FollowedStoresProvider');
    return c;
};
export const useOrders = () => {
    const c = useContext(OrderContext);
    if (!c) throw new Error('useOrders must be used within OrderProvider');
    return c;
};
export const useNotifications = () => {
    const c = useContext(NotificationContext);
    if (!c) throw new Error('useNotifications must be used within NotificationProvider');
    return c;
};
export const useReviews = () => {
    const c = useContext(ReviewContext);
    if (!c) throw new Error('useReviews must be used within ReviewProvider');
    return c;
};

// --- Combined Provider ---
export const AppContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const safeStorageSet = (key: string, value: any) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.warn(`Storage failed for ${key}`, e);
        }
    };

    const [notifSettings, setNotifSettings] = useState<NotificationSettings>({
        push: true, email: false, storeUpdates: true, followerActivity: true
    });
    const [activeNotif, setActiveNotif] = useState<{title: string; message: string; icon?: string} | null>(null);

    const notify = useCallback((title: string, message: string, icon: string = 'notifications', category?: keyof NotificationSettings) => {
        if (category && !notifSettings[category]) return;
        setActiveNotif({ title, message, icon });
        setTimeout(() => setActiveNotif(null), 4000);
    }, [notifSettings]);

    const [user, setUser] = useState<UserProfile>(() => {
        const saved = localStorage.getItem('user_profile');
        return saved ? JSON.parse(saved) : {
            id: 'USER-1',
            name: 'Elena García',
            location: 'Vigo, España',
            email: 'elena.garcia@localshop.es',
            bio: 'Amante de la moda local, los artículos con historia y el diseño sostenible en el corazón de mi barrio.',
            phone: '+34 600 000 000',
            referralCode: 'ELENA2026',
            referralBalance: 0
        };
    });

    const [stores, setStores] = useState<Store[]>(() => {
        const saved = localStorage.getItem('local_stores');
        const userStores = saved ? JSON.parse(saved) : [];
        const combined = [...initialStores];
        userStores.forEach((us: Store) => {
            if (!combined.find(s => s.id === us.id)) {
                combined.push(us);
            }
        });
        return combined;
    });

    const addStore = useCallback((store: Store) => {
        setStores(prev => {
            if (prev.find(s => s.id === store.id)) return prev;
            const newStores = [...prev, store];
            const onlyUserStores = newStores.filter(s => !initialStores.find(is => is.id === s.id));
            safeStorageSet('local_stores', onlyUserStores);
            return newStores;
        });
    }, []);

    const updateStore = useCallback((id: string, data: Partial<Store>) => {
        setStores(prev => {
            const updated = prev.map(s => s.id === id ? { ...s, ...data } : s);
            const onlyUserStores = updated.filter(s => !initialStores.find(is => is.id === s.id));
            safeStorageSet('local_stores', onlyUserStores);
            return updated;
        });
    }, []);

    const [paymentMethods, setPaymentMethods] = useState<PaymentCard[]>(() => {
        const saved = localStorage.getItem('payment_methods');
        return saved ? JSON.parse(saved) : [];
    });

    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>(() => {
        const saved = localStorage.getItem('bank_accounts');
        const allAccounts = saved ? JSON.parse(saved) : [];
        // Filtramos para que este colaborador solo vea las suyas
        return allAccounts.filter((acc: any) => acc.userId === user.id);
    });

    // Sincronizar cuentas bancarias cuando el usuario cambie (ej: Login/Logout)
    useEffect(() => {
        const saved = localStorage.getItem('bank_accounts');
        const allAccounts = saved ? JSON.parse(saved) : [];
        setBankAccounts(allAccounts.filter((acc: any) => acc.userId === user.id));
    }, [user.id]);

    useEffect(() => safeStorageSet('user_profile', user), [user]);
    useEffect(() => safeStorageSet('payment_methods', paymentMethods), [paymentMethods]);

    // Persistir cambios en cuentas bancarias a localStorage
    useEffect(() => {
        const saved = localStorage.getItem('bank_accounts');
        let allAccounts = saved ? JSON.parse(saved) : [];
        // Quitamos las versiones viejas de las cuentas de este usuario
        allAccounts = allAccounts.filter((acc: any) => acc.userId !== user.id);
        // Añadimos las actuales
        const updatedAll = [...allAccounts, ...bankAccounts];
        localStorage.setItem('bank_accounts', JSON.stringify(updatedAll));
    }, [bankAccounts, user.id]);

    const updateUser = useCallback((data: Partial<UserProfile>) => setUser(prev => ({ ...prev, ...data })), []);
    
    const addPaymentMethod = useCallback((card: Omit<PaymentCard, 'id'>) => {
        const newCard = { ...card, id: `CARD-${Math.random().toString(36).substr(2, 9)}` };
        setPaymentMethods(prev => [...prev, newCard]);
    }, []);
    
    const removePaymentMethod = useCallback((id: string) => {
        setPaymentMethods(prev => prev.filter(c => c.id !== id));
    }, []);

    const addBankAccount = useCallback((account: Omit<BankAccount, 'id' | 'userId'>) => {
        const newAccount = { 
            ...account, 
            id: `BANK-${Math.random().toString(36).substr(2, 9)}`,
            userId: user.id // Vinculamos la cuenta al usuario logueado
        };
        setBankAccounts(prev => [...prev, newAccount]);
    }, [user.id]);

    const removeBankAccount = useCallback((id: string) => {
        setBankAccounts(prev => prev.filter(a => a.id !== id));
    }, []);

    const useReferralBalance = useCallback((amount: number) => {
        const newBalance = Math.max(0, (user.referralBalance || 0) - amount);
        updateUser({ referralBalance: newBalance });
        
        // Persistir cambio en el almacenamiento global de usuarios
        const savedUsers = localStorage.getItem('app_users');
        if (savedUsers) {
            const usersList = JSON.parse(savedUsers);
            const updatedUsers = usersList.map((u: any) => {
                if (u.id === user.id) return { ...u, referralBalance: newBalance };
                return u;
            });
            localStorage.setItem('app_users', JSON.stringify(updatedUsers));
        }
    }, [user.referralBalance, user.id, updateUser]);

    const [products, setProducts] = useState<Product[]>(() => {
        const saved = localStorage.getItem('local_products');
        const localProds: Product[] = saved ? JSON.parse(saved) : [];
        const deletedIdsSaved = localStorage.getItem('deleted_product_ids');
        const deletedIds: string[] = deletedIdsSaved ? JSON.parse(deletedIdsSaved) : [];
        
        // Sincronización de productos iniciales con versiones locales y filtrado de eliminados
        const merged = initialProducts
            .filter(ip => !deletedIds.includes(ip.id))
            .map(ip => {
                const local = localProds.find(lp => lp.id === ip.id);
                return local || ip;
            });
        
        localProds.forEach(lp => {
            if (!merged.find(m => m.id === lp.id) && !deletedIds.includes(lp.id)) {
                merged.push(lp);
            }
        });
        
        return merged;
    });

    const clearLocalProducts = useCallback(() => {
        localStorage.removeItem('local_products');
        localStorage.removeItem('deleted_product_ids');
        setProducts([...initialProducts]);
        notify('Memoria Liberada', 'Se ha restablecido el catálogo original.', 'delete_sweep');
    }, [notify]);

    const addProduct = useCallback((p: Product): boolean => {
        try {
            const savedLocal = localStorage.getItem('local_products');
            const currentLocal = savedLocal ? JSON.parse(savedLocal) : [];
            const updatedLocal = [p, ...currentLocal];
            localStorage.setItem('local_products', JSON.stringify(updatedLocal));
            setProducts(prev => [p, ...prev]);
            return true;
        } catch (e) {
            notify('Sin espacio', 'Borra artículos antiguos en Ajustes para publicar nuevos.', 'storage');
            return false;
        }
    }, [notify]);

    const updateProduct = useCallback((id: string, data: Partial<Product>): boolean => {
        try {
            setProducts(prev => {
                const updated = prev.map(p => p.id === id ? { ...p, ...data } : p);
                
                const initialIds = initialProducts.map(ip => ip.id);
                const localToSave = updated.filter(p => {
                    if (!initialIds.includes(p.id)) return true;
                    const original = initialProducts.find(ip => ip.id === p.id);
                    return JSON.stringify(p) !== JSON.stringify(original);
                });
                
                localStorage.setItem('local_products', JSON.stringify(localToSave));
                return updated;
            });
            return true;
        } catch (e) {
            notify('Error', 'No se pudo actualizar el producto.', 'error');
            return false;
        }
    }, [notify]);

    const deleteProduct = useCallback((id: string) => {
        setProducts(prev => {
            const updated = prev.filter(p => p.id !== id);
            
            // Persistir eliminación de forma permanente
            const deletedIdsSaved = localStorage.getItem('deleted_product_ids');
            const deletedIds: string[] = deletedIdsSaved ? JSON.parse(deletedIdsSaved) : [];
            if (!deletedIds.includes(id)) {
                deletedIds.push(id);
                localStorage.setItem('deleted_product_ids', JSON.stringify(deletedIds));
            }

            // También limpiar de local_products si estaba allí
            const savedLocal = localStorage.getItem('local_products');
            const currentLocal = savedLocal ? JSON.parse(savedLocal) : [];
            const updatedLocal = currentLocal.filter((p: any) => p.id !== id);
            localStorage.setItem('local_products', JSON.stringify(updatedLocal));

            return updated;
        });
        notify('Eliminado', 'Producto borrado correctamente.', 'delete');
    }, [notify]);

    const [cartItems, setCartItems] = useState<OrderItem[]>(() => {
        const saved = localStorage.getItem('cart');
        return saved ? JSON.parse(saved) : [];
    });
    
    useEffect(() => safeStorageSet('cart', cartItems), [cartItems]);

    const addToCart = useCallback((product: Product, variant: string | null, quantity: number = 1) => {
        setCartItems(prev => {
            const v = variant || undefined;
            const existing = prev.find(i => i.product.id === product.id && i.variant === v);
            if (existing) return prev.map(i => i === existing ? { ...i, quantity: i.quantity + quantity } : i);
            return [...prev, { product, quantity, variant: v }];
        });
    }, []);

    const [favorites, setFavorites] = useState<string[]>(() => {
        const saved = localStorage.getItem('favorites');
        return saved ? JSON.parse(saved) : [];
    });
    useEffect(() => safeStorageSet('favorites', favorites), [favorites]);
    const isFavorite = useCallback((id: string) => favorites.includes(id), [favorites]);
    const toggleFavorite = useCallback((id: string) => {
        setFavorites(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    }, []);

    const [followedIds, setFollowedIds] = useState<string[]>(() => {
        const saved = localStorage.getItem('followedStores');
        return saved ? JSON.parse(saved) : [];
    });
    useEffect(() => safeStorageSet('followedStores', followedIds), [followedIds]);
    
    const isFollowing = useCallback((id: string) => followedIds.includes(id), [followedIds]);
    const toggleFollow = useCallback((id: string) => {
        setFollowedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    }, []);

    const [orders, setOrders] = useState<Order[]>(() => {
        const saved = localStorage.getItem('user_orders');
        return saved ? JSON.parse(saved) : initialOrders;
    });

    const createEvent = useCallback((status: OrderStatus, label: string): OrderEvent => ({
        date: new Date().toISOString(),
        status,
        label
    }), []);

    const updateReferralBalance = useCallback((code: string, amount: number) => {
        const savedUsers = localStorage.getItem('app_users');
        if (savedUsers) {
            const usersList = JSON.parse(savedUsers);
            const updatedUsers = usersList.map((u: any) => {
                if (u.referralCode === code) {
                    return { ...u, referralBalance: (u.referralBalance || 0) + amount };
                }
                return u;
            });
            localStorage.setItem('app_users', JSON.stringify(updatedUsers));
        }
    }, []);

    const addOrder = useCallback((orderData: Omit<Order, 'id' | 'date' | 'status'>) => {
        const newOrder: Order = {
            ...orderData,
            id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
            date: new Date().toISOString(),
            status: 'Nuevo',
            destinationIban: LOCALSHOP_PLATFORM_ACCOUNT.iban,
            history: [createEvent('Nuevo', 'Pedido Realizado')]
        };
        
        console.log(`[PAGO PROCESADO] Importe: €${orderData.total.toFixed(2)} -> Cuenta Destino: ${LOCALSHOP_PLATFORM_ACCOUNT.holder} (${LOCALSHOP_PLATFORM_ACCOUNT.iban})`);

        setOrders(prev => [newOrder, ...prev]);
        const savedOrders = localStorage.getItem('user_orders');
        const currentOrders = savedOrders ? JSON.parse(savedOrders) : [];
        safeStorageSet('user_orders', [newOrder, ...currentOrders]);

        // Lógica de Recompensa al Comprar (Referidos)
        if (user.referredBy && orders.filter(o => o.customerName === user.name).length === 0) {
            updateReferralBalance(user.referredBy, 2);
            notify('¡Recompensa!', 'Has ganado 2€ porque tu invitado ha realizado su primera compra', 'redeem');
        }

        setProducts(currentProducts => {
            const updatedProducts = currentProducts.map(prod => {
                const purchasedItems = orderData.items.filter(item => item.product.id === prod.id);
                if (purchasedItems.length > 0) {
                    const totalQtyPurchased = purchasedItems.reduce((acc, item) => acc + item.quantity, 0);
                    const currentTotalStock = prod.stock !== undefined ? prod.stock : 10;
                    const newTotalStock = Math.max(0, currentTotalStock - totalQtyPurchased);
                    
                    let newStockPerSize = prod.stockPerSize ? { ...prod.stockPerSize } : undefined;
                    if (newStockPerSize) {
                        purchasedItems.forEach(item => {
                            if (item.variant && newStockPerSize![item.variant] !== undefined) {
                                newStockPerSize![item.variant] = Math.max(0, newStockPerSize![item.variant] - item.quantity);
                            }
                        });
                    }

                    return { ...prod, stock: newTotalStock, stockPerSize: newStockPerSize };
                }
                return prod;
            });

            const initialIds = initialProducts.map(ip => ip.id);
            const prodsToSave = updatedProducts.filter(p => {
                if (!initialIds.includes(p.id)) return true;
                const initial = initialProducts.find(ip => ip.id === p.id);
                return initial && JSON.stringify(p) !== JSON.stringify(initial);
            });
            safeStorageSet('local_products', prodsToSave);

            return updatedProducts;
        });

        setCartItems([]);
    }, [createEvent, user, orders, notify, updateReferralBalance]);

    const updateOrderStatus = useCallback((orderId: string, status: OrderStatus) => {
        const labels: Record<OrderStatus, string> = {
            'Nuevo': 'Pedido Recibido',
            'En Proceso': 'Pedido en Preparación',
            'Completado': 'Pedido Entregado',
            'Devolución Solicitada': 'Devolución Solicitada',
            'Devuelto': 'Devolución Finalizada',
            'Cancelado': 'Pedido Cancelado'
        };

        setOrders(prev => {
            const updated = prev.map(o => {
                if (o.id === orderId) {
                    const event = createEvent(status, labels[status] || status);
                    return { ...o, status, history: [...(o.history || []), event] };
                }
                return o;
            });
            safeStorageSet('user_orders', updated);
            return updated;
        });
    }, [createEvent]);

    const requestReturn = useCallback((orderId: string) => {
        setOrders(prev => {
            const orderIndex = prev.findIndex(o => o.id === orderId);
            if (orderIndex === -1) return prev;
            
            const order = prev[orderIndex];
            
            if (order.status !== 'Completado') {
                notify('No disponible', 'Solo se pueden devolver pedidos en estado "Completado".', 'error');
                return prev;
            }

            // Validación de plazo: 14 días naturales según ley española
            const orderDate = new Date(order.date);
            const now = new Date();
            const diffInDays = (now.getTime() - orderDate.getTime()) / (1000 * 3600 * 24);
            
            if (diffInDays > 14) {
                notify('Plazo vencido', 'El periodo de 14 días para devoluciones ha finalizado.', 'error');
                return prev;
            }

            const updatedOrders = [...prev];
            const event = createEvent('Devolución Solicitada', 'Solicitud de Devolución Enviada');
            updatedOrders[orderIndex] = { 
                ...order, 
                status: 'Devolución Solicitada', 
                history: [...(order.history || []), event] 
            };
            safeStorageSet('user_orders', updatedOrders);
            notify('Devolución Solicitada', 'Tu solicitud ha sido enviada a la tienda.', 'assignment_return');
            return updatedOrders;
        });
    }, [notify, createEvent]);

    const processReturn = useCallback((orderId: string) => {
        setOrders(prev => {
            const orderIndex = prev.findIndex(o => o.id === orderId);
            if (orderIndex === -1) return prev;
            const order = prev[orderIndex];
            
            if (order.status !== 'Devolución Solicitada') return prev;

            // Increment Stock Automatically
            setProducts(currentProducts => {
                const updatedProducts = currentProducts.map(prod => {
                    const returnedItems = order.items.filter(item => item.product.id === prod.id);
                    if (returnedItems.length > 0) {
                        const totalQtyReturned = returnedItems.reduce((acc, item) => acc + item.quantity, 0);
                        const currentTotalStock = prod.stock !== undefined ? prod.stock : 10;
                        const newTotalStock = currentTotalStock + totalQtyReturned;
                        
                        let newStockPerSize = prod.stockPerSize ? { ...prod.stockPerSize } : undefined;
                        if (newStockPerSize) {
                            returnedItems.forEach(item => {
                                if (item.variant && newStockPerSize![item.variant] !== undefined) {
                                    newStockPerSize![item.variant] += item.quantity;
                                }
                            });
                        }
                        return { ...prod, stock: newTotalStock, stockPerSize: newStockPerSize };
                    }
                    return prod;
                });

                const initialIds = initialProducts.map(ip => ip.id);
                const prodsToSave = updatedProducts.filter(p => {
                    if (!initialIds.includes(p.id)) return true;
                    const initial = initialProducts.find(ip => ip.id === p.id);
                    return initial && JSON.stringify(p) !== JSON.stringify(initial);
                });
                safeStorageSet('local_products', prodsToSave);

                return updatedProducts;
            });

            const updatedOrders = [...prev];
            const event = createEvent('Devuelto', 'Producto Recibido y Devolución Finalizada');
            updatedOrders[orderIndex] = { 
                ...order, 
                status: 'Devuelto', 
                history: [...(order.history || []), event] 
            };
            safeStorageSet('user_orders', updatedOrders);
            return updatedOrders;
        });
    }, [createEvent]);

    const [reviews, setReviews] = useState<Review[]>(() => {
        const saved = localStorage.getItem('store_reviews');
        return saved ? JSON.parse(saved) : [
            { id: 'rev1', storeId: '1', userName: 'Ana Ruiz', rating: 5, comment: 'Increíble selección vintage, ¡me encanta!', date: '2024-06-12' },
            { id: 'rev2', storeId: '1', userName: 'Marco Polo', rating: 4, comment: 'Buena calidad pero precios algo altos.', date: '2024-06-15' }
        ];
    });
    useEffect(() => safeStorageSet('store_reviews', reviews), [reviews]);

    const addReview = useCallback((reviewData: Omit<Review, 'id' | 'date'>) => {
        const newReview: Review = {
            ...reviewData,
            id: `REV-${Math.random().toString(36).substr(2, 9)}`,
            date: new Date().toISOString().split('T')[0]
        };
        setReviews(prev => [newReview, ...prev]);
    }, []);

    const getStoreReviews = useCallback((storeId: string) => reviews.filter(r => r.storeId === storeId), [reviews]);
    const getUserReviews = useCallback((userName: string) => reviews.filter(r => r.userName === userName), [reviews]);

    const userValue = useMemo(() => ({ user, updateUser, paymentMethods, addPaymentMethod, removePaymentMethod, bankAccounts, addBankAccount, removeBankAccount, useReferralBalance }), [user, updateUser, paymentMethods, addPaymentMethod, removePaymentMethod, bankAccounts, addBankAccount, removeBankAccount, useReferralBalance]);
    const storeValue = useMemo(() => ({ stores, addStore, updateStore, getStoreById: (id: string) => stores.find(s => s.id === id) }), [stores, addStore, updateStore]);
    const productValue = useMemo(() => ({ products, addProduct, updateProduct, deleteProduct, getProductById: (id: string) => products.find(p => p.id === id), clearLocalProducts }), [products, addProduct, updateProduct, deleteProduct, clearLocalProducts]);
    const cartValue = useMemo(() => ({ cartItems, addToCart, clearCart: () => setCartItems([]), removeFromCart: (pid: string, v?: string) => setCartItems(prev => prev.filter(i => !(i.product.id === pid && i.variant === v))), updateQuantity: (pid: string, q: number, v?: string) => setCartItems(prev => prev.map(i => (i.product.id === pid && i.variant === v) ? { ...i, quantity: q } : i)) }), [cartItems, addToCart]);
    const favoritesValue = useMemo(() => ({ favorites, toggleFavorite, isFavorite }), [favorites, toggleFavorite, isFavorite]);
    const followedStoresValue = useMemo(() => ({ followedStoreIds: followedIds, toggleFollow, isFollowing }), [followedIds, toggleFollow, isFollowing]);
    const orderValue = useMemo(() => ({ orders, addOrder, requestReturn, processReturn, updateOrderStatus }), [orders, addOrder, requestReturn, processReturn, updateOrderStatus]);
    const reviewValue = useMemo(() => ({ addReview, getStoreReviews, getUserReviews }), [addReview, getStoreReviews, getUserReviews]);
    const notificationValue = useMemo(() => ({ settings: notifSettings, updateSettings: (s: Partial<NotificationSettings>) => setNotifSettings(prev => ({...prev, ...s})), notify }), [notifSettings, notify]);

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
                <div className="fixed top-4 left-4 right-4 z-[3000] animate-slide-up bg-white dark:bg-accent-dark border-l-4 border-primary p-4 rounded-xl shadow-2xl flex items-start gap-4 ring-1 ring-black/5">
                    <span className="material-symbols-outlined text-primary">{activeNotif.icon}</span>
                    <div className="flex-1">
                        <p className="text-sm font-bold">{activeNotif.title}</p>
                        <p className="text-xs text-text-subtle-light">{activeNotif.message}</p>
                    </div>
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
