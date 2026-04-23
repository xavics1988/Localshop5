
import React, { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { DetailHeader, Logo } from '../components/Layout';
import { useFollowedStores, useNotifications, useReviews, useStores, useProducts, useUser } from '../AppContext';
import { sanitizeRaw, truncate, MAX_LENGTHS, validateComment } from '../utils/validation';

const Icon = ({ name, className, filled }: { name: string; className?: string; filled?: boolean; key?: React.Key }) => (
    <span 
        className={`material-symbols-outlined ${className}`}
        style={{ fontVariationSettings: filled ? "'FILL' 1" : "'FILL' 0" }}
    >
        {name}
    </span>
);

const StoreProfileScreen: React.FC = () => {
    const { storeId } = useParams();
    const { stores } = useStores();
    const { products } = useProducts();
    const { user } = useUser();
    const { isFollowing, toggleFollow } = useFollowedStores();
    const { notify } = useNotifications();
    const { addReview, getStoreReviews } = useReviews();
    
    const [activeTab, setActiveTab] = useState<'products' | 'reviews'>('products');
    const [isReviewing, setIsReviewing] = useState(false);
    const [newRating, setNewRating] = useState(5);
    const [newComment, setNewComment] = useState('');

    const store = stores.find(s => s.id === storeId);
    const storeReviews = useMemo(() => getStoreReviews(storeId || ''), [getStoreReviews, storeId]);
    
    const isCollab = user.role === 'colaborador';
    const currentUserName = user.name || 'Anónimo';

    const hasAlreadyReviewed = useMemo(() => {
        return storeReviews.some(r => r.userName === currentUserName);
    }, [storeReviews, currentUserName]);

    const averageRating = useMemo(() => {
        if (storeReviews.length === 0) return 0;
        const sum = storeReviews.reduce((acc, r) => acc + r.rating, 0);
        return (sum / storeReviews.length).toFixed(1);
    }, [storeReviews]);

    const active = storeId ? isFollowing(storeId) : false;

    const storeProducts = useMemo(() => {
        return products.filter(p => p.storeId === storeId);
    }, [products, storeId]);

    const isAnonymous = useMemo(() => {
        if (!store) return false;
        return !store.imageUrl || store.imageUrl.includes('placeholder') || store.name.startsWith('LS-');
    }, [store]);

    const handleShare = async () => {
        if (!store) return;
        const shareData = {
            title: `Descubre ${store.name} en LocalShop`,
            text: `Mira los increíbles artículos locales de ${store.name}.`,
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
                notify('¡Copiado!', 'El enlace de la tienda se ha copiado al portapapeles.', 'content_copy');
            } catch (err) {
                notify('Error', 'No se pudo copiar el enlace.', 'error');
            }
        }
    };

    if (!store) return <DetailHeader title="No encontrado" />;

    const handleFollowClick = () => {
        if (storeId) {
            const willFollow = !active;
            toggleFollow(storeId);
            if (willFollow) notify('¡Sigues a una tienda!', `Recibirás noticias de ${store.name}.`, 'favorite');
        }
    };

    const submitReview = () => {
        const commentErr = validateComment(newComment);
        if (commentErr) return notify('Error', commentErr, 'error');
        addReview({
            storeId: storeId || '',
            userName: currentUserName,
            rating: newRating,
            comment: sanitizeRaw(newComment)
        });
        setNewComment('');
        setIsReviewing(false);
        notify('¡Gracias!', 'Tu valoración ha sido publicada.', 'stars');
    };

    const handleRateClick = () => {
        if (isCollab) {
            notify('Acción no permitida', 'Los colaboradores no pueden valorar tiendas.', 'info');
            return;
        }
        if (hasAlreadyReviewed) {
            notify('Ya valorado', 'Solo puedes dejar una reseña por tienda.', 'info');
            return;
        }
        setActiveTab('reviews');
        setIsReviewing(true);
        window.scrollTo({ top: 400, behavior: 'smooth' });
    };

    const shareButton = (
        <button 
            onClick={handleShare}
            className="size-10 flex items-center justify-center text-text-light dark:text-text-dark active:scale-90 transition-transform"
            aria-label="Compartir Tienda"
        >
            <Icon name="share" className="text-2xl" />
        </button>
    );

    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen">
            <DetailHeader title="Perfil de la Tienda" rightAction={shareButton} />
            <main className="pb-24">
                <div className="p-4">
                    {!isAnonymous ? (
                        <div className="w-full h-48 bg-center bg-cover rounded-3xl shadow-lg border border-border-light dark:border-border-dark" style={{ backgroundImage: `url(${store.imageUrl})` }} />
                    ) : (
                        <div className="w-full h-48 rounded-3xl shadow-lg border border-primary/20 bg-gradient-to-br from-primary/10 to-mustard/10 flex flex-col items-center justify-center">
                            <Logo showText={false} className="h-16 opacity-30 mb-2" />
                            <p className="text-xs font-black uppercase tracking-[0.3em] text-primary/40 italic">Identidad Protegida</p>
                        </div>
                    )}
                </div>
                
                <div className="px-4 flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-3xl font-black text-text-light dark:text-text-dark tracking-tighter leading-none">{store.name}</h1>
                            {isAnonymous && <Icon name="verified_user" className="text-primary/50 text-xl" filled />}
                        </div>
                        <p className="text-xs text-text-subtle-light font-bold mb-2 mt-1">{store.category} • {store.address}</p>
                        <button 
                            onClick={handleRateClick}
                            className="flex items-center gap-1 mt-1 bg-primary/10 px-2 py-1 rounded-lg border border-primary/20 active:scale-95 transition-transform"
                        >
                            <Icon name="star" filled className="text-primary text-sm" />
                            <span className="font-bold text-sm text-text-light dark:text-text-dark">{averageRating}</span>
                            <span className="text-[10px] text-text-subtle-light dark:text-text-subtle-dark font-bold uppercase ml-1">Valorar ({storeReviews.length})</span>
                        </button>
                    </div>
                </div>

                <div className="p-4">
                    <p className="text-sm text-text-subtle-light leading-relaxed italic">"{store.description || "Esta tienda local ofrece artículos únicos seleccionados con pasión y cuidado."}"</p>
                </div>

                <div className="p-4">
                    <button 
                        onClick={handleFollowClick} 
                        className={`w-full h-12 flex items-center justify-center gap-2 rounded-2xl text-sm font-black transition-all active:scale-95 ${active ? 'bg-primary/15 dark:bg-primary/25 text-primary border border-primary/20' : 'bg-primary text-white shadow-lg'}`}
                    >
                        <Icon name="favorite" filled={active} className={active ? "text-primary" : ""} />
                        {active ? 'Siguiendo' : 'Seguir tienda'}
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex px-4 border-b border-border-light dark:border-border-dark mb-4">
                    <button onClick={() => setActiveTab('products')} className={`flex-1 py-4 text-sm font-black uppercase tracking-widest border-b-2 transition-colors ${activeTab === 'products' ? 'border-primary text-primary' : 'border-transparent text-text-subtle-light'}`}>Productos</button>
                    <button onClick={() => setActiveTab('reviews')} className={`flex-1 py-4 text-sm font-black uppercase tracking-widest border-b-2 transition-colors ${activeTab === 'reviews' ? 'border-primary text-primary' : 'border-transparent text-text-subtle-light'}`}>Valoraciones</button>
                </div>

                {activeTab === 'products' ? (
                    <div className="grid grid-cols-2 gap-3 px-4 animate-fade-in">
                        {storeProducts.length > 0 ? (
                            storeProducts.map((product) => (
                                <Link to={`/product/${product.id}`} key={product.id} className="flex flex-col gap-2">
                                    <div className="aspect-square w-full overflow-hidden rounded-2xl border border-border-light dark:border-border-dark">
                                        <img alt={product.name} className="h-full w-full object-cover" src={product.imageUrl} />
                                    </div>
                                    <div className="px-1">
                                        <p className="text-text-light dark:text-text-dark text-xs font-bold truncate">{product.name}</p>
                                        <p className="text-primary text-xs font-black">€{product.price.toFixed(2)}</p>
                                    </div>
                                </Link>
                            ))
                        ) : (
                            <p className="col-span-2 text-center py-10 text-text-subtle-light text-sm italic">Próximamente más productos.</p>
                        )}
                    </div>
                ) : (
                    <div className="px-4 space-y-6 animate-fade-in">
                        {/* Rating Summary */}
                        <div className="bg-white dark:bg-accent-dark p-6 rounded-3xl border border-border-light dark:border-border-dark flex items-center gap-8">
                            <div className="text-center">
                                <h2 className="text-5xl font-black text-text-light dark:text-text-dark">{averageRating}</h2>
                                <div className="flex justify-center my-1">
                                    {[1,2,3,4,5].map(s => <Icon key={s} name="star" filled={s <= Math.round(Number(averageRating))} className="text-primary text-sm" />)}
                                </div>
                                <p className="text-[10px] uppercase font-bold text-text-subtle-light tracking-tighter">Promedio</p>
                            </div>
                            <div className="flex-1 space-y-1">
                                {[5,4,3,2,1].map(r => {
                                    const count = storeReviews.filter(rev => rev.rating === r).length;
                                    const percent = storeReviews.length > 0 ? (count / storeReviews.length) * 100 : 0;
                                    return (
                                        <div key={r} className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold text-text-subtle-light w-2">{r}</span>
                                            <div className="flex-1 h-1.5 bg-accent-light dark:bg-background-dark rounded-full overflow-hidden">
                                                <div className="h-full bg-primary rounded-full" style={{ width: `${percent}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {!isCollab && (
                            <>
                                {hasAlreadyReviewed ? (
                                    <div className="bg-primary/5 border border-primary/20 p-4 rounded-2xl flex items-center gap-3">
                                        <Icon name="verified" className="text-primary" filled />
                                        <p className="text-xs font-bold text-primary">Ya has valorado esta tienda. ¡Gracias por tu opinión!</p>
                                    </div>
                                ) : !isReviewing ? (
                                    <button onClick={() => setIsReviewing(true)} className="w-full h-14 bg-accent-light dark:bg-accent-dark border-2 border-dashed border-primary/30 rounded-2xl font-bold text-primary flex items-center justify-center gap-2 active:scale-95 transition-all">
                                        <Icon name="rate_review" />
                                        Escribir una reseña
                                    </button>
                                ) : (
                                    <div className="bg-white dark:bg-accent-dark p-4 rounded-3xl border border-primary shadow-xl animate-slide-up">
                                        <h3 className="font-bold mb-3 text-text-light dark:text-text-dark">Tu valoración</h3>
                                        <div className="flex gap-2 mb-4">
                                            {[1,2,3,4,5].map(s => (
                                                <button 
                                                    key={s} 
                                                    type="button"
                                                    onClick={() => setNewRating(s)} 
                                                    className={`size-10 rounded-xl flex items-center justify-center transition-all ${newRating >= s ? 'bg-primary text-white scale-110' : 'bg-accent-light dark:bg-background-dark text-text-subtle-light'}`}
                                                >
                                                    <Icon name="star" filled={newRating >= s} />
                                                </button>
                                            ))}
                                        </div>
                                        <textarea
                                            value={newComment}
                                            onChange={(e) => setNewComment(truncate(sanitizeRaw(e.target.value), MAX_LENGTHS.comment))}
                                            placeholder="Cuéntanos tu experiencia..."
                                            className="w-full h-24 bg-accent-light dark:bg-background-dark border border-border-light dark:border-border-dark rounded-xl p-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary mb-4 text-text-light dark:text-white"
                                        />
                                        <div className="flex gap-2">
                                            <button onClick={() => setIsReviewing(false)} className="flex-1 h-11 bg-accent-light dark:bg-background-dark rounded-xl font-bold text-text-subtle-light">Cancelar</button>
                                            <button onClick={submitReview} className="flex-2 h-11 bg-primary text-white rounded-xl font-bold px-6">Publicar</button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        <div className="space-y-4">
                            {storeReviews.length > 0 ? (
                                storeReviews.map((review) => (
                                    <div key={review.id} className="border-b border-border-light dark:border-border-dark pb-4">
                                        <div className="flex justify-between items-center mb-1">
                                            <p className="font-bold text-sm text-text-light dark:text-text-dark">{review.userName}</p>
                                            <div className="flex gap-0.5">
                                                {[1,2,3,4,5].map(s => <Icon key={s} name="star" filled={s <= review.rating} className="text-[10px] text-primary" />)}
                                            </div>
                                        </div>
                                        <p className="text-xs text-text-subtle-light mb-1">{review.date}</p>
                                        <p className="text-sm text-text-light dark:text-text-dark leading-relaxed">"{review.comment}"</p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center py-4 text-text-subtle-light text-sm italic">Sé el primero en valorar esta tienda.</p>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default StoreProfileScreen;
