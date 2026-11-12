import { detectUniFromEmail, getInitials } from '../../domain/auth.js';

export function setupProfileModal({ onVerifyUni, onLogout, canOpen }) {
    const modal = document.getElementById('profile-modal');
    const closeBtn = document.getElementById('close-profile-modal-btn');
    const verifyBtn = document.getElementById('verify-uni-btn');
    const logoutBtn = document.getElementById('logout-profile-btn');
    const emailInput = document.getElementById('demo-uni-email');

    function close() {
        modal?.classList.add('hidden');
    }

    modal?.addEventListener('click', (event) => {
        if (event.target === modal) close();
    });
    closeBtn?.addEventListener('click', close);

    verifyBtn?.addEventListener('click', () => {
        const email = (emailInput?.value || '').trim();
        const detected = detectUniFromEmail(email);
        const ok = onVerifyUni(email, detected);
        if (ok && emailInput) emailInput.value = '';
    });

    logoutBtn?.addEventListener('click', () => {
        onLogout(close);
    });

    return {
        open(state) {
            if (canOpen && !canOpen()) return;
            this.sync(state);
            modal?.classList.remove('hidden');
        },
        close,
        sync(state) {
            const initials = getInitials(state.userName);
            const isUni = state.userUni && state.userUni !== 'AQP';

            const modalInit = document.getElementById('modal-avatar-initials');
            const modalName = document.getElementById('modal-user-name');
            const modalBadge = document.getElementById('modal-user-badge');
            const modalGender = document.getElementById('modal-user-gender');
            const modalEmail = document.getElementById('modal-user-email');
            const modalPhone = document.getElementById('modal-user-phone');
            const statRating = document.getElementById('modal-stat-rating');
            const statPunctuality = document.getElementById('modal-stat-punctuality');
            const statTrips = document.getElementById('modal-stat-trips');

            if (modalInit) modalInit.textContent = initials;
            if (modalName) modalName.textContent = (state.userName || 'Usuario').toUpperCase();
            if (modalBadge) {
                modalBadge.textContent = isUni
                    ? `🎓 ESTUDIANTE VERIFICADO • ${state.userUni}`
                    : '✅ PASAJERO VERIFICADO • AQP';
            }
            if (modalGender) {
                modalGender.textContent = state.userGender === 'F' ? 'FEMENINO (♀ ACTIVO)' : 'MASCULINO';
            }
            if (modalEmail) {
                modalEmail.textContent = state.userEmail || 'NO VINCULADO';
            }
            if (modalPhone) {
                modalPhone.textContent = state.userPhone || 'NO REGISTRADO';
            }
            if (statRating) {
                statRating.textContent = `⭐ ${Number(state.userStats?.rating ?? 5.0).toFixed(1)}`;
            }
            if (statPunctuality) {
                statPunctuality.textContent = `${state.userStats?.punctuality ?? 100}%`;
            }
            if (statTrips) {
                statTrips.textContent = String(state.userStats?.trips ?? 0);
            }
        }
    };
}

