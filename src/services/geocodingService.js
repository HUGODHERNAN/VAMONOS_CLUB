import { PLACES_AQP } from '../config/placesAqp.js';

const SEARCH_CACHE = new Map();
const REVERSE_CACHE = new Map();
const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const AQP_VIEWBOX = '-71.65,-16.30,-71.44,-16.50';

function normalizeText(value) {
    return (value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function getLocalPlaces(preferredGroup = 'origins') {
    const primary = Object.entries(PLACES_AQP[preferredGroup] || {}).map(([key, item]) => ({
        key,
        name: item.name,
        coords: item.coords,
        source: 'local'
    }));

    const secondaryGroup = preferredGroup === 'origins' ? 'destinations' : 'origins';
    const secondary = Object.entries(PLACES_AQP[secondaryGroup] || {}).map(([key, item]) => ({
        key,
        name: item.name,
        coords: item.coords,
        source: 'local'
    }));

    return [...primary, ...secondary];
}

/**
 * Filters predefined Arequipa hubs instantly without network.
 * @param {string} query
 * @param {'origins'|'destinations'} preferredGroup
 * @returns {Array<{ key: string, name: string, coords: [number, number], source: string }>}
 */
export function filterLocalPlaces(query, preferredGroup = 'origins') {
    const all = getLocalPlaces(preferredGroup);
    const norm = normalizeText(query);
    if (!norm) return all.slice(0, 8);

    return all
        .filter((item) => normalizeText(item.name).includes(norm))
        .slice(0, 8);
}

function formatNominatimDisplay(item) {
    const addr = item.address || {};
    const road = addr.road || addr.pedestrian || addr.residential || addr.amenity || addr.building || '';
    const house = addr.house_number ? ` ${addr.house_number}` : '';
    const area = addr.suburb || addr.neighbourhood || addr.city_district || addr.town || addr.city || 'Arequipa';

    if (road) {
        return `${road}${house} (${area})`.toUpperCase();
    }
    const shortPart = (item.display_name || 'Arequipa').split(',').slice(0, 2).join(' • ');
    return shortPart.trim().toUpperCase();
}

/**
 * Searches streets and landmarks in Arequipa using Nominatim bounded to the city.
 * @param {string} query
 * @returns {Promise<Array<{ key: string, name: string, coords: [number, number], source: string }>>}
 */
export async function searchRemotePlacesAqp(query) {
    const clean = (query || '').trim();
    if (clean.length < 3) return [];

    const cacheKey = normalizeText(clean);
    if (SEARCH_CACHE.has(cacheKey)) {
        return SEARCH_CACHE.get(cacheKey);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
        const params = new URLSearchParams({
            q: `${clean}, Arequipa, Peru`,
            format: 'jsonv2',
            addressdetails: '1',
            limit: '5',
            countrycodes: 'pe',
            viewbox: AQP_VIEWBOX,
            bounded: '1',
            'accept-language': 'es'
        });
        const response = await fetch(`${NOMINATIM_BASE}/search?${params.toString()}`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) return [];
        const rows = await response.json();
        const mapped = (Array.isArray(rows) ? rows : []).map((row) => ({
            key: `osm_${row.place_id}`,
            name: formatNominatimDisplay(row),
            coords: [parseFloat(row.lat), parseFloat(row.lon)],
            source: 'osm'
        }));

        SEARCH_CACHE.set(cacheKey, mapped);
        return mapped;
    } catch {
        clearTimeout(timeoutId);
        return [];
    }
}

/**
 * Reverse geocodes a tapped or dragged coordinate in Arequipa into a short street/district label.
 * @param {[number, number]} coords
 * @returns {Promise<string>}
 */
export async function reverseGeocodeAqp(coords) {
    const key = `${coords[0].toFixed(4)},${coords[1].toFixed(4)}`;
    if (REVERSE_CACHE.has(key)) {
        return REVERSE_CACHE.get(key);
    }

    const fallback = `PUNTO EN MAPA (${coords[0].toFixed(4)}, ${coords[1].toFixed(4)})`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3800);

    try {
        const params = new URLSearchParams({
            lat: String(coords[0]),
            lon: String(coords[1]),
            format: 'jsonv2',
            addressdetails: '1',
            'accept-language': 'es'
        });
        const response = await fetch(`${NOMINATIM_BASE}/reverse?${params.toString()}`, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) return fallback;
        const data = await response.json();
        const formatted = data ? formatNominatimDisplay(data) : fallback;
        REVERSE_CACHE.set(key, formatted);
        return formatted;
    } catch {
        clearTimeout(timeoutId);
        return fallback;
    }
}

