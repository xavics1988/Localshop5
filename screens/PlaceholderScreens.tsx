
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { DetailHeader, Logo } from '../components/Layout';
import { useNavigate, Link, useLocation, useParams, Navigate } from 'react-router-dom';

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
const STRIPE_PRICE_FOUNDING = import.meta.env.VITE_STRIPE_PRICE_FOUNDING as string;
const STRIPE_PRICE_STANDARD = import.meta.env.VITE_STRIPE_PRICE_STANDARD as string;
import {
    sanitizeRaw, truncate, MAX_LENGTHS,
    validateName, validateEmail, validatePhone,
    validateCardNumber, validateCardExpiry, validateCVV,
    validateProductField, validatePrice
} from '../utils/validation';
import { Product, Order, OrderStatus, Store, OrderItem, BankAccount, Review, PaymentCard, OrderEvent, Invoice, ReturnRequest, ReturnMessage, DevolucionTipo } from '../types';
import { useProducts, useCart, useFavorites, useFollowedStores, useNotifications, useOrders, useReviews, useUser, useStores, LOCALSHOP_PLATFORM_ACCOUNT, LOCALSHOP_COMPANY_ACCOUNT, LOCALSHOP_FEE, LOCALSHOP_FEE_BASE, LOCALSHOP_FEE_IVA, SHIPPING_FEE, FREE_SHIPPING_THRESHOLD, getCollaboratorSubscription } from '../AppContext';
import { StoreCard, ProductCard } from '../components/Card';
import { GoogleGenAI } from "@google/genai";
import { removeBackground } from '@imgly/background-removal';
import { SPANISH_PROVINCES } from './AuthScreens';
import { CLOTHING_CATEGORIES } from '../data';
import { uploadBase64Image, supabase, dbProductToProduct } from '../src/lib/supabase';

const Placeholder = ({ title, backTo = "/" }: { title: string; backTo?: string }) => (
    <div className="bg-background-light dark:bg-background-dark min-h-screen">
        <DetailHeader title={title} backTo={backTo} />
        <div className="flex flex-col items-center justify-center h-96 p-8 text-center space-y-4">
            <div className="size-20 bg-primary/10 rounded-full flex items-center justify-center animate-pulse">
                <Icon name="construction" className="text-4xl text-primary" />
            </div>
            <h2 className="text-2xl text-text-light dark:text-text-dark font-black tracking-tight">{title}</h2>
            <p className="text-text-subtle-light dark:text-text-subtle-dark max-w-xs uppercase text-[10px] font-black tracking-[0.2em]">Próximamente disponible</p>
        </div>
    </div>
);

