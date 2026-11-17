import { AREQUIPA_CENTER, TIMERS } from '../../config/constants.js';
import { PLACES_AQP } from '../../config/placesAqp.js';
import { formatDistanceLabel } from '../../domain/geo.js';
import { fetchStreetRoute } from '../../services/routingService.js';

function resolveCoordsByName(placeName, fallbackCoords) {
    if (!placeName) return fallbackCoords;
    const clean = placeName.trim().toUpperCase();

    for (const item of Object.values(PLACES_AQP.origins)) {
        if (item.name.toUpperCase() === clean || clean.includes(item.name.toUpperCase()) || item.name.toUpperCase().includes(clean)) {
            return item.coords;
        }
    }
    for (const item of Object.values(PLACES_AQP.destinations)) {
        if (item.name.toUpperCase() === clean || clean.includes(item.name.toUpperCase()) || item.name.toUpperCase().includes(clean)) {
            return item.coords;
        }
    }
    return fallbackCoords;
}

function makeBadgeIcon(label, bgColor, borderColor, textColor = '#FFFFFF') {
    return window.L.divIcon({
        className: 'custom-preview-pin',
        html: `<div style="background:${bgColor};color:${textColor};border:2px solid ${borderColor};width:24px;height:24px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:11px;box-shadow:2px 2px 0 #063120;">${label}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
}

export function setupIncomingRequestModal({ onAccept, onReject }) {
    const modal = document.getElementById('incoming-request-modal');
    const acceptBtn = document.getElementById('accept-incoming-req-btn');
    const rejectBtn = document.getElementById('reject-incoming-req-btn');
    const avatarEl = document.getElementById('inc-partner-avatar');
    const nameEl = document.getElementById('inc-partner-name');
    const uniEl = document.getElementById('inc-partner-uni');
    const statsEl = document.getElementById('inc-partner-stats');
    const routeEl = document.getElementById('inc-route-summary');
    const routeStatsEl = document.getElementById('inc-route-stats');

    let map = null;
    let layers = [];
    let renderSeq = 0;

    function clearLayers() {
        if (!map) return;
        for (const layer of layers) {
            map.removeLayer(layer);
        }
        layers = [];
    }

    function ensureMap() {
        const container = document.getElementById('incoming-request-map');
        if (!container || typeof window.L === 'undefined') return false;
        if (!map) {
            map = window.L.map('incoming-request-map', {
                zoomControl: false,
                attributionControl: false,
                dragging: true,
                touchZoom: true
            }).setView(AREQUIPA_CENTER, 13);

            window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 18
            }).addTo(map);
        }
        return true;
    }

    function close() {
        renderSeq++;
        clearLayers();
        modal?.classList.add('hidden');
    }

    acceptBtn?.addEventListener('click', onAccept);
    rejectBtn?.addEventListener('click', onReject);

    return {
        async open(details) {
            if (avatarEl) avatarEl.src = details.avatar || '';
            if (nameEl) nameEl.textContent = (details.requesterName || 'Pasajero').toUpperCase();
            if (uniEl) uniEl.textContent = `🎓 ESTUDIANTE VERIFICADO ${details.requesterUni || 'AQP'}`;
            if (statsEl) statsEl.textContent = `⭐ ${details.requesterRating || '5.0'} • ${details.requesterPunctuality || '100%'} PUNTUAL`;
            if (routeEl) routeEl.textContent = `${details.originName || 'PUNTO DE SALIDA'} → ${details.destName || 'DESTINO'}`;
            if (routeStatsEl) routeStatsEl.textContent = 'TRAZANDO...';

            this.updateCountdown(60);
            modal?.classList.remove('hidden');

            const originCoords = details.originCoords || resolveCoordsByName(details.originName, PLACES_AQP.origins.utp.coords);
            const destCoords = details.destCoords || resolveCoordsByName(details.destName, PLACES_AQP.destinations.cerro_colorado.coords);

            if (!ensureMap()) return;

            const seq = ++renderSeq;
            clearLayers();
            setTimeout(() => map?.invalidateSize(), 80);

            // Círculo de privacidad 1000m
            const circle = window.L.circle(originCoords, {
                color: '#FA4A19',
                weight: 2,
                fillColor: '#FA4A19',
                fillOpacity: 0.12,
                radius: TIMERS.PRIVACY_RADIUS_METERS || 1000
            }).addTo(map);
            layers.push(circle);

            // Marcadores A y B
            const pinA = window.L.marker(originCoords, {
                icon: makeBadgeIcon('A', '#063120', '#E7DEC8', '#E7DEC8')
            }).addTo(map);

            const pinB = window.L.marker(destCoords, {
                icon: makeBadgeIcon('B', '#FA4A19', '#063120', '#FFFFFF')
            }).addTo(map);
            layers.push(pinA, pinB);

            // Trazado de ruta real por calles
            const streetRoute = await fetchStreetRoute(originCoords, destCoords);
            if (seq !== renderSeq || !map) return;

            const routeLine = window.L.polyline(streetRoute.coords, {
                color: '#063120',
                weight: 4,
                opacity: 0.95
            }).addTo(map);
            layers.push(routeLine);

            const group = window.L.featureGroup([circle, pinA, pinB, routeLine]);
            map.fitBounds(group.getBounds(), { padding: [16, 16] });

            if (routeStatsEl) {
                if (streetRoute.isStreetRoute && streetRoute.distanceMeters !== null) {
                    routeStatsEl.textContent = `🛣️ ${formatDistanceLabel(streetRoute.distanceMeters)} • ~${streetRoute.durationMinutes} MIN`;
                } else {
                    routeStatsEl.textContent = '📍 RUTA ESTIMADA';
                }
            }
        },
        updateCountdown(seconds) {
            const badge = document.getElementById('incoming-countdown-badge');
            if (badge) badge.textContent = `${Math.max(0, seconds)}s`;
        },
        close
    };
}
