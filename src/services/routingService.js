const ROUTE_CACHE = new Map();
const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';

/**
 * Fetches a real street-following driving route between two [lat, lng] coordinates in Arequipa.
 * Falls back cleanly to a direct segment if offline or if OSRM times out.
 * @param {[number, number]} originCoords
 * @param {[number, number]} destCoords
 * @returns {Promise<{ coords: [number, number][], distanceMeters: number|null, durationMinutes: number|null, isStreetRoute: boolean }>}
 */
export async function fetchStreetRoute(originCoords, destCoords) {
    const cacheKey = `${originCoords[0].toFixed(4)},${originCoords[1].toFixed(4)}->${destCoords[0].toFixed(4)},${destCoords[1].toFixed(4)}`;
    if (ROUTE_CACHE.has(cacheKey)) {
        return ROUTE_CACHE.get(cacheKey);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4500);

    try {
        const url = `${OSRM_BASE}/${originCoords[1]},${originCoords[0]};${destCoords[1]},${destCoords[0]}?overview=full&geometries=geojson`;
        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`OSRM HTTP ${response.status}`);
        }

        const data = await response.json();
        const route = data?.routes?.[0];
        const rawCoords = route?.geometry?.coordinates;

        if (!Array.isArray(rawCoords) || rawCoords.length < 2) {
            throw new Error('OSRM geometry missing');
        }

        const latLngCoords = rawCoords.map(([lng, lat]) => [lat, lng]);
        const result = {
            coords: latLngCoords,
            distanceMeters: Math.round(route.distance || 0),
            durationMinutes: Math.max(1, Math.round((route.duration || 0) / 60)),
            isStreetRoute: true
        };

        ROUTE_CACHE.set(cacheKey, result);
        return result;
    } catch {
        clearTimeout(timeoutId);
        return {
            coords: [originCoords, destCoords],
            distanceMeters: null,
            durationMinutes: null,
            isStreetRoute: false
        };
    }
}

