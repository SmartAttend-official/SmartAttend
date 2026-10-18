// Simple script to handle role tab switching animation
function switchRole(element) {
	const tabs = document.querySelectorAll('.role-tab');
	tabs.forEach(tab => tab.classList.remove('active'));
	element.classList.add('active');
}

// ── 2FA State ──
let _2fa_email = '';
let _2fa_timer = null;

// ── Authentication Logic ──
document.getElementById('loginForm').addEventListener('submit', async function (e) {
	e.preventDefault();

	const email = document.getElementById('emailInput').value;
	const password = document.getElementById('passwordInput').value;
	const errorDiv = document.getElementById('loginError');
	const loginBtn = document.getElementById('loginBtn');
	const btnText = document.getElementById('btnText');
	const btnIcon = document.getElementById('btnIcon');

	// Reset error
	errorDiv.style.display = 'none';
	errorDiv.innerText = '';

	// Show loading state
	loginBtn.disabled = true;
	btnText.innerText = 'Authorizing...';
	btnIcon.className = 'fa-solid fa-spinner fa-spin';
	loginBtn.style.opacity = '0.8';
	loginBtn.style.cursor = 'not-allowed';

	try {
		const SCRIPT_URL = window.SMART_ATTEND_CONFIG.SCRIPT_URL;
		const response = await fetch(SCRIPT_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'login', email, password, role: 'professor' })
		});

		if (!response.ok) {
			const errData = await response.json().catch(() => ({}));
			throw new Error(errData.message || 'Invalid email or password.');
		}

		const result = await response.json();

		// ── 2FA Required ──
		if (result.status === 'otp_required') {
			_2fa_email = result.email || email;
			show2FAPanel(_2fa_email);

			// Reset login button
			loginBtn.disabled = false;
			btnText.innerText = 'Sign In';
			btnIcon.className = 'fa-solid fa-arrow-right-to-bracket';
			loginBtn.style.opacity = '1';
			loginBtn.style.cursor = 'pointer';
			return;
		}

		const user = result.user;

		if (result.status === 'success' && result.token) {
			sessionStorage.setItem('smartattend_token', result.token);
			sessionStorage.setItem('isAuthenticated', 'true');
			sessionStorage.setItem('userEmail', email);
			sessionStorage.setItem('sessionToken', result.sessionToken);
			const firstName = user['Professor first_name'] || '';
			const lastName = user['Professor last_name'] || '';
			const fullName = (firstName + ' ' + lastName).trim() || user.Name || 'Professor';
			sessionStorage.setItem('userName', fullName);
			sessionStorage.setItem('userId', user['Professor id'] || '');

			// Visual Feedback
			btnText.innerText = 'Access Granted';
			btnIcon.className = 'fa-solid fa-check-double';
			loginBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
			loginBtn.style.boxShadow = '0 0 20px rgba(16, 185, 129, 0.4)';

			setTimeout(() => {
				window.location.replace('dashboard1.html');
			}, 2000);
		} else {
			// Invalid credentials
			errorDiv.innerText = 'Invalid email or password.';
			errorDiv.style.display = 'block';

			// Reset button state
			loginBtn.disabled = false;
			btnText.innerText = 'Sign In';
			btnIcon.className = 'fa-solid fa-arrow-right-to-bracket';
			loginBtn.style.opacity = '1';
			loginBtn.style.cursor = 'pointer';
		}

	} catch (error) {
		console.error("Login Error:", error);
		errorDiv.innerText = error.message || 'An error occurred during login. Please try again.';
		errorDiv.style.display = 'block';

		// Reset button state
		loginBtn.disabled = false;
		btnText.innerText = 'Sign In';
		btnIcon.className = 'fa-solid fa-arrow-right-to-bracket';
		loginBtn.style.opacity = '1';
		loginBtn.style.cursor = 'pointer';
	}
});

