
import { Link } from 'react-router-dom';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ProductCard, StoreCard } from '../components/Card';
import { useFollowedStores, useNotifications, useProducts, useStores } from '../AppContext';
import { CLOTHING_CATEGORIES } from '../data';
import { Logo } from '../components/Layout';
import { AssistantChat } from '../components/AssistantChat';

const Icon = ({ name, className, filled }: { name: string; className?: string; filled?: boolean }) => (
    <span className={`material-symbols-outlined ${className}`} style={{ fontVariationSettings: filled ? "'FILL' 1" : "'FILL' 0" }}>{name}</span>
);

// Definición de grupos de tallas
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

// Mapeo de categorías raíz sincronizadas a grupos de tallas
const CATEGORY_TO_SIZE_GROUP: Record<string, string> = {
    'Camisetas': 'CAMISETAS',
    'Camisetas manga corta': 'CAMISETAS',
    'Camisetas manga larga': 'CAMISETAS',
    'Camisas': 'CAMISAS',
    'Camisas manga corta': 'CAMISAS',
    'Camisas manga larga': 'CAMISAS',
    'Sudaderas': 'SUDADERAS',
    'Pantalones': 'PANTALONES',
    'Pantalones cortos': 'PANTALONES',
    'Pantalones largos': 'PANTALONES',
    'Faldas': 'FALDAS',
    'Faldas cortas': 'FALDAS',
    'Faldas largas': 'FALDAS',
    'Monos/Petos': 'MONOS/PETOS',
    'Chaquetas/Abrigos': 'CHAQUETAS/ABRIGOS',
    'Trajes': 'TRAJES',
    'Vestidos': 'VESTIDOS',
    'Calzado': 'CALZADO',
    'Calzado running': 'CALZADO',
    'Calzado casual': 'CALZADO',
    'Calzado vestir': 'CALZADO',
    'Calzado otro': 'CALZADO',
    'Ropa Interior': 'ROPA INTERIOR',
    'Pijamas': 'PIJAMAS',
    'Ropa de Baño': 'ROPA DE BAÑO',
    'Bebé': 'BEBÉ',
    'Niños': 'NIÑOS',
    'Accesorios': 'ACCESORIOS'
};

