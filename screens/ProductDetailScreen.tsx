
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useProducts, useCart, useFavorites, useNotifications } from '../AppContext';
import { DetailHeader } from '../components/Layout';

const Icon = ({ name, filled, className }: { name: string; filled?: boolean; className?: string }) => (
    <span className={`material-symbols-outlined ${className}`} style={{ fontVariationSettings: filled ? "'FILL' 1" : "'FILL' 0" }}>
        {name}
    </span>
);

const ProductDetailScreen: React.FC = () => {
    const { productId } = useParams();
    const navigate = useNavigate();
    const { getProductById, products } = useProducts();
    const { addToCart, cartItems } = useCart();
    const { isFavorite, toggleFavorite } = useFavorites();
    const { notify } = useNotifications();

    const product = getProductById(productId || '');
    const [selectedSize, setSelectedSize] = useState<string | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Obtener el rol del usuario
    const userRole = localStorage.getItem('userRole') || 'cliente';
    const isCollab = userRole === 'colaborador';

    const productImages = useMemo(() => {
        if (!product) return [];
        const allImages = [product.imageUrl, ...(product.images || [])];
        return Array.from(new Set(allImages)).filter(Boolean);
    }, [product]);

    const otherStores = useMemo(() => {
        if (!product?.barcode) return [];
        return products.filter(p => p.barcode === product.barcode && p.id !== product.id && (p.stock ?? 1) > 0);
    }, [products, product]);

    const availableSizes = React.useMemo(() => {
        if (!product) return [];
        if (product.stockPerSize) {
            return Object.keys(product.stockPerSize).filter(s => (product.stockPerSize?.[s] || 0) > 0);
        }
        return product.sizes || [];
    }, [product]);

    useEffect(() => {
        if (availableSizes.length > 0 && !selectedSize) {
            setSelectedSize(availableSizes[0]);
        }
    }, [availableSizes]);

    const handleScroll = () => {
        if (scrollRef.current) {
            const index = Math.round(scrollRef.current.scrollLeft / scrollRef.current.clientWidth);
            setActiveImageIndex(index);
        }
    };

    const handleShare = async () => {
        if (!product) return;
        const shareData = {
            title: `Mira este artículo: ${product.name}`,
            text: `He encontrado este artículo en ${product.storeName} a través de LocalShop.`,
            url: window.location.href,
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                console.log('Error sharing:', err);
            }
        } else {
            try {
                await navigator.clipboard.writeText(shareData.url);
                notify('¡Copiado!', 'El enlace se ha copiado al portapapeles.', 'content_copy');
            } catch (err) {
                notify('Error', 'No se pudo copiar el enlace.', 'error');
            }
        }
    };

    if (!product) return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen">
            <DetailHeader title="Error" />
            <div className="p-10 text-center font-bold text-text-light dark:text-text-dark">Producto no encontrado</div>
        </div>
    );

    const currentStock = React.useMemo(() => {
        if (selectedSize && product.stockPerSize) {
            return product.stockPerSize[selectedSize] || 0;
        }
        return product.stock !== undefined ? product.stock : 10;
    }, [product, selectedSize]);

    const inCart = React.useMemo(() => {
        const item = cartItems.find(i => i.product.id === product.id && i.variant === (selectedSize || undefined));
        return item ? item.quantity : 0;
    }, [cartItems, product.id, selectedSize]);

    const effectiveStock = Math.max(0, currentStock - inCart);

    const handleAddToCart = () => {
        if (availableSizes.length > 0 && !selectedSize) {
            notify('Selección requerida', 'Por favor, elige una talla antes de añadir.', 'error_outline');
            return;
        }
        if (quantity > effectiveStock) {
            notify('Stock insuficiente', `Solo quedan ${effectiveStock} unidades disponibles.`, 'error_outline');
            return;
        }
        addToCart(product, selectedSize, quantity);
        notify('¡Añadido!', `${quantity}x ${product.name} en tu cesta.`, 'shopping_basket');
        setQuantity(1);
    };

    const shareButton = (
        <button
            onClick={handleShare}
            className="size-10 flex items-center justify-center text-text-light dark:text-text-dark active:scale-90 transition-transform"
            aria-label="Compartir"
        >
            <Icon name="share" className="text-2xl" />
        </button>
    );

    return (
        <div className="pb-24 bg-background-light dark:bg-background-dark min-h-screen">
            <DetailHeader title="Detalles del Producto" rightAction={shareButton} />

            <div className="p-4 space-y-6">
                {/* Carrusel de Imágenes */}
                <div className="relative group">
                    <div
                        ref={scrollRef}
                        onScroll={handleScroll}
                        className="aspect-[3/4] flex overflow-x-auto snap-x snap-mandatory [-ms-scrollbar-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rounded-3xl shadow-xl border border-border-light dark:border-border-dark"
                    >
                        {productImages.map((img, idx) => (
                            <div
                                key={idx}
                                className="w-full h-full flex-shrink-0 snap-center bg-cover bg-center"
                                style={{ backgroundImage: `url(${img})` }}
                            />
                        ))}
                    </div>

                    {/* Indicadores de página */}
                    {productImages.length > 1 && (
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5 px-3 py-1.5 bg-black/20 backdrop-blur-md rounded-full">
                            {productImages.map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`size-1.5 rounded-full transition-all duration-300 ${activeImageIndex === idx ? 'w-4 bg-white' : 'bg-white/40'}`}
                                />
                            ))}
                        </div>
                    )}

                    {!isCollab && (
                        <button
                            onClick={() => toggleFavorite(product.id)}
                            className="absolute top-4 right-4 size-12 rounded-full bg-white/90 dark:bg-black/40 backdrop-blur-md flex items-center justify-center shadow-lg transition-transform active:scale-90"
                        >
                            <Icon name="favorite" filled={isFavorite(product.id)} className={isFavorite(product.id) ? 'text-red-500' : 'text-text-light dark:text-text-dark'} />
                        </button>
                    )}
                </div>

                <div className="flex justify-between items-start">
                    <div className="flex-1 pr-4">
                        <h1 className="text-2xl font-black text-text-light dark:text-text-dark tracking-tight leading-tight">
                            {product.name}
                        </h1>
                        <Link to={`/store/${product.storeId}`} className="flex items-center gap-1 text-primary dark:text-mustard font-bold mt-1 text-[11px] uppercase tracking-tighter active:opacity-70 transition-opacity">
                            <span>Visitar todos sus productos:</span>
                            <span className="bg-primary/10 px-1.5 py-0.5 rounded-md">{product.storeName}</span>
                            <Icon name="arrow_forward" className="text-[10px]" />
                        </Link>
                    </div>
                    <span className="text-2xl font-black text-primary whitespace-nowrap">
                        €{product.price.toFixed(2)}
                    </span>
                </div>

                <div className="flex items-center gap-2">
                    {effectiveStock > 0 ? (
                        <span className={`text-xs font-bold px-3 py-1 rounded-full border ${effectiveStock < 5 ? 'bg-mustard/10 border-mustard text-mustard' : 'bg-olive/10 border-olive text-olive'}`}>
                            {effectiveStock < 5 ? `¡Solo quedan ${effectiveStock}!` : 'En Stock'}
                        </span>
                    ) : (
                        <span className="text-xs font-bold px-3 py-1 rounded-full bg-red-500/10 border border-red-500 text-red-500">Agotado</span>
                    )}
                </div>

                {otherStores.length > 0 && (
                    <div className="space-y-2">
                        <h3 className="font-bold text-xs uppercase tracking-widest text-text-light dark:text-text-dark flex items-center gap-2">
                            <Icon name="storefront" className="text-base text-primary" />
                            También disponible en {otherStores.length} tienda{otherStores.length > 1 ? 's' : ''} más
                        </h3>
                        <div className="space-y-2">
                            {otherStores.map(other => (
                                <Link
                                    key={other.id}
                                    to={`/product/${other.id}`}
                                    className="flex items-center justify-between p-3 rounded-2xl bg-accent-light dark:bg-accent-dark border border-border-light dark:border-border-dark active:scale-[0.98] transition-transform"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                                            <Icon name="storefront" className="text-primary text-lg" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-text-light dark:text-text-dark leading-tight">{other.storeName}</p>
                                            <p className="text-[11px] text-text-subtle-light dark:text-text-subtle-dark">{other.stock ?? '—'} uds. disponibles</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-base font-black text-primary">€{other.price.toFixed(2)}</span>
                                        <Icon name="chevron_right" className="text-text-subtle-light text-lg" />
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {product.description && (
                    <p className="text-text-subtle-light dark:text-text-subtle-dark leading-relaxed text-sm">
                        {product.description}
                    </p>
                )}

                {availableSizes.length > 0 && (
                    <div className="space-y-3">
                        <h3 className="font-bold text-xs uppercase tracking-widest text-text-light dark:text-text-dark">
                            Selecciona Talla
                        </h3>
                        <div className="flex flex-wrap gap-2">
                            {availableSizes.map(size => (
                                <button
                                    key={size}
                                    onClick={() => setSelectedSize(size)}
                                    className={`size-12 rounded-xl border-2 font-bold transition-all active:scale-95 ${selectedSize === size ? 'bg-primary border-primary text-white shadow-md' : 'border-border-light dark:border-border-dark text-text-light dark:text-text-dark'}`}
                                >
                                    {size}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                <div className="pt-4 space-y-6">
                    {!isCollab && effectiveStock > 0 && (
                        <div className="flex flex-col gap-3">
                            <h3 className="font-bold text-xs uppercase tracking-widest text-text-light dark:text-text-dark">
                                Cantidad
                            </h3>
                            <div className="flex items-center gap-6 bg-accent-light dark:bg-accent-dark w-fit p-2 rounded-2xl border border-border-light dark:border-border-dark">
                                <button
                                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                    className="size-10 flex items-center justify-center text-primary active:scale-90 transition-transform disabled:opacity-30"
                                    disabled={quantity <= 1}
                                >
                                    <Icon name="remove_circle" className="text-3xl" />
                                </button>
                                <span className="text-xl font-black text-text-light dark:text-text-dark min-w-[30px] text-center">{quantity}</span>
                                <button
                                    onClick={() => setQuantity(Math.min(effectiveStock, quantity + 1))}
                                    className="size-10 flex items-center justify-center text-primary active:scale-90 transition-transform disabled:opacity-30"
                                    disabled={quantity >= effectiveStock}
                                >
                                    <Icon name="add_circle" className="text-3xl" />
                                </button>
                            </div>
                        </div>
                    )}

                    {!isCollab ? (
                        <button
                            onClick={handleAddToCart}
                            disabled={effectiveStock === 0}
                            className="w-full h-16 bg-primary text-white font-bold rounded-2xl shadow-xl active:scale-95 disabled:bg-gray-300 transition-all flex items-center justify-center gap-3 text-lg"
                        >
                            <Icon name="shopping_cart" />
                            {effectiveStock === 0 ? 'Sin Existencias' : 'Añadir a la Cesta'}
                        </button>
                    ) : (
                        <div className="bg-primary/5 border border-primary/20 p-5 rounded-2xl flex gap-4 items-center">
                            <Icon name="info" className="text-primary text-2xl" />
                            <p className="text-xs font-bold text-primary/80 leading-snug">
                                Como **Colaborador**, puedes ver cómo luce tu producto para los clientes, pero no puedes comprar tus propios artículos.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ProductDetailScreen;
