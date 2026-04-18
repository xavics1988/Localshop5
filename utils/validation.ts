/**
 * Centralized input sanitization and validation utilities.
 * All user-facing input must pass through sanitize() before being stored or displayed.
 */

// Strip HTML tags and dangerous characters to prevent XSS
export function sanitize(value: string): string {
    return value
        .replace(/<[^>]*>/g, '')           // strip HTML tags
        .replace(/javascript:/gi, '')       // strip javascript: URIs
        .replace(/on\w+\s*=/gi, '')        // strip event handlers (onerror=, onclick=...)
        .replace(/[&<>"'`]/g, (char) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '`': '&#x60;',
        }[char] ?? char));
}

// Strip HTML only (no entity encoding) — for values stored and compared, not rendered as HTML
export function sanitizeRaw(value: string): string {
    return value
        .replace(/<[^>]*>/g, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
}

export const MAX_LENGTHS = {
    name: 100,
    email: 254,
    password: 128,
    bio: 500,
    comment: 1000,
    search: 200,
    productField: 150,
    barcode: 50,
    price: 10,
    referralCode: 20,
    cardHolder: 100,
    bankHolder: 100,
    bankName: 100,
    bic: 11,
    chatMessage: 2000,
    phone: 20,
    location: 150,
    cif: 20,
};

export function truncate(value: string, maxLen: number): string {
    return value.slice(0, maxLen);
}

// Validators — return error message string or null if valid

export function validateName(value: string): string | null {
    const v = value.trim();
    if (!v) return 'El nombre es obligatorio';
    if (v.length < 2) return 'El nombre debe tener al menos 2 caracteres';
    if (v.length > MAX_LENGTHS.name) return `Máximo ${MAX_LENGTHS.name} caracteres`;
    if (/[<>&"'`]/.test(v)) return 'El nombre contiene caracteres no permitidos';
    return null;
}

export function validateEmail(value: string): string | null {
    const v = value.trim();
    if (!v) return 'El email es obligatorio';
    if (v.length > MAX_LENGTHS.email) return 'Email demasiado largo';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Email no válido';
    if (/[<>&"'`]/.test(v)) return 'El email contiene caracteres no permitidos';
    return null;
}

export function validatePassword(value: string): string | null {
    if (!value) return 'La contraseña es obligatoria';
    if (value.length < 6) return 'Mínimo 6 caracteres';
    if (value.length > MAX_LENGTHS.password) return `Máximo ${MAX_LENGTHS.password} caracteres`;
    if (!/[A-Z]/.test(value)) return 'Debe incluir una mayúscula';
    if (!/\d/.test(value)) return 'Debe incluir al menos un número';
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(value)) return 'Debe incluir un signo de puntuación';
    return null;
}

export function validateComment(value: string): string | null {
    const v = value.trim();
    if (!v) return 'El comentario no puede estar vacío';
    if (v.length > MAX_LENGTHS.comment) return `Máximo ${MAX_LENGTHS.comment} caracteres`;
    return null;
}

export function validateSearchQuery(value: string): string | null {
    if (value.length > MAX_LENGTHS.search) return `Búsqueda demasiado larga`;
    return null;
}

export function validateProductField(value: string, fieldName: string): string | null {
    if (value.length > MAX_LENGTHS.productField) return `${fieldName}: máximo ${MAX_LENGTHS.productField} caracteres`;
    if (/[<>&"'`]/.test(value)) return `${fieldName}: contiene caracteres no permitidos`;
    return null;
}

export function validatePrice(value: string): string | null {
    if (!value) return null;
    const num = parseFloat(value);
    if (isNaN(num)) return 'El precio debe ser un número válido';
    if (num < 0) return 'El precio no puede ser negativo';
    if (num > 999999) return 'El precio es demasiado elevado';
    return null;
}

export function validateCardNumber(rawNumber: string): string | null {
    if (rawNumber.length !== 16) return 'El número de tarjeta debe tener 16 dígitos';
    if (!/^\d+$/.test(rawNumber)) return 'El número de tarjeta solo puede contener dígitos';
    return null;
}

export function validateCardExpiry(expiry: string): string | null {
    if (!/^\d{2}\/\d{2}$/.test(expiry)) return 'Formato inválido (MM/YY)';
    const [mm, yy] = expiry.split('/').map(Number);
    if (mm < 1 || mm > 12) return 'Mes inválido';
    const now = new Date();
    const fullYear = 2000 + yy;
    if (fullYear < now.getFullYear() || (fullYear === now.getFullYear() && mm < now.getMonth() + 1)) {
        return 'La tarjeta ha caducado';
    }
    return null;
}

export function validateCVV(cvv: string): string | null {
    if (cvv.length < 3 || cvv.length > 4) return 'El CVV debe tener 3 o 4 dígitos';
    if (!/^\d+$/.test(cvv)) return 'El CVV solo puede contener dígitos';
    return null;
}

export function validateIBAN(rawIban: string): string | null {
    if (rawIban.length !== 24) return 'El IBAN debe tener exactamente 24 caracteres';
    if (!/^[A-Z]{2}\d{22}$/.test(rawIban)) return 'Formato de IBAN inválido (ej: ES + 22 dígitos)';
    return null;
}

export function validateBIC(bic: string): string | null {
    if (!bic) return null;
    if (!/^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic.toUpperCase())) {
        return 'Formato de BIC/SWIFT inválido';
    }
    return null;
}

export function validateReferralCode(value: string): string | null {
    if (!value) return null;
    if (value.length > MAX_LENGTHS.referralCode) return `Máximo ${MAX_LENGTHS.referralCode} caracteres`;
    if (!/^[A-Z0-9]+$/.test(value)) return 'Solo letras y números en mayúsculas';
    return null;
}

export function validatePhone(value: string): string | null {
    if (!value) return null;
    if (value.length > MAX_LENGTHS.phone) return `Máximo ${MAX_LENGTHS.phone} caracteres`;
    if (!/^[+\d\s\-().]{7,20}$/.test(value)) return 'Teléfono no válido';
    return null;
}

export function validateChatMessage(value: string): string | null {
    if (!value.trim()) return 'El mensaje no puede estar vacío';
    if (value.length > MAX_LENGTHS.chatMessage) return `Máximo ${MAX_LENGTHS.chatMessage} caracteres`;
    return null;
}
