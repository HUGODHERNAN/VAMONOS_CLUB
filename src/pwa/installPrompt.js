/**
 * Registers the PWA Service Worker and wires the install banner/modal flow.
 */
export function setupPwaInstall({ showToast }) {
    let deferredPrompt = null;
    const installBtn = document.getElementById('btn-install-pwa');
    const modal = document.getElementById('pwa-install-modal');

    const isSecureOrigin =
        window.location.protocol === 'https:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1';

    if ('serviceWorker' in navigator && isSecureOrigin) {
        navigator.serviceWorker.register('./sw.js').catch(() => {
            // Service worker registration failed silently in unsupported contexts
        });
    }

    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferredPrompt = event;
        if (installBtn) {
            installBtn.classList.remove('hidden');
            installBtn.classList.add('inline-flex');
        }
    });

    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        if (installBtn) {
            installBtn.classList.add('hidden');
            installBtn.classList.remove('inline-flex');
        }
        showToast('¡VÁMONOS CLUB INSTALADO COMO APP!');
    });

    installBtn?.addEventListener('click', async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                deferredPrompt = null;
            }
            return;
        }
        if (modal) {
            modal.classList.remove('hidden');
        }
    });

    modal?.addEventListener('click', (event) => {
        if (event.target === modal || event.target.closest('[data-action="close-pwa-modal"]')) {
            modal.classList.add('hidden');
        }
    });
}

