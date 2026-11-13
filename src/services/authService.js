import { isSupabaseConfigured } from '../config/supabaseConfig.js';
import { detectUniFromEmail, validateLogin, validateRegistration } from '../domain/auth.js';
import { getSupabaseClient } from './supabaseClient.js';
import { storageService } from './storageService.js';

function mapProfileRowToState(row, fallbackEmail = '') {
    return {
        userId: row.id,
        userName: row.short_name,
        userGender: row.gender,
        userEmail: row.email || fallbackEmail,
        userPhone: row.phone || '',
        userUni: row.uni_verified ? row.uni_code : 'AQP',
        uniVerified: Boolean(row.uni_verified),
        userStats: {
            rating: Number(row.rating_avg ?? 5.0),
            punctuality: Number(row.punctuality_pct ?? 100),
            trips: Number(row.trips_count ?? 0)
        },
        pendingSurveyTripId: row.pending_survey_trip_id || null
    };
}

function getAppRedirectUrl() {
    if (typeof window === 'undefined') return undefined;
    return `${window.location.origin}${window.location.pathname}`;
}

function mapSupabaseAuthError(message) {
    const raw = (message || '').trim();
    const lower = raw.toLowerCase();

    if (lower.includes('email not confirmed')) {
        return 'PRIMERO CONFIRMA TU CORREO CON EL ENLACE QUE TE ENVIAMOS';
    }
    if (lower.includes('invalid login credentials')) {
        return 'CORREO O CONTRASEÑA INCORRECTOS (SI ERES NUEVO, REGÍSTRATE)';
    }
    if (lower.includes('user already registered')) {
        return 'ESTE CORREO YA ESTÁ REGISTRADO. INICIA SESIÓN EN LOGIN';
    }
    if (lower.includes('rate limit') || lower.includes('too many requests')) {
        return 'MUCHOS INTENTOS SEGUIDOS. ESPERA UNOS MINUTOS ANTES DE REINTENTAR';
    }
    return raw.toUpperCase() || 'NO SE PUDO COMPLETAR LA AUTENTICACIÓN';
}

