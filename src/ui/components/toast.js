import { TIMERS } from '../../config/constants.js';

let toastTimeout = null;

/**
 * Displays a non-blocking retro toast notification.
 * @param {string} message
 */
export function showToast(message) {
    const banner = document.getElementById('toast-banner');
    const msgEl = document.getElementById('toast-message');
    if (!banner || !msgEl) return;

    msgEl.textContent = message;
    banner.classList.remove('hidden');

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        banner.classList.add('hidden');
    }, TIMERS.TOAST_DURATION_MS);
}

