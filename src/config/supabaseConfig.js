/**
 * Configuración del proyecto Supabase para Vámonos Club.
 * Cuando `url` y `anonKey` están vacíos, la app opera en Modo Demo Local.
 * En producción, reemplaza ambos valores con los de Project Settings -> API.
 */
export const SUPABASE_CONFIG = Object.freeze({
    url: 'https://idritcqreiytlavnyoff.supabase.co',
    anonKey: 'sb_publishable_VJ2Xnrk2H3LNb9SIMWAHHw_qMJmhSKo'
});

export function isSupabaseConfigured() {
    return Boolean(SUPABASE_CONFIG.url?.trim() && SUPABASE_CONFIG.anonKey?.trim());
}

