/**
 * Builds the safety backup message shared via WhatsApp or clipboard during an active trip.
 * @param {{ userName: string, partner: { name: string, uni: string, rating: string }, originName: string, destName: string, rideShareLink?: string, gpsLocationUrl?: string }} params
 * @returns {string}
 */
export function buildWhatsAppSafetyMessage({
    userName,
    partner,
    originName,
    destName,
    rideShareLink = '',
    gpsLocationUrl = ''
}) {
    const cleanLink = (rideShareLink || '').trim() || '[Pega aquí el link de tu Uber/InDrive]';
    const lines = [
        '🛡️ *VÁMONOS CLUB AREQUIPA - VIAJE COMPARTIDO*',
        `• Pasajero: ${userName}`,
        `• Compañero verificado: ${partner.name} (🎓 ${partner.uni} • ⭐ ${partner.rating})`,
        `• Ruta: ${originName} → ${destName}`,
        '• Aplicativo: Uber / InDrive compartido',
        `• Enlace de viaje: ${cleanLink}`
    ];

    if (gpsLocationUrl) {
        lines.push(`• Mi ubicación actual: ${gpsLocationUrl}`);
    }

    return lines.join('\n');
}

/**
 * Builds an urgent SOS WhatsApp message with live coordinates and trip partner info.
 * @param {{ userName: string, partner: { name: string, uni: string }, originName: string, destName: string, gpsLocationUrl?: string }} params
 * @returns {string}
 */
export function buildEmergencySosMessage({ userName, partner, originName, destName, gpsLocationUrl = '' }) {
    const lines = [
        '🚨 *ALERTA DE SEGURIDAD - VÁMONOS CLUB AREQUIPA*',
        `Soy ${userName}. Necesito apoyo durante un taxi compartido.`,
        `• Ruta: ${originName} → ${destName}`,
        `• Compañero registrado: ${partner?.name || 'N/A'} (🎓 ${partner?.uni || 'AQP'})`
    ];
    if (gpsLocationUrl) {
        lines.push(`• Ubicación GPS exacta: ${gpsLocationUrl}`);
    }
    return lines.join('\n');
}

/**
 * Builds an encoded wa.me share URL.
 * @param {string} message
 * @returns {string}
 */
export function buildWhatsAppShareUrl(message) {
    return `https://wa.me/?text=${encodeURIComponent(message || '')}`;
}
