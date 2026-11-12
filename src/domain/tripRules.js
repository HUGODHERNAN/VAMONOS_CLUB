import { TIMERS } from '../config/constants.js';

/**
 * Formats seconds as MM:SS.
 * @param {number} totalSeconds
 * @returns {string}
 */
export function formatClock(totalSeconds) {
    const clamped = Math.max(0, Math.floor(totalSeconds));
    const mins = Math.floor(clamped / 60);
    const secs = clamped % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Evaluates whether the 5-minute tolerance has elapsed for reporting a No-Show.
 * @param {number} secondsRemaining
 * @returns {{ unlocked: boolean, lockRemainingSeconds: number, formattedLockCountdown: string }}
 */
export function getNoShowState(secondsRemaining) {
    const lockRemainingSeconds = Math.max(0, secondsRemaining - TIMERS.NOSHOW_LOCK_REMAINING_THRESHOLD);
    return {
        unlocked: lockRemainingSeconds === 0,
        lockRemainingSeconds,
        formattedLockCountdown: formatClock(lockRemainingSeconds)
    };
}

/**
 * Applies a 15-point punctuality penalty when a no-show is reported.
 * @param {string|number} currentPunctuality
 * @returns {string}
 */
export function applyNoShowPenalty(currentPunctuality) {
    const numeric = parseInt(String(currentPunctuality).replace('%', ''), 10);
    const safeBase = Number.isFinite(numeric) ? numeric : 98;
    const penalized = Math.max(0, safeBase - 15);
    return `${penalized}%`;
}

/**
 * Updates user trip statistics after finishing a trip and submitting survey.
 * @param {{ rating: number, punctuality: number, trips: number }} stats
 * @returns {{ rating: number, punctuality: number, trips: number }}
 */
export function incrementCompletedTripStats(stats) {
    const currentTrips = Number(stats?.trips) || 0;
    return {
        rating: Number(stats?.rating) || 5.0,
        punctuality: Number(stats?.punctuality) || 100,
        trips: currentTrips + 1
    };
}

