import { PLACES_AQP } from '../src/config/placesAqp.js';
import { canUseWomenOnlyFilter, detectUniFromEmail, getInitials, normalizePeruPhone, validateLogin, validateRegistration } from '../src/domain/auth.js';
import { findNearestOriginKey, formatDistanceLabel, haversineMeters, toWktLineString, toWktPoint } from '../src/domain/geo.js';
import { filterMatchCandidates, parsePlaceLabel } from '../src/domain/matching.js';
import { applyNoShowPenalty, formatClock, getNoShowState, incrementCompletedTripStats } from '../src/domain/tripRules.js';
import { buildEmergencySosMessage, buildWhatsAppSafetyMessage, buildWhatsAppShareUrl } from '../src/domain/whatsapp.js';

const resultsEl = document.getElementById('results');
const summaryEl = document.getElementById('summary');

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function test(name, fn) {
    const li = document.createElement('li');
    try {
        fn();
        passed++;
        li.className = 'pass';
        li.textContent = `PASS: ${name}`;
    } catch (err) {
        failed++;
        li.className = 'fail';
        li.textContent = `FAIL: ${name} -> ${err.message}`;
    }
    resultsEl.appendChild(li);
}

test('detectUniFromEmail detects supported Arequipa universities', () => {
    assert(detectUniFromEmail('u21310779@utp.edu.pe') === 'UTP', 'Expected UTP');
    assert(detectUniFromEmail('alumno@UNSA.EDU.PE') === 'UNSA', 'Expected UNSA case-insensitive');
    assert(detectUniFromEmail('test@ucsm.edu.pe') === 'UCSM', 'Expected UCSM');
    assert(detectUniFromEmail('alumno@senati.pe') === 'SENATI', 'Expected SENATI');
    assert(detectUniFromEmail('estudiante@tecsup.edu.pe') === 'TECSUP', 'Expected TECSUP');
    assert(detectUniFromEmail('alumno@usmp.pe') === 'USMP', 'Expected USMP');
    assert(detectUniFromEmail('user@gmail.com') === null, 'Expected null for Gmail');
});

test('getInitials handles single and multi-word names', () => {
    assert(getInitials('Hugo H.') === 'HH', 'Expected HH');
    assert(getInitials('Camila') === 'CA', 'Expected CA');
    assert(getInitials('') === 'HH', 'Expected fallback HH');
});

test('normalizePeruPhone and validateLogin enforce clean formats', () => {
    const p1 = normalizePeruPhone('+51 987 654 321');
    assert(p1.ok && p1.phone === '987654321', 'Should normalize +51 Peruvian mobile');
    const pBad = normalizePeruPhone('12345');
    assert(!pBad.ok, 'Short phone must fail');

    const emailRes = validateLogin({ email: 'valeria@utp.edu.pe', password: 'secret' });
    assert(emailRes.ok && emailRes.userUni === 'UTP' && emailRes.userName === 'Valeria', 'Email login failed');
    const emptyPass = validateLogin({ email: 'valeria@utp.edu.pe', password: '' });
    assert(!emptyPass.ok, 'Empty password must fail');
});

test('validateRegistration enforces explicit gender, phone, email, and password', () => {
    const missingGender = validateRegistration({
        name: 'Camila S.',
        gender: '',
        phone: '987654321',
        email: 'c@ucsm.edu.pe',
        password: 'password1'
    });
    assert(!missingGender.ok, 'Unselected gender must fail');

    const missingPhone = validateRegistration({
        name: 'Camila S.',
        gender: 'F',
        phone: '',
        email: 'c@ucsm.edu.pe',
        password: 'password1'
    });
    assert(!missingPhone.ok, 'Missing phone must fail');

    const valid = validateRegistration({
        name: 'Camila S.',
        gender: 'F',
        phone: '987654321',
        email: 'c@ucsm.edu.pe',
        password: 'password1'
    });
    assert(valid.ok && valid.userUni === 'UCSM' && valid.userGender === 'F' && valid.userPhone === '987654321', 'Valid registration failed');
});

test('canUseWomenOnlyFilter only permits F gender', () => {
    assert(canUseWomenOnlyFilter('F') === true, 'F should be allowed');
    assert(canUseWomenOnlyFilter('M') === false, 'M must not be allowed');
});

