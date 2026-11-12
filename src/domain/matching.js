import { canUseWomenOnlyFilter } from './auth.js';

/**
 * Filters radar candidates according to dismissed IDs and safety rules.
 * @param {Array} users
 * @param {{ dismissedUserIds: string[], womenOnly: boolean, userGender: string }} criteria
 * @returns {Array}
 */
export function filterMatchCandidates(users, { dismissedUserIds = [], womenOnly = false, userGender = 'M' }) {
    const enforceWomenOnly = womenOnly && canUseWomenOnlyFilter(userGender);

    return (users || []).filter((user) => {
        if (dismissedUserIds.includes(user.id)) return false;
        if (enforceWomenOnly && user.gender !== 'F') return false;
        return true;
    });
}

/**
 * Splits destination metadata into district title and street subtitle for card display.
 * @param {{ name: string }} destData
 * @returns {{ district: string, street: string }}
 */
export function parsePlaceLabel(destData) {
    const fullName = destData?.name || 'AREQUIPA';
    const district = fullName.split(' (')[0];
    const streetMatch = fullName.match(/\(([^)]+)\)/);
    const street = streetMatch ? streetMatch[1] : 'Avenida Principal';
    return { district, street };
}

