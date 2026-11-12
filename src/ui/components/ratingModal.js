const RATING_LABELS = {
    1: '⭐ MUY MALA EXPERIENCIA',
    2: '⭐⭐ REGULAR / IMPUNTUAL',
    3: '⭐⭐⭐ ACEPTABLE',
    4: '⭐⭐⭐⭐ MUY BUEN COMPAÑERO',
    5: '⭐⭐⭐⭐⭐ ¡EXCELENTE COMPAÑERO!'
};

export function setupRatingModal({ onSelectRating, onSubmitSurvey }) {
    const modal = document.getElementById('rating-modal');
    const starBtns = document.querySelectorAll('.star-btn');
    const quickTags = document.querySelectorAll('[data-review-tag]');
    const commentInput = document.getElementById('rating-comment-input');
    const submitBtn = document.getElementById('submit-survey-btn');

    function paintStars(count) {
        starBtns.forEach((btn) => {
            const val = parseInt(btn.getAttribute('data-star'), 10);
            btn.className = val <= count
                ? 'star-btn w-10 h-10 rounded-md border-2 border-sup-green bg-sup-orange text-white font-display text-base shadow-hard-sm transition-transform active:translate-y-0.5'
                : 'star-btn w-10 h-10 rounded-md border-2 border-sup-green bg-white text-sup-green/40 font-display text-base shadow-hard-sm transition-transform active:translate-y-0.5';
        });
        const labelEl = document.getElementById('rating-star-label');
        if (labelEl) labelEl.textContent = RATING_LABELS[count] || RATING_LABELS[5];
    }

    starBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
            const count = parseInt(btn.getAttribute('data-star'), 10) || 5;
            paintStars(count);
            onSelectRating(count);
        });
    });

    quickTags.forEach((btn) => {
        btn.addEventListener('click', () => {
            const tag = btn.getAttribute('data-review-tag');
            if (!commentInput || !tag) return;
            const current = commentInput.value.trim();
            commentInput.value = current ? `${current}. ${tag}` : tag;
        });
    });

    submitBtn?.addEventListener('click', () => {
        const comment = (commentInput?.value || '').trim();
        onSubmitSurvey({ comment });
    });

    return {
        open(data, isEnforced = false) {
            const avatarEl = document.getElementById('rating-partner-avatar');
            const nameEl = document.getElementById('rating-partner-name');
            const uniEl = document.getElementById('rating-partner-uni');
            const alertBanner = document.getElementById('pending-survey-alert');

            if (avatarEl) avatarEl.src = data.partnerAvatar || '';
            if (nameEl) nameEl.textContent = (data.partnerName || 'Compañero').toUpperCase();
            if (uniEl) uniEl.textContent = `🎓 ${data.partnerUni || 'AQP'} VERIFICADO`;
            if (commentInput) commentInput.value = '';
            if (alertBanner) alertBanner.classList.toggle('hidden', !isEnforced);

            paintStars(5);
            onSelectRating(5);
            modal?.classList.remove('hidden');
        },
        close() {
            modal?.classList.add('hidden');
            document.getElementById('pending-survey-alert')?.classList.add('hidden');
        }
    };
}

