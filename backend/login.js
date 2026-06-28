// Simple script to handle role tab switching animation
function switchRole(element) {
	const tabs = document.querySelectorAll('.role-tab');
	tabs.forEach(tab => tab.classList.remove('active'));
	element.classList.add('active');
}

// Authentication Logic via SheetDB API
document.getElementById('loginForm').addEventListener('submit', async function (e) {
	e.preventDefault(); // Prevent default form submission

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
		const response = await fetch(`${SCRIPT_URL}?sheet=professor&email=${encodeURIComponent(email)}`);

		if (!response.ok) {
			throw new Error('Failed to connect to authentication server.');
		}

		const data = await response.json();

		// Check if there is a matching record
		const user = data.find(row => row.Email === email && row.Password === password);

		if (user) {
			// Authentic user
			const sessionToken = Date.now().toString() + Math.random().toString(36).substring(2);

			// Update token in DB
			btnText.innerText = 'Securing Session...';
			try {
				await fetch(SCRIPT_URL, {
					method: 'POST',
					mode: 'no-cors',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ sheet: 'professor', action: 'update', searchCol: 'Email', searchVal: email, data: { SessionToken: sessionToken } })
				});
			} catch (e) {
				console.error("Failed to secure session token in DB", e);
			}

			sessionStorage.setItem('isAuthenticated', 'true');
			sessionStorage.setItem('userEmail', email);
			sessionStorage.setItem('sessionToken', sessionToken);
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
		errorDiv.innerText = 'An error occurred during login. Please try again.';
		errorDiv.style.display = 'block';

		// Reset button state
		loginBtn.disabled = false;
		btnText.innerText = 'Sign In';
		btnIcon.className = 'fa-solid fa-arrow-right-to-bracket';
		loginBtn.style.opacity = '1';
		loginBtn.style.cursor = 'pointer';
	}
});
