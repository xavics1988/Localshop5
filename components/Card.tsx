
import React, { useRef } from 'react';
import { Product, Store } from '../types';
import { Link } from 'react-router-dom';
import { useFavorites, useFollowedStores, useUser } from '../AppContext';
import { Logo } from './Layout';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(useGSAP, ScrollTrigger);

const Icon = ({ name, filled, className }: { name: string; filled?: boolean; className?: string }) => (
    <span
        className={`material-symbols-outlined ${className}`}
        style={{ fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24` }}
    >
        {name}
    </span>
);

type ProductCardProps = {
    product: Product;
};

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
    const { isFavorite, toggleFavorite } = useFavorites();
    const { user } = useUser();
    const active = isFavorite(product.id);
    const cardRef = useRef<HTMLDivElement>(null);

    useGSAP(() => {
        gsap.from(cardRef.current, {
            scrollTrigger: {
                trigger: cardRef.current,
                start: "top 85%",
                toggleActions: "play none none reverse",
            },
            y: 50,
            opacity: 0,
            scale: 0.95,
            duration: 0.6,
            ease: "back.out(1.5)",
            clearProps: "all"
        });
    }, { scope: cardRef });

    return (
        <div ref={cardRef} className="flex flex-col gap-1">
            <Link to={`/product/${product.id}`} className="group relative w-full aspect-[3/4] block overflow-hidden rounded-xl h-auto transform transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lg">
                <div
                    className="absolute inset-0 w-full h-full bg-center bg-no-repeat bg-cover rounded-xl border border-border-light dark:border-border-dark transition-transform duration-500 ease-out group-hover:scale-110"
                    style={{ backgroundImage: `url("${product.imageUrl}")` }}>
                </div>
                {(product.storeCount ?? 1) > 1 && (
                    <div className="absolute bottom-1 left-1 z-10 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-black/60 backdrop-blur-sm">
                        <Icon name="storefront" className="text-white text-[8px]" />
                        <span className="text-white text-[8px] font-black">{product.storeCount}</span>
                    </div>
                )}
                {user.role !== 'colaborador' && (
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleFavorite(product.id);
                        }}
                        className={`absolute top-1 right-1 z-10 flex items-center justify-center size-7 rounded-full bg-white/60 backdrop-blur-sm dark:bg-black/30 transition-all duration-200 hover:scale-110 active:scale-[0.75] ${active ? 'text-red-500' : 'text-text-light dark:text-text-dark'}`}
                    >
                        <Icon name="favorite" filled={active} className="text-sm" />
                    </button>
                )}
            </Link>
            <div className="px-0.5">
                <p className="text-text-light dark:text-text-dark text-[10px] font-bold leading-tight truncate">{product.name}</p>
                <p className="text-text-subtle-light dark:text-text-subtle-dark text-[9px] font-medium leading-tight truncate">{(product.storeCount ?? 1) > 1 ? `desde €${product.price.toFixed(0)}` : `€${product.price.toFixed(0)}`} {product.storeName}</p>
            </div>
        </div>
    );
};

type StoreCardProps = {
    store: Store;
};

export const StoreCard: React.FC<StoreCardProps> = ({ store }) => {
    const { isFollowing, toggleFollow } = useFollowedStores();
    const active = isFollowing(store.id);
    const cardRef = useRef<HTMLDivElement>(null);

    useGSAP(() => {
        gsap.from(cardRef.current, {
            scrollTrigger: {
                trigger: cardRef.current,
                start: "top 85%",
                toggleActions: "play none none reverse",
            },
            y: 60,
            opacity: 0,
            scale: 0.9,
            rotationX: 5,
            duration: 0.7,
            ease: "power3.out",
            clearProps: "all"
        });
    }, { scope: cardRef });

    // Lógica de anonimato: Las tiendas con ID numérico (LS-) o sin imagen 
    // usan automáticamente la Identidad Visual Generativa.
    const isAnonymous = !store.imageUrl || store.imageUrl.includes('placeholder') || store.name.startsWith('LS-');

    return (
        <div ref={cardRef} className="flex h-full flex-col gap-0 rounded-xl bg-white dark:bg-accent-dark border border-border-light dark:border-border-dark shadow-sm relative overflow-hidden group transform transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl" style={{ perspective: "1000px" }}>
            {!isAnonymous ? (
                <Link to={`/store/${store.id}`} className="relative w-full aspect-[1.5/1] block overflow-hidden">
                    <div className="absolute inset-0 w-full h-full bg-center bg-no-repeat bg-cover transition-transform duration-500 ease-out group-hover:scale-110"
                        style={{ backgroundImage: `url("${store.imageUrl}")` }}>
                    </div>
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleFollow(store.id);
                        }}
                        className={`absolute top-1 right-1 z-20 flex items-center justify-center size-7 rounded-full bg-white/80 backdrop-blur-md dark:bg-black/40 shadow-sm transition-all duration-200 hover:scale-110 active:scale-[0.75] ${active ? 'text-red-500' : 'text-text-light dark:text-text-dark'}`}
                    >
                        <Icon name="favorite" filled={active} className="text-sm" />
                    </button>
                </Link>
            ) : (
                <Link to={`/store/${store.id}`} className="w-full aspect-[1.5/1] bg-gradient-to-br from-primary/10 to-mustard/10 flex flex-col items-center justify-center relative overflow-hidden border-b border-primary/5">
                    <Logo showText={false} className="h-8 opacity-30 group-hover:scale-110 transition-transform duration-500 ease-out mb-1" />
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleFollow(store.id);
                        }}
                        className={`absolute top-1 right-1 z-20 flex items-center justify-center size-7 rounded-full bg-white/80 backdrop-blur-md shadow-sm transition-all duration-200 hover:scale-110 active:scale-[0.75] ${active ? 'text-red-500' : 'text-text-light'}`}
                    >
                        <Icon name="favorite" filled={active} className="text-sm" />
                    </button>
                </Link>
            )}
            <div className="flex flex-col p-2 gap-2 flex-1 justify-between">
                <div>
                    <div className="flex items-center gap-1">
                        <p className="text-text-light dark:text-text-dark text-[10px] font-black leading-tight tracking-tighter truncate">{store.name}</p>
                        {isAnonymous && <Icon name="verified_user" className="text-[10px] text-primary/40" filled />}
                    </div>
                    <p className="text-text-subtle-light dark:text-text-subtle-dark text-[8px] font-bold uppercase truncate">{store.category}</p>
                </div>
                <Link to={`/store/${store.id}`} className="flex w-full items-center justify-center rounded-lg h-7 bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-light text-[8px] font-black uppercase tracking-tight active:scale-[0.98] transition-all">
                    Visitar
                </Link>
            </div>
        </div>
    );
};
