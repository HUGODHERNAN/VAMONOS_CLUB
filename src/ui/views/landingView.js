import { detectUniFromEmail } from '../../domain/auth.js';

export function setupLandingView({ onSwitchMode, onEnterApp, onForgotPassword, onSaveNewPassword }) {
    const loginTabBtn = document.getElementById('tab-login-btn');
    const regTabBtn = document.getElementById('tab-register-btn');
    const loginChevron = document.getElementById('login-chevron');
    const regChevron = document.getElementById('register-chevron');
    const loginBox = document.getElementById('auth-login-box');
    const regBox = document.getElementById('auth-register-box');
    const confirmBox = document.getElementById('email-confirmation-box');
    const confirmTargetEmail = document.getElementById('confirm-target-email');
    const changeEmailBtn = document.getElementById('change-email-btn');
    const backToLoginBtn = document.getElementById('back-to-login-btn');
    const recoveryBox = document.getElementById('password-recovery-box');
    const newPasswordInput = document.getElementById('new-password-input');

    const loginEmailInput = document.getElementById('login-email');
    const loginPasswordInput = document.getElementById('login-password');
    const forgotPasswordBtn = document.getElementById('forgot-password-btn');
    const switchToRegisterBtn = document.getElementById('switch-to-register-btn');

    const regNameInput = document.getElementById('reg-name');
    const regGenderSelect = document.getElementById('reg-gender');
    const regPhoneInput = document.getElementById('reg-phone');
    const regEmailInput = document.getElementById('reg-email');
    const regPasswordInput = document.getElementById('reg-password');

    function renderDomainFeedback(inputEl, feedbackId) {
        const feedback = document.getElementById(feedbackId);
        if (!inputEl || !feedback) return;

        const detected = detectUniFromEmail(inputEl.value);
        if (detected) {
            feedback.innerHTML = `<span class="inline-flex items-center gap-1.5 bg-[#1E7A50] text-white border-2 border-sup-green shadow-hard-sm px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide">✅ Dominio ${detected} detectado • Insignia 🎓 Verificada</span>`;
            feedback.classList.remove('hidden');
        } else {
            feedback.classList.add('hidden');
            feedback.innerHTML = '';
        }
    }

    function applyAuthModeUI(mode) {
        confirmBox?.classList.add('hidden');
        recoveryBox?.classList.add('hidden');

        if (mode === 'login') {
            loginBox?.classList.remove('hidden');
            regBox?.classList.add('hidden');
            if (loginChevron) loginChevron.textContent = '▲';
            if (regChevron) regChevron.textContent = '▼';
        } else if (mode === 'register') {
            regBox?.classList.remove('hidden');
            loginBox?.classList.add('hidden');
            if (regChevron) regChevron.textContent = '▲';
            if (loginChevron) loginChevron.textContent = '▼';
        } else {
            loginBox?.classList.add('hidden');
            regBox?.classList.add('hidden');
            if (loginChevron) loginChevron.textContent = '▼';
            if (regChevron) regChevron.textContent = '▼';
        }
    }

    function showEmailConfirmationStep(email) {
        if (confirmTargetEmail) confirmTargetEmail.textContent = email;
        loginBox?.classList.add('hidden');
        regBox?.classList.add('hidden');
        if (loginChevron) loginChevron.textContent = '▼';
        if (regChevron) regChevron.textContent = '▼';
        recoveryBox?.classList.add('hidden');
        confirmBox?.classList.remove('hidden');
    }

    function hideEmailConfirmationStep() {
        confirmBox?.classList.add('hidden');
    }

    function showPasswordRecoveryStep() {
        loginBox?.classList.add('hidden');
        regBox?.classList.add('hidden');
        if (loginChevron) loginChevron.textContent = '▼';
        if (regChevron) regChevron.textContent = '▼';
        confirmBox?.classList.add('hidden');
        if (newPasswordInput) newPasswordInput.value = '';
        recoveryBox?.classList.remove('hidden');
        newPasswordInput?.focus();
    }

    function toggleMode(targetMode) {
        hideEmailConfirmationStep();
        const isLoginOpen = loginBox && !loginBox.classList.contains('hidden');
        const isRegOpen = regBox && !regBox.classList.contains('hidden');

        if (targetMode === 'login') {
            if (isLoginOpen) {
                applyAuthModeUI(null);
            } else {
                applyAuthModeUI('login');
                onSwitchMode?.('login');
                loginEmailInput?.focus();
            }
        } else if (targetMode === 'register') {
            if (isRegOpen) {
                applyAuthModeUI(null);
            } else {
                applyAuthModeUI('register');
                onSwitchMode?.('register');
                regNameInput?.focus();
            }
        }
    }

    loginTabBtn?.addEventListener('click', () => toggleMode('login'));
    regTabBtn?.addEventListener('click', () => toggleMode('register'));
    switchToRegisterBtn?.addEventListener('click', () => {
        hideEmailConfirmationStep();
        applyAuthModeUI('register');
        onSwitchMode?.('register');
        regNameInput?.focus();
    });
    changeEmailBtn?.addEventListener('click', () => {
        hideEmailConfirmationStep();
        applyAuthModeUI('register');
        onSwitchMode?.('register');
        regEmailInput?.focus();
    });
    backToLoginBtn?.addEventListener('click', () => {
        hideEmailConfirmationStep();
        applyAuthModeUI('login');
        onSwitchMode?.('login');
        loginEmailInput?.focus();
    });

    function submitAuthForm(mode) {
        if (mode === 'login') {
            onSwitchMode?.('login');
        } else {
            onSwitchMode?.('register');
        }
        onEnterApp({
            loginEmail: loginEmailInput?.value || '',
            loginPassword: loginPasswordInput?.value || '',
            regName: regNameInput?.value || '',
            regGender: regGenderSelect?.value || '',
            regPhone: regPhoneInput?.value || '',
            regEmail: regEmailInput?.value || '',
            regPassword: regPasswordInput?.value || ''
        });
    }

    loginBox?.addEventListener('submit', (event) => {
        event.preventDefault();
        submitAuthForm('login');
    });

    regBox?.addEventListener('submit', (event) => {
        event.preventDefault();
        submitAuthForm('register');
    });

    forgotPasswordBtn?.addEventListener('click', () => {
        onForgotPassword?.(loginEmailInput?.value || '');
    });

    recoveryBox?.addEventListener('submit', (event) => {
        event.preventDefault();
        onSaveNewPassword?.(newPasswordInput?.value || '');
    });

    loginEmailInput?.addEventListener('input', () => renderDomainFeedback(loginEmailInput, 'login-domain-feedback'));
    regEmailInput?.addEventListener('input', () => renderDomainFeedback(regEmailInput, 'reg-domain-feedback'));

    // Configurar Banner dinámico con animación derecha a izquierda y 3s de pausa
    setupPhraseBannerTicker();

    return {
        applyAuthModeUI,
        showEmailConfirmationStep,
        hideEmailConfirmationStep,
        showPasswordRecoveryStep
    };
}

