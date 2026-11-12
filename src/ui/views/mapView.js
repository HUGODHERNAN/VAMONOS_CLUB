import { PLACES_AQP } from '../../config/placesAqp.js';
import { canUseWomenOnlyFilter } from '../../domain/auth.js';
import { findNearestOriginKey, formatDistanceLabel } from '../../domain/geo.js';
import { filterLocalPlaces, reverseGeocodeAqp, searchRemotePlacesAqp } from '../../services/geocodingService.js';
import { mapService } from '../../services/mapService.js';
import { fetchStreetRoute } from '../../services/routingService.js';
import { escapeHtml } from '../utils/dom.js';

export function setupMapView({ getState, setState, showToast, onStartSearch }) {
    const originInput = document.getElementById('origin-input');
    const destInput = document.getElementById('dest-input');
    const pickOriginBtn = document.getElementById('pick-origin-map-btn');
    const pickDestBtn = document.getElementById('pick-dest-map-btn');
    const gpsBtn = document.getElementById('gps-locate-btn');
    const suggestionsBox = document.getElementById('place-suggestions-box');
    const mapPickBanner = document.getElementById('map-pick-banner');
    const mapPickText = document.getElementById('map-pick-text');
    const cancelMapPickBtn = document.getElementById('cancel-map-pick-btn');
    const womenToggle = document.getElementById('women-only-toggle');
    const womenSubtitle = document.getElementById('women-only-subtitle');
    const routeStatsBadge = document.getElementById('route-stats-badge');
    const searchBtn = document.getElementById('start-radar-btn');
    const timeBtns = document.querySelectorAll('.time-btn');
    const payBtns = document.querySelectorAll('.pay-btn');

    let routeRequestSeq = 0;
    let searchDebounce = null;
    let searchSeq = 0;
    let activeInputField = null; // 'origin' | 'dest' | null

    function closeSuggestions() {
        suggestionsBox?.classList.add('hidden');
        if (suggestionsBox) suggestionsBox.innerHTML = '';
        activeInputField = null;
    }

    function setPickTarget(target) {
        setState({ mapPickTarget: target });
        mapService.setPickCursor(Boolean(target));

        if (!target) {
            mapPickBanner?.classList.add('hidden');
            return;
        }

        if (mapPickText) {
            mapPickText.textContent = target === 'origin'
                ? '👆 TOCA EL MAPA PARA ELEGIR SALIDA (O ARRASTRA EL PIN A)'
                : '👆 TOCA EL MAPA PARA ELEGIR DESTINO (O ARRASTRA EL PIN B)';
        }
        mapPickBanner?.classList.remove('hidden');
        closeSuggestions();
    }

    function selectPlace(target, place) {
        if (target === 'origin') {
            if (originInput) originInput.value = place.name;
            setState({
                originKey: place.key || 'custom',
                originPlace: { key: place.key || 'custom', name: place.name, coords: place.coords },
                customGpsCoords: null
            });
        } else {
            if (destInput) destInput.value = place.name;
            setState({
                destKey: place.key || 'custom',
                destPlace: { key: place.key || 'custom', name: place.name, coords: place.coords }
            });
        }
        closeSuggestions();
        syncRouteOnMap();
    }

    function renderSuggestions(target, items, isSearchingRemote = false) {
        if (!suggestionsBox) return;
        const rowsHtml = items.map((item, idx) => {
            const badge = item.source === 'local' ? '⚡ NODO' : '📍 OSM';
            return `
                <button type="button" data-suggestion-idx="${idx}" class="w-full px-3 py-2 text-left hover:bg-sup-cream flex items-center justify-between gap-2 transition-colors">
                    <span class="text-[11px] font-bold uppercase text-sup-green truncate">${escapeHtml(item.name)}</span>
                    <span class="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-[2px] border border-sup-green bg-sup-cream text-sup-green shrink-0">${badge}</span>
                </button>
            `;
        }).join('');

        const footerHtml = isSearchingRemote
            ? '<div class="px-3 py-1.5 text-[10px] font-bold uppercase text-sup-orange bg-sup-cream/60">🔎 BUSCANDO CALLES EN AREQUIPA...</div>'
            : '';

        if (!rowsHtml && !footerHtml) {
            suggestionsBox.innerHTML = '<div class="px-3 py-2 text-[10px] font-bold uppercase text-sup-green/65">SIN RESULTADOS • PRUEBA TOCANDO EN EL MAPA</div>';
        } else {
            suggestionsBox.innerHTML = rowsHtml + footerHtml;
        }

        suggestionsBox._items = items;
        suggestionsBox._target = target;
        suggestionsBox.classList.remove('hidden');
    }

    function handleSearchQuery(target, query) {
        activeInputField = target;
        const group = target === 'origin' ? 'origins' : 'destinations';
        const localMatches = filterLocalPlaces(query, group);
        const cleanQuery = (query || '').trim();

        if (cleanQuery.length < 3) {
            renderSuggestions(target, localMatches, false);
            return;
        }

        renderSuggestions(target, localMatches, true);
        if (searchDebounce) clearTimeout(searchDebounce);

        const seq = ++searchSeq;
        searchDebounce = setTimeout(async () => {
            const remoteMatches = await searchRemotePlacesAqp(cleanQuery);
            if (seq !== searchSeq || activeInputField !== target) return;

            const merged = [...localMatches];
            for (const remote of remoteMatches) {
                if (!merged.some((m) => m.name === remote.name)) {
                    merged.push(remote);
                }
            }
            renderSuggestions(target, merged.slice(0, 8), false);
        }, 350);
    }

    async function applyMapCoordinate(target, coords) {
        const tempLabel = `UBICANDO PUNTO (${coords[0].toFixed(4)}, ${coords[1].toFixed(4)})`;
        selectPlace(target, { key: 'custom', name: tempLabel, coords });
        setPickTarget(null);

        const resolvedName = await reverseGeocodeAqp(coords);
        const current = getState();
        const activePlace = target === 'origin' ? current.originPlace : current.destPlace;
        if (
            activePlace &&
            Math.abs(activePlace.coords[0] - coords[0]) < 0.0001 &&
            Math.abs(activePlace.coords[1] - coords[1]) < 0.0001
        ) {
            if (target === 'origin') {
                if (originInput) originInput.value = resolvedName;
                setState({ originPlace: { key: 'custom', name: resolvedName, coords } });
            } else {
                if (destInput) destInput.value = resolvedName;
                setState({ destPlace: { key: 'custom', name: resolvedName, coords } });
            }
        }
    }

    async function syncRouteOnMap() {
        const seq = ++routeRequestSeq;
        const state = getState();
        const originData = state.originPlace || PLACES_AQP.origins[state.originKey] || PLACES_AQP.origins.utp;
        const destData = state.destPlace || PLACES_AQP.destinations[state.destKey] || PLACES_AQP.destinations.cerro_colorado;
        const activeOrigin = state.customGpsCoords || originData.coords;

        mapService.renderRoute({
            originCoords: originData.coords,
            destCoords: destData.coords,
            gpsCoords: state.customGpsCoords
        });

        if (routeStatsBadge) {
            routeStatsBadge.classList.remove('hidden');
            routeStatsBadge.textContent = '🛣️ TRAZANDO POR CALLES...';
        }

        const route = await fetchStreetRoute(activeOrigin, destData.coords);
        if (seq !== routeRequestSeq) return;

        setState({
            activeRouteCoords: route.coords,
            routeDistanceMeters: route.distanceMeters,
            routeDurationMinutes: route.durationMinutes
        });

        mapService.renderRoute({
            originCoords: originData.coords,
            destCoords: destData.coords,
            gpsCoords: state.customGpsCoords,
            routeCoords: route.coords,
            isStreetRoute: route.isStreetRoute
        });

        if (routeStatsBadge) {
            if (route.isStreetRoute && route.distanceMeters !== null) {
                routeStatsBadge.textContent = `🛣️ ${formatDistanceLabel(route.distanceMeters)} • ~${route.durationMinutes} MIN`;
            } else {
                routeStatsBadge.textContent = '📍 RUTA DIRECTA (SIN CONEXIÓN VIAL)';
            }
        }
    }

    function syncWomenToggleAccess(state) {
        const allowed = canUseWomenOnlyFilter(state.userGender);
        if (womenToggle) {
            womenToggle.disabled = !allowed;
            if (!allowed) womenToggle.checked = false;
            else womenToggle.checked = Boolean(state.womenOnly);
        }
        if (womenSubtitle) {
            womenSubtitle.textContent = allowed
                ? 'Filtra coincidencias exclusivamente femeninas'
                : 'Disponible solo para cuentas verificadas como Femenino (♀)';
        }
    }

    originInput?.addEventListener('focus', () => {
        originInput.select();
        handleSearchQuery('origin', '');
    });
    originInput?.addEventListener('input', () => {
        handleSearchQuery('origin', originInput.value);
    });

    destInput?.addEventListener('focus', () => {
        destInput.select();
        handleSearchQuery('dest', '');
    });
    destInput?.addEventListener('input', () => {
        handleSearchQuery('dest', destInput.value);
    });

    suggestionsBox?.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-suggestion-idx]');
        if (!btn) return;
        const idx = parseInt(btn.getAttribute('data-suggestion-idx'), 10);
        const item = suggestionsBox._items?.[idx];
        const target = suggestionsBox._target;
        if (item && target) {
            selectPlace(target, item);
        }
    });

    document.addEventListener('click', (event) => {
        if (
            !event.target.closest('#place-suggestions-box') &&
            event.target !== originInput &&
            event.target !== destInput
        ) {
            closeSuggestions();
        }
    });

    pickOriginBtn?.addEventListener('click', () => {
        const next = getState().mapPickTarget === 'origin' ? null : 'origin';
        setPickTarget(next);
    });

    pickDestBtn?.addEventListener('click', () => {
        const next = getState().mapPickTarget === 'dest' ? null : 'dest';
        setPickTarget(next);
    });

    cancelMapPickBtn?.addEventListener('click', () => setPickTarget(null));

    gpsBtn?.addEventListener('click', () => {
        if (!navigator.geolocation) {
            showToast('TU NAVEGADOR NO SOPORTA GEOLOCALIZACIÓN');
            return;
        }
        gpsBtn.disabled = true;
        showToast('📡 OBTENIENDO TU UBICACIÓN EN AREQUIPA...');

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                gpsBtn.disabled = false;
                const coords = [position.coords.latitude, position.coords.longitude];
                const nearest = findNearestOriginKey(coords, PLACES_AQP.origins);
                const resolvedName = await reverseGeocodeAqp(coords);

                if (originInput) {
                    originInput.value = resolvedName;
                }

                setState({
                    originKey: nearest?.key || 'custom',
                    originPlace: { key: 'gps', name: resolvedName, coords },
                    customGpsCoords: coords
                });
                syncRouteOnMap();

                if (nearest) {
                    showToast(`📍 GPS ACTIVO • CERCA A ${nearest.name.split(' (')[0]} (${formatDistanceLabel(nearest.distanceMeters)})`);
                } else {
                    showToast('📍 RADIO PRIVADO 250M CENTRADO EN TU GPS');
                }
            },
            () => {
                gpsBtn.disabled = false;
                showToast('PERMISO GPS DENEGADO • ESCRIBE O TOCA EL MAPA');
            },
            { enableHighAccuracy: true, timeout: 7000 }
        );
    });

    timeBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            const label = btn.getAttribute('data-time') || 'AHORA';
            setState({ departureTime: label });
            timeBtns.forEach((b) => {
                b.className = 'time-btn btn-brutal-sm bg-white text-sup-green hover:bg-sup-orange/15 text-[10px] font-bold py-1.5 rounded-sm uppercase';
            });
            btn.className = 'time-btn btn-brutal-sm bg-sup-orange text-white text-[10px] font-bold py-1.5 rounded-sm uppercase';
        });
    });

    payBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            const method = btn.getAttribute('data-payment') || 'YAPE / PLIN';
            setState({ paymentMethod: method });
            payBtns.forEach((b) => {
                b.className = 'pay-btn btn-brutal-sm bg-white text-sup-green text-[10px] font-bold py-1.5 rounded-sm uppercase';
            });
            btn.className = method.includes('YAPE')
                ? 'pay-btn btn-brutal-sm bg-sup-plum text-white text-[10px] font-bold py-1.5 rounded-sm uppercase'
                : 'pay-btn btn-brutal-sm bg-sup-green text-sup-cream text-[10px] font-bold py-1.5 rounded-sm uppercase';
        });
    });

    womenToggle?.addEventListener('change', () => {
        const state = getState();
        if (!canUseWomenOnlyFilter(state.userGender)) {
            womenToggle.checked = false;
            showToast('FILTRO EXCLUSIVO PARA PASAJERAS VERIFICADAS (♀)');
            return;
        }
        setState({ womenOnly: womenToggle.checked });
    });

    searchBtn?.addEventListener('click', () => {
        setPickTarget(null);
        closeSuggestions();
        onStartSearch();
    });

    return {
        initMap() {
            if (mapService.init('map-screen-1')) {
                mapService.onMapClick((coords) => {
                    const target = getState().mapPickTarget;
                    if (target) {
                        applyMapCoordinate(target, coords);
                    }
                });
                mapService.onPinsDragged({
                    onOriginDragEnd: (coords) => applyMapCoordinate('origin', coords),
                    onDestDragEnd: (coords) => applyMapCoordinate('dest', coords)
                });
                syncRouteOnMap();
            }
        },
        syncWomenToggleAccess,
        syncRouteOnMap
    };
}
