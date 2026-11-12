/**
 * Calculates great-circle distance between two [lat, lng] coordinates in meters.
 * @param {[number, number]} coordA
 * @param {[number, number]} coordB
 * @returns {number}
 */
export function haversineMeters(coordA, coordB) {
    const R = 6371000;
    const toRad = (deg) => (deg * Math.PI) / 180;

    const [lat1, lon1] = coordA;
    const [lat2, lon2] = coordB;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
}

/**
 * Finds the nearest predefined origin node in Arequipa to a GPS coordinate.
 * @param {[number, number]} userCoords
 * @param {Record<string, { name: string, coords: [number, number] }>} originsMap
 * @returns {{ key: string, name: string, distanceMeters: number } | null}
 */
export function findNearestOriginKey(userCoords, originsMap) {
    if (!Array.isArray(userCoords) || userCoords.length !== 2 || !originsMap) {
        return null;
    }

    let best = null;
    for (const [key, place] of Object.entries(originsMap)) {
        const dist = haversineMeters(userCoords, place.coords);
        if (!best || dist < best.distanceMeters) {
            best = { key, name: place.name, distanceMeters: dist };
        }
    }
    return best;
}

/**
 * Formats meters into human-readable Arequipa distance string.
 * @param {number} meters
 * @returns {string}
 */
export function formatDistanceLabel(meters) {
    if (meters < 1000) {
        return `${meters} M`;
    }
    return `${(meters / 1000).toFixed(1)} KM`;
}

/**
 * Converts [lat, lng] to PostGIS WKT Point (longitude first).
 * @param {[number, number]} coord
 * @returns {string}
 */
export function toWktPoint(coord) {
    return `SRID=4326;POINT(${coord[1]} ${coord[0]})`;
}

/**
 * Converts an array of [lat, lng] points to PostGIS WKT LineString.
 * @param {[number, number][]} coords
 * @returns {string|null}
 */
export function toWktLineString(coords) {
    if (!Array.isArray(coords) || coords.length < 2) return null;
    const pts = coords.map(([lat, lng]) => `${lng} ${lat}`).join(', ');
    return `SRID=4326;LINESTRING(${pts})`;
}