function setupPhraseBannerTicker() {
    const slideContainer = document.getElementById('phrase-slide-container');
    const bannerDotsContainer = document.getElementById('banner-dots');
    if (!slideContainer) return;

    const BANNER_PHRASES = [
        {
            dotClass: 'bg-sup-orange',
            html: '<span class="w-2.5 h-2.5 rounded-full bg-sup-orange border border-sup-green shrink-0"></span><span>🎓 Estudiantes Verificados (UTP, UNSA, UCSM, SENATI, TECSUP, USMP)</span>'
        },
        {
            dotClass: 'bg-sup-yellow',
            html: '<span class="w-2.5 h-2.5 rounded-full bg-sup-yellow border border-sup-green shrink-0"></span><span>📍 Radio Privado 1000m + Filtro Solo Mujeres ♀</span>'
        },
        {
            dotClass: 'bg-[#1E7A50]',
            html: '<span class="w-2.5 h-2.5 rounded-full bg-[#1E7A50] border border-sup-green shrink-0"></span><span>🚕 Uber / InDrive • Divide la tarifa sin comisiones</span>'
        }
    ];

    let currentIndex = 0;

    function updateDots(activeIdx) {
        if (!bannerDotsContainer) return;
        const dots = bannerDotsContainer.querySelectorAll('span');
        dots.forEach((dot, idx) => {
            if (idx === activeIdx) {
                dot.className = `h-2 rounded-full border border-sup-green transition-all duration-300 w-4 ${BANNER_PHRASES[idx].dotClass}`;
            } else {
                dot.className = 'w-2 h-2 rounded-full border border-sup-green bg-sup-creamDark transition-all duration-300';
            }
        });
    }

    function renderActivePhrase(idx) {
        slideContainer.innerHTML = `<span class="flex items-center justify-center gap-2 text-[11px] sm:text-xs font-bold text-sup-green leading-snug">${BANNER_PHRASES[idx].html}</span>`;
        updateDots(idx);
    }

    renderActivePhrase(0);

    function scheduleNextSlide() {
        setTimeout(() => {
            if (!document.getElementById('phrase-slide-container')) return;

            // 1. Salida hacia la izquierda
            slideContainer.style.transition = 'transform 450ms cubic-bezier(0.4, 0, 0.2, 1), opacity 450ms ease-in';
            slideContainer.style.transform = 'translateX(-50px)';
            slideContainer.style.opacity = '0';

            setTimeout(() => {
                if (!document.getElementById('phrase-slide-container')) return;

                // 2. Cambiar a la siguiente frase y colocar a la derecha sin transición
                currentIndex = (currentIndex + 1) % BANNER_PHRASES.length;
                renderActivePhrase(currentIndex);

                slideContainer.style.transition = 'none';
                slideContainer.style.transform = 'translateX(50px)';
                slideContainer.style.opacity = '0';

                // 3. Forzar reflow y deslizar suavemente desde la derecha hacia el centro
                requestAnimationFrame(() => {
                    setTimeout(() => {
                        if (!document.getElementById('phrase-slide-container')) return;
                        slideContainer.style.transition = 'transform 450ms cubic-bezier(0.16, 1, 0.3, 1), opacity 450ms ease-out';
                        slideContainer.style.transform = 'translateX(0)';
                        slideContainer.style.opacity = '1';

                        // 4. Pausar 3 segundos para lectura y pasar a la siguiente frase
                        scheduleNextSlide();
                    }, 40);
                });
            }, 450);
        }, 3000);
    }

    scheduleNextSlide();
}
