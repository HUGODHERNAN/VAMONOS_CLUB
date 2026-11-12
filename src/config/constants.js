export const UNIVERSITY_DOMAINS = Object.freeze({
    '@utp.edu.pe': 'UTP',
    '@unsa.edu.pe': 'UNSA',
    '@ucsm.edu.pe': 'UCSM',
    '@ucsp.edu.pe': 'UCSP',
    '@ulasalle.edu.pe': 'ULASALLE',
    '@senati.pe': 'SENATI',
    '@tecsup.edu.pe': 'TECSUP',
    '@usmp.pe': 'USMP'
});

export const STORAGE_KEYS = Object.freeze({
    USER_SESSION: 'vamonos_user_session_v1',
    PENDING_SURVEY: 'vamonos_pending_survey_v1',
    USER_STATS: 'vamonos_user_stats_v1',
    TRIP_REVIEWS: 'vamonos_trip_reviews_v1'
});

export const TIMERS = Object.freeze({
    REQUEST_TIMEOUT_SECONDS: 60,
    REQUEST_DEMO_AUTO_ACCEPT_MS: 3500,
    CHAT_TTL_SECONDS: 900, // 15 minutos
    NOSHOW_LOCK_REMAINING_THRESHOLD: 600, // Se habilita cuando quedan <= 600s (tras 5 min)
    PRIVACY_RADIUS_METERS: 250,
    TOAST_DURATION_MS: 3400
});

export const AREQUIPA_CENTER = Object.freeze([-16.4040, -71.5375]);

export const DEFAULT_USER_STATS = Object.freeze({
    rating: 5.0,
    punctuality: 100,
    trips: 0
});

