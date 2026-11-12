import { getInitials } from '../../domain/auth.js';

export function setupTopbar({ onReturnLanding, onOpenProfile }) {
    const brandBtn = document.getElementById('topbar-brand-btn');
    const profileBtn = document.getElementById('topbar-profile-btn');

    brandBtn?.addEventListener('click', onReturnLanding);
    profileBtn?.addEventListener('click', onOpenProfile);
}

export function syncTopbar(state) {
    const topbar = document.getElementById('global-topbar');
    const userControls = document.getElementById('active-user-controls');
    const headerInit = document.getElementById('header-avatar-initials');

    const inApp = state.currentScreen > 0;
    if (topbar) {
        topbar.classList.toggle('app-mode', inApp);
    }
    if (userControls) {
        userControls.classList.toggle('hidden', !inApp);
        userControls.classList.toggle('flex', inApp);
    }
    if (headerInit) {
        headerInit.textContent = getInitials(state.userName);
    }
}

