
import React, { useRef, useState, useEffect, useMemo } from 'react';
import { Product } from '../types';
import { stores } from '../data';
import { ProductCard, StoreCard } from '../components/Card';
import { Link } from 'react-router-dom';
import { useProducts } from '../AppContext';
import { Logo } from '../components/Layout';

const Icon = ({ name, className }: { name: string; className?: string }) => (
    <span className={`material-symbols-outlined ${className}`}>{name}</span>
);

const HomeScreen: React.FC = () => {
    const { products } = useProducts();
    const [activeCategory, setActiveCategory] = useState('Camisetas');
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [canScrollLeft, setCanScrollLeft] = useState(false);
    const [canScrollRight, setCanScrollRight] = useState(false);

    const categories = useMemo(() => {
        const cats = Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[];
        return cats.length > 0 ? cats : ['Camisetas', 'Abrigos', 'Accesorios', 'Pantalones', 'Calzado'];
    }, [products]);

    useEffect(() => {
        if (!categories.includes(activeCategory) && categories.length > 0) {
            setActiveCategory(categories[0]);
        }
    }, [categories]);

    const groupedProducts = useMemo((): Product[] => {
        const byBarcode = new Map<string, Product>();
        const noBarcode: Product[] = [];

        for (const product of products) {
            const bc = product.barcode?.trim();
            if (bc) {
                const existing = byBarcode.get(bc);
                if (!existing || product.price < existing.price) {
                    byBarcode.set(bc, { ...product, storeCount: (existing?.storeCount ?? 0) + 1 });
                } else {
                    byBarcode.set(bc, { ...existing, storeCount: (existing.storeCount ?? 1) + 1 });
                }
            } else {
                noBarcode.push(product);
            }
        }

        return [...byBarcode.values(), ...noBarcode];
    }, [products]);

    const filteredProducts = groupedProducts.filter(p => p.category === activeCategory);
    
    const handleScroll = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const scrollAmount = scrollContainerRef.current.clientWidth * 0.8;
            scrollContainerRef.current.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth',
            });
        }
    };

    const checkScrollability = () => {
        const container = scrollContainerRef.current;
        if (container) {
            const { scrollLeft, scrollWidth, clientWidth } = container;
            setCanScrollLeft(scrollLeft > 1);
            setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
        }
    };

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (container) {
            const timeoutId = setTimeout(checkScrollability, 100);
            window.addEventListener('resize', checkScrollability);
            container.addEventListener('scroll', checkScrollability);

            return () => {
                if (container) {
                    container.removeEventListener('scroll', checkScrollability);
                }
                window.removeEventListener('resize', checkScrollability);
                clearTimeout(timeoutId);
            };
        }
    }, [stores]);

    return (
        <div>
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center bg-background-light/80 dark:bg-background-dark/80 backdrop-blur-sm p-4 pb-2 justify-between">
                <div className="flex shrink-0 items-center">
                    <Logo className="h-9" />
                </div>
                <div className="flex-1 text-center">
                    <h1 className="text-text-light dark:text-text-dark text-lg font-bold sm:hidden">LocalShop</h1>
                </div>
                <div className="flex w-24 items-center justify-end">
                    <Link to="/" className="p-0 flex items-center justify-center h-10 w-10 text-text-light dark:text-text-dark" aria-label="Buscar productos">
                        <Icon name="search" className="text-2xl" />
                    </Link>
                    <Link to="/signup" className="p-0 flex items-center justify-center h-10 w-10 text-text-light dark:text-text-dark" aria-label="Registrarse">
                        <Icon name="person_add" className="text-2xl" />
                    </Link>
                </div>
            </div>

            {/* Featured Stores Carousel */}
            <h2 className="text-text-light dark:text-text-dark text-lg font-bold px-4 pb-2 pt-4">Tiendas locales destacadas</h2>
            <div className="relative">
                <div
                    ref={scrollContainerRef}
                    onScroll={checkScrollability}
                    className="flex items-stretch overflow-x-auto gap-3 px-4 py-2 [-ms-scrollbar-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                    {stores.map(store => <StoreCard key={store.id} store={store} />)}
                </div>

                <button
                    onClick={() => handleScroll('left')}
                    className={`absolute top-1/2 -translate-y-1/2 left-2 z-10 flex items-center justify-center size-10 rounded-full bg-white/90 dark:bg-black/70 shadow-lg transition-opacity duration-300 ${canScrollLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                >
                    <Icon name="chevron_left" className="text-text-light dark:text-text-dark" />
                </button>
                
                <button
                    onClick={() => handleScroll('right')}
                    className={`absolute top-1/2 -translate-y-1/2 right-2 z-10 flex items-center justify-center size-10 rounded-full bg-white/90 dark:bg-black/70 shadow-lg transition-opacity duration-300 ${canScrollRight ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                >
                    <Icon name="chevron_right" className="text-text-light dark:text-text-dark" />
                </button>
            </div>

            {/* Near You Section */}
            <h2 className="text-text-light dark:text-text-dark text-lg font-bold px-4 pb-2 pt-4">Cerca de ti</h2>
            <div className="flex gap-3 px-4 pb-3 overflow-x-auto [-ms-scrollbar-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {categories.map(cat => (
                    <button key={cat} onClick={() => setActiveCategory(cat)} className={`flex h-8 shrink-0 items-center justify-center rounded-full px-4 text-sm font-medium ${activeCategory === cat ? 'bg-primary text-white' : 'bg-accent-light dark:bg-accent-dark text-text-light dark:text-text-dark'}`}>
                        {cat}
                    </button>
                ))}
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3">
                {filteredProducts.length > 0 ? (
                    filteredProducts.map(product => <ProductCard key={product.id} product={product} />)
                ) : (
                    <p className="col-span-full text-center py-10 text-text-subtle-light text-sm italic">No hay artículos en esta categoría ahora mismo.</p>
                )}
            </div>

            {/* CTA Banner */}
            <div className="col-span-full mx-4 my-4 flex h-48 items-center justify-center rounded-xl bg-cover bg-center text-center text-white" style={{backgroundImage: "linear-gradient(rgba(0,0,0,0.4), rgba(0,0,0,0.4)), url('https://lh3.googleusercontent.com/aida-public/AB6AXuCkFFLLiN2Bl2UYzDinv4QrMGcO5jVcFCmGh02b_CVSDo2eW41khfY67HZPUefozIwnbYIsdj5UJhbF28Xk8QD9BE8xyATq9X3hR2hQ_LQoo_bi_5gATtfKbGn7jDZDhxZnngBhTn6FVMPun3-uHaa4K_ZIM2C-qBCli61lrVKFtxq5q30o2LJXOhz-P5aFfSuCF8hfiGz0wkywQGuQmqjGbZeYt5c-b4OJeMazda7eyRNGQj5tEuuian5O-My14yvnGKBLNfx6qGU')"}}>
                <div className="flex flex-col items-center gap-4 p-4">
                    <h3 className="text-2xl font-bold">Descubre tu barrio</h3>
                    <Link to="/" className="flex items-center justify-center rounded-full h-10 px-6 bg-primary text-white text-sm font-bold">
                        <span className="truncate">Explorar ahora</span>
                    </Link>
                </div>
            </div>
            
            <h2 className="text-text-light dark:text-text-dark text-lg font-bold px-4 pb-2 pt-4">Novedades recientes</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3">
                {groupedProducts.slice(0, 4).map(product => <ProductCard key={product.id} product={product} />)}
            </div>
        </div>
    );
};

export default HomeScreen;
