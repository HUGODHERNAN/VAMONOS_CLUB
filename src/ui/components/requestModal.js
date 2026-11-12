import { TIMERS } from '../../config/constants.js';

export function setupRequestModal({ onCancel, onSimulateAccept, isCloudMode = false }) {
    const modal = document.getElementById('request-pending-modal');
    const cancelBtn = document.getElementById('cancel-pending-req-btn');
    const simAcceptBtn = document.getElementById('simulate-accept-req-btn');
    const actionsGrid = document.getElementById('request-pending-actions');

    if (isCloudMode && simAcceptBtn) {
        simAcceptBtn.classList.add('hidden');
        if (actionsGrid) {
            actionsGrid.className = 'grid grid-cols-1 gap-2 pt-1';
        }
    }

    cancelBtn?.addEventListener('click', () => onCancel(false));
    simAcceptBtn?.addEventListener('click', onSimulateAccept);

    return {
        open({ partner, userName, userUni, destDistrict }) {
            const avatarEl = document.getElementById('req-partner-avatar');
            const nameEl = document.getElementById('req-partner-name');
            const uniEl = document.getElementById('req-partner-uni');
            const previewEl = document.getElementById('req-push-preview');

            if (avatarEl) avatarEl.src = partner.avatar;
            if (nameEl) nameEl.textContent = partner.name.toUpperCase();
            if (uniEl) uniEl.textContent = `🎓 ESTUDIANTE VERIFICADO ${partner.uni}`;
            if (previewEl) {
                previewEl.textContent = `"${userName} (🎓 ${userUni}) quiere compartir taxi contigo hacia ${destDistrict}. Toca para aceptar."`;
            }

            this.updateCountdown(TIMERS.REQUEST_TIMEOUT_SECONDS);
            modal?.classList.remove('hidden');
        },
        updateCountdown(secondsRemaining) {
            const safe = Math.max(0, secondsRemaining);
            const badge = document.getElementById('request-countdown-badge');
            const progress = document.getElementById('req-progress-bar');

            if (badge) badge.textContent = `${safe}s`;
            if (progress) {
                const pct = (safe / TIMERS.REQUEST_TIMEOUT_SECONDS) * 100;
                progress.style.width = `${pct}%`;
            }
        },
        close() {
            modal?.classList.add('hidden');
        }
    };
}
