import { AREQUIPA_CENTER, TIMERS } from '../config/constants.js';

class MapService {
    constructor() {
        this.map = null;
        this.originCircle = null;
        this.originMarker = null;
        this.destMarker = null;
        this.routeLine = null;
        this.gpsDot = null;
        this.clickHandler = null;
        this.originDragHandler = null;
        this.destDragHandler = null;
    }

    init(containerId = 'map-screen-1') {
        const container = document.getElementById(containerId);
        if (!container || typeof window.L === 'undefined') return false;

        if (!this.map) {
            this.map = window.L.map(containerId, {
                zoomControl: false,
                attributionControl: true
            }).setView(AREQUIPA_CENTER, 13);

            window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 18,
                attribution: '© OSM Arequipa'
            }).addTo(this.map);

            this.map.on('click', (event) => {
                if (this.clickHandler) {
                    this.clickHandler([event.latlng.lat, event.latlng.lng]);
                }
            });
        }
        return true;
    }

    onMapClick(handler) {
        this.clickHandler = handler;
    }

    onPinsDragged({ onOriginDragEnd, onDestDragEnd }) {
        this.originDragHandler = onOriginDragEnd;
        this.destDragHandler = onDestDragEnd;
    }

    setPickCursor(active) {
        const el = this.map?.getContainer?.();
        if (!el) return;
        el.style.cursor = active ? 'crosshair' : '';
    }

    invalidateSize() {
        if (!this.map) return;
        setTimeout(() => this.map?.invalidateSize(), 60);
    }

    renderRoute({ originCoords, destCoords, gpsCoords = null, routeCoords = null, isStreetRoute = false }) {
        if (!this.map || typeof window.L === 'undefined') return;

        if (this.originCircle) this.map.removeLayer(this.originCircle);
        if (this.originMarker) this.map.removeLayer(this.originMarker);
        if (this.destMarker) this.map.removeLayer(this.destMarker);
        if (this.routeLine) this.map.removeLayer(this.routeLine);
        if (this.gpsDot) this.map.removeLayer(this.gpsDot);

        const activeOrigin = gpsCoords || originCoords;

        // Radio de privacidad de 250 m alrededor del origen
        this.originCircle = window.L.circle(activeOrigin, {
            color: '#FA4A19',
            weight: 3,
            fillColor: '#FA4A19',
            fillOpacity: 0.22,
            radius: TIMERS.PRIVACY_RADIUS_METERS
        }).addTo(this.map);

        if (gpsCoords) {
            this.gpsDot = window.L.circleMarker(gpsCoords, {
                radius: 5,
                color: '#FFFFFF',
                weight: 2,
                fillColor: '#063120',
                fillOpacity: 1
            }).addTo(this.map);
        }

        const originIcon = window.L.divIcon({
            className: 'custom-origin-pin',
            html: '<div style="background:#FA4A19;color:#FFFFFF;border:2px solid #063120;width:22px;height:22px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:11px;box-shadow:2px 2px 0 #063120;cursor:grab;">A</div>',
            iconSize: [22, 22],
            iconAnchor: [11, 11]
        });

        this.originMarker = window.L.marker(activeOrigin, {
            icon: originIcon,
            draggable: true
        }).addTo(this.map);

        this.originMarker.on('dragend', () => {
            const pos = this.originMarker.getLatLng();
            if (this.originDragHandler) {
                this.originDragHandler([pos.lat, pos.lng]);
            }
        });

        const destIcon = window.L.divIcon({
            className: 'custom-dest-pin',
            html: '<div style="background:#063120;color:#E7DEC8;border:2px solid #FA4A19;width:22px;height:22px;border-radius:4px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:11px;box-shadow:2px 2px 0 #063120;cursor:grab;">B</div>',
            iconSize: [22, 22],
            iconAnchor: [11, 11]
        });

        this.destMarker = window.L.marker(destCoords, {
            icon: destIcon,
            draggable: true
        }).addTo(this.map);

        this.destMarker.on('dragend', () => {
            const pos = this.destMarker.getLatLng();
            if (this.destDragHandler) {
                this.destDragHandler([pos.lat, pos.lng]);
            }
        });

        const polylinePoints = Array.isArray(routeCoords) && routeCoords.length >= 2
            ? routeCoords
            : [activeOrigin, destCoords];

        this.routeLine = window.L.polyline(polylinePoints, {
            color: '#063120',
            weight: isStreetRoute ? 5 : 4,
            opacity: isStreetRoute ? 0.92 : 0.75,
            dashArray: isStreetRoute ? null : '8, 8'
        }).addTo(this.map);

        const bounds = this.routeLine.getBounds();
        this.map.fitBounds(bounds, { padding: [38, 38] });
    }
}

export const mapService = new MapService();
