
import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useNotifications } from '../AppContext';
import { supabase } from '../src/lib/supabase';
import {
    sanitizeRaw, truncate, MAX_LENGTHS,
    validateName, validateEmail, validatePassword, validateReferralCode
} from '../utils/validation';

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
    const { notify } = useNotifications();
    const [isLoading, setIsLoading] = useState(false);

    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [role, setRole] = useState<'cliente' | 'colaborador' | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');
    const [pendingEmail, setPendingEmail] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        storePublicName: '',
        email: '',
        password: '',
        location: '',
        referralInput: ''
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    const generateUniqueShopId = () => {
        const num = Math.floor(100000 + Math.random() * 900000);
        return `LS-${num}`;
    };

    useEffect(() => {
        if (role === 'colaborador' && !formData.storePublicName) {
            setFormData(prev => ({ ...prev, storePublicName: generateUniqueShopId() }));
        }
    }, [role]);

    const handleBack = () => {
        if (step === 3) setStep(2);
        else if (step === 2) setStep(1);
        else navigate('/welcome');
    };

    const validate = () => {
        const newErrors: Record<string, string> = {};
        const nameErr = validateName(formData.name);
        if (nameErr) newErrors.name = nameErr;
        const emailErr = validateEmail(formData.email);
        if (emailErr) newErrors.email = emailErr;
        const passErr = validatePassword(formData.password);
        if (passErr) newErrors.password = passErr;
        if (!formData.location) newErrors.location = 'Selecciona una provincia';
        if (!acceptTerms) newErrors.terms = 'Debes aceptar los términos';
        if (formData.referralInput) {
            const refErr = validateReferralCode(formData.referralInput);
            if (refErr) newErrors.referralInput = refErr;
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const triggerVerification = async () => {
        if (!validate()) {
            notify('Atención', 'Revisa los requisitos de seguridad.', 'error');
            return;
        }
        setIsLoading(true);

        const isCollab = role === 'colaborador';
        const finalUserName = isCollab ? formData.storePublicName : formData.name;

        // 1. Registrar en Supabase Auth (envía email OTP real)
        const { data, error } = await supabase.auth.signUp({
            email: formData.email,
            password: formData.password,
            options: {
                data: { name: finalUserName, role: role }
            }
        });

        if (error) {
            setIsLoading(false);
            if (error.message.toLowerCase().includes('already registered') || error.message.toLowerCase().includes('already been registered')) {
                notify('Error', 'Este correo ya está registrado.', 'error');
            } else {
                notify('Error', error.message, 'error');
            }
            return;
        }

        try {
            if (data.user) {
                const userId = data.user.id;
                const cleanName = formData.name.replace(/\s+/g, '').toUpperCase().substring(0, 5);
                const myReferralCode = `${cleanName}${Math.floor(1000 + Math.random() * 9000)}`;

                let storeId: string | undefined;

                if (isCollab) {
                    storeId = `STORE-${Date.now()}`;
                    await supabase.from('stores').insert({
                        id:            storeId,
                        name:          formData.storePublicName,
                        business_name: sanitizeRaw(formData.name),
                        category:      'Concept Store',
                        image_url:     'https://picsum.photos/id/1011/800/600',
                        address:       formData.location,
                        description:   'Bienvenido a mi nueva tienda local.',
                        contact_email: formData.email,
                        owner_id:      userId
                    });
                }

                await supabase.from('profiles').upsert({
                    id:               userId,
                    email:            sanitizeRaw(formData.email),
                    name:             sanitizeRaw(finalUserName),
                    location:         formData.location,
                    bio:              isCollab ? 'Bienvenido a mi nueva tienda local.' : 'Amante de la moda local.',
                    phone:            '',
                    role:             role!,
                    store_id:         storeId ?? null,
                    referral_code:    myReferralCode,
                    referred_by:      (!isCollab && formData.referralInput) ? sanitizeRaw(formData.referralInput) : null,
                    referral_balance: 0
                }, { onConflict: 'id' });
            }
        } catch (err: any) {
            notify('Error', err?.message || 'Error al crear el perfil.', 'error');
        } finally {
            setIsLoading(false);
        }

        if (data.session) {
            // Email confirmation disabled — user is already logged in
            notify(
                isCollab ? '¡Bienvenido Partner!' : '¡Cuenta creada!',
                'Ya puedes empezar a usar LocalShop.',
                isCollab ? 'storefront' : 'person'
            );
            navigate('/');
        } else {
            setPendingEmail(formData.email);
            notify('¡Código enviado!', 'Revisa tu correo real para obtener el código de verificación.', 'mail');
            setStep(3);
        }
    };

    const handleFinalSignUp = async () => {
        if (!verificationCode || verificationCode.length < 6) {
            notify('Código incorrecto', 'Introduce el código completo de tu correo.', 'error');
            return;
        }
        setIsLoading(true);
        try {
            const { error } = await supabase.auth.verifyOtp({
                email: pendingEmail || formData.email,
                token: verificationCode,
                type:  'signup'
            });

            if (error) {
                notify('Código incorrecto', `El código no es válido o ha expirado. Reenvía uno nuevo. (${error.message})`, 'error');
                return;
            }

            notify(role === 'colaborador' ? '¡Bienvenido Partner!' : '¡Cuenta creada!', 'Ya puedes empezar.', role === 'colaborador' ? 'storefront' : 'person');
            navigate('/');
        } catch (err: any) {
            notify('Error', err?.message || 'No se pudo verificar el código.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendCode = async () => {
        try {
            const { error } = await supabase.auth.resend({
                type:  'signup',
                email: pendingEmail || formData.email
            });
            if (error) {
                notify('Error', error.message, 'error');
            } else {
                notify('Reenviado', 'Código enviado de nuevo a tu correo.', 'mail');
            }
        } catch (err: any) {
            notify('Error', err?.message || 'No se pudo reenviar.', 'error');
        }
    };

    const handleSocialAuth = async (provider: 'google' | 'apple') => {
        await supabase.auth.signInWithOAuth({
            provider,
            options: { redirectTo: `${window.location.origin}/` }
        });
    };

    return (
        <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark overflow-hidden">
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

                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <button type="button" onClick={() => handleSocialAuth('google')} className="flex items-center justify-center gap-2 h-14 rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-accent-dark text-sm font-bold text-text-light dark:text-text-dark active:scale-95 transition-transform">
                                    <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" className="size-5 object-contain" alt="Google" />
                                    Google
                                </button>
                                <button type="button" onClick={() => handleSocialAuth('apple')} className="flex items-center justify-center gap-2 h-14 rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-accent-dark text-sm font-bold text-text-light dark:text-text-dark active:scale-95 transition-transform">
                                    <svg viewBox="0 0 384 512" className="size-5 fill-current"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" /></svg>
                                    Apple
                                </button>
                            </div>

                            <div className="relative flex items-center py-2">
                                <div className="flex-grow border-t border-border-light dark:border-border-dark"></div>
                                <span className="flex-shrink mx-4 text-[10px] text-text-subtle-light uppercase font-black tracking-widest">O registro manual</span>
                                <div className="flex-grow border-t border-border-light dark:border-border-dark"></div>
                            </div>

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
                                    </div>
                                </div>
                            )}

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-text-light dark:text-text-dark ml-1">
                                    {role === 'colaborador' ? 'Nombre Legal / Empresa (Privado)' : 'Nombre Completo'}
                                </label>
                                <div className={`flex items-center h-14 rounded-2xl border bg-white dark:bg-background-dark px-4 transition-all focus-within:ring-2 focus-within:ring-primary/20 ${errors.name ? 'border-red-500' : 'border-border-light dark:border-border-dark'}`}>
                                    <Icon name={role === 'colaborador' ? 'gavel' : 'person'} className="text-text-subtle-light mr-3" />
                                    <input
                                        value={formData.name}
                                        onChange={e => setFormData(p => ({ ...p, name: truncate(sanitizeRaw(e.target.value), MAX_LENGTHS.name) }))}
                                        placeholder={role === 'colaborador' ? 'Ej: Moda Local S.L.' : 'Ej: Elena García'}
                                        className="flex-1 bg-transparent text-sm font-medium outline-none text-text-light dark:text-white"
                                    />
                                </div>
                                {errors.name && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.name}</p>}
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-text-light dark:text-text-dark ml-1">Correo Electrónico</label>
                                <div className={`flex items-center h-14 rounded-2xl border bg-white dark:bg-background-dark px-4 transition-all focus-within:ring-2 focus-within:ring-primary/20 ${errors.email ? 'border-red-500' : 'border-border-light dark:border-border-dark'}`}>
                                    <Icon name="mail" className="text-text-subtle-light mr-3" />
                                    <input
                                        value={formData.email}
                                        onChange={e => setFormData(p => ({ ...p, email: truncate(sanitizeRaw(e.target.value), MAX_LENGTHS.email) }))}
                                        placeholder="tu@email.com"
                                        type="email"
                                        className="flex-1 bg-transparent text-sm font-medium outline-none text-text-light dark:text-white"
                                    />
                                </div>
                                {errors.email && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.email}</p>}
                            </div>

                            <div className="space-y-1">
                                <label className="text-xs font-bold text-text-light dark:text-text-dark ml-1">Contraseña</label>
                                <div className={`flex items-center h-14 rounded-2xl border bg-white dark:bg-background-dark px-4 transition-all focus-within:ring-2 focus-within:ring-primary/20 ${errors.password ? 'border-red-500' : 'border-border-light dark:border-border-dark'}`}>
                                    <Icon name="lock" className="text-text-subtle-light mr-3" />
                                    <input
                                        value={formData.password}
                                        onChange={e => setFormData(p => ({ ...p, password: truncate(e.target.value, MAX_LENGTHS.password) }))}
                                        placeholder="Ej: Shop2024!"
                                        type={showPassword ? "text" : "password"}
                                        className="flex-1 bg-transparent text-sm font-medium outline-none text-text-light dark:text-white"
                                    />
                                    <button onClick={() => setShowPassword(!showPassword)} className="text-text-subtle-light">
                                        <Icon name={showPassword ? "visibility_off" : "visibility"} />
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2 px-1 py-1">
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${formData.password.length >= 6 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>6+ caracteres</span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${/[A-Z]/.test(formData.password) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>Mayúscula</span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${/\d/.test(formData.password) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>Número</span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${/[!@#$%^&*(),.?":{}|<>]/.test(formData.password) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>Símbolo</span>
                                </div>
                                {errors.password && <p className="text-[10px] text-red-500 font-bold ml-1">{errors.password}</p>}
                            </div>

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

                            {role === 'cliente' && (
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-text-light dark:text-text-dark ml-1">¿Tienes un código de referido? (Opcional)</label>
                                    <div className="flex items-center h-14 rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-background-dark px-4 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
                                        <Icon name="confirmation_number" className="text-text-subtle-light mr-3" />
                                        <input
                                            value={formData.referralInput}
                                            onChange={e => setFormData(p => ({ ...p, referralInput: truncate(sanitizeRaw(e.target.value), MAX_LENGTHS.referralCode).toUpperCase() }))}
                                            placeholder="EJ: ELENA123"
                                            className="flex-1 bg-transparent text-sm font-medium outline-none text-text-light dark:text-white uppercase"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="pt-2 px-1">
                                <label className="flex items-start gap-3 cursor-pointer group">
                                    <div className="relative flex items-center mt-0.5">
                                        <input type="checkbox" checked={acceptTerms} onChange={e => setAcceptTerms(e.target.checked)} className="sr-only" />
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
                            disabled={isLoading}
                            className="w-full h-16 bg-primary text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 active:scale-95 transition-all mt-4 disabled:opacity-60"
                        >
                            {isLoading ? 'Enviando...' : `Crear cuenta ${role}`}
                        </button>
                    </div>

                ) : (
                    <div className="w-full space-y-8 animate-slide-up text-center">
                        <div className="size-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                            <Icon name="mark_email_read" className="text-4xl" filled />
                        </div>
                        <header className="space-y-2">
                            <h2 className="text-2xl font-bold text-text-light dark:text-text-dark">Verifica tu correo</h2>
                            <p className="text-sm text-text-subtle-light">Introduce el código que hemos enviado a <br /><span className="font-bold text-text-light dark:text-white">{pendingEmail || formData.email}</span></p>
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
                            <p className="text-xs text-text-subtle-light">¿No has recibido nada? <button onClick={handleResendCode} className="text-primary font-bold underline">Reenviar código</button></p>
                        </div>

                        <button
                            onClick={handleFinalSignUp}
                            disabled={isLoading}
                            className="w-full h-16 bg-primary text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 active:scale-95 transition-all mt-4 disabled:opacity-60"
                        >
                            {isLoading ? 'Verificando...' : 'Verificar y Entrar'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export const LoginScreen: React.FC = () => {
    const navigate = useNavigate();
    const { notify } = useNotifications();
    const [isLoading, setIsLoading] = useState(false);

    const [view, setView] = useState<'login' | 'forgot' | 'verify' | 'reset'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [forgotEmail, setForgotEmail] = useState('');
    const [resetCode, setResetCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);

    const handleBack = () => {
        if (view === 'forgot') setView('login');
        else if (view === 'verify') setView('forgot');
        else if (view === 'reset') setView('verify');
        else if (window.history.length > 1) navigate(-1);
        else navigate('/welcome');
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (validateEmail(email) || !password) {
            notify('Error', 'Introduce un email y contraseña válidos.', 'error');
            return;
        }
        setIsLoading(true);
        try {
            const timeout = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('timeout')), 12000)
            );
            const { error } = await Promise.race([
                supabase.auth.signInWithPassword({ email, password }),
                timeout
            ]);
            if (error) {
                const msg = error.message.toLowerCase();
                if (msg.includes('email not confirmed')) {
                    notify('Error', 'Confirma tu correo antes de iniciar sesión, o desactiva la confirmación en Supabase.', 'error');
                } else if (msg.includes('invalid login') || msg.includes('invalid credentials')) {
                    notify('Error', 'Correo o contraseña incorrectos.', 'error');
                } else {
                    notify('Error', error.message, 'error');
                }
            } else {
                notify('Bienvenido', '¡Hola de nuevo!', 'login');
                navigate('/');
            }
        } catch (err: any) {
            if (err?.message === 'timeout') {
                notify('Error', 'La conexión tardó demasiado. Recarga la página e inténtalo de nuevo.', 'error');
            } else {
                notify('Error', 'No se pudo conectar. Comprueba tu conexión.', 'error');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleSocialAuth = async (provider: 'google' | 'apple') => {
        await supabase.auth.signInWithOAuth({
            provider,
            options: { redirectTo: `${window.location.origin}/` }
        });
    };

    const handleForgotRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        if (validateEmail(forgotEmail)) {
            notify('Error', 'Introduce un email válido.', 'error');
            return;
        }
        setIsLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
                redirectTo: `${window.location.origin}/`
            });
            if (error) { notify('Error', error.message, 'error'); return; }
            setView('verify');
            notify('¡Código enviado!', 'Revisa tu correo para el código de recuperación.', 'mail');
        } catch (err: any) {
            notify('Error', err?.message || 'Error desconocido.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyReset = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resetCode || resetCode.length < 6) {
            notify('Código incorrecto', 'Introduce el código de 6 dígitos de tu correo.', 'error');
            return;
        }
        setIsLoading(true);
        try {
            const { error } = await supabase.auth.verifyOtp({
                email: forgotEmail,
                token: resetCode,
                type:  'recovery'
            });
            if (error) { notify('Código incorrecto', `El código no es válido o ha expirado. (${error.message})`, 'error'); return; }
            setView('reset');
        } catch (err: any) {
            notify('Error', err?.message || 'Error desconocido.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handlePasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();
        const passErr = validatePassword(newPassword);
        if (passErr) {
            notify('Insegura', passErr, 'error');
            return;
        }
        setIsLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) { notify('Error', error.message, 'error'); return; }
            notify('¡Éxito!', 'Tu contraseña ha sido actualizada.', 'lock_reset');
            setView('login');
            setEmail(forgotEmail);
        } catch (err: any) {
            notify('Error', err?.message || 'Error desconocido.', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="relative flex min-h-screen w-full flex-col bg-background-light dark:bg-background-dark overflow-hidden">
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
                                    <input required value={email} onChange={e => setEmail(truncate(sanitizeRaw(e.target.value), MAX_LENGTHS.email))} className="form-input w-full rounded-2xl border border-border-light bg-white dark:bg-background-dark dark:border-border-dark text-text-light dark:text-text-dark h-14 pl-10 pr-3 text-base placeholder:text-text-light/30 outline-none focus:ring-2 focus:ring-primary/20" placeholder="tu@email.com" type="email" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="flex justify-between items-end mb-1">
                                    <label className="text-sm font-medium block text-text-light dark:text-text-dark ml-1">Contraseña</label>
                                    <button type="button" onClick={() => setView('forgot')} className="text-xs text-primary font-bold hover:underline">¿Olvidaste tu contraseña?</button>
                                </div>
                                <div className="relative">
                                    <Icon name="lock" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-light/50 dark:text-text-dark/50" />
                                    <input required value={password} onChange={e => setPassword(truncate(e.target.value, MAX_LENGTHS.password))} className="form-input w-full rounded-2xl border border-border-light bg-white dark:bg-background-dark dark:border-border-dark text-text-light dark:text-text-dark h-14 pl-10 pr-3 text-base placeholder:text-text-light/30 outline-none focus:ring-2 focus:ring-primary/20" placeholder="••••••••" type="password" />
                                </div>
                            </div>
                            <button type="submit" disabled={isLoading} className="w-full h-16 bg-primary text-white font-black uppercase tracking-widest rounded-2xl shadow-xl active:scale-95 transition-all mt-4 disabled:opacity-60">
                                {isLoading ? 'Entrando...' : 'Entrar'}
                            </button>

                            <div className="relative py-4 flex items-center">
                                <div className="flex-grow border-t border-border-light dark:border-border-dark"></div>
                                <span className="flex-shrink mx-4 text-xs text-text-subtle-light uppercase font-bold tracking-widest">O accede con</span>
                                <div className="flex-grow border-t border-border-light dark:border-border-dark"></div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <button type="button" onClick={() => handleSocialAuth('google')} className="flex items-center justify-center gap-2 h-14 rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-accent-dark text-sm font-bold text-text-light dark:text-text-dark active:scale-95 transition-transform">
                                    <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" className="size-5 object-contain" alt="Google" />
                                    Google
                                </button>
                                <button type="button" onClick={() => handleSocialAuth('apple')} className="flex items-center justify-center gap-2 h-14 rounded-2xl border border-border-light dark:border-border-dark bg-white dark:bg-accent-dark text-sm font-bold text-text-light dark:text-text-dark active:scale-95 transition-transform">
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
                            <p className="text-sm text-text-subtle-light">Introduce tu correo y te enviaremos un código para restablecerla.</p>
                        </header>
                        <form onSubmit={handleForgotRequest} className="space-y-6">
                            <div className="relative">
                                <Icon name="mail" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-light/50 dark:text-text-dark/50" />
                                <input required value={forgotEmail} onChange={e => setForgotEmail(truncate(sanitizeRaw(e.target.value), MAX_LENGTHS.email))} className="form-input w-full rounded-2xl border border-border-light bg-white dark:bg-background-dark dark:border-border-dark text-text-light dark:text-text-dark h-14 pl-10 pr-3 text-base placeholder:text-text-light/30 outline-none focus:ring-2 focus:ring-primary/20" placeholder="tu@email.com" type="email" />
                            </div>
                            <button type="submit" disabled={isLoading} className="w-full h-16 bg-primary text-white font-black uppercase tracking-widest rounded-2xl shadow-xl active:scale-95 transition-all disabled:opacity-60">
                                {isLoading ? 'Enviando...' : 'Enviar código'}
                            </button>
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
                            <p className="text-sm text-text-subtle-light">Introduce el código de 6 dígitos enviado a <br /><span className="font-bold text-text-light dark:text-white">{forgotEmail}</span></p>
                        </header>
                        <form onSubmit={handleVerifyReset} className="space-y-6">
                            <input type="text" maxLength={6} value={resetCode} onChange={e => setResetCode(e.target.value.replace(/\D/g, ''))} placeholder="000000" className="w-48 h-16 bg-white dark:bg-accent-dark border-2 border-primary/20 rounded-2xl text-center text-3xl font-black tracking-[0.2em] outline-none focus:border-primary transition-colors text-text-light dark:text-white" />
                            <button type="submit" disabled={isLoading} className="w-full h-16 bg-primary text-white font-black uppercase tracking-widest rounded-2xl shadow-xl active:scale-95 transition-all disabled:opacity-60">
                                {isLoading ? 'Verificando...' : 'Verificar código'}
                            </button>
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
                                    <input required value={newPassword} onChange={e => setNewPassword(truncate(e.target.value, MAX_LENGTHS.password))} className="form-input w-full rounded-2xl border border-border-light bg-white dark:bg-background-dark dark:border-border-dark text-text-light dark:text-text-dark h-14 pl-10 pr-12 text-base outline-none focus:ring-2 focus:ring-primary/20" placeholder="Mín. 6 caracteres" type={showNewPassword ? "text" : "password"} />
                                    <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-subtle-light">
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
                            <button type="submit" disabled={isLoading} className="w-full h-16 bg-primary text-white font-black uppercase tracking-widest rounded-2xl shadow-xl active:scale-95 transition-all mt-4 disabled:opacity-60">
                                {isLoading ? 'Actualizando...' : 'Actualizar y entrar'}
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};
