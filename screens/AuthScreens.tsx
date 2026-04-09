
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUser, useStores, useNotifications } from '../AppContext';

const Icon = ({ name, className, filled }: { name: string; className?: string; filled?: boolean }) => (
    <span
        className={`material-symbols-outlined ${className}`}
        style={{ fontVariationSettings: filled ? "'FILL' 1" : "'FILL' 0" }}
    >
        {name}
    </span>
);

export const SPANISH_PROVINCES = [
    "Álava", "Albacete", "Alicante", "Almería", "Asturias", "Ávila", "Badajoz", "Barcelona", "Burgos", "Cáceres",
    "Cádiz", "Cantabria", "Castellón", "Ciudad Real", "Córdoba", "Cuenca", "Gerona", "Granada", "Guadalajara",
    "Guipúzcoa", "Huelva", "Huesca", "Islas Baleares", "Jaén", "La Coruña", "La Rioja", "Las Palmas", "León",
    "Lérida", "Lugo", "Madrid", "Málaga", "Murcia", "Navarra", "Orense", "Palencia", "Pontevedra", "Salamanca",
    "Santa Cruz de Tenerife", "Segovia", "Sevilla", "Soria", "Tarragona", "Teruel", "Toledo", "Valencia",
    "Valladolid", "Vizcaya", "Zamora", "Zaragoza", "Ceuta", "Melilla"
].sort((a, b) => a.localeCompare(b));

export const OnboardingScreen: React.FC = () => {
    const navigate = useNavigate();

    const handleNavigation = (path: string) => {
        localStorage.setItem('hasOnboarded', 'true');
        navigate(path);
    };

    return (
        <div className="relative flex min-h-screen w-full flex-col font-display text-text-light dark:text-background-light">
            <div className="flex flex-col flex-1">
                <div className="flex-grow min-h-[50vh] bg-cover bg-center flex flex-col justify-end" style={{ backgroundImage: `linear-gradient(0deg, rgba(0, 0, 0, 0.4) 0%, rgba(0, 0, 0, 0) 25%), url("https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=2070&auto=format&fit=crop")` }}>
                    <div className="flex justify-center gap-2 p-5">
                        <div className="size-1.5 rounded-full bg-white"></div>
                        <div className="size-1.5 rounded-full bg-white opacity-50"></div>
                        <div className="size-1.5 rounded-full bg-white opacity-50"></div>
                    </div>
                </div>
                <div className="flex-shrink-0 bg-background-light dark:bg-background-dark px-4 pb-4">
                    <h1 className="tracking-tight text-3xl font-bold text-center pb-3 pt-6 text-text-light dark:text-white">LocalShop</h1>
                    <p className="text-base font-normal leading-normal pb-3 pt-1 text-center text-text-light dark:text-gray-300">
                        ¡Vende como siempre, llega donde nunca!
                    </p>
                    <div className="flex justify-center">
                        <div className="flex flex-1 gap-3 max-w-[480px] flex-col items-stretch pt-3">
                            <button onClick={() => handleNavigation('/signup')} className="flex items-center justify-center rounded-lg h-12 px-5 bg-primary text-white text-base font-bold active:scale-95 transition-transform shadow-lg">
                                Crear cuenta
                            </button>
                            <button onClick={() => handleNavigation('/login')} className="flex items-center justify-center rounded-lg h-12 px-5 bg-transparent border border-border-light dark:border-border-dark text-text-light dark:text-white text-base font-bold active:scale-95 transition-transform">
                                Entrar
                            </button>
                        </div>
                    </div>
                    <p onClick={() => handleNavigation('/')} className="text-text-subtle-light dark:text-text-subtle-dark text-sm pt-6 pb-3 px-4 text-center underline cursor-pointer">Ver como invitado</p>
                </div>
            </div>
        </div>
    );
};

