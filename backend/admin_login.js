// Admin Login Logic
// NOTE: Temporarily using 'professor' sheet for authentication as requested.

document.getElementById('adminLoginForm').addEventListener('submit', async function (e) {
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
	btnText.innerText = 'Verifying...';
	btnIcon.className = 'fa-solid fa-circle-notch fa-spin';
	loginBtn.style.opacity = '0.8';

	try {
		const SCRIPT_URL = window.SMART_ATTEND_CONFIG.SCRIPT_URL;
		const response = await fetch(SCRIPT_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'login', email, password, role: 'admin' })
		});

		if (!response.ok) {
			const errData = await response.json().catch(() => ({}));
			throw new Error(errData.message || 'Invalid email or password.');
		}

		const result = await response.json();

		if (result.status === 'success' && result.token) {
			// Set session
			sessionStorage.setItem('smartattend_token', result.token);
			sessionStorage.setItem('isAdminAuthenticated', 'true');
			sessionStorage.setItem('adminEmail', email);
			sessionStorage.setItem('adminName', 'Admin User');

			// Visual Feedback
			btnText.innerText = 'Access Granted';
			btnIcon.className = 'fa-solid fa-check-double';
			loginBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
			loginBtn.style.boxShadow = '0 0 20px rgba(16, 185, 129, 0.4)';

			setTimeout(() => {
				window.location.replace('admin_dashboard.html');
			}, 1000);
		} else {
			// Fail
			errorDiv.innerText = 'Invalid Admin credentials.';
			errorDiv.style.display = 'block';

			// Reset
			loginBtn.disabled = false;
			btnText.innerText = 'Verify & Enter';
			btnIcon.className = 'fa-solid fa-unlock-keyhole';
			loginBtn.style.opacity = '1';
		}

	} catch (error) {
		console.error("Admin Login Error:", error);
		errorDiv.innerText = 'A security system error occurred. Please contact tech support.';
		errorDiv.style.display = 'block';

		loginBtn.disabled = false;
		btnText.innerText = 'Verify & Enter';
		btnIcon.className = 'fa-solid fa-unlock-keyhole';
		loginBtn.style.opacity = '1';
	}
});
