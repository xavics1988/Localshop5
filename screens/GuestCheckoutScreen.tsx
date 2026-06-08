
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { DetailHeader } from '../components/Layout';
import { useCart, useNotifications, SHIPPING_FEE, FREE_SHIPPING_THRESHOLD } from '../AppContext';
import { SPANISH_PROVINCES } from './AuthScreens';
import {
    sanitizeRaw, truncate, MAX_LENGTHS,
    validateName, validateEmail, validatePhone,
} from '../utils/validation';

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL      as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const Icon = ({ name, filled, className }: { name: string; filled?: boolean; className?: string }) => (
    <span
        className={`material-symbols-outlined ${className}`}
        style={{ fontVariationSettings: `'FILL' ${filled ? 1 : 0}, 'wght' 400, 'GRAD' 0, 'opsz' 24` }}
    >
        {name}
    </span>
);

const FormInput = ({
    label, value, type = 'text', onChange, placeholder, required, maxLength, disabled
}: {
    label: string; value: string; type?: string; onChange: (v: string) => void;
    placeholder?: string; required?: boolean; maxLength?: number; disabled?: boolean;
}) => (
    <div className="space-y-1.5">
        <label className="text-xs font-black uppercase tracking-widest text-text-light dark:text-text-dark opacity-70">
            {label}{required && <span className="text-red-400 ml-1">*</span>}
        </label>
        <input
            required={required}
            disabled={disabled}
            type={type}
            value={value}
            maxLength={maxLength}
            onChange={e => onChange(e.target.value)}
            placeholder={placeholder}
            className={`w-full h-12 bg-white dark:bg-accent-dark border border-border-light dark:border-border-dark rounded-xl px-4 text-text-light dark:text-text-dark font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
        />
    </div>
);

const FormSelect = ({
    label, value, onChange, options, required
}: {
    label: string; value: string; onChange: (v: string) => void; options: string[]; required?: boolean;
}) => (
    <div className="space-y-1.5">
        <label className="text-xs font-black uppercase tracking-widest text-text-light dark:text-text-dark opacity-70">
            {label}{required && <span className="text-red-400 ml-1">*</span>}
        </label>
        <div className="relative">
            <select
                required={required}
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full h-12 bg-white dark:bg-accent-dark border border-border-light dark:border-border-dark rounded-xl px-4 pr-10 text-text-light dark:text-text-dark font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all appearance-none"
            >
                <option value="">Seleccionar provincia</option>
                {options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                ))}
            </select>
            <Icon name="expand_more" className="absolute right-3 top-1/2 -translate-y-1/2 text-text-subtle-light pointer-events-none" />
        </div>
    </div>
);

type Step = 'info' | 'payment' | 'success';

interface GuestData {
    nombre: string;
    apellidos: string;
    email: string;
    telefono: string;
    direccion: string;
    piso: string;
    ciudad: string;
    provincia: string;
    codigoPostal: string;
    notasEntrega: string;
}

const GuestCheckoutScreen: React.FC = () => {
    const navigate   = useNavigate();
    const stripe     = useStripe();
    const elements   = useElements();
    const { cartItems, clearCart } = useCart();
    const { notify } = useNotifications();
    const [step, setStep]     = useState<Step>('info');
    const [orderId, setOrderId] = useState('');
    const [loading, setLoading] = useState(false);
    const [isDark, setIsDark]   = useState(false);

    useEffect(() => {
        const check = () => setIsDark(document.documentElement.classList.contains('dark'));
        check();
        const observer = new MutationObserver(check);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => observer.disconnect();
    }, []);

    const [guestData, setGuestData] = useState<GuestData>({
        nombre: '', apellidos: '', email: '', telefono: '',
        direccion: '', piso: '', ciudad: '', provincia: '',
        codigoPostal: '', notasEntrega: ''
    });

    const subtotal = cartItems.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const freeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;
    const shippingCost = freeShipping ? 0 : SHIPPING_FEE;
    const total = subtotal + shippingCost;

    const setField = (field: keyof GuestData) => (v: string) =>
        setGuestData(prev => ({ ...prev, [field]: v }));

    const handleInfoNext = () => {
        const { nombre, apellidos, email, telefono, direccion, ciudad, provincia, codigoPostal } = guestData;

        if (!nombre || !apellidos || !email || !telefono || !direccion || !ciudad || !provincia || !codigoPostal) {
            notify('Campos incompletos', 'Por favor, rellena todos los campos obligatorios.', 'error');
            return;
        }

        const nameErr = validateName(nombre) || validateName(apellidos);
        if (nameErr) { notify('Error', nameErr, 'error'); return; }

        const emailErr = validateEmail(email);
        if (emailErr) { notify('Error', emailErr, 'error'); return; }

        const phoneErr = validatePhone(telefono);
        if (phoneErr) { notify('Error', phoneErr, 'error'); return; }

        if (!/^\d{5}$/.test(codigoPostal)) {
            notify('Código postal inválido', 'El código postal debe tener 5 dígitos.', 'error');
            return;
        }

        setStep('payment');
        window.scrollTo(0, 0);
    };

    const handleConfirmPayment = async () => {
        if (!stripe || !elements || cartItems.length === 0) return;

        const cardElement = elements.getElement(CardElement);
        if (!cardElement) {
            notify('Error', 'No se pudo inicializar el formulario de pago.', 'error');
            return;
        }

        setLoading(true);

        try {
            // 1. Crear PaymentIntent en el servidor
            const totalInCents = Math.round(total * 100);
            const intentRes = await fetch(`${SUPABASE_URL}/functions/v1/create-payment-intent`, {
                method:  'POST',
                headers: {
                    'Content-Type':  'application/json',
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({
                    amount:   totalInCents,
                    subtotal: Math.round(subtotal * 100),
                    // Si todos los items son de la misma tienda, pasar storeId para reparto automático
                    ...(new Set(cartItems.map(i => i.product.storeId)).size === 1
                        ? { storeId: cartItems[0].product.storeId }
                        : {}),
                    metadata: { guestEmail: guestData.email },
                }),
            });
            const { clientSecret, error: intentError } = await intentRes.json();
            if (intentError) throw new Error(intentError);

            // 2. Confirmar el pago con los datos de la tarjeta (Stripe tokeniza el número)
            const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
                payment_method: {
                    card: cardElement as any,
                    billing_details: {
                        name:    `${guestData.nombre} ${guestData.apellidos}`,
                        email:   guestData.email,
                        phone:   guestData.telefono,
                        address: {
                            line1:       guestData.direccion,
                            city:        guestData.ciudad,
                            postal_code: guestData.codigoPostal,
                            country:     'ES',
                        },
                    },
                },
            });

            if (error) throw new Error(error.message);

            const generatedOrderId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
            console.log(`[STRIPE] PaymentIntent ${paymentIntent?.id} succeeded | Total: €${total.toFixed(2)}`);

            clearCart();
            setOrderId(generatedOrderId);
            setStep('success');
            window.scrollTo(0, 0);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Error al procesar el pago';
            notify('Error de pago', message, 'error');
        } finally {
            setLoading(false);
        }
    };

    if (step === 'success') {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen flex flex-col items-center justify-center p-6 text-center animate-fade-in">
                <div className="size-24 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                    <Icon name="check_circle" className="text-6xl text-primary" filled />
                </div>
                <h1 className="text-3xl font-black mb-2 text-text-light dark:text-text-dark">¡Pedido confirmado!</h1>
                <p className="text-sm font-bold text-text-subtle-light mb-1">Número de pedido</p>
                <p className="text-xl font-black text-primary mb-4">{orderId}</p>
                <p className="text-text-subtle-light font-medium px-6 leading-relaxed text-sm">
                    Hemos enviado la confirmación a{' '}
                    <span className="font-bold text-text-light dark:text-text-dark">{guestData.email}</span>.
                    Las tiendas están preparando tus artículos.
                </p>
                <div className="mt-8 w-full max-w-xs bg-primary/5 border border-primary/20 rounded-2xl p-5 text-left space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-2">Datos de envío</p>
                    <p className="text-sm font-bold text-text-light dark:text-text-dark">{guestData.nombre} {guestData.apellidos}</p>
                    <p className="text-xs text-text-subtle-light">{guestData.direccion}{guestData.piso ? `, ${guestData.piso}` : ''}</p>
                    <p className="text-xs text-text-subtle-light">{guestData.codigoPostal} {guestData.ciudad}, {guestData.provincia}</p>
                </div>
                <div className="mt-6 w-full max-w-xs space-y-3">
                    <div className="bg-accent-light dark:bg-accent-dark rounded-2xl p-4 text-center">
                        <p className="text-xs text-text-subtle-light leading-relaxed">
                            ¿Quieres hacer seguimiento de pedidos y guardar tus datos?
                        </p>
                        <button
                            onClick={() => navigate('/signup')}
                            className="mt-2 text-primary text-xs font-black uppercase tracking-widest"
                        >
                            Crear cuenta gratuita
                        </button>
                    </div>
                    <button
                        onClick={() => navigate('/')}
                        className="w-full h-14 bg-primary text-white font-bold rounded-2xl shadow-xl active:scale-95 transition-transform"
                    >
                        Volver al inicio
                    </button>
                </div>
            </div>
        );
    }

    if (step === 'payment') {
        return (
            <div className="bg-background-light dark:bg-background-dark min-h-screen pb-10">
                <DetailHeader title="Método de Pago" />
                <div className="p-4 space-y-6 animate-fade-in">
                    {/* Progress */}
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="flex-1 h-1 rounded-full bg-primary" />
                            <div className="flex-1 h-1 rounded-full bg-primary" />
                        </div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-text-subtle-light text-center">
                            Paso 2 de 2 — Pago
                        </p>
                    </div>

                    {/* Resumen del pedido */}
                    <div className="bg-white dark:bg-accent-dark p-6 rounded-[32px] border border-border-light dark:border-border-dark shadow-sm">
                        <h3 className="text-sm font-black uppercase tracking-widest text-text-subtle-light mb-4">Resumen</h3>
                        <div className="flex justify-between items-center py-2 border-b border-border-light/50">
                            <span className="text-sm font-bold text-text-light dark:text-text-dark">Subtotal</span>
                            <span className="text-sm font-bold text-text-light dark:text-text-dark">€{subtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-border-light/50">
                            <div className="flex flex-col">
                                <span className="text-sm font-bold text-text-light dark:text-text-dark">Gastos de envío</span>
                                {freeShipping
                                    ? <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black uppercase">Gestionado por el colaborador · Gratis</span>
                                    : <span className="text-[10px] text-text-subtle-light">Tarifa para pedidos menores de €{FREE_SHIPPING_THRESHOLD}</span>
                                }
                            </div>
                            {freeShipping
                                ? <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">Gratis</span>
                                : <span className="text-sm font-bold text-text-light dark:text-text-dark">€{SHIPPING_FEE.toFixed(2)}</span>
                            }
                        </div>
                        <div className="flex justify-between items-center pt-4">
                            <span className="text-lg font-black text-text-light dark:text-text-dark">Total a pagar</span>
                            <span className="text-xl font-black text-primary">€{total.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Dirección (resumen editable) */}
                    <div className="bg-white dark:bg-accent-dark p-5 rounded-[32px] border border-border-light dark:border-border-dark shadow-sm">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="text-sm font-black uppercase tracking-widest text-text-subtle-light">Envío a</h3>
                            <button onClick={() => setStep('info')} className="text-primary text-xs font-black uppercase tracking-widest">
                                Editar
                            </button>
                        </div>
                        <p className="font-bold text-text-light dark:text-text-dark text-sm">{guestData.nombre} {guestData.apellidos}</p>
                        <p className="text-xs text-text-subtle-light mt-0.5">{guestData.direccion}{guestData.piso ? `, ${guestData.piso}` : ''}</p>
                        <p className="text-xs text-text-subtle-light">{guestData.codigoPostal} {guestData.ciudad}, {guestData.provincia}</p>
                        <p className="text-xs text-text-subtle-light mt-1">{guestData.email} · {guestData.telefono}</p>
                    </div>

                    {/* Datos de tarjeta — gestionado de forma segura por Stripe */}
                    <div className="bg-white dark:bg-accent-dark p-6 rounded-[32px] border border-border-light dark:border-border-dark shadow-sm space-y-4">
                        <h3 className="text-sm font-black uppercase tracking-widest text-text-subtle-light">Tarjeta de Pago</h3>
                        <div className="border border-border-light dark:border-border-dark rounded-xl px-4 py-3.5 bg-white dark:bg-accent-dark">
                            <CardElement
                                options={{
                                    style: {
                                        base: {
                                            fontSize:        '15px',
                                            color:           isDark ? '#F0F2F4' : '#6B7785',
                                            fontFamily:      'Inter, sans-serif',
                                            '::placeholder': { color: isDark ? '#94a3b8' : '#8E8E93' },
                                            iconColor:       '#c29b88',
                                        },
                                        invalid: { color: '#ef4444', iconColor: '#ef4444' },
                                    },
                                    hidePostalCode: true,
                                }}
                            />
                        </div>
                        <p className="text-[10px] text-text-subtle-light leading-relaxed">
                            Tus datos de pago se cifran y procesan de forma segura por Stripe. LocalShop nunca almacena tu número de tarjeta.
                        </p>
                    </div>

                    <div className="bg-primary/5 border border-primary/20 p-5 rounded-2xl flex gap-4 items-start">
                        <Icon name="verified_user" className="text-primary text-2xl shrink-0 mt-0.5" />
                        <div className="flex-1 space-y-1.5">
                            <p className="text-[10px] font-bold text-primary/80 leading-relaxed">
                                Pago 100% seguro procesado por <span className="font-black">Stripe</span>. Tus datos de tarjeta están cifrados y nunca pasan por nuestros servidores.
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={handleConfirmPayment}
                        disabled={loading}
                        className="w-full h-16 bg-primary text-white font-bold rounded-2xl shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-3 text-lg disabled:opacity-60"
                    >
                        {loading ? (
                            <span className="animate-spin material-symbols-outlined">progress_activity</span>
                        ) : (
                            <>
                                <Icon name="lock" />
                                Confirmar Pago — €{total.toFixed(2)}
                            </>
                        )}
                    </button>
                </div>
            </div>
        );
    }

    // Step 'info'
    return (
        <div className="bg-background-light dark:bg-background-dark min-h-screen pb-10">
            <DetailHeader title="Comprar como Invitado" />
            <div className="p-4 space-y-6 animate-fade-in">
                {/* Progreso */}
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <div className="flex-1 h-1 rounded-full bg-primary" />
                        <div className="flex-1 h-1 rounded-full bg-border-light dark:bg-border-dark" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-text-subtle-light text-center">
                        Paso 1 de 2 — Datos personales y envío
                    </p>
                </div>

                {/* Datos personales */}
                <div className="bg-white dark:bg-accent-dark p-6 rounded-[32px] border border-border-light dark:border-border-dark shadow-sm space-y-4">
                    <h3 className="text-sm font-black uppercase tracking-widest text-text-subtle-light">Datos Personales</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <FormInput
                            label="Nombre"
                            value={guestData.nombre}
                            placeholder="María"
                            required
                            onChange={v => setField('nombre')(truncate(sanitizeRaw(v), MAX_LENGTHS.name))}
                        />
                        <FormInput
                            label="Apellidos"
                            value={guestData.apellidos}
                            placeholder="García López"
                            required
                            onChange={v => setField('apellidos')(truncate(sanitizeRaw(v), MAX_LENGTHS.name))}
                        />
                    </div>
                    <FormInput
                        label="Email"
                        type="email"
                        value={guestData.email}
                        placeholder="maria@ejemplo.com"
                        required
                        onChange={v => setField('email')(truncate(sanitizeRaw(v), MAX_LENGTHS.email))}
                    />
                    <FormInput
                        label="Teléfono"
                        type="tel"
                        value={guestData.telefono}
                        placeholder="600 000 000"
                        maxLength={9}
                        required
                        onChange={v => setField('telefono')(v.replace(/\D/g, '').substring(0, 9))}
                    />
                </div>

                {/* Dirección de envío */}
                <div className="bg-white dark:bg-accent-dark p-6 rounded-[32px] border border-border-light dark:border-border-dark shadow-sm space-y-4">
                    <h3 className="text-sm font-black uppercase tracking-widest text-text-subtle-light">Dirección de Envío</h3>
                    <FormInput
                        label="Dirección"
                        value={guestData.direccion}
                        placeholder="Calle Mayor, 12"
                        required
                        onChange={v => setField('direccion')(truncate(sanitizeRaw(v), MAX_LENGTHS.location))}
                    />
                    <FormInput
                        label="Piso / Puerta"
                        value={guestData.piso}
                        placeholder="2º B (opcional)"
                        onChange={v => setField('piso')(truncate(sanitizeRaw(v), 20))}
                    />
                    <div className="grid grid-cols-2 gap-4">
                        <FormInput
                            label="Ciudad"
                            value={guestData.ciudad}
                            placeholder="Madrid"
                            required
                            onChange={v => setField('ciudad')(truncate(sanitizeRaw(v), 100))}
                        />
                        <FormInput
                            label="Código Postal"
                            value={guestData.codigoPostal}
                            placeholder="28001"
                            maxLength={5}
                            required
                            onChange={v => setField('codigoPostal')(v.replace(/\D/g, '').substring(0, 5))}
                        />
                    </div>
                    <FormSelect
                        label="Provincia"
                        value={guestData.provincia}
                        options={SPANISH_PROVINCES}
                        required
                        onChange={setField('provincia')}
                    />
                    <FormInput
                        label="Notas de entrega"
                        value={guestData.notasEntrega}
                        placeholder="Dejar en conserjería... (opcional)"
                        onChange={v => setField('notasEntrega')(truncate(sanitizeRaw(v), 300))}
                    />
                </div>

                {/* Total */}
                <div className="bg-white dark:bg-accent-dark p-5 rounded-[32px] border border-border-light dark:border-border-dark shadow-sm space-y-3">
                    <div className="flex justify-between items-center border-b border-border-light/50 pb-3">
                        <span className="text-sm font-bold text-text-light dark:text-text-dark">Subtotal</span>
                        <span className="text-sm font-bold text-text-light dark:text-text-dark">€{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-border-light/50 pb-3">
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-text-light dark:text-text-dark">Gastos de envío</span>
                            {freeShipping
                                ? <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-black uppercase">El colaborador gestiona el envío</span>
                                : <span className="text-[10px] text-text-subtle-light">Tarifa para pedidos &lt;€{FREE_SHIPPING_THRESHOLD}</span>
                            }
                        </div>
                        {freeShipping
                            ? <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">Gratis</span>
                            : <span className="text-sm font-bold text-text-light dark:text-text-dark">€{SHIPPING_FEE.toFixed(2)}</span>
                        }
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="font-black text-text-light dark:text-text-dark">Total del pedido</span>
                        <span className="font-black text-primary text-xl">€{total.toFixed(2)}</span>
                    </div>
                </div>

                {!freeShipping && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl p-4 flex gap-3 items-start">
                        <Icon name="local_shipping" className="text-amber-600 dark:text-amber-400 text-xl shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed font-medium">
                            Añade <span className="font-black">€{(FREE_SHIPPING_THRESHOLD - subtotal).toFixed(2)}</span> más de la misma tienda y el colaborador asumirá los gastos de envío.
                        </p>
                    </div>
                )}

                {/* Acciones */}
                <div className="flex gap-3">
                    <button
                        onClick={() => navigate('/cart')}
                        className="flex-1 h-14 border-2 border-border-light dark:border-border-dark text-text-light dark:text-text-dark font-bold rounded-2xl active:scale-95 transition-transform"
                    >
                        Volver
                    </button>
                    <button
                        onClick={handleInfoNext}
                        className="flex-[2] h-14 bg-primary text-white font-bold rounded-2xl shadow-xl active:scale-95 transition-transform flex items-center justify-center gap-2"
                    >
                        Continuar al pago
                        <Icon name="arrow_forward" />
                    </button>
                </div>

                <div className="text-center pb-2">
                    <p className="text-[10px] text-text-subtle-light font-medium mb-1">¿Ya tienes cuenta?</p>
                    <button
                        onClick={() => navigate('/login')}
                        className="text-primary text-xs font-black uppercase tracking-widest"
                    >
                        Iniciar sesión
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GuestCheckoutScreen;
