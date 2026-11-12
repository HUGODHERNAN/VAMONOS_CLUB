import { SUPABASE_CONFIG, isSupabaseConfigured } from '../config/supabaseConfig.js';

let clientPromise = null;

/**
 * Returns a singleton Supabase client loaded via ESM when configured,
 * or null when running in local demo mode.
 * @returns {Promise<any|null>}
 */
export async function getSupabaseClient() {
    if (!isSupabaseConfigured()) {
        return null;
    }

    if (!clientPromise) {
        clientPromise = import('https://esm.sh/@supabase/supabase-js@2')
            .then(({ createClient }) =>
                createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey, {
                    auth: {
                        persistSession: true,
                        autoRefreshToken: true,
                        detectSessionInUrl: true
                    }
                })
            )
            .catch(() => null);
    }

    return clientPromise;
}

