import { formatClock, getNoShowState } from '../../domain/tripRules.js';

export function setupChatView({ onFastForward5m, onSendMessage, onCancelMatch, onReportNoShow, onConfirmMeetup, isCloudMode = false }) {
    const chatMessages = document.getElementById('chat-messages');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const quickChips = document.querySelectorAll('[data-chat-chip]');
    const fastForwardBtn = document.getElementById('fast-forward-5m-btn');
    const cancelBtn = document.getElementById('cancel-match-btn');
    const noShowBtn = document.getElementById('noshow-btn');
    const confirmMeetupBtn = document.getElementById('confirm-meetup-btn');

    if (isCloudMode && fastForwardBtn) {
        fastForwardBtn.classList.add('hidden');
    }

    quickChips.forEach((chip) => {
        chip.addEventListener('click', () => {
            const text = chip.getAttribute('data-chat-chip');
            if (text) onSendMessage(text);
        });
    });

    chatForm?.addEventListener('submit', (event) => {
        event.preventDefault();
        const text = (chatInput?.value || '').trim();
        if (!text) return;
        if (chatInput) chatInput.value = '';
        onSendMessage(text);
    });

    fastForwardBtn?.addEventListener('click', onFastForward5m);
    cancelBtn?.addEventListener('click', onCancelMatch);
    noShowBtn?.addEventListener('click', onReportNoShow);
    confirmMeetupBtn?.addEventListener('click', onConfirmMeetup);

    return {
        open(partner) {
            const avatarEl = document.getElementById('chat-partner-avatar');
            const nameEl = document.getElementById('chat-partner-name');
            const uniEl = document.getElementById('chat-partner-uni');
            const metaEl = document.getElementById('chat-partner-meta');

            if (avatarEl) avatarEl.src = partner.avatar;
            if (nameEl) nameEl.textContent = partner.name.toUpperCase();
            if (uniEl) uniEl.textContent = `🎓 ${partner.uni}`;
            if (metaEl) metaEl.textContent = `⭐ ${partner.rating} • ${partner.punctuality} PUNTUALIDAD`;
            if (chatMessages) chatMessages.innerHTML = '';
        },

        appendBubble(text, sender) {
            if (!chatMessages) return;
            const isMe = sender === 'me';

            const wrapper = document.createElement('div');
            wrapper.className = `flex ${isMe ? 'justify-end' : 'justify-start'} animate-pop`;

            const bubble = document.createElement('div');
            bubble.className = isMe
                ? 'max-w-[80%] bg-sup-green text-sup-cream border-2 border-sup-green shadow-hard-sm rounded-lg rounded-br-none px-3 py-2 text-xs font-medium'
                : 'max-w-[80%] bg-white text-sup-green border-2 border-sup-green shadow-hard-sm rounded-lg rounded-bl-none px-3 py-2 text-xs font-medium';
            bubble.textContent = text;

            wrapper.appendChild(bubble);
            chatMessages.appendChild(wrapper);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        },

        setTyping(isTyping, partnerName = '') {
            const indicator = document.getElementById('typing-indicator');
            const typingName = document.getElementById('typing-name');
            if (typingName && partnerName) {
                typingName.textContent = `${partnerName.toUpperCase()} ESTÁ ESCRIBIENDO...`;
            }
            if (indicator) {
                indicator.classList.toggle('hidden', !isTyping);
            }
        },

        updateTimers(secondsRemaining) {
            const timerEl = document.getElementById('match-timer');
            if (timerEl) timerEl.textContent = formatClock(secondsRemaining);

            const { unlocked, formattedLockCountdown } = getNoShowState(secondsRemaining);
            const lockHint = document.getElementById('noshow-lock-hint');
            const countdownText = document.getElementById('noshow-countdown-text');

            if (countdownText) countdownText.textContent = formattedLockCountdown;
            if (lockHint) lockHint.classList.toggle('hidden', unlocked);
            if (noShowBtn) {
                noShowBtn.disabled = !unlocked;
                noShowBtn.className = unlocked
                    ? 'btn-brutal-sm col-span-4 bg-sup-yellow hover:bg-sup-orange hover:text-white text-sup-green font-bold text-[9px] uppercase py-2 rounded-sm cursor-pointer'
                    : 'btn-brutal-sm col-span-4 bg-sup-cream text-sup-green/40 font-bold text-[9px] uppercase py-2 rounded-sm cursor-not-allowed';
            }
        }
    };
}

