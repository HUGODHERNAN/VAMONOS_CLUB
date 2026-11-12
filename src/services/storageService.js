import { DEFAULT_USER_STATS, STORAGE_KEYS } from '../config/constants.js';

function readJson(key, fallback = null) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        return JSON.parse(raw);
    } catch {
        return fallback;
    }
}

function writeJson(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Ignore storage quota or private mode restrictions
    }
}

function removeKey(key) {
    try {
        localStorage.removeItem(key);
    } catch {
        // Ignore storage restrictions
    }
}

export const storageService = {
    getUserSession() {
        return readJson(STORAGE_KEYS.USER_SESSION, null);
    },
    saveUserSession(session) {
        writeJson(STORAGE_KEYS.USER_SESSION, session);
    },
    clearUserSession() {
        removeKey(STORAGE_KEYS.USER_SESSION);
    },
    getUserStats() {
        return readJson(STORAGE_KEYS.USER_STATS, { ...DEFAULT_USER_STATS });
    },
    saveUserStats(stats) {
        writeJson(STORAGE_KEYS.USER_STATS, stats);
    },
    getPendingSurvey() {
        return readJson(STORAGE_KEYS.PENDING_SURVEY, null);
    },
    savePendingSurvey(survey) {
        writeJson(STORAGE_KEYS.PENDING_SURVEY, survey);
    },
    clearPendingSurvey() {
        removeKey(STORAGE_KEYS.PENDING_SURVEY);
    },
    appendReview(review) {
        const current = readJson(STORAGE_KEYS.TRIP_REVIEWS, []);
        current.push({ ...review, createdAt: new Date().toISOString() });
        writeJson(STORAGE_KEYS.TRIP_REVIEWS, current);
    }
};

