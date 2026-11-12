import { UNIVERSITY_DOMAINS } from '../config/constants.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PERU_MOBILE_REGEX = /^9\d{8}$/;

/**
 * Detects an Arequipa university code from an email address.
 * @param {string} email
 * @returns {string|null}
 */
export function detectUniFromEmail(email) {
    const lower = (email || '').trim().toLowerCase();
    for (const [domain, uniCode] of Object.entries(UNIVERSITY_DOMAINS)) {
        if (lower.endsWith(domain)) {
            return uniCode;
        }
    }
    return null;
}

/**
 * Generates up to 2 uppercase initials from a display name.
 * @param {string} name
 * @returns {string}
 */
export function getInitials(name) {
    const parts = (name || 'HH').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'HH';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Normalizes and validates a Peruvian WhatsApp/mobile phone number (9 digits starting with 9).
 * @param {string} rawPhone
 * @returns {{ ok: boolean, phone?: string, error?: string }}
 */
export function normalizePeruPhone(rawPhone) {
    let digits = (rawPhone || '').replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('519')) {
        digits = digits.slice(2);
    }

    if (!PERU_MOBILE_REGEX.test(digits)) {
        return {
            ok: false,
            error: 'INGRESA UN CELULAR / WHATSAPP VÁLIDO DE 9 DÍGITOS (EJ. 987654321)'
        };
    }

    return { ok: true, phone: digits };
}

/**
 * Validates email + password credentials for login.
 * @param {{ email: string, password: string }} fields
 * @returns {{ ok: boolean, error?: string, email?: string, password?: string, userName?: string, userUni?: string }}
 */
export function validateLogin({ email, password }) {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!EMAIL_REGEX.test(cleanEmail)) {
        return { ok: false, error: 'INGRESA UN CORREO ELECTRÓNICO VÁLIDO' };
    }

    const rawPassword = password || '';
    if (!rawPassword) {
        return { ok: false, error: 'INGRESA TU CONTRASEÑA PARA ENTRAR' };
    }

    const detected = detectUniFromEmail(cleanEmail);
    const localPart = cleanEmail.split('@')[0] || 'Usuario';
    const userName = localPart.charAt(0).toUpperCase() + localPart.slice(1);

    return {
        ok: true,
        email: cleanEmail,
        password: rawPassword,
        userName,
        userUni: detected || 'AQP'
    };
}

/**
 * Validates full registration form fields (short name, explicit gender, private phone, email, password).
 * @param {{ name: string, gender: string, phone: string, email: string, password: string }} fields
 * @returns {{ ok: boolean, error?: string, userName?: string, userGender?: string, userPhone?: string, userEmail?: string, userUni?: string, password?: string }}
 */
export function validateRegistration({ name, gender, phone, email, password }) {
    const cleanName = (name || '').trim();
    if (cleanName.length < 2) {
        return { ok: false, error: 'INGRESA TU NOMBRE CORTO (MÍN. 2 LETRAS)' };
    }

    if (gender !== 'M' && gender !== 'F') {
        return { ok: false, error: 'ELIGE TU GÉNERO PARA CONTINUAR' };
    }

    const phoneResult = normalizePeruPhone(phone);
    if (!phoneResult.ok) {
        return { ok: false, error: phoneResult.error };
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    if (!EMAIL_REGEX.test(cleanEmail)) {
        return { ok: false, error: 'INGRESA UN CORREO VÁLIDO PARA VERIFICAR TU CUENTA' };
    }

    const rawPassword = password || '';
    if (rawPassword.length < 6) {
        return { ok: false, error: 'LA CONTRASEÑA DEBE TENER AL MENOS 6 CARACTERES' };
    }

    const detected = detectUniFromEmail(cleanEmail);

    return {
        ok: true,
        userName: cleanName,
        userGender: gender,
        userPhone: phoneResult.phone,
        userEmail: cleanEmail,
        userUni: detected || 'AQP',
        password: rawPassword
    };
}

/**
 * Only female-registered passengers may activate the women-only safety filter.
 * @param {string} gender
 * @returns {boolean}
 */
export function canUseWomenOnlyFilter(gender) {
    return gender === 'F';
}
