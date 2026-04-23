
import React from 'react';
import { HashRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AppContextProvider } from './AppContext';
import { OnboardingScreen, SignUpScreen, LoginScreen } from './screens/AuthScreens';
import DiscoverScreen from './screens/DiscoverScreen';
import ProductDetailScreen from './screens/ProductDetailScreen';
import StoreProfileScreen from './screens/StoreProfileScreen';
import {
    CartScreen, ProfileScreen, FavoritesScreen, OrdersScreen,
    PublishScreen, PurchaseHistoryScreen, MyReviewsScreen,
    AppSettingsScreen, PaymentMethodsScreen, HelpScreen,
    PaymentScreen, CollaboratorRegistrationScreen,
    EditCustomerProfileScreen, FollowedStoresScreen,
    TermsScreen, PrivacyScreen, CookiesScreen, LegalNoticeScreen,
    ManageCatalogScreen
} from './screens/PlaceholderScreens';
import GuestCheckoutScreen from './screens/GuestCheckoutScreen';
import { BottomNav } from './components/Layout';

const ScrollToTop = () => {
    const { pathname } = useLocation();

    React.useEffect(() => {
        window.scrollTo(0, 0);
    }, [pathname]);

    return null;
};

const AppContent: React.FC = () => {
    const location = useLocation();
    
    // Rutas que no deben mostrar la barra de navegación inferior
    const noNavRoutes = [
        '/welcome', 
        '/signup', 
        '/login', 
        '/publish', 
        '/payment', 
        '/collaborator-registration', 
        '/edit-profile',
        '/terms',
        '/privacy',
        '/cookies',
        '/legal-notice',
        '/guest-checkout'
    ];
    
    const showNav = !noNavRoutes.includes(location.pathname) && !location.pathname.startsWith('/publish/');

    return (
        <div className="relative min-h-screen bg-background-light dark:bg-background-dark">
            <ScrollToTop />
            <div className={showNav ? "pb-20" : ""}>
                <Routes>
                    {/* La pantalla inicial por defecto es Explorar (/) */}
                    <Route path="/" element={<DiscoverScreen />} />
                    
                    {/* Pantallas de autenticación y bienvenida */}
                    <Route path="/welcome" element={<OnboardingScreen />} />
                    <Route path="/signup" element={<SignUpScreen />} />
                    <Route path="/login" element={<LoginScreen />} />
                    
                    {/* Funcionalidades principales */}
                    <Route path="/favorites" element={<FavoritesScreen />} />
                    <Route path="/followed-stores" element={<FollowedStoresScreen />} />
                    <Route path="/product/:productId" element={<ProductDetailScreen />} />
                    <Route path="/store/:storeId" element={<StoreProfileScreen />} />
                    <Route path="/cart" element={<CartScreen />} />
                    <Route path="/orders" element={<OrdersScreen />} />
                    <Route path="/manage-catalog" element={<ManageCatalogScreen />} />
                    <Route path="/publish" element={<PublishScreen />} />
                    <Route path="/publish/:productId" element={<PublishScreen />} />
                    <Route path="/profile" element={<ProfileScreen />} />
                    <Route path="/edit-profile" element={<EditCustomerProfileScreen />} />
                    <Route path="/purchase-history" element={<PurchaseHistoryScreen />} />
                    <Route path="/my-reviews" element={<MyReviewsScreen />} />
                    <Route path="/settings" element={<AppSettingsScreen />} />
                    <Route path="/payment-methods" element={<PaymentMethodsScreen />} />
                    <Route path="/help" element={<HelpScreen />} />
                    <Route path="/terms" element={<TermsScreen />} />
                    <Route path="/privacy" element={<PrivacyScreen />} />
                    <Route path="/cookies" element={<CookiesScreen />} />
                    <Route path="/legal-notice" element={<LegalNoticeScreen />} />
                    <Route path="/payment" element={<PaymentScreen />} />
                    <Route path="/guest-checkout" element={<GuestCheckoutScreen />} />
                    <Route path="/collaborator-registration" element={<CollaboratorRegistrationScreen />} />
                    
                    {/* Fallback a la raíz si la ruta no existe */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </div>
            {showNav && <BottomNav activePath={location.pathname === '/' ? '/' : location.pathname} />}
        </div>
    );
};

const App: React.FC = () => (
    <HashRouter>
        <AppContextProvider>
            <AppContent />
        </AppContextProvider>
    </HashRouter>
);

export default App;
