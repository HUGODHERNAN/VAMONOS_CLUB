/**
 * Escapes HTML special characters to prevent XSS in template strings.
 * @param {string} value
 * @returns {string}
 */
export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Copies text to clipboard using modern API with textarea fallback.
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
    if (navigator.clipboard?.writeText) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch {
            // Fall through to legacy fallback
        }
    }

    const temp = document.createElement('textarea');
    temp.value = text;
    temp.style.position = 'fixed';
    temp.style.opacity = '0';
    document.body.appendChild(temp);
    temp.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(temp);
    return ok;
}

/**
 * Generates an SVG data URI avatar with retro SUPClub styling for users without photos.
 * @param {string} name
 * @returns {string}
 */
export function createInitialsAvatarDataUrl(name) {
    const parts = (name || 'VC').trim().split(/\s+/).filter(Boolean);
    const initials = parts.length > 1
        ? (parts[0][0] + parts[1][0]).toUpperCase()
        : (parts[0] || 'VC').substring(0, 2).toUpperCase();

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" fill="#063120"/><rect x="6" y="6" width="84" height="84" rx="14" fill="#FA4A19" stroke="#E7DEC8" stroke-width="4"/><text x="48" y="59" text-anchor="middle" fill="#E7DEC8" font-family="Arial Black, sans-serif" font-weight="900" font-size="34">${escapeHtml(initials)}</text></svg>`;
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

