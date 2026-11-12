import { isSupabaseConfigured } from '../config/supabaseConfig.js';
import { createInitialsAvatarDataUrl } from '../ui/utils/dom.js';
import { getSupabaseClient } from './supabaseClient.js';
import { storageService } from './storageService.js';

export const tripService = {
    async subscribeToTrip({ tripId, currentUserId, onMessage, onTripStatusChange }) {
        if (!isSupabaseConfigured() || !tripId) return () => {};

        const supabase = await getSupabaseClient();
        if (!supabase) return () => {};

        const { data: history } = await supabase
            .from('chat_messages')
            .select('id, sender_id, body, created_at')
            .eq('trip_id', tripId)
            .order('created_at', { ascending: true });

        (history || []).forEach((msg) => {
            onMessage({
                id: msg.id,
                text: msg.body,
                sender: msg.sender_id === currentUserId ? 'me' : 'partner'
            });
        });

        const channel = supabase.channel(`trip-room-${tripId}`);

        channel.on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `trip_id=eq.${tripId}` },
            (payload) => {
                const msg = payload.new;
                if (!msg || msg.sender_id === currentUserId) return;
                onMessage({
                    id: msg.id,
                    text: msg.body,
                    sender: 'partner'
                });
            }
        );

        channel.on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'trips', filter: `id=eq.${tripId}` },
            (payload) => {
                if (payload.new?.status) {
                    onTripStatusChange(payload.new.status);
                }
            }
        );

        channel.subscribe();
        return () => {
            supabase.removeChannel(channel);
        };
    },

    async sendChatMessage({ tripId, senderId, body }) {
        if (!isSupabaseConfigured() || !tripId) {
            return { ok: true };
        }

        const supabase = await getSupabaseClient();
        if (!supabase) return { ok: false, error: 'SUPABASE NO DISPONIBLE' };

        const { error } = await supabase
            .from('chat_messages')
            .insert({ trip_id: tripId, sender_id: senderId, body });

        if (error) {
            return { ok: false, error: error.message.toUpperCase() };
        }
        return { ok: true };
    },

    async confirmMeetup({ tripId }) {
        if (!isSupabaseConfigured() || !tripId) {
            return { ok: true };
        }

        const supabase = await getSupabaseClient();
        if (!supabase) return { ok: false, error: 'SUPABASE NO DISPONIBLE' };

        const { error } = await supabase.rpc('start_trip_ride', { p_trip_id: tripId });
        if (error) {
            return { ok: false, error: error.message.toUpperCase() };
        }
        return { ok: true };
    },

    async cancelTrip({ tripId }) {
        if (!isSupabaseConfigured() || !tripId) return;
        const supabase = await getSupabaseClient();
        if (!supabase) return;

        await supabase.rpc('cancel_active_trip', { p_trip_id: tripId });
    },

    async reportNoShow({ tripId }) {
        if (!isSupabaseConfigured() || !tripId) {
            return { ok: true, mode: 'demo' };
        }

        const supabase = await getSupabaseClient();
        if (!supabase) return { ok: false, error: 'SUPABASE NO DISPONIBLE' };

        const { data: newPct, error } = await supabase.rpc('report_trip_noshow', { p_trip_id: tripId });
        if (error) {
            return { ok: false, error: error.message.toUpperCase() };
        }

        return { ok: true, mode: 'cloud', newPunctuality: `${newPct}%` };
    },

    async submitReview({ tripId, reviewerId, reviewedId, stars, comment }) {
        if (!isSupabaseConfigured() || !tripId) {
            storageService.appendReview({
                partnerId: reviewedId,
                stars,
                comment
            });
            storageService.clearPendingSurvey();
            return { ok: true };
        }

        const supabase = await getSupabaseClient();
        if (!supabase) return { ok: false, error: 'SUPABASE NO DISPONIBLE' };

        const { error } = await supabase
            .from('trip_reviews')
            .insert({
                trip_id: tripId,
                reviewer_id: reviewerId,
                reviewed_id: reviewedId,
                stars,
                comment
            });

        if (error) {
            return { ok: false, error: error.message.toUpperCase() };
        }
        return { ok: true };
    },

    async getPendingSurvey() {
        if (!isSupabaseConfigured()) {
            return storageService.getPendingSurvey();
        }

        const supabase = await getSupabaseClient();
        if (!supabase) return null;

        const { data, error } = await supabase.rpc('get_pending_survey_details');
        if (error) return null;

        const row = Array.isArray(data) ? data[0] : data;
        if (!row) return null;

        return {
            tripId: row.trip_id,
            partnerId: row.partner_id,
            partnerName: row.partner_name,
            partnerUni: row.partner_uni || 'AQP',
            partnerAvatar: createInitialsAvatarDataUrl(row.partner_name),
            originName: row.origin_name,
            destName: row.dest_name
        };
    }
};

