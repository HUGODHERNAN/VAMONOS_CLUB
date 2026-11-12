import { PLACES_AQP } from '../../config/placesAqp.js';
import { canUseWomenOnlyFilter } from '../../domain/auth.js';
import { filterMatchCandidates, parsePlaceLabel } from '../../domain/matching.js';
import { escapeHtml } from '../utils/dom.js';

export function setupRadarView({ getState, onBackToMap, onToggleWomenFilter, onDismissUser, onResetRadar, onPreviewRoute, onAcceptUser }) {
    const backBtn = document.getElementById('radar-back-map-btn');
    const womenPill = document.getElementById('radar-women-pill');
    const container = document.getElementById('matches-container');

    backBtn?.addEventListener('click', onBackToMap);
    womenPill?.addEventListener('click', onToggleWomenFilter);

    container?.addEventListener('click', (event) => {
        const dismissBtn = event.target.closest('[data-action="dismiss-match"]');
        if (dismissBtn) {
            onDismissUser(dismissBtn.getAttribute('data-user-id'));
            return;
        }

        const previewBtn = event.target.closest('[data-action="preview-route"]');
        if (previewBtn) {
            onPreviewRoute?.(previewBtn.getAttribute('data-user-id'));
            return;
        }

        const acceptBtn = event.target.closest('[data-action="accept-match"]');
        if (acceptBtn) {
            onAcceptUser(acceptBtn.getAttribute('data-user-id'));
            return;
        }

        const resetBtn = event.target.closest('[data-action="reset-radar"]');
        if (resetBtn) {
            onResetRadar();
        }
    });

    function render() {
        const state = getState();
        const originData = state.originPlace || PLACES_AQP.origins[state.originKey] || PLACES_AQP.origins.utp;
        const destData = state.destPlace || PLACES_AQP.destinations[state.destKey] || PLACES_AQP.destinations.cerro_colorado;

        const originShort = originData.name.split(' (')[0];
        const destShort = destData.name.split(' (')[0];
        const isUni = state.userUni && state.userUni !== 'AQP';

        const userBadge = document.getElementById('radar-user-badge');
        const routeLabel = document.getElementById('radar-route-label');
        const timeBadge = document.getElementById('radar-time-badge');

        if (userBadge) userBadge.textContent = isUni ? `🎓 ${state.userUni}` : '✅ AQP';
        if (routeLabel) routeLabel.textContent = `${originShort} → ${destShort}`;
        if (timeBadge) timeBadge.textContent = `SALIDA: ${state.departureTime} • ${state.paymentMethod}`;

        const allowedWomenOnly = canUseWomenOnlyFilter(state.userGender);
        const womenActive = allowedWomenOnly && state.womenOnly;
        if (womenPill) {
            womenPill.className = womenActive
                ? 'px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase border-2 transition-all bg-sup-orange text-white border-sup-cream'
                : 'px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase border-2 transition-all bg-sup-cream text-sup-green border-sup-cream';
            womenPill.textContent = womenActive ? '♀ SOLO MUJERES' : '♀ TODAS';
            womenPill.title = allowedWomenOnly ? 'Alternar filtro Solo Mujeres' : 'Exclusivo para pasajeras (♀)';
        }

        if (!container) return;

        const candidates = state.activeIntentId
            ? (state.candidates || []).filter((u) => !state.dismissedUserIds.includes(u.id))
            : filterMatchCandidates(state.candidates, {
                dismissedUserIds: state.dismissedUserIds,
                womenOnly: state.womenOnly,
                userGender: state.userGender
            });

        if (candidates.length === 0) {
            container.innerHTML = `
                <div class="bg-white border-2 border-sup-green shadow-hard rounded-lg p-5 text-center space-y-3 my-4">
                    <div class="text-2xl">📡</div>
                    <h3 class="font-display text-sm uppercase text-sup-green">NO QUEDAN MÁS COMPAÑEROS EN ESTE BLOQUE</h3>
                    <p class="text-xs font-medium text-sup-green/75">Vuelve a cargar el radar o cambia el filtro de salida.</p>
                    <button type="button" data-action="reset-radar" class="btn-brutal bg-sup-orange text-white font-display text-xs uppercase px-4 py-2 rounded-md">
                        ↻ RECARGAR RADAR
                    </button>
                </div>
            `;
            return;
        }

        const { district: destDistrict, street: destStreet } = parsePlaceLabel(destData);

        container.innerHTML = candidates.map((user) => {
            const isSame = user.matchType === 'same';
            const badgeClass = isSame ? 'bg-[#1E7A50] text-white' : 'bg-sup-green text-sup-cream';
            const badgeLabel = isSame ? '🟢 MISMO DESTINO' : '🔵 EN TU RUTA (DE PASO)';
            const routeDistrict = escapeHtml(isSame ? destDistrict : user.stopDistrict);
            const routeStreet = escapeHtml(isSame ? destStreet : user.stopStreet);
            const routePrefix = isSame ? 'SU DESTINO:' : 'BAJA EN:';

            return `
                <article class="bg-white border-2 border-sup-green shadow-hard rounded-lg p-3 space-y-2.5 animate-pop">
                    <div class="flex items-center justify-between gap-1.5">
                        <span class="${badgeClass} border border-sup-green text-[9px] font-bold uppercase px-2 py-0.5 rounded-[2px]">
                            ${badgeLabel}
                        </span>
                        <span class="text-[10px] font-bold uppercase text-sup-green/80">
                            📍 A ${escapeHtml(user.distanceMeters)}M DE TI
                        </span>
                    </div>

                    <div class="flex items-center gap-3">
                        <img src="${escapeHtml(user.avatar)}" alt="${escapeHtml(user.name)}" class="w-14 h-14 rounded-sm object-cover border-2 border-sup-green shadow-hard-sm shrink-0">
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center justify-between gap-1">
                                <h3 class="font-display text-base uppercase text-sup-green truncate">${escapeHtml(user.name)}</h3>
                                <span class="bg-sup-orange text-white text-[10px] font-bold px-1.5 py-0.5 rounded-sm border border-sup-green shrink-0">⭐ ${escapeHtml(user.rating)}</span>
                            </div>
                            <div class="mt-1 flex flex-wrap items-center gap-1">
                                <span class="bg-sup-cream border border-sup-green text-sup-green text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm">
                                    🎓 ESTUDIANTE VERIFICADO ${escapeHtml(user.uni)}
                                </span>
                                <span class="bg-white border border-sup-green text-sup-green text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm">
                                    ⏱️ ${escapeHtml(user.punctuality)} PUNTUAL
                                </span>
                            </div>
                            <p class="text-[10px] font-bold text-sup-green/70 mt-0.5">${escapeHtml(user.emailDomain)}</p>
                        </div>
                    </div>

                    <div class="bg-sup-cream border-2 border-sup-green rounded-md p-2.5 space-y-2">
                        <div class="flex items-center justify-between text-[9px] font-bold uppercase text-sup-green">
                            <span>TRAMO COMPARTIDO</span>
                            <span class="text-sup-orange">${escapeHtml(user.sharedPercent)}</span>
                        </div>
                        <div class="relative h-4 flex items-center">
                            <div class="w-full h-1.5 bg-white border border-sup-green rounded-full overflow-hidden">
                                <div class="h-full bg-sup-orange" style="width: ${isSame ? '100%' : '65%'};"></div>
                            </div>
                            <span class="absolute left-0 w-3 h-3 rounded-full bg-sup-green border border-white"></span>
                            <span class="absolute ${isSame ? 'right-0' : 'left-[65%]'} w-3 h-3 rounded-full bg-sup-orange border border-sup-green"></span>
                        </div>
                        <div class="pt-1.5 border-t border-sup-green/20 flex items-start justify-between gap-2">
                            <div class="min-w-0">
                                <div class="flex items-center gap-1.5 flex-wrap">
                                    <span class="text-[9px] font-bold uppercase text-sup-green/70">${routePrefix}</span>
                                    <span class="bg-sup-green text-sup-cream font-display text-[10px] uppercase px-2 py-0.5 rounded-[2px] tracking-wide">
                                        ${routeDistrict}
                                    </span>
                                </div>
                                <p class="text-[11px] font-bold text-sup-green mt-1 truncate">
                                    🛣️ ${routeStreet}
                                </p>
                            </div>
                            <span class="bg-white border border-sup-green text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-[2px] shrink-0">
                                ${escapeHtml(user.payment)}
                            </span>
                        </div>
                        <button type="button" data-action="preview-route" data-user-id="${escapeHtml(user.id)}" class="btn-brutal-sm w-full bg-white hover:bg-sup-green hover:text-sup-cream text-sup-green text-[10px] font-bold uppercase py-1.5 rounded-[3px] flex items-center justify-center gap-1.5">
                            🗺️ VER RUTA EN MAPA
                        </button>
                    </div>

                    <p class="text-[11px] font-medium text-sup-green/85 leading-snug">
                        "${escapeHtml(user.bio)}"
                    </p>

                    <div class="grid grid-cols-2 gap-2 pt-0.5">
                        <button type="button" data-action="dismiss-match" data-user-id="${escapeHtml(user.id)}" class="btn-brutal-sm bg-white hover:bg-sup-creamDark text-sup-green font-bold text-xs uppercase py-2 rounded-md">
                            ✕ PASAR
                        </button>
                        <button type="button" data-action="accept-match" data-user-id="${escapeHtml(user.id)}" class="btn-brutal bg-sup-orange hover:bg-sup-orangeHover text-white font-display text-xs uppercase py-2 rounded-md">
                            ¡VÁMONOS! →
                        </button>
                    </div>
                </article>
            `;
        }).join('');
    }

    return { render };
}

