import { isSupabaseConfigured } from '../config/supabaseConfig.js';
import { createInitialsAvatarDataUrl } from '../ui/utils/dom.js';
import { getSupabaseClient } from './supabaseClient.js';

export const matchService = {
    async sendMatchRequest({ requesterId, targetUser, requesterIntentId }) {
        if (!isSupabaseConfigured()) {
            return { ok: true, mode: 'demo', requestId: `demo-req-${Date.now()}` };
        }

        const supabase = await getSupabaseClient();
        if (!supabase) return { ok: false, error: 'SUPABASE NO DISPONIBLE' };

        const { data, error } = await supabase
            .from('match_requests')
            .insert({
                requester_id: requesterId,
                target_id: targetUser.id,
                requester_intent_id: requesterIntentId,
                target_intent_id: targetUser.intentId
            })
            .select('id, expires_at')
            .single();

        if (error || !data) {
            return { ok: false, error: (error?.message || 'ERROR AL ENVIAR SOLICITUD').toUpperCase() };
        }

        return { ok: true, mode: 'cloud', requestId: data.id, expiresAt: data.expires_at };
    },

    async cancelMatchRequest(requestId) {
        if (!requestId || !isSupabaseConfigured()) return;
        const supabase = await getSupabaseClient();
        if (!supabase) return;

        await supabase
            .from('match_requests')
            .update({ status: 'cancelled' })
            .eq('id', requestId)
            .eq('status', 'pending');
    },

    async acceptIncomingRequest(requestId) {
        const supabase = await getSupabaseClient();
        if (!supabase) return { ok: false, error: 'SUPABASE NO DISPONIBLE' };

        const { data: tripId, error } = await supabase
            .rpc('accept_match_request', { p_request_id: requestId });

        if (error || !tripId) {
            return { ok: false, error: (error?.message || 'NO SE PUDO ACEPTAR LA SOLICITUD').toUpperCase() };
        }

        return { ok: true, tripId };
    },

    async rejectIncomingRequest(requestId) {
        if (!requestId || !isSupabaseConfigured()) return;
        const supabase = await getSupabaseClient();
        if (!supabase) return;

        await supabase
            .from('match_requests')
            .update({ status: 'rejected' })
            .eq('id', requestId)
            .eq('status', 'pending');
    },

    async subscribeToMatchEvents({ userId, onIncomingRequest, onRequestClosed, onTripOpened }) {
        if (!isSupabaseConfigured() || !userId) return () => {};

        const supabase = await getSupabaseClient();
        if (!supabase) return () => {};

        const channel = supabase.channel(`match-events-${userId}`);

        channel.on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'match_requests', filter: `target_id=eq.${userId}` },
            async (payload) => {
                const reqId = payload.new?.id;
                if (!reqId) return;
                const { data } = await supabase.rpc('get_incoming_request_details', { p_request_id: reqId });
                const details = Array.isArray(data) ? data[0] : data;
                if (details) {
                    onIncomingRequest({
                        requestId: details.request_id,
                        requesterId: details.requester_id,
                        requesterName: details.requester_name,
                        requesterUni: details.requester_uni || 'AQP',
                        requesterRating: Number(details.requester_rating ?? 5.0).toFixed(1),
                        requesterPunctuality: `${details.requester_punctuality ?? 100}%`,
                        originName: details.origin_name,
                        destName: details.dest_name,
                        avatar: createInitialsAvatarDataUrl(details.requester_name),
                        expiresAt: details.expires_at
                    });
                }
            }
        );

        channel.on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'match_requests', filter: `requester_id=eq.${userId}` },
            (payload) => {
                const status = payload.new?.status;
                if (status === 'rejected' || status === 'expired') {
                    onRequestClosed(status);
                }
            }
        );

        const handleTripInsert = async (payload) => {
            const trip = payload.new;
            if (!trip || trip.status !== 'coordinating') return;
            const { data: partnerRows } = await supabase
                .rpc('get_trip_partner_profile', { p_trip_id: trip.id });
            const partnerRow = Array.isArray(partnerRows) ? partnerRows[0] : partnerRows;

            if (!partnerRow) return;

            onTripOpened({
                tripId: trip.id,
                originName: trip.origin_name,
                destName: trip.dest_name,
                chatExpiresAt: trip.chat_expires_at,
                noshowUnlockAt: trip.noshow_unlock_at,
                partner: {
                    id: partnerRow.id,
                    name: partnerRow.short_name,
                    uni: partnerRow.uni_code || 'AQP',
                    rating: Number(partnerRow.rating_avg ?? 5.0).toFixed(1),
                    trips: Number(partnerRow.trips_count ?? 0),
                    punctuality: `${partnerRow.punctuality_pct ?? 100}%`,
                    avatar: createInitialsAvatarDataUrl(partnerRow.short_name),
                    replies: []
                }
            });
        };

        channel.on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'trips', filter: `user_a_id=eq.${userId}` },
            handleTripInsert
        );
        channel.on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'trips', filter: `user_b_id=eq.${userId}` },
            handleTripInsert
        );

        channel.subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }
};

