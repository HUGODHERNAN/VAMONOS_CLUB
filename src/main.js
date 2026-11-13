import { TIMERS } from './config/constants.js';
import { PLACES_AQP } from './config/placesAqp.js';
import { isSupabaseConfigured } from './config/supabaseConfig.js';
import { applyNoShowPenalty, getNoShowState, incrementCompletedTripStats } from './domain/tripRules.js';
import { setupPwaInstall } from './pwa/installPrompt.js';
import { authService } from './services/authService.js';
import { mapService } from './services/mapService.js';
import { matchService } from './services/matchService.js';
import { createInitialMockUsers } from './services/mockData.js';
import { notificationService } from './services/notificationService.js';
import { radarService } from './services/radarService.js';
import { storageService } from './services/storageService.js';
import { tripService } from './services/tripService.js';
import { appStore } from './state/appStore.js';
import { setupIncomingRequestModal } from './ui/components/incomingRequestModal.js';
import { setupProfileModal } from './ui/components/profileModal.js';
import { setupRatingModal } from './ui/components/ratingModal.js';
import { setupRequestModal } from './ui/components/requestModal.js';
import { setupRoutePreviewModal } from './ui/components/routePreviewModal.js';
import { showToast } from './ui/components/toast.js';
import { setupTopbar, syncTopbar } from './ui/components/topbar.js';
import { setupChatView } from './ui/views/chatView.js';
import { setupLandingView } from './ui/views/landingView.js';
import { setupMapView } from './ui/views/mapView.js';
import { setupRadarView } from './ui/views/radarView.js';
import { setupTripView } from './ui/views/tripView.js';

let requestInterval = null;
let requestAutoAcceptTimeout = null;
let incomingCountdownInterval = null;
let chatTimerInterval = null;
let radarRefreshInterval = null;
let typingTimeout = null;
let unsubscribeMatchEvents = null;
let unsubscribeTripRoom = null;

function clearRadarRefreshTimer() {
    if (radarRefreshInterval) {
        clearInterval(radarRefreshInterval);
        radarRefreshInterval = null;
    }
}

function clearRequestTimers() {
    if (requestInterval) {
        clearInterval(requestInterval);
        requestInterval = null;
    }
    if (requestAutoAcceptTimeout) {
        clearTimeout(requestAutoAcceptTimeout);
        requestAutoAcceptTimeout = null;
    }
}

function clearIncomingTimer() {
    if (incomingCountdownInterval) {
        clearInterval(incomingCountdownInterval);
        incomingCountdownInterval = null;
    }
}

function clearChatTimers() {
    if (chatTimerInterval) {
        clearInterval(chatTimerInterval);
        chatTimerInterval = null;
    }
    if (typingTimeout) {
        clearTimeout(typingTimeout);
        typingTimeout = null;
    }
    if (unsubscribeTripRoom) {
        unsubscribeTripRoom();
        unsubscribeTripRoom = null;
    }
}

function showScreen(screenNumber) {
    if (screenNumber !== 2) {
        clearRadarRefreshTimer();
    }
    appStore.setState({ currentScreen: screenNumber });
    const landingEl = document.getElementById('screen-0');
    const appShellEl = document.getElementById('app-container');

    if (screenNumber === 0) {
        appShellEl?.classList.add('hidden');
        landingEl?.classList.remove('hidden');
        syncTopbar(appStore.getState());
        return;
    }

    landingEl?.classList.add('hidden');
    appShellEl?.classList.remove('hidden');

    for (let i = 1; i <= 4; i++) {
        const screenEl = document.getElementById(`screen-${i}`);
        if (!screenEl) continue;
        const active = i === screenNumber;
        screenEl.classList.toggle('hidden', !active);
        screenEl.classList.toggle('flex', active);
    }

    syncTopbar(appStore.getState());
    if (screenNumber === 1) {
        mapService.invalidateSize();
    }
}