export const SignUpScreen: React.FC = () => {
    const navigate = useNavigate();
    const { updateUser, logout } = useUser();
    const { addStore, stores } = useStores();
    const { notify } = useNotifications();

    // Estados de Flujo
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [role, setRole] = useState<'cliente' | 'colaborador' | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');
    const [showPushNotice, setshowPushNotice] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        storePublicName: '',
        email: '',
        password: '',
        location: '',
        referralInput: '' // Nuevo campo para el código del amigo
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    const generateUniqueShopId = () => {
        let isUnique = false;
        let newId = '';
        while (!isUnique) {
            const num = Math.floor(100000 + Math.random() * 900000);
            newId = `LS-${num}`;
            isUnique = !stores.some(s => s.name === newId);
        }
        return newId;
    };

    useEffect(() => {
        if (role === 'colaborador' && !formData.storePublicName) {
            setFormData(prev => ({ ...prev, storePublicName: generateUniqueShopId() }));
        }
    }, [role]);

    const handleBack = () => {
        if (step === 3) {
            setStep(2);
        } else if (step === 2) {
            setStep(1);
        } else {
            navigate('/welcome');
        }
    };

    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!formData.name) newErrors.name = 'El nombre es obligatorio';

        // Email
        if (!formData.email) newErrors.email = 'El email es obligatorio';
        else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email no válido';

        // Password Robusta
        const password = formData.password;
        if (!password) {
            newErrors.password = 'La contraseña es obligatoria';
        } else if (password.length < 6) {
            newErrors.password = 'Mínimo 6 caracteres';
        } else if (!/[A-Z]/.test(password)) {
            newErrors.password = 'Debe incluir una mayúscula';
        } else if (!/\d/.test(password)) {
            newErrors.password = 'Debe incluir al menos un número';
        } else if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            newErrors.password = 'Debe incluir un signo de puntuación';
        }

        if (!formData.location) newErrors.location = 'Selecciona una provincia';
        if (!acceptTerms) newErrors.terms = 'Debes aceptar los términos';

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const triggerVerification = () => {
        if (!validate()) {
            notify('Atención', 'Revisa los requisitos de seguridad.', 'error');
            return;
        }

        setStep(3);
        notify('Enviando...', 'Generando código de seguridad.', 'sync');

        // Simulamos la llegada del "correo" mediante una notificación push ficticia en 2 segundos
        setTimeout(() => {
            setshowPushNotice(true);
            notify('¡Código enviado!', 'Revisa tu bandeja de entrada simulada.', 'mail');
        }, 2000);
    };

    const handleFinalSignUp = () => {
        if (verificationCode !== '123456') {
            notify('Código incorrecto', 'Prueba con 123456.', 'error');
            return;
        }

        const isCollab = role === 'colaborador';
        const savedUsers = localStorage.getItem('app_users');
        const usersList = savedUsers ? JSON.parse(savedUsers) : [];

        if (usersList.find((u: any) => u.email === formData.email)) {
            notify('Error', 'Este correo ya está registrado.', 'error');
            return;
        }

        let storeId = undefined;
        let finalUserName = isCollab ? formData.storePublicName : formData.name;

        if (isCollab) {
            storeId = `STORE-${Date.now()}`;
            addStore({
                id: storeId,
                name: formData.storePublicName,
                businessName: formData.name,
                category: 'Concept Store',
                imageUrl: 'https://picsum.photos/id/1011/800/600',
                address: formData.location,
                description: 'Bienvenido a mi nueva tienda local.',
                contactEmail: formData.email
            });
        }

        // Generación de código de referido único
        const cleanName = formData.name.replace(/\s+/g, '').toUpperCase().substring(0, 5);
        const myReferralCode = `${cleanName}${Math.floor(1000 + Math.random() * 9000)}`;

        const newUserProfile = {
            id: crypto.randomUUID(),
            email: formData.email,
            password: formData.password,
            role: role!,
            name: finalUserName,
            businessName: isCollab ? formData.name : undefined,
            location: formData.location,
            storeId: storeId,
            bio: isCollab ? 'Bienvenido a mi nueva tienda local.' : 'Amante de la moda local.',
            phone: '',
            referralCode: myReferralCode,
            referredBy: !isCollab && formData.referralInput ? formData.referralInput : undefined,
            referralBalance: 0
        };

        usersList.push(newUserProfile);
        localStorage.setItem('app_users', JSON.stringify(usersList));

        // Limpiamos cualquier estado anterior para evitar fugas
        logout();

        // Establecemos la nueva sesión
        localStorage.setItem('userRole', role!);
        localStorage.setItem('userName', finalUserName);
        updateUser(newUserProfile);

        notify(isCollab ? '¡Bienvenido Partner!' : '¡Cuenta creada!', 'Ya puedes empezar.', isCollab ? 'storefront' : 'person');
        navigate('/');
    };

    const handleSocialAuth = (provider: string) => {
        notify('Próximamente', `El registro como ${role} con ${provider} estará disponible próximamente.`, 'info');
    };

    return (
        <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark overflow-hidden">

            {/* Simulación de Notificación Push de Correo */}
            {showPushNotice && (
                <div className="fixed top-2 left-4 right-4 z-[5000] animate-slide-up">
                    <div className="bg-black/90 dark:bg-white text-white dark:text-black p-4 rounded-2xl shadow-2xl flex items-center gap-4 border border-white/10 ring-1 ring-black/5">
                        <div className="size-10 bg-primary rounded-full flex items-center justify-center text-white shrink-0">
                            <Icon name="mail" filled />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Nuevo Correo: LocalShop</p>
                            <p className="text-sm font-bold truncate">Tu código de verificación es: <span className="text-primary font-black">123456</span></p>
                        </div>
                        <button onClick={() => setshowPushNotice(false)} className="opacity-40"><Icon name="close" /></button>
                    </div>
                </div>
            )}

            {/* Header / Back */}
            <div className="flex items-center px-4 h-16 shrink-0">
                <button
                    onClick={handleBack}
                    className="size-10 flex items-center justify-center rounded-full bg-white dark:bg-accent-dark text-text-light dark:text-text-dark shadow-sm border border-border-light dark:border-border-dark active:scale-90 transition-transform"
                >
                    <Icon name="arrow_back" />
                </button>
                <div className="flex-1 flex justify-center pr-10">
                    <div className="flex gap-2">
                        <div className={`h-1.5 w-8 rounded-full transition-colors ${step >= 1 ? 'bg-primary' : 'bg-border-light'}`}></div>
                        <div className={`h-1.5 w-8 rounded-full transition-colors ${step >= 2 ? 'bg-primary' : 'bg-border-light'}`}></div>
                        <div className={`h-1.5 w-8 rounded-full transition-colors ${step >= 3 ? 'bg-primary' : 'bg-border-light'}`}></div>
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center p-6 max-w-md mx-auto w-full animate-fade-in overflow-y-auto">

                {step === 1 ? (
                    <div className="w-full space-y-8">
                        <header className="text-center space-y-2">
                            <h1 className="font-serif text-4xl font-bold tracking-tight text-text-light dark:text-text-dark">¿Cómo quieres unirte?</h1>
                            <p className="text-text-subtle-light dark:text-text-subtle-dark">Elige el perfil que mejor se adapte a ti.</p>
                        </header>

                        <div className="grid gap-4">
                            <button
                                onClick={() => { setRole('cliente'); setStep(2); }}
                                className={`group relative flex flex-col items-start p-6 rounded-3xl border-2 transition-all text-left ${role === 'cliente' ? 'border-primary bg-primary/5 shadow-md' : 'border-gray-300 dark:border-border-dark hover:border-primary/50'}`}
                            >
                                <div className="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <Icon name="person" className="text-3xl" filled={role === 'cliente'} />
                                </div>
                                <h3 className="text-xl font-bold text-text-light dark:text-text-dark">Soy Cliente</h3>
                                <p className="text-sm text-text-subtle-light mt-1">Busco piezas únicas, moda sostenible y apoyar mis tiendas de barrio.</p>
                                <div className="absolute top-6 right-6 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Icon name="chevron_right" />
                                </div>
                            </button>

                            <button
                                onClick={() => { setRole('colaborador'); setStep(2); }}
                                className={`group relative flex flex-col items-start p-6 rounded-3xl border-2 transition-all text-left ${role === 'colaborador' ? 'border-primary bg-primary/5 shadow-md' : 'border-gray-300 dark:border-border-dark hover:border-primary/50'}`}
                            >
                                <div className="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <Icon name="storefront" className="text-3xl" filled={role === 'colaborador'} />
                                </div>
                                <h3 className="text-xl font-bold text-text-light dark:text-text-dark">Soy Colaborador</h3>
                                <p className="text-sm text-text-subtle-light mt-1">Quiero digitalizar mi escaparate y conectar con clientes de toda Europa.</p>
                                <div className="absolute top-6 right-6 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Icon name="chevron_right" />
                                </div>
                            </button>
                        </div>

                        <footer className="pt-4 text-center">
                            <p className="text-sm text-text-subtle-light">
                                ¿Ya eres usuario? <Link className="font-bold text-primary" to="/login">Inicia sesión</Link>
                            </p>
                        </footer>
                    </div>
                ) : step === 2 ? (
                    <div className="w-full space-y-6 animate-slide-up">
                        <header className="text-center space-y-1">
                            <h2 className="text-2xl font-bold text-text-light dark:text-text-dark">
                                {role === 'colaborador' ? 'Registro de Partner' : 'Registro de Cliente'}
                            </h2>
                            <p className="text-sm text-text-subtle-light">Introduce tus datos para continuar.</p>
                        </header>

                        {/* Opciones Sociales Integradas en el Paso de Registro */}
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <button type="button" onClick={() => handleSocialAuth('Google')} className="flex items-center justify-center gap-2 h-14 rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-accent-dark text-sm font-bold text-text-light dark:text-text-dark active:scale-95 transition-transform">
                                    <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" className="size-5 object-contain" alt="Google" />
                                    Google
                                </button>
                                <button type="button" onClick={() => handleSocialAuth('Apple')} className="flex items-center justify-center gap-2 h-14 rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-accent-dark text-sm font-bold text-text-light dark:text-text-dark active:scale-95 transition-transform">
                                    <svg viewBox="0 0 384 512" className="size-5 fill-current"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" /></svg>
                                    Apple
                                </button>
                            </div>

                            <div className="relative flex items-center py-2">
                                <div className="flex-grow border-t border-border-light dark:border-border-dark"></div>
                                <span className="flex-shrink mx-4 text-[10px] text-text-subtle-light uppercase font-black tracking-widest">O registro manual</span>
                                <div className="flex-grow border-t border-border-light dark:border-border-dark"></div>
                            </div>

                            {/* Identidad Visual IA para Colaboradores */}
                            {role === 'colaborador' && formData.storePublicName && (
                                <div className="bg-gradient-to-br from-primary to-olive p-[1px] rounded-3xl shadow-lg">
                                    <div className="bg-white dark:bg-accent-dark rounded-[23px] p-5 flex items-center gap-4">
                                        <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                            <Icon name="verified_user" filled />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-primary/60">Identidad Pública Local</p>
                                            <p className="text-2xl font-black text-primary tracking-tighter">{formData.storePublicName}</p>
                                        </div>
                                        <div className="group relative">
                                            <Icon name="info" className="text-text-subtle-light/40" />
                                            <div className="absolute bottom-full right-0 mb-2 w-48 bg-black text-white text-[10px] p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                                Este ID protege tu anonimato legal frente a clientes finales.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Campo Nombre */}
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-text-light dark:text-text-dark ml-1">
                                    {role === 'colaborador' ? 'Nombre Legal / Empresa (Privado)' : 'Nombre Completo'}
                                </label>
                                <div className={`flex items-center h-14 rounded-2xl border bg-white dark:bg-background-dark px-4 transition-all focus-within:ring-2 focus-within:ring-primary/20 ${errors.name ? 'border-red-500' : 'border-border-light dark:border-border-dark'}`}>
                                    <Icon name={role === 'colaborador' ? 'gavel' : 'person'} className="text-text-subtle-light mr-3" />
                                    <input
                                        value={formData.name}
                                        onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                                        placeholder={role === 'colaborador' ? 'Ej: Moda Local S.L.' : 'Ej: Elena García'}
                                        className="flex-1 bg-transparent text-sm font-medium outline-none text-text-light dark:text-white"
                                    />
                                </div>
                                {errors.name && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.name}</p>}
                            </div>

                            {/* Campo Email */}
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-text-light dark:text-text-dark ml-1">Correo Electrónico</label>
                                <div className={`flex items-center h-14 rounded-2xl border bg-white dark:bg-background-dark px-4 transition-all focus-within:ring-2 focus-within:ring-primary/20 ${errors.email ? 'border-red-500' : 'border-border-light dark:border-border-dark'}`}>
                                    <Icon name="mail" className="text-text-subtle-light mr-3" />
                                    <input
                                        value={formData.email}
                                        onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                                        placeholder="tu@email.com"
                                        type="email"
                                        className="flex-1 bg-transparent text-sm font-medium outline-none text-text-light dark:text-white"
                                    />
                                </div>
                                {errors.email && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.email}</p>}
                            </div>

                            {/* Campo Password Robusta */}
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-text-light dark:text-text-dark ml-1">Contraseña</label>
                                <div className={`flex items-center h-14 rounded-2xl border bg-white dark:bg-background-dark px-4 transition-all focus-within:ring-2 focus-within:ring-primary/20 ${errors.password ? 'border-red-500' : 'border-border-light dark:border-border-dark'}`}>
                                    <Icon name="lock" className="text-text-subtle-light mr-3" />
                                    <input
                                        value={formData.password}
                                        onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
                                        placeholder="Ej: Shop2024!"
                                        type={showPassword ? "text" : "password"}
                                        className="flex-1 bg-transparent text-sm font-medium outline-none text-text-light dark:text-white"
                                    />
                                    <button onClick={() => setShowPassword(!showPassword)} className="text-text-subtle-light">
                                        <Icon name={showPassword ? "visibility_off" : "visibility"} />
                                    </button>
                                </div>
                                {/* Ayuda visual de requisitos */}
                                <div className="flex flex-wrap gap-2 px-1 py-1">
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${formData.password.length >= 6 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>6+ caracteres</span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${/[A-Z]/.test(formData.password) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>Mayúscula</span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${/\d/.test(formData.password) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>Número</span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${/[!@#$%^&*(),.?":{}|<>]/.test(formData.password) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>Símbolo</span>
                                </div>
                                {errors.password && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.password}</p>}
                            </div>

                            {/* Campo Provincia */}
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-text-light dark:text-text-dark ml-1">Provincia</label>
                                <div className={`flex items-center h-14 rounded-2xl border bg-white dark:bg-background-dark px-4 transition-all focus-within:ring-2 focus-within:ring-primary/20 ${errors.location ? 'border-red-500' : 'border-border-light dark:border-border-dark'}`}>
                                    <Icon name="location_on" className="text-text-subtle-light mr-3" />
                                    <select
                                        value={formData.location}
                                        onChange={e => setFormData(p => ({ ...p, location: e.target.value }))}
                                        className="flex-1 bg-transparent text-sm font-bold text-text-light dark:text-white appearance-none outline-none cursor-pointer"
                                    >
                                        <option value="" disabled>Selecciona tu provincia</option>
                                        {SPANISH_PROVINCES.map(prov => (
                                            <option key={prov} value={prov}>{prov}</option>
                                        ))}
                                    </select>
                                    <Icon name="expand_more" className="text-text-subtle-light" />
                                </div>
                                {errors.location && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.location}</p>}
                            </div>

                            {/* Campo Código de Referido (Opcional, solo para Clientes) */}
                            {role === 'cliente' && (
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-text-light dark:text-text-dark ml-1">¿Tienes un código de referido? (Opcional)</label>
                                    <div className="flex items-center h-14 rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-background-dark px-4 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                                        <Icon name="confirmation_number" className="text-text-subtle-light mr-3" />
                                        <input
                                            value={formData.referralInput}
                                            onChange={e => setFormData(p => ({ ...p, referralInput: e.target.value.toUpperCase() }))}
                                            placeholder="EJ: ELENA123"
                                            className="flex-1 bg-transparent text-sm font-medium outline-none text-text-light dark:text-white uppercase"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Términos y Condiciones */}
                            <div className="pt-2 px-1">
                                <label className="flex items-start gap-3 cursor-pointer group">
                                    <div className="relative flex items-center mt-0.5">
                                        <input
                                            type="checkbox"
                                            checked={acceptTerms}
                                            onChange={e => setAcceptTerms(e.target.checked)}
                                            className="sr-only"
                                        />
                                        <div className={`size-5 rounded-md border-2 transition-colors flex items-center justify-center ${acceptTerms ? 'bg-primary border-primary' : 'border-gray-400 dark:border-gray-600 group-hover:border-primary'}`}>
                                            {acceptTerms && <Icon name="check" className="text-white text-xs" />}
                                        </div>
                                    </div>
                                    <span className="text-[11px] text-text-subtle-light leading-tight">
                                        He leído y acepto los <Link to="/terms" className="text-primary font-bold">Términos y Condiciones</Link> y la <Link to="/privacy" className="text-primary font-bold">Política de Privacidad</Link>.
                                    </span>
                                </label>
                                {errors.terms && <p className="text-[10px] text-red-500 font-bold mt-1">{errors.terms}</p>}
                            </div>
                        </div>

                        <button
                            onClick={triggerVerification}
                            className="w-full h-16 bg-primary text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 active:scale-95 transition-all mt-4"
                        >
                            Crear cuenta {role}
                        </button>
                    </div>
                ) : (
                    <div className="w-full space-y-8 animate-slide-up text-center">
                        <div className="size-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                            <Icon name="mark_email_read" className="text-4xl" filled />
                        </div>
                        <header className="space-y-2">
                            <h2 className="text-2xl font-bold text-text-light dark:text-text-dark">Verifica tu correo</h2>
                            <p className="text-sm text-text-subtle-light">Introduce el código de 6 dígitos que hemos enviado a <br /><span className="font-bold text-text-light dark:text-white">{formData.email}</span></p>
                        </header>

                        <div className="space-y-4">
                            <div className="flex justify-center">
                                <input
                                    type="text"
                                    maxLength={6}
                                    value={verificationCode}
                                    onChange={e => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                                    placeholder="000000"
                                    className="w-48 h-16 bg-white dark:bg-accent-dark border-2 border-primary/20 rounded-2xl text-center text-3xl font-black tracking-[0.2em] outline-none focus:border-primary transition-colors text-text-light dark:text-white"
                                />
                            </div>
                            <p className="text-xs text-text-subtle-light">¿No has recibido nada? <button onClick={() => notify('Reenviado', 'Código enviado de nuevo.', 'mail')} className="text-primary font-bold underline">Reenviar código</button></p>
                        </div>

                        <button
                            onClick={handleFinalSignUp}
                            className="w-full h-16 bg-primary text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 active:scale-95 transition-all mt-4"
                        >
                            Verificar y Entrar
                        </button>

                        <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 mt-6">
                            <p className="text-[10px] text-primary uppercase font-black tracking-[0.2em] mb-1">Entorno de Pruebas</p>
                            <p className="text-[11px] text-text-subtle-light leading-snug">Al ser un prototipo, el correo se simula con una notificación push. El código es <span className="font-bold text-primary">123456</span>.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export const LoginScreen: React.FC = () => {
    const navigate = useNavigate();
    const { notify } = useNotifications();
    const { updateUser, logout } = useUser();

    // Estados de autenticación
    const [view, setView] = useState<'login' | 'forgot' | 'verify' | 'reset'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    // Estados para recuperación
    const [forgotEmail, setForgotEmail] = useState('');
    const [resetCode, setResetCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [showPushNotice, setshowPushNotice] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);

    const handleBack = () => {
        if (view === 'forgot') setView('login');
        else if (view === 'verify') setView('forgot');
        else if (view === 'reset') setView('verify');
        else if (window.history.length > 1) navigate(-1);
        else navigate('/welcome');
    };

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        const savedUsers = localStorage.getItem('app_users');
        const usersList = savedUsers ? JSON.parse(savedUsers) : [];
        const foundUser = usersList.find((u: any) => u.email === email && u.password === password);

        if (foundUser) {
            // Limpiamos sesión anterior
            logout();

            // Establecemos nueva sesión
            localStorage.setItem('userRole', foundUser.role);
            localStorage.setItem('userName', foundUser.name);
            updateUser(foundUser);
            notify('Bienvenido', `Hola de nuevo, ${foundUser.name}`, 'login');
            navigate('/');
        } else {
            notify('Error', 'Credenciales incorrectas.', 'error');
        }
    };

    const handleSocialAuth = (provider: string) => {
        notify('Próximamente', `El inicio de sesión con ${provider} estará disponible próximamente.`, 'info');
    };

    const handleForgotRequest = (e: React.FormEvent) => {
        e.preventDefault();
        const savedUsers = localStorage.getItem('app_users');
        const usersList = savedUsers ? JSON.parse(savedUsers) : [];
        const found = usersList.find((u: any) => u.email === forgotEmail);

        if (!found) {
            notify('No encontrado', 'Este correo no está registrado.', 'error');
            return;
        }

        setView('verify');
        notify('Enviando...', 'Generando enlace de seguridad.', 'sync');
        setTimeout(() => {
            setshowPushNotice(true);
            notify('¡Código enviado!', 'Revisa tu aviso superior.', 'mail');
        }, 1500);
    };

    const handleVerifyReset = (e: React.FormEvent) => {
        e.preventDefault();
        if (resetCode !== '123456') {
            notify('Código incorrecto', 'Usa el código 123456.', 'error');
            return;
        }
        setView('reset');
    };

    const handlePasswordReset = (e: React.FormEvent) => {
        e.preventDefault();

        // Validación Robusta (Mismo nivel que el registro)
        const passwordRegex = /[!@#$%^&*(),.?":{}|<>]/.test(newPassword);
        const upperRegex = /[A-Z]/.test(newPassword);
        const digitRegex = /\d/.test(newPassword);

        if (newPassword.length < 6 || !upperRegex || !digitRegex || !passwordRegex) {
            notify('Insegura', 'La contraseña no cumple los requisitos de seguridad.', 'error');
            return;
        }

        const savedUsers = localStorage.getItem('app_users');
        if (savedUsers) {
            const users = JSON.parse(savedUsers);
            const updatedUsers = users.map((u: any) =>
                u.email === forgotEmail ? { ...u, password: newPassword } : u
            );
            localStorage.setItem('app_users', JSON.stringify(updatedUsers));
        }

        notify('¡Éxito!', 'Tu contraseña ha sido actualizada.', 'lock_reset');
        setView('login');
        setEmail(forgotEmail);
    };

    return (
        <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark overflow-hidden">

            {/* Simulación Push */}
            {showPushNotice && (
                <div className="fixed top-2 left-4 right-4 z-[5000] animate-slide-up">
                    <div className="bg-black/90 dark:bg-white text-white dark:text-black p-4 rounded-2xl shadow-2xl flex items-center gap-4 border border-white/10 ring-1 ring-black/5">
                        <div className="size-10 bg-primary rounded-full flex items-center justify-center text-white shrink-0">
                            <Icon name="lock_reset" filled />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Seguridad: LocalShop</p>
                            <p className="text-sm font-bold truncate">Código de recuperación: <span className="text-primary font-black">123456</span></p>
                        </div>
                        <button onClick={() => setshowPushNotice(false)} className="opacity-40"><Icon name="close" /></button>
                    </div>
                </div>
            )}

            <button
                onClick={handleBack}
                className="absolute top-4 left-4 z-50 flex size-12 items-center justify-center rounded-full bg-white dark:bg-accent-dark text-text-light dark:text-dark shadow-md border border-border-light dark:border-border-dark active:scale-90 transition-transform"
                aria-label="Volver"
            >
                <Icon name="arrow_back" />
            </button>

            <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-md mx-auto w-full animate-fade-in overflow-y-auto">

                {view === 'login' && (
                    <div className="w-full space-y-8 animate-slide-up">
                        <header className="w-full text-center">
                            <h1 className="font-serif text-4xl font-bold tracking-tight text-text-light dark:text-text-dark">Inicia Sesión</h1>
                            <p className="mt-2 text-base text-text-light/70 dark:text-text-dark/70">Vuelve a conectar con tus tiendas favoritas.</p>
                        </header>
                        <form onSubmit={handleLogin} className="w-full space-y-6">
                            <div className="space-y-1">
                                <label className="text-sm font-medium block text-text-light dark:text-text-dark ml-1">Correo Electrónico</label>
                                <div className="relative">
                                    <Icon name="mail" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-light/50 dark:text-text-dark/50" />
                                    <input
                                        required
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        className="form-input w-full rounded-2xl border border-border-light bg-white dark:bg-background-dark dark:border-border-dark text-text-light dark:text-text-dark h-14 pl-10 pr-3 text-base placeholder:text-text-light/30 outline-none focus:ring-2 focus:ring-primary/20"
                                        placeholder="tu@email.com"
                                        type="email"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between items-end mb-1">
                                    <label className="text-sm font-medium block text-text-light dark:text-text-dark ml-1">Contraseña</label>
                                    <button
                                        type="button"
                                        onClick={() => setView('forgot')}
                                        className="text-xs text-primary font-bold hover:underline"
                                    >
                                        ¿Olvidaste tu contraseña?
                                    </button>
                                </div>
                                <div className="relative">
                                    <Icon name="lock" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-light/50 dark:text-text-dark/50" />
                                    <input
                                        required
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        className="form-input w-full rounded-2xl border border-border-light bg-white dark:bg-background-dark dark:border-border-dark text-text-light dark:text-text-dark h-14 pl-10 pr-3 text-base placeholder:text-text-light/30 outline-none focus:ring-2 focus:ring-primary/20"
                                        placeholder="••••••••"
                                        type="password"
                                    />
                                </div>
                            </div>
                            <button type="submit" className="w-full h-16 bg-primary text-white font-black uppercase tracking-widest rounded-2xl shadow-xl active:scale-95 transition-all mt-4">Entrar</button>

                            <div className="relative py-4 flex items-center">
                                <div className="flex-grow border-t border-border-light dark:border-border-dark"></div>
                                <span className="flex-shrink mx-4 text-xs text-text-subtle-light uppercase font-bold tracking-widest">O accede con</span>
                                <div className="flex-grow border-t border-border-light dark:border-border-dark"></div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button type="button" onClick={() => handleSocialAuth('Google')} className="flex items-center justify-center gap-2 h-14 rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-accent-dark text-sm font-bold text-text-light dark:text-text-dark active:scale-95 transition-transform">
                                    <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" className="size-5 object-contain" alt="Google" />
                                    Google
                                </button>
                                <button type="button" onClick={() => handleSocialAuth('Apple')} className="flex items-center justify-center gap-2 h-14 rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-accent-dark text-sm font-bold text-text-light dark:text-text-dark active:scale-95 transition-transform">
                                    <svg viewBox="0 0 384 512" className="size-5 fill-current"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" /></svg>
                                    Apple
                                </button>
                            </div>
                        </form>
                        <footer className="pt-6 text-center">
                            <p className="text-sm text-text-subtle-light">
                                ¿No tienes una cuenta? <Link className="font-black text-primary hover:underline" to="/signup">Regístrate gratis</Link>
                            </p>
                        </footer>
                    </div>
                )}

                {view === 'forgot' && (
                    <div className="w-full space-y-8 animate-slide-up text-center">
                        <div className="size-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                            <Icon name="lock_open" className="text-4xl" />
                        </div>
                        <header className="space-y-2">
                            <h2 className="text-2xl font-bold text-text-light dark:text-text-dark">¿Has olvidado la clave?</h2>
                            <p className="text-sm text-text-subtle-light">No te preocupes. Introduce tu correo y te enviaremos un código para restablecerla.</p>
                        </header>
                        <form onSubmit={handleForgotRequest} className="space-y-6">
                            <div className="relative">
                                <Icon name="mail" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-light/50 dark:text-text-dark/50" />
                                <input
                                    required
                                    value={forgotEmail}
                                    onChange={e => setForgotEmail(e.target.value)}
                                    className="form-input w-full rounded-2xl border border-border-light bg-white dark:bg-background-dark dark:border-border-dark text-text-light dark:text-text-dark h-14 pl-10 pr-3 text-base placeholder:text-text-light/30 outline-none focus:ring-2 focus:ring-primary/20"
                                    placeholder="tu@email.com"
                                    type="email"
                                />
                            </div>
                            <button type="submit" className="w-full h-16 bg-primary text-white font-black uppercase tracking-widest rounded-2xl shadow-xl active:scale-95 transition-all">Enviar código</button>
                        </form>
                    </div>
                )}

                {view === 'verify' && (
                    <div className="w-full space-y-8 animate-slide-up text-center">
                        <div className="size-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                            <Icon name="mark_email_read" className="text-4xl" />
                        </div>
                        <header className="space-y-2">
                            <h2 className="text-2xl font-bold text-text-light dark:text-text-dark">Confirma tu identidad</h2>
                            <p className="text-sm text-text-subtle-light">Introduce el código que hemos enviado a <br /><span className="font-bold text-text-light dark:text-white">{forgotEmail}</span></p>
                        </header>
                        <form onSubmit={handleVerifyReset} className="space-y-6">
                            <input
                                type="text"
                                maxLength={6}
                                value={resetCode}
                                onChange={e => setResetCode(e.target.value.replace(/\D/g, ''))}
                                placeholder="000000"
                                className="w-48 h-16 bg-white dark:bg-accent-dark border-2 border-primary/20 rounded-2xl text-center text-3xl font-black tracking-[0.2em] outline-none focus:border-primary transition-colors text-text-light dark:text-white"
                            />
                            <button type="submit" className="w-full h-16 bg-primary text-white font-black uppercase tracking-widest rounded-2xl shadow-xl active:scale-95 transition-all">Verificar código</button>
                            <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                                <p className="text-[10px] text-primary uppercase font-black tracking-widest">Código demo: 123456</p>
                            </div>
                        </form>
                    </div>
                )}

                {view === 'reset' && (
                    <div className="w-full space-y-8 animate-slide-up text-center">
                        <div className="size-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                            <Icon name="security" className="text-4xl" />
                        </div>
                        <header className="space-y-2">
                            <h2 className="text-2xl font-bold text-text-light dark:text-text-dark">Nueva contraseña</h2>
                            <p className="text-sm text-text-subtle-light">Crea una clave segura para proteger tu cuenta de LocalShop.</p>
                        </header>
                        <form onSubmit={handlePasswordReset} className="space-y-6 text-left">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase tracking-widest text-text-subtle-light ml-1">Contraseña nueva</label>
                                <div className="relative">
                                    <Icon name="lock" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-light/50 dark:text-text-dark/50" />
                                    <input
                                        required
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        className="form-input w-full rounded-2xl border border-border-light bg-white dark:bg-background-dark dark:border-border-dark text-text-light dark:text-text-dark h-14 pl-10 pr-12 text-base outline-none focus:ring-2 focus:ring-primary/20"
                                        placeholder="Mín. 6 caracteres"
                                        type={showNewPassword ? "text" : "password"}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-subtle-light"
                                    >
                                        <Icon name={showNewPassword ? "visibility_off" : "visibility"} />
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2 pt-2">
                                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${newPassword.length >= 6 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>6+ CARACT.</span>
                                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${/[A-Z]/.test(newPassword) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>MAYÚSCULA</span>
                                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${/\d/.test(newPassword) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>NÚMERO</span>
                                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-full ${/[!@#$%^&*(),.?":{}|<>]/.test(newPassword) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>SÍMBOLO</span>
                                </div>
                            </div>
                            <button type="submit" className="w-full h-16 bg-primary text-white font-black uppercase tracking-widest rounded-2xl shadow-xl active:scale-95 transition-all mt-4">Actualizar y entrar</button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};