const Icon = ({ name, filled, className }: { name: string; filled?: boolean; className?: string; key?: React.Key }) => (
    <span
        className={`material-symbols-outlined ${className}`}
        style={{ fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24` }}
    >
        {name}
    </span>
);

/**
 * Identicon Component: Generates a deterministic 5x5 symmetric grid based on a seed string.
 * Used for collaborator identity protection and visual uniqueness.
 */
const Identicon: React.FC<{ seed: string, size?: number, className?: string }> = ({ seed, size = 100, className }) => {
    const hashString = (str: string) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = (hash << 5) - hash + str.charCodeAt(i);
            hash |= 0;
        }
        return Math.abs(hash);
    };

    const hash = hashString(seed);

    // Generate 5x5 grid (3 columns unique, mirrored for symmetry)
    const grid = [];
    for (let row = 0; row < 5; row++) {
        const rowData = [];
        for (let col = 0; col < 3; col++) {
            // Use bits from the hash to determine if cell is filled
            const bit = (hash >> (row * 3 + col)) & 1;
            rowData[col] = bit === 1;
        }
        // Mirroring
        rowData[3] = rowData[1];
        rowData[4] = rowData[0];
        grid.push(rowData);
    }

    // Determine color based on hash
    const hue = hash % 360;
    const color = `hsl(${hue}, 45%, 65%)`;

    return (
        <svg
            viewBox="0 0 5 5"
            className={className}
            width={size}
            height={size}
            shapeRendering="crispEdges"
            style={{ backgroundColor: 'rgba(255,255,255,0.8)' }}
        >
            {grid.map((row, y) =>
                row.map((filled, x) => (
                    filled && <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill={color} />
                ))
            )}
        </svg>
    );
};

export const ManageCatalogScreen: React.FC = () => {
    const { products, deleteProduct } = useProducts();
    const { user } = useUser();
    const { stores } = useStores();
    const navigate = useNavigate();
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    const isCollab = user.role === 'colaborador';
    const currentStore = isCollab ? stores.find(s => s.id === user.storeId) : null;
    const hasStripeConnected = !!currentStore?.stripeConnectOnboarded;
    const subscription = isCollab && user.joinedAt ? getCollaboratorSubscription(user.joinedAt) : null;
    const isTrialExpired = !!subscription && subscription.daysRemainingInTrial <= 0;

    if (isCollab && (!hasStripeConnected || isTrialExpired)) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen pb-20">
                <DetailHeader title="Gestionar mi Catálogo" backTo="/profile" />
                <main className="p-6 flex flex-col items-center justify-center min-h-[70vh] text-center animate-fade-in">
                    <div className="size-24 bg-primary/10 rounded-full flex items-center justify-center mb-8 shadow-inner">
                        <Icon name={isTrialExpired ? 'credit_card_off' : 'account_balance_wallet'} className="text-6xl text-primary" filled />
                    </div>
                    <h2 className="text-2xl font-black text-text-light dark:text-white uppercase tracking-tight mb-4 leading-tight">
                        {isTrialExpired ? 'Suscripción Inactiva' : 'Configura tus Cobros Primero'}
                    </h2>
                    <p className="text-sm text-text-subtle-light dark:text-text-subtle-dark max-w-sm leading-relaxed mb-10">
                        {isTrialExpired
                            ? 'Tu período de prueba ha finalizado. Activa tu suscripción para seguir gestionando tu catálogo y vendiendo en LocalShop.'
                            : 'Antes de gestionar tu catálogo necesitas conectar tu cuenta bancaria a través de Stripe para poder recibir tus cobros.'}
                    </p>
                    <button
                        onClick={() => navigate('/payment-methods')}
                        className="w-full max-w-sm h-16 bg-primary text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                    >
                        <Icon name="open_in_new" className="text-xl" />
                        {isTrialExpired ? 'Activar Suscripción' : 'Configurar Cobros con Stripe'}
                    </button>
                    <button onClick={() => navigate('/profile')} className="mt-4 w-full max-w-sm h-14 text-text-subtle-light font-bold text-sm uppercase">
                        Volver al Perfil
                    </button>
                </main>
            </div>
        );
    }

    // Filtrar y agrupar por nombre para evitar mostrar duplicados por talla
    const myProducts = useMemo(() => {
        const byName = new Map<string, Product>();
        for (const p of products.filter(p => p.storeId === user.storeId)) {
            const key = p.name.trim().toLowerCase();
            const existing = byName.get(key);
            if (!existing) {
                byName.set(key, p);
            } else {
                const mergedStockPerSize = { ...(existing.stockPerSize || {}), ...(p.stockPerSize || {}) };
                byName.set(key, {
                    ...existing,
                    sizes: [...new Set([...(existing.sizes || []), ...(p.sizes || [])])],
                    stockPerSize: mergedStockPerSize,
                    stock: (existing.stock || 0) + (p.stock || 0),
                });
            }
        }
        return Array.from(byName.values());
    }, [products, user.storeId]);

    const handleDelete = () => {
        if (confirmDeleteId) {
            deleteProduct(confirmDeleteId);
            setConfirmDeleteId(null);
        }
    };

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen pb-20">
            <DetailHeader title="Gestionar mi Catálogo" backTo="/profile" />
            <main className="p-4 space-y-4 animate-fade-in">
                {myProducts.length === 0 ? (
                    <div className="text-center py-20">
                        <Icon name="inventory" className="text-6xl text-text-subtle-light mb-4" />
                        <p className="text-text-subtle-light font-bold">Aún no has publicado productos.</p>
                        <button onClick={() => navigate('/publish')} className="mt-6 text-primary font-black uppercase underline">Subir mi primer artículo</button>
                    </div>
                ) : (
                    <div className="grid grid-cols-4 gap-2">
                        {myProducts.map(product => (
                            <div key={product.id} className="flex flex-col gap-2">
                                <div className="relative">
                                    <ProductCard product={product} />
                                    {product.stock === 0 && (
                                        <div className="absolute top-1 left-1 z-20 bg-red-500 text-white text-[7px] font-black uppercase px-1.5 py-0.5 rounded shadow-lg">Agotado</div>
                                    )}
                                </div>
                                <div className="flex flex-col gap-1 px-0.5 pb-2">
                                    <button
                                        onClick={() => navigate(`/publish/${product.id}`)}
                                        className="w-full h-8 bg-primary text-white rounded-lg text-[8px] font-black uppercase tracking-tighter flex items-center justify-center gap-1 shadow-md active:scale-95 transition-transform"
                                    >
                                        <Icon name="edit" className="text-[10px]" />
                                        <span>Editar / Reponer</span>
                                    </button>
                                    <button
                                        onClick={() => setConfirmDeleteId(product.id)}
                                        className="w-full h-8 bg-red-500 text-white rounded-lg text-[8px] font-black uppercase tracking-tighter flex items-center justify-center gap-1 shadow-md active:scale-95 transition-transform"
                                    >
                                        <Icon name="delete" className="text-[10px]" />
                                        <span>Eliminar producto</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Modal de Confirmación de Borrado */}
            {confirmDeleteId && (
                <div className="fixed inset-0 z-[3000] bg-black/60 backdrop-blur-sm flex items-end justify-center p-4 animate-fade-in" onClick={() => setConfirmDeleteId(null)}>
                    <div className="w-full max-w-sm bg-white dark:bg-accent-dark rounded-[40px] p-8 pb-10 shadow-2xl animate-slide-up text-center border border-white/10" onClick={e => e.stopPropagation()}>
                        <div className="size-20 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Icon name="delete_forever" className="text-4xl" filled />
                        </div>
                        <h3 className="text-xl font-black text-text-light dark:white uppercase tracking-tight mb-2">¿Eliminar artículo?</h3>
                        <p className="text-sm text-text-subtle-light dark:text-text-subtle-dark mb-8 leading-relaxed">
                            Esta acción es irreversible. El artículo dejará de aparecer en el escaparate para los clientes.
                        </p>
                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handleDelete}
                                className="w-full h-14 bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-red-500/20 active:scale-95 transition-all"
                            >
                                Sí, eliminar definitivamente
                            </button>
                            <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="w-full h-14 bg-accent-light dark:bg-background-dark border border-border-light dark:border-border-dark text-text-light dark:text-white rounded-2xl font-bold active:scale-95 transition-all"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="fixed bottom-6 right-6">
                <button
                    onClick={() => navigate('/publish')}
                    className="size-14 bg-primary text-white rounded-full shadow-2xl flex items-center justify-center active:scale-90 transition-transform"
                >
                    <Icon name="add" className="text-3xl" />
                </button>
            </div>
        </div>
    );
};

export const MyReviewsScreen: React.FC = () => {
    const { getUserReviews, getStoreReviews } = useReviews();
    const { user } = useUser();
    const isCollab = user.role === 'colaborador';
    const { stores } = useStores();

    const myStoreId = user.storeId;

    const reviewsToShow = useMemo(() => {
        if (isCollab && myStoreId) {
            return getStoreReviews(myStoreId);
        }
        return getUserReviews(user.name);
    }, [isCollab, getUserReviews, getStoreReviews, user.name, myStoreId]);

    const averageRating = useMemo(() => {
        if (reviewsToShow.length === 0) return 0;
        return (reviewsToShow.reduce((acc, r) => acc + r.rating, 0) / reviewsToShow.length).toFixed(1);
    }, [reviewsToShow]);

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen pb-20">
            <span className="sr-only">Reviews</span>
            <DetailHeader title={isCollab ? "Reseñas de Clientes" : "Mis Reseñas"} backTo="/profile" />

            <main className="p-4 space-y-6 animate-fade-in">
                {isCollab && (
                    <div className="bg-white dark:bg-accent-dark p-6 rounded-[32px] border border-border-light dark:border-border-dark shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-text-subtle-light mb-1">Reputación del Negocio</p>
                            <h2 className="text-2xl font-black text-text-light dark:text-text-dark">Rating Medio</h2>
                        </div>
                        <div className="text-right">
                            <div className="flex items-center gap-1 justify-end">
                                <Icon name="star" filled className="text-primary text-xl" />
                                <span className="text-2xl font-black text-text-light dark:text-text-dark">{averageRating}</span>
                            </div>
                            <p className="text-[10px] font-bold text-text-subtle-light uppercase">{reviewsToShow.length} valoraciones</p>
                        </div>
                    </div>
                )}

                {reviewsToShow.length === 0 ? (
                    <div className="text-center pt-20">
                        <div className="size-24 rounded-full bg-accent-light dark:bg-background-dark flex items-center justify-center mx-auto mb-6">
                            <Icon name={isCollab ? "chat_bubble" : "rate_review"} className="text-5xl text-text-subtle-light" />
                        </div>
                        <h2 className="text-xl font-bold text-text-light dark:text-text-dark">
                            {isCollab ? "Tu tienda aún no tiene reseñas" : "Aún no has escrito ninguna reseña"}
                        </h2>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {reviewsToShow.map(review => (
                            <div key={review.id} className="bg-white dark:bg-accent-dark p-5 rounded-3xl border border-border-light dark:border-border-dark shadow-sm">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="font-black text-text-light dark:text-text-dark">{review.userName}</h3>
                                        <div className="flex gap-0.5 mt-0.5">
                                            {[1, 2, 3, 4, 5].map(s => <Icon key={s} name="star" filled={s <= review.rating} className={`text-[10px] ${s <= review.rating ? 'text-primary' : 'text-text-subtle-light opacity-30'}`} />)}
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-bold text-text-subtle-light uppercase bg-accent-light dark:bg-background-dark px-2 py-1 rounded-full">{review.date}</span>
                                </div>
                                <p className="text-sm text-text-subtle-light italic leading-relaxed bg-accent-light/50 dark:bg-background-dark/30 p-3 rounded-2xl">"{review.comment}"</p>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export const TermsScreen: React.FC = () => {
    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen">
            <DetailHeader title="Términos y Condiciones" />
            <main className="p-6 space-y-8 animate-fade-in pb-20">
                <div className="text-center space-y-2">
                    <Logo className="h-10 mx-auto" />
                    <h1 className="text-xl font-black text-text-light dark:text-text-dark uppercase tracking-tight">Términos y Condiciones de Uso – Local SHOP</h1>
                </div>

                <div className="space-y-6 text-sm text-text-light dark:text-text-dark leading-relaxed">
                    <section className="space-y-2">
                        <h2 className="font-black text-primary uppercase text-xs tracking-widest">1. Información General</h2>
                        <p>La plataforma <strong>Local - SHOP</strong> es un mercado digital (marketplace) que conecta a comercios locales de moda y complementos en España con consumidores europeos. La gestión técnica y operativa es realizada por la sociedad con sede y jurisdicción en Castellón, España.</p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="font-black text-primary uppercase text-xs tracking-widest">2. Definiciones</h2>
                        <ul className="space-y-2 list-disc pl-4">
                            <li><strong>Colaborador (Tienda):</strong> Comercio local legalmente constituido que utiliza la plataforma para digitalizar su escaparate.</li>
                            <li><strong>Usuario (Cliente):</strong> Persona física que accede a la plataforma para comprar o reservar productos.</li>
                            <li><strong>Plataforma:</strong> Aplicación móvil y sitio web de Local - SHOP que gestiona catálogo, pedidos y pagos.</li>
                        </ul>
                    </section>

                    <section className="space-y-2">
                        <h2 className="font-black text-primary uppercase text-xs tracking-widest">3. Modelo de Negocio para el Colaborador</h2>
                        <ul className="space-y-2 list-disc pl-4">
                            <li><strong>Suscripción:</strong> Una cuota mensual de 2,49 € por el uso y mantenimiento del escaparate digital.</li>
                            <li><strong>Comisiones:</strong> Una comisión fija de 2,99 € por cada unidad de producto vendida a través de la plataforma.</li>
                            <li><strong>Gestión de Stock:</strong> El Colaborador es el único responsable de mantener actualizado su inventario digital, ya que la plataforma no utiliza stock centralizado.</li>
                        </ul>
                    </section>

                    <section className="space-y-2">
                        <h2 className="font-black text-primary uppercase text-xs tracking-widest">4. Condiciones de Venta para el Usuario</h2>
                        <ul className="space-y-2 list-disc pl-4">
                            <li><strong>Precios:</strong> Los productos se ofrecen al mismo precio que en la tienda física del Colaborador.</li>
                            <li><strong>Reserva Online:</strong> El Usuario puede realizar reservas de productos a través de la app.</li>
                            <li><strong>Pagos:</strong> Se realizan de forma automatizada a través de la pasarela de pagos integrada en la plataforma.</li>
                        </ul>
                    </section>

                    <section className="space-y-2">
                        <h2 className="font-black text-primary uppercase text-xs tracking-widest">5. Política de Envíos y Recogida</h2>
                        <p>Se establece un modelo híbrido de logística:</p>
                        <ul className="space-y-2 list-disc pl-4">
                            <li><strong>Recogida en Tienda:</strong> Siempre gratuita para el Usuario.</li>
                            <li><strong>Envío a Domicilio:</strong>
                                <ul className="pl-4 mt-1 space-y-1 list-circle">
                                    <li>Pedidos inferiores a 70 €: El Usuario paga una tarifa plana de envío de 4,50 €.</li>
                                    <li>Pedidos de 70 € o más (en una misma tienda): El Colaborador gestiona y asume los gastos de envío. El envío es gratuito para el cliente.</li>
                                    <li>Pedidos a partir de 79 €: Envío gratuito para el Usuario; el coste es asumido por el Colaborador.</li>
                                </ul>
                            </li>
                        </ul>
                    </section>

                    <section className="space-y-2">
                        <h2 className="font-black text-primary uppercase text-xs tracking-widest">6. Derechos de Desistimiento y Devoluciones</h2>
                        <p>De acuerdo con la normativa española de consumo:</p>
                        <ul className="space-y-2 list-disc pl-4">
                            <li>El Usuario dispone de 14 días naturales para desistir de la compra online.</li>
                            <li>Las devoluciones pueden gestionarse físicamente en el local del Colaborador o mediante el servicio de mensajería de la plataforma.</li>
                            <li>En caso de devolución por mensajería, los costes de envío correrán a cargo del Usuario, salvo que el producto sea defectuoso.</li>
                        </ul>
                    </section>

                    <section className="space-y-2">
                        <h2 className="font-black text-primary uppercase text-xs tracking-widest">7. Responsabilidades</h2>
                        <ul className="space-y-2 list-disc pl-4">
                            <li><strong>Local - SHOP:</strong> Responsable del correcto funcionamiento técnico de la app y la gestión de pagos.</li>
                            <li><strong>Colaborador:</strong> Responsable de la calidad del producto, la veracidad de la información del catálogo y el cumplimiento de los plazos de entrega o disponibilidad para recogida.</li>
                        </ul>
                    </section>

                    <section className="space-y-2">
                        <h2 className="font-black text-primary uppercase text-xs tracking-widest">8. Protección de Datos y Confidencialidad</h2>
                        <p>Toda la información personal se tratará conforme al RGPD español. Los socios de la compañía mantienen un estricto deber de confidencialidad respecto a los datos de la sociedad y sus clientes.</p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="font-black text-primary uppercase text-xs tracking-widest">9. Jurisdicción y Ley Aplicable</h2>
                        <p>Estos términos se rigen por la ley española. Para cualquier controversia, las partes se someten a los Juzgados y tribunales de la ciudad de Castellón.</p>
                    </section>
                </div>

                <div className="pt-10 border-t border-border-light dark:border-border-dark text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-subtle-light">Última actualización: Marzo 2024</p>
                </div>
            </main>
        </div>
    );
};

export const PrivacyScreen: React.FC = () => {
    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen">
            <DetailHeader title="Política de Privacidad" />
            <main className="p-6 space-y-8 animate-fade-in pb-20">
                <div className="text-center space-y-2">
                    <Logo className="h-10 mx-auto" />
                    <h1 className="text-xl font-black text-text-light dark:text-text-dark uppercase tracking-tight">Política de Privacidad – Local SHOP</h1>
                </div>

                <div className="space-y-6 text-sm text-text-light dark:text-text-dark leading-relaxed">
                    <section className="space-y-2">
                        <h2 className="font-black text-primary uppercase text-xs tracking-widest">1. Responsable del Tratamiento</h2>
                        <p>El responsable de la recogida y tratamiento de sus datos es la sociedad gestora de Local – SHOP, con domicilio a efectos de notificaciones en Castellón, España. La gestión técnica es liderada por los socios fundadores en las áreas de operaciones y administración.</p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="font-black text-primary uppercase text-xs tracking-widest">2. Finalidad del Tratamiento de Datos</h2>
                        <p>En Local – SHOP tratamos la información de los usuarios y colaboradores para las siguientes finalidades:</p>
                        <ul className="space-y-2 list-disc pl-4">
                            <li><strong>Gestión de Usuarios:</strong> Creación de cuenta, gestión de pedidos, procesamiento de pagos automáticos y seguimiento de envíos o recogidas en tienda.</li>
                            <li><strong>Gestión de Colaboradores:</strong> Registro de tiendas, gestión de suscripciones mensuales, cobro de comisiones por venta y mantenimiento del escaparate digital.</li>
                            <li><strong>Mejora del Servicio:</strong> Uso de algoritmos para premiar la respuesta de productos y aplicación de IA para la optimización de las fotografías del catálogo.</li>
                            <li><strong>Geolocalización:</strong> Permitir al cliente buscar tiendas y productos por ubicación o región cercana.</li>
                        </ul>
                    </section>

                    <section className="space-y-2">
                        <h2 className="font-black text-primary uppercase text-xs tracking-widest">3. Legitimación</h2>
                        <p>La base legal para el tratamiento de sus datos es:</p>
                        <ul className="space-y-2 list-disc pl-4">
                            <li><strong>Ejecución de un contrato:</strong> Para procesar compras, suscripciones y el servicio de mensajería.</li>
                            <li><strong>Consentimiento:</strong> Para el envío de comunicaciones comerciales y el uso de la ubicación del dispositivo.</li>
                            <li><strong>Interés legítimo:</strong> Para garantizar la seguridad de la plataforma y mejorar la interfaz de usuario.</li>
                        </ul>
                    </section>

                    <section className="space-y-2">
                        <h2 className="font-black text-primary uppercase text-xs tracking-widest">4. Destinatarios de los Datos</h2>
                        <p>Sus datos no serán cedidos a terceros, salvo en los siguientes casi necesarios para la operativa:</p>
                        <ul className="space-y-2 list-disc pl-4">
                            <li><strong>Tiendas Colaboradoras:</strong> Reciben los datos necesarios para preparar el pedido o gestionar la recogida en local.</li>
                            <li><strong>Servicios de Mensajería:</strong> Empresas de logística integradas para realizar la entrega del pedido.</li>
                            <li><strong>Pasarelas de Pago:</strong> Entidades financieras que procesan los cobros de forma automatizada y segura.</li>
                        </ul>
                    </section>

                    <section className="space-y-2">
                        <h2 className="font-black text-primary uppercase text-xs tracking-widest">5. Conservación de los Datos</h2>
                        <p>Los datos personales se conservarán mientras se mantenga la relación comercial o durante el tiempo necesario para cumplir con las obligaciones legales. En el caso de los socios, el deber de confidencialidad permanece incluso tras la salida de la sociedad.</p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="font-black text-primary uppercase text-xs tracking-widest">6. Derechos del Usuario</h2>
                        <p>Usted tiene derecho a:</p>
                        <ul className="space-y-2 list-disc pl-4">
                            <li>Acceder, rectificar o suprimir sus datos.</li>
                            <li>Limitar u oponerse al tratamiento.</li>
                            <li>Portabilidad de los datos.</li>
                            <li>Presentar una reclamación ante la Agencia Española de Protección de Datos (AEPD).</li>
                        </ul>
                    </section>

                    <section className="space-y-2">
                        <h2 className="font-black text-primary uppercase text-xs tracking-widest">7. Seguridad y Confidencialidad</h2>
                        <p>Nos comprometemos al uso de medidas técnicas y organizativas que garanticen la seguridad de los datos. Los socios y gestores tienen prohibido transmitir o revelar información confidencial a la que tengan acceso como consecuencia de su actividad.</p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="font-black text-primary uppercase text-xs tracking-widest">8. Jurisdicción Aplicable</h2>
                        <p>Any controversy related to the processing of data will be submitted to the Courts and tribunals of the city of Castellón.</p>
                    </section>
                </div>

                <div className="pt-10 border-t border-border-light dark:border-border-dark text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-subtle-light">Última actualización: Marzo 2024</p>
                </div>
            </main>
        </div>
    );
};

export const CookiesScreen: React.FC = () => {
    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen">
            <DetailHeader title="Política de Cookies" />
            <main className="p-6 space-y-8 animate-fade-in pb-20">
                <div className="text-center space-y-2">
                    <Logo className="h-10 mx-auto" />
                    <h1 className="text-xl font-black text-text-light dark:text-text-dark uppercase tracking-tight">Política de Cookies – Local SHOP</h1>
                </div>

                <div className="space-y-6 text-sm text-text-light dark:text-text-dark leading-relaxed">
                    <section className="space-y-2">
                        <h2 className="font-black text-primary uppercase text-xs tracking-widest">1. ¿Qué son las Cookies?</h2>
                        <p>Las cookies son pequeños archivos de texto que se descargan en tu dispositivo (ordenador, smartphone o tablet) al acceder a la plataforma Local – SHOP. Permiten que la aplicación reconozca tu dispositivo y almacene información sobre tus preferencias o acciones previas para mejorar tu experiencia de usuario.</p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="font-black text-primary uppercase text-xs tracking-widest">2. Tipos de Cookies que utilizamos</h2>
                        <p>En nuestra plataforma utilizamos los siguientes tipos de cookies:</p>
                        <ul className="space-y-2 list-disc pl-4">
                            <li><strong>Cookies Técnicas y Necesarias:</strong> Son imprescindibles para que la app funcione correctamente. Permiten la gestión de pedidos, el procesamiento de pagos automáticos y el acceso a tu área privada de usuario.</li>
                            <li><strong>Cookies de Personalización:</strong> Nos permiten recordar tus preferencias, como el idioma o tus categorías de moda favoritas.</li>
                            <li><strong>Cookies de Geolocalización:</strong> Fundamentales para nuestro modelo de negocio, ya que permiten mostrarte el escaparate digital de las tiendas locales más cercanas a tu ubicación actual.</li>
                            <li><strong>Cookies de Análisis:</strong> Utilizamos estas cookies para entender cómo interactúas con el catálogo y optimizar nuestra interfaz limpia y ágil.</li>
                            <li><strong>Cookies de IA (Fotografía):</strong> Vinculadas a nuestras herramientas de Inteligencia Artificial para optimizar la visualización de los productos en tu dispositivo.</li>
                        </ul>
                    </section>

                    <section className="space-y-2">
                        <h2 className="font-black text-primary uppercase text-xs tracking-widest">3. Gestión y Desactivación de Cookies</h2>
                        <p>Como usuario, tienes derecho a configurar, bloquear o eliminar las cookies instaladas en tu equipo mediante la configuración de las opciones del navegador o los ajustes de privacidad de la aplicación. Ten en cuenta que, si bloqueas las cookies de geolocalización, es posible que no puedas visualizar correctamente las tiendas de tu región.</p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="font-black text-primary uppercase text-xs tracking-widest">4. Plazos de Conservación</h2>
                        <p>La información almacenada a través de las cookies se conservará durante el tiempo necesario para cumplir con las finalidades descritas, salvo que decidas borrarlas a través de los ajustes de tu navegador.</p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="font-black text-primary uppercase text-xs tracking-widest">5. Transferencias Internacionales y Terceros</h2>
                        <p>No vendemos tus datos a terceros. Sin embargo, para la gestión de pagos y servicios de mensajería, es posible que se instalen cookies de proveedores externos integrales en la plataforma para asegurar la trazabilidad del pedido.</p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="font-black text-primary uppercase text-xs tracking-widest">6. Actualizaciones</h2>
                        <p>Esta política puede ser modificada por la sociedad para adaptarse a nuevos requisitos legales o cambios en el funcionamiento de la app. Cualquier cambio significativo será comunicado a través de la plataforma.</p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="font-black text-primary uppercase text-xs tracking-widest">7. Ley Aplicable y Jurisdicción</h2>
                        <p>Esta Política de Cookies se rige por la normativa española vigente. Cualquier controversia será sometida a los Juzgados y tribunales de la ciudad de Castellón.</p>
                    </section>
                </div>

                <div className="pt-10 border-t border-border-light dark:border-border-dark text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-subtle-light">Última actualización: Marzo 2024</p>
                </div>
            </main>
        </div>
    );
};

export const LegalNoticeScreen: React.FC = () => {
    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen">
            <DetailHeader title="Aviso Legal" />
            <main className="p-6 space-y-8 animate-fade-in pb-20">
                <div className="text-center space-y-2">
                    <Logo className="h-10 mx-auto" />
                    <h1 className="text-xl font-black text-text-light dark:text-text-dark uppercase tracking-tight">Aviso Legal – Local SHOP</h1>
                </div>

                <div className="space-y-6 text-sm text-text-light dark:text-text-dark leading-relaxed">
                    <section className="space-y-2">
                        <h2 className="font-black text-primary uppercase text-xs tracking-widest">1. Información Identificativa</h2>
                        <p>En cumplimiento con el deber de información recogido en artículo 10 de la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información y del Comercio Electrónico, a continuación se reflejan los siguientes datos:</p>
                        <ul className="space-y-1 mt-2 font-medium">
                            <li><span className="text-text-subtle-light uppercase text-[10px] block">Titular:</span> [Nombre de la Sociedad o Autónomo responsable].</li>
                            <li><span className="text-text-subtle-light uppercase text-[10px] block mt-2">NIF/CIF:</span> [Número de identificación fiscal].</li>
                            <li><span className="text-text-subtle-light uppercase text-[10px] block mt-2">Domicilio:</span> Castellón, España.</li>
                            <li><span className="text-text-subtle-light uppercase text-[10px] block mt-2">Correo electrónico:</span> [Email de contacto].</li>
                            <li><span className="text-text-subtle-light uppercase text-[10px] block mt-2">Activity:</span> Plataforma de intermediación digital para el comercio de moda local.</li>
                        </ul>
                    </section>

                    <section className="space-y-2">
                        <h2 className="font-black text-primary uppercase text-xs tracking-widest">2. Usuarios</h2>
                        <p>El acceso y/o uso de este portal de Local – SHOP atribuye la condición de USUARIO, que acepta, desde dicho acceso y/o uso, las Condiciones Generales de Uso aquí reflejadas.</p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="font-black text-primary uppercase text-xs tracking-widest">3. Uso del Portal</h2>
                        <p>Local – SHOP proporciona el acceso a multitud de informaciones, servicios, programas o datos (en adelante, "los contenidos") en Internet pertenecientes a sus licenciantes a los que el USUARIO pueda tener acceso. El USUARIO asume la responsabilidad del uso del portal. Dicha responsabilidad se extiende al registro que fuese necesario para acceder a determinados servicios o contenidos (escaparate digital, pedidos, etc.).</p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="font-black text-primary uppercase text-xs tracking-widest">4. Propiedad Intelectual e Industrial</h2>
                        <p>Local – SHOP por sí o como cesionaria, es titular de todos los derechos de propiedad intelectual e industrial de su página web y app, así como de los elements contenidos en la misma (a título enunciativo: imágenes, sonido, audio, vídeo, software o textos; marcas o logotipos, combinaciones de colores, estructura y diseño, selección de materiales usados, etc.). Queda expresamente prohibida la reproducción, distribución y comunicación pública de la totalidad o parte de los contenidos de esta página web con fines comerciales, en cualquier soporte y por cualquier medio técnico, sin la autorización de los socios fundadores.</p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="font-black text-primary uppercase text-xs tracking-widest">5. Exclusión de Garantías y Responsabilidad</h2>
                        <p>Local – SHOP no se hace responsable, en ningún caso, de los daños y perjuicios de cualquier naturaleza que pudieran ocasionar, a título enunciativo: errores u omisiones en los contenidos de los colaboradores, falta de disponibilidad del portal o la transmisión de virus o programas maliciosos o lesivos en los contenidos, a pesar de haber adoptado todas las medidas tecnológicas necesarias para evitarlo. Al ser una plataforma de intermediación, la responsabilidad sobre el estado y calidad de los productos recae exclusivamente en la Tienda Colaboradora.</p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="font-black text-primary uppercase text-xs tracking-widest">6. Modificaciones</h2>
                        <p>Local – SHOP se reserva el derecho de efectuar sin previo aviso las modificaciones que considere oportunas en su portal, pudiendo cambiar, suprimir o añadir tanto los contenidos y servicios que se presten a través de la misma como la forma en la que éstos aparezcan presentados o localizados en su portal.</p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="font-black text-primary uppercase text-xs tracking-widest">7. Enlaces</h2>
                        <p>En el caso de que en nombre del dominio se dispusiesen enlaces o hipervínculos hacía otros sitios de Internet, Local – SHOP no ejercerá ningún tipo de control sobre dichos sitios and contenidos.</p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="font-black text-primary uppercase text-xs tracking-widest">8. Derecho de Exclusión</h2>
                        <p>Local – SHOP se reserva el derecho a denegar o retirar el acceso a portal y/o los servicios ofrecidos sin necesidad de preaviso, a instancia propia o de un tercero, a aquellos usuarios o colaboradores que incumplan las presentes Condiciones Generales de Uso.</p>
                    </section>

                    <section className="space-y-2">
                        <h2 className="font-black text-primary uppercase text-xs tracking-widest">9. Legislación Aplicable y Jurisdicción</h2>
                        <p>La relación entre Local – SHOP y el USUARIO se regirá por la normativa española vigente y cualquier controversia se someterá a los Juzgados y tribunales de la ciudad de Castellón.</p>
                    </section>
                </div>

                <div className="pt-10 border-t border-border-light dark:border-border-dark text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text-subtle-light">Última actualización: Marzo 2024</p>
                </div>
            </main>
        </div>
    );
};

export const HelpScreen: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useUser();
    const isCollab = user.role === 'colaborador';
    const { notify } = useNotifications();
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<'faq' | 'support'>('faq');

    const WHATSAPP_PHONE_NUMBER = "";
    const SUPPORT_EMAIL = "soporte@localshop.es";

    const faqs = isCollab ? [
        {
            q: "¿Cómo puedo digitalizar mi tienda?",
            a: "El proceso es ágil: tras registrarte, puedes subir tu escaparate digital en cuestión de minutos a través de la app o la web."
        },
        {
            q: "¿Cómo gestiona LocalShop los cobros y qué comisiones se aplican?",
            a: "La plataforma cuenta con un sistema automatizado que gestiona íntegramente el catálogo, los pedidos y los pagos. El modelo de ingresos se divide en dos vías principales:\n\n• Suscripción para tiendas: Cada comercio colaborador abona una cuota mensual de 2,49 € por el uso de la plataforma.\n\n• Comisión por venta: Por cada artículo vendido, el sistema aplica automáticamente una comisión de 2,99 € por unidad.\n\n• Gestión de pagos: La aplicación procesa los pagos de forma automática, permitiendo que el consumidor compre o reserve artículos sin necesidad de intermediarios manuales."
        },
        {
            q: "¿LocalShop gestiona mi inventario?",
            a: "No, la plataforma funciona de forma descentralizada. No hay stock centralizado; tú sigues vendiendo como siempre, pero con visibilidad global."
        },
        {
            q: "¿Tengo que pagar el envío de las ventas?",
            a: "Sí, en pedidos superiores a 70 €. Cuando el carrito de una sola tienda supera ese importe, el colaborador gestiona y asume los gastos de envío como ventaja para el cliente. En pedidos menores de 70 €, el cliente paga 4,50 €."
        }
    ] : [
        {
            q: "¿Qué es LocalShop?",
            a: "Es una plataforma digital que conecta a los consumidores con el comercio local de moda y complementos, permitiendo comprar artículos de tiendas auténticas de forma online."
        },
        {
            q: "¿Cómo recojo mi pedido?",
            a: "La plataforma utiliza un modelo híbrido para la entrega de artículos:\n\n• Envío a domicilio: El cliente recibe el pedido a través de un servicio de mensajería integrado.\n• Recogida en local: El cliente tiene la opción de acudir personalmente a la tienda física para recoger su compra."
        },
        {
            q: "¿Los precios online son más caros?",
            a: "No, el compromiso de la plataforma es que el cliente compre al mismo precio que encontraría físicamente en la tienda."
        },
        {
            q: "¿Cuánto cuesta el envío?",
            a: "Si tu pedido en una misma tienda es inferior a 70 €, se añaden 4,50 € de gastos de envío. Si superas los 70 €, el envío es completamente gratuito para ti, ya que el colaborador lo gestiona."
        },
        {
            q: "¿Cómo funcionan las devoluciones?",
            a: "Al ser una plataforma que conecta con tiendas locales, puedes gestionar tu devolución de dos formas: acudiendo directamente a la tienda física donde realizaste la compra o solicitando la recogida a través de nuestro servicio de mensajería integrado en un plazo de 15 día."
        }
    ];

    const toggleFAQ = (index: number) => {
        setExpandedIndex(expandedIndex === index ? null : index);
    };

    const handleWhatsAppClick = () => {
        if (!WHATSAPP_PHONE_NUMBER) {
            notify('Atención al Cliente', 'El servicio de WhatsApp estará disponible próximamente.', 'info');
            return;
        }
        const message = encodeURIComponent("Hola LocalShop, necesito ayuda con...");
        window.open(`https://wa.me/${WHATSAPP_PHONE_NUMBER}?text=${message}`, '_blank');
    };

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen pb-10">
            <span className="sr-only">Help</span>
            <DetailHeader title={isCollab ? "Centro de Ayuda Partner" : "Ayuda y Soporte"} backTo="/profile" />

            <div className="flex px-4 border-b border-border-light dark:border-border-dark bg-white dark:bg-background-dark sticky top-16 z-10">
                <button
                    onClick={() => setActiveTab('faq')}
                    className={`flex-1 py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'faq' ? 'border-primary text-primary' : 'border-transparent text-text-subtle-light'}`}
                >
                    Preguntas Frecuentes
                </button>
                <button
                    onClick={() => setActiveTab('support')}
                    className={`flex-1 py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'support' ? 'border-primary text-primary' : 'border-transparent text-text-subtle-light'}`}
                >
                    Atención al Cliente
                </button>
            </div>

            <main className="p-4 space-y-6 animate-fade-in">
                {activeTab === 'faq' ? (
                    <>
                        <div className="bg-primary/10 border border-primary/20 p-6 rounded-[40px]">
                            <h2 className="text-xl font-black text-primary mb-1">
                                {isCollab ? "Soporte para Negocios" : "¿Cómo podemos ayudarte?"}
                            </h2>
                            <p className="text-sm text-text-subtle-light leading-relaxed">
                                {isCollab
                                    ? "Optimiza tu tienda digital. Encuentra aquí todo lo necesario para resolver tus dudas comerciales."
                                    : "Encuentra respuestas rápidas sobre tus compras, envíos y artículos únicos favoritos."}
                            </p>
                        </div>

                        <div className="space-y-4">
                            {faqs.map((f, i) => {
                                const isExpanded = expandedIndex === i;
                                return (
                                    <div
                                        key={i}
                                        className="overflow-hidden rounded-[32px] border border-primary/20 shadow-sm transition-all duration-300"
                                    >
                                        <button
                                            onClick={() => toggleFAQ(i)}
                                            className="flex w-full items-center justify-between p-5 text-left text-white transition-colors"
                                            style={{ backgroundColor: '#C29B88' }}
                                        >
                                            <span className="text-sm font-bold pr-4 leading-tight">{f.q}</span>
                                            <Icon
                                                name="expand_more"
                                                className={`transition-transform duration-300 text-white ${isExpanded ? 'rotate-180' : 'rotate-0'}`}
                                            />
                                        </button>

                                        <div
                                            className={`transition-all duration-300 ease-in-out overflow-hidden bg-primary/5 ${isExpanded ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}
                                        >
                                            <div className="px-6 py-6 text-sm text-text-light dark:text-text-dark/90 leading-relaxed whitespace-pre-wrap border-t border-primary/10">
                                                {f.a}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-green-500/10 border border-green-500/20 p-8 rounded-[40px] text-center">
                            <div className="size-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                                <svg className="w-10 h-10 text-white fill-current" viewBox="0 0 24 24">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.94 3.659 1.437 5.63 1.438h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                            </div>
                            <h3 className="text-xl font-black text-text-light dark:text-white mb-2">WhatsApp Directo</h3>
                            <p className="text-sm text-text-subtle-light mb-8 leading-relaxed">
                                ¿Tienes una duda urgente sobre un pedido o quieres reportar un problemar? Escríbenos directamente y te responderemos en minutos.
                            </p>
                            <button
                                onClick={handleWhatsAppClick}
                                className="w-full h-14 bg-green-500 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3"
                            >
                                <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.72.94 3.659 1.437 5.63 1.438h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                                Contactar por WhatsApp
                            </button>
                        </div>

                        <div className="bg-white dark:bg-accent-dark border border-border-light dark:border-border-dark p-6 rounded-[32px] shadow-sm">
                            <h4 className="text-xs font-black uppercase tracking-widest text-text-subtle-light mb-4 text-center">Síguenos para más novedades</h4>
                            <div className="flex justify-center gap-8 py-2">
                                <a href="https://instagram.com/localshop" target="_blank" className="flex flex-col items-center gap-1 group">
                                    <div className="size-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-active:scale-90 transition-transform overflow-hidden shadow-sm border border-primary/20">
                                        <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
                                    </div>
                                </a>
                                <a href="https://tiktok.com/@localshop" target="_blank" className="flex flex-col items-center gap-1 group">
                                    <div className="size-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary group-active:scale-90 transition-transform overflow-hidden shadow-sm border border-primary/20">
                                        <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.17-2.86-.6-4.12-1.31a6.43 6.43 0 0 1-1.55-1.11v7.14c-.01 1.2-.24 2.41-.69 3.53a7.48 7.48 0 0 1-5.11 4.79c-1.2.32-2.45.39-3.68.21a7.41 7.41 0 0 1-5.39-4.01c-.46-1.12-.68-2.32-.69-3.53-.01-1.21.23-2.43.69-3.55a7.48 7.48 0 0 1 5.1-4.79c.96-.26 1.95-.35 2.94-.25v4.21c-.72-.08-1.45.02-2.12.3a3.17 3.17 0 0 0-1.89 2.56c-.05.51-.01 1.03.11 1.53.18.57.54 1.08 1.01 1.46.47.38 1.05.61 1.65.67.6.06 1.21-.04 1.77-.28a3.17 3.17 0 0 0 1.62-2.07c.13-.51.18-1.04.14-1.57V.02z" /></svg>
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-text-subtle-light">TikTok</span>
                                </a>
                                <a href="https://facebook.com/localshop" target="_blank" className="size-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary active:scale-90 transition-transform overflow-hidden shadow-sm border border-primary/20">
                                    <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                                </a>
                            </div>
                        </div>

                        <div className="bg-white dark:bg-accent-dark border border-border-light dark:border-border-dark p-6 rounded-[32px] shadow-sm">
                            <h4 className="text-xs font-black uppercase tracking-widest text-text-subtle-light mb-4 text-center">Información Legal</h4>
                            <div className="space-y-4">
                                <button onClick={() => navigate('/terms')} className="flex items-center gap-4 group w-full text-left">
                                    <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary group-active:scale-90 transition-transform">
                                        <Icon name="gavel" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-text-light dark:text-white">Términos y Condiciones</p>
                                        <p className="text-[10px] text-text-subtle-light uppercase font-bold">Uso de la plataforma</p>
                                    </div>
                                </button>
                                <button onClick={() => navigate('/privacy')} className="flex items-center gap-4 group w-full text-left">
                                    <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary group-active:scale-90 transition-transform">
                                        <Icon name="visibility" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-text-light dark:text-white">Política de Privacidad</p>
                                        <p className="text-[10px] text-text-subtle-light uppercase font-bold">Protección de tus datos</p>
                                    </div>
                                </button>
                                <button onClick={() => navigate('/cookies')} className="flex items-center gap-4 group w-full text-left">
                                    <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary group-active:scale-90 transition-transform">
                                        <Icon name="cookie" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-text-light dark:text-white">Política de Cookies</p>
                                        <p className="text-[10px] text-text-subtle-light uppercase font-bold">Uso de cookies</p>
                                    </div>
                                </button>
                                <button onClick={() => navigate('/legal-notice')} className="flex items-center gap-4 group w-full text-left">
                                    <div className="size-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary group-active:scale-90 transition-transform">
                                        <Icon name="policy" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-text-light dark:text-white">Aviso Legal</p>
                                        <p className="text-[10px] text-text-subtle-light uppercase font-bold">Información legal detallada</p>
                                    </div>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

const SettingsSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="mb-6">
        <h3 className="px-4 mb-2 text-xs font-bold uppercase tracking-wider text-text-subtle-light dark:text-text-subtle-dark">
            {title}
        </h3>
        <div className="bg-white dark:bg-accent-dark border-y border-border-light dark:border-border-dark divide-y divide-border-light dark:border-border-dark">
            {children}
        </div>
    </div>
);

const SettingsLink: React.FC<{
    icon: string;
    label: string;
    value?: string;
    onClick?: () => void;
    to?: string;
    showChevron?: boolean;
}> = ({ icon, label, value, onClick, to, showChevron = true }) => {
    const content = (
        <div className="flex items-center justify-between p-4 bg-transparent active:bg-accent-light dark:active:bg-background-dark transition-colors">
            <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-accent-light dark:bg-background-dark text-text-light dark:text-text-dark">
                    <Icon name={icon} className="text-xl" />
                </div>
                <span className="text-base font-medium text-text-light dark:text-text-dark">{label}</span>
            </div>
            <div className="flex items-center gap-2">
                {value && <span className="text-sm text-text-subtle-light">{value}</span>}
                {showChevron && <Icon name="chevron_right" className="text-text-subtle-light" />}
            </div>
        </div>
    );

    if (to) return <Link to={to}>{content}</Link>;
    return <button className="w-full text-left" onClick={onClick}>{content}</button>;
};

const SettingsToggle: React.FC<{
    icon: string;
    label: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
}> = ({ icon, label, checked, onChange, disabled }) => (
    <div className={`flex items-center justify-between p-4 bg-transparent${disabled ? ' opacity-50' : ''}`}>
        <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-accent-light dark:bg-background-dark text-text-light dark:text-text-dark">
                <Icon name={icon} className="text-xl" />
            </div>
            <span className="text-base font-medium text-text-light dark:text-text-dark">{label}</span>
        </div>
        <label className={`relative inline-flex items-center ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
            <input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} className="sr-only peer" />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer dark:bg-accent-dark peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
        </label>
    </div>
);

const FormInput = ({ label, value, type = "text", onChange, placeholder, required, disabled, maxLength }: any) => (
    <div className="space-y-1.5 relative">
        <label className="text-xs font-black uppercase tracking-widest text-text-light dark:text-text-dark opacity-70">
            {label}
        </label>
        <input
            required={required}
            disabled={disabled}
            type={type}
            value={value}
            maxLength={maxLength}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className={`w-full h-12 bg-white dark:bg-accent-dark border border-border-light dark:border-border-dark rounded-xl px-4 text-text-light dark:text-text-dark font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all ${disabled ? 'opacity-60 bg-gray-50 dark:bg-background-dark cursor-not-allowed' : ''}`}
        />
    </div>
);

export const AppSettingsScreen: React.FC = () => {
    const { clearLocalProducts } = useProducts();
    const { settings, updateSettings, notify, enablePushNotifications, disablePushNotifications, pushPermission } = useNotifications();
    const { logout, user } = useUser();
    const navigate = useNavigate();
    const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains('dark'));
    const [pushLoading, setPushLoading] = useState(false);
    const [deletingAccount, setDeletingAccount] = useState(false);

    const toggleDarkMode = (checked: boolean) => {
        setDarkMode(checked);
        if (checked) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    };

    const handlePushToggle = async (checked: boolean) => {
        setPushLoading(true);
        if (checked) {
            await enablePushNotifications();
        } else {
            await disablePushNotifications();
        }
        setPushLoading(false);
    };

    const handleDeleteAccount = async () => {
        const first = confirm(
            '⚠️ ¿Seguro que quieres eliminar tu cuenta?\n\nSe borrarán permanentemente:\n• Tu perfil y todos tus datos\n• Tus pedidos y favoritos\n• Tu suscripción de Stripe\n• Tus datos de pago\n\nEsta acción es IRREVERSIBLE.'
        );
        if (!first) return;

        const second = confirm(
            '🔴 ÚLTIMA CONFIRMACIÓN\n\n¿Confirmas que quieres eliminar tu cuenta definitivamente? No hay vuelta atrás.'
        );
        if (!second) return;

        setDeletingAccount(true);
        try {
            const { data: sessionData } = await supabase.auth.getSession();
            const token = sessionData?.session?.access_token;
            if (!token) throw new Error('Sesión no encontrada');

            const { error } = await supabase.functions.invoke('delete-account', {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (error) throw error;

            notify('Cuenta eliminada', 'Tu cuenta y todos tus datos han sido borrados permanentemente.', 'delete_forever');
            await supabase.auth.signOut();
            navigate('/welcome');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error inesperado al eliminar la cuenta.';
            alert(`No se pudo eliminar la cuenta: ${message}\nPor favor contacta con soporte.`);
        } finally {
            setDeletingAccount(false);
        }
    };

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen pb-20">
            <span className="sr-only">Settings</span>
            <DetailHeader title="Ajustes de la App" backTo="/profile" />
            <main className="pt-4">
                <SettingsSection title="Preferencias">
                    <SettingsToggle
                        icon="dark_mode"
                        label="Modo Oscuro"
                        checked={darkMode}
                        onChange={toggleDarkMode}
                    />
                    {user.role === 'colaborador' ? (
                        <SettingsToggle
                            icon="notifications"
                            label="Notificaciones Push"
                            checked={pushPermission === 'granted'}
                            onChange={handlePushToggle}
                            disabled={pushLoading || pushPermission === 'denied' || pushPermission === 'unsupported'}
                        />
                    ) : (
                        <SettingsToggle
                            icon="notifications"
                            label="Notificaciones Push"
                            checked={settings.push}
                            onChange={(v) => updateSettings({ push: v })}
                        />
                    )}
                    <SettingsToggle
                        icon="mail_outline"
                        label="Alertas por Email"
                        checked={settings.email}
                        onChange={(v) => updateSettings({ email: v })}
                    />
                </SettingsSection>

                <SettingsSection title="Privacidad y Seguridad">
                    <SettingsLink icon="lock" label="Cambiar Contraseña" onClick={() => notify('Seguridad', 'Opción disponible próximamente.', 'lock')} />
                    <SettingsLink icon="gavel" label="Términos y Condiciones" to="/terms" />
                    <SettingsLink icon="visibility" label="Política de Privacidad" to="/privacy" />
                    <SettingsLink icon="cookie" label="Política de Cookies" to="/cookies" />
                    <SettingsLink icon="policy" label="Aviso Legal" to="/legal-notice" />
                </SettingsSection>

                <SettingsSection title="Mantenimiento">
                    <div className="p-4">
                        <button
                            onClick={clearLocalProducts}
                            className="w-full py-4 bg-primary/10 text-primary font-bold rounded-xl border border-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <Icon name="cleaning_services" className="text-xl" />
                            Liberar espacio (Limpiar caché)
                        </button>
                    </div>
                </SettingsSection>

                <SettingsSection title="Cuenta">
                    <SettingsLink icon="logout" label="Cerrar Sesión" showChevron={false} onClick={() => { logout(); navigate('/welcome'); }} />
                    <div className="p-4">
                        <button
                            onClick={handleDeleteAccount}
                            disabled={deletingAccount}
                            className="w-full py-4 bg-red-500/10 text-red-500 font-bold rounded-xl border border-red-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            <Icon name={deletingAccount ? 'hourglass_empty' : 'person_remove'} className="text-xl" />
                            {deletingAccount ? 'Eliminando cuenta...' : 'Eliminar mi cuenta definitivamente'}
                        </button>
                    </div>
                </SettingsSection>

                <SettingsSection title="Información">
                    <SettingsLink icon="info" label="Versión" value="2.1.0" showChevron={false} />
                    <SettingsLink icon="contact_support" label="Contactar con Soporte" to="/help" />
                </SettingsSection>

                <div className="py-12 flex flex-col items-center justify-center text-center">
                    <Logo className="h-12 mx-auto" />
                    <p className="mt-4 text-[10px] font-black uppercase tracking-[0.3em] text-primary">Hecho con ❤️ en tu barrio</p>
                </div>
            </main>
        </div>
    );
};

export const CartScreen: React.FC = () => {
    const { cartItems, removeFromCart, updateQuantity } = useCart();
    const { user } = useUser();
    const navigate = useNavigate();
    const subtotal = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const freeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;
    const shippingCost = freeShipping ? 0 : SHIPPING_FEE;
    const grandTotal = subtotal + LOCALSHOP_FEE + shippingCost;
    const isAuthenticated = !!user.id;

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen pb-24">
            <DetailHeader title="Tu Cesta" />
            <main className="p-4 space-y-4">
                {cartItems.length === 0 ? (
                    <div className="text-center pt-24 animate-fade-in">
                        <div className="size-20 bg-accent-light dark:bg-accent-dark rounded-full flex items-center justify-center mx-auto mb-6">
                            <Icon name="shopping_cart" className="text-4xl text-text-subtle-light" />
                        </div>
                        <h2 className="text-xl font-bold text-text-light dark:text-text-dark">Tu cesta está vacía</h2>
                        <button onClick={() => navigate('/')} className="mt-8 px-10 py-4 bg-primary text-white font-bold rounded-2xl shadow-xl active:scale-95 transition-transform">Ir a explorar</button>
                    </div>
                ) : (
                    <div className="space-y-6 animate-fade-in">
                        <div className="space-y-4">
                            {cartItems.map(item => (
                                <div key={item.product.id} className="flex gap-4 bg-white dark:bg-accent-dark p-3 rounded-2xl border border-border-light dark:border-border-dark shadow-sm">
                                    <div className="size-24 rounded-xl bg-cover bg-center shrink-0 border border-border-light dark:border-border-dark" style={{ backgroundImage: `url(${item.product.imageUrl})` }} />
                                    <div className="flex-1 min-w-0 flex flex-col justify-between py-1">
                                        <div>
                                            <div className="flex justify-between items-start">
                                                <h3 className="font-bold text-text-light dark:text-text-dark truncate">{item.product.name}</h3>
                                                <button onClick={() => removeFromCart(item.product.id, item.variant)} className="text-red-400 p-1"><Icon name="close" className="text-xl" /></button>
                                            </div>
                                            <p className="text-xs text-text-subtle-light uppercase font-black tracking-tighter">{item.product.storeName}</p>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <p className="text-lg font-black text-primary">€{item.product.price.toFixed(2)}</p>
                                            <div className="flex items-center gap-4 bg-accent-light dark:bg-background-dark rounded-xl px-2 py-1 border border-border-light dark:border-border-dark">
                                                <button onClick={() => updateQuantity(item.product.id, Math.max(1, item.quantity - 1), item.variant)} className="text-primary"><Icon name="remove" className="text-xl" /></button>
                                                <span className="font-bold text-sm min-w-[30px] text-center text-text-light dark:text-white">{item.quantity}</span>
                                                <button onClick={() => updateQuantity(item.product.id, item.quantity + 1, item.variant)} className="text-primary"><Icon name="add" className="text-xl" /></button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="bg-white dark:bg-accent-dark p-6 rounded-[32px] border border-border-light dark:border-border-dark shadow-sm space-y-3">
                            <div className="flex justify-between items-center py-1.5 border-b border-border-light/50">
                                <span className="text-sm font-bold text-text-light dark:text-text-dark">Subtotal</span>
                                <span className="text-sm font-bold text-text-light dark:text-text-dark">€{subtotal.toFixed(2)}</span>
                            </div>
                            <div className="py-1.5 border-b border-border-light/50">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-bold text-text-light dark:text-text-dark">Gastos de gestión</span>
                                    <span className="text-sm font-bold text-text-light dark:text-text-dark">€{LOCALSHOP_FEE.toFixed(2)}</span>
                                </div>
                            </div>
                            <div className="flex justify-between items-center py-1.5 border-b border-border-light/50">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-text-light dark:text-text-dark">Gastos de envío</span>
                                    {freeShipping
                                        ? <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black uppercase">El colaborador gestiona el envío · Gratis para ti</span>
                                        : <span className="text-[10px] text-text-subtle-light">Tarifa plana para pedidos menores de €{FREE_SHIPPING_THRESHOLD}</span>
                                    }
                                </div>
                                {freeShipping
                                    ? <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">Gratis</span>
                                    : <span className="text-sm font-bold text-text-light dark:text-text-dark">€{SHIPPING_FEE.toFixed(2)}</span>
                                }
                            </div>
                            <div className="flex justify-between items-center pt-1">
                                <span className="font-black text-xl text-text-light dark:text-text-dark">Total</span>
                                <span className="text-2xl font-black text-primary">€{grandTotal.toFixed(2)}</span>
                            </div>
                        </div>

                        {!freeShipping && (
                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl p-4 flex gap-3 items-start">
                                <Icon name="local_shipping" className="text-amber-600 dark:text-amber-400 text-xl shrink-0 mt-0.5" />
                                <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed font-medium">
                                    Añade <span className="font-black">€{(FREE_SHIPPING_THRESHOLD - subtotal).toFixed(2)}</span> más de una misma tienda y el colaborador asumirá los gastos de envío.
                                </p>
                            </div>
                        )}

                        {isAuthenticated ? (
                            <button onClick={() => navigate('/payment')} className="w-full h-16 bg-primary text-white font-bold rounded-2xl shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-3 text-lg">
                                <Icon name="shopping_bag" />
                                Finalizar Pedido
                            </button>
                        ) : (
                            <div className="space-y-3">
                                <button onClick={() => navigate('/guest-checkout')} className="w-full h-16 bg-primary text-white font-bold rounded-2xl shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-3 text-lg">
                                    <Icon name="shopping_bag" />
                                    Comprar como Invitado
                                </button>
                                <button onClick={() => navigate('/login')} className="w-full h-14 border-2 border-primary text-primary font-bold rounded-2xl active:scale-95 transition-transform flex items-center justify-center gap-2">
                                    <Icon name="login" />
                                    Iniciar sesión para más beneficios
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};

const ReferralCard: React.FC = () => {
    const { user, notify } = useUser() as any;

    const handleCopy = () => {
        if (user.referralCode) {
            navigator.clipboard.writeText(user.referralCode);
            notify('¡Copiado!', 'Tu código de referido se ha copiado.', 'content_copy');
        }
    };

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Únete a LocalShop',
                    text: `¡Únete a LocalShop con mi código ${user.referralCode} y ahorra en tu primera compra!`,
                    url: window.location.origin,
                });
            } catch (err) {
                console.log('Error sharing:', err);
            }
        } else {
            handleCopy();
        }
    };

    return (
        <div className="bg-gradient-to-br from-primary to-olive p-6 rounded-[32px] text-white shadow-xl space-y-4 animate-fade-in mb-6">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Programa de Invitados</p>
                    <h3 className="text-xl font-black">Gana Dinero Real</h3>
                </div>
                <div className="bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-2xl flex items-center gap-2 border border-white/20">
                    <Icon name="payments" className="text-white text-lg" filled />
                    <span className="text-lg font-black tracking-tight">€{user.referralBalance.toFixed(2)}</span>
                </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 flex items-center justify-between border border-white/10">
                <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Tu Código</span>
                    <span className="text-lg font-black tracking-tighter uppercase">{user.referralCode || '----'}</span>
                </div>
                <button
                    onClick={handleCopy}
                    className="size-10 bg-white text-primary rounded-xl flex items-center justify-center active:scale-90 transition-transform shadow-lg"
                >
                    <Icon name="content_copy" className="text-lg" />
                </button>
            </div>

            <div className="flex gap-3">
                <button
                    onClick={handleShare}
                    className="flex-1 h-12 bg-white text-primary font-black uppercase tracking-widest text-[10px] rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg"
                >
                    <Icon name="share" className="text-sm" />
                    Compartir Código
                </button>
            </div>
            <p className="text-[8px] font-bold text-white/70 text-center uppercase tracking-tighter">Gana 2€ por cada amigo que realice su primera compra.</p>
        </div>
    );
};

// Componente interno para el pago de la suscripción de colaborador con Stripe
const SubscribeWithStripe: React.FC<{ monthlyFee: number; isFoundingMember: boolean; userId: string }> = ({ monthlyFee, isFoundingMember, userId }) => {
    const stripe   = useStripe();
    const elements = useElements();
    const { notify } = useNotifications();
    const [open, setOpen]       = useState(false);
    const [loading, setLoading] = useState(false);
    const [done, setDone]       = useState(false);
    const [checking, setChecking] = useState(true);
    const [isDark, setIsDark]   = useState(false);

    // Comprobar estado de suscripción en DB al cargar
    useEffect(() => {
        supabase
            .from('collaborator_subscriptions')
            .select('stripe_subscription_id, status, payment_method_attached')
            .eq('user_id', userId)
            .maybeSingle()
            .then(({ data }) => {
                if (data?.status === 'active' || data?.payment_method_attached) setDone(true);
                setChecking(false);
            });
    }, [userId]);

    useEffect(() => {
        const check = () => setIsDark(document.documentElement.classList.contains('dark'));
        check();
        const observer = new MutationObserver(check);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    const handleSubscribe = async () => {
        if (!stripe || !elements) return;
        const cardElement = elements.getElement(CardElement);
        if (!cardElement) return;

        setLoading(true);
        try {
            // Crear el PaymentMethod con la tarjeta introducida
            const { paymentMethod, error: pmError } = await stripe.createPaymentMethod({
                type: 'card',
                card: cardElement as any,
            });
            if (pmError) throw new Error(pmError.message);

            // Vincular la tarjeta a la suscripción existente (creada al registrarse)
            const res = await fetch(`${SUPABASE_URL}/functions/v1/attach-payment-method`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
                body:    JSON.stringify({ userId, paymentMethodId: paymentMethod!.id }),
            });
            const { error: attachError } = await res.json();
            if (attachError) throw new Error(attachError);

            setDone(true);
            notify('¡Tarjeta guardada!', `Stripe cobrará €${monthlyFee.toFixed(2)}/mes automáticamente al terminar el periodo gratuito.`, 'check_circle');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error al guardar la tarjeta';
            notify('Error', message, 'error');
        } finally {
            setLoading(false);
        }
    };

    if (checking) return null;

    if (done) {
        return (
            <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl border border-emerald-200 dark:border-emerald-800">
                <Icon name="check_circle" className="text-emerald-600 dark:text-emerald-400 text-xl" filled />
                <div>
                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">Suscripción activa</p>
                    <p className="text-[10px] text-emerald-600/80 dark:text-emerald-500">€{monthlyFee.toFixed(2)}/mes — Stripe gestiona los cobros automáticamente</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {open ? (
                <div className="space-y-3 animate-fade-in">
                    <div className="border border-border-light dark:border-border-dark rounded-xl px-4 py-3.5 bg-white dark:bg-accent-dark">
                        <CardElement
                            options={{
                                style: {
                                    base: {
                                        fontSize: '15px',
                                        color: isDark ? '#F0F2F4' : '#6B7785',
                                        fontFamily: 'Inter, sans-serif',
                                        '::placeholder': { color: isDark ? '#94a3b8' : '#8E8E93' },
                                        iconColor: '#c29b88',
                                    },
                                    invalid: { color: '#ef4444', iconColor: '#ef4444' },
                                },
                                hidePostalCode: true,
                            }}
                        />
                    </div>
                    <div className="flex gap-3">
                        <button onClick={() => setOpen(false)} className="flex-1 h-11 rounded-xl border border-border-light dark:border-border-dark text-sm font-bold text-text-subtle-light active:scale-95 transition-all">
                            Cancelar
                        </button>
                        <button
                            onClick={handleSubscribe}
                            disabled={loading || !stripe}
                            className="flex-[2] h-11 rounded-xl bg-primary text-white text-sm font-black uppercase tracking-wider shadow active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                            {loading
                                ? <span className="animate-spin material-symbols-outlined text-lg">progress_activity</span>
                                : <><Icon name="lock" className="text-lg" /> Pagar €{monthlyFee.toFixed(2)}/mes</>
                            }
                        </button>
                    </div>
                    <p className="text-[10px] text-text-subtle-light text-center">Pago seguro procesado por Stripe. Puedes cancelar cuando quieras.</p>
                </div>
            ) : (
                <button
                    onClick={() => setOpen(true)}
                    className="w-full h-12 rounded-xl bg-primary text-white text-sm font-black uppercase tracking-wider shadow active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                    <Icon name="credit_card" className="text-lg" />
                    Activar suscripción — €{monthlyFee.toFixed(2)}/mes
                </button>
            )}
        </div>
    );
};

export const ProfileScreen: React.FC = () => {
    const navigate = useNavigate();
    const { user, logout } = useUser();
    const { stores } = useStores();
    const isCollab = user.role === 'colaborador';

    // Invitado (sin sesión) → pantalla de registro/bienvenida
    if (!user.id) return <Navigate to="/welcome" replace />;

    const myStore = useMemo(() => isCollab ? stores.find(s => s.id === user.storeId) : null, [stores, isCollab, user.storeId]);

    const displayInfo = useMemo(() => {
        if (isCollab) {
            return {
                id: user.name || "Collab", // Collaborator "name" field stores the LS-ID
                title: myStore?.name || "Configura tu Tienda",
                subtitle: myStore?.category || "Gestión Partner",
                image: null, // Force no real photo for collabs
                label: "Identidad Corporativa"
            };
        }
        return {
            id: user.id,
            title: user.name || "Usuario Local",
            subtitle: user.location || "Cliente",
            image: user.avatar || null,
            label: "Perfil Personal"
        };
    }, [isCollab, myStore, user]);

    const initials = displayInfo.title.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen pb-20">
            <DetailHeader title="Mi Perfil" />
            <header className="bg-primary/5 dark:bg-primary/10 pt-8 pb-16 px-4 border-b border-primary/10">
                <div className="flex items-center justify-end mb-4">
                    <Link to="/settings" className="text-primary active:scale-90 transition-transform">
                        <Icon name="settings" className="text-2xl" />
                    </Link>
                </div>
                <div className="flex items-center gap-5 animate-fade-in">
                    <div className="size-20 rounded-[28px] bg-white flex items-center justify-center text-primary text-2xl font-black shadow-xl overflow-hidden border-4 border-white/20">
                        {isCollab ? (
                            <Identicon seed={displayInfo.id} className="w-full h-full" />
                        ) : displayInfo.image ? (
                            <img src={displayInfo.image} className="w-full h-full object-cover" alt="Profile" />
                        ) : (
                            initials
                        )}
                    </div>
                    <div className="text-text-light dark:text-white">
                        <div className="flex items-center gap-2">
                            <h2 className="text-2xl font-black tracking-tight leading-none">{displayInfo.title}</h2>
                            {isCollab && <Icon name="verified" className="text-primary/80 text-sm" filled />}
                        </div>
                        <p className="text-text-subtle-light dark:text-text-subtle-dark text-xs font-bold uppercase tracking-widest mt-1">{displayInfo.subtitle}</p>
                    </div>
                </div>
            </header>
            <main className="px-4 -mt-8 space-y-4">
                <div className="bg-white dark:bg-accent-dark p-2 rounded-[40px] border border-border-light dark:border-border-dark shadow-2xl overflow-hidden">
                    <SettingsLink icon="person" label={isCollab ? "Datos de la Empresa" : "Mis Datos Personales"} to="/edit-profile" />
                    {isCollab && <SettingsLink icon="inventory_2" label="Gestionar mi Catálogo" to="/manage-catalog" />}
                    <SettingsLink icon={isCollab ? "receipt_long" : "shopping_bag"} label={isCollab ? "Mis Ventas" : "Mis Pedidos"} to="/orders" />
                    <SettingsLink icon="payments" label={isCollab ? "Configuración de Cobros" : "Métodos de Pago"} to="/payment-methods" />
                    <SettingsLink icon="rate_review" label={isCollab ? "Reseñas de Clientes" : "Mis Reseñas"} to="/my-reviews" />
                    {!isCollab && <SettingsLink icon="favorite" label="Mis Favoritos" to="/favorites" />}
                    <SettingsLink icon="help" label="Ayuda y Soporte" to="/help" />
                </div>

                {!isCollab && <ReferralCard />}

                {isCollab && user.joinedAt && (() => {
                    const sub = getCollaboratorSubscription(user.joinedAt!);
                    const isTrial = sub.status === 'trial';
                    const isNearingEnd = isTrial && sub.daysRemainingInTrial <= 30;
                    const badgeClass = isTrial
                        ? isNearingEnd
                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                            : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
                    const badgeLabel = isTrial
                        ? isNearingEnd ? 'Prueba — próxima a vencer' : 'Periodo de prueba gratuito'
                        : 'Suscripción activa';
                    const trialEndStr = sub.trialEndsAt.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

                    return (
                        <div className="bg-white dark:bg-accent-dark p-6 rounded-[32px] border border-border-light dark:border-border-dark shadow-sm space-y-4 animate-fade-in">
                            <div className="flex justify-between items-start">
                                <div className="space-y-1.5">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-text-subtle-light">Suscripción</h3>
                                    {sub.isFoundingMember && (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                                            <Icon name="star" className="text-xs" filled /> Socio Fundador
                                        </span>
                                    )}
                                </div>
                                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full ${badgeClass}`}>
                                    {badgeLabel}
                                </span>
                            </div>

                            {isTrial ? (
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-text-subtle-light font-medium">Días restantes</span>
                                        <span className={`text-2xl font-black ${isNearingEnd ? 'text-orange-500' : 'text-primary'}`}>
                                            {sub.daysRemainingInTrial}
                                        </span>
                                    </div>
                                    <div className="w-full h-2 bg-accent-light dark:bg-background-dark rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${isNearingEnd ? 'bg-orange-400' : 'bg-primary'}`}
                                            style={{ width: `${Math.max(2, Math.min(100, (sub.daysRemainingInTrial / (6 * 30)) * 100))}%` }}
                                        />
                                    </div>
                                    {isNearingEnd && (
                                        <div className="flex items-start gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-2xl border border-orange-200 dark:border-orange-800">
                                            <Icon name="warning" className="text-orange-500 text-lg shrink-0 mt-0.5" filled />
                                            <p className="text-xs text-orange-700 dark:text-orange-400 leading-relaxed font-medium">
                                                Quedan <span className="font-black">{sub.daysRemainingInTrial} días</span>. Añade tu tarjeta para que Stripe continue cobrando automáticamente al terminar el periodo gratuito.
                                            </p>
                                        </div>
                                    )}
                                    <p className="text-xs text-text-subtle-light leading-relaxed">
                                        Prueba gratuita hasta el <span className="font-bold text-text-light dark:text-text-dark">{trialEndStr}</span>.
                                        A partir de esa fecha, la suscripción es de{' '}
                                        <span className="font-black text-primary">€{sub.monthlyFee.toFixed(2)}/mes</span>{' '}
                                        <span className="text-text-subtle-light">(IVA incluido)</span>
                                        {sub.isFoundingMember && (
                                            <span className="text-amber-600 dark:text-amber-400"> — tarifa fundador de por vida</span>
                                        )}.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <span className="text-sm text-text-subtle-light font-medium">Cuota mensual</span>
                                            {sub.isFoundingMember && (
                                                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-widest">Tarifa fundador — de por vida</p>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <span className="text-2xl font-black text-primary">€{sub.monthlyFee.toFixed(2)}</span>
                                            <p className="text-[10px] text-text-subtle-light">IVA incluido</p>
                                        </div>
                                    </div>
                                    <div className="flex justify-between text-[11px] text-text-subtle-light">
                                        <span>Base imponible</span>
                                        <span>€{sub.monthlyFeeBase.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-[11px] text-text-subtle-light">
                                        <span>IVA (21%)</span>
                                        <span>€{sub.monthlyFeeIva.toFixed(2)}</span>
                                    </div>
                                    <p className="text-xs text-text-subtle-light leading-relaxed">
                                        Periodo de prueba finalizado el <span className="font-bold">{trialEndStr}</span>.
                                    </p>
                                </div>
                            )}

                            {/* Mostrar formulario de tarjeta: cuando el trial termina O en los últimos 30 días */}
                            {(!isTrial || isNearingEnd) && (
                                <SubscribeWithStripe
                                    monthlyFee={sub.monthlyFee}
                                    isFoundingMember={sub.isFoundingMember}
                                    userId={user.id}
                                />
                            )}
                        </div>
                    );
                })()}

                <div className="pt-10 pb-4 text-center">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-subtle-light dark:text-text-subtle-dark mb-6">
                        Comunidad LocalShop
                    </h3>
                    <div className="flex justify-center items-center gap-6">
                        <a href="https://instagram.com/localshop" target="_blank" className="size-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary active:scale-90 transition-transform overflow-hidden shadow-sm border border-primary/20">
                            <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
                        </a>
                        <a href="https://facebook.com/localshop" target="_blank" className="size-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary active:scale-90 transition-transform overflow-hidden shadow-sm border border-primary/20">
                            <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                        </a>
                        <a href="https://tiktok.com/@localshop" target="_blank" className="size-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary active:scale-90 transition-transform overflow-hidden shadow-sm border border-primary/20">
                            <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.17-2.86-.6-4.12-1.31a6.43 6.43 0 0 1-1.55-1.11v7.14c-.01 1.2-.24 2.41-.69 3.53a7.48 7.48 0 0 1-5.11 4.79c-1.2.32-2.45.39-3.68.21a7.41 7.41 0 0 1-5.39-4.01c-.46-1.12-.68-2.32-.69-3.53-.01-1.21.23-2.43.69-3.55a7.48 7.48 0 0 1 5.1-4.79c.96-.26 1.95-.35 2.94-.25v4.21c-.72-.08-1.45.02-2.12.3a3.17 3.17 0 0 0-1.89 2.56c-.05.51-.01 1.03.11 1.53.18.57.54 1.08 1.01 1.46.47.38 1.05.61 1.65.67.6.06 1.21-.04 1.77-.28a3.17 3.17 0 0 0 1.62-2.07c.13-.51.18-1.04.14-1.57V.02z" /></svg>
                        </a>
                        <div className="size-14 bg-white dark:bg-accent-dark rounded-full flex items-center justify-center shadow-lg border border-border-light dark:border-border-dark overflow-hidden p-2">
                            <Logo showText={false} className="h-full" />
                        </div>
                    </div>
                </div>

                <div className="bg-white dark:bg-accent-dark rounded-[32px] border border-border-light dark:border-border-dark shadow-sm">
                    <button onClick={() => { logout(); navigate('/welcome'); }} className="w-full py-5 text-red-500 font-black text-center active:scale-95 transition-transform">
                        Cerrar Sesión
                    </button>
                </div>
            </main>
        </div>
    );
};

export const FavoritesScreen: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'products' | 'stores'>('products');
    const { favorites } = useFavorites();
    const { followedStoreIds } = useFollowedStores();
    const { products } = useProducts();
    const { stores } = useStores();

    const favProducts = useMemo(() => products.filter(p => favorites.includes(p.id)), [products, favorites]);
    const favStores = useMemo(() => stores.filter(s => followedStoreIds.includes(s.id)), [stores, followedStoreIds]);

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen pb-20">
            <span className="sr-only">Favoritos</span>
            <DetailHeader title="Mis Favoritos" />

            <div className="flex px-4 border-b border-border-light dark:border-border-dark bg-white dark:bg-background-dark sticky top-16 z-[120]">
                <button
                    onClick={() => setActiveTab('products')}
                    className={`flex-1 py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'products' ? 'border-primary text-primary' : 'border-transparent text-text-subtle-light'}`}
                >
                    Artículos ({favProducts.length})
                </button>
                <button
                    onClick={() => setActiveTab('stores')}
                    className={`flex-1 py-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'stores' ? 'border-primary text-primary' : 'border-transparent text-text-subtle-light'}`}
                >
                    Tiendas ({favStores.length})
                </button>
            </div>

            <main className="p-4 animate-fade-in">
                {activeTab === 'products' ? (
                    favProducts.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 text-center">
                            <div className="size-20 rounded-full bg-accent-light dark:bg-accent-dark flex items-center justify-center mb-6">
                                <Icon name="shopping_bag" className="text-4xl text-text-subtle-light" />
                            </div>
                            <h3 className="font-bold text-text-light dark:text-text-dark">No has guardado ningún artículo</h3>
                            <p className="text-xs text-text-subtle-light mt-2 max-w-[200px]">Explora el catálogo y pulsa el corazón en los artículos que te enamoren.</p>
                            <Link to="/" className="mt-8 px-8 py-3 bg-primary text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg active:scale-95 transition-all">Explorar ahora</Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-4 gap-2">
                            {favProducts.map(p => <ProductCard key={p.id} product={p} />)}
                        </div>
                    )
                ) : (
                    favStores.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-24 text-center">
                            <div className="size-20 rounded-full bg-accent-light dark:bg-accent-dark flex items-center justify-center mb-6">
                                <Icon name="storefront" className="text-4xl text-text-subtle-light" />
                            </div>
                            <h3 className="font-bold text-text-light dark:text-text-dark">No sigues ninguna tienda</h3>
                            <p className="text-xs text-text-subtle-light mt-2 max-w-[200px]">Sigue tus tiendas favoritas del barrio para no perderte sus novedades.</p>
                            <Link to="/" className="mt-8 px-8 py-3 bg-primary text-white text-xs font-black uppercase tracking-widest rounded-xl shadow-lg active:scale-95 transition-all">Buscar tiendas</Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-4 gap-2">
                            {favStores.map(s => (
                                <div key={s.id} className="w-full">
                                    <StoreCard store={s} />
                                </div>
                            ))}
                        </div>
                    )
                )}
            </main>
        </div>
    );
};

export const FollowedStoresScreen: React.FC = () => {
    return <FavoritesScreen />;
};

/**
 * Modal de factura simplificada.
 */
const InvoiceModal: React.FC<{ invoice: Invoice; onClose: () => void }> = ({ invoice, onClose }) => {
    const isCollab = invoice.recipientType === 'collaborator';
    const itemsTotal = (invoice.items as any[]).reduce((sum, item) => {
        const price = item.product?.price ?? item.price ?? 0;
        const qty = item.quantity ?? 1;
        return sum + price * qty;
    }, 0);
    const clientShipping = Math.round((invoice.subtotal - itemsTotal) * 100) / 100;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={onClose}>
            <div className="bg-white dark:bg-accent-dark w-full max-w-md rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>

                {/* Cabecera */}
                <div className="bg-primary px-6 py-5 flex justify-between items-start">
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-white/60 mb-1">Factura Simplificada</p>
                        <h2 className="text-white font-black text-lg tracking-tight">{invoice.invoiceNumber}</h2>
                        <p className="text-white/70 text-[10px] font-bold mt-1">{new Date(invoice.issuedAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                    </div>
                    <button onClick={onClose} className="text-white/70 hover:text-white transition-colors mt-1">
                        <Icon name="close" className="text-xl" />
                    </button>
                </div>

                <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">

                    {/* Emisor */}
                    {invoice.storeName && (
                        <div>
                            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-text-subtle-light mb-2">Vendedor</p>
                            <p className="text-sm font-black text-text-light dark:text-text-dark">{invoice.storeName}</p>
                            {invoice.storeCif && <p className="text-[10px] text-text-subtle-light font-bold">CIF: {invoice.storeCif}</p>}
                            {invoice.storeAddress && <p className="text-[10px] text-text-subtle-light">{invoice.storeAddress}</p>}
                        </div>
                    )}

                    {/* Comprador */}
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-text-subtle-light mb-2">
                            {isCollab ? 'Cliente' : 'Comprador'}
                        </p>
                        <p className="text-sm font-bold text-text-light dark:text-text-dark">{invoice.customerName}</p>
                        {invoice.customerEmail && <p className="text-[10px] text-text-subtle-light">{invoice.customerEmail}</p>}
                    </div>

                    {/* Items */}
                    <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.2em] text-text-subtle-light mb-3">Artículos</p>
                        <div className="space-y-2">
                            {(invoice.items as any[]).map((item: any, idx: number) => {
                                const name = item.product?.name ?? item.name ?? '—';
                                const price = item.product?.price ?? item.price ?? 0;
                                const qty = item.quantity ?? 1;
                                return (
                                    <div key={idx} className="flex justify-between items-center text-sm">
                                        <span className="text-text-light dark:text-text-dark font-medium flex-1 truncate pr-4">{qty}× {name}{item.variant ? ` (${item.variant})` : ''}</span>
                                        <span className="font-black text-text-light dark:text-text-dark">€{(price * qty).toFixed(2)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Totales */}
                    <div className="border-t border-border-light dark:border-border-dark pt-4 space-y-2">
                        <div className="flex justify-between text-[11px] text-text-subtle-light">
                            <span>Subtotal productos</span>
                            <span className="font-bold">€{itemsTotal.toFixed(2)}</span>
                        </div>
                        {isCollab && clientShipping > 0 && (
                            <div className="flex justify-between text-[11px] text-blue-600 dark:text-blue-400">
                                <span>Envío aportado por el cliente</span>
                                <span className="font-bold">€{clientShipping.toFixed(2)}</span>
                            </div>
                        )}
                        {!isCollab && clientShipping > 0 && (
                            <div className="flex justify-between text-[11px] text-text-subtle-light">
                                <span>Gastos de envío <span className="italic">(pedido inferior a €{FREE_SHIPPING_THRESHOLD})</span></span>
                                <span className="font-bold">€{clientShipping.toFixed(2)}</span>
                            </div>
                        )}
                        {invoice.feeBase != null && !isCollab && (
                            <>
                                <div className="flex justify-between text-[11px] text-text-subtle-light">
                                    <span>Comisión LocalShop (base)</span>
                                    <span className="font-bold">€{invoice.feeBase.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-[11px] text-text-subtle-light">
                                    <span>IVA 21% comisión</span>
                                    <span className="font-bold">€{(invoice.feeIva ?? 0).toFixed(2)}</span>
                                </div>
                            </>
                        )}
                        <div className="flex justify-between items-center pt-2 border-t border-border-light dark:border-border-dark">
                            <span className="text-sm font-black uppercase tracking-widest text-text-light dark:text-text-dark">
                                {isCollab ? 'Total de tu venta' : 'Total pagado'}
                            </span>
                            <span className="text-xl font-black text-primary">
                                €{(isCollab ? invoice.subtotal : invoice.total).toFixed(2)}
                            </span>
                        </div>
                    </div>

                    {isCollab && clientShipping > 0 && (
                        <p className="text-xs text-blue-600 dark:text-blue-400 text-center italic">
                            * Los €{clientShipping.toFixed(2)} de envío son aportados por el cliente para cubrir los gastos de envío.
                        </p>
                    )}
                    {isCollab && invoice.subtotal >= FREE_SHIPPING_THRESHOLD && (
                        <p className="text-xs text-amber-600 dark:text-amber-400 text-center italic">
                            * Pedido superior a €70 — los gastos de envío corren a cargo del colaborador.
                        </p>
                    )}

                    {invoice.autoCompleted && (
                        <p className="text-[9px] text-text-subtle-light text-center italic">Completado automáticamente tras 7 días sin confirmación.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

/**
 * Sub-componente OrderTimeline: Muestra el historial de eventos de un pedido.
 */
const OrderTimeline: React.FC<{ history?: OrderEvent[], initialDate: string }> = ({ history, initialDate }) => {
    const events = useMemo(() => {
        if (!history || history.length === 0) {
            return [{ date: initialDate, status: 'Nuevo' as OrderStatus, label: 'Pedido Realizado' }];
        }
        return history;
    }, [history, initialDate]);

    return (
        <div className="mt-4 space-y-4 animate-fade-in">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-text-subtle-light mb-4">Trazabilidad del Pedido</h4>
            <div className="space-y-0 relative ml-2">
                {events.map((event, idx) => (
                    <div key={idx} className="flex gap-4 relative group">
                        <div className="flex flex-col items-center">
                            <div className="size-2 rounded-full bg-primary shrink-0 z-10"></div>
                            {idx < events.length - 1 && (
                                <div className="w-[1px] flex-1 bg-primary/20 my-1"></div>
                            )}
                        </div>
                        <div className="pb-4 last:pb-0 -mt-1 flex flex-1 justify-between items-start">
                            <span className="text-[10px] font-bold text-text-light dark:text-text-dark uppercase tracking-tight">{event.label}</span>
                            <span className="text-[9px] text-text-subtle-light font-medium">{new Date(event.date).toLocaleDateString()} {new Date(event.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// ── Hoja de selección: cámara o galería ──────────────────────────────────
const PhotoSourceSheet: React.FC<{
    onSelect: (file: File) => void;
    onClose: () => void;
}> = ({ onSelect, onClose }) => {
    const cameraRef = useRef<HTMLInputElement>(null);
    const galleryRef = useRef<HTMLInputElement>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) { onSelect(file); onClose(); }
        e.target.value = '';
    };

    return (
        <div className="fixed inset-0 z-[3000] flex items-end justify-center bg-black/40" onClick={onClose}>
            <div className="w-full max-w-md bg-white dark:bg-accent-dark rounded-t-3xl p-4 pb-8 space-y-2 animate-slide-up" onClick={e => e.stopPropagation()}>
                <div className="w-10 h-1 bg-border-light dark:bg-border-dark rounded-full mx-auto mb-3" />
                <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleChange} />
                <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
                <button
                    onClick={() => cameraRef.current?.click()}
                    className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl bg-background-light dark:bg-background-dark hover:bg-primary/5 transition-colors"
                >
                    <span className="material-symbols-outlined text-primary text-2xl">photo_camera</span>
                    <div className="text-left">
                        <p className="text-sm font-black">Tomar foto</p>
                        <p className="text-[10px] text-text-subtle-light">Usa la cámara del dispositivo</p>
                    </div>
                </button>
                <button
                    onClick={() => galleryRef.current?.click()}
                    className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl bg-background-light dark:bg-background-dark hover:bg-primary/5 transition-colors"
                >
                    <span className="material-symbols-outlined text-primary text-2xl">photo_library</span>
                    <div className="text-left">
                        <p className="text-sm font-black">Elegir de galería</p>
                        <p className="text-[10px] text-text-subtle-light">Selecciona una foto existente</p>
                    </div>
                </button>
                <button onClick={onClose} className="w-full py-3 text-xs font-black text-text-subtle-light uppercase tracking-widest">
                    Cancelar
                </button>
            </div>
        </div>
    );
};

// ── Modal: Solicitar devolución (2 pasos) ─────────────────────────────────
const ReturnRequestModal: React.FC<{
    order: Order;
    onClose: () => void;
    onSubmit: (type: DevolucionTipo, reason: string, collaboratorId: string, evidenceFiles: File[]) => void;
    collaboratorId: string;
}> = ({ order, onClose, onSubmit, collaboratorId }) => {
    const [step, setStep] = useState<1 | 2>(1);
    const [type, setType] = useState<DevolucionTipo | null>(null);
    const [reason, setReason] = useState('');
    const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
    const [evidencePreviews, setEvidencePreviews] = useState<string[]>([]);
    const [showPhotoSheet, setShowPhotoSheet] = useState(false);
    const shippingCost = 4.50;

    const handleNext = () => {
        if (!type) return;
        setStep(2);
    };

    const addEvidenceFile = (file: File) => {
        if (evidenceFiles.length >= 3) return;
        setEvidenceFiles(prev => [...prev, file]);
        setEvidencePreviews(prev => [...prev, URL.createObjectURL(file)]);
    };

    const removeEvidence = (idx: number) => {
        URL.revokeObjectURL(evidencePreviews[idx]);
        setEvidenceFiles(prev => prev.filter((_, i) => i !== idx));
        setEvidencePreviews(prev => prev.filter((_, i) => i !== idx));
    };

    const handleSubmit = () => {
        if (!type || !reason.trim()) return;
        onSubmit(type, reason.trim(), collaboratorId, evidenceFiles);
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-accent-dark rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-slide-up">
                <div className="p-6 space-y-5">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-black uppercase tracking-widest">Solicitar Devolución</h2>
                        <button onClick={onClose} className="text-text-subtle-light hover:text-text-light"><span className="material-symbols-outlined text-xl">close</span></button>
                    </div>
                    <p className="text-[10px] text-text-subtle-light font-bold uppercase tracking-widest">Pedido #{order.id.split('-')[1]}</p>

                    {step === 1 && (
                        <div className="space-y-3">
                            <p className="text-xs font-bold text-text-light dark:text-text-dark">¿Por qué quieres devolver este pedido?</p>

                            {/* Opción: Desistimiento */}
                            <button
                                onClick={() => setType('desistimiento')}
                                className={`w-full text-left p-4 rounded-2xl border-2 transition-all space-y-1 ${type === 'desistimiento' ? 'border-primary bg-primary/5' : 'border-border-light dark:border-border-dark'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <span className={`material-symbols-outlined text-base ${type === 'desistimiento' ? 'text-primary' : 'text-text-subtle-light'}`}>sentiment_dissatisfied</span>
                                    <span className="text-xs font-black">Ya no lo quiero</span>
                                </div>
                                <p className="text-[10px] text-text-subtle-light leading-relaxed pl-6">Cambio de opinión, talla equivocada al pedir, ya no lo necesito.</p>
                                <div className="pl-6 mt-1 flex items-center gap-1.5 text-amber-600">
                                    <span className="material-symbols-outlined text-xs">info</span>
                                    <span className="text-[10px] font-bold">Debes llevar el artículo a tu empresa de transporte y pagar el envío. Recibirás <strong>€{Math.max(order.total - (order.shippingFee ?? 3.99) - (order.customerDeliveryFee ?? 0), 0).toFixed(2)}</strong> cuando el colaborador confirme la recepción.</span>
                                </div>
                            </button>

                            {/* Opción: Error/Tara */}
                            <button
                                onClick={() => setType('error_tara')}
                                className={`w-full text-left p-4 rounded-2xl border-2 transition-all space-y-1 ${type === 'error_tara' ? 'border-red-500 bg-red-500/5' : 'border-border-light dark:border-border-dark'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <span className={`material-symbols-outlined text-base ${type === 'error_tara' ? 'text-red-500' : 'text-text-subtle-light'}`}>error</span>
                                    <span className="text-xs font-black">Artículo incorrecto o con tara</span>
                                </div>
                                <p className="text-[10px] text-text-subtle-light leading-relaxed pl-6">Talla incorrecta enviada, artículo equivocado, producto dañado o defectuoso.</p>
                                <div className="pl-6 mt-1 flex items-center gap-1.5 text-green-600">
                                    <span className="material-symbols-outlined text-xs">check_circle</span>
                                    <span className="text-[10px] font-bold">Reembolso del <strong>100% (€{order.total.toFixed(2)})</strong>. Gastos de envío a cargo del colaborador.</span>
                                </div>
                            </button>

                            <button
                                onClick={handleNext}
                                disabled={!type}
                                className="w-full h-12 bg-primary text-white font-black uppercase tracking-widest rounded-2xl disabled:opacity-40 active:scale-95 transition-all"
                            >
                                Continuar
                            </button>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4">
                            <button onClick={() => setStep(1)} className="flex items-center gap-1 text-[10px] text-text-subtle-light font-bold uppercase tracking-widest hover:text-primary transition-colors">
                                <span className="material-symbols-outlined text-sm">arrow_back</span>
                                Volver
                            </button>
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-text-subtle-light block mb-2">
                                    {type === 'error_tara' ? 'Describe el problema (se enviará al colaborador para resolverlo)' : 'Motivo de la devolución'}
                                </label>
                                <textarea
                                    value={reason}
                                    onChange={e => setReason(sanitizeRaw(e.target.value))}
                                    rows={4}
                                    maxLength={500}
                                    placeholder={type === 'error_tara' ? 'Ej: Me enviaron la talla M cuando pedí la L...' : 'Ej: Al probármelo no me convence el corte...'}
                                    className="w-full rounded-2xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark p-3 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                                />
                                <p className="text-[9px] text-text-subtle-light text-right mt-1">{reason.length}/500</p>
                            </div>
                            {type === 'error_tara' && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-text-subtle-light block">
                                        Fotos de prueba <span className="font-normal normal-case">(opcional, máx. 3)</span>
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        {evidencePreviews.map((src, idx) => (
                                            <div key={idx} className="relative size-20 rounded-xl overflow-hidden border border-border-light dark:border-border-dark">
                                                <img src={src} alt={`Prueba ${idx + 1}`} className="size-full object-cover" />
                                                <button
                                                    onClick={() => removeEvidence(idx)}
                                                    className="absolute top-0.5 right-0.5 size-5 rounded-full bg-black/60 text-white flex items-center justify-center"
                                                >
                                                    <span className="material-symbols-outlined text-[10px]">close</span>
                                                </button>
                                            </div>
                                        ))}
                                        {evidencePreviews.length < 3 && (
                                            <button
                                                onClick={() => setShowPhotoSheet(true)}
                                                className="size-20 rounded-xl border-2 border-dashed border-border-light dark:border-border-dark flex flex-col items-center justify-center gap-1 text-text-subtle-light hover:border-primary hover:text-primary transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-xl">add_photo_alternate</span>
                                                <span className="text-[8px] font-bold uppercase">Añadir</span>
                                            </button>
                                        )}
                                    </div>
                                    <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-2xl p-3 flex items-start gap-2">
                                        <span className="material-symbols-outlined text-blue-500 text-base mt-0.5">chat</span>
                                        <p className="text-[10px] text-blue-700 dark:text-blue-300 leading-relaxed">Las fotos se enviarán al colaborador en el chat de la disputa como prueba del error.</p>
                                    </div>
                                </div>
                            )}
                            {showPhotoSheet && (
                                <PhotoSourceSheet onSelect={addEvidenceFile} onClose={() => setShowPhotoSheet(false)} />
                            )}
                            <button
                                onClick={handleSubmit}
                                disabled={!reason.trim()}
                                className="w-full h-12 bg-primary text-white font-black uppercase tracking-widest rounded-2xl disabled:opacity-40 active:scale-95 transition-all"
                            >
                                {type === 'error_tara' ? 'Abrir disputa' : 'Confirmar devolución'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ── Modal: Chat de devolución (Error/Tara) ────────────────────────────────
const ReturnChatModal: React.FC<{
    returnRequest: ReturnRequest;
    order: Order;
    currentUserId: string;
    onClose: () => void;
    onResolve: (decision: 'acordado' | 'rechazado') => void;
    fetchMessages: (returnId: string) => Promise<ReturnMessage[]>;
    sendMessage: (returnId: string, body?: string, imageFile?: File) => Promise<void>;
    isCollab: boolean;
}> = ({ returnRequest, order, currentUserId, onClose, onResolve, fetchMessages, sendMessage, isCollab }) => {
    const [messages, setMessages] = useState<ReturnMessage[]>([]);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [resolving, setResolving] = useState(false);
    const [showPhotoSheet, setShowPhotoSheet] = useState(false);
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        fetchMessages(returnRequest.id).then(setMessages);
        const ch = supabase.channel(`return_msgs:${returnRequest.id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'return_messages', filter: `return_id=eq.${returnRequest.id}` }, async () => {
                const msgs = await fetchMessages(returnRequest.id);
                setMessages(msgs);
            })
            .subscribe();
        return () => { supabase.removeChannel(ch); };
    }, [returnRequest.id]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async () => {
        if (!text.trim()) return;
        setSending(true);
        await sendMessage(returnRequest.id, text.trim());
        setText('');
        setSending(false);
    };

    const handleImage = async (file: File) => {
        setSending(true);
        await sendMessage(returnRequest.id, undefined, file);
        setSending(false);
    };

    const handleResolve = async (decision: 'acordado' | 'rechazado') => {
        setResolving(true);
        await onResolve(decision);
        setResolving(false);
        onClose();
    };

    const isPending = returnRequest.status === 'pendiente';

    return (
        <div className="fixed inset-0 z-[2000] flex flex-col bg-background-light dark:bg-background-dark">
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border-light dark:border-border-dark bg-white dark:bg-accent-dark">
                <button onClick={onClose} className="text-text-subtle-light hover:text-primary transition-colors">
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-black uppercase tracking-widest truncate">Resolver incidencia</p>
                    <p className="text-[10px] text-text-subtle-light font-bold">Pedido #{order.id.split('-')[1]}</p>
                </div>
                <span className={`text-[9px] font-black px-2 py-1 rounded-full uppercase tracking-widest ${returnRequest.status === 'pendiente' ? 'bg-amber-100 text-amber-700' : returnRequest.status === 'acordado' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {returnRequest.status === 'pendiente' ? 'En disputa' : returnRequest.status === 'acordado' ? 'Acordado' : 'Rechazado'}
                </span>
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {/* Banner de contexto */}
                <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/20 rounded-2xl p-3 text-center">
                    <p className="text-[10px] font-bold text-red-700 dark:text-red-400">
                        {isCollab
                            ? `El cliente reclama un error en el pedido. Si lo aceptas, reembolsarás €${order.total.toFixed(2)} y asumirás los gastos de envío de vuelta (€4.50).`
                            : `Has reportado un problema. Habla con el colaborador para resolverlo. Puedes adjuntar fotos como prueba.`
                        }
                    </p>
                </div>

                {messages.length === 0 && (
                    <p className="text-center text-[10px] text-text-subtle-light py-6">Aún no hay mensajes. Sé el primero en escribir.</p>
                )}

                {messages.map(msg => {
                    const isMe = msg.senderId === currentUserId;
                    return (
                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 space-y-1.5 ${isMe ? 'bg-primary text-white rounded-br-sm' : 'bg-white dark:bg-accent-dark border border-border-light dark:border-border-dark rounded-bl-sm'}`}>
                                {msg.imageUrl && (
                                    <img src={msg.imageUrl} alt="Prueba" className="rounded-xl max-w-full max-h-48 object-cover" />
                                )}
                                {msg.body && (
                                    <p className={`text-xs leading-relaxed ${isMe ? 'text-white' : 'text-text-light dark:text-text-dark'}`}>{msg.body}</p>
                                )}
                                <p className={`text-[9px] ${isMe ? 'text-white/60' : 'text-text-subtle-light'} text-right`}>
                                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                    );
                })}
                <div ref={bottomRef} />
            </div>

            {/* Botones resolución (solo colaborador, solo cuando está pendiente) */}
            {isCollab && isPending && (
                <div className="flex gap-2 px-4 py-2 border-t border-border-light dark:border-border-dark bg-white dark:bg-accent-dark">
                    <button
                        onClick={() => handleResolve('rechazado')}
                        disabled={resolving}
                        className="flex-1 h-10 bg-red-500/10 text-red-500 border border-red-500/20 font-black uppercase text-[9px] tracking-widest rounded-xl active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-1"
                    >
                        <span className="material-symbols-outlined text-sm">cancel</span>
                        Rechazar error
                    </button>
                    <button
                        onClick={() => handleResolve('acordado')}
                        disabled={resolving}
                        className="flex-1 h-10 bg-green-500 text-white font-black uppercase text-[9px] tracking-widest rounded-xl active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-1 shadow-lg shadow-green-500/20"
                    >
                        <span className="material-symbols-outlined text-sm">handshake</span>
                        Aceptar error
                    </button>
                </div>
            )}

            {/* Resumen si acordado */}
            {returnRequest.status === 'acordado' && (
                <div className="border-t border-green-200 dark:border-green-800/20">
                    <div className="px-4 py-3 bg-green-50 dark:bg-green-900/10">
                        <p className="text-[10px] font-bold text-green-700 dark:text-green-400 text-center">
                            ✓ Acuerdo alcanzado — Reembolso: €{returnRequest.refundAmount?.toFixed(2)} {returnRequest.collaboratorCharge ? `· Cargo colaborador: €${returnRequest.collaboratorCharge.toFixed(2)}` : ''}
                        </p>
                    </div>
                    {!isCollab && returnRequest.returnLabelUrl && (
                        <div className="px-4 pb-3 bg-blue-50 dark:bg-blue-900/10 flex items-center gap-3 py-3">
                            <span className="material-symbols-outlined text-blue-600 text-xl">local_shipping</span>
                            <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest">Etiqueta de devolución</p>
                                <p className="text-[9px] text-blue-600/70 dark:text-blue-400/70 leading-tight mt-0.5">Imprímela y pégala en el paquete. El envío está prepagado.</p>
                            </div>
                            <a
                                href={returnRequest.returnLabelUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="shrink-0 h-9 px-3 bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest rounded-xl flex items-center gap-1.5 active:scale-95 transition-transform"
                            >
                                <span className="material-symbols-outlined text-sm">download</span>
                                PDF
                            </a>
                        </div>
                    )}
                </div>
            )}

            {/* Input de mensaje (solo si pendiente) */}
            {isPending && (
                <div className="flex items-end gap-2 px-4 py-3 border-t border-border-light dark:border-border-dark bg-white dark:bg-accent-dark">
                    <button
                        onClick={() => setShowPhotoSheet(true)}
                        className="size-10 rounded-xl bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark flex items-center justify-center text-text-subtle-light hover:text-primary transition-colors flex-shrink-0"
                    >
                        <span className="material-symbols-outlined text-base">attach_file</span>
                    </button>
                    <textarea
                        value={text}
                        onChange={e => setText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                        rows={1}
                        placeholder="Escribe un mensaje..."
                        className="flex-1 rounded-2xl border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark px-4 py-2.5 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!text.trim() || sending}
                        className="size-10 rounded-xl bg-primary text-white flex items-center justify-center flex-shrink-0 disabled:opacity-40 active:scale-95 transition-all"
                    >
                        <span className="material-symbols-outlined text-base">send</span>
                    </button>
                </div>
            )}

            {showPhotoSheet && (
                <PhotoSourceSheet onSelect={handleImage} onClose={() => setShowPhotoSheet(false)} />
            )}
        </div>
    );
};

export const OrdersScreen: React.FC = () => {
    const { orders, invoices, payouts, requestReturn, requestReturnWithType, processReturn, updateOrderStatus, refetchInvoices, getReturnForOrder, sendReturnMessage, fetchReturnMessages, resolveReturnDispute } = useOrders();
    const { user } = useUser();
    const { stores } = useStores();
    const { notify } = useNotifications();
    const isCollab = user.role === 'colaborador';

    const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({});
    const [activeInvoice, setActiveInvoice] = useState<Invoice | null>(null);
    const [returnModalOrder, setReturnModalOrder] = useState<Order | null>(null);
    const [chatReturn, setChatReturn] = useState<{ returnRequest: ReturnRequest; order: Order } | null>(null);

    const nextPayoutDate = useMemo(() => {
        const now = new Date();
        const day = now.getDate();
        const next = new Date(now);
        // Pagos los días 1 y 15 de cada mes
        if (day < 15) {
            next.setDate(15);
        } else {
            next.setMonth(next.getMonth() + 1);
            next.setDate(1);
        }
        next.setHours(8, 0, 0, 0);
        return next;
    }, []);

    const pendingEarnings = useMemo(() => {
        if (!isCollab) return 0;
        const lastPayoutEnd = payouts.length > 0 ? new Date(payouts[0].periodEnd) : new Date(0);
        return orders
            .filter(o =>
                o.status !== 'Devuelto' && o.status !== 'Cancelado' &&
                o.items.some(i => i.product.storeId === user.storeId) &&
                new Date(o.date) > lastPayoutEnd
            )
            .reduce((sum, o) => {
                const myItems = o.items.filter(i => i.product.storeId === user.storeId);
                const productSum = myItems.reduce((s, i) => s + i.product.price * i.quantity, 0);
                return sum + (productSum >= FREE_SHIPPING_THRESHOLD ? productSum : productSum + SHIPPING_FEE);
            }, 0);
    }, [orders, payouts, isCollab, user.storeId]);

    const toggleHistory = (orderId: string) => {
        setExpandedHistory(prev => ({
            ...prev,
            [orderId]: !prev[orderId]
        }));
    };

    const displayedOrders = useMemo(() => {
        if (isCollab && user.storeId) {
            return orders.filter(o => o.items.some(item => item.product.storeId === user.storeId));
        }
        return orders.filter(o => o.customerId === user.id);
    }, [orders, isCollab, user.storeId, user.id]);

    const totalNetRevenue = useMemo(() => {
        if (!isCollab) return 0;
        return displayedOrders.reduce((acc, order) => {
            if (order.status === 'Devuelto' || order.status === 'Cancelado') return acc;
            const myItems = order.items.filter(i => i.product.storeId === user.storeId);
            const productSum = myItems.reduce((sum, i) => sum + (i.product.price * i.quantity), 0);
            return acc + (productSum >= FREE_SHIPPING_THRESHOLD ? productSum : productSum + SHIPPING_FEE);
        }, 0);
    }, [displayedOrders, isCollab, user.storeId]);

    const handleConfirmReceipt = async (orderId: string) => {
        await updateOrderStatus(orderId, 'Completado');
        notify('¡Pedido recibido!', 'Tu compra ha sido marcada como completada.', 'check_circle');
        setTimeout(() => refetchInvoices(), 1500);
    };

    const handleRequestReturn = (order: Order) => {
        setReturnModalOrder(order);
    };

    const handleReturnSubmit = async (type: DevolucionTipo, reason: string, collaboratorId: string, evidenceFiles: File[]) => {
        if (!returnModalOrder) return;
        await requestReturnWithType(returnModalOrder.id, type, reason, collaboratorId);
        // Si hay fotos de prueba, enviarlas como mensajes iniciales en el chat
        if (type === 'error_tara' && evidenceFiles.length > 0) {
            // Pequeña espera para que el return_request esté en BD antes de insertar mensajes
            await new Promise(res => setTimeout(res, 800));
            // El return_request ya estará en returnRequests via realtime, pero hacemos fetch directo
            const { data } = await (await import('../src/lib/supabase')).supabase
                .from('return_requests')
                .select('id')
                .eq('order_id', returnModalOrder.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();
            if (data?.id) {
                for (const file of evidenceFiles) {
                    await sendReturnMessage(data.id, undefined, file);
                }
            }
        }
        setReturnModalOrder(null);
    };

    const handleConfirmReception = (orderId: string) => {
        processReturn(orderId);
        notify('Devolución Aceptada', 'El stock ha sido actualizado automáticamente.', 'inventory_2');
    };

    const handleAcceptOrder = async (orderId: string) => {
        await updateOrderStatus(orderId, 'En Proceso');
        notify('Pedido Aceptado', 'El cliente ha sido notificado y el pedido está en proceso.', 'local_shipping', undefined, '/orders');
        // Generar etiqueta de envío via Sendcloud
        try {
            const { data: { session } } = await supabase.auth.getSession();
            await fetch(`${SUPABASE_URL}/functions/v1/generate-shipping-label`, {
                method:  'POST',
                headers: {
                    'Content-Type':  'application/json',
                    'Authorization': `Bearer ${session?.access_token}`,
                },
                body: JSON.stringify({ orderId }),
            });
        } catch (e) {
            console.error('[handleAcceptOrder] generate-shipping-label failed:', e);
        }
    };

    const handleCancelOrder = (orderId: string) => {
        updateOrderStatus(orderId, 'Cancelado');
        notify('Pedido Cancelado', 'Se ha cancelado la venta.', 'cancel');
    };

    return (
        <>
        <div className="bg-background-light dark:bg-background-dark min-h-screen pb-20">
            <span className="sr-only">Orders</span>
            <DetailHeader title={isCollab ? "Mis Ventas" : "Mis Pedidos"} backTo="/profile" />
            <main className="p-4 space-y-4 animate-fade-in">

                {isCollab && (
                    <div className="space-y-3">
                        {/* Banner unificado: resumen contable + próximo pago */}
                        <div className="bg-gradient-to-br from-primary/5 to-primary/15 border border-primary/20 rounded-[28px] p-5 shadow-sm">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <p className="text-[9px] font-black uppercase tracking-widest text-primary mb-1.5">Resumen contable</p>
                                    <p className="text-[11px] font-bold text-text-subtle-light">Ingresos netos</p>
                                    <p className="text-2xl font-black text-primary mt-0.5">€{totalNetRevenue.toFixed(2)}</p>
                                    <p className="text-[8px] font-bold text-text-subtle-light uppercase tracking-tight mt-0.5">Excluyendo anulaciones</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] font-black uppercase tracking-widest text-text-subtle-light mb-1">Próximo pago</p>
                                    <p className="text-sm font-black text-text-light dark:text-text-dark">
                                        {nextPayoutDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}
                                    </p>
                                    <p className="text-xl font-black text-primary mt-1">€{pendingEarnings.toFixed(2)}</p>
                                    <p className="text-[8px] font-bold text-text-subtle-light uppercase tracking-tight mt-0.5">pendiente de cobro</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-2.5 bg-white/60 dark:bg-white/5 rounded-2xl p-3.5 border border-primary/10">
                                <Icon name="info" className="text-primary text-base mt-0.5 flex-shrink-0" filled />
                                <p className="text-[10px] text-text-subtle-light leading-relaxed">
                                    Los <span className="font-black text-text-light dark:text-text-dark">días 1 y 15 de cada mes</span> transferimos automáticamente el subtotal de tus ventas completadas a tu IBAN registrado. Este margen de 15 días permite gestionar posibles devoluciones. El dinero estará disponible en <span className="font-black text-text-light dark:text-text-dark">1–2 días hábiles</span>.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {displayedOrders.length === 0 ? (
                    <div className="text-center py-20">
                        <Icon name={isCollab ? "receipt_long" : "shopping_bag"} className="text-6xl text-text-subtle-light mb-4" />
                        <p className="text-text-subtle-light font-bold italic">Sin actividad reciente.</p>
                    </div>
                ) : (
                    displayedOrders.map(order => {
                        const myItems = isCollab ? order.items.filter(i => i.product.storeId === user.storeId) : order.items;
                        const isReturned = order.status === 'Devuelto' || order.status === 'Cancelado';
                        const isExpanded = expandedHistory[order.id] || false;

                        const productSum = myItems.reduce((acc, i) => acc + (i.product.price * i.quantity), 0);
                        const collabPayout = isCollab
                            ? (productSum >= FREE_SHIPPING_THRESHOLD ? productSum : productSum + SHIPPING_FEE)
                            : productSum;

                        const orderDate = new Date(order.date);
                        const now = new Date();
                        const diffInDays = (now.getTime() - orderDate.getTime()) / (1000 * 3600 * 24);
                        const isEligibleForReturn = !isCollab && order.status === 'Completado' && diffInDays < 14;

                        const orderInvoice = invoices.find(inv => inv.orderId === order.id && inv.recipientType === (isCollab ? 'collaborator' : 'customer'));

                        // Return request associated with this order
                        const returnReq = getReturnForOrder(order.id);
                        const hasActiveReturn = !!returnReq && returnReq.status !== 'completado' && returnReq.status !== 'rechazado';
                        const hasChat = returnReq?.type === 'error_tara' && (returnReq.status === 'pendiente' || returnReq.status === 'acordado');
                        // Collaborator ID from the store linked to the first item
                        const orderStoreId = order.items[0]?.product?.storeId;
                        const orderStore = stores.find(s => s.id === orderStoreId);
                        const collaboratorId = orderStore?.ownerId ?? '';

                        return (
                            <div key={order.id} className={`bg-white dark:bg-accent-dark rounded-3xl border p-6 shadow-sm space-y-4 transition-all ${isReturned ? 'opacity-60 grayscale-[0.3] border-red-200 dark:border-red-900/20' : 'border-border-light dark:border-border-dark hover:border-primary/30'}`}>

                                {isReturned && (
                                    <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 p-3 rounded-2xl mb-2 border border-red-100 dark:border-red-900/20">
                                        <Icon name={order.status === 'Cancelado' ? 'cancel' : 'assignment_return'} className="text-sm" filled />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Contabilidad: Venta Anulada</span>
                                    </div>
                                )}

                                {/* Banners de devolución tipada */}
                                {returnReq && returnReq.status === 'acordado' && !isReturned && (
                                    <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/20 rounded-2xl p-3 space-y-1">
                                        <p className="text-[10px] font-black text-green-700 dark:text-green-400 uppercase tracking-widest">Devolución acordada</p>
                                        {returnReq.type === 'desistimiento' ? (
                                            <p className="text-[10px] text-green-600 dark:text-green-300">Reembolso estimado: <strong>€{returnReq.refundAmount?.toFixed(2)}</strong> · Lleva el artículo a tu empresa de transporte para devolverlo</p>
                                        ) : (
                                            <p className="text-[10px] text-green-600 dark:text-green-300">Reembolso al cliente: <strong>€{returnReq.refundAmount?.toFixed(2)} (100%)</strong>{isCollab ? ` · Cargo a tu payout: €${returnReq.collaboratorCharge?.toFixed(2)}` : ''}</p>
                                        )}
                                    </div>
                                )}

                                {returnReq && returnReq.status === 'rechazado' && (
                                    <div className="bg-gray-50 dark:bg-gray-900/10 border border-gray-200 rounded-2xl p-3">
                                        <p className="text-[10px] font-bold text-gray-600">La reclamación de error fue rechazada por el colaborador.</p>
                                    </div>
                                )}

                                {returnReq && returnReq.type === 'error_tara' && returnReq.status === 'pendiente' && (
                                    <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/20 rounded-2xl p-3 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-amber-500 text-base">chat</span>
                                        <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400">{isCollab ? 'El cliente ha reportado una incidencia. Revisa el chat.' : 'Disputa en curso. El colaborador debe responder.'}</p>
                                    </div>
                                )}

                                <div className="flex justify-between items-start border-b border-border-light dark:border-border-dark pb-4">
                                    <div>
                                        <h3 className="font-black text-sm uppercase tracking-wider">{isCollab ? `Venta #${order.id.split('-')[1]}` : `Pedido #${order.id.split('-')[1]}`}</h3>
                                        <p className="text-[10px] text-text-subtle-light font-bold uppercase mt-1">{new Date(order.date).toLocaleDateString()}</p>
                                    </div>
                                    <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${order.status === 'Nuevo' ? 'bg-primary/10 text-primary' :
                                        order.status === 'Completado' ? 'bg-green-500/10 text-green-600' :
                                            order.status === 'Devolución Solicitada' ? 'bg-purple-100 text-purple-700' :
                                                order.status === 'Devuelto' || order.status === 'Cancelado' ? 'bg-gray-200 text-gray-600' :
                                                    'bg-gray-100 text-gray-500'
                                        }`}>{order.status}</span>
                                </div>

                                <div className="space-y-3">
                                    {myItems.map((item, idx) => (
                                        <div key={idx} className="flex items-center gap-3">
                                            <div className="size-10 rounded-lg bg-cover bg-center border border-border-light" style={{ backgroundImage: `url(${item.product.imageUrl})` }} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs font-bold text-text-light dark:text-text-dark truncate">{item.product.name}</p>
                                                <p className="text-[10px] text-text-subtle-light">{item.quantity} x €{item.product.price.toFixed(2)} {item.variant ? `• ${item.variant}` : ''}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Botones de trazabilidad y factura */}
                                <div className="pt-2 flex flex-wrap gap-2">
                                    <button
                                        onClick={() => toggleHistory(order.id)}
                                        className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.1em] text-primary/70 hover:text-primary transition-colors bg-primary/5 px-3 py-1.5 rounded-full"
                                    >
                                        <Icon name={isExpanded ? "unfold_less" : "history"} className="text-[12px]" filled={isExpanded} />
                                        {isExpanded ? "Ocultar trazabilidad" : "Ver historial de estados"}
                                    </button>

                                    {orderInvoice && (
                                        <button
                                            onClick={() => setActiveInvoice(orderInvoice)}
                                            className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.1em] text-green-600 hover:text-green-700 transition-colors bg-green-500/10 px-3 py-1.5 rounded-full"
                                        >
                                            <Icon name="receipt_long" className="text-[12px]" filled />
                                            Ver factura
                                        </button>
                                    )}

                                    {hasChat && returnReq && (
                                        <button
                                            onClick={() => setChatReturn({ returnRequest: returnReq, order })}
                                            className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.1em] text-amber-600 hover:text-amber-700 transition-colors bg-amber-500/10 px-3 py-1.5 rounded-full"
                                        >
                                            <span className="material-symbols-outlined text-[12px]">chat</span>
                                            {returnReq.status === 'pendiente' ? 'Chat – Disputa' : 'Ver chat'}
                                        </button>
                                    )}

                                    {isExpanded && (
                                        <div className="w-full animate-fade-in border-t border-border-light dark:border-border-dark mt-1 pt-1">
                                            <OrderTimeline history={order.history} initialDate={order.date} />
                                        </div>
                                    )}
                                </div>

                                <div className="flex justify-between items-center pt-4 border-t border-border-light dark:border-border-dark">
                                    <div className="flex flex-col">
                                        <span className="text-xs font-bold text-text-subtle-light uppercase">
                                            {isCollab ? `Cliente: ${order.customerName}` : `${order.items.length} artículos`}
                                        </span>
                                        <p className={`text-xl font-black ${isReturned ? 'text-text-subtle-light line-through' : 'text-primary'}`}>
                                            €{(isCollab && productSum < FREE_SHIPPING_THRESHOLD ? productSum + SHIPPING_FEE : productSum).toFixed(2)}
                                        </p>
                                    </div>

                                    {!isCollab && (
                                        <div className="flex flex-col gap-2">
                                            {order.status === 'En Proceso' && (
                                                <button
                                                    onClick={() => handleConfirmReceipt(order.id)}
                                                    className="bg-primary text-white h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-transform flex items-center justify-center gap-1 shadow-md shadow-primary/20"
                                                >
                                                    <Icon name="verified" className="text-sm" filled />
                                                    He recibido mi pedido
                                                </button>
                                            )}

                                            {isEligibleForReturn && !hasActiveReturn && (
                                                <button
                                                    onClick={() => handleRequestReturn(order)}
                                                    className="bg-red-500/10 text-red-500 border border-red-500/20 h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-transform flex items-center justify-center gap-1"
                                                >
                                                    <Icon name="assignment_return" className="text-sm" />
                                                    Solicitar Devolución
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {isCollab && order.status === 'Nuevo' && (
                                    <div className="flex gap-2 mt-2">
                                        <button
                                            onClick={() => handleAcceptOrder(order.id)}
                                            className="flex-1 h-12 bg-primary text-white font-black uppercase tracking-widest rounded-2xl shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2"
                                        >
                                            <Icon name="check_circle" className="text-white" filled />
                                            Aceptar y Enviar
                                        </button>
                                        <button
                                            onClick={() => handleCancelOrder(order.id)}
                                            className="px-4 h-12 bg-red-500/10 text-red-500 font-black uppercase tracking-widest rounded-2xl border border-red-500/20 active:scale-95 transition-all flex items-center justify-center"
                                        >
                                            <Icon name="cancel" className="text-sm" />
                                        </button>
                                    </div>
                                )}

                                {/* Etiqueta de envío — colaborador */}
                                {isCollab && order.status === 'En Proceso' && order.shippingLabelUrl && (
                                    <div className="mt-2 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/20 rounded-2xl p-3 space-y-2">
                                        <p className="text-[10px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest">Etiqueta lista</p>
                                        {order.trackingNumber && (
                                            <p className="text-[10px] text-emerald-600 dark:text-emerald-300">Tracking: <strong>{order.trackingNumber}</strong> · {order.carrier}</p>
                                        )}
                                        <a
                                            href={order.shippingLabelUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 h-9 px-4 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest active:scale-95 transition-transform w-fit"
                                        >
                                            <Icon name="print" className="text-sm" />
                                            Descargar etiqueta PDF
                                        </a>
                                    </div>
                                )}

                                {/* Tracking — cliente */}
                                {!isCollab && order.trackingNumber && order.status === 'En Proceso' && (
                                    <div className="mt-2 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/20 rounded-2xl p-3 space-y-1">
                                        <p className="text-[10px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest">Tu pedido está en camino</p>
                                        <p className="text-[10px] text-blue-600 dark:text-blue-300">Tracking: <strong>{order.trackingNumber}</strong> · {order.carrier}</p>
                                    </div>
                                )}

                                {isCollab && order.status === 'Devolución Solicitada' && (
                                    <button
                                        onClick={() => handleConfirmReception(order.id)}
                                        className="w-full min-h-[64px] py-3 px-6 mt-3 bg-gradient-to-r from-green-600 to-emerald-500 text-white font-black uppercase rounded-2xl shadow-xl shadow-green-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-4 border-b-4 border-green-800/30"
                                    >
                                        <Icon name="assignment_turned_in" className="text-white text-2xl" filled />
                                        <div className="flex flex-col items-start">
                                            <span className="text-[11px] leading-none tracking-tight">Confirmar Producto Recibido</span>
                                            <span className="text-[9px] opacity-70 tracking-widest mt-0.5">(CERRAR DEVOLUCIÓN)</span>
                                        </div>
                                    </button>
                                )}
                            </div>
                        );
                    })
                )}
                {/* Historial de pagos recibidos */}
                {isCollab && payouts.length > 0 && (
                    <div className="mt-6">
                        <p className="text-[10px] font-black uppercase tracking-widest text-text-subtle-light px-1 mb-3">Historial de Pagos</p>
                        <div className="space-y-2">
                            {payouts.map(payout => {
                                const statusConfig = {
                                    pending:    { label: 'Pendiente',      color: 'text-amber-500',  bg: 'bg-amber-50 dark:bg-amber-900/10',   icon: 'schedule' },
                                    processing: { label: 'Procesando',     color: 'text-blue-500',   bg: 'bg-blue-50 dark:bg-blue-900/10',     icon: 'sync' },
                                    completed:  { label: 'Transferido',    color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-900/10',   icon: 'check_circle' },
                                    failed:     { label: 'Error',          color: 'text-red-500',    bg: 'bg-red-50 dark:bg-red-900/10',       icon: 'error' },
                                }[payout.status];
                                return (
                                    <div key={payout.id} className="bg-white dark:bg-accent-dark rounded-2xl border border-border-light dark:border-border-dark p-4 flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className={`size-9 rounded-xl ${statusConfig.bg} flex items-center justify-center`}>
                                                <Icon name={statusConfig.icon} className={`text-base ${statusConfig.color}`} filled={payout.status === 'completed'} />
                                            </div>
                                            <div>
                                                <p className="text-xs font-black text-text-light dark:text-text-dark">
                                                    {new Date(payout.periodStart).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} – {new Date(payout.periodEnd).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                                                </p>
                                                <p className={`text-[9px] font-black uppercase tracking-widest mt-0.5 ${statusConfig.color}`}>
                                                    {statusConfig.label}
                                                </p>
                                            </div>
                                        </div>
                                        <p className={`text-lg font-black ${payout.status === 'completed' ? 'text-green-600' : 'text-primary'}`}>
                                            €{payout.grossAmount.toFixed(2)}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </main>
        </div>

        {activeInvoice && (
            <InvoiceModal invoice={activeInvoice} onClose={() => setActiveInvoice(null)} />
        )}

        {returnModalOrder && (
            <ReturnRequestModal
                order={returnModalOrder}
                collaboratorId={stores.find(s => s.id === returnModalOrder.items[0]?.product?.storeId)?.ownerId ?? ''}
                onClose={() => setReturnModalOrder(null)}
                onSubmit={handleReturnSubmit}
            />
        )}

        {chatReturn && (
            <ReturnChatModal
                returnRequest={chatReturn.returnRequest}
                order={chatReturn.order}
                currentUserId={user.id ?? ''}
                isCollab={isCollab}
                onClose={() => setChatReturn(null)}
                onResolve={async (decision) => { await resolveReturnDispute(chatReturn.returnRequest.id, decision); }}
                fetchMessages={fetchReturnMessages}
                sendMessage={sendReturnMessage}
            />
        )}
        </>
    );
};

export const PaymentScreen: React.FC = () => {
    const navigate   = useNavigate();
    const stripe     = useStripe();
    const elements   = useElements();
    const { cartItems, clearCart } = useCart();
    const { addOrder, addMultiStoreOrder } = useOrders();
    const { stores } = useStores();
    const { user, paymentMethods, addPaymentMethod, useReferralBalance } = useUser();
    const { notify } = useNotifications();
    const [success, setSuccess]   = useState(false);
    const [loading, setLoading]   = useState(false);
    const [useReferral, setUseReferral] = useState(false);
    const [useSavedCard, setUseSavedCard] = useState(true);
    const [isDark, setIsDark]     = useState(false);
    const [shippingAddress, setShippingAddress] = useState({
        name: user.name ?? '', street: '', number: '', postalCode: '', city: '', province: '', phone: user.phone ?? '',
    });
    const setAddr = (field: string, val: string) => setShippingAddress(prev => ({ ...prev, [field]: val }));

    useEffect(() => {
        const check = () => setIsDark(document.documentElement.classList.contains('dark'));
        check();
        const observer = new MutationObserver(check);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    const subtotal     = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const isMultiStore = new Set(cartItems.map(i => i.product.storeId)).size > 1;

    // Para multi-tienda el envío se calcula por tienda independientemente
    const shippingCost = isMultiStore
        ? Object.values(cartItems.reduce((acc: Record<string, number>, item) => {
              const sid = item.product.storeId;
              acc[sid] = (acc[sid] ?? 0) + item.product.price * item.quantity;
              return acc;
          }, {}))
          .reduce((total: number, s: number) => total + (s >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE), 0)
        : subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;

    const freeShipping = shippingCost === 0;

    // Tarjeta guardada con PM de Stripe (real) o cualquier tarjeta guardada
    const savedCard    = paymentMethods.find(pm => pm.stripePaymentMethodId) ?? paymentMethods[0] ?? null;
    const hasSavedCard = !!savedCard;

    const referralDiscount = useReferral
        ? Math.min(subtotal + LOCALSHOP_FEE + shippingCost, user.referralBalance || 0)
        : 0;
    const finalTotal = Math.max(0, subtotal + LOCALSHOP_FEE + shippingCost - referralDiscount);

    const cardElementOptions = {
        style: {
            base: {
                fontSize:        '15px',
                color:           isDark ? '#F0F2F4' : '#6B7785',
                fontFamily:      'Inter, sans-serif',
                '::placeholder': { color: isDark ? '#94a3b8' : '#8E8E93' },
                iconColor:       '#c29b88',
            },
            invalid: { color: '#ef4444', iconColor: '#ef4444' },
        },
        hidePostalCode: true,
    };

    const handleConfirmPayment = async () => {
        if (!stripe || cartItems.length === 0) return;

        setLoading(true);
        try {
            // 1. Crear PaymentIntent en el servidor
            const intentRes = await fetch(`${SUPABASE_URL}/functions/v1/create-payment-intent`, {
                method:  'POST',
                headers: {
                    'Content-Type':  'application/json',
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({
                    amount:   Math.round(finalTotal * 100),
                    userId:   user.id,
                    // Si todos los items son de la misma tienda, pasar storeId para reparto automático
                    ...(new Set(cartItems.map((i: any) => i.product.storeId)).size === 1
                        ? { storeId: cartItems[0].product.storeId }
                        : {}),
                    // Pasar el PM de tarjeta guardada para que el servidor lo adjunte al Customer
                    ...(hasSavedCard && useSavedCard && savedCard.stripePaymentMethodId
                        ? { paymentMethodId: savedCard.stripePaymentMethodId }
                        : {}),
                    metadata: { customerId: user.id },
                }),
            });
            const { clientSecret, error: intentError } = await intentRes.json();
            if (intentError) throw new Error(intentError);

            // 2. Confirmar pago
            let result;
            let savedPmAfterPayment: { id: string; last4: string; brand: string; expiry: string } | null = null;

            if (hasSavedCard && useSavedCard && savedCard.stripePaymentMethodId) {
                // Usar tarjeta guardada (ya tokenizada por Stripe)
                result = await stripe.confirmCardPayment(clientSecret, {
                    payment_method: savedCard.stripePaymentMethodId,
                });
            } else {
                // Crear PM primero para obtener detalles de la tarjeta, luego confirmar
                const cardElement = elements?.getElement(CardElement);
                if (!cardElement) throw new Error('No se pudo inicializar el elemento de pago');

                const { paymentMethod: pm, error: pmError } = await stripe.createPaymentMethod({
                    type:            'card',
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    card:            cardElement as any,
                    billing_details: { name: user.name },
                });
                if (pmError) throw new Error(pmError.message);

                if (pm?.card) {
                    savedPmAfterPayment = {
                        id:     pm.id,
                        last4:  pm.card.last4,
                        brand:  pm.card.brand.charAt(0).toUpperCase() + pm.card.brand.slice(1),
                        expiry: `${String(pm.card.exp_month).padStart(2, '0')}/${String(pm.card.exp_year).slice(-2)}`,
                    };
                }

                result = await stripe.confirmCardPayment(clientSecret, {
                    payment_method: pm!.id,
                });
            }

            if (result.error) throw new Error(result.error.message);

            const paymentIntent = result.paymentIntent;

            // 3. Guardar los detalles de la nueva tarjeta y adjuntarla al Customer de Stripe
            if (savedPmAfterPayment) {
                addPaymentMethod({
                    last4:                 savedPmAfterPayment.last4,
                    brand:                 savedPmAfterPayment.brand,
                    expiry:                savedPmAfterPayment.expiry,
                    holder:                user.name,
                    stripePaymentMethodId: savedPmAfterPayment.id,
                });
                // Adjuntar en Stripe para que se pueda reusar en próximos pagos
                fetch(`${SUPABASE_URL}/functions/v1/attach-buyer-payment-method`, {
                    method:  'POST',
                    headers: {
                        'Content-Type':  'application/json',
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    },
                    body: JSON.stringify({ userId: user.id, paymentMethodId: savedPmAfterPayment.id }),
                }).catch(() => { /* fallo silencioso — no bloquea el flujo */ });
            }

            // 4. Aplicar saldo de referidos y crear pedido
            if (referralDiscount > 0) useReferralBalance(referralDiscount);

            if (isMultiStore) {
                // Agrupar items por tienda para crear sub_orders
                type StoreGroup = { items: OrderItem[]; subtotal: number };
                const byStore: Record<string, StoreGroup> = {};
                for (const item of cartItems) {
                    const sid = item.product.storeId;
                    if (!byStore[sid]) byStore[sid] = { items: [], subtotal: 0 };
                    byStore[sid].items.push(item);
                    byStore[sid].subtotal += item.product.price * item.quantity;
                }

                const subOrders = Object.entries(byStore).map(([sid, data]) => ({
                    storeId:        sid,
                    collaboratorId: stores.find(s => s.id === sid)?.ownerId ?? '',
                    items:          data.items,
                    subtotal:       data.subtotal,
                    shippingFee:    data.subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE,
                }));

                await addMultiStoreOrder({
                    customerName:          user.name,
                    items:                 [...cartItems],
                    total:                 finalTotal,
                    shippingFee:           LOCALSHOP_FEE,
                    customerDeliveryFee:   shippingCost,
                    stripePaymentIntentId: paymentIntent?.id,
                    shippingAddress,
                }, subOrders);
            } else {
                await addOrder({
                    customerName:          user.name,
                    items:                 [...cartItems],
                    total:                 finalTotal,
                    shippingFee:           LOCALSHOP_FEE,
                    customerDeliveryFee:   shippingCost,
                    stripePaymentIntentId: paymentIntent?.id,
                    shippingAddress,
                });
            }

            setSuccess(true);
            notify('¡Pago realizado!', '¡Tu pedido ha sido procesado correctamente!', 'lock');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error al procesar el pago';
            notify('Error de pago', message, 'error');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                <div className="size-24 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                    <Icon name="check_circle" className="text-6xl text-primary" filled />
                </div>
                <h1 className="text-3xl font-black mb-2 text-text-light dark:text-text-dark">¡Pedido confirmado!</h1>
                <p className="text-text-subtle-light font-medium px-8 leading-relaxed">Tu compra se ha procesado con éxito. Las tiendas están preparando tus artículos.</p>
                <button onClick={() => navigate('/')} className="mt-12 px-10 py-4 bg-primary text-white font-bold rounded-2xl shadow-xl active:scale-95 transition-transform">Volver al Inicio</button>
            </div>
        );
    }

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen pb-24">
            <DetailHeader title="Finalizar Pedido" />
            <div className="p-4 space-y-6">
                {/* Resumen */}
                <div className="bg-white dark:bg-accent-dark p-6 rounded-[32px] border border-border-light dark:border-border-dark shadow-sm">
                    <h3 className="text-sm font-black uppercase tracking-widest text-text-subtle-light mb-4">Resumen del Pago</h3>
                    <div className="flex justify-between items-center py-2 border-b border-border-light/50">
                        <span className="text-sm font-bold text-text-light dark:text-text-dark">Subtotal</span>
                        <span className="text-sm font-bold text-text-light dark:text-text-dark">€{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="py-2 border-b border-border-light/50">
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-text-light dark:text-text-dark">Gastos de gestión</span>
                            <span className="text-sm font-bold text-text-light dark:text-text-dark">€{LOCALSHOP_FEE.toFixed(2)}</span>
                        </div>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border-light/50">
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-text-light dark:text-text-dark">Gastos de envío</span>
                            {freeShipping
                                ? <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black uppercase">Gestionado por el colaborador · Gratis</span>
                                : <span className="text-[10px] text-text-subtle-light">Tarifa para pedidos menores de €{FREE_SHIPPING_THRESHOLD}</span>
                            }
                        </div>
                        {freeShipping
                            ? <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">Gratis</span>
                            : <span className="text-sm font-bold text-text-light dark:text-text-dark">€{SHIPPING_FEE.toFixed(2)}</span>
                        }
                    </div>

                    {/* Saldo de referidos */}
                    {user.referralBalance > 0 && (
                        <div className="py-4 border-b border-border-light/50">
                            <label className="flex items-center justify-between cursor-pointer group">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-text-light dark:text-text-dark">Usar mi saldo de referidos</span>
                                    <span className="text-[10px] font-black uppercase text-primary">Disponible: €{user.referralBalance.toFixed(2)}</span>
                                </div>
                                <div className="relative inline-flex items-center">
                                    <input type="checkbox" checked={useReferral} onChange={e => setUseReferral(e.target.checked)} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-gray-200 rounded-full peer dark:bg-background-dark peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
                                </div>
                            </label>
                            {useReferral && (
                                <div className="flex justify-between items-center mt-3 animate-fade-in text-primary font-black">
                                    <span className="text-xs uppercase">Descuento aplicado</span>
                                    <span className="text-sm">-€{referralDiscount.toFixed(2)}</span>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="flex justify-between items-center pt-4">
                        <span className="text-lg font-black text-text-light dark:text-text-dark">Total a pagar</span>
                        <span className="text-xl font-black text-primary">€{finalTotal.toFixed(2)}</span>
                    </div>
                </div>

                {/* Dirección de entrega */}
                <div className="bg-white dark:bg-accent-dark p-6 rounded-[32px] border border-border-light dark:border-border-dark shadow-sm space-y-3">
                    <h3 className="text-sm font-black uppercase tracking-widest text-text-subtle-light mb-2">Dirección de Entrega</h3>
                    <input
                        value={shippingAddress.name}
                        onChange={e => setAddr('name', e.target.value)}
                        placeholder="Nombre completo del destinatario"
                        className="w-full h-11 px-4 rounded-xl border border-border-light dark:border-border-dark bg-accent-light dark:bg-background-dark text-sm font-medium text-text-light dark:text-text-dark outline-none focus:border-primary"
                    />
                    <div className="flex gap-2">
                        <input
                            value={shippingAddress.street}
                            onChange={e => setAddr('street', e.target.value)}
                            placeholder="Calle"
                            className="flex-1 h-11 px-4 rounded-xl border border-border-light dark:border-border-dark bg-accent-light dark:bg-background-dark text-sm font-medium text-text-light dark:text-text-dark outline-none focus:border-primary"
                        />
                        <input
                            value={shippingAddress.number}
                            onChange={e => setAddr('number', e.target.value)}
                            placeholder="Nº"
                            className="w-20 h-11 px-3 rounded-xl border border-border-light dark:border-border-dark bg-accent-light dark:bg-background-dark text-sm font-medium text-text-light dark:text-text-dark outline-none focus:border-primary"
                        />
                    </div>
                    <div className="flex gap-2">
                        <input
                            value={shippingAddress.postalCode}
                            onChange={e => setAddr('postalCode', e.target.value)}
                            placeholder="C.P."
                            maxLength={5}
                            className="w-24 h-11 px-3 rounded-xl border border-border-light dark:border-border-dark bg-accent-light dark:bg-background-dark text-sm font-medium text-text-light dark:text-text-dark outline-none focus:border-primary"
                        />
                        <input
                            value={shippingAddress.city}
                            onChange={e => setAddr('city', e.target.value)}
                            placeholder="Ciudad"
                            className="flex-1 h-11 px-4 rounded-xl border border-border-light dark:border-border-dark bg-accent-light dark:bg-background-dark text-sm font-medium text-text-light dark:text-text-dark outline-none focus:border-primary"
                        />
                    </div>
                    <input
                        value={shippingAddress.province}
                        onChange={e => setAddr('province', e.target.value)}
                        placeholder="Provincia"
                        className="w-full h-11 px-4 rounded-xl border border-border-light dark:border-border-dark bg-accent-light dark:bg-background-dark text-sm font-medium text-text-light dark:text-text-dark outline-none focus:border-primary"
                    />
                    <input
                        value={shippingAddress.phone}
                        onChange={e => setAddr('phone', e.target.value)}
                        placeholder="Teléfono de contacto"
                        className="w-full h-11 px-4 rounded-xl border border-border-light dark:border-border-dark bg-accent-light dark:bg-background-dark text-sm font-medium text-text-light dark:text-text-dark outline-none focus:border-primary"
                    />
                </div>

                {/* Método de Pago */}
                <div className="bg-white dark:bg-accent-dark p-6 rounded-[32px] border border-border-light dark:border-border-dark shadow-sm space-y-4">
                    <h3 className="text-sm font-black uppercase tracking-widest text-text-subtle-light mb-2">Método de Pago</h3>

                    {hasSavedCard && (
                        <div
                            className={`flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition-all ${useSavedCard ? 'bg-primary/5 border-primary/30' : 'bg-accent-light dark:bg-background-dark border-border-light dark:border-border-dark'}`}
                            onClick={() => setUseSavedCard(true)}
                        >
                            <Icon name="credit_card" className="text-primary" />
                            <div className="flex-1">
                                <p className="text-sm font-bold text-text-light dark:text-text-dark">{savedCard.brand} •••• {savedCard.last4}</p>
                                <p className="text-[10px] font-bold text-text-subtle-light uppercase">Vence {savedCard.expiry}</p>
                            </div>
                            {useSavedCard && <Icon name="check_circle" className="text-green-500" filled />}
                        </div>
                    )}

                    {hasSavedCard && (
                        <button
                            className="text-xs font-black uppercase tracking-widest text-primary/70"
                            onClick={() => setUseSavedCard(false)}
                        >
                            {useSavedCard ? 'Usar otra tarjeta' : 'Cancelar'}
                        </button>
                    )}

                    {(!hasSavedCard || !useSavedCard) && (
                        <div className="space-y-3">
                            <div className="border border-border-light dark:border-border-dark rounded-xl px-4 py-3.5 bg-white dark:bg-accent-dark">
                                <CardElement options={cardElementOptions} />
                            </div>
                            <p className="text-[10px] text-text-subtle-light italic leading-tight">
                                Tu tarjeta se guardará de forma segura para futuras compras.
                            </p>
                        </div>
                    )}
                </div>

                <div className="bg-primary/5 border border-primary/20 p-5 rounded-2xl flex gap-4 items-center">
                    <Icon name="verified_user" className="text-primary text-2xl" />
                    <p className="text-[10px] font-bold text-primary/80 leading-relaxed flex-1">
                        Pago 100% seguro procesado por <span className="font-black">Stripe</span>. Tus datos de tarjeta están cifrados y nunca pasan por nuestros servidores.
                    </p>
                </div>

                <button
                    onClick={handleConfirmPayment}
                    disabled={loading || !stripe}
                    className="w-full h-16 bg-primary text-white font-bold rounded-2xl shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-3 text-lg disabled:opacity-60"
                >
                    {loading
                        ? <span className="animate-spin material-symbols-outlined">progress_activity</span>
                        : <><Icon name="lock" /> Confirmar Pago — €{finalTotal.toFixed(2)}</>
                    }
                </button>
            </div>
        </div>
    );
};

export const PurchaseHistoryScreen: React.FC = () => <Placeholder title="Historial" backTo="/profile" />;

export const CollaboratorRegistrationScreen: React.FC = () => <Placeholder title="Registro de Colaborador" />;

export const PaymentMethodsScreen: React.FC = () => {
    const navigate = useNavigate();
    const { notify } = useNotifications();
    const { paymentMethods, removePaymentMethod, user } = useUser();
    const { stores, updateStore } = useStores();
    const isCollab = user.role === 'colaborador';
    const currentStore = isCollab ? stores.find(s => s.id === user.storeId) : null;

    const location = useLocation();

    const [connectLoading, setConnectLoading] = useState(false);
    const [verifyLoading, setVerifyLoading] = useState(false);

    // Detectar retorno del onboarding de Stripe Connect
    useEffect(() => {
        if (location.search.includes('connect=success') && currentStore?.id) {
            handleVerifyConnectStatus();
        }
    }, [currentStore?.id]);

    const handleStripeConnect = async () => {
        const storeId = currentStore?.id ?? user.storeId;
        if (!storeId || !user.email) return;
        setConnectLoading(true);
        try {
            const res = await fetch(`${SUPABASE_URL}/functions/v1/create-connect-account`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
                body: JSON.stringify({
                    storeId,
                    email:     user.email,
                    returnUrl: `${window.location.protocol}//${window.location.host}/#`,
                }),
            });
            const { onboardingUrl, error } = await res.json();
            if (error) throw new Error(error);
            window.location.href = onboardingUrl;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error al conectar con Stripe';
            notify('Error', message, 'error');
            setConnectLoading(false);
        }
    };

    const handleVerifyConnectStatus = async () => {
        if (!currentStore?.id) return;
        setVerifyLoading(true);
        try {
            const res = await fetch(`${SUPABASE_URL}/functions/v1/check-connect-status`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
                body: JSON.stringify({ storeId: currentStore.id }),
            });
            const { onboarded, error } = await res.json();
            if (error) throw new Error(error);
            if (onboarded) {
                await updateStore(currentStore.id, { stripeConnectOnboarded: true });
                notify('¡Cuenta conectada!', 'Tu cuenta de Stripe está verificada. Ya puedes publicar artículos.', 'check_circle');
            } else {
                notify('Pendiente', 'Tu cuenta de Stripe aún no está verificada. Completa el proceso en Stripe.', 'info');
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error al verificar estado';
            notify('Error', message, 'error');
        } finally {
            setVerifyLoading(false);
        }
    };

    const [disconnectLoading, setDisconnectLoading] = useState(false);
    const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

    const handleDisconnectStripe = () => setShowDisconnectConfirm(true);

    const confirmDisconnect = async () => {
        if (!currentStore?.id) return;
        setDisconnectLoading(true);
        setShowDisconnectConfirm(false);
        try {
            await supabase
                .from('stores')
                .update({ stripe_connect_onboarded: false, stripe_connect_account_id: null })
                .eq('id', currentStore.id);
            await updateStore(currentStore.id, { stripeConnectOnboarded: false, stripeConnectAccountId: undefined });
            notify('Cuenta desconectada', 'Tu cuenta Stripe ha sido desvinculada. Puedes conectar una nueva cuando quieras.', 'info');
        } catch {
            notify('Error', 'No se pudo desconectar la cuenta.', 'error');
        } finally {
            setDisconnectLoading(false);
        }
    };

    const [loginLinkLoading, setLoginLinkLoading] = useState(false);
    const handleOpenStripeDashboard = async () => {
        if (!currentStore?.id) return;
        setLoginLinkLoading(true);
        try {
            const res = await fetch(`${SUPABASE_URL}/functions/v1/create-login-link`, {
                method:  'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
                body: JSON.stringify({ storeId: currentStore.id }),
            });
            const { url, error } = await res.json();
            if (error) throw new Error(error);
            window.open(url, '_blank');
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error al abrir Stripe';
            notify('Error', message, 'error');
        } finally {
            setLoginLinkLoading(false);
        }
    };

    if (!isCollab) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen pb-24">
                <DetailHeader title="Métodos de Pago" backTo="/profile" />
                <main className="p-4 space-y-6 animate-fade-in">
                    <div className="bg-primary/5 border border-primary/20 p-5 rounded-[24px] flex gap-4 items-start">
                        <Icon name="verified_user" className="text-primary text-2xl shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <h4 className="font-black text-sm text-primary">Pagos seguros con Stripe</h4>
                            <p className="text-xs text-text-subtle-light leading-relaxed">
                                Tus tarjetas se guardan automáticamente de forma segura cuando realizas un pago. LocalShop nunca almacena tus datos de tarjeta — todo está gestionado por Stripe.
                            </p>
                        </div>
                    </div>

                    {paymentMethods.length > 0 ? (
                        <div className="space-y-4">
                            <h3 className="text-xs font-black uppercase tracking-widest text-text-subtle-light px-1">Tus tarjetas guardadas</h3>
                            <div className="space-y-3">
                                {paymentMethods.map(card => (
                                    <div key={card.id} className="bg-white dark:bg-accent-dark p-4 rounded-2xl border border-border-light dark:border-border-dark flex items-center justify-between shadow-sm">
                                        <div className="flex items-center gap-4">
                                            <div className="size-10 bg-primary/10 rounded-lg flex items-center justify-center">
                                                <Icon name="credit_card" className="text-primary" />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-text-light dark:text-text-dark">{card.brand} •••• {card.last4}</p>
                                                <p className="text-[10px] font-bold text-text-subtle-light uppercase">Vence {card.expiry}</p>
                                                {card.stripePaymentMethodId && (
                                                    <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-black uppercase tracking-widest">Verificada por Stripe</p>
                                                )}
                                            </div>
                                        </div>
                                        <button onClick={() => removePaymentMethod(card.id)} className="text-red-400 p-2 active:scale-90 transition-transform">
                                            <Icon name="delete" className="text-xl" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white dark:bg-accent-dark p-6 rounded-[32px] border border-border-light dark:border-border-dark text-center space-y-3">
                            <Icon name="credit_card_off" className="text-4xl text-text-subtle-light" />
                            <p className="text-sm font-bold text-text-subtle-light">No tienes tarjetas guardadas</p>
                            <p className="text-xs text-text-subtle-light leading-relaxed">Realiza tu primer pedido y tu tarjeta se guardará automáticamente.</p>
                            <button onClick={() => navigate('/')} className="mt-2 px-6 py-2.5 bg-primary text-white text-xs font-black uppercase tracking-wider rounded-xl active:scale-95 transition-transform">
                                Explorar productos
                            </button>
                        </div>
                    )}
                </main>
            </div>
        );
    }

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen pb-24">
            <DetailHeader title="Configuración de Cobros" backTo="/profile" />
            <main className="p-4 space-y-6 animate-fade-in">

                {/* Bloque Stripe Connect */}
                <div className={`p-5 rounded-[24px] border shadow-sm ${currentStore?.stripeConnectOnboarded ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-white dark:bg-accent-dark border-border-light dark:border-border-dark'}`}>
                    <div className="flex items-start gap-4">
                        <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${currentStore?.stripeConnectOnboarded ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-primary/10'}`}>
                            <Icon name={currentStore?.stripeConnectOnboarded ? 'verified' : 'account_balance_wallet'} className={currentStore?.stripeConnectOnboarded ? 'text-emerald-600 dark:text-emerald-400' : 'text-primary'} />
                        </div>
                        <div className="flex-1 space-y-1">
                            <h4 className={`font-black text-sm ${currentStore?.stripeConnectOnboarded ? 'text-emerald-700 dark:text-emerald-400' : 'text-text-light dark:text-text-dark'}`}>
                                {currentStore?.stripeConnectOnboarded ? 'Cuenta de pagos activa' : 'Conecta tu cuenta de pagos'}
                            </h4>
                            <p className="text-xs text-text-subtle-light leading-relaxed">
                                {currentStore?.stripeConnectOnboarded
                                    ? 'Tu cuenta Stripe Connect está verificada. Los pagos de tus ventas se transferirán automáticamente.'
                                    : 'Conecta tu cuenta bancaria vía Stripe para recibir los ingresos de tus ventas de forma automática y segura.'}
                            </p>
                        </div>
                    </div>
                    {currentStore?.stripeConnectOnboarded ? (
                        <div className="mt-4 flex gap-3">
                            <button
                                onClick={handleOpenStripeDashboard}
                                disabled={loginLinkLoading}
                                className="flex-1 h-12 rounded-xl border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 text-sm font-black uppercase tracking-wider active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                            >
                                {loginLinkLoading
                                    ? <span className="animate-spin material-symbols-outlined text-lg">progress_activity</span>
                                    : <><Icon name="manage_accounts" className="text-lg" /> Cambiar IBAN</>
                                }
                            </button>
                            <button
                                onClick={handleDisconnectStripe}
                                className="h-12 px-4 rounded-xl border border-red-200 dark:border-red-800 text-red-500 active:scale-95 transition-all flex items-center justify-center"
                                title="Desconectar cuenta Stripe"
                            >
                                <Icon name="link_off" className="text-lg" />
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={handleStripeConnect}
                            disabled={connectLoading}
                            className="mt-4 w-full h-12 rounded-xl bg-primary text-white text-sm font-black uppercase tracking-wider shadow active:scale-95 transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                            {connectLoading
                                ? <span className="animate-spin material-symbols-outlined text-lg">progress_activity</span>
                                : <><Icon name="open_in_new" className="text-lg" /> Configurar pagos con Stripe</>
                            }
                        </button>
                    )}
                </div>

                <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 p-5 rounded-[24px] flex gap-4 items-start">
                    <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon name="info" className="text-primary text-xl" />
                    </div>
                    <div className="space-y-1">
                        <h4 className="font-black text-sm text-primary">Depósitos Directos</h4>
                        <p className="text-xs text-text-subtle-light dark:text-text-subtle-dark leading-relaxed">
                            Stripe transfiere automáticamente el importe de tus ventas a la cuenta bancaria que configures. Puedes cambiarla en cualquier momento desde el botón <span className="font-black">"Cambiar IBAN"</span>.
                        </p>
                    </div>
                </div>

                {/* Verificar estado si tiene cuenta pero no onboarded */}
                {currentStore?.stripeConnectAccountId && !currentStore?.stripeConnectOnboarded && (
                    <button
                        onClick={handleVerifyConnectStatus}
                        disabled={verifyLoading}
                        className="w-full h-12 rounded-2xl border border-primary/30 text-primary font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60"
                    >
                        {verifyLoading
                            ? <span className="animate-spin material-symbols-outlined text-lg">progress_activity</span>
                            : <><Icon name="refresh" className="text-lg" /> Verificar estado de Stripe</>
                        }
                    </button>
                )}
            </main>

            {/* Modal confirmación desconexión */}
            {showDisconnectConfirm && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-accent-dark rounded-[32px] p-6 w-full max-w-sm space-y-4 shadow-2xl animate-fade-in">
                        <div className="flex items-center gap-3">
                            <div className="size-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                                <Icon name="link_off" className="text-red-500 text-xl" />
                            </div>
                            <div>
                                <h3 className="font-black text-sm text-text-light dark:text-white">¿Desconectar cuenta?</h3>
                                <p className="text-xs text-text-subtle-light">No podrás vender hasta volver a conectar Stripe.</p>
                            </div>
                        </div>
                        <p className="text-xs text-text-subtle-light leading-relaxed">
                            Tus ventas anteriores no se verán afectadas. Podrás conectar una cuenta bancaria diferente en cualquier momento.
                        </p>
                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setShowDisconnectConfirm(false)}
                                className="flex-1 h-12 rounded-xl border border-border-light dark:border-border-dark text-sm font-bold text-text-subtle-light active:scale-95 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDisconnect}
                                disabled={disconnectLoading}
                                className="flex-1 h-12 rounded-xl bg-red-500 text-white text-sm font-black uppercase tracking-wider active:scale-95 transition-all disabled:opacity-60"
                            >
                                {disconnectLoading ? '...' : 'Desconectar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export const EditCustomerProfileScreen: React.FC = () => {
    const { user, updateUser } = useUser();
    const { updateStore, stores } = useStores();
    const navigate = useNavigate();
    const { notify } = useNotifications();
    const isCollab = user.role === 'colaborador';

    const currentStore = useMemo(() => isCollab ? stores.find(s => s.id === user.storeId) : null, [stores, isCollab, user.storeId]);

    const [formData, setFormData] = useState({
        displayName: user.name || '',
        businessName: isCollab ? (currentStore?.businessName || '') : '',
        displayLocation: isCollab ? (currentStore?.address || '') : (user.location || ''),
        displayBio: isCollab ? (currentStore?.description || '') : (user.bio || ''),
        category: currentStore?.category || 'Multimarca',
        cif: currentStore?.cif || '',
        email: user.email || '',
        phone: user.phone || '',
        addressStreet:     isCollab ? (currentStore?.addressStreet     || '') : '',
        addressNumber:     isCollab ? (currentStore?.addressNumber     || '') : '',
        addressPostalCode: isCollab ? (currentStore?.addressPostalCode || '') : '',
        addressCity:       isCollab ? (currentStore?.addressCity       || '') : '',
        addressProvince:   isCollab ? (currentStore?.addressProvince   || '') : '',
    });

    const [avatar, setAvatar] = useState<string | null>(isCollab ? null : (user.avatar || null));
    const [showSourceModal, setShowSourceModal] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);

    const handleFileProcess = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (isCollab) return; // Seguridad extra
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatar(reader.result as string);
                setShowSourceModal(false);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (formData.email) {
            const emailErr = validateEmail(formData.email);
            if (emailErr) { notify('Error', emailErr, 'error'); return; }
        }
        if (formData.phone) {
            const phoneErr = validatePhone(formData.phone);
            if (phoneErr) { notify('Error', phoneErr, 'error'); return; }
        }
        if (!isCollab && formData.displayName) {
            const nameErr = validateName(formData.displayName);
            if (nameErr) { notify('Error', nameErr, 'error'); return; }
        }

        if (isCollab && user.storeId) {
            updateStore(user.storeId, {
                businessName:    sanitizeRaw(formData.businessName),
                address:         sanitizeRaw(formData.displayLocation),
                category:        formData.category,
                description:     sanitizeRaw(formData.displayBio),
                cif:             sanitizeRaw(formData.cif),
                addressStreet:     sanitizeRaw(formData.addressStreet),
                addressNumber:     sanitizeRaw(formData.addressNumber),
                addressPostalCode: sanitizeRaw(formData.addressPostalCode),
                addressCity:       sanitizeRaw(formData.addressCity),
                addressProvince:   formData.addressProvince,
                addressCountry:    'ES',
            });
            updateUser({
                email: sanitizeRaw(formData.email),
                phone: sanitizeRaw(formData.phone)
            });
            notify('Negocio Actualizado', 'Los datos de tu empresa se han guardado.', 'check_circle');
        } else {
            updateUser({
                name: sanitizeRaw(formData.displayName),
                avatar: avatar || undefined,
                bio: sanitizeRaw(formData.displayBio),
                location: sanitizeRaw(formData.displayLocation),
                email: sanitizeRaw(formData.email),
                phone: sanitizeRaw(formData.phone)
            });
            notify('Perfil Actualizado', 'Tus datos personales se han guardado.', 'check_circle');
        }
        navigate(-1);
    };

    const collaboratorCategories = [
        'Moda Deportiva',
        'Multimarca',
        'Ropa Interior y Lencería',
        'Moda de Baño',
        'Streetwear y Urbana',
        'Ropa de Trabajo',
        'Ceremonia y Eventos',
        'Moda Sostenible',
        'Moda vintage',
        'Moda de autor',
        'Calzado',
        'Joyería/bisutería',
        'Bolsos',
        'Accesorios',
        'Otros'
    ];

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen pb-24">
            <span className="sr-only">Edit Profile</span>
            <DetailHeader title={isCollab ? "Datos de Empresa" : "Datos Personales"} backTo="/profile" />
            <form onSubmit={handleSubmit} className="p-4 space-y-6 animate-fade-in">
                <div className="flex flex-col items-center">
                    {isCollab ? (
                        <div className="size-32 rounded-[40px] bg-white border-4 border-white dark:border-accent-dark shadow-xl flex flex-col items-center justify-center text-primary overflow-hidden relative border border-primary/20">
                            <Identicon seed={formData.displayName} className="w-full h-full" />
                        </div>
                    ) : (
                        <div onClick={() => setShowSourceModal(true)} className="size-32 rounded-[40px] bg-primary/10 border-4 border-white dark:border-accent-dark shadow-2xl flex items-center justify-center text-primary text-5xl font-black overflow-hidden relative cursor-pointer active:scale-95 transition-transform">
                            {avatar ? <img src={avatar} className="w-full h-full object-cover" alt="Avatar" /> : formData.displayName.charAt(0)}
                            <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                <Icon name="photo_camera" className="text-white text-2xl" />
                            </div>
                        </div>
                    )}
                    <p className="text-[10px] font-black text-text-subtle-light uppercase mt-4 text-center">
                        {isCollab ? "Sistemas de Identicones (Basado en ID)" : "Foto de Perfil"}
                    </p>
                    {isCollab && (
                        <p className="text-[8px] font-bold text-primary/60 uppercase mt-1 px-8 text-center leading-tight">
                            Por seguridad y anonimato, tu imagen comercial es un patrón geométrico único derivado de tu ID.
                        </p>
                    )}
                </div>

                {!isCollab && (
                    <>
                        <input type="file" ref={cameraInputRef} accept="image/*" capture="environment" className="hidden" onChange={handleFileProcess} />
                        <input type="file" ref={galleryInputRef} accept="image/*" className="hidden" onChange={handleFileProcess} />
                        {showSourceModal && (
                            <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-[4px]" onClick={() => setShowSourceModal(false)}>
                                <div className="w-[85%] max-sm max-w-sm bg-white dark:bg-accent-dark rounded-[40px] animate-slide-up pb-10 px-8 pt-6 shadow-2xl overflow-hidden border border-white/20" onClick={e => e.stopPropagation()}>
                                    <div className="w-12 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-8"></div>
                                    <h3 className="text-center text-lg font-black text-text-light dark:white mb-8 tracking-tight uppercase tracking-widest">Cambiar Imagen</h3>
                                    <div className="flex gap-4">
                                        <button type="button" onClick={() => cameraInputRef.current?.click()} className="flex-1 flex flex-col items-center gap-3 group">
                                            <div className="w-full aspect-square bg-accent-light dark:bg-background-dark/50 rounded-[28px] flex items-center justify-center border border-border-light dark:border-border-dark group-active:scale-90 transition-transform shadow-sm">
                                                <Icon name="photo_camera" className="text-3xl text-[#C29B88]" />
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-text-subtle-light">Hacer Foto</span>
                                        </button>
                                        <button type="button" onClick={() => galleryInputRef.current?.click()} className="flex-1 flex flex-col items-center gap-3 group">
                                            <div className="w-full aspect-square bg-accent-light dark:bg-background-dark/50 rounded-[28px] flex items-center justify-center border border-border-light dark:border-border-dark group-active:scale-90 transition-transform shadow-sm">
                                                <Icon name="image" className="text-3xl text-[#C29B88]" />
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-text-subtle-light">Galería</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}

                <div className="space-y-4 bg-white dark:bg-accent-dark p-6 rounded-[32px] border border-border-light dark:border-border-dark shadow-sm">
                    <FormInput
                        label={isCollab ? "ID Público Local (No editable)" : "Nombre Completo"}
                        value={formData.displayName}
                        onChange={(v: string) => setFormData(p => ({ ...p, displayName: truncate(sanitizeRaw(v), MAX_LENGTHS.name) }))}
                        disabled={isCollab}
                        required
                    />
                    {isCollab && (
                        <>
                            <FormInput label="Nombre Legal / Empresa (Privado)" placeholder="Nombre de la sociedad" value={formData.businessName} onChange={(v: string) => setFormData(p => ({ ...p, businessName: truncate(sanitizeRaw(v), MAX_LENGTHS.name) }))} required />
                            <FormInput label="CIF / NIF" placeholder="B-12345678" value={formData.cif} onChange={(v: string) => setFormData(p => ({ ...p, cif: truncate(sanitizeRaw(v), MAX_LENGTHS.cif) }))} required />
                            <div className="space-y-1.5 relative">
                                <label className="text-xs font-black uppercase tracking-widest text-text-light dark:text-text-dark opacity-70">Categoría</label>
                                <button
                                    type="button"
                                    onClick={() => setShowCategoryModal(true)}
                                    className="w-full h-12 bg-white dark:bg-accent-dark border border-border-light dark:border-border-dark rounded-xl px-4 text-sm font-bold text-text-light dark:text-white flex items-center justify-between"
                                >
                                    <span>{formData.category}</span>
                                    <Icon name="expand_more" className="text-text-subtle-light" />
                                </button>
                            </div>
                        </>
                    )}
                    {isCollab && (
                        <div className="space-y-3 pt-2 border-t border-border-light dark:border-border-dark">
                            <div className="flex items-center gap-2">
                                <Icon name="local_shipping" className="text-primary text-lg" />
                                <p className="text-xs font-black uppercase tracking-widest text-primary">Dirección de Recogida (Sendcloud)</p>
                            </div>
                            <p className="text-[10px] text-text-subtle-light dark:text-text-subtle-dark leading-relaxed">
                                Esta dirección se usa como remitente al generar etiquetas de envío automáticamente.
                            </p>
                            <FormInput
                                label="Calle"
                                placeholder="Calle Mayor"
                                value={formData.addressStreet}
                                onChange={(v: string) => setFormData(p => ({ ...p, addressStreet: truncate(sanitizeRaw(v), 100) }))}
                            />
                            <div className="grid grid-cols-3 gap-3">
                                <div className="col-span-1">
                                    <FormInput
                                        label="Número"
                                        placeholder="12"
                                        value={formData.addressNumber}
                                        onChange={(v: string) => setFormData(p => ({ ...p, addressNumber: truncate(sanitizeRaw(v), 20) }))}
                                    />
                                </div>
                                <div className="col-span-2">
                                    <FormInput
                                        label="Código Postal"
                                        placeholder="28001"
                                        value={formData.addressPostalCode}
                                        onChange={(v: string) => setFormData(p => ({ ...p, addressPostalCode: truncate(sanitizeRaw(v), 10) }))}
                                    />
                                </div>
                            </div>
                            <FormInput
                                label="Ciudad / Municipio"
                                placeholder="Madrid"
                                value={formData.addressCity}
                                onChange={(v: string) => setFormData(p => ({ ...p, addressCity: truncate(sanitizeRaw(v), 80) }))}
                            />
                            <div className="space-y-1.5 relative">
                                <label className="text-xs font-black uppercase tracking-widest text-text-light dark:text-text-dark opacity-70">Provincia</label>
                                <div className="relative">
                                    <Icon name="location_on" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-light/50 dark:text-text-dark/50" />
                                    <select
                                        value={formData.addressProvince}
                                        onChange={e => setFormData(p => ({ ...p, addressProvince: e.target.value }))}
                                        className="w-full h-12 bg-white dark:bg-accent-dark border border-border-light dark:border-border-dark rounded-xl pl-10 pr-10 text-sm font-bold text-text-light dark:text-white appearance-none cursor-pointer outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                    >
                                        <option value="" disabled>Selecciona la provincia</option>
                                        {SPANISH_PROVINCES.map(prov => (
                                            <option key={prov} value={prov}>{prov}</option>
                                        ))}
                                    </select>
                                    <Icon name="expand_more" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-light/50 dark:text-text-dark/50" />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-1.5 relative">
                        <label className="text-xs font-black uppercase tracking-widest text-text-light dark:text-text-dark opacity-70">Dirección Local (Provincia)</label>
                        <div className="relative">
                            <Icon name="location_on" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-light/50 dark:text-text-dark/50" />
                            <select
                                value={formData.displayLocation}
                                onChange={e => setFormData(p => ({ ...p, displayLocation: e.target.value }))}
                                className="w-full h-12 bg-white dark:bg-accent-dark border border-border-light dark:border-border-dark rounded-xl pl-10 pr-10 text-sm font-bold text-text-light dark:text-white appearance-none cursor-pointer outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                            >
                                <option value="" disabled>Selecciona la provincia</option>
                                {SPANISH_PROVINCES.map(prov => (
                                    <option key={prov} value={prov}>{prov}</option>
                                ))}
                            </select>
                            <Icon name="expand_more" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-light/50 dark:text-text-dark/50" />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-black uppercase tracking-widest text-text-light dark:text-text-dark opacity-70">{isCollab ? "Descripción Comercial" : "Biografía"}</label>
                        <textarea value={formData.displayBio} onChange={e => setFormData(p => ({ ...p, displayBio: truncate(sanitizeRaw(e.target.value), MAX_LENGTHS.bio) }))} className="w-full h-32 bg-white dark:bg-accent-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-3 text-sm font-medium resize-none outline-none text-text-light dark:text-white" placeholder={isCollab ? "Cuenta la historia de tu negocio..." : "Un poco sobre ti..."} />
                    </div>
                </div>

                {/* Modal de Categorías (Bottom Sheet) */}
                {showCategoryModal && (
                    <div className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-md flex items-end justify-center" onClick={() => setShowCategoryModal(false)}>
                        <div className="w-full max-w-lg bg-white dark:bg-accent-dark rounded-t-[40px] p-6 pb-12 animate-slide-up shadow-2xl max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
                            <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-6 shrink-0"></div>
                            <h3 className="text-center text-lg font-black text-text-light dark:text-white mb-6 tracking-tight uppercase tracking-widest">Seleccionar Categoría</h3>
                            <div className="overflow-y-auto space-y-2">
                                {collaboratorCategories.map(c => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => { setFormData(p => ({ ...p, category: c })); setShowCategoryModal(false); }}
                                        className={`w-full text-left p-5 rounded-2xl text-base font-bold transition-all ${formData.category === c ? 'bg-primary text-white shadow-lg' : 'bg-background-light dark:bg-background-dark text-text-light hover:bg-white dark:hover:bg-border-dark'}`}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                <div className="fixed bottom-0 left-0 right-0 p-4 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md border-t border-border-light dark:border-border-dark z-50">
                    <button type="submit" className="w-full h-16 bg-primary text-white font-bold rounded-2xl shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-3">
                        <Icon name="save" />
                        Guardar Cambios
                    </button>
                </div>
            </form>
        </div>
    );
};

// Fecha de lanzamiento oficial de la app — cambiar cuando se publique
const APP_LAUNCH_DATE = new Date('2026-04-09');
const LAUNCH_OFFER_END = new Date(APP_LAUNCH_DATE);
LAUNCH_OFFER_END.setMonth(LAUNCH_OFFER_END.getMonth() + 2);
const REGULAR_PRICE = 7.99;
const DISCOUNTED_PRICE = (REGULAR_PRICE * 0.5).toFixed(2); // 3,99€ de por vida

const isInLaunchPeriod = () => new Date() < LAUNCH_OFFER_END;

const GROUP_TO_CATEGORY: Record<string, string> = {
    'CAMISETAS': 'Camisetas', 'CAMISAS': 'Camisas', 'SUDADERAS': 'Sudaderas',
    'PANTALONES': 'Pantalones', 'FALDAS': 'Faldas',
    'CHAQUETAS/ABRIGOS': 'Chaquetas/Abrigos', 'TRAJES': 'Trajes', 'VESTIDOS': 'Vestidos',
    'CALZADO': 'Calzado', 'ROPA INTERIOR': 'Ropa Interior', 'PIJAMAS': 'Pijamas',
    'ROPA DE BAÑO': 'Ropa de Baño', 'ACCESORIOS': 'Accesorios'
};

const SIZE_GROUPS: Record<string, string[]> = {
    'CAMISETAS': ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Talla Única', 'Sin talla'],
    'CAMISAS': ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Talla Única'],
    'SUDADERAS': ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    'PANTALONES': ['34', '36', '38', '40', '42', '44', '46', '48', '50'],
    'FALDAS': ['34', '36', '38', '40', '42', '44', '46', '48'],
    'CHAQUETAS/ABRIGOS': ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    'TRAJES': ['44', '46', '48', '50', '52', '54', '56', '58'],
    'VESTIDOS': ['34', '36', '38', '40', '42', '44', '46', '48'],
    'CALZADO': ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49'],
    'ROPA INTERIOR': ['XS', 'S', 'M', 'L', 'XL'],
    'PIJAMAS': ['XS', 'S', 'M', 'L', 'XL'],
    'ROPA DE BAÑO': ['XS', 'S', 'M', 'L', 'XL'],
    'ACCESORIOS': ['Talla Única', 'Ajustable', 'Pequeño', 'Mediano', 'Grande', 'Pack']
};

export const PublishScreen: React.FC = () => {
    const { products, addProduct, updateProduct, getProductById } = useProducts();
    const { productId } = useParams();
    const isEditMode = !!productId;
    const { user } = useUser();
    const { stores } = useStores();
    const { notify } = useNotifications();
    const navigate = useNavigate();

    // Acceso al escaparate: requiere Stripe Connect activo
    const isCollab = user.role === 'colaborador';
    const currentStore = isCollab ? stores.find(s => s.id === user.storeId) : null;
    const hasStripeConnected = !!currentStore?.stripeConnectOnboarded;

    const subscription = isCollab && user.joinedAt ? getCollaboratorSubscription(user.joinedAt) : null;
    const isTrialExpired = !!subscription && subscription.daysRemainingInTrial <= 0;

    const [connectLoading, setConnectLoading] = useState(false);
    const handleStripeConnect = async () => {
        const storeId = currentStore?.id ?? user.storeId;
        if (!storeId || !user.email) {
            notify('Error', 'No se encontró tu tienda. Inténtalo de nuevo.', 'error');
            return;
        }
        setConnectLoading(true);
        try {
            const res = await fetch(`${SUPABASE_URL}/functions/v1/create-connect-account`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
                body: JSON.stringify({
                    storeId,
                    email:     user.email,
                    returnUrl: `${window.location.protocol}//${window.location.host}/#`,
                }),
            });
            const { onboardingUrl, error } = await res.json();
            if (error) throw new Error(error);
            window.location.href = onboardingUrl;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error al conectar con Stripe';
            notify('Error', message, 'error');
            setConnectLoading(false);
        }
    };

    // Estados específicos para los nuevos campos
    const [gender, setGender] = useState<'Hombre' | 'Mujer' | 'Niños'>('Mujer');
    const [garment, setGarment] = useState('');
    const [brand, setBrand] = useState('');
    const [color, setColor] = useState('');
    const [model, setModel] = useState('');
    const [barcode, setBarcode] = useState('');

    const [price, setPrice] = useState('');
    const [category, setCategory] = useState('Camisetas');
    const [pantType, setPantType] = useState<'cortos' | 'largos' | 'monos/petos'>('largos');
    const [sleeveType, setSleeveType] = useState<'corta' | 'larga'>('corta');
    const [shirtSleeveType, setShirtSleeveType] = useState<'corta' | 'larga'>('larga');
    const [skirtType, setSkirtType] = useState<'cortas' | 'largas'>('cortas');
    const [shoeType, setShoeType] = useState<'running' | 'casual' | 'vestir' | 'otro'>('casual');

    const [activeGroup, setActiveGroup] = useState('CAMISETAS');
    const [stockPerSize, setStockPerSize] = useState<Record<string, number>>({});

    const [images, setImages] = useState<(string | null)[]>([null, null, null]);

    const [isAIOptimizing, setIsAIOptimizing] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [showSourceModal, setShowSourceModal] = useState(false);
    const [activeSlot, setActiveSlot] = useState<number | null>(null);
    const [isBarcodeScanning, setIsBarcodeScanning] = useState(false);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const barcodeCameraRef = useRef<HTMLInputElement>(null);
    const barcodeGalleryRef = useRef<HTMLInputElement>(null);
    const categoryScrollRef = useRef<HTMLDivElement>(null);

    // Cargar datos si estamos en modo edición
    useEffect(() => {
        if (isEditMode && productId) {
            const prod = getProductById(productId);
            if (prod) {
                setGarment(prod.name.split(' ')[0] || '');
                setBrand(prod.storeName === 'Retrospect Vintage' || prod.storeName === 'The Modernist' ? 'Local' : (prod.name.split(' ')[1] || ''));
                setPrice(prod.price.toString());
                setGender(prod.gender || 'Mujer');
                setStockPerSize(prod.stockPerSize || {});

                if (prod.category?.startsWith('Pantalones')) {
                    setCategory('Pantalones');
                    setPantType(prod.category.includes('cortos') ? 'cortos' : 'largos');
                    setActiveGroup('PANTALONES');
                } else if (prod.category?.startsWith('Camisetas')) {
                    setCategory('Camisetas');
                    setSleeveType(prod.category.includes('larga') ? 'larga' : 'corta');
                    setActiveGroup('CAMISETAS');
                } else if (prod.category?.startsWith('Camisas')) {
                    setCategory('Camisas');
                    setShirtSleeveType(prod.category.includes('larga') ? 'larga' : 'corta');
                    setActiveGroup('CAMISAS');
                } else if (prod.category?.startsWith('Faldas')) {
                    setCategory('Faldas');
                    setSkirtType(prod.category.includes('largas') ? 'largas' : 'cortas');
                    setActiveGroup('FALDAS');
                } else if (prod.category?.startsWith('Calzado')) {
                    setCategory('Calzado');
                    const type = prod.category.split(' ')[1] as any;
                    if (type) setShoeType(type);
                    setActiveGroup('CALZADO');
                } else if (prod.category === 'Monos/Petos') {
                    setCategory('Monos/Petos');
                    setPantType('monos/petos');
                    setActiveGroup('PANTALONES');
                } else {
                    setCategory(prod.category || 'Camisetas');
                }

                setBarcode(prod.barcode || '');
                setImages([prod.imageUrl, ...(prod.images || []), null, null].slice(0, 3));
            }
        }
    }, [isEditMode, productId, getProductById]);

    useEffect(() => {
        if (categoryScrollRef.current) {
            const activeBtn = categoryScrollRef.current.querySelector('[data-active="true"]') as HTMLElement;
            if (activeBtn) {
                const container = categoryScrollRef.current;
                const scrollLeft = activeBtn.offsetLeft - (container.clientWidth / 2) + (activeBtn.clientWidth / 2);
                container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
            }
        }
    }, [activeGroup]);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    const totalStock = useMemo(() => {
        const values = Object.values(stockPerSize).filter(v => typeof v === 'number') as number[];
        return values.reduce((a, b) => a + b, 0);
    }, [stockPerSize]);

    // UI de bloqueo: suscripción expirada
    if (isCollab && isTrialExpired) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen pb-32">
                <DetailHeader title={isEditMode ? "Editar Artículo" : "Publicar Artículo"} />
                <main className="p-6 flex flex-col items-center justify-center min-h-[70vh] text-center animate-fade-in">
                    <div className="size-24 bg-red-500/10 rounded-full flex items-center justify-center mb-8 shadow-inner">
                        <Icon name="credit_card_off" className="text-6xl text-red-500" filled />
                    </div>
                    <h2 className="text-2xl font-black text-text-light dark:text-white uppercase tracking-tight mb-4 leading-tight">
                        Suscripción Inactiva
                    </h2>
                    <p className="text-sm text-text-subtle-light dark:text-text-subtle-dark max-w-sm leading-relaxed mb-10">
                        Tu período de prueba ha finalizado. Para seguir publicando artículos y vender en LocalShop, activa tu suscripción mensual.
                    </p>
                    <div className="w-full max-w-sm space-y-4">
                        <button
                            onClick={() => navigate('/payment-methods')}
                            className="w-full h-16 bg-primary text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                        >
                            <Icon name="open_in_new" className="text-xl" />
                            Activar Suscripción
                        </button>
                        <button onClick={() => navigate(-1)} className="w-full h-14 text-text-subtle-light font-bold text-sm uppercase">
                            Volver
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    // UI de bloqueo: Stripe Connect no completado
    if (isCollab && !hasStripeConnected) {
        const launchOffer = isInLaunchPeriod();
        const hasAccountId = !!currentStore?.stripeConnectAccountId;
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen pb-32">
                <DetailHeader title="Activación de Escaparate" />
                <main className="p-6 flex flex-col items-center justify-center min-h-[70vh] text-center animate-fade-in">
                    <div className="size-24 bg-primary/10 rounded-full flex items-center justify-center mb-8 shadow-inner">
                        <Icon name={hasAccountId ? 'pending_actions' : 'account_balance_wallet'} className="text-6xl text-primary" filled />
                    </div>
                    <h2 className="text-2xl font-black text-text-light dark:text-white uppercase tracking-tight mb-4 leading-tight">
                        {hasAccountId ? 'Completa tu Registro' : 'Activa tus Cobros'}
                    </h2>

                    <div className="bg-white dark:bg-accent-dark p-6 rounded-[32px] border border-primary/20 shadow-xl space-y-4 max-w-sm w-full">
                        {launchOffer && (
                            <div className="flex items-center justify-center gap-2 bg-mustard/10 border border-mustard/30 rounded-2xl px-4 py-2">
                                <Icon name="rocket_launch" className="text-mustard text-lg" />
                                <span className="text-[11px] font-black uppercase tracking-widest text-mustard">Oferta de Lanzamiento</span>
                            </div>
                        )}

                        <p className="text-sm text-text-subtle-light dark:text-text-subtle-dark leading-relaxed font-medium">
                            {hasAccountId
                                ? 'Ya iniciaste el proceso en Stripe. Completa el registro para empezar a vender y recibir tus ingresos automáticamente.'
                                : 'Para publicar artículos es necesario conectar tu cuenta bancaria a través de Stripe. Es seguro y solo tarda unos minutos.'}
                        </p>

                        {launchOffer ? (
                            <div className="py-3 border-y border-border-light dark:border-border-dark space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-text-light dark:text-gray-400">Gratis hasta el 31 dic 2026</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] line-through text-text-subtle-light">{REGULAR_PRICE.toFixed(2).replace('.', ',')}€</span>
                                        <span className="text-sm font-black text-olive bg-olive/10 px-2 py-0.5 rounded-lg">GRATIS</span>
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-text-light dark:text-gray-400">A partir del 1 ene 2027 <span className="text-mustard">(de por vida)</span></span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] line-through text-text-subtle-light">{REGULAR_PRICE.toFixed(2).replace('.', ',')}€</span>
                                        <span className="text-sm font-black text-primary">{DISCOUNTED_PRICE.replace('.', ',')}€/mes</span>
                                    </div>
                                </div>
                                <p className="text-[10px] text-mustard font-bold text-center">
                                    ¡Precio de Socio Fundador garantizado de por vida por registrarte antes del 31 dic 2026!
                                </p>
                            </div>
                        ) : (
                            <div className="py-3 border-y border-border-light dark:border-border-dark space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs font-bold text-text-light dark:text-gray-400">Suscripción Mensual</span>
                                    <span className="text-sm font-black text-primary">{REGULAR_PRICE.toFixed(2).replace('.', ',')}€</span>
                                </div>
                                <p className="text-[10px] text-text-subtle-light italic">Se cobrará mensualmente a la cuenta configurada por Stripe.</p>
                            </div>
                        )}

                        <p className="text-xs text-text-subtle-light font-bold">
                            Stripe gestiona tus datos bancarios de forma segura. LocalShop nunca almacena tu IBAN.
                        </p>
                    </div>

                    <div className="w-full max-w-sm mt-10 space-y-4">
                        <button
                            onClick={handleStripeConnect}
                            disabled={connectLoading}
                            className="w-full h-16 bg-primary text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-60"
                        >
                            {connectLoading
                                ? <span className="animate-spin material-symbols-outlined text-xl">progress_activity</span>
                                : <>
                                    <Icon name={hasAccountId ? 'open_in_new' : 'link'} className="text-xl" />
                                    {hasAccountId ? 'Finalizar configuración en Stripe' : 'Conectar con Stripe para vender'}
                                </>
                            }
                        </button>
                        <button
                            onClick={() => navigate(-1)}
                            className="w-full h-14 text-text-subtle-light font-bold text-sm uppercase"
                        >
                            Volver
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    const handleImageUploadRequest = (index: number) => {
        setActiveSlot(index);
        setShowSourceModal(true);
    };

    const handleRemoveImage = (e: React.MouseEvent, index: number) => {
        e.stopPropagation();
        setImages(prev => {
            const updated = [...prev];
            updated[index] = null;
            return updated;
        });
        notify('Imagen eliminada', 'Puedes subir una nueva foto en este espacio.', 'delete');
    };

    const processFile = async (file: File) => {
        const targetSlot = activeSlot;
        if (file && targetSlot !== null) {
            setIsAIOptimizing(true);
            setShowSourceModal(false);

            try {
                // 1. Obtener base64 de la imagen original
                const [mimeType, base64Data] = await new Promise<[string, string]>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const str = reader.result as string;
                        const match = str.match(/^data:(.*?);base64,(.*)$/);
                        if (match) {
                            resolve([match[1], match[2]]);
                        } else {
                            reject(new Error("Formato inválido"));
                        }
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });

                // 2. Llamadas a Gemini separadas: texto e imagen por separado para máxima fiabilidad
                const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
                if (!apiKey) {
                    throw new Error("API Key no detectada. Asegúrate de reiniciar el servidor Vite.");
                }
                const ai = new GoogleGenAI({ apiKey });
                const categoriesList = CLOTHING_CATEGORIES.join(', ');

                // 2a. Primero validar el producto con llamada de texto (rápida, fiable)
                const textResponse = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: {
                        parts: [
                            { inlineData: { data: base64Data, mimeType } },
                            {
                                text: `Analiza esta imagen y determina si contiene un producto válido para un marketplace de moda.
Productos válidos: prendas de vestir (camisetas, pantalones, vestidos, chaquetas, zapatos, calcetines, ropa interior, bañadores, ropa deportiva, etc.), bisutería (anillos, collares, pulseras, pendientes), accesorios (bolsos, cinturones, gorros, bufandas, gafas de sol, relojes, corbatas, carteras).
Si NO es un producto válido, responde PRODUCTO_VALIDO: NO y nada más.
Si SÍ es válido, responde con este formato exacto:
PRODUCTO_VALIDO: SI
PRENDA: [Tipo de prenda]
MARCA: [Marca detectada o 'Local']
COLOR: [Color principal]
GÉNERO: [Mujer, Hombre o Niños]
CATEGORÍA_RAIZ: [Una exacta de: ${categoriesList}]
SUB_APARTADO: [Específico: pantalones largos, camiseta manga corta, zapatillas running, etc.]` }
                        ]
                    }
                });
                const fullText = textResponse.text || "";

                // Validación temprana: si el producto no es válido, no generamos imagen
                const validMatch = fullText.match(/PRODUCTO_VALIDO:\s*(SI|NO)/i);
                const isValidProduct = !validMatch || validMatch[1].toUpperCase() === 'SI';
                if (!isValidProduct) {
                    notify(
                        'Producto no permitido',
                        'Solo puedes subir prendas de vestir, bisutería o accesorios de moda.',
                        'block'
                    );
                    return;
                }

                // 2b. Producto válido: generar imagen con fondo de estudio (hasta 3 reintentos)
                let finalImageBase64 = "";
                const maxAttempts = 3;
                for (let attempt = 0; attempt < maxAttempts; attempt++) {
                    const imgResponse = await ai.models.generateContent({
                        model: 'gemini-2.5-flash-image',
                        config: { responseModalities: ['IMAGE'] },
                        contents: {
                            parts: [
                                { inlineData: { data: base64Data, mimeType } },
                                {
                                    text: `Replace ONLY the background of this product photo. Keep the product 100% identical — same position, size, colors, no edge glow.
New background: warm terracotta studio (#8B5535), smooth gradient lighter toward center, soft studio lighting from above-left, subtle shadow beneath the product. Minimalist high-end fashion catalog style.` }
                            ]
                        }
                    });
                    if (imgResponse.candidates?.[0]?.content?.parts) {
                        for (const part of imgResponse.candidates[0].content.parts) {
                            if (part.inlineData) {
                                finalImageBase64 = `data:image/png;base64,${part.inlineData.data}`;
                            }
                        }
                    }
                    if (finalImageBase64) break;
                }

                // Fallback por si la API no devuelve imagen tras todos los reintentos
                let imageFromAI = true;
                if (!finalImageBase64) {
                    imageFromAI = false;
                    finalImageBase64 = `data:${mimeType};base64,${base64Data}`;
                }

                const garmentMatch = fullText.match(/PRENDA:\s*(.*)/i);
                const brandMatch = fullText.match(/MARCA:\s*(.*)/i);
                const colorMatch = fullText.match(/COLOR:\s*(.*)/i);
                const genderMatch = fullText.match(/GÉNERO:\s*(.*)/i);
                const rootCatMatch = fullText.match(/CATEGORÍA_RAIZ:\s*(.*)/i);
                const subMatch = fullText.match(/SUB_APARTADO:\s*(.*)/i);

                if (targetSlot === 0 || !garment) {
                    if (garmentMatch && garmentMatch[1]) setGarment(garmentMatch[1].split(/\n/)[0].trim());
                    if (brandMatch && brandMatch[1]) setBrand(brandMatch[1].split(/\n/)[0].trim());
                    if (colorMatch && colorMatch[1]) setColor(colorMatch[1].split(/\n/)[0].trim());

                    if (genderMatch && genderMatch[1]) {
                        const g = genderMatch[1].trim();
                        if (g.includes('Mujer')) setGender('Mujer');
                        else if (g.includes('Hombre')) setGender('Hombre');
                        else if (g.includes('Niño') || g.includes('Niños')) setGender('Niños');
                    }

                    if (rootCatMatch && rootCatMatch[1]) {
                        const rootCat = rootCatMatch[1].trim();
                        const foundCat = CLOTHING_CATEGORIES.find(c => rootCat.toLowerCase().includes(c.toLowerCase()));
                        if (foundCat) handleCategorySelect(foundCat);
                    }

                    if (subMatch && subMatch[1]) {
                        const sub = subMatch[1].toLowerCase();
                        if (sub.includes('corta')) { setSleeveType('corta'); setShirtSleeveType('corta'); }
                        else if (sub.includes('larga')) { setSleeveType('larga'); setShirtSleeveType('larga'); }
                        else if (sub.includes('cortos') || sub.includes('corta')) { setPantType('cortos'); setSkirtType('cortas'); }
                        else if (sub.includes('largos') || sub.includes('larga')) { setPantType('largos'); setSkirtType('largas'); }
                        else if (sub.includes('running')) setShoeType('running');
                        else if (sub.includes('casual')) setShoeType('casual');
                        else if (sub.includes('vestir')) setShoeType('vestir');
                    }
                }

                setImages(prev => {
                    const updated = [...prev];
                    updated[targetSlot] = finalImageBase64;
                    return updated;
                });

                if (imageFromAI) {
                    notify('IA LocalShop', 'Foto optimizada con fondo de estudio.', 'auto_awesome');
                } else {
                    notify('IA LocalShop', 'Campos completados. El fondo no se pudo generar esta vez, inténtalo de nuevo.', 'info');
                }
            } catch (error: any) {
                console.error("AI Error", error);
                notify('Error en IA', error?.message || 'Hubo un error al procesar la imagen.', 'error');
                const reader = new FileReader();
                reader.onloadend = () => {
                    setImages(prev => {
                        const updated = [...prev];
                        updated[targetSlot] = reader.result as string;
                        return updated;
                    });
                };
                reader.readAsDataURL(file);
            } finally {
                setIsAIOptimizing(false);
                setActiveSlot(null);
            }
        }
    };

    const handleCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
        e.target.value = '';
    };

    const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
        e.target.value = '';
    };

    const processBarcodeFile = async (file: File) => {
        setIsBarcodeScanning(true);
        try {
            const bitmap = await createImageBitmap(file);

            // Intento 1: BarcodeDetector nativo (Chrome/Android, instantáneo)
            if ('BarcodeDetector' in window) {
                const detector = new (window as any).BarcodeDetector();
                const codes = await detector.detect(bitmap);
                if (codes.length > 0) {
                    setBarcode(codes[0].rawValue);
                    notify('Código detectado', `Código: ${codes[0].rawValue}`, 'qr_code_scanner');
                    return;
                }
            }

            // Intento 2: @zxing/browser como fallback (Safari, Firefox — carga ~100KB solo la primera vez)
            const { BrowserMultiFormatReader } = await import('@zxing/browser');
            const url = URL.createObjectURL(file);
            try {
                const img = new Image();
                img.src = url;
                await new Promise<void>(resolve => { img.onload = () => resolve(); });
                const reader = new BrowserMultiFormatReader();
                const result = await reader.decodeFromImageElement(img);
                setBarcode(result.getText());
                notify('Código detectado', `Código: ${result.getText()}`, 'qr_code_scanner');
            } finally {
                URL.revokeObjectURL(url);
            }
        } catch {
            notify('No detectado', 'No se encontró ningún código de barras. Puedes escribirlo manualmente.', 'info');
        } finally {
            setIsBarcodeScanning(false);
        }
    };

    const handleBarcodeCameraChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processBarcodeFile(file);
    };

    const handleBarcodeGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processBarcodeFile(file);
    };

    const toggleSize = (size: string) => {
        setStockPerSize(prev => {
            const newStock = { ...prev };
            if (newStock[size] !== undefined) {
                delete newStock[size];
            } else {
                newStock[size] = 1;
            }
            return newStock;
        });
    };

    const updateStockForSize = (size: string, increment: boolean) => {
        setStockPerSize(prev => ({
            ...prev,
            [size]: Math.max(1, (prev[size] || 0) + (increment ? 1 : -1))
        }));
    };

    const handlePublish = async (e: React.FormEvent) => {
        e.preventDefault();
        const validImages = images.filter((img): img is string => img !== null);
        if (!garment || !price || validImages.length === 0) {
            notify('Incompleto', 'Rellena los datos básicos y al menos una foto.', 'error');
            return;
        }

        const garmentErr = validateProductField(garment, 'Prenda');
        if (garmentErr) { notify('Error', garmentErr, 'error'); return; }
        const brandErr = validateProductField(brand, 'Marca');
        if (brandErr) { notify('Error', brandErr, 'error'); return; }
        const colorErr = validateProductField(color, 'Color');
        if (colorErr) { notify('Error', colorErr, 'error'); return; }
        const modelErr = validateProductField(model, 'Modelo');
        if (modelErr) { notify('Error', modelErr, 'error'); return; }
        const priceErr = validatePrice(price);
        if (priceErr) { notify('Error', priceErr, 'error'); return; }

        const safeGarment = sanitizeRaw(garment);
        const safeBrand = sanitizeRaw(brand);
        const safeModel = sanitizeRaw(model);
        const safeColor = sanitizeRaw(color);

        const finalName = `${safeGarment} ${safeBrand} ${safeModel} ${safeColor}`.trim().replace(/\s+/g, ' ');
        let finalCategory = category;
        if (category === 'Pantalones') finalCategory = `Pantalones ${pantType}`;
        else if (category === 'Camisetas') finalCategory = `Camisetas manga ${sleeveType}`;
        else if (category === 'Camisas') finalCategory = `Camisas manga ${shirtSleeveType}`;
        else if (category === 'Faldas') finalCategory = `Faldas ${skirtType}`;
        else if (category === 'Calzado') finalCategory = `Calzado ${shoeType}`;

        const targetStoreId = user.storeId || 'unknown';

        setIsPublishing(true);
        try {
            const uploadedImages = await Promise.all(
                validImages.map(url => uploadBase64Image(url, targetStoreId))
            );

            const productData = {
                name: finalName,
                price: parseFloat(price),
                imageUrl: uploadedImages[0],
                images: uploadedImages.slice(1),
                category: finalCategory,
                gender: gender,
                color: safeColor || undefined,
                stock: totalStock,
                stockPerSize,
                sizes: Object.keys(stockPerSize),
                barcode: sanitizeRaw(barcode.trim()) || undefined,
            };

            if (isEditMode && productId) {
                if (updateProduct(productId, productData)) {
                    notify('¡Actualizado!', 'Los cambios se han guardado con éxito.', 'check_circle');
                    navigate('/manage-catalog');
                }
            } else {
                if (!user.storeId) {
                    notify('Error', 'No se encontró tu tienda. Recarga la página e inténtalo de nuevo.', 'error');
                    return;
                }

                // Si hay código de barras, consultar en DB si ya existe ese producto en la tienda
                const trimmedBarcode = sanitizeRaw(barcode.trim());
                if (trimmedBarcode) {
                    const { data: existingRows } = await supabase
                        .from('products')
                        .select('*')
                        .eq('barcode', trimmedBarcode)
                        .eq('store_id', user.storeId)
                        .eq('is_deleted', false)
                        .limit(1);

                    if (existingRows && existingRows.length > 0) {
                        const existing = dbProductToProduct(existingRows[0] as any);
                        const mergedStockPerSize = { ...(existing.stockPerSize || {}), ...stockPerSize };
                        const mergedStock = (Object.values(mergedStockPerSize) as number[]).reduce((a, b) => a + b, 0);
                        if (updateProduct(existing.id, {
                            stockPerSize: mergedStockPerSize,
                            sizes: Object.keys(mergedStockPerSize),
                            stock: mergedStock,
                        })) {
                            notify('¡Tallas añadidas!', 'Las tallas se han incorporado al producto existente.', 'check_circle');
                            navigate('/manage-catalog');
                        }
                        return;
                    }
                }

                // Sin código de barras: buscar por nombre exacto en la misma tienda para evitar duplicados
                const { data: existingByName } = await supabase
                    .from('products')
                    .select('*')
                    .eq('store_id', user.storeId)
                    .ilike('name', finalName)
                    .eq('is_deleted', false)
                    .limit(1);

                if (existingByName && existingByName.length > 0) {
                    const existing = dbProductToProduct(existingByName[0] as any);
                    const mergedStockPerSize = { ...(existing.stockPerSize || {}), ...stockPerSize };
                    const mergedStock = (Object.values(mergedStockPerSize) as number[]).reduce((a, b) => a + b, 0);
                    if (updateProduct(existing.id, {
                        stockPerSize: mergedStockPerSize,
                        sizes: Object.keys(mergedStockPerSize),
                        stock: mergedStock,
                    })) {
                        notify('¡Tallas añadidas!', 'Las tallas se han incorporado al producto existente.', 'check_circle');
                        navigate('/manage-catalog');
                    }
                    return;
                }

                const newProduct: Product = {
                    id: `PROD-${Date.now()}`,
                    storeName: user.name,
                    storeId: user.storeId,
                    ...productData
                };
                if (addProduct(newProduct)) {
                    notify('¡Publicado!', 'Tu artículo ya está en el escaparate.', 'check_circle');
                    navigate('/manage-catalog');
                }
            }
        } catch (err: any) {
            notify('Error al subir imágenes', err?.message || 'No se pudieron subir las fotos.', 'error');
        } finally {
            setIsPublishing(false);
        }
    };

    const handleCategorySelect = (c: string) => {
        setCategory(c);
        const upperC = c.toUpperCase();
        if (SIZE_GROUPS[upperC]) setActiveGroup(upperC);
        else if (c === 'Pantalones') setActiveGroup('PANTALONES');
        else if (c === 'Monos/Petos') { setActiveGroup('PANTALONES'); setPantType('monos/petos'); }
        else if (c === 'Calzado') setActiveGroup('CALZADO');
        else if (c === 'Accesorios') setActiveGroup('ACCESORIOS');
        else setActiveGroup('CAMISETAS');
    };

    const uploadedCount = images.filter(i => i !== null).length;

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen pb-32">
            <span className="sr-only">Publish</span>
            <DetailHeader title={isEditMode ? "Editar Artículo" : "Publicar Nuevo Artículo"} />
            <main className="p-4 space-y-6 animate-fade-in">
                {/* Sección de Imágenes */}
                <div className="space-y-3">
                    <div className="flex justify-between items-center px-1">
                        <div className="flex items-center gap-2">
                            <Icon name="collections" className={uploadedCount > 0 ? "text-[#4caf50] text-sm" : "text-[#f44336] text-sm"} />
                            <label className="text-[10px] font-black uppercase tracking-widest text-text-subtle-light">
                                Fotos del artículo (mín. 1 - máx. 3)
                            </label>
                        </div>
                        <span className={`text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-tighter animate-pulse shadow-sm ${uploadedCount > 0 ? 'bg-[#c8e6c9] text-[#1b5e20]' : 'bg-[#ffcdd2] text-[#b71c1c]'}`}>
                            {uploadedCount > 0 ? 'Fotos Listas' : 'Subir Fotos'}
                        </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        {images.map((img, idx) => (
                            <div
                                key={idx}
                                onClick={() => !isAIOptimizing && handleImageUploadRequest(idx)}
                                className={`aspect-square rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer relative overflow-hidden group transition-all duration-500 ${isAIOptimizing && activeSlot === idx ? 'border-primary scale-105 shadow-xl' : 'border-primary/20 bg-white dark:bg-accent-dark'}`}
                            >
                                {isAIOptimizing && activeSlot === idx ? (
                                    <div className="absolute inset-0 bg-white/70 dark:bg-black/70 flex flex-col items-center justify-center p-2 text-center z-10 animate-fade-in">
                                        <div className="size-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin mb-2"></div>
                                        <span className="text-[8px] font-black uppercase text-primary tracking-widest leading-tight">Gemini AI<br />Procesando...</span>
                                    </div>
                                ) : img ? (
                                    <div className="relative w-full h-full">
                                        <img src={img} className="absolute inset-0 w-full h-full object-cover animate-fade-in" alt={`Foto ${idx + 1}`} />
                                        <button
                                            onClick={(e) => handleRemoveImage(e, idx)}
                                            className="absolute top-1 right-1 size-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md active:scale-90 transition-transform z-20"
                                        >
                                            <Icon name="close" className="text-[14px]" />
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        <Icon name="add_a_photo" className="text-primary/40 text-2xl group-hover:scale-110 transition-transform" />
                                        <span className="text-[8px] font-black uppercase text-primary/40">Foto {idx + 1}</span>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                    <p className="text-[8px] font-bold text-primary/60 uppercase text-center tracking-widest leading-none">Todas las fotos recibirán el acabado de estudio #C9D0D6</p>
                </div>

                <input type="file" ref={cameraInputRef} accept="image/*" capture="environment" className="hidden" onChange={handleCameraChange} />
                <input type="file" ref={galleryInputRef} accept="image/*" className="hidden" onChange={handleGalleryChange} />
                <input type="file" ref={barcodeCameraRef} accept="image/*" capture="environment" className="hidden" onChange={handleBarcodeCameraChange} />
                <input type="file" ref={barcodeGalleryRef} accept="image/*" className="hidden" onChange={handleBarcodeGalleryChange} />

                {/* Sección Identidad del Artículo (IA) */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                        <Icon name="auto_awesome" className="text-primary text-sm" filled />
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-primary">Identidad con IA (Auto-completado)</h3>
                    </div>

                    <div className="bg-white dark:bg-accent-dark p-6 rounded-[32px] border border-primary/20 shadow-sm space-y-4 relative overflow-hidden">
                        {isAIOptimizing && (
                            <div className="absolute inset-0 bg-primary/5 backdrop-blur-[1px] z-10 flex items-center justify-center animate-pulse">
                                <span className="text-[10px] font-black uppercase text-primary tracking-widest">IA Analizando...</span>
                            </div>
                        )}

                        <div className="space-y-1.5 transition-all duration-700">
                            <label className="text-[10px] font-black uppercase tracking-widest text-text-subtle-light">Prenda</label>
                            <input
                                value={garment}
                                onChange={e => setGarment(truncate(sanitizeRaw(e.target.value), MAX_LENGTHS.productField))}
                                placeholder="Ej: Camiseta, Chaqueta..."
                                className={`w-full h-11 bg-primary/5 dark:bg-background-dark border rounded-xl px-4 text-sm font-bold text-text-light dark:text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all ${garment && !isAIOptimizing ? 'border-primary/40 shadow-[0_0_10px_rgba(194,155,136,0.1)]' : 'border-primary/10'}`}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-text-subtle-light">Marca</label>
                                <input
                                    value={brand}
                                    onChange={e => setBrand(truncate(sanitizeRaw(e.target.value), MAX_LENGTHS.productField))}
                                    placeholder="Marca detectada"
                                    className={`w-full h-11 bg-primary/5 dark:bg-background-dark border rounded-xl px-4 text-sm font-bold text-text-light dark:text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all ${brand && !isAIOptimizing ? 'border-primary/40' : 'border-primary/10'}`}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-text-subtle-light">Color</label>
                                <input
                                    value={color}
                                    onChange={e => setColor(truncate(sanitizeRaw(e.target.value), MAX_LENGTHS.productField))}
                                    placeholder="Color principal"
                                    className={`w-full h-11 bg-primary/5 dark:bg-background-dark border rounded-xl px-4 text-sm font-bold text-text-light dark:text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all ${color && !isAIOptimizing ? 'border-primary/40' : 'border-primary/10'}`}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sección Modelo (Manual) */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <div className="flex items-center gap-2">
                            <Icon name="edit_note" className={price && totalStock > 0 ? "text-[#4caf50] text-sm" : "text-[#f44336] text-sm"} />
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-text-subtle-light">Detalles Manuales</h3>
                        </div>
                        <span className={`text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-tighter animate-pulse shadow-sm ${price && totalStock > 0 ? 'bg-[#c8e6c9] text-[#1b5e20]' : 'bg-[#ffcdd2] text-[#b71c1c]'}`}>
                            {price && totalStock > 0 ? 'Completado' : 'Acción Requerida'}
                        </span>
                    </div>

                    <div className={`bg-white dark:bg-accent-dark p-6 rounded-[32px] border-2 shadow-md space-y-4 relative transition-all duration-500 ${price && totalStock > 0 ? 'border-[#c8e6c9]' : 'border-[#ffcdd2]'}`}>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-text-subtle-light">Modelo / Colección <span className="text-primary italic normal-case font-bold">(Opcional)</span></label>
                            <input
                                value={model}
                                onChange={e => setModel(truncate(sanitizeRaw(e.target.value), MAX_LENGTHS.productField))}
                                placeholder="Ej: Slim Fit, Colección Verano 24..."
                                className={`w-full h-11 border rounded-xl px-4 text-sm font-bold text-text-light dark:text-white outline-none transition-all placeholder:text-text-subtle-light/40 ${model.trim() ? 'bg-[#c8e6c9]/10 border-[#c8e6c9] focus:ring-[#c8e6c9]/20' : 'bg-[#ffcdd2]/5 border-[#ffcdd2]/30 focus:ring-[#ffcdd2]/20'}`}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-text-subtle-light">Código de Barras <span className="text-primary italic normal-case font-bold">(Opcional)</span></label>
                            <div className="flex gap-2 items-center">
                                <input
                                    value={barcode}
                                    onChange={e => setBarcode(truncate(sanitizeRaw(e.target.value), MAX_LENGTHS.barcode))}
                                    placeholder="Ej: 8410510000003"
                                    className={`flex-1 h-11 border rounded-xl px-4 text-sm font-bold text-text-light dark:text-white outline-none transition-all placeholder:text-text-subtle-light/40 ${barcode.trim() ? 'bg-[#c8e6c9]/10 border-[#c8e6c9] focus:ring-[#c8e6c9]/20' : 'bg-[#ffcdd2]/5 border-[#ffcdd2]/30 focus:ring-[#ffcdd2]/20'}`}
                                />
                                {isBarcodeScanning ? (
                                    <div className="size-11 flex items-center justify-center shrink-0">
                                        <div className="size-5 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                                    </div>
                                ) : (
                                    <>
                                        <button type="button" onClick={() => barcodeCameraRef.current?.click()} className="size-11 shrink-0 flex items-center justify-center rounded-xl bg-accent-light dark:bg-accent-dark border border-border-light dark:border-border-dark text-text-subtle-light hover:text-primary transition-colors active:scale-90">
                                            <Icon name="photo_camera" className="text-xl" />
                                        </button>
                                        <button type="button" onClick={() => barcodeGalleryRef.current?.click()} className="size-11 shrink-0 flex items-center justify-center rounded-xl bg-accent-light dark:bg-accent-dark border border-border-light dark:border-border-dark text-text-subtle-light hover:text-primary transition-colors active:scale-90">
                                            <Icon name="image" className="text-xl" />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="flex-1 space-y-1.5">
                                <label className={`text-[10px] font-black uppercase tracking-widest ${price ? 'text-[#1b5e20]' : 'text-[#b71c1c]'}`}>Precio (€)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={price}
                                    onChange={e => { const v = e.target.value; if (v === '' || parseFloat(v) >= 0) setPrice(v); }}
                                    placeholder="0.00"
                                    className={`w-full h-11 border-2 rounded-xl px-4 text-base font-black text-text-light dark:text-white outline-none transition-all shadow-sm placeholder:opacity-50 ${price ? 'bg-[#c8e6c9]/10 border-[#4caf50] ring-4 ring-[#c8e6c9]/20' : 'bg-white border-[#f44336] ring-4 ring-[#ffcdd2]/30'}`}
                                />
                            </div>
                            <div className="flex-1 space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-text-subtle-light">Stock Total</label>
                                <div className={`w-full h-11 border rounded-xl flex items-center justify-center transition-colors ${totalStock > 0 ? 'bg-[#c8e6c9]/20 border-[#c8e6c9]/50' : 'bg-background-light dark:bg-background-dark border-border-light'}`}>
                                    <span className={`text-lg font-black ${totalStock > 0 ? 'text-[#1b5e20]' : 'text-text-subtle-light/40'}`}>
                                        {totalStock}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Selector de Género (Sincronizado con IA) */}
                <div className={`bg-white dark:bg-accent-dark p-2 rounded-2xl border flex gap-2 shadow-sm transition-all duration-500 ${gender && !isAIOptimizing ? 'border-primary/30' : 'border-border-light dark:border-border-dark'}`}>
                    <button
                        onClick={() => setGender('Mujer')}
                        className={`flex-1 h-12 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${gender === 'Mujer' ? 'bg-primary text-white shadow-lg' : 'text-text-subtle-light dark:text-text-subtle-dark'}`}
                    >
                        <Icon name="woman" filled={gender === 'Mujer'} />
                        Mujer
                    </button>
                    <button
                        onClick={() => setGender('Hombre')}
                        className={`flex-1 h-12 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${gender === 'Hombre' ? 'bg-primary text-white shadow-lg' : 'text-text-subtle-light dark:text-text-subtle-dark'}`}
                    >
                        <Icon name="man" filled={gender === 'Hombre'} />
                        Hombre
                    </button>
                    <button
                        onClick={() => setGender('Niños')}
                        className={`flex-1 h-12 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${gender === 'Niños' ? 'bg-primary text-white shadow-lg' : 'text-text-subtle-light dark:text-text-subtle-dark'}`}
                    >
                        <Icon name="child_care" filled={gender === 'Niños'} />
                        Niños
                    </button>
                </div>

                {/* Gestión de Tallas y Sub-apartados (Manual + IA) */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center px-1">
                        <div className="flex items-center gap-2">
                            <Icon name="straighten" className={totalStock > 0 ? "text-[#4caf50] text-sm" : "text-[#f44336] text-sm"} />
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-text-subtle-light">Selección de Tallas y Stock</h3>
                        </div>
                        <span className={`text-[10px] font-black px-4 py-1.5 rounded-full shadow-lg uppercase tracking-tighter animate-pulse ${totalStock > 0 ? 'bg-[#c8e6c9] text-[#1b5e20]' : 'bg-[#ffcdd2] text-[#b71c1c]'}`}>
                            {totalStock > 0 ? 'Tallas Listas' : 'Indispensable'}
                        </span>
                    </div>
                    <div
                        ref={categoryScrollRef}
                        className="flex overflow-x-auto gap-2 pb-2 [-ms-scrollbar-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    >
                        {Object.keys(SIZE_GROUPS)
                            .filter(g => {
                                if (gender === 'Hombre' && (g === 'FALDAS' || g === 'VESTIDOS')) return false;
                                if (gender === 'Mujer' && g === 'TRAJES') return false;
                                return true;
                            })
                            .map(g => (
                                <button
                                    key={g}
                                    data-active={activeGroup === g}
                                    onClick={() => { setActiveGroup(g); setCategory(GROUP_TO_CATEGORY[g] || g); }}
                                    className={`h-10 px-6 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all ${activeGroup === g ? 'bg-primary/20 text-primary border border-primary/20' : 'bg-white dark:bg-accent-dark text-text-subtle-light border border-border-light dark:border-border-dark'}`}
                                >
                                    {g}
                                </button>
                            ))}
                    </div>

                    {/* Sub-apartado exclusivo para Pantalones */}
                    {activeGroup === 'PANTALONES' && (
                        <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-2xl border border-primary/10 animate-fade-in">
                            <span className="text-[9px] font-black uppercase tracking-widest text-primary/60 px-2 shrink-0">Tipo:</span>
                            <div className="flex-1 grid grid-cols-3 gap-2">
                                <button
                                    onClick={() => { setPantType('cortos'); setCategory('Pantalones'); }}
                                    className={`h-9 rounded-xl text-[10px] font-black uppercase transition-all ${pantType === 'cortos' ? 'bg-primary text-white shadow-sm' : 'bg-white/50 text-primary/40'}`}
                                >
                                    Corto
                                </button>
                                <button
                                    onClick={() => { setPantType('largos'); setCategory('Pantalones'); }}
                                    className={`h-9 rounded-xl text-[10px] font-black uppercase transition-all ${pantType === 'largos' ? 'bg-primary text-white shadow-sm' : 'bg-white/50 text-primary/40'}`}
                                >
                                    Largo
                                </button>
                                <button
                                    onClick={() => { setPantType('monos/petos'); setCategory('Monos/Petos'); }}
                                    className={`h-9 rounded-xl text-[10px] font-black uppercase transition-all ${pantType === 'monos/petos' ? 'bg-primary text-white shadow-sm' : 'bg-white/50 text-primary/40'}`}
                                >
                                    Monos/Petos
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Sub-apartado exclusivo para Camisetas */}
                    {activeGroup === 'CAMISETAS' && (
                        <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-2xl border border-primary/10 animate-fade-in">
                            <span className="text-[9px] font-black uppercase tracking-widest text-primary/60 px-2 shrink-0">Manga:</span>
                            <div className="flex-1 grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => { setSleeveType('corta'); setCategory('Camisetas'); }}
                                    className={`h-9 rounded-xl text-[10px] font-black uppercase transition-all ${sleeveType === 'corta' ? 'bg-primary text-white shadow-sm' : 'bg-white/50 text-primary/40'}`}
                                >
                                    Manga Corta
                                </button>
                                <button
                                    onClick={() => { setSleeveType('larga'); setCategory('Camisetas'); }}
                                    className={`h-9 rounded-xl text-[10px] font-black uppercase transition-all ${sleeveType === 'larga' ? 'bg-primary text-white shadow-sm' : 'bg-white/50 text-primary/40'}`}
                                >
                                    Manga Larga
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Sub-apartado exclusivo para Camisas */}
                    {activeGroup === 'CAMISAS' && (
                        <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-2xl border border-primary/10 animate-fade-in">
                            <span className="text-[9px] font-black uppercase tracking-widest text-primary/60 px-2 shrink-0">Manga:</span>
                            <div className="flex-1 grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => { setShirtSleeveType('corta'); setCategory('Camisas'); }}
                                    className={`h-9 rounded-xl text-[10px] font-black uppercase transition-all ${shirtSleeveType === 'corta' ? 'bg-primary text-white shadow-sm' : 'bg-white/50 text-primary/40'}`}
                                >
                                    Manga Corta
                                </button>
                                <button
                                    onClick={() => { setShirtSleeveType('larga'); setCategory('Camisas'); }}
                                    className={`h-9 rounded-xl text-[10px] font-black uppercase transition-all ${shirtSleeveType === 'larga' ? 'bg-primary text-white shadow-sm' : 'bg-white/50 text-primary/40'}`}
                                >
                                    Manga Larga
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Sub-apartado exclusivo para Faldas */}
                    {activeGroup === 'FALDAS' && (
                        <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-2xl border border-primary/10 animate-fade-in">
                            <span className="text-[9px] font-black uppercase tracking-widest text-primary/60 px-2 shrink-0">Largo:</span>
                            <div className="flex-1 grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => { setSkirtType('cortas'); setCategory('Faldas'); }}
                                    className={`h-9 rounded-xl text-[10px] font-black uppercase transition-all ${skirtType === 'cortas' ? 'bg-primary text-white shadow-sm' : 'bg-white/50 text-primary/40'}`}
                                >
                                    Corta
                                </button>
                                <button
                                    onClick={() => { setSkirtType('largas'); setCategory('Faldas'); }}
                                    className={`h-9 rounded-xl text-[10px] font-black uppercase transition-all ${skirtType === 'largas' ? 'bg-primary text-white shadow-sm' : 'bg-white/50 text-primary/40'}`}
                                >
                                    Larga
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Sub-apartado exclusivo para Calzado */}
                    {activeGroup === 'CALZADO' && (
                        <div className="flex items-center gap-2 p-2 bg-primary/5 rounded-2xl border border-primary/10 animate-fade-in">
                            <span className="text-[9px] font-black uppercase tracking-widest text-primary/60 px-2 shrink-0">Uso:</span>
                            <div className="flex-1 grid grid-cols-4 gap-1.5">
                                {(['running', 'casual', 'vestir', 'otro'] as const).map(type => (
                                    <button
                                        key={type}
                                        onClick={() => { setShoeType(type); setCategory('Calzado'); }}
                                        className={`h-9 rounded-xl text-[8px] font-black uppercase transition-all ${shoeType === type ? 'bg-primary text-white shadow-sm' : 'bg-white/50 text-primary/40'}`}
                                    >
                                        {type === 'vestir' ? 'Vestir' : type}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className={`flex flex-wrap gap-2 p-4 rounded-3xl border-2 shadow-inner transition-colors duration-500 ${totalStock > 0 ? 'bg-[#c8e6c9]/10 border-[#c8e6c9]' : 'bg-[#ffcdd2]/5 border-[#ffcdd2]'}`}>
                        {(() => {
                            const availableSizes = gender === 'Niños'
                                ? (activeGroup === 'ACCESORIOS'
                                    ? SIZE_GROUPS[activeGroup]
                                    : activeGroup === 'CALZADO'
                                        ? ['19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36']
                                        : ['0-1 mes', '2-4 meses', '4-6 meses', '6-9 meses', '9-12 meses', '1 año', '2 años', '3 años', '4 años', '5 años', '6 años', '7 años', '8 años', '9 años', '10 años', '11 años', '12 años'])
                                : (activeGroup === 'PANTALONES' && pantType === 'monos/petos')
                                    ? ['XS', 'S', 'M', 'L', 'XL']
                                    : SIZE_GROUPS[activeGroup];

                            return availableSizes.map(size => {
                                const isSelected = stockPerSize[size] !== undefined;
                                return (
                                    <div key={size} className="relative group scale-up-sm transition-transform">
                                        <button
                                            type="button"
                                            onClick={() => toggleSize(size)}
                                            className={`h-11 px-6 rounded-xl border-2 font-black text-sm transition-all flex items-center gap-2 ${isSelected ? 'bg-primary border-primary text-white shadow-lg scale-105' : 'bg-white dark:bg-accent-dark border-secondary-light/20 text-text-light dark:text-white hover:border-[#f44336]/30'}`}
                                        >
                                            {size}
                                            {isSelected && <span className="text-[10px] bg-white text-primary size-5 rounded-full flex items-center justify-center font-black animate-scale-up">{stockPerSize[size]}</span>}
                                        </button>
                                        {isSelected && (
                                            <div className="absolute -top-3 -right-3 flex flex-col gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button type="button" onClick={() => updateStockForSize(size, true)} className="size-6 bg-primary text-white rounded-full shadow-lg flex items-center justify-center border-2 border-white"><Icon name="add" className="text-xs" /></button>
                                                <button type="button" onClick={() => updateStockForSize(size, false)} className="size-6 bg-white border-2 border-primary text-primary rounded-full shadow-lg flex items-center justify-center"><Icon name="remove" className="text-xs" /></button>
                                            </div>
                                        )}
                                    </div>
                                );
                            });
                        })()}
                    </div>
                </div>

                <div className="fixed bottom-0 left-0 right-0 p-4 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md border-t border-border-light dark:border-border-dark z-50">
                    <button
                        onClick={handlePublish}
                        disabled={isAIOptimizing || isPublishing}
                        className="w-full h-16 bg-primary text-white font-bold rounded-2xl shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-3 text-lg disabled:opacity-50"
                    >
                        {isPublishing ? (
                            <>
                                <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Subiendo fotos...
                            </>
                        ) : (
                            <>
                                <Icon name={isEditMode ? "save" : "rocket_launch"} />
                                {isEditMode ? "Guardar Cambios" : "Subir al Escaparate"}
                            </>
                        )}
                    </button>
                </div>
            </main>

            {/* Modal de Origen de Foto */}
            {showSourceModal && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-[4px]" onClick={() => setShowSourceModal(false)}>
                    <div className="w-[85%] max-sm max-w-sm bg-white dark:bg-accent-dark rounded-[40px] animate-slide-up pb-10 px-8 pt-6 shadow-2xl overflow-hidden border border-white/20" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-1 bg-gray-200 dark:bg-gray-700 rounded-full mx-auto mb-8"></div>
                        <h3 className="text-center text-lg font-black text-text-light dark:text-white mb-8 tracking-tight uppercase tracking-widest">Origen de la foto</h3>
                        <div className="flex gap-4">
                            <button type="button" onClick={() => cameraInputRef.current?.click()} className="flex-1 flex flex-col items-center gap-3 group">
                                <div className="size-16 bg-accent-light dark:bg-background-dark/50 rounded-[28px] flex items-center justify-center border border-border-light dark:border-border-dark group-active:scale-90 transition-transform shadow-sm">
                                    <Icon name="photo_camera" className="text-3xl text-[#C29B88]" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-text-subtle-light">Hacer Foto</span>
                            </button>
                            <button type="button" onClick={() => galleryInputRef.current?.click()} className="flex-1 flex flex-col items-center gap-3 group">
                                <div className="size-16 bg-accent-light dark:bg-background-dark/50 rounded-[28px] flex items-center justify-center border border-border-light dark:border-border-dark group-active:scale-90 transition-transform shadow-sm">
                                    <Icon name="image" className="text-3xl text-[#C29B88]" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-widest text-text-subtle-light">Galería</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