const DiscoverScreen: React.FC = () => {
    const { products } = useProducts();
    const { stores } = useStores();
    const { notify } = useNotifications();
    const [activeFilter, setActiveFilter] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isAssistantOpen, setIsAssistantOpen] = useState(false);
    
    // Filtros seleccionados con soporte para sub-categorías y género
    const [selectedFilters, setSelectedFilters] = useState({
        product: 'Todos',
        store: 'Todas',
        size: 'Todas',
        gender: 'Mujer', // 'Hombre' | 'Mujer' | 'Niños' | 'Todos'
        pantType: 'Todos', // 'cortos' | 'largos' | 'Todos'
        sleeveType: 'Todos', // 'corta' | 'larga' | 'Todos' (Camisetas)
        shirtSleeveType: 'Todos', // 'corta' | 'larga' | 'Todos' (Camisas)
        skirtType: 'Todos', // 'cortas' | 'largas' | 'Todos'
        shoeType: 'Todos' // 'running' | 'casual' | 'vestir' | 'otro' | 'Todos'
    });

    const userRole = localStorage.getItem('userRole') || 'cliente';

    const productCategories = useMemo(() => {
        let categories = CLOTHING_CATEGORIES;
        if (selectedFilters.gender === 'Hombre') {
            categories = categories.filter(c => c !== 'Faldas' && c !== 'Vestidos');
        } else if (selectedFilters.gender === 'Mujer') {
            categories = categories.filter(c => c !== 'Trajes');
        }
        return ['Todos', ...categories];
    }, [selectedFilters.gender]);

    const storeNames = useMemo(() => {
        return ['Todas', ...Array.from(new Set(stores.map(s => s.name)))];
    }, [stores]);

    const handleFilterSelect = (type: 'product' | 'store' | 'size' | 'pantType' | 'sleeveType' | 'shirtSleeveType' | 'skirtType' | 'shoeType' | 'gender', value: string) => {
        if (type === 'product') {
            setSelectedFilters(prev => ({ 
                ...prev, 
                product: value, 
                size: 'Todas',
                pantType: 'Todos',
                sleeveType: 'Todos',
                shirtSleeveType: 'Todos',
                skirtType: 'Todos',
                shoeType: 'Todos'
            }));
        } else if (type === 'gender') {
            setSelectedFilters(prev => {
                let newProduct = prev.product;
                if (value === 'Hombre' && (newProduct === 'Faldas' || newProduct === 'Vestidos')) {
                    newProduct = 'Todos';
                } else if (value === 'Mujer' && newProduct === 'Trajes') {
                    newProduct = 'Todos';
                }
                return { ...prev, gender: value, product: newProduct, size: 'Todas', skirtType: 'Todos' };
            });
        } else {
            setSelectedFilters(prev => ({ ...prev, [type]: value }));
        }
        
        // Solo mantenemos abierto si estamos seleccionando una categoría principal que tiene sub-categorías
        const hasSubFilters = type === 'product' && ['Pantalones', 'Camisetas', 'Camisas', 'Faldas', 'Calzado'].includes(value);
        
        if (!hasSubFilters) {
            setActiveFilter(null);
        }
    };
    
    const filteredProducts = useMemo(() => {
        return products.filter(product => {
            // Filtrado por stock (solo mostrar productos con stock disponible)
            const hasStock = product.stock !== undefined ? product.stock > 0 : true;
            if (!hasStock) return false;

            // Filtrado por género
            const matchesGender = selectedFilters.gender === 'Todos' || product.gender === selectedFilters.gender;

            const matchesProduct = selectedFilters.product === 'Todos' || 
                product.category === selectedFilters.product ||
                product.category?.startsWith(selectedFilters.product);
            
            // Lógica específica para sub-categorías
            let matchesSub = true;
            if (selectedFilters.product === 'Pantalones' && selectedFilters.pantType !== 'Todos') {
                matchesSub = product.category === `Pantalones ${selectedFilters.pantType}`;
            } else if (selectedFilters.product === 'Camisetas' && selectedFilters.sleeveType !== 'Todos') {
                matchesSub = product.category === `Camisetas manga ${selectedFilters.sleeveType}`;
            } else if (selectedFilters.product === 'Camisas' && selectedFilters.shirtSleeveType !== 'Todos') {
                matchesSub = product.category === `Camisas manga ${selectedFilters.shirtSleeveType}`;
            } else if (selectedFilters.product === 'Faldas' && selectedFilters.skirtType !== 'Todos') {
                matchesSub = product.category === `Faldas ${selectedFilters.skirtType}`;
            } else if (selectedFilters.product === 'Calzado' && selectedFilters.shoeType !== 'Todos') {
                matchesSub = product.category === `Calzado ${selectedFilters.shoeType}`;
            }

            const matchesStore = selectedFilters.store === 'Todas' || product.storeName === selectedFilters.store;
            
            let matchesSize = true;
            if (selectedFilters.size !== 'Todas') {
                const targetSize = selectedFilters.size;
                matchesSize = !!product.sizes && product.sizes.includes(targetSize);
                if (matchesSize && product.stockPerSize) {
                    matchesSize = (product.stockPerSize[targetSize] || 0) > 0;
                }
            }

            const query = searchQuery.toLowerCase().trim();
            const matchesSearch = !query || 
                product.name.toLowerCase().includes(query) ||
                product.description?.toLowerCase().includes(query) ||
                product.category?.toLowerCase().includes(query) ||
                product.storeName.toLowerCase().includes(query);
            
            return matchesGender && matchesProduct && matchesSub && matchesStore && matchesSize && matchesSearch;
        });
    }, [selectedFilters, products, searchQuery]);

    const getTallaOptions = () => {
        const category = selectedFilters.product;
        const groupKey = CATEGORY_TO_SIZE_GROUP[category];
        if (groupKey) return { [groupKey]: SIZE_GROUPS[groupKey] };
        return SIZE_GROUPS;
    };

    return (
        <div className="bg-white dark:bg-background-dark min-h-screen">
            <div className="flex items-center justify-between px-4 h-16 border-b border-border-light dark:border-border-dark sticky top-0 z-[100] bg-white/95 dark:bg-background-dark/95 backdrop-blur-md">
                <div className="flex-1 flex justify-start items-center">
                    <Logo className="h-10" />
                </div>
                <div className="flex-1 flex justify-end items-center gap-1">
                    {userRole !== 'colaborador' && (
                        <Link to="/cart" className="flex size-10 items-center justify-center text-text-light dark:text-text-dark active:scale-90 transition-transform">
                            <Icon name="shopping_cart" className="text-2xl" />
                        </Link>
                    )}
                    <Link to="/signup" className="flex size-10 items-center justify-center text-text-light dark:text-text-dark active:scale-90 transition-transform">
                        <Icon name="person_add" className="text-2xl" />
                    </Link>
                </div>
            </div>

            <div className="sticky top-16 z-50 bg-white/95 dark:bg-background-dark/95 backdrop-blur-md pt-6 shadow-sm pb-2">
                <div className="flex gap-3 px-4 mb-2 overflow-x-auto [-ms-scrollbar-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <button onClick={() => setActiveFilter('Género')} className={`flex h-11 shrink-0 items-center justify-center gap-x-2 rounded-xl px-4 text-sm font-bold uppercase tracking-tight transition-colors ${selectedFilters.gender !== 'Todos' ? 'bg-primary text-white' : 'bg-primary/20 text-text-light'}`}>
                        <Icon name="wc" className="text-lg" />
                        {selectedFilters.gender === 'Todos' ? 'Género' : selectedFilters.gender}
                        <Icon name="expand_more" className="text-lg" />
                    </button>
                    <button onClick={() => setActiveFilter('Talla')} className={`flex h-11 shrink-0 items-center justify-center gap-x-2 rounded-xl px-4 text-sm font-bold uppercase tracking-tight transition-colors ${selectedFilters.size !== 'Todas' ? 'bg-primary text-white' : 'bg-primary/20 text-text-light'}`}>
                        <Icon name="straighten" className="text-lg" />
                        {selectedFilters.size === 'Todas' ? 'Talla' : selectedFilters.size}
                        <Icon name="expand_more" className="text-lg" />
                    </button>
                </div>

                <div className="px-4 mb-4">
                    <div className="flex gap-2 overflow-x-auto [-ms-scrollbar-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {productCategories.map(cat => (
                            <button
                                key={cat}
                                onClick={() => handleFilterSelect('product', cat)}
                                className={`flex h-9 shrink-0 items-center justify-center rounded-xl px-4 text-xs font-bold uppercase tracking-tight transition-colors border ${selectedFilters.product === cat ? 'bg-primary text-white border-primary shadow-md' : 'bg-background-light dark:bg-background-dark text-text-subtle-light border-border-light dark:border-border-dark hover:bg-white dark:hover:bg-accent-dark'}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    {/* Subcategorías dinámicas si aplica */}
                    {selectedFilters.product === 'Pantalones' && (
                        <div className="flex gap-2 mt-2 overflow-x-auto [-ms-scrollbar-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {['Todos', 'cortos', 'largos'].map(type => (
                                <button key={type} onClick={() => handleFilterSelect('pantType', type)} className={`flex h-8 shrink-0 items-center justify-center rounded-lg px-3 text-[10px] font-black uppercase tracking-tight transition-colors ${selectedFilters.pantType === type ? 'bg-primary/20 text-primary' : 'bg-background-light dark:bg-background-dark text-text-subtle-light'}`}>
                                    {type}
                                </button>
                            ))}
                        </div>
                    )}
                    {selectedFilters.product === 'Camisetas' && (
                        <div className="flex gap-2 mt-2 overflow-x-auto [-ms-scrollbar-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {['Todos', 'corta', 'larga'].map(type => (
                                <button key={type} onClick={() => handleFilterSelect('sleeveType', type)} className={`flex h-8 shrink-0 items-center justify-center rounded-lg px-3 text-[10px] font-black uppercase tracking-tight transition-colors ${selectedFilters.sleeveType === type ? 'bg-primary/20 text-primary' : 'bg-background-light dark:bg-background-dark text-text-subtle-light'}`}>
                                    {type === 'Todos' ? 'Todas' : `M. ${type.charAt(0).toUpperCase() + type.slice(1)}`}
                                </button>
                            ))}
                        </div>
                    )}
                    {selectedFilters.product === 'Camisas' && (
                        <div className="flex gap-2 mt-2 overflow-x-auto [-ms-scrollbar-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {['Todos', 'corta', 'larga'].map(type => (
                                <button key={type} onClick={() => handleFilterSelect('shirtSleeveType', type)} className={`flex h-8 shrink-0 items-center justify-center rounded-lg px-3 text-[10px] font-black uppercase tracking-tight transition-colors ${selectedFilters.shirtSleeveType === type ? 'bg-primary/20 text-primary' : 'bg-background-light dark:bg-background-dark text-text-subtle-light'}`}>
                                    {type === 'Todos' ? 'Todas' : `M. ${type.charAt(0).toUpperCase() + type.slice(1)}`}
                                </button>
                            ))}
                        </div>
                    )}
                    {selectedFilters.product === 'Faldas' && (
                        <div className="flex gap-2 mt-2 overflow-x-auto [-ms-scrollbar-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {['Todos', 'cortas', 'largas'].map(type => (
                                <button key={type} onClick={() => handleFilterSelect('skirtType', type)} className={`flex h-8 shrink-0 items-center justify-center rounded-lg px-3 text-[10px] font-black uppercase tracking-tight transition-colors ${selectedFilters.skirtType === type ? 'bg-primary/20 text-primary' : 'bg-background-light dark:bg-background-dark text-text-subtle-light'}`}>
                                    {type === 'Todos' ? 'Todas' : type.charAt(0).toUpperCase() + type.slice(1)}
                                </button>
                            ))}
                        </div>
                    )}
                    {selectedFilters.product === 'Calzado' && (
                        <div className="flex gap-2 mt-2 overflow-x-auto [-ms-scrollbar-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {(['Todos', 'running', 'casual', 'vestir', 'otro'] as const).map(type => (
                                <button key={type} onClick={() => handleFilterSelect('shoeType', type)} className={`flex h-8 shrink-0 items-center justify-center rounded-lg px-3 text-[10px] font-black uppercase tracking-tight transition-colors ${selectedFilters.shoeType === type ? 'bg-primary/20 text-primary' : 'bg-background-light dark:bg-background-dark text-text-subtle-light'}`}>
                                    {type === 'vestir' ? 'Vestir' : type}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="px-4 mb-2">
                    <div className="relative flex items-center h-12 w-full rounded-xl bg-accent-light dark:bg-accent-dark border border-border-light dark:border-border-dark shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                        <div className="absolute left-4 text-text-subtle-light dark:text-text-subtle-dark">
                            <Icon name="search" className="text-xl" />
                        </div>
                        <input 
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-full bg-transparent pl-12 pr-12 text-text-light dark:text-text-dark placeholder:text-text-subtle-light text-sm focus:outline-none" 
                            placeholder="Busca artículos únicos..." 
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-4 text-text-subtle-light hover:text-primary">
                                <Icon name="cancel" className="text-xl" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
            
            <main className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-4 pt-4 pb-24 min-h-[400px]">
                {filteredProducts.length > 0 ? (
                    filteredProducts.map(product => <ProductCard key={product.id} product={product} />)
                ) : (
                    <div className="col-span-full py-20 text-center">
                        <Icon name="search_off" className="text-5xl text-text-subtle-light mb-4" />
                        <p className="text-text-subtle-light font-medium italic">Sin resultados para esos filtros.</p>
                        <button onClick={() => { setSearchQuery(''); setSelectedFilters({ product: 'Todos', store: 'Todas', size: 'Todas', gender: 'Todos', pantType: 'Todos', sleeveType: 'Todos', shirtSleeveType: 'Todos', skirtType: 'Todos', shoeType: 'Todos' }); }} className="mt-6 text-primary font-bold underline">Limpiar filtros</button>
                    </div>
                )}
            </main>

            {/* Estilo flotante de asistente */}
            {!isAssistantOpen && (
                <button 
                    onClick={() => setIsAssistantOpen(true)}
                    className="fixed bottom-24 right-6 size-16 bg-gradient-to-tr from-primary to-mustard rounded-full shadow-2xl z-50 flex items-center justify-center text-white border-4 border-white dark:border-background-dark animate-pulse-soft transition-transform active:scale-90"
                    aria-label="Asistente de Estilo"
                >
                    <Icon name="auto_awesome" className="text-3xl" filled />
                </button>
            )}

            <AssistantChat isOpen={isAssistantOpen} onClose={() => setIsAssistantOpen(false)} />

            {/* Selector Bottom Sheet Sincronizado */}
            {activeFilter && (
                <div className="fixed inset-0 bg-black/60 z-[2000] flex items-end justify-center" onClick={() => setActiveFilter(null)}>
                    <div className="bg-white dark:bg-accent-dark w-full max-lg rounded-t-[40px] p-6 pb-12 animate-slide-up shadow-2xl overflow-hidden max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-700 rounded-full mx-auto mb-6 shrink-0"></div>
                        <h3 className="text-lg font-black text-center mb-6 text-text-light dark:text-white uppercase tracking-widest shrink-0">Filtrar por {activeFilter}</h3>
                        
                        <div className="overflow-y-auto pr-1 custom-scrollbar scroll-smooth">
                            {activeFilter === 'Género' ? (
                                <div className="grid grid-cols-1 gap-2">
                                    {['Todos', 'Mujer', 'Hombre', 'Niños'].map(g => (
                                        <button 
                                            key={g}
                                            onClick={() => handleFilterSelect('gender', g)}
                                            className={`w-full text-left p-5 rounded-2xl text-base font-bold transition-all ${selectedFilters.gender === g ? 'bg-primary text-white shadow-lg' : 'bg-background-light dark:bg-background-dark text-text-light hover:bg-white dark:hover:bg-border-dark'}`}
                                        >
                                            {g}
                                        </button>
                                    ))}
                                </div>
                            ) : activeFilter === 'Talla' ? (
                                <div className="space-y-6">
                                    <button 
                                        onClick={() => handleFilterSelect('size', 'Todas')}
                                        className={`w-full text-left p-4 rounded-2xl text-base font-bold transition-all ${selectedFilters.size === 'Todas' ? 'bg-primary text-white shadow-md' : 'bg-background-light dark:bg-background-dark text-text-light'}`}
                                    >
                                        Todas las tallas
                                    </button>
                                    {Object.entries(getTallaOptions()).map(([group, tallas]) => (
                                        <div key={group} className="space-y-3">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-primary/60 px-1">{group}</p>
                                            <div className="grid grid-cols-3 gap-2">
                                                {tallas.map(t => (
                                                    <button 
                                                        key={t}
                                                        onClick={() => handleFilterSelect('size', t)}
                                                        className={`h-12 flex items-center justify-center rounded-xl text-sm font-bold border transition-all ${selectedFilters.size === t ? 'bg-primary border-primary text-white shadow-sm' : 'bg-white dark:bg-background-dark border-border-light dark:border-border-dark text-text-light'}`}
                                                    >
                                                        {t}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {(activeFilter === 'Producto' ? productCategories : storeNames).map(option => (
                                        <div key={option} className="space-y-2">
                                            <button 
                                                onClick={() => handleFilterSelect(activeFilter === 'Producto' ? 'product' : 'store', option)}
                                                className={`w-full text-left p-5 rounded-2xl text-base font-bold transition-all ${(activeFilter === 'Producto' ? selectedFilters.product : selectedFilters.store) === option ? 'bg-primary text-white shadow-lg' : 'bg-background-light dark:bg-background-dark text-text-light hover:bg-white dark:hover:bg-border-dark'}`}
                                            >
                                                {option}
                                            </button>
                                            
                                            {/* Sub-apartado exclusivo para Pantalones en Explore */}
                                            {activeFilter === 'Producto' && option === 'Pantalones' && selectedFilters.product === 'Pantalones' && (
                                                <div className="grid grid-cols-3 gap-2 px-2 pb-4 animate-fade-in">
                                                    {['Todos', 'cortos', 'largos'].map(type => (
                                                        <button 
                                                            key={type}
                                                            onClick={() => handleFilterSelect('pantType', type)}
                                                            className={`h-10 rounded-xl text-[10px] font-black uppercase transition-all ${selectedFilters.pantType === type ? 'bg-primary text-white shadow-sm' : 'bg-background-light dark:bg-background-dark text-text-subtle-light'}`}
                                                        >
                                                            {type}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Sub-apartado exclusivo para Camisetas en Explore */}
                                            {activeFilter === 'Producto' && option === 'Camisetas' && selectedFilters.product === 'Camisetas' && (
                                                <div className="grid grid-cols-3 gap-2 px-2 pb-4 animate-fade-in">
                                                    {['Todos', 'corta', 'larga'].map(type => (
                                                        <button 
                                                            key={type}
                                                            onClick={() => handleFilterSelect('sleeveType', type)}
                                                            className={`h-10 rounded-xl text-[10px] font-black uppercase transition-all ${selectedFilters.sleeveType === type ? 'bg-primary text-white shadow-sm' : 'bg-background-light dark:bg-background-dark text-text-subtle-light'}`}
                                                        >
                                                            {type === 'Todos' ? 'Todas' : `M. ${type.charAt(0).toUpperCase() + type.slice(1)}`}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Sub-apartado exclusivo para Camisas en Explore */}
                                            {activeFilter === 'Producto' && option === 'Camisas' && selectedFilters.product === 'Camisas' && (
                                                <div className="grid grid-cols-3 gap-2 px-2 pb-4 animate-fade-in">
                                                    {['Todos', 'corta', 'larga'].map(type => (
                                                        <button 
                                                            key={type}
                                                            onClick={() => handleFilterSelect('shirtSleeveType', type)}
                                                            className={`h-10 rounded-xl text-[10px] font-black uppercase transition-all ${selectedFilters.shirtSleeveType === type ? 'bg-primary text-white shadow-sm' : 'bg-background-light dark:bg-background-dark text-text-subtle-light'}`}
                                                        >
                                                            {type === 'Todos' ? 'Todas' : `M. ${type.charAt(0).toUpperCase() + type.slice(1)}`}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Sub-apartado exclusivo para Faldas en Explore */}
                                            {activeFilter === 'Producto' && option === 'Faldas' && selectedFilters.product === 'Faldas' && (
                                                <div className="grid grid-cols-3 gap-2 px-2 pb-4 animate-fade-in">
                                                    {['Todos', 'cortas', 'largas'].map(type => (
                                                        <button 
                                                            key={type}
                                                            onClick={() => handleFilterSelect('skirtType', type)}
                                                            className={`h-10 rounded-xl text-[10px] font-black uppercase transition-all ${selectedFilters.skirtType === type ? 'bg-primary text-white shadow-sm' : 'bg-background-light dark:bg-background-dark text-text-subtle-light'}`}
                                                        >
                                                            {type === 'Todos' ? 'Todas' : type.charAt(0).toUpperCase() + type.slice(1)}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Sub-apartado exclusivo para Calzado en Explore */}
                                            {activeFilter === 'Producto' && option === 'Calzado' && selectedFilters.product === 'Calzado' && (
                                                <div className="grid grid-cols-5 gap-1.5 px-2 pb-4 animate-fade-in">
                                                    {(['Todos', 'running', 'casual', 'vestir', 'otro'] as const).map(type => (
                                                        <button 
                                                            key={type}
                                                            onClick={() => handleFilterSelect('shoeType', type)}
                                                            className={`h-9 rounded-xl text-[7px] font-black uppercase transition-all ${selectedFilters.shoeType === type ? (type === 'Todos' ? 'bg-primary/20 text-primary border border-primary/20' : 'bg-primary text-white shadow-sm') : 'bg-background-light dark:bg-background-dark text-text-subtle-light'}`}
                                                        >
                                                            {type === 'vestir' ? 'Vestir' : type}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DiscoverScreen;
