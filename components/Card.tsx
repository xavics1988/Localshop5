
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
        <div ref={cardRef} className="flex flex-col gap-2">
            <Link to={`/product/${product.id}`} className="group relative w-full aspect-[3/4] block overflow-hidden rounded-2xl transform transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lg">
                <div
                    className="absolute inset-0 w-full h-full bg-center bg-no-repeat bg-cover rounded-2xl border border-border-light dark:border-border-dark transition-transform duration-500 ease-out group-hover:scale-110"
                    style={{ backgroundImage: `url("${product.imageUrl}")` }}>
                </div>
                {user.role !== 'colaborador' && (
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleFavorite(product.id);
                        }}
                        className={`absolute top-2 right-2 z-10 flex items-center justify-center size-9 rounded-full bg-white/60 backdrop-blur-sm dark:bg-black/30 transition-all duration-200 hover:scale-110 active:scale-[0.75] ${active ? 'text-red-500' : 'text-text-light dark:text-text-dark'}`}
                    >
                        <Icon name="favorite" filled={active} className="text-lg" />
                    </button>
                )}
            </Link>
            <div className="px-1">
                <p className="text-text-light dark:text-text-dark text-sm font-bold leading-snug truncate">{product.name}</p>
                <p className="text-text-subtle-light dark:text-text-subtle-dark text-[11px] font-medium leading-normal">€{product.price.toFixed(2)} - {product.storeName}</p>
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
        <div ref={cardRef} className="flex h-full flex-col gap-0 rounded-[28px] bg-white dark:bg-accent-dark border border-border-light dark:border-border-dark shadow-sm min-w-[240px] relative overflow-hidden group transform transition-all duration-300 hover:-translate-y-1.5 hover:shadow-xl" style={{ perspective: "1000px" }}>
            {!isAnonymous ? (
                <Link to={`/store/${store.id}`} className="relative w-full aspect-[1.8/1] block overflow-hidden">
                    <div className="absolute inset-0 w-full h-full bg-center bg-no-repeat bg-cover transition-transform duration-500 ease-out group-hover:scale-110"
                        style={{ backgroundImage: `url("${store.imageUrl}")` }}>
                    </div>
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleFollow(store.id);
                        }}
                        className={`absolute top-3 right-3 z-20 flex items-center justify-center size-9 rounded-full bg-white/80 backdrop-blur-md dark:bg-black/40 shadow-sm transition-all duration-200 hover:scale-110 active:scale-[0.75] ${active ? 'text-red-500' : 'text-text-light dark:text-text-dark'}`}
                    >
                        <Icon name="favorite" filled={active} className="text-xl" />
                    </button>
                </Link>
            ) : (
                <Link to={`/store/${store.id}`} className="w-full aspect-[1.8/1] bg-gradient-to-br from-primary/10 to-mustard/10 flex flex-col items-center justify-center relative overflow-hidden border-b border-primary/5">
                    <Logo showText={false} className="h-12 opacity-30 group-hover:scale-110 transition-transform duration-500 ease-out mb-1" />
                    <span className="text-[8px] font-black text-primary/40 tracking-[0.2em] uppercase italic transition-transform duration-500 group-hover:translate-y-1">Identidad Protegida</span>
                    <button
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleFollow(store.id);
                        }}
                        className={`absolute top-3 right-3 z-20 flex items-center justify-center size-9 rounded-full bg-white/80 backdrop-blur-md shadow-sm transition-all duration-200 hover:scale-110 active:scale-[0.75] ${active ? 'text-red-500' : 'text-text-light'}`}
                    >
                        <Icon name="favorite" filled={active} className="text-xl" />
                    </button>
                </Link>
            )}
            <div className="flex flex-col p-4 gap-3">
                <div>
                    <div className="flex items-center gap-2">
                        <p className="text-text-light dark:text-text-dark text-base font-black leading-snug tracking-tighter">{store.name}</p>
                        {isAnonymous && <Icon name="verified_user" className="text-[14px] text-primary/40" filled />}
                    </div>
                    <p className="text-text-subtle-light dark:text-text-subtle-dark text-xs font-medium">{store.category}</p>
                </div>
                <Link to={`/store/${store.id}`} className="flex w-full items-center justify-center rounded-xl h-11 bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-light text-sm font-black uppercase tracking-wider active:scale-[0.98] transition-all">
                    Visitar Tienda
                </Link>
            </div>
        </div>
    );
};