export const authService = {
    isCloudEnabled() {
        return isSupabaseConfigured();
    },

    /**
     * Restores either a Supabase authenticated profile or local demo session.
     */
    async restoreSession() {
        if (isSupabaseConfigured()) {
            const supabase = await getSupabaseClient();
            if (supabase) {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    let profile = null;
                    for (let attempt = 0; attempt < 4; attempt++) {
                        const { data } = await supabase
                            .from('profiles')
                            .select('*')
                            .eq('id', session.user.id)
                            .maybeSingle();
                        if (data) {
                            profile = data;
                            break;
                        }
                        await new Promise(r => setTimeout(r, 150));
                    }

                    if (profile) {
                        return { mode: 'cloud', profile: mapProfileRowToState(profile, session.user.email) };
                    }

                    const detectedUni = detectUniFromEmail(session.user.email);
                    const fallbackName = session.user.user_metadata?.full_name ||
                        session.user.user_metadata?.name ||
                        session.user.user_metadata?.short_name ||
                        (session.user.email ? session.user.email.split('@')[0] : 'Pasajero');
                    return {
                        mode: 'cloud',
                        profile: {
                            userId: session.user.id,
                            userName: fallbackName,
                            userGender: 'M',
                            userEmail: session.user.email || '',
                            userPhone: '',
                            userUni: detectedUni || 'AQP',
                            uniVerified: Boolean(detectedUni),
                            userStats: { rating: 5.0, punctuality: 100, trips: 0 },
                            pendingSurveyTripId: null
                        }
                    };
                }
                return { mode: 'cloud', profile: null };
            }
        }

        const savedSession = storageService.getUserSession();
        const savedStats = storageService.getUserStats();
        if (savedSession?.userName) {
            return {
                mode: 'demo',
                profile: {
                    userId: 'demo-local-user',
                    userName: savedSession.userName,
                    userUni: savedSession.userUni || 'AQP',
                    userEmail: savedSession.userEmail || '',
                    userPhone: savedSession.userPhone || '',
                    userGender: savedSession.userGender || 'M',
                    uniVerified: Boolean(savedSession.userUni && savedSession.userUni !== 'AQP'),
                    userStats: savedStats,
                    pendingSurveyTripId: null
                }
            };
        }
        return { mode: 'demo', profile: null };
    },

    /**
     * Signs in an existing user with email + password, or registers a new user
     * requiring an email confirmation link in Supabase Cloud mode.
     */
    async startAuth({ authMode, loginEmail, loginPassword, regName, regGender, regPhone, regEmail, regPassword }) {
        const isRegister = authMode === 'register';

        if (!isSupabaseConfigured()) {
            if (!isRegister) {
                const validated = validateLogin({ email: loginEmail, password: loginPassword });
                if (!validated.ok) return { ok: false, error: validated.error };

                const existing = storageService.getUserSession();
                const profile = {
                    userId: 'demo-local-user',
                    userName: existing?.userEmail === validated.email ? existing.userName : validated.userName,
                    userEmail: validated.email,
                    userPhone: existing?.userEmail === validated.email ? (existing.userPhone || '') : '',
                    userUni: validated.userUni,
                    uniVerified: validated.userUni !== 'AQP',
                    userGender: existing?.userEmail === validated.email ? (existing.userGender || 'M') : 'M'
                };
                storageService.saveUserSession(profile);
                return { ok: true, requiresEmailConfirmation: false, profile };
            }

            const validated = validateRegistration({
                name: regName,
                gender: regGender,
                phone: regPhone,
                email: regEmail,
                password: regPassword
            });
            if (!validated.ok) return { ok: false, error: validated.error };

            const profile = {
                userId: 'demo-local-user',
                userName: validated.userName,
                userGender: validated.userGender,
                userPhone: validated.userPhone,
                userEmail: validated.userEmail,
                userUni: validated.userUni,
                uniVerified: validated.userUni !== 'AQP'
            };
            storageService.saveUserSession(profile);
            return { ok: true, requiresEmailConfirmation: false, profile };
        }

        const supabase = await getSupabaseClient();
        if (!supabase) {
            return { ok: false, error: 'NO SE PUDO CONECTAR CON SUPABASE' };
        }

        if (!isRegister) {
            const validated = validateLogin({ email: loginEmail, password: loginPassword });
            if (!validated.ok) return { ok: false, error: validated.error };

            const { data, error } = await supabase.auth.signInWithPassword({
                email: validated.email,
                password: validated.password
            });

            if (error || !data?.user) {
                return { ok: false, error: mapSupabaseAuthError(error?.message) };
            }

            const { data: profileRow } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', data.user.id)
                .single();

            if (!profileRow) {
                return { ok: false, error: 'PERFIL NO ENCONTRADO EN BASE DE DATOS' };
            }

            return {
                ok: true,
                requiresEmailConfirmation: false,
                profile: mapProfileRowToState(profileRow, data.user.email)
            };
        }

        const validated = validateRegistration({
            name: regName,
            gender: regGender,
            phone: regPhone,
            email: regEmail,
            password: regPassword
        });
        if (!validated.ok) return { ok: false, error: validated.error };

        const redirectTo = getAppRedirectUrl();
        const { data, error } = await supabase.auth.signUp({
            email: validated.userEmail,
            password: validated.password,
            options: {
                ...(redirectTo ? { emailRedirectTo: redirectTo } : {}),
                data: {
                    short_name: validated.userName,
                    gender: validated.userGender,
                    phone: validated.userPhone
                }
            }
        });

        if (error) {
            return { ok: false, error: mapSupabaseAuthError(error.message) };
        }

        if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
            return { ok: false, error: 'ESTE CORREO YA ESTÁ REGISTRADO. INICIA SESIÓN EN LOGIN' };
        }

        if (data?.session && data?.user) {
            const { data: profileRow } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', data.user.id)
                .single();

            if (profileRow) {
                return {
                    ok: true,
                    requiresEmailConfirmation: false,
                    profile: mapProfileRowToState(profileRow, data.user.email)
                };
            }
        }

        return { ok: true, requiresEmailConfirmation: true, email: validated.userEmail };
    },

    /**
     * Signs in or registers directly using Google OAuth / Google Workspace.
     */
    async signInWithGoogle() {
        if (!isSupabaseConfigured()) {
            return { ok: false, error: 'INICIA SESIÓN CON GOOGLE REQUIERE SUPABASE CONECTADO' };
        }
        const supabase = await getSupabaseClient();
        if (!supabase) return { ok: false, error: 'NO SE PUDO CONECTAR CON SUPABASE' };

        const redirectTo = getAppRedirectUrl() || (typeof window !== 'undefined' ? window.location.origin : undefined);
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'select_account'
                }
            }
        });

        if (error) {
            return { ok: false, error: mapSupabaseAuthError(error.message) };
        }

        if (data?.url && typeof window !== 'undefined') {
            window.location.href = data.url;
        }
        return { ok: true, data };
    },

    /**
     * Sends a password reset link to the user's email.
     */
    async sendPasswordReset(email) {
        const cleanEmail = (email || '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            return { ok: false, error: 'ESCRIBE TU CORREO EN LOGIN PARA ENVIARTE EL ENLACE' };
        }

        if (!isSupabaseConfigured()) {
            return { ok: false, error: 'RECUPERACIÓN DISPONIBLE SOLO CON SUPABASE CONECTADO' };
        }

        const supabase = await getSupabaseClient();
        if (!supabase) return { ok: false, error: 'ERROR DE CONEXIÓN SUPABASE' };

        const redirectTo = getAppRedirectUrl();
        const { error } = await supabase.auth.resetPasswordForEmail(
            cleanEmail,
            redirectTo ? { redirectTo } : undefined
        );
        if (error) {
            return { ok: false, error: mapSupabaseAuthError(error.message) };
        }

        return {
            ok: true,
            message: `📩 REVISA ${cleanEmail.toUpperCase()} PARA RESTABLECER TU CONTRASEÑA`
        };
    },

    /**
     * Updates the current user's password after following a PASSWORD_RECOVERY link.
     */
    async updatePassword(newPassword) {
        if ((newPassword || '').length < 6) {
            return { ok: false, error: 'LA NUEVA CONTRASEÑA DEBE TENER MÍNIMO 6 CARACTERES' };
        }

        const supabase = await getSupabaseClient();
        if (!supabase) return { ok: false, error: 'SUPABASE NO CONFIGURADO' };

        const { data, error } = await supabase.auth.updateUser({ password: newPassword });
        if (error || !data?.user) {
            return { ok: false, error: mapSupabaseAuthError(error?.message) };
        }

        const { data: profileRow } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

        return {
            ok: true,
            profile: profileRow ? mapProfileRowToState(profileRow, data.user.email) : null
        };
    },

    /**
     * Links or updates an institutional email address.
     */
    async linkInstitutionalEmail(email, currentSession) {
        const detected = detectUniFromEmail(email);
        if (!detected) {
            return { ok: false, error: 'USA UN CORREO INSTITUCIONAL (UTP, UNSA, UCSM, UCSP, SENATI, TECSUP, USMP...)' };
        }

        if (!isSupabaseConfigured()) {
            const updated = { ...currentSession, userEmail: email, userUni: detected, uniVerified: true };
            storageService.saveUserSession(updated);
            return { ok: true, requiresEmailConfirmation: false, userEmail: email, userUni: detected };
        }

        const supabase = await getSupabaseClient();
        if (!supabase) return { ok: false, error: 'ERROR DE CONEXIÓN SUPABASE' };

        const redirectTo = getAppRedirectUrl();
        const { error } = await supabase.auth.updateUser(
            { email: email.trim().toLowerCase() },
            redirectTo ? { emailRedirectTo: redirectTo } : undefined
        );
        if (error) {
            return { ok: false, error: mapSupabaseAuthError(error.message) };
        }
        return {
            ok: true,
            requiresEmailConfirmation: true,
            message: `REVISA ${email.toUpperCase()} Y CONFIRMA EL ENLACE PARA TU INSIGNIA ${detected}`
        };
    },

    /**
     * Listens for cross-tab, email confirmation, or password recovery auth events.
     * @param {(payload: { event: string, profile: any|null }) => void} onAuthChange
     * @returns {Promise<() => void>}
     */
    async subscribeToAuthChanges(onAuthChange) {
        if (!isSupabaseConfigured()) return () => {};
        const supabase = await getSupabaseClient();
        if (!supabase) return () => {};

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_OUT') {
                onAuthChange({ event, profile: null });
                return;
            }
            if (event === 'PASSWORD_RECOVERY') {
                onAuthChange({ event, profile: null });
                return;
            }
            if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .single();
                if (profile) {
                    onAuthChange({
                        event,
                        profile: mapProfileRowToState(profile, session.user.email)
                    });
                }
            }
        });

        return () => subscription?.unsubscribe();
    },

    async signOut() {
        storageService.clearUserSession();
        if (isSupabaseConfigured()) {
            const supabase = await getSupabaseClient();
            if (supabase) await supabase.auth.signOut();
        }
    }
};