// ── Show 2FA OTP Panel ──
function show2FAPanel(email) {
	document.getElementById('loginForm').style.display = 'none';
	document.getElementById('loginError').style.display = 'none';
	document.getElementById('roleTabs').style.display = 'none';
	document.getElementById('formFooter').style.display = 'none';

	const otpEmailHint = document.getElementById('otpEmailHint');
	if (otpEmailHint) {
		const maskedEmail = email.replace(/(.{2}).+(@.+)/, '$1***$2');
		otpEmailHint.innerHTML = `Enter the 6-digit OTP sent to <strong>${maskedEmail}</strong>`;
	}

	const otpPanel = document.getElementById('otpPanel');
	otpPanel.style.display = 'flex';

	// Setup digit inputs
	setupOTPInputs();

	// Start 10-minute countdown
	startOtpCountdown(10 * 60);

	// Focus first input
	setTimeout(() => {
		const firstInput = document.getElementById('otp0');
		if (firstInput) firstInput.focus();
	}, 100);
}

// ── OTP Digit Input Auto-Advance ──
function setupOTPInputs() {
	for (let i = 0; i < 6; i++) {
		const inp = document.getElementById('otp' + i);
		if (!inp) continue;

		inp.addEventListener('input', function () {
			this.value = this.value.replace(/[^0-9]/g, '').slice(-1);
			this.classList.toggle('filled', this.value.length > 0);
			if (this.value && i < 5) {
				document.getElementById('otp' + (i + 1)).focus();
			}
			// Auto-verify when all filled
			const allFilled = [0,1,2,3,4,5].every(n => document.getElementById('otp'+n).value);
			if (allFilled) verify2FAOTP();
		});

		inp.addEventListener('keydown', function (e) {
			if (e.key === 'Backspace' && !this.value && i > 0) {
				document.getElementById('otp' + (i - 1)).focus();
			}
		});

		inp.addEventListener('paste', function (e) {
			e.preventDefault();
			const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
			for (let j = 0; j < pasted.length && j < 6; j++) {
				const el = document.getElementById('otp' + j);
				if (el) { el.value = pasted[j]; el.classList.add('filled'); }
			}
			if (pasted.length === 6) verify2FAOTP();
		});
	}
}

// ── OTP Countdown Timer ──
function startOtpCountdown(seconds) {
	if (_2fa_timer) clearInterval(_2fa_timer);
	const timerEl = document.getElementById('otpTimer');
	let remaining = seconds;

	_2fa_timer = setInterval(() => {
		remaining--;
		const m = Math.floor(remaining / 60).toString().padStart(2, '0');
		const s = (remaining % 60).toString().padStart(2, '0');
		if (timerEl) timerEl.innerHTML = `OTP valid for <strong>${m}:${s}</strong>`;
		if (remaining <= 0) {
			clearInterval(_2fa_timer);
			if (timerEl) timerEl.innerHTML = '<span style="color:#ef4444;">⚠️ OTP expired. Please request a new one.</span>';
		}
	}, 1000);
}

