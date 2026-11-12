import { AREQUIPA_CENTER, TIMERS } from '../../config/constants.js';
import { formatDistanceLabel } from '../../domain/geo.js';
import { fetchStreetRoute } from '../../services/routingService.js';

export function setupRoutePreviewModal({ onRequestRide }) {
    const modal = document.getElementById('route-preview-modal');
    const closeTopBtn = document.getElementById('close-route-preview-btn');
    const closeFooterBtn = document.getElementById('close-route-preview-footer-btn');
    const requestBtn = document.getElementById('preview-request-ride-btn');
    const titleEl = document.getElementById('route-preview-title');
    const subtitleEl = document.getElementById('route-preview-subtitle');
    const partnerLegendEl = document.getElementById('route-preview-partner-legend');
    const statsEl = document.getElementById('route-preview-stats');

    let map = null;
    let layers = [];
    let activePartnerId = null;
    let renderSeq = 0;

    function clearLayers() {
        if (!map) return;
        for (const layer of layers) {
            map.removeLayer(layer);
        }
        layers = [];
    }

    function close() {
        renderSeq++;
        modal?.classList.add('hidden');
    }

    function ensureMap() {
        const container = document.getElementById('route-preview-map');
        if (!container || typeof window.L === 'undefined') return false;
        if (!map) {
            map = window.L.map('route-preview-map', {
                zoomControl: true,
                attributionControl: false
            }).setView(AREQUIPA_CENTER, 13);

            window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 18
            }).addTo(map);
        }
        return true;
    }

    function makeBadgeIcon(label, bgColor, borderColor, textColor = '#FFFFFF') {
        return window.L.divIcon({
            className: 'custom-preview-pin',
            html: `<div style="background:${bgColor};color:${textColor};border:2px solid ${borderColor};width:24px;height:24px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:11px;box-shadow:2px 2px 0 #063120;">${label}</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });
    }

    closeTopBtn?.addEventListener('click', close);
    closeFooterBtn?.addEventListener('click', close);
    modal?.addEventListener('click', (event) => {
        if (event.target === modal) close();
    });
    requestBtn?.addEventListener('click', () => {
        const targetId = activePartnerId;
        close();
        if (targetId) onRequestRide?.(targetId);
    });

    return {
        close,
        async open({ partner, originCoords, destCoords, myRouteCoords }) {
            if (!partner || !Array.isArray(originCoords) || !Array.isArray(destCoords)) return;
            activePartnerId = partner.id;
            const seq = ++renderSeq;

            const isSame = partner.matchType === 'same';
            if (titleEl) {
                titleEl.textContent = `${partner.name.toUpperCase()} • ${isSame ? '🟢 MISMO DESTINO' : '🔵 EN TU RUTA (DE PASO)'}`;
            }
            if (subtitleEl) {
                subtitleEl.textContent = `SALIDA A ~${partner.distanceMeters}M • ${isSame ? 'DESTINO' : 'BAJA EN'}: ${partner.stopDistrict} (${partner.stopStreet})`;
            }
            if (partnerLegendEl) {
                partnerLegendEl.textContent = `Parada de ${partner.name.split(' ')[0]}`;
            }
            if (statsEl) {
                statsEl.textContent = '🛣️ TRAZANDO...';
            }

            modal?.classList.remove('hidden');
            if (!ensureMap()) return;

            clearLayers();
            const partnerDestCoords = Array.isArray(partner.destCoords) ? partner.destCoords : destCoords;

            setTimeout(() => map?.invalidateSize(), 60);

            const circle = window.L.circle(originCoords, {
                color: '#FA4A19',
                weight: 2,
                fillColor: '#FA4A19',
                fillOpacity: 0.12,
                radius: TIMERS.PRIVACY_RADIUS_METERS
            }).addTo(map);
            layers.push(circle);

            const myPts = Array.isArray(myRouteCoords) && myRouteCoords.length >= 2
                ? myRouteCoords
                : [originCoords, destCoords];

            const myLine = window.L.polyline(myPts, {
                color: '#063120',
                weight: 5,
                opacity: 0.85
            }).addTo(map);
            layers.push(myLine);

            const pinA = window.L.marker(originCoords, {
                icon: makeBadgeIcon('A', '#063120', '#E7DEC8', '#E7DEC8')
            }).bindTooltip('Tu salida').addTo(map);
            const pinB = window.L.marker(destCoords, {
                icon: makeBadgeIcon('B', '#063120', '#FA4A19', '#FFFFFF')
            }).bindTooltip('Tu destino').addTo(map);
            layers.push(pinA, pinB);

            map.fitBounds(myLine.getBounds(), { padding: [32, 32] });

            const partnerRoute = await fetchStreetRoute(originCoords, partnerDestCoords);
            if (seq !== renderSeq || !map) return;

            const partnerLine = window.L.polyline(partnerRoute.coords, {
                color: '#FA4A19',
                weight: 4,
                opacity: 0.95,
                dashArray: partnerRoute.isStreetRoute ? '10, 6' : '6, 6'
            }).addTo(map);
            layers.push(partnerLine);

            const pinP = window.L.marker(partnerDestCoords, {
                icon: makeBadgeIcon('P', '#FA4A19', '#063120', '#FFFFFF')
            }).bindTooltip(`Bajada de ${partner.name}: ${partner.stopDistrict}`).addTo(map);
            layers.push(pinP);

            const group = window.L.featureGroup([myLine, partnerLine, pinP]);
            map.fitBounds(group.getBounds(), { padding: [36, 36] });

            if (statsEl) {
                if (partnerRoute.isStreetRoute && partnerRoute.distanceMeters !== null) {
                    statsEl.textContent = `🛣️ TRAMO ${formatDistanceLabel(partnerRoute.distanceMeters)} • ~${partnerRoute.durationMinutes} MIN`;
                } else {
                    statsEl.textContent = `📍 A ~${partner.distanceMeters}M DE TU SALIDA`;
                }
            }
        }
    };
}

