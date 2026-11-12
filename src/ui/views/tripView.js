import { buildEmergencySosMessage, buildWhatsAppSafetyMessage, buildWhatsAppShareUrl } from '../../domain/whatsapp.js';
import { copyToClipboard } from '../utils/dom.js';

export function setupTripView({ showToast, onFinishTrip }) {
    const copyBtn = document.getElementById('copy-wa-btn');
    const waBtn = document.getElementById('share-wa-btn');
    const finishBtn = document.getElementById('finish-trip-btn');
    const waPreview = document.getElementById('whatsapp-preview-text');
    const rideLinkInput = document.getElementById('trip-ride-link-input');
    const attachGpsBtn = document.getElementById('attach-trip-gps-btn');
    const sosBtn = document.getElementById('sos-safety-btn');
    const sosModal = document.getElementById('sos-modal');
    const closeSosBtn = document.getElementById('close-sos-modal-btn');
    const sosShareWaBtn = document.getElementById('sos-share-wa-btn');

    let currentTripContext = null;
    let gpsLocationUrl = '';

    function refreshWaPreview() {
        if (!waPreview || !currentTripContext) return;
        waPreview.textContent = buildWhatsAppSafetyMessage({
            ...currentTripContext,
            rideShareLink: rideLinkInput?.value || '',
            gpsLocationUrl
        });
    }

    rideLinkInput?.addEventListener('input', refreshWaPreview);

    attachGpsBtn?.addEventListener('click', () => {
        if (!navigator.geolocation) {
            showToast('GPS NO DISPONIBLE EN ESTE NAVEGADOR');
            return;
        }
        attachGpsBtn.disabled = true;
        showToast('📡 ADJUNTANDO TU UBICACIÓN ACTUAL...');
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                attachGpsBtn.disabled = false;
                const lat = pos.coords.latitude.toFixed(6);
                const lng = pos.coords.longitude.toFixed(6);
                gpsLocationUrl = `https://maps.google.com/?q=${lat},${lng}`;
                refreshWaPreview();
                showToast('📍 UBICACIÓN GPS ADJUNTADA AL REPORTE');
            },
            () => {
                attachGpsBtn.disabled = false;
                showToast('NO SE PUDO OBTENER TU UBICACIÓN GPS');
            },
            { enableHighAccuracy: true, timeout: 7000 }
        );
    });

    copyBtn?.addEventListener('click', async () => {
        const text = waPreview?.textContent || '';
        const ok = await copyToClipboard(text);
        showToast(ok ? 'DATOS COPIADOS AL PORTAPAPELES' : 'NO SE PUDO COPIAR EL TEXTO');
    });

    waBtn?.addEventListener('click', () => {
        const url = buildWhatsAppShareUrl(waPreview?.textContent || '');
        window.open(url, '_blank', 'noopener,noreferrer');
    });

    sosBtn?.addEventListener('click', () => {
        sosModal?.classList.remove('hidden');
    });

    closeSosBtn?.addEventListener('click', () => {
        sosModal?.classList.add('hidden');
    });

    sosModal?.addEventListener('click', (event) => {
        if (event.target === sosModal) {
            sosModal.classList.add('hidden');
        }
    });

    sosShareWaBtn?.addEventListener('click', () => {
        if (!currentTripContext) return;
        const text = buildEmergencySosMessage({
            ...currentTripContext,
            gpsLocationUrl
        });
        window.open(buildWhatsAppShareUrl(text), '_blank', 'noopener,noreferrer');
    });

    finishBtn?.addEventListener('click', onFinishTrip);

    return {
        render({ userName, partner, originName, destName }) {
            currentTripContext = { userName, partner, originName, destName };
            gpsLocationUrl = '';
            if (rideLinkInput) rideLinkInput.value = '';

            const summaryEl = document.getElementById('trip-route-summary');
            const pointAEl = document.getElementById('trip-point-a');
            const pointBEl = document.getElementById('trip-point-b');
            const avatarEl = document.getElementById('trip-partner-avatar');
            const nameEl = document.getElementById('trip-partner-name');
            const uniEl = document.getElementById('trip-partner-uni');
            const statsEl = document.getElementById('trip-partner-stats');

            if (summaryEl) summaryEl.textContent = `${originName} → ${destName}`;
            if (pointAEl) pointAEl.textContent = originName;
            if (pointBEl) pointBEl.textContent = destName;
            if (avatarEl) avatarEl.src = partner.avatar;
            if (nameEl) nameEl.textContent = partner.name.toUpperCase();
            if (uniEl) uniEl.textContent = `🎓 ESTUDIANTE VERIFICADO ${partner.uni}`;
            if (statsEl) statsEl.textContent = `⭐ ${partner.rating} • ${partner.trips} VIAJES • ${partner.punctuality} PUNTUAL`;

            refreshWaPreview();
        }
    };
}
