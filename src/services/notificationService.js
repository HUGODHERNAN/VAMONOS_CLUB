let audioCtx = null;

function getAudioContext() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioCtx) {
        audioCtx = new AudioCtx();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
    }
    return audioCtx;
}

/**
 * Plays a short retro chime using Web Audio API without external audio files.
 * @param {'request'|'match'|'message'} kind
 */
export function playAlertSound(kind = 'request') {
    try {
        const ctx = getAudioContext();
        if (!ctx) return;

        const sequences = {
            request: [587.33, 880],
            match: [523.25, 659.25, 783.99],
            message: [698.46]
        };

        const notes = sequences[kind] || sequences.message;
        const start = ctx.currentTime;

        notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, start + idx * 0.11);

            gain.gain.setValueAtTime(0.001, start + idx * 0.11);
            gain.gain.exponentialRampToValueAtTime(0.12, start + idx * 0.11 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, start + idx * 0.11 + 0.18);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(start + idx * 0.11);
            osc.stop(start + idx * 0.11 + 0.19);
        });
    } catch {
        // Ignore audio restrictions if user hasn't interacted yet
    }
}

export const notificationService = {
    async requestPermission() {
        if (typeof Notification === 'undefined') return 'unsupported';
        if (Notification.permission === 'granted' || Notification.permission === 'denied') {
            return Notification.permission;
        }
        try {
            return await Notification.requestPermission();
        } catch {
            return 'default';
        }
    },

    async notify({ title, body, tag = 'vamonos-alert', kind = 'request', onlyWhenHidden = false }) {
        playAlertSound(kind);

        if (navigator.vibrate) {
            navigator.vibrate(kind === 'request' ? [140, 80, 140] : [90]);
        }

        if (onlyWhenHidden && !document.hidden) return;
        if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

        const options = {
            body,
            tag,
            icon: './assets/icons/icon-192.png',
            badge: './assets/icons/icon-192.png',
            renotify: true
        };

        try {
            if ('serviceWorker' in navigator) {
                const reg = await navigator.serviceWorker.ready;
                if (reg?.showNotification) {
                    await reg.showNotification(title, options);
                    return;
                }
            }
            new Notification(title, options);
        } catch {
            // Ignore OS notification failures silently
        }
    }
};

