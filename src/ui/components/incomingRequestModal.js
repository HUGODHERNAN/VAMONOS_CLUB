export function setupIncomingRequestModal({ onAccept, onReject }) {
    const modal = document.getElementById('incoming-request-modal');
    const acceptBtn = document.getElementById('accept-incoming-req-btn');
    const rejectBtn = document.getElementById('reject-incoming-req-btn');

    acceptBtn?.addEventListener('click', onAccept);
    rejectBtn?.addEventListener('click', onReject);

    return {
        open(details) {
            const avatarEl = document.getElementById('inc-partner-avatar');
            const nameEl = document.getElementById('inc-partner-name');
            const uniEl = document.getElementById('inc-partner-uni');
            const statsEl = document.getElementById('inc-partner-stats');
            const routeEl = document.getElementById('inc-route-summary');

            if (avatarEl) avatarEl.src = details.avatar || '';
            if (nameEl) nameEl.textContent = (details.requesterName || 'Pasajero').toUpperCase();
            if (uniEl) uniEl.textContent = `🎓 ESTUDIANTE VERIFICADO ${details.requesterUni || 'AQP'}`;
            if (statsEl) statsEl.textContent = `⭐ ${details.requesterRating || '5.0'} • ${details.requesterPunctuality || '100%'} PUNTUAL`;
            if (routeEl) routeEl.textContent = `${details.originName} → ${details.destName}`;

            this.updateCountdown(60);
            modal?.classList.remove('hidden');
        },
        updateCountdown(seconds) {
            const badge = document.getElementById('incoming-countdown-badge');
            if (badge) badge.textContent = `${Math.max(0, seconds)}s`;
        },
        close() {
            modal?.classList.add('hidden');
        }
    };
}