test('haversineMeters and findNearestOriginKey identify UTP accurately', () => {
    const utpCoords = PLACES_AQP.origins.utp.coords;
    const distSelf = haversineMeters(utpCoords, utpCoords);
    assert(distSelf === 0, 'Distance to self must be 0');
    const nearest = findNearestOriginKey([-16.4091, -71.5433], PLACES_AQP.origins);
    assert(nearest && nearest.key === 'utp' && nearest.distanceMeters < 50, 'Nearest should be UTP');
    assert(formatDistanceLabel(240) === '240 M', 'Meters format mismatch');
    assert(formatDistanceLabel(1500) === '1.5 KM', 'KM format mismatch');
    assert(toWktPoint([-16.4090, -71.5432]) === 'SRID=4326;POINT(-71.5432 -16.409)', 'WKT Point mismatch');
    assert(toWktLineString([[-16.409, -71.543], [-16.372, -71.559]]) === 'SRID=4326;LINESTRING(-71.543 -16.409, -71.559 -16.372)', 'WKT LineString mismatch');
});

test('filterMatchCandidates enforces dismissed list and women-only guard', () => {
    const users = [
        { id: '1', gender: 'F' },
        { id: '2', gender: 'M' },
        { id: '3', gender: 'F' }
    ];
    const fFiltered = filterMatchCandidates(users, { dismissedUserIds: ['3'], womenOnly: true, userGender: 'F' });
    assert(fFiltered.length === 1 && fFiltered[0].id === '1', 'Women-only filter failed for F user');

    const mBypassAttempt = filterMatchCandidates(users, { dismissedUserIds: [], womenOnly: true, userGender: 'M' });
    assert(mBypassAttempt.length === 3, 'M user should not filter women-only');
});

test('parsePlaceLabel separates district and street', () => {
    const parsed = parsePlaceLabel({ name: 'CERRO COLORADO (AV. AVIACIÓN)' });
    assert(parsed.district === 'CERRO COLORADO' && parsed.street === 'AV. AVIACIÓN', 'Parse place failed');
});

test('tripRules handles timer formatting, 5m no-show unlock, penalty, and stats', () => {
    assert(formatClock(900) === '15:00', 'Expected 15:00');
    const locked = getNoShowState(750);
    assert(!locked.unlocked && locked.formattedLockCountdown === '02:30', 'Should be locked at 750s');
    const unlocked = getNoShowState(600);
    assert(unlocked.unlocked && unlocked.formattedLockCountdown === '00:00', 'Should unlock at 600s');
    assert(applyNoShowPenalty('98%') === '83%', 'Penalty math failed');
    const nextStats = incrementCompletedTripStats({ rating: 5.0, punctuality: 100, trips: 2 });
    assert(nextStats.trips === 3, 'Trips should increment');
});

test('whatsapp helper builds shareable safety message, GPS, SOS, and URL', () => {
    const msg = buildWhatsAppSafetyMessage({
        userName: 'Hugo H.',
        partner: { name: 'Valeria R.', uni: 'UTP', rating: '4.9' },
        originName: 'UTP',
        destName: 'CERRO COLORADO',
        rideShareLink: 'https://uber.com/trip/123',
        gpsLocationUrl: 'https://maps.google.com/?q=-16.409,-71.543'
    });
    assert(msg.includes('Valeria R.') && msg.includes('UTP → CERRO COLORADO'), 'WA message missing fields');
    assert(msg.includes('https://uber.com/trip/123') && msg.includes('maps.google.com'), 'WA message missing ride/GPS link');
    const sos = buildEmergencySosMessage({
        userName: 'Hugo H.',
        partner: { name: 'Valeria R.', uni: 'UTP' },
        originName: 'UTP',
        destName: 'CERRO COLORADO',
        gpsLocationUrl: 'https://maps.google.com/?q=-16.409,-71.543'
    });
    assert(sos.includes('ALERTA DE SEGURIDAD') && sos.includes('maps.google.com'), 'SOS message invalid');
    const url = buildWhatsAppShareUrl(msg);
    assert(url.startsWith('https://wa.me/?text='), 'WA URL invalid');
});

summaryEl.textContent = `Total: ${passed + failed} | Pasaron: ${passed} | Fallaron: ${failed}`;
summaryEl.style.borderColor = failed === 0 ? '#52e39a' : '#FA4A19';

