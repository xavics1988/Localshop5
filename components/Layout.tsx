
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../AppContext';

const Icon = ({ name, filled, className }: { name: string; filled?: boolean; className?: string }) => (
    <span className={`material-symbols-outlined ${className}`} style={{ fontVariationSettings: filled ? "'FILL' 1" : "'FILL' 0" }}>
        {name}
    </span>
);

export const Logo: React.FC<{ className?: string; showText?: boolean }> = ({ className = "h-8", showText = true }) => (
    <div className={`flex items-center gap-2 ${className}`}>
        {/* Brand SVG Logo Recreated from User Image */}
        <svg 
            viewBox="0 0 100 100" 
            fill="none" 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-full aspect-square drop-shadow-sm"
        >
            {/* Outer Circle Background */}
            <circle cx="50" cy="50" r="45" fill="#f3e3ba" stroke="#C29B88" strokeWidth="6"/>
            
            {/* Hanger Hook */}
            <path 
                d="M50 35C50 35 50 25 55 25C60 25 60 30 55 32" 
                stroke="#C29B88" 
                strokeWidth="3.5" 
                strokeLinecap="round"
            />
            <path 
                d="M50 35V38" 
                stroke="#C29B88" 
                strokeWidth="3.5" 
                strokeLinecap="round"
            />

            {/* Shirt Collar / Hanger Base */}
            <path 
                d="M32 50L50 38L68 50C75 55 75 65 65 68C55 72 45 72 35 68C25 65 25 55 32 50Z" 
                fill="white" 
                stroke="#C29B88" 
                strokeWidth="3.5" 
                strokeLinejoin="round"
            />
            
            {/* Collar Detail Lines */}
            <path 
                d="M40 45L50 55L60 45" 
                stroke="#C29B88" 
                strokeWidth="3" 
                strokeLinecap="round" 
                strokeLinejoin="round"
            />
        </svg>

        {showText && (
            <span className="font-black text-lg tracking-tighter text-[#C29B88]">
                Local<span className="opacity-70">Shop</span>
            </span>
        )}
    </div>
);

export const BottomNav: React.FC<{ activePath: string }> = ({ activePath }) => {
    const userRole = localStorage.getItem('userRole') || 'cliente';
    const { cartItems } = useCart();
    
    const items = userRole === 'colaborador' 
        ? [ 
            { path: '/', icon: 'home', label: 'HOME' }, 
            { path: '/publish', icon: 'add_circle', label: 'PUBLICAR' }, 
            { path: '/profile', icon: 'person', label: 'PERFIL' } 
          ]
        : [ 
            { path: '/', icon: 'home', label: 'HOME' }, 
            { path: '/favorites', icon: 'favorite', label: 'FAVORITOS' }, 
            { path: '/cart', icon: 'shopping_cart', label: 'CESTA' }, 
            { path: '/profile', icon: 'person', label: 'PERFIL' } 
          ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white dark:bg-accent-dark border-t border-border-light dark:border-border-dark flex justify-around items-center z-20">
            {items.map(item => (
                <Link to={item.path} key={item.path} className={`flex flex-col items-center gap-1 w-20 ${activePath === item.path ? 'text-primary' : 'text-text-subtle-light'}`}>
                    <div className="relative">
                        <Icon name={item.icon} filled={activePath === item.path} />
                        {item.path === '/cart' && cartItems.length > 0 && (
                            <span className="absolute -top-1 -right-2 size-4 bg-primary text-white text-[10px] rounded-full flex items-center justify-center font-bold">{cartItems.length}</span>
                        )}
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
                </Link>
            ))}
        </nav>
    );
};

export const DetailHeader: React.FC<{ title: string; backTo?: string; rightAction?: React.ReactNode }> = ({ title, backTo, rightAction }) => {
    const navigate = useNavigate();
    
    const handleBack = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        /**
         * Solución directa: Si hay un destino definido lo usamos. 
         * Si no, siempre navegamos a '/' (Explorar) para asegurar que el botón funcione 
         * según lo solicitado por el usuario ("volver al apartado de explorar").
         */
        if (backTo) {
            navigate(backTo);
        } else {
            navigate('/');
        }
    };

    return (
        <header className="sticky top-0 z-[100] flex items-center bg-white/95 dark:bg-background-dark/95 backdrop-blur-md h-16 border-b border-border-light dark:border-border-dark px-4">
            <button 
                type="button"
                onClick={handleBack} 
                className="relative z-[110] size-12 -ml-2 flex items-center justify-center text-text-light dark:text-text-dark active:scale-90 transition-transform cursor-pointer touch-manipulation hover:bg-black/5 dark:hover:bg-white/5 rounded-full"
                aria-label="Volver"
            >
                <Icon name="arrow_back" className="text-2xl font-bold" />
            </button>
            <h1 className="flex-1 text-center font-bold text-lg text-text-light dark:text-text-dark truncate px-2">
                {title}
            </h1>
            <div className="relative z-[110] size-12 -mr-2 flex items-center justify-center">
                {rightAction}
            </div>
        </header>
    );
};
