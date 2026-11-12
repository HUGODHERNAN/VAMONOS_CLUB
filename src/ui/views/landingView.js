import { detectUniFromEmail } from '../../domain/auth.js';

export function setupLandingView({ onSwitchMode, onEnterApp, onForgotPassword, onSaveNewPassword }) {
    const loginTabBtn = document.getElementById('tab-login-btn');
    const regTabBtn = document.getElementById('tab-register-btn');
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
        const activeCls = 'px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider border-2 border-sup-green bg-sup-green text-sup-cream transition-colors';
        const idleCls = 'px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider border-2 border-sup-green bg-white text-sup-green hover:bg-sup-creamDark transition-colors';

        confirmBox?.classList.add('hidden');
        recoveryBox?.classList.add('hidden');

        if (mode === 'login') {
            if (loginTabBtn) loginTabBtn.className = activeCls;
            if (regTabBtn) regTabBtn.className = idleCls;
            loginBox?.classList.remove('hidden');
            regBox?.classList.add('hidden');
        } else {
            if (regTabBtn) regTabBtn.className = activeCls;
            if (loginTabBtn) loginTabBtn.className = idleCls;
            regBox?.classList.remove('hidden');
            loginBox?.classList.add('hidden');
        }
    }

    function showEmailConfirmationStep(email) {
        if (confirmTargetEmail) confirmTargetEmail.textContent = email;
        loginBox?.classList.add('hidden');
        regBox?.classList.add('hidden');
        recoveryBox?.classList.add('hidden');
        confirmBox?.classList.remove('hidden');
    }

    function hideEmailConfirmationStep() {
        confirmBox?.classList.add('hidden');
    }

    function showPasswordRecoveryStep() {
        loginBox?.classList.add('hidden');
        regBox?.classList.add('hidden');
        confirmBox?.classList.add('hidden');
        if (newPasswordInput) newPasswordInput.value = '';
        recoveryBox?.classList.remove('hidden');
        newPasswordInput?.focus();
    }

    function switchTo(mode) {
        hideEmailConfirmationStep();
        applyAuthModeUI(mode);
        onSwitchMode(mode);
    }

    loginTabBtn?.addEventListener('click', () => switchTo('login'));
    regTabBtn?.addEventListener('click', () => switchTo('register'));
    switchToRegisterBtn?.addEventListener('click', () => switchTo('register'));
    changeEmailBtn?.addEventListener('click', () => switchTo('register'));
    backToLoginBtn?.addEventListener('click', () => switchTo('login'));

    function submitAuthForm(mode) {
        if (mode === 'login') {
            onSwitchMode('login');
        } else {
            onSwitchMode('register');
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

    return {
        applyAuthModeUI,
        showEmailConfirmationStep,
        hideEmailConfirmationStep,
        showPasswordRecoveryStep
    };
}
