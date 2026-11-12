import { isSupabaseConfigured } from '../config/supabaseConfig.js';
import { toWktLineString, toWktPoint } from '../domain/geo.js';
import { filterMatchCandidates, parsePlaceLabel } from '../domain/matching.js';
import { createInitialsAvatarDataUrl } from '../ui/utils/dom.js';
import { getSupabaseClient } from './supabaseClient.js';

function mapCloudMatchRow(row) {
    const { district, street } = parsePlaceLabel({ name: row.dest_name });
    const isSame = row.match_type === 'same';

    return {
        id: row.user_id,
        intentId: row.intent_id,
        name: row.short_name,
        gender: row.gender,
        uni: row.uni_code || 'AQP',
        emailDomain: row.uni_verified ? `@${(row.uni_code || 'aqp').toLowerCase()}.edu.pe` : 'Pasajero AQP',
        rating: Number(row.rating_avg ?? 5.0).toFixed(1),
        trips: Number(row.trips_count ?? 0),
        punctuality: `${row.punctuality_pct ?? 100}%`,
        avatar: createInitialsAvatarDataUrl(row.short_name),
        matchType: row.match_type,
        distanceMeters: row.distance_meters ?? 150,
        payment: row.payment_method,
        departure: row.departure_window,
        sharedPercent: isSame ? '100% MISMA RUTA' : `${row.shared_percent || 65}% EN TU RUTA (DE PASO)`,
        stopDistrict: district,
        stopStreet: street,
        bio: `Sale ${row.departure_window.toLowerCase()} • Divide con ${row.payment_method}.`,
        replies: []
    };
}

export const radarService = {
    async publishAndSearch({
        userId,
        originKey,
        destKey,
        originName,
        destName,
        originCoords,
        destCoords,
        routeCoords,
        departureTime,
        paymentMethod,
        womenOnly,
        userGender,
        mockCandidates,
        dismissedUserIds
    }) {
        if (!isSupabaseConfigured()) {
            const filtered = filterMatchCandidates(mockCandidates, {
                dismissedUserIds,
                womenOnly,
                userGender
            });
            return { ok: true, mode: 'demo', intentId: null, candidates: filtered };
        }

        const supabase = await getSupabaseClient();
        if (!supabase) {
            return { ok: false, error: 'NO SE PUDO CONECTAR CON SUPABASE' };
        }

        // Cerrar intenciones anteriores del usuario antes de publicar la nueva
        await supabase
            .from('ride_intents')
            .update({ status: 'cancelled' })
            .eq('user_id', userId)
            .eq('status', 'searching');

        const wktRoute = toWktLineString(routeCoords) || toWktLineString([originCoords, destCoords]);

        const { data: inserted, error: insertError } = await supabase
            .from('ride_intents')
            .insert({
                user_id: userId,
                origin_key: originKey,
                dest_key: destKey,
                origin_name: originName,
                dest_name: destName,
                origin_point: toWktPoint(originCoords),
                dest_point: toWktPoint(destCoords),
                route_polyline: wktRoute,
                departure_window: departureTime,
                payment_method: paymentMethod,
                women_only: Boolean(womenOnly && userGender === 'F')
            })
            .select('id')
            .single();

        if (insertError || !inserted) {
            return {
                ok: false,
                error: (insertError?.message || 'NO SE PUDO PUBLICAR TU RUTA').toUpperCase()
            };
        }

        const { data: matches, error: rpcError } = await supabase
            .rpc('find_matching_rides', { p_intent_id: inserted.id });

        if (rpcError) {
            return { ok: false, error: rpcError.message.toUpperCase() };
        }

        const mapped = (matches || [])
            .map(mapCloudMatchRow)
            .filter((u) => !dismissedUserIds.includes(u.id));

        return { ok: true, mode: 'cloud', intentId: inserted.id, candidates: mapped };
    },

    async cancelActiveIntent(intentId) {
        if (!intentId || !isSupabaseConfigured()) return;
        const supabase = await getSupabaseClient();
        if (!supabase) return;

        await supabase
            .from('ride_intents')
            .update({ status: 'cancelled' })
            .eq('id', intentId);
    }
};