// ── Verify 2FA OTP ──
async function verify2FAOTP() {
	const otp = [0,1,2,3,4,5].map(i => (document.getElementById('otp'+i) || {value:''}).value).join('');
	const otpError = document.getElementById('otpError');
	const verifyBtn = document.getElementById('verifyOtpBtn');
	const verifyBtnText = document.getElementById('verifyBtnText');
	const verifyBtnIcon = document.getElementById('verifyBtnIcon');

	if (otp.length < 6) {
		otpError.innerText = 'Please enter all 6 digits.';
		otpError.style.display = 'block';
		return;
	}

	otpError.style.display = 'none';
	verifyBtn.disabled = true;
	verifyBtnText.innerText = 'Verifying...';
	verifyBtnIcon.className = 'fa-solid fa-spinner fa-spin';

	try {
		const SCRIPT_URL = window.SMART_ATTEND_CONFIG.SCRIPT_URL;
		const response = await fetch(SCRIPT_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'verify_login_otp', email: _2fa_email, otp })
		});

		const result = await response.json();

		if (result.status === 'success' && result.token) {
			const user = result.user || {};
			sessionStorage.setItem('smartattend_token', result.token);
			sessionStorage.setItem('isAuthenticated', 'true');
			sessionStorage.setItem('userEmail', _2fa_email);
			sessionStorage.setItem('sessionToken', result.sessionToken);
			const firstName = user['Professor first_name'] || '';
			const lastName = user['Professor last_name'] || '';
			const fullName = (firstName + ' ' + lastName).trim() || user.Name || 'Professor';
			sessionStorage.setItem('userName', fullName);
			sessionStorage.setItem('userId', user['Professor id'] || '');

			// Success animation
			verifyBtnText.innerText = 'Access Granted';
			verifyBtnIcon.className = 'fa-solid fa-check-double';
			verifyBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
			verifyBtn.style.boxShadow = '0 0 20px rgba(16, 185, 129, 0.4)';

			if (_2fa_timer) clearInterval(_2fa_timer);

			setTimeout(() => {
				window.location.replace('dashboard1.html');
			}, 1500);
		} else {
			otpError.innerText = result.message || 'Invalid OTP. Please try again.';
			otpError.style.display = 'block';
			// Shake effect
			[0,1,2,3,4,5].forEach(i => {
				const el = document.getElementById('otp'+i);
				if (el) { el.style.borderColor = '#ef4444'; el.value = ''; el.classList.remove('filled'); }
			});
			setTimeout(() => {
				[0,1,2,3,4,5].forEach(i => {
					const el = document.getElementById('otp'+i);
					if (el) el.style.borderColor = '';
				});
				document.getElementById('otp0').focus();
			}, 600);

			verifyBtn.disabled = false;
			verifyBtnText.innerText = 'Verify OTP';
			verifyBtnIcon.className = 'fa-solid fa-shield-halved';
		}
	} catch (err) {
		console.error('OTP Verify Error:', err);
		otpError.innerText = 'Network error. Please try again.';
		otpError.style.display = 'block';
		verifyBtn.disabled = false;
		verifyBtnText.innerText = 'Verify OTP';
		verifyBtnIcon.className = 'fa-solid fa-shield-halved';
	}
}

// ── Resend OTP ──
async function resendOTP() {
	const resendLink = document.getElementById('resendLink');
	const otpError = document.getElementById('otpError');
	otpError.style.display = 'none';
	resendLink.setAttribute('aria-disabled', 'true');
	resendLink.innerText = 'Sending...';

	try {
		const SCRIPT_URL = window.SMART_ATTEND_CONFIG.SCRIPT_URL;
		const response = await fetch(SCRIPT_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'resend_2fa_otp', email: _2fa_email })
		});
		const result = await response.json().catch(() => ({}));

		resendLink.innerText = result.status === 'success' ? '✓ OTP Sent!' : 'Resend OTP';
		setTimeout(() => { resendLink.innerText = 'Resend OTP'; }, 2000);
		resendLink.removeAttribute('aria-disabled');
		startOtpCountdown(10 * 60);

		// Clear existing digits
		[0,1,2,3,4,5].forEach(i => {
			const el = document.getElementById('otp'+i);
			if (el) { el.value = ''; el.classList.remove('filled'); }
		});
		document.getElementById('otp0').focus();
	} catch (err) {
		console.error('Resend error:', err);
		resendLink.innerText = 'Resend OTP';
		resendLink.removeAttribute('aria-disabled');
	}
}

// ── Back to Login ──
function backToLogin() {
	if (_2fa_timer) clearInterval(_2fa_timer);
	_2fa_email = '';

	document.getElementById('otpPanel').style.display = 'none';
	document.getElementById('loginForm').style.display = '';
	document.getElementById('loginError').style.display = 'none';
	document.getElementById('roleTabs').style.display = '';
	document.getElementById('formFooter').style.display = '';

	// Clear OTP inputs
	[0,1,2,3,4,5].forEach(i => {
		const el = document.getElementById('otp'+i);
		if (el) { el.value = ''; el.classList.remove('filled'); }
	});
}
