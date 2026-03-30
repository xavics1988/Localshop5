
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { DetailHeader, Logo } from '../components/Layout';
import { useNavigate, Link, useLocation, useParams } from 'react-router-dom';
import { Product, Order, OrderStatus, Store, OrderItem, BankAccount, Review, PaymentCard, OrderEvent } from '../types';
import { useProducts, useCart, useFavorites, useFollowedStores, useNotifications, useOrders, useReviews, useUser, useStores, LOCALSHOP_PLATFORM_ACCOUNT } from '../AppContext';
import { StoreCard, ProductCard } from '../components/Card';
import { GoogleGenAI } from "@google/genai";
import { removeBackground } from '@imgly/background-removal';
import { SPANISH_PROVINCES } from './AuthScreens';
import { CLOTHING_CATEGORIES } from '../data';

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
    const navigate = useNavigate();
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

    // Filtrar solo los productos que pertenecen a la tienda del colaborador actual
    const myProducts = useMemo(() => {
        return products.filter(p => p.storeId === user.storeId);
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
                    <div className="grid grid-cols-2 gap-4">
                        {myProducts.map(product => (
                            <div key={product.id} className="relative group">
                                <ProductCard product={product} />
                                <div className="mt-2 flex gap-2">
                                    <button
                                        onClick={() => navigate(`/publish/${product.id}`)}
                                        className="flex-1 h-10 bg-primary/10 text-primary rounded-xl text-[10px] font-black uppercase tracking-widest border border-primary/20 flex items-center justify-center gap-1 active:scale-95 transition-transform"
                                    >
                                        <Icon name="edit" className="text-xs" />
                                        Editar / Reponer
                                    </button>
                                    <button
                                        onClick={() => setConfirmDeleteId(product.id)}
                                        className="size-10 bg-red-500/10 text-red-500 rounded-xl border border-red-500/20 flex items-center justify-center active:scale-95 transition-transform"
                                        title="Eliminar artículo"
                                    >
                                        <Icon name="delete" className="text-sm" />
                                    </button>
                                </div>
                                {product.stock === 0 && (
                                    <div className="absolute top-2 left-2 z-20 bg-red-500 text-white text-[8px] font-black uppercase px-2 py-1 rounded-md shadow-lg">Agotado</div>
                                )}
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
    const userRole = localStorage.getItem('userRole') || 'cliente';
    const isCollab = userRole === 'colaborador';
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
                                    <li>Pedidos de 0 € a 78,99 €: El Usuario paga los gastos de envío (entre 4,95 € y 6,95 € aprox.).</li>
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
    const userRole = localStorage.getItem('userRole') || 'cliente';
    const isCollab = userRole === 'colaborador';
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
            a: "Solo en el caso de pedidos superiores a 79 €, donde la tienda asume el coste para ofrecer envío gratuito al cliente. En pedidos menores, el cliente paga el envío."
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
            a: "El coste medio del servicio de mensajería oscila entre 4,95 € y 6,95 € para pedidos de hasta 79 €. A partir de 79 €, el envío es gratuito para el cliente."
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
}> = ({ icon, label, checked, onChange }) => (
    <div className="flex items-center justify-between p-4 bg-transparent">
        <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-accent-light dark:bg-background-dark text-text-light dark:text-text-dark">
                <Icon name={icon} className="text-xl" />
            </div>
            <span className="text-base font-medium text-text-light dark:text-text-dark">{label}</span>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="sr-only peer" />
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
    const { settings, updateSettings, notify } = useNotifications();
    const navigate = useNavigate();
    const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains('dark'));

    const toggleDarkMode = (checked: boolean) => {
        setDarkMode(checked);
        if (checked) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    };

    const handleDeleteAccount = () => {
        if (confirm('¿Estás seguro de que quieres eliminar tu cuenta? Esta acción es irreversible y perderás todos tus datos, pedidos y favoritos.')) {
            localStorage.clear();
            notify('Cuenta eliminada', 'Sentimos verte partir. Tu cuenta ha sido borrada.', 'delete_forever');
            navigate('/welcome');
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
                    <SettingsToggle
                        icon="notifications"
                        label="Notificaciones Push"
                        checked={settings.push}
                        onChange={(v) => updateSettings({ push: v })}
                    />
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
                    <SettingsLink icon="logout" label="Cerrar Sesión" showChevron={false} onClick={() => { localStorage.clear(); navigate('/welcome'); }} />
                    <div className="p-4">
                        <button
                            onClick={handleDeleteAccount}
                            className="w-full py-4 bg-red-500/10 text-red-500 font-bold rounded-xl border border-red-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                        >
                            <Icon name="person_remove" className="text-xl" />
                            Eliminar mi cuenta definitivamente
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
    const navigate = useNavigate();
    const subtotal = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

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
                            <div className="flex justify-between items-center">
                                <span className="font-black text-xl text-text-light dark:text-text-dark">Total</span>
                                <span className="text-2xl font-black text-primary">€{subtotal.toFixed(2)}</span>
                            </div>
                        </div>

                        <button onClick={() => navigate('/payment')} className="w-full h-16 bg-primary text-white font-bold rounded-2xl shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-3 text-lg">
                            <Icon name="shopping_bag" />
                            Finalizar Pedido
                        </button>
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

export const ProfileScreen: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useUser();
    const { stores } = useStores();
    const userRole = localStorage.getItem('userRole') || 'cliente';
    const isCollab = userRole === 'colaborador';

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
                {!isCollab && <ReferralCard />}

                <div className="bg-white dark:bg-accent-dark p-2 rounded-[40px] border border-border-light dark:border-border-dark shadow-2xl overflow-hidden">
                    <SettingsLink icon="person" label={isCollab ? "Datos de la Empresa" : "Mis Datos Personales"} to="/edit-profile" />
                    {isCollab && <SettingsLink icon="inventory_2" label="Gestionar mi Catálogo" to="/manage-catalog" />}
                    <SettingsLink icon={isCollab ? "receipt_long" : "shopping_bag"} label={isCollab ? "Mis Ventas" : "Mis Pedidos"} to="/orders" />
                    <SettingsLink icon="payments" label={isCollab ? "Configuración de Cobros" : "Métodos de Pago"} to="/payment-methods" />
                    <SettingsLink icon="rate_review" label={isCollab ? "Reseñas de Clientes" : "Mis Reseñas"} to="/my-reviews" />
                    {!isCollab && <SettingsLink icon="favorite" label="Mis Favoritos" to="/favorites" />}
                    <SettingsLink icon="help" label="Ayuda y Soporte" to="/help" />
                </div>

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
                    <button onClick={() => { localStorage.clear(); navigate('/welcome'); }} className="w-full py-5 text-red-500 font-black text-center active:scale-95 transition-transform">
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
                        <div className="grid grid-cols-2 gap-4">
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
                        <div className="flex flex-col gap-6">
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

export const OrdersScreen: React.FC = () => {
    const { orders, requestReturn, processReturn, updateOrderStatus } = useOrders();
    const { user } = useUser();
    const { notify } = useNotifications();
    const userRole = localStorage.getItem('userRole') || 'cliente';
    const isCollab = userRole === 'colaborador';

    // Estado para controlar qué pedidos tienen el historial desplegado
    const [expandedHistory, setExpandedHistory] = useState<Record<string, boolean>>({});

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
        return orders;
    }, [orders, isCollab, user.storeId]);

    const totalNetRevenue = useMemo(() => {
        if (!isCollab) return 0;
        return displayedOrders.reduce((acc, order) => {
            if (order.status === 'Devuelto' || order.status === 'Cancelado') return acc;
            const myItems = order.items.filter(i => i.product.storeId === user.storeId);
            return acc + myItems.reduce((sum, i) => sum + (i.product.price * i.quantity), 0);
        }, 0);
    }, [displayedOrders, isCollab, user.storeId]);

    const handleConfirmReceipt = (orderId: string) => {
        updateOrderStatus(orderId, 'Completado');
        notify('¡Pedido recibido!', 'Tu compra ha sido marcada como completada.', 'check_circle');
    };

    const handleRequestReturn = (orderId: string) => {
        requestReturn(orderId);
        notify('Solicitud enviada', 'success');
    };

    const handleConfirmReception = (orderId: string) => {
        processReturn(orderId);
        notify('Devolución Aceptada', 'El stock ha sido actualizado automáticamente.', 'inventory_2');
    };

    const handleAcceptOrder = (orderId: string) => {
        updateOrderStatus(orderId, 'En Proceso');
        notify('Pedido Aceptado', 'El cliente ha sido notificado y el pedido está en proceso.', 'local_shipping');
    };

    const handleCancelOrder = (orderId: string) => {
        updateOrderStatus(orderId, 'Cancelado');
        notify('Pedido Cancelado', 'Se ha cancelado la venta.', 'cancel');
    };

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen pb-20">
            <span className="sr-only">Orders</span>
            <DetailHeader title={isCollab ? "Mis Ventas" : "Mis Pedidos"} backTo="/profile" />
            <main className="p-4 space-y-4 animate-fade-in">

                {isCollab && displayedOrders.length > 0 && (
                    <div className="bg-primary/10 border border-primary/20 p-6 rounded-[32px] mb-6 flex justify-between items-center shadow-sm">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Resumen Contable</p>
                            <h2 className="text-xl font-black text-text-light dark:text-text-dark">Ingresos Netos</h2>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-black text-primary">
                                €{totalNetRevenue.toFixed(2)}
                            </p>
                            <p className="text-[8px] font-bold text-text-subtle-light uppercase tracking-tighter">Excluyendo anulaciones</p>
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

                        // Accounting logic: if returned, order value is 0 for net revenue
                        const orderValue = isReturned ? 0 : myItems.reduce((acc, i) => acc + (i.product.price * i.quantity), 0);
                        const originalValue = myItems.reduce((acc, i) => acc + (i.product.price * i.quantity), 0);

                        // Lógica de elegibilidad para devolución (Sin usar Hooks dentro de bucles)
                        const orderDate = new Date(order.date);
                        const now = new Date();
                        const diffInDays = (now.getTime() - orderDate.getTime()) / (1000 * 3600 * 24);
                        const isEligibleForReturn = !isCollab && order.status === 'Completado' && diffInDays < 14;

                        return (
                            <div key={order.id} className={`bg-white dark:bg-accent-dark rounded-3xl border p-6 shadow-sm space-y-4 transition-all ${isReturned ? 'opacity-60 grayscale-[0.3] border-red-200 dark:border-red-900/20' : 'border-border-light dark:border-border-dark hover:border-primary/30'}`}>

                                {isReturned && (
                                    <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 p-3 rounded-2xl mb-2 border border-red-100 dark:border-red-900/20">
                                        <Icon name={order.status === 'Cancelado' ? 'cancel' : 'assignment_return'} className="text-sm" filled />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Contabilidad: Venta Anulada</span>
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

                                {/* Botón Toggle de Trazabilidad */}
                                <div className="pt-2">
                                    <button
                                        onClick={() => toggleHistory(order.id)}
                                        className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.1em] text-primary/70 hover:text-primary transition-colors bg-primary/5 px-3 py-1.5 rounded-full"
                                    >
                                        <Icon name={isExpanded ? "unfold_less" : "history"} className="text-[12px]" filled={isExpanded} />
                                        {isExpanded ? "Ocultar trazabilidad" : "Ver historial de estados"}
                                    </button>

                                    {isExpanded && (
                                        <div className="animate-fade-in border-t border-border-light dark:border-border-dark mt-3 pt-1">
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
                                            €{(isReturned ? originalValue : orderValue).toFixed(2)}
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

                                            {isEligibleForReturn && (
                                                <button
                                                    onClick={() => handleRequestReturn(order.id)}
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
            </main>
        </div>
    );
};

export const PaymentScreen: React.FC = () => {
    const navigate = useNavigate();
    const { cartItems, clearCart } = useCart();
    const { addOrder } = useOrders();
    const { user, paymentMethods, addPaymentMethod, useReferralBalance } = useUser();
    const { notify } = useNotifications();
    const [success, setSuccess] = useState(false);
    const [cardData, setCardData] = useState({ number: '', holder: user.name || '', expiry: '', cvv: '' });
    const [useReferral, setUseReferral] = useState(false);

    const subtotal = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const hasCard = paymentMethods.length > 0;
    const selectedCard = hasCard ? paymentMethods[0] : null;

    const referralDiscount = useReferral ? Math.min(subtotal, user.referralBalance || 0) : 0;
    const finalTotal = Math.max(0, subtotal - referralDiscount);

    const handleConfirmPayment = () => {
        if (cartItems.length === 0) return;

        if (!hasCard) {
            // Validaciones Estrictas
            const rawNumber = cardData.number.replace(/\s/g, '');
            if (!cardData.number || !cardData.expiry || !cardData.cvv) {
                notify('Datos incompletos', 'Por favor, rellena los datos de tu tarjeta para continuar.', 'error');
                return;
            }
            if (rawNumber.length !== 16) {
                notify('Error', 'El número de tarjeta debe tener exactamente 16 dígitos.', 'error');
                return;
            }
            if (cardData.cvv.length < 3 || cardData.cvv.length > 4) {
                notify('Error', 'El CVV debe tener 3 o 4 dígitos.', 'error');
                return;
            }
            if (!/^\d{2}\/\d{2}$/.test(cardData.expiry)) {
                notify('Error', 'Formato de caducidad incorrecto (MM/YY).', 'error');
                return;
            }

            // Guardamos la tarjeta automáticamente
            addPaymentMethod({
                last4: rawNumber.slice(-4),
                brand: rawNumber.startsWith('4') ? 'Visa' : 'Mastercard',
                expiry: cardData.expiry,
                holder: cardData.holder || user.name
            });
        }

        // Si se usa saldo de referidos, descontarlo
        if (referralDiscount > 0) {
            useReferralBalance(referralDiscount);
        }

        // PROCESAMIENTO HACIA CUENTA CENTRAL
        addOrder({
            customerName: user.name,
            items: [...cartItems],
            total: finalTotal
        });

        setSuccess(true);
        notify('¡Pago realizado!', `Fondos dirigidos a ${LOCALSHOP_PLATFORM_ACCOUNT.bankName}.`, 'lock');
    };

    if (success) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                <div className="size-24 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                    <Icon name="check_circle" className="text-6xl text-primary" filled />
                </div>
                <h1 className="text-3xl font-black mb-2 text-text-light dark:text-text-dark">¡Pedido confirmado!</h1>
                <p className="text-text-subtle-light font-medium px-8 leading-relaxed">Tu compra se ha procesado con éxito. Los fondos han sido depositados en la cuenta de la plataforma y las tiendas están preparando tus artículos.</p>
                <button onClick={() => navigate('/')} className="mt-12 px-10 py-4 bg-primary text-white font-bold rounded-2xl shadow-xl active:scale-95 transition-transform">Volver al Inicio</button>
            </div>
        );
    }

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen pb-24">
            <DetailHeader title="Finalizar Pedido" />
            <div className="p-4 space-y-6">
                <div className="bg-white dark:bg-accent-dark p-6 rounded-[32px] border border-border-light dark:border-border-dark shadow-sm">
                    <h3 className="text-sm font-black uppercase tracking-widest text-text-subtle-light mb-4">Resumen del Pago</h3>
                    <div className="flex justify-between items-center py-2 border-b border-border-light/50">
                        <span className="text-sm font-bold text-text-light dark:text-text-dark">Subtotal</span>
                        <span className="text-sm font-bold text-text-light dark:text-text-dark">€{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-border-light/50">
                        <span className="text-sm font-bold text-text-light dark:text-text-dark">Envío (Local)</span>
                        <span className="text-sm font-bold text-green-500 uppercase tracking-widest text-[10px]">Gratis</span>
                    </div>

                    {/* Selector de Saldo de Referidos */}
                    {user.referralBalance > 0 && (
                        <div className="py-4 border-b border-border-light/50">
                            <label className="flex items-center justify-between cursor-pointer group">
                                <div className="flex flex-col">
                                    <span className="text-sm font-bold text-text-light dark:text-text-dark">Usar mi saldo de referidos</span>
                                    <span className="text-[10px] font-black uppercase text-primary">Disponible: €{user.referralBalance.toFixed(2)}</span>
                                </div>
                                <div className="relative inline-flex items-center">
                                    <input
                                        type="checkbox"
                                        checked={useReferral}
                                        onChange={e => setUseReferral(e.target.checked)}
                                        className="sr-only peer"
                                    />
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

                {/* Nueva sección de Método de Pago */}
                <div className="bg-white dark:bg-accent-dark p-6 rounded-[32px] border border-border-light dark:border-border-dark shadow-sm space-y-4">
                    <h3 className="text-sm font-black uppercase tracking-widest text-text-subtle-light mb-2">Método de Pago</h3>
                    {hasCard ? (
                        <div className="flex items-center gap-4 bg-primary/5 p-4 rounded-2xl border border-primary/20">
                            <Icon name="credit_card" className="text-primary" />
                            <div className="flex-1">
                                <p className="text-sm font-bold text-text-light dark:text-text-dark">{selectedCard?.brand} •••• {selectedCard?.last4}</p>
                                <p className="text-[10px] font-bold text-text-subtle-light uppercase">Vence {selectedCard?.expiry}</p>
                            </div>
                            <Icon name="check_circle" className="text-green-500" filled />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <FormInput
                                label="Número de tarjeta"
                                placeholder="0000 0000 0000 0000"
                                value={cardData.number}
                                maxLength={19}
                                onChange={(v: string) => {
                                    const val = v.replace(/\D/g, '').substring(0, 16);
                                    setCardData(p => ({ ...p, number: val.match(/.{1,4}/g)?.join(' ') || '' }));
                                }}
                            />
                            <FormInput
                                label="Titular"
                                placeholder="Nombre completo"
                                value={cardData.holder}
                                onChange={(v: string) => setCardData(p => ({ ...p, holder: v }))}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <FormInput
                                    label="Caducidad"
                                    placeholder="MM/YY"
                                    value={cardData.expiry}
                                    maxLength={5}
                                    onChange={(v: string) => {
                                        const val = v.replace(/\D/g, '').substring(0, 4);
                                        let formatted = val;
                                        if (val.length > 2) formatted = val.substring(0, 2) + '/' + val.substring(2);
                                        setCardData(p => ({ ...p, expiry: formatted }));
                                    }}
                                />
                                <FormInput
                                    label="CVV"
                                    placeholder="123"
                                    type="password"
                                    maxLength={4}
                                    value={cardData.cvv}
                                    onChange={(v: string) => setCardData(p => ({ ...p, cvv: v.replace(/\D/g, '').substring(0, 4) }))}
                                />
                            </div>
                            <p className="text-[10px] text-text-subtle-light italic leading-tight">Tu tarjeta se guardará de forma segura en tu perfil para futuras compras.</p>
                        </div>
                    )}
                </div>

                <div className="bg-primary/5 border border-primary/20 p-5 rounded-2xl flex gap-4 items-center">
                    <Icon name="verified_user" className="text-primary text-2xl" />
                    <div className="flex-1">
                        <p className="text-[10px] font-bold text-primary/80 leading-relaxed">
                            Pago 100% seguro gestionado por LocalShop. Fondos depositados en la cuenta de garantía:
                            <span className="block font-black opacity-60">{LOCALSHOP_PLATFORM_ACCOUNT.iban}</span>
                        </p>
                    </div>
                </div>

                <button
                    onClick={handleConfirmPayment}
                    className="w-full h-16 bg-primary text-white font-bold rounded-2xl shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-3 text-lg"
                >
                    <Icon name="lock" />
                    Confirmar Pago a LocalShop
                </button>
            </div>
        </div>
    );
};

export const PurchaseHistoryScreen: React.FC = () => <Placeholder title="Historial" backTo="/profile" />;

export const CollaboratorRegistrationScreen: React.FC = () => <Placeholder title="Registro de Colaborador" />;

export const PaymentMethodsScreen: React.FC = () => {
    const userRole = localStorage.getItem('userRole') || 'cliente';
    const isCollab = userRole === 'colaborador';
    const navigate = useNavigate();
    const { notify } = useNotifications();
    const { addBankAccount, paymentMethods, addPaymentMethod, removePaymentMethod, user } = useUser();

    const [cardForm, setCardForm] = useState({
        number: '',
        holder: user.name || '',
        expiry: '',
        cvv: ''
    });

    const [bankForm, setBankForm] = useState({
        holder: '',
        iban: '',
        bankName: '',
        bic: ''
    });

    const handleAddCard = () => {
        if (!cardForm.number || !cardForm.holder || !cardForm.expiry || !cardForm.cvv) {
            notify('Error', 'Por favor, rellena todos los datos de la tarjeta.', 'error');
            return;
        }

        // Validación de Longitud Exacta
        const rawNumber = cardForm.number.replace(/\s/g, '');
        if (rawNumber.length !== 16) {
            notify('Error', 'El número de tarjeta debe tener 16 dígitos.', 'error');
            return;
        }
        if (cardForm.cvv.length < 3 || cardForm.cvv.length > 4) {
            notify('Error', 'El CVV debe tener 3 o 4 dígitos.', 'error');
            return;
        }
        if (!/^\d{2}\/\d{2}$/.test(cardForm.expiry)) {
            notify('Error', 'La caducidad debe tener formato MM/YY.', 'error');
            return;
        }

        const last4 = rawNumber.slice(-4);
        const brand = rawNumber.startsWith('4') ? 'Visa' : 'Mastercard';
        addPaymentMethod({
            last4,
            brand,
            expiry: cardForm.expiry,
            holder: cardForm.holder
        });
        setCardForm({ number: '', holder: user.name || '', expiry: '', cvv: '' });
        notify('Tarjeta Guardada', 'Tu método de pago ha sido añadido con éxito.', 'check_circle');
    };

    const handleAddBank = () => {
        const rawIban = bankForm.iban.replace(/\s/g, '');
        if (!bankForm.holder || !bankForm.iban) {
            notify('Error', 'El titular y el IBAN son obligatorios.', 'error');
            return;
        }
        if (rawIban.length !== 24) {
            notify('Error', 'El IBAN debe tener exactamente 24 caracteres.', 'error');
            return;
        }
        addBankAccount({
            holder: bankForm.holder,
            iban: bankForm.iban,
            bankName: bankForm.bankName || 'Banco Desconocido',
            bic: bankForm.bic,
            isDefault: true
        });
        notify('Cuenta Guardada', 'Tus depósitos se enviarán a esta cuenta.', 'check_circle');
        navigate(-1);
    };

    if (!isCollab) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen pb-24">
                <DetailHeader title="Métodos de Pago" backTo="/profile" />
                <main className="p-4 space-y-6 animate-fade-in">
                    <div className="bg-white dark:bg-accent-dark p-6 rounded-[32px] border border-border-light dark:border-border-dark shadow-sm space-y-6">
                        <div className="flex items-center gap-3 mb-2">
                            <Icon name="add_card" className="text-primary text-xl" />
                            <h3 className="text-sm font-black uppercase tracking-widest text-text-light dark:text-text-dark">Nueva Tarjeta</h3>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-text-subtle-light">Número de tarjeta (16 dígitos)</label>
                                <input
                                    value={cardForm.number}
                                    maxLength={19}
                                    onChange={e => {
                                        const val = e.target.value.replace(/\D/g, '').substring(0, 16);
                                        setCardForm(p => ({ ...p, number: val.match(/.{1,4}/g)?.join(' ') || '' }));
                                    }}
                                    className="w-full h-12 bg-accent-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 text-sm font-bold text-text-light dark:text-text-dark outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="0000 0000 0000 0000"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-text-subtle-light">Titular</label>
                                <input
                                    value={cardForm.holder}
                                    onChange={e => setCardForm(p => ({ ...p, holder: e.target.value }))}
                                    className="form-input w-full rounded-lg border border-border-light bg-white dark:bg-background-dark dark:border-border-dark text-text-light dark:text-text-dark h-12 pl-3 pr-3 text-base outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                    placeholder="Nombre como aparece en la tarjeta"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-text-subtle-light">Caducidad (MM/YY)</label>
                                    <input
                                        value={cardForm.expiry}
                                        maxLength={5}
                                        onChange={e => {
                                            const val = e.target.value.replace(/\D/g, '').substring(0, 4);
                                            let formatted = val;
                                            if (val.length > 2) formatted = val.substring(0, 2) + '/' + val.substring(2);
                                            setCardForm(p => ({ ...p, expiry: formatted }));
                                        }}
                                        className="w-full h-12 bg-accent-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 text-sm font-bold text-text-light dark:text-text-dark outline-none focus:ring-2 focus:ring-primary/20"
                                        placeholder="MM/YY"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-text-subtle-light">CVV (3-4 dígitos)</label>
                                    <input
                                        value={cardForm.cvv}
                                        maxLength={4}
                                        onChange={e => setCardForm(p => ({ ...p, cvv: e.target.value.replace(/\D/g, '').substring(0, 4) }))}
                                        className="w-full h-12 bg-accent-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 text-sm font-bold text-text-light dark:text-text-dark outline-none focus:ring-2 focus:ring-primary/20"
                                        placeholder="123"
                                        type="password"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-4 pt-4">
                            <button onClick={() => navigate(-1)} className="flex-1 h-12 rounded-xl bg-accent-light dark:bg-background-dark border border-border-light dark:border-border-dark text-sm font-bold text-text-subtle-light active:scale-95 transition-all">Cancelar</button>
                            <button onClick={handleAddCard} className="flex-[1.5] h-12 rounded-xl bg-primary text-white text-sm font-black uppercase tracking-wider shadow-lg active:scale-95 transition-all">Guardar</button>
                        </div>
                    </div>
                    {paymentMethods.length > 0 && (
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
                                                <p className="text-[10px] font-bold text-text-subtle-light uppercase">{card.expiry}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => removePaymentMethod(card.id)} className="text-red-400 p-2 active:scale-90 transition-transform">
                                            <Icon name="delete" className="text-xl" />
                                        </button>
                                    </div>
                                ))}
                            </div>
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
                <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 p-5 rounded-[24px] flex gap-4 items-start">
                    <div className="size-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon name="info" className="text-primary text-xl" />
                    </div>
                    <div className="space-y-1">
                        <h4 className="font-black text-sm text-primary">Depósitos Directos</h4>
                        <p className="text-xs text-text-subtle-light dark:text-text-subtle-dark leading-relaxed">
                            Configura tu cuenta bancaria para recibir los ingresos de tus ventas. Las transferencias se realizan automáticamente cada 15 días.
                        </p>
                    </div>
                </div>
                <div className="bg-white dark:bg-accent-dark rounded-[32px] border border-primary/30 p-6 shadow-sm space-y-6">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Icon name="account_balance" className="text-primary text-lg" />
                        </div>
                        <h3 className="text-sm font-black uppercase tracking-wider text-text-light dark:text-text-dark">Añadir Cuenta Bancaria</h3>
                    </div>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-text-subtle-light">Titular de la cuenta</label>
                            <input
                                value={bankForm.holder}
                                onChange={e => setBankForm(p => ({ ...p, holder: e.target.value }))}
                                className="w-full h-12 bg-accent-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 text-sm font-bold text-text-light dark:text-white outline-none focus:ring-2 focus:ring-primary/20"
                                placeholder="Ej: Elena García Martín"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-text-subtle-light">IBAN (24 caracteres)</label>
                            <input
                                value={bankForm.iban}
                                maxLength={29}
                                onChange={e => {
                                    const raw = e.target.value.replace(/[^A-Z0-9]/gi, '').toUpperCase().substring(0, 24);
                                    const formatted = raw.match(/.{1,4}/g)?.join(' ') || '';
                                    setBankForm(p => ({ ...p, iban: formatted }));
                                }}
                                className="w-full h-12 bg-accent-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 text-sm font-bold text-text-light dark:text-white outline-none focus:ring-2 focus:ring-primary/20"
                                placeholder="ES00 0000 0000 0000 0000 0000"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-text-subtle-light">Nombre del banco</label>
                                <input
                                    value={bankForm.bankName}
                                    onChange={e => setBankForm(p => ({ ...p, bankName: e.target.value }))}
                                    className="w-full h-12 bg-accent-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 text-sm font-bold text-text-light dark:text-white outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="Ej: BBVA, Santander..."
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-text-subtle-light">BIC / SWIFT</label>
                                <input
                                    value={bankForm.bic}
                                    onChange={e => setBankForm(p => ({ ...p, bic: e.target.value }))}
                                    className="w-full h-12 bg-accent-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 text-sm font-bold text-text-light dark:text-white outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="Opcional"
                                />
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-4 pt-4">
                        <button onClick={() => navigate(-1)} className="flex-1 h-12 rounded-xl bg-accent-light dark:bg-background-dark border border-border-light dark:border-border-dark text-sm font-bold text-text-subtle-light active:scale-95 transition-all">Cancelar</button>
                        <button onClick={handleAddBank} className="flex-[1.5] h-12 rounded-xl bg-primary text-white text-sm font-black uppercase tracking-wider shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
                            <span className="material-symbols-outlined text-white text-lg">check</span>
                            Confirmar
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
};

export const EditCustomerProfileScreen: React.FC = () => {
    const { user, updateUser } = useUser();
    const { updateStore, stores } = useStores();
    const navigate = useNavigate();
    const { notify } = useNotifications();
    const userRole = localStorage.getItem('userRole') || 'cliente';
    const isCollab = userRole === 'colaborador';

    const currentStore = useMemo(() => isCollab ? stores.find(s => s.id === user.storeId) : null, [stores, isCollab, user.storeId]);

    const [formData, setFormData] = useState({
        displayName: user.name || '',
        businessName: isCollab ? (currentStore?.businessName || '') : '',
        displayLocation: isCollab ? (currentStore?.address || '') : (user.location || ''),
        displayBio: isCollab ? (currentStore?.description || '') : (user.bio || ''),
        category: currentStore?.category || 'Multimarca',
        cif: currentStore?.cif || '',
        email: user.email || '',
        phone: user.phone || ''
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
        if (isCollab && user.storeId) {
            updateStore(user.storeId, {
                businessName: formData.businessName,
                address: formData.displayLocation,
                category: formData.category,
                description: formData.displayBio,
                cif: formData.cif
                // El imageUrl para colaboradores registrados se mantiene vacío para usar la Identidad Digital automática
            });
            updateUser({
                email: formData.email,
                phone: formData.phone
            });
            notify('Negocio Actualizado', 'Los datos de tu empresa se han guardado.', 'check_circle');
        } else {
            updateUser({
                name: formData.displayName,
                avatar: avatar || undefined,
                bio: formData.displayBio,
                location: formData.displayLocation,
                email: formData.email,
                phone: formData.phone
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
                        onChange={(v: string) => setFormData(p => ({ ...p, displayName: v }))}
                        disabled={isCollab}
                        required
                    />
                    {isCollab && (
                        <>
                            <FormInput label="Nombre Legal / Empresa (Privado)" placeholder="Nombre de la sociedad" value={formData.businessName} onChange={(v: string) => setFormData(p => ({ ...p, businessName: v }))} required />
                            <FormInput label="CIF / NIF" placeholder="B-12345678" value={formData.cif} onChange={(v: string) => setFormData(p => ({ ...p, cif: v }))} required />
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
                        <textarea value={formData.displayBio} onChange={e => setFormData(p => ({ ...p, displayBio: e.target.value }))} className="w-full h-32 bg-white dark:bg-accent-dark border border-border-light dark:border-border-dark rounded-xl px-4 py-3 text-sm font-medium resize-none outline-none text-text-light dark:text-white" placeholder={isCollab ? "Cuenta la historia de tu negocio..." : "Un poco sobre ti..."} />
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

const SIZE_GROUPS: Record<string, string[]> = {
    'CAMISETAS': ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Talla Única', 'Sin talla'],
    'CAMISAS': ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'Talla Única'],
    'SUDADERAS': ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    'PANTALONES': ['34', '36', '38', '40', '42', '44', '46', '48', '50'],
    'FALDAS': ['34', '36', '38', '40', '42', '44', '46', '48'],
    'MONOS/PETOS': ['XS', 'S', 'M', 'L', 'XL'],
    'CHAQUETAS/ABRIGOS': ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
    'TRAJES': ['44', '46', '48', '50', '52', '54', '56', '58'],
    'VESTIDOS': ['34', '36', '38', '40', '42', '44', '46', '48'],
    'CALZADO': ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49'],
    'ROPA INTERIOR': ['XS', 'S', 'M', 'L', 'XL'],
    'PIJAMAS': ['XS', 'S', 'M', 'L', 'XL'],
    'ROPA DE BAÑO': ['XS', 'S', 'M', 'L', 'XL'],
    'BEBÉ': ['0-1 mes', '2-4 meses', '4-6 meses', '6-9 meses', '9-12 meses'],
    'NIÑOS': ['2 años', '3 años', '4 años', '5 años', '6 años', '7 años', '8 años', '9 años', '10 años', '11 años', '12 años'],
    'ACCESORIOS': ['Talla Única', 'Ajustable', 'Pequeño', 'Mediano', 'Grande', 'Pack']
};

export const PublishScreen: React.FC = () => {
    const { addProduct, updateProduct, getProductById } = useProducts();
    const { productId } = useParams();
    const isEditMode = !!productId;
    const { user, bankAccounts } = useUser();
    const { notify } = useNotifications();
    const navigate = useNavigate();

    // Verificación de cuenta bancaria para colaboradores
    const userRole = localStorage.getItem('userRole') || 'cliente';
    const isCollab = userRole === 'colaborador';
    const hasBankAccount = bankAccounts.length > 0;

    // Estados específicos para los nuevos campos
    const [gender, setGender] = useState<'Hombre' | 'Mujer' | 'Unisex'>('Mujer');
    const [garment, setGarment] = useState('');
    const [brand, setBrand] = useState('');
    const [color, setColor] = useState('');
    const [model, setModel] = useState('');

    const [price, setPrice] = useState('');
    const [category, setCategory] = useState('Camisetas');
    const [pantType, setPantType] = useState<'cortos' | 'largos'>('largos');
    const [sleeveType, setSleeveType] = useState<'corta' | 'larga'>('corta');
    const [shirtSleeveType, setShirtSleeveType] = useState<'corta' | 'larga'>('larga');
    const [skirtType, setSkirtType] = useState<'cortas' | 'largas'>('cortas');
    const [shoeType, setShoeType] = useState<'running' | 'casual' | 'vestir' | 'otro'>('casual');

    const [description, setDescription] = useState('');
    const [activeGroup, setActiveGroup] = useState('CAMISETAS');
    const [stockPerSize, setStockPerSize] = useState<Record<string, number>>({});

    const [images, setImages] = useState<(string | null)[]>([null, null, null]);

    const [isAIOptimizing, setIsAIOptimizing] = useState(false);
    const [showSourceModal, setShowSourceModal] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [activeSlot, setActiveSlot] = useState<number | null>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);
    const categoryScrollRef = useRef<HTMLDivElement>(null);

    // Cargar datos si estamos en modo edición
    useEffect(() => {
        if (isEditMode && productId) {
            const prod = getProductById(productId);
            if (prod) {
                setGarment(prod.name.split(' ')[0] || '');
                setBrand(prod.storeName === 'Retrospect Vintage' || prod.storeName === 'The Modernist' ? 'Local' : (prod.name.split(' ')[1] || ''));
                setPrice(prod.price.toString());
                setDescription(prod.description || '');
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
                } else {
                    setCategory(prod.category || 'Camisetas');
                }

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

    // UI de Bloqueo por falta de cuenta bancaria
    if (isCollab && !hasBankAccount) {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen pb-32">
                <DetailHeader title="Activación de Escaparate" />
                <main className="p-6 flex flex-col items-center justify-center min-h-[70vh] text-center animate-fade-in">
                    <div className="size-24 bg-primary/10 rounded-full flex items-center justify-center mb-8 shadow-inner">
                        <Icon name="account_balance" className="text-6xl text-primary" filled />
                    </div>
                    <h2 className="text-2xl font-black text-text-light dark:text-white uppercase tracking-tight mb-4 leading-tight">
                        Configura tus Cobros
                    </h2>
                    <div className="bg-white dark:bg-accent-dark p-6 rounded-[32px] border border-primary/20 shadow-xl space-y-4 max-w-sm">
                        <p className="text-sm text-text-subtle-light dark:text-text-subtle-dark leading-relaxed font-medium">
                            Para empezar a publicar artículos es obligatorio configurar tu cuenta bancaria.
                        </p>
                        <div className="py-3 border-y border-border-light dark:border-border-dark space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-text-light dark:text-gray-400">Suscripción Mensual</span>
                                <span className="text-sm font-black text-primary">2,49€</span>
                            </div>
                            <p className="text-[10px] text-text-subtle-light italic">Se cobrará mensualmente a la cuenta configurada.</p>
                        </div>
                        <p className="text-xs text-text-subtle-light font-bold">
                            Los ingresos de tus ventas se depositarán automáticamente en esta cuenta.
                        </p>
                    </div>

                    <div className="w-full max-w-sm mt-10">
                        <button
                            onClick={() => navigate('/payment-methods')}
                            className="w-full h-16 bg-primary text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-3"
                        >
                            <Icon name="payments" />
                            Configurar ahora
                        </button>
                        <button
                            onClick={() => navigate(-1)}
                            className="w-full h-14 mt-4 text-text-subtle-light font-bold text-sm uppercase"
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
                // 1. Quitar fondo localmente con @imgly/background-removal
                let imageBlob: Blob = file;
                try {
                    // Forzar máxima resolución y modelo avanzado
                    imageBlob = await removeBackground(file, {
                        model: 'isnet', // El modelo de mayor fidelidad de bordes de la librería
                        output: {
                            format: 'image/png',
                            quality: 1.0
                        }
                    });
                } catch (e) {
                    console.error("Error quitando fondo", e);
                }
                
                // 2. Colocarlo sobre un fondo gris de estudio en un canvas
                const finalImageBase64 = await new Promise<string>((resolve) => {
                    const img = new Image();
                    img.onload = () => {
                        // Usar las dimensiones originales reales de la foto
                        const width = img.naturalWidth || img.width;
                        const height = img.naturalHeight || img.height;
                        
                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            // Aplicar un renderizado de alta calidad en el canvas
                            ctx.imageSmoothingEnabled = true;
                            ctx.imageSmoothingQuality = 'high';
                            
                            // Fondo de estudio
                            ctx.fillStyle = '#C9D0D6';
                            ctx.fillRect(0, 0, width, height);
                            // Dibujar la imagen procesada encima
                            ctx.drawImage(img, 0, 0, width, height);
                        }
                        // Exportar a máxima calidad
                        resolve(canvas.toDataURL('image/jpeg', 1.0));
                    };
                    img.src = URL.createObjectURL(imageBlob);
                });

                const base64Data = finalImageBase64.split(',')[1];
                const mimeType = 'image/jpeg';
                
                // 3. Mandar el resultado a Gemini para extraer los datos
                const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "AIzaSyBOYgm_kwJcvfQA0hjEdCrKSlqXYQcGmdE";
                if (!apiKey) {
                    throw new Error("API Key no detectada. Asegúrate de reiniciar el servidor Vite.");
                }
                const ai = new GoogleGenAI({ apiKey });
                const categoriesList = CLOTHING_CATEGORIES.join(', ');

                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: {
                        parts: [
                            { inlineData: { data: base64Data, mimeType } },
                            {
                                text: `CRITICAL INSTRUCTION: Analyze the garment in the image and return EXACTLY this format:
                                PRENDA: [Tipo de prenda (ej. Camiseta, Pantalón)]
                                MARCA: [Marca detectada o 'Local']
                                COLOR: [Color principal]
                                GÉNERO: [Mujer, Hombre o Unisex]
                                CATEGORÍA_RAIZ: [Debe ser obligatoriamente una exacta de la lista: ${categoriesList}]
                                SUB_APARTADO: [Específico: pantalones largos, camiseta manga corta, zapatillas running, etc.]
                                DESCRIPCIÓN: [Descripción corta y muy atractiva para la venta de 2 a 3 líneas sobre su estado y estilo]` 
                            }
                        ]
                    }
                });

                const fullText = response.text || "";
                const garmentMatch = fullText.match(/PRENDA:\s*(.*)/i);
                const brandMatch = fullText.match(/MARCA:\s*(.*)/i);
                const colorMatch = fullText.match(/COLOR:\s*(.*)/i);
                const genderMatch = fullText.match(/GÉNERO:\s*(.*)/i);
                const rootCatMatch = fullText.match(/CATEGORÍA_RAIZ:\s*(.*)/i);
                const subMatch = fullText.match(/SUB_APARTADO:\s*(.*)/i);
                const descMatch = fullText.match(/DESCRIPCIÓN:\s*([\s\S]*)/i);

                if (targetSlot === 0 || !garment) {
                    if (garmentMatch && garmentMatch[1]) setGarment(garmentMatch[1].split(/\n/)[0].trim());
                    if (brandMatch && brandMatch[1]) setBrand(brandMatch[1].split(/\n/)[0].trim());
                    if (colorMatch && colorMatch[1]) setColor(colorMatch[1].split(/\n/)[0].trim());
                    if (descMatch && descMatch[1]) setDescription(descMatch[1].trim());

                    if (genderMatch && genderMatch[1]) {
                        const g = genderMatch[1].trim();
                        if (g.includes('Mujer')) setGender('Mujer');
                        else if (g.includes('Hombre')) setGender('Hombre');
                        else if (g.includes('Unisex')) setGender('Unisex');
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

                notify('IA LocalShop', 'Foto optimizada con fondo de estudio.', 'auto_awesome');
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
    };

    const handleGalleryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
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

    const handlePublish = (e: React.FormEvent) => {
        e.preventDefault();
        const validImages = images.filter((img): img is string => img !== null);
        if (!garment || !price || validImages.length === 0) {
            notify('Incompleto', 'Rellena los datos básicos y al menos una foto.', 'error');
            return;
        }

        const finalName = `${garment} ${brand} ${model} ${color}`.trim().replace(/\s+/g, ' ');
        let finalCategory = category;
        if (category === 'Pantalones') finalCategory = `Pantalones ${pantType}`;
        else if (category === 'Camisetas') finalCategory = `Camisetas manga ${sleeveType}`;
        else if (category === 'Camisas') finalCategory = `Camisas manga ${shirtSleeveType}`;
        else if (category === 'Faldas') finalCategory = `Faldas ${skirtType}`;
        else if (category === 'Calzado') finalCategory = `Calzado ${shoeType}`;

        const productData = {
            name: finalName,
            price: parseFloat(price),
            imageUrl: validImages[0],
            images: validImages.slice(1),
            description,
            category: finalCategory,
            gender: gender,
            stock: totalStock,
            stockPerSize,
            sizes: Object.keys(stockPerSize)
        };

        if (isEditMode && productId) {
            if (updateProduct(productId, productData)) {
                notify('¡Actualizado!', 'Los cambios se han guardado con éxito.', 'check_circle');
                navigate('/manage-catalog');
            }
        } else {
            const newProduct: Product = {
                id: `PROD-${Date.now()}`,
                storeName: user.name,
                storeId: user.storeId || '1',
                ...productData
            };
            if (addProduct(newProduct)) {
                notify('¡Publicado!', 'Tu artículo ya está en el escaparate.', 'check_circle');
                navigate('/manage-catalog');
            }
        }
    };

    const handleCategorySelect = (c: string) => {
        setCategory(c);
        const upperC = c.toUpperCase();
        if (SIZE_GROUPS[upperC]) setActiveGroup(upperC);
        else if (c === 'Pantalones') setActiveGroup('PANTALONES');
        else if (c === 'Calzado') setActiveGroup('CALZADO');
        else if (c === 'Bebé') setActiveGroup('BEBÉ');
        else if (c === 'Niños') setActiveGroup('NIÑOS');
        else if (c === 'Accesorios') setActiveGroup('ACCESORIOS');
        else setActiveGroup('CAMISETAS');
        setShowCategoryModal(false);
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
                        <label className="text-[10px] font-black uppercase tracking-widest text-text-subtle-light">
                            Fotos del artículo (mín. 1 - máx. 3)
                        </label>
                        <span className="text-[10px] font-black uppercase text-red-500">{uploadedCount}/3 seleccionadas</span>
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
                                onChange={e => setGarment(e.target.value)}
                                placeholder="Ej: Camiseta, Chaqueta..."
                                className={`w-full h-11 bg-primary/5 dark:bg-background-dark border rounded-xl px-4 text-sm font-bold text-text-light dark:text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all ${garment && !isAIOptimizing ? 'border-primary/40 shadow-[0_0_10px_rgba(194,155,136,0.1)]' : 'border-primary/10'}`}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-text-subtle-light">Marca</label>
                                <input
                                    value={brand}
                                    onChange={e => setBrand(e.target.value)}
                                    placeholder="Marca detectada"
                                    className={`w-full h-11 bg-primary/5 dark:bg-background-dark border rounded-xl px-4 text-sm font-bold text-text-light dark:text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all ${brand && !isAIOptimizing ? 'border-primary/40' : 'border-primary/10'}`}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-text-subtle-light">Color</label>
                                <input
                                    value={color}
                                    onChange={e => setColor(e.target.value)}
                                    placeholder="Color principal"
                                    className={`w-full h-11 bg-primary/5 dark:bg-background-dark border rounded-xl px-4 text-sm font-bold text-text-light dark:text-white outline-none focus:ring-2 focus:ring-primary/20 transition-all ${color && !isAIOptimizing ? 'border-primary/40' : 'border-primary/10'}`}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sección Modelo (Manual) */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 px-1">
                        <Icon name="edit_note" className="text-text-subtle-light text-sm" />
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-text-subtle-light">Detalles Manuales</h3>
                    </div>

                    <div className="bg-white dark:bg-accent-dark p-6 rounded-[32px] border border-border-light dark:border-border-dark shadow-sm space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-text-subtle-light">Modelo / Colección</label>
                            <input
                                value={model}
                                onChange={e => setModel(e.target.value)}
                                placeholder="Ej: Slim Fit, Colección Verano 24..."
                                className="w-full h-11 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 text-sm font-bold text-text-light dark:text-white outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>

                        <div className="flex gap-4">
                            <div className="flex-1 space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-text-subtle-light">Precio (€)</label>
                                <input
                                    type="number"
                                    value={price}
                                    onChange={e => setPrice(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full h-11 bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl px-4 text-sm font-bold text-text-light dark:text-white outline-none focus:ring-2 focus:ring-primary/20"
                                />
                            </div>
                            <div className="flex-1 space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-text-subtle-light">Stock Total</label>
                                <div className="w-full h-11 border border-border-light dark:border-border-dark rounded-xl flex items-center justify-center bg-background-light dark:bg-background-dark">
                                    <span className={`text-lg font-black ${totalStock > 0 ? 'text-red-500' : 'text-text-subtle-light/40'}`}>
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
                        onClick={() => setGender('Unisex')}
                        className={`flex-1 h-12 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${gender === 'Unisex' ? 'bg-primary text-white shadow-lg' : 'text-text-subtle-light dark:text-text-subtle-dark'}`}
                    >
                        <Icon name="wc" filled={gender === 'Unisex'} />
                        Unisex
                    </button>
                </div>

                {/* Gestión de Tallas y Sub-apartados (Sincronizados con IA) */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center px-1">
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-primary/60">Categoría Seleccionada: {activeGroup}</h3>
                    </div>
                    <div
                        ref={categoryScrollRef}
                        className="flex overflow-x-auto gap-2 pb-2 [-ms-scrollbar-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    >
                        {Object.keys(SIZE_GROUPS).map(g => (
                            <button
                                key={g}
                                data-active={activeGroup === g}
                                onClick={() => setActiveGroup(g)}
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
                            <div className="flex-1 grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => { setPantType('cortos'); setCategory('Pantalones'); }}
                                    className={`h-9 rounded-xl text-[10px] font-black uppercase transition-all ${pantType === 'cortos' ? 'bg-primary text-white shadow-sm' : 'bg-white/50 text-primary/40'}`}
                                >
                                    Pantalón Corto
                                </button>
                                <button
                                    onClick={() => { setPantType('largos'); setCategory('Pantalones'); }}
                                    className={`h-9 rounded-xl text-[10px] font-black uppercase transition-all ${pantType === 'largos' ? 'bg-primary text-white shadow-sm' : 'bg-white/50 text-primary/40'}`}
                                >
                                    Pantalón Largo
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

                    <div className="flex flex-wrap gap-2">
                        {SIZE_GROUPS[activeGroup].map(size => {
                            const isSelected = stockPerSize[size] !== undefined;
                            return (
                                <div key={size} className="relative group">
                                    <button
                                        type="button"
                                        onClick={() => toggleSize(size)}
                                        className={`h-11 px-6 rounded-xl border-2 font-black text-sm transition-all flex items-center gap-2 ${isSelected ? 'bg-primary/20 border-primary text-primary' : 'bg-white dark:bg-accent-dark border-border-light dark:border-border-dark text-text-light dark:text-white'}`}
                                    >
                                        {size}
                                        {isSelected && <span className="text-[10px] bg-primary text-white size-5 rounded-full flex items-center justify-center">{stockPerSize[size]}</span>}
                                    </button>
                                    {isSelected && (
                                        <div className="absolute -top-3 -right-3 flex flex-col gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button type="button" onClick={() => updateStockForSize(size, true)} className="size-6 bg-primary text-white rounded-full shadow-lg flex items-center justify-center"><Icon name="add" className="text-xs" /></button>
                                            <button type="button" onClick={() => updateStockForSize(size, false)} className="size-6 bg-white border border-border-light text-primary rounded-full shadow-lg flex items-center justify-center"><Icon name="remove" className="text-xs" /></button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Categoría Raíz Sincronizada */}
                <div className={`bg-white dark:bg-accent-dark p-6 rounded-[32px] border shadow-sm space-y-6 transition-all duration-700 ${category && !isAIOptimizing ? 'border-primary/30' : 'border-border-light dark:border-border-dark'}`}>
                    <div className="space-y-1.5 relative">
                        <label className="text-[10px] font-black uppercase tracking-widest text-text-subtle-light">Categoría Principal (Sinc. IA)</label>
                        <button
                            type="button"
                            onClick={() => setShowCategoryModal(true)}
                            className="w-full h-11 bg-background-light dark:bg-background-dark border border-border-light rounded-xl px-4 text-sm font-bold flex items-center justify-between text-text-light dark:text-white outline-none"
                        >
                            <span className="flex items-center gap-2">
                                {gender} {category} {
                                    category === 'Pantalones' ? `(${pantType === 'cortos' ? 'Cortos' : 'Largos'})` :
                                        category === 'Camisetas' ? `(${sleeveType === 'corta' ? 'M. Corta' : 'M. Larga'})` :
                                            category === 'Camisas' ? `(${shirtSleeveType === 'corta' ? 'M. Corta' : 'M. Larga'})` :
                                                category === 'Faldas' ? `(${skirtType === 'cortas' ? 'Cortas' : 'Largas'})` :
                                                    category === 'Calzado' ? `(${shoeType.charAt(0).toUpperCase() + shoeType.slice(1)})` : ''
                                }
                                {category && !isAIOptimizing && <Icon name="verified" className="text-primary text-[14px]" filled />}
                            </span>
                            <Icon name="expand_more" className="text-text-subtle-light" />
                        </button>
                    </div>

                    <div className="space-y-1.5 relative">
                        <label className="text-[10px] font-black uppercase tracking-widest text-text-subtle-light">Descripción Generativa</label>
                        <div className="relative">
                            <textarea
                                value={isAIOptimizing ? "" : description}
                                disabled={isAIOptimizing}
                                onChange={e => setDescription(e.target.value)}
                                placeholder={isAIOptimizing ? "" : "Describe el estado, material o por qué es especial..."}
                                className={`w-full h-32 bg-white dark:bg-accent-dark border border-border-light dark:border-border-dark rounded-xl p-4 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 resize-none text-text-light dark:text-white transition-all ${isAIOptimizing ? 'opacity-40' : 'opacity-100'}`}
                            />
                        </div>
                    </div>
                </div>

                {/* Modal de Categorías Sincronizado */}
                {showCategoryModal && (
                    <div className="fixed inset-0 z-[2000] bg-black/60 flex items-end justify-center" onClick={() => setShowCategoryModal(false)}>
                        <div className="w-full max-w-lg bg-white dark:bg-accent-dark rounded-t-[40px] p-6 pb-12 animate-slide-up shadow-2xl max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
                            <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-6 shrink-0"></div>
                            <h3 className="text-center text-lg font-black text-text-light dark:text-white mb-6 tracking-tight uppercase tracking-widest shrink-0">Categoría del Artículo</h3>
                            <div className="overflow-y-auto space-y-2 custom-scrollbar pr-1">
                                {CLOTHING_CATEGORIES.map(c => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => handleCategorySelect(c)}
                                        className={`w-full text-left p-5 rounded-2xl text-base font-bold transition-all ${category === c ? 'bg-primary text-white shadow-lg' : 'bg-background-light dark:bg-background-dark text-text-light hover:bg-white dark:hover:bg-border-dark'}`}
                                    >
                                        {c}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                <div className="fixed bottom-0 left-0 right-0 p-4 bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-md border-t border-border-light dark:border-border-dark z-50">
                    <button
                        onClick={handlePublish}
                        disabled={isAIOptimizing}
                        className="w-full h-16 bg-primary text-white font-bold rounded-2xl shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-3 text-lg disabled:opacity-50"
                    >
                        <Icon name={isEditMode ? "save" : "rocket_launch"} />
                        {isEditMode ? "Guardar Cambios" : "Subir al Escaparate"}
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