async function bootstrap() {
    const isCloudMode = isSupabaseConfigured();
    setupPwaInstall({ showToast });

    const ratingModal = setupRatingModal({
        onSelectRating(count) {
            appStore.setState({ selectedRating: count });
        },
        async onSubmitSurvey({ comment }) {
            const state = appStore.getState();
            const pending = await tripService.getPendingSurvey();
            const tripId = state.activeTripId || pending?.tripId || null;
            const reviewedId = state.activePartner?.id || pending?.partnerId;

            if (reviewedId) {
                const res = await tripService.submitReview({
                    tripId,
                    reviewerId: state.userId,
                    reviewedId,
                    stars: state.selectedRating,
                    comment
                });
                if (!res.ok) {
                    showToast(res.error);
                    return;
                }
            }

            const nextStats = incrementCompletedTripStats(state.userStats);
            if (!isCloudMode) {
                storageService.saveUserStats(nextStats);
            }

            ratingModal.close();
            appStore.setState({ activePartner: null, activeTripId: null, userStats: nextStats });
            showScreen(1);
            showToast(`¡GRACIAS! CALIFICACIÓN (${state.selectedRating}⭐) GUARDADA`);
        }
    });

    async function checkPendingSurveyEnforcement() {
        const pending = await tripService.getPendingSurvey();
        if (pending && pending.partnerName) {
            appStore.setState({
                activeTripId: pending.tripId || appStore.getState().activeTripId,
                activePartner: appStore.getState().activePartner || {
                    id: pending.partnerId,
                    name: pending.partnerName,
                    uni: pending.partnerUni,
                    avatar: pending.partnerAvatar
                }
            });
            ratingModal.open(pending, true);
            return true;
        }
        return false;
    }

    const profileModal = setupProfileModal({
        canOpen: async () => !(await checkPendingSurveyEnforcement()),
        async onVerifyUni(email) {
            const state = appStore.getState();
            const res = await authService.linkInstitutionalEmail(email, {
                userName: state.userName,
                userUni: state.userUni,
                userEmail: state.userEmail,
                userGender: state.userGender
            });

            if (!res.ok) {
                showToast(res.error);
                return false;
            }

            if (res.requiresEmailConfirmation) {
                showToast(res.message);
                return true;
            }

            appStore.setState({
                userEmail: res.userEmail,
                userUni: res.userUni,
                uniVerified: true
            });
            profileModal.sync(appStore.getState());
            showToast(`🎓 INSIGNIA ${res.userUni} VERIFICADA`);
            return true;
        },
        async onLogout(closeModal) {
            if (await checkPendingSurveyEnforcement()) return;
            clearRequestTimers();
            clearIncomingTimer();
            clearChatTimers();
            clearRadarRefreshTimer();
            if (unsubscribeMatchEvents) {
                unsubscribeMatchEvents();
                unsubscribeMatchEvents = null;
            }
            await radarService.cancelActiveIntent(appStore.getState().activeIntentId);
            await authService.signOut();
            appStore.setState({ activeIntentId: null, activeTripId: null, activePartner: null });
            closeModal();
            showScreen(0);
            showToast('SESIÓN CERRADA CORRECTAMENTE');
        }
    });

    setupTopbar({
        async onReturnLanding() {
            if (await checkPendingSurveyEnforcement()) return;
            clearRequestTimers();
            clearIncomingTimer();
            clearChatTimers();
            clearRadarRefreshTimer();
            profileModal.close();
            showScreen(0);
        },
        onOpenProfile() {
            profileModal.open(appStore.getState());
        }
    });

    async function runRadarSearch() {
        if (await checkPendingSurveyEnforcement()) return;
        notificationService.requestPermission();
        const state = appStore.getState();
        const originData = state.originPlace || PLACES_AQP.origins[state.originKey] || PLACES_AQP.origins.utp;
        const destData = state.destPlace || PLACES_AQP.destinations[state.destKey] || PLACES_AQP.destinations.cerro_colorado;
        const originCoords = state.customGpsCoords || originData.coords;

        if (isCloudMode) {
            showToast('📡 BUSCANDO COMPAÑEROS EN AREQUIPA...');
        }

        const res = await radarService.publishAndSearch({
            userId: state.userId,
            originKey: state.originKey,
            destKey: state.destKey,
            originName: originData.name,
            destName: destData.name,
            originCoords,
            destCoords: destData.coords,
            routeCoords: state.activeRouteCoords,
            departureTime: state.departureTime,
            paymentMethod: state.paymentMethod,
            womenOnly: state.womenOnly,
            userGender: state.userGender,
            mockCandidates: state.candidates,
            dismissedUserIds: state.dismissedUserIds
        });

        if (!res.ok) {
            showToast(res.error);
            return;
        }

        if (res.mode === 'cloud') {
            appStore.setState({
                activeIntentId: res.intentId,
                candidates: res.candidates
            });
        }

        radarView.render();
        showScreen(2);
        startRadarAutoRefresh();
    }

    function startRadarAutoRefresh() {
        clearRadarRefreshTimer();
        if (!isCloudMode) return;

        radarRefreshInterval = setInterval(async () => {
            const st = appStore.getState();
            if (st.currentScreen !== 2 || !st.activeIntentId || st.pendingPartner || st.incomingRequest) {
                return;
            }
            const refreshed = await radarService.refreshMatches({
                intentId: st.activeIntentId,
                dismissedUserIds: st.dismissedUserIds
            });
            if (!refreshed.ok) return;

            const prevSig = (st.candidates || []).map((c) => `${c.id}:${c.intentId}:${c.matchType}`).join('|');
            const nextSig = refreshed.candidates.map((c) => `${c.id}:${c.intentId}:${c.matchType}`).join('|');
            if (prevSig !== nextSig) {
                const hadNone = (st.candidates || []).length === 0;
                appStore.setState({ candidates: refreshed.candidates });
                radarView.render();
                if (hadNone && refreshed.candidates.length > 0) {
                    showToast('🚕 ¡NUEVO COMPAÑERO DETECTADO EN TU RUTA!');
                }
            }
        }, TIMERS.RADAR_AUTO_REFRESH_MS);
    }

    const mapView = setupMapView({
        getState: () => appStore.getState(),
        setState: (patch) => appStore.setState(patch),
        showToast,
        onStartSearch: runRadarSearch
    });

    const incomingRequestModal = setupIncomingRequestModal({
        async onAccept() {
            clearIncomingTimer();
            const req = appStore.getState().incomingRequest;
            incomingRequestModal.close();
            appStore.setState({ incomingRequest: null });
            if (!req) return;

            const res = await matchService.acceptIncomingRequest(req.requestId);
            if (!res.ok) {
                showToast(res.error);
            }
        },
        async onReject() {
            clearIncomingTimer();
            const req = appStore.getState().incomingRequest;
            incomingRequestModal.close();
            appStore.setState({ incomingRequest: null });
            if (req) {
                await matchService.rejectIncomingRequest(req.requestId);
                showToast('SOLICITUD RECHAZADA');
            }
        }
    });

    async function setupCloudMatchRealtime(userId) {
        if (!isCloudMode || !userId || userId === 'demo-local-user') return;
        if (unsubscribeMatchEvents) {
            unsubscribeMatchEvents();
        }

        unsubscribeMatchEvents = await matchService.subscribeToMatchEvents({
            userId,
            onIncomingRequest(details) {
                clearIncomingTimer();
                appStore.setState({ incomingRequest: details });
                incomingRequestModal.open(details);
                notificationService.notify({
                    title: `🚕 ${details.requesterName} quiere compartir taxi`,
                    body: `Ruta: ${details.originName} → ${details.destName}`,
                    tag: `incoming-${details.requestId}`,
                    kind: 'request'
                });

                let sec = TIMERS.REQUEST_TIMEOUT_SECONDS;
                incomingCountdownInterval = setInterval(() => {
                    sec--;
                    incomingRequestModal.updateCountdown(sec);
                    if (sec <= 0) {
                        clearIncomingTimer();
                        incomingRequestModal.close();
                        appStore.setState({ incomingRequest: null });
                    }
                }, 1000);
            },
            onRequestClosed(status) {
                clearRequestTimers();
                requestModal.close();
                appStore.setState({ pendingPartner: null, activeRequestId: null });
                showToast(status === 'rejected' ? 'EL COMPAÑERO RECHAZÓ LA SOLICITUD' : 'TIEMPO DE ESPERA AGOTADO (60S)');
            },
            onTripOpened({ tripId, originName, destName, partner }) {
                clearRequestTimers();
                clearIncomingTimer();
                requestModal.close();
                incomingRequestModal.close();
                appStore.setState({ pendingPartner: null, activeRequestId: null, incomingRequest: null });
                openCoordinationChat({ partner, tripId, originName, destName });
            }
        });
    }

    function applyProfileAndActivate(profile) {
        appStore.setState({
            userId: profile.userId || 'demo-local-user',
            userName: profile.userName,
            userUni: profile.userUni || 'AQP',
            userEmail: profile.userEmail || '',
            userPhone: profile.userPhone || '',
            userGender: profile.userGender || 'M',
            uniVerified: Boolean(profile.uniVerified),
            userStats: profile.userStats || appStore.getState().userStats,
            womenOnly: profile.userGender === 'F' ? appStore.getState().womenOnly : false,
            candidates: isCloudMode ? [] : createInitialMockUsers()
        });
        mapView.syncWomenToggleAccess(appStore.getState());
        showScreen(1);
        setupCloudMatchRealtime(profile.userId);
        setTimeout(() => {
            mapView.initMap();
            checkPendingSurveyEnforcement();
        }, 80);
    }

    const landingView = setupLandingView({
        onSwitchMode(explicitMode) {
            const nextMode = explicitMode || (appStore.getState().authMode === 'login' ? 'register' : 'login');
            appStore.setState({ authMode: nextMode, pendingConfirmEmail: '' });
            return nextMode;
        },
        async onGoogleAuth() {
            const res = await authService.signInWithGoogle();
            if (!res.ok) {
                showToast(res.error);
            }
        },
        async onEnterApp({ loginEmail, loginPassword, regName, regGender, regPhone, regEmail, regPassword }) {
            const state = appStore.getState();
            const res = await authService.startAuth({
                authMode: state.authMode,
                loginEmail,
                loginPassword,
                regName,
                regGender,
                regPhone,
                regEmail,
                regPassword
            });

            if (!res.ok) {
                showToast(res.error);
                return;
            }

            if (res.requiresEmailConfirmation) {
                appStore.setState({ pendingConfirmEmail: res.email });
                landingView.showEmailConfirmationStep(res.email);
                showToast(`📩 ENLACE DE VERIFICACIÓN ENVIADO A ${res.email.toUpperCase()}`);
                return;
            }

            applyProfileAndActivate(res.profile);
            showToast(`¡BIENVENIDO ${res.profile.userName.toUpperCase()}!`);
        },
        async onForgotPassword(email) {
            const res = await authService.sendPasswordReset(email);
            showToast(res.ok ? res.message : res.error);
        },
        async onSaveNewPassword(newPassword) {
            const res = await authService.updatePassword(newPassword);
            if (!res.ok) {
                showToast(res.error);
                return;
            }
            if (res.profile) {
                applyProfileAndActivate(res.profile);
            } else {
                landingView.applyAuthModeUI('login');
            }
            showToast('🔐 CONTRASEÑA ACTUALIZADA CORRECTAMENTE');
        }
    });

    function enterTripScreen({ tripId, originName, destName }) {
        clearChatTimers();
        const state = appStore.getState();
        const partner = state.activePartner;
        if (!partner) return;

        const resolvedOrigin = originName || (state.originPlace || PLACES_AQP.origins[state.originKey] || PLACES_AQP.origins.utp).name;
        const resolvedDest = destName || (state.destPlace || PLACES_AQP.destinations[state.destKey] || PLACES_AQP.destinations.cerro_colorado).name;

        if (!isCloudMode) {
            storageService.savePendingSurvey({
                partnerId: partner.id,
                partnerName: partner.name,
                partnerUni: partner.uni,
                partnerAvatar: partner.avatar,
                originName: resolvedOrigin,
                destName: resolvedDest
            });
        }

        tripView.render({
            userName: state.userName,
            partner,
            originName: resolvedOrigin,
            destName: resolvedDest
        });
        showScreen(4);
        showToast('¡VIAJE INICIADO! PUEDES COMPARTIR TU RUTA POR WHATSAPP');
    }

    const chatView = setupChatView({
        isCloudMode,
        onFastForward5m() {
            const next = Math.max(60, appStore.getState().secondsRemaining - 300);
            appStore.setState({ secondsRemaining: next });
            chatView.updateTimers(next);
            showToast('⏱️ +5 MINUTOS SIMULADOS • BOTÓN NO APARECIÓ HABILITADO');
        },
        async onSendMessage(text) {
            const state = appStore.getState();
            chatView.appendBubble(text, 'me');

            if (isCloudMode && state.activeTripId) {
                const res = await tripService.sendChatMessage({
                    tripId: state.activeTripId,
                    senderId: state.userId,
                    body: text
                });
                if (!res.ok) showToast(res.error);
            } else {
                schedulePartnerReply();
            }
        },
        async onCancelMatch() {
            const tripId = appStore.getState().activeTripId;
            clearChatTimers();
            if (isCloudMode && tripId) {
                await tripService.cancelTrip({ tripId });
            }
            appStore.setState({ activePartner: null, activeTripId: null });
            showScreen(2);
            showToast('MATCH CANCELADO');
        },
        async onReportNoShow() {
            const state = appStore.getState();
            if (!getNoShowState(state.secondsRemaining).unlocked) return;

            if (isCloudMode && state.activeTripId) {
                const res = await tripService.reportNoShow({ tripId: state.activeTripId });
                if (!res.ok) {
                    showToast(res.error);
                    return;
                }
                clearChatTimers();
                const partner = state.activePartner;
                appStore.setState({ activePartner: null, activeTripId: null });
                showToast(`⚠️ NO-SHOW REPORTADO: PUNTUALIDAD DE ${(partner?.name || 'COMPAÑERO').toUpperCase()} BAJÓ A ${res.newPunctuality}`);
                await runRadarSearch();
                return;
            }

            clearChatTimers();
            const partner = state.activePartner;
            if (partner) {
                const penalizedPct = applyNoShowPenalty(partner.punctuality);
                const updatedCandidates = state.candidates.map((c) =>
                    c.id === partner.id ? { ...c, punctuality: penalizedPct } : c
                );
                const dismissedUserIds = state.dismissedUserIds.includes(partner.id)
                    ? state.dismissedUserIds
                    : [...state.dismissedUserIds, partner.id];

                appStore.setState({
                    candidates: updatedCandidates,
                    dismissedUserIds,
                    activePartner: null
                });
                showToast(`⚠️ NO-SHOW REPORTADO: PUNTUALIDAD DE ${partner.name.toUpperCase()} BAJÓ A ${penalizedPct}`);
            } else {
                appStore.setState({ activePartner: null });
            }

            radarView.render();
            showScreen(2);
        },
        async onConfirmMeetup() {
            const state = appStore.getState();
            if (isCloudMode && state.activeTripId) {
                const res = await tripService.confirmMeetup({ tripId: state.activeTripId });
                if (!res.ok) {
                    showToast(res.error);
                    return;
                }
            }
            enterTripScreen({ tripId: state.activeTripId });
        }
    });

    function triggerPartnerReply(replyText) {
        const partner = appStore.getState().activePartner;
        if (!partner) return;

        chatView.setTyping(true, partner.name);
        if (typingTimeout) clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
            chatView.setTyping(false);
            const current = appStore.getState();
            if (current.currentScreen === 3 && current.activePartner) {
                chatView.appendBubble(replyText, 'partner');
            }
        }, 950);
    }

    function schedulePartnerReply() {
        const state = appStore.getState();
        const partner = state.activePartner;
        if (!partner?.replies?.length) return;

        const reply = partner.replies[state.replyIndex % partner.replies.length];
        appStore.setState({ replyIndex: state.replyIndex + 1 });
        triggerPartnerReply(reply);
    }

    async function openCoordinationChat({ partner, tripId = null, originName = '', destName = '' }) {
        clearChatTimers();
        appStore.setState({
            activePartner: partner,
            activeTripId: tripId,
            replyIndex: 1,
            secondsRemaining: TIMERS.CHAT_TTL_SECONDS
        });

        chatView.open(partner);
        chatView.updateTimers(TIMERS.CHAT_TTL_SECONDS);
        showScreen(3);
        showToast(`¡MATCH CON ${partner.name.toUpperCase()}!`);

        if (isCloudMode && tripId) {
            unsubscribeTripRoom = await tripService.subscribeToTrip({
                tripId,
                currentUserId: appStore.getState().userId,
                onMessage({ text, sender }) {
                    chatView.appendBubble(text, sender);
                    if (sender === 'partner') {
                        notificationService.notify({
                            title: `💬 Mensaje de ${partner.name}`,
                            body: text,
                            tag: `chat-${tripId}`,
                            kind: 'message',
                            onlyWhenHidden: true
                        });
                    }
                },
                onTripStatusChange(status) {
                    if (status === 'in_progress' && appStore.getState().currentScreen === 3) {
                        enterTripScreen({ tripId, originName, destName });
                    } else if (status === 'cancelled' || status === 'no_show') {
                        clearChatTimers();
                        appStore.setState({ activePartner: null, activeTripId: null });
                        showScreen(2);
                        showToast(status === 'no_show' ? 'SALA CERRADA POR NO-SHOW' : 'EL COMPAÑERO CANCELÓ EL MATCH');
                    }
                }
            });
        } else if (partner.replies?.[0]) {
            triggerPartnerReply(partner.replies[0]);
        }

        chatTimerInterval = setInterval(() => {
            const next = appStore.getState().secondsRemaining - 1;
            if (next <= 0) {
                clearChatTimers();
                appStore.setState({ activePartner: null, activeTripId: null });
                showScreen(2);
                showToast('SALA DE CHAT EXPIRADA (15 MIN)');
                return;
            }
            appStore.setState({ secondsRemaining: next });
            chatView.updateTimers(next);
        }, 1000);
    }

    const requestModal = setupRequestModal({
        isCloudMode,
        async onCancel(expired = false) {
            const reqId = appStore.getState().activeRequestId;
            clearRequestTimers();
            if (isCloudMode && reqId) {
                await matchService.cancelMatchRequest(reqId);
            }
            appStore.setState({ pendingPartner: null, activeRequestId: null });
            requestModal.close();
            showToast(expired ? 'TIEMPO DE ESPERA AGOTADO (60S)' : 'SOLICITUD CANCELADA');
        },
        onSimulateAccept() {
            clearRequestTimers();
            requestModal.close();
            const partner = appStore.getState().pendingPartner;
            appStore.setState({ pendingPartner: null, activeRequestId: null });
            if (partner) {
                openCoordinationChat({ partner });
            }
        }
    });

    async function sendMatchRequestToUser(userId) {
        const state = appStore.getState();
        const partner = state.candidates.find((u) => u.id === userId);
        if (!partner) return;

        const reqRes = await matchService.sendMatchRequest({
            requesterId: state.userId,
            targetUser: partner,
            requesterIntentId: state.activeIntentId
        });

        if (!reqRes.ok) {
            showToast(reqRes.error);
            return;
        }

        clearRequestTimers();
        appStore.setState({
            pendingPartner: partner,
            activeRequestId: reqRes.requestId,
            requestSecondsRemaining: TIMERS.REQUEST_TIMEOUT_SECONDS
        });

        const destData = state.destPlace || PLACES_AQP.destinations[state.destKey] || PLACES_AQP.destinations.cerro_colorado;
        const destDistrict = destData.name.split(' (')[0];

        requestModal.open({
            partner,
            userName: state.userName,
            userUni: state.userUni,
            destDistrict
        });

        requestInterval = setInterval(async () => {
            const next = appStore.getState().requestSecondsRemaining - 1;
            appStore.setState({ requestSecondsRemaining: next });
            requestModal.updateCountdown(next);
            if (next <= 0) {
                const activeReqId = appStore.getState().activeRequestId;
                clearRequestTimers();
                if (isCloudMode && activeReqId) {
                    await matchService.cancelMatchRequest(activeReqId);
                }
                appStore.setState({ pendingPartner: null, activeRequestId: null });
                requestModal.close();
                showToast('TIEMPO DE ESPERA AGOTADO (60S)');
            }
        }, 1000);

        if (!isCloudMode) {
            requestAutoAcceptTimeout = setTimeout(() => {
                clearRequestTimers();
                requestModal.close();
                const currentPartner = appStore.getState().pendingPartner;
                appStore.setState({ pendingPartner: null, activeRequestId: null });
                if (currentPartner) {
                    openCoordinationChat({ partner: currentPartner });
                }
            }, TIMERS.REQUEST_DEMO_AUTO_ACCEPT_MS);
        }
    }

    const routePreviewModal = setupRoutePreviewModal({
        onRequestRide(userId) {
            sendMatchRequestToUser(userId);
        }
    });

    const radarView = setupRadarView({
        getState: () => appStore.getState(),
        onBackToMap() {
            routePreviewModal.close();
            showScreen(1);
        },
        async onToggleWomenFilter() {
            const state = appStore.getState();
            if (state.userGender !== 'F') {
                showToast('FILTRO EXCLUSIVO PARA PASAJERAS VERIFICADAS (♀)');
                return;
            }
            appStore.setState({ womenOnly: !state.womenOnly });
            mapView.syncWomenToggleAccess(appStore.getState());
            if (isCloudMode) {
                await runRadarSearch();
            } else {
                radarView.render();
            }
        },
        onDismissUser(userId) {
            const state = appStore.getState();
            if (!state.dismissedUserIds.includes(userId)) {
                appStore.setState({ dismissedUserIds: [...state.dismissedUserIds, userId] });
            }
            radarView.render();
        },
        async onResetRadar() {
            appStore.setState({ dismissedUserIds: [] });
            if (isCloudMode) {
                await runRadarSearch();
            } else {
                radarView.render();
            }
        },
        onPreviewRoute(userId) {
            const state = appStore.getState();
            const partner = state.candidates.find((u) => u.id === userId);
            if (!partner) return;

            const originData = state.originPlace || PLACES_AQP.origins[state.originKey] || PLACES_AQP.origins.utp;
            const destData = state.destPlace || PLACES_AQP.destinations[state.destKey] || PLACES_AQP.destinations.cerro_colorado;
            const originCoords = state.customGpsCoords || originData.coords;

            routePreviewModal.open({
                partner,
                originCoords,
                destCoords: destData.coords,
                myRouteCoords: state.activeRouteCoords
            });
        },
        onAcceptUser(userId) {
            sendMatchRequestToUser(userId);
        }
    });

    const tripView = setupTripView({
        showToast,
        async onFinishTrip() {
            const partner = appStore.getState().activePartner;
            if (!partner) {
                if (!(await checkPendingSurveyEnforcement())) showScreen(1);
                return;
            }
            ratingModal.open({
                partnerName: partner.name,
                partnerUni: partner.uni,
                partnerAvatar: partner.avatar
            }, false);
        }
    });

    function handleCloudProfileArrival(profile) {
        if (!profile) return;
        const current = appStore.getState();
        if (current.currentScreen === 0) {
            landingView.hideEmailConfirmationStep();
            appStore.setState({ pendingConfirmEmail: '' });
            applyProfileAndActivate(profile);
            showToast(`✅ CORREO VERIFICADO • ¡BIENVENIDO ${profile.userName.toUpperCase()}!`);
            return;
        }
        if (current.userId === profile.userId && (
            profile.uniVerified !== current.uniVerified ||
            profile.userEmail !== current.userEmail ||
            profile.userPhone !== current.userPhone
        )) {
            appStore.setState({
                userEmail: profile.userEmail,
                userPhone: profile.userPhone || current.userPhone,
                userUni: profile.userUni,
                uniVerified: profile.uniVerified
            });
            profileModal.sync(appStore.getState());
            syncTopbar(appStore.getState());
            if (profile.uniVerified) {
                showToast(`🎓 INSIGNIA ${profile.userUni} VERIFICADA`);
            }
        }
    }

    // Hydrate saved user session (Supabase Cloud or Local Demo)
    const restored = await authService.restoreSession();
    if (restored.profile) {
        applyProfileAndActivate(restored.profile);
    } else {
        showScreen(0);
    }

    if (isCloudMode) {
        await authService.subscribeToAuthChanges(({ event, profile }) => {
            if (event === 'PASSWORD_RECOVERY') {
                showScreen(0);
                landingView.showPasswordRecoveryStep();
                showToast('🔐 INGRESA TU NUEVA CONTRASEÑA');
                return;
            }
            if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && profile) {
                handleCloudProfileArrival(profile);
            }
        });

        window.addEventListener('focus', async () => {
            const st = appStore.getState();
            if (st.currentScreen === 0 && st.pendingConfirmEmail) {
                const next = await authService.restoreSession();
                handleCloudProfileArrival(next.profile);
            }
        });
    }
}

window.addEventListener('DOMContentLoaded', bootstrap);
