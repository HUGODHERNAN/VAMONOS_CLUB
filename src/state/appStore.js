import { DEFAULT_USER_STATS, TIMERS } from '../config/constants.js';
import { PLACES_AQP } from '../config/placesAqp.js';
import { createInitialMockUsers } from '../services/mockData.js';

const initialState = {
    authMode: 'login',
    pendingConfirmEmail: '',
    userId: 'demo-local-user',
    userName: 'Hugo H.',
    userUni: 'UTP',
    userEmail: '',
    userPhone: '',
    userGender: 'M',
    uniVerified: true,
    userStats: { ...DEFAULT_USER_STATS },
    currentScreen: 0,
    originKey: 'utp',
    destKey: 'cerro_colorado',
    originPlace: { key: 'utp', ...PLACES_AQP.origins.utp },
    destPlace: { key: 'cerro_colorado', ...PLACES_AQP.destinations.cerro_colorado },
    mapPickTarget: null,
    customGpsCoords: null,
    activeRouteCoords: null,
    routeDistanceMeters: null,
    routeDurationMinutes: null,
    departureTime: 'AHORA',
    paymentMethod: 'YAPE / PLIN',
    womenOnly: false,
    candidates: createInitialMockUsers(),
    dismissedUserIds: [],
    activePartner: null,
    pendingPartner: null,
    activeIntentId: null,
    activeRequestId: null,
    activeTripId: null,
    incomingRequest: null,
    requestSecondsRemaining: TIMERS.REQUEST_TIMEOUT_SECONDS,
    selectedRating: 5,
    secondsRemaining: TIMERS.CHAT_TTL_SECONDS,
    replyIndex: 0
};

class AppStore {
    constructor() {
        this.state = { ...initialState };
        this.listeners = new Set();
    }

    getState() {
        return this.state;
    }

    setState(patch) {
        this.state = { ...this.state, ...patch };
        for (const listener of this.listeners) {
            listener(this.state);
        }
    }

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
}

export const appStore = new AppStore();

