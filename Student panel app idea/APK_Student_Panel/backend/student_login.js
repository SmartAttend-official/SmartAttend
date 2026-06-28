// Authentication Logic for Student Portal
document.getElementById('studentLoginForm').addEventListener('submit', async function (e) {
	e.preventDefault();

	const email = document.getElementById('emailInput').value.trim();
	const password = document.getElementById('studentPasswordInput').value.trim();
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
			body: JSON.stringify({ action: 'login', email, password, role: 'student' })
		});

		if (!response.ok) {
			const errData = await response.json().catch(() => ({}));
			throw new Error(errData.message || 'Invalid email or password.');
		}

		const result = await response.json();

		if (result.status === 'success' && result.token) {
			const student = result.user;
			
			// Authentic user
			sessionStorage.setItem('smartattend_token', result.token);
			localStorage.setItem('smartattend_token', result.token);
			sessionStorage.setItem('isStudentAuthenticated', 'true');
			sessionStorage.setItem('studentId', student.ID || student.id || student['Student ID'] || '');
			sessionStorage.setItem('studentName', student.Name || student.name || 'Student');
			sessionStorage.setItem('studentEmail', email);
			
			// Optional: Save other data if available
			if (student.Department) sessionStorage.setItem('studentDept', student.Department);
			
			// Visual Feedback
			btnText.innerText = 'Access Granted';
			btnIcon.className = 'fa-solid fa-check-double';
			loginBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
			loginBtn.style.boxShadow = '0 0 20px rgba(16, 185, 129, 0.4)';

			setTimeout(() => {
				window.location.replace('student_dashboard.html');
			}, 2000);
		} else {
			// Invalid credentials
			errorDiv.innerText = 'Invalid Email or Enrollment Number.';
			errorDiv.style.display = 'block';

			// Reset button state
			loginBtn.disabled = false;
			btnText.innerText = 'Access Portal';
			btnIcon.className = 'fa-solid fa-arrow-right-to-bracket';
			loginBtn.style.opacity = '1';
			loginBtn.style.cursor = 'pointer';
		}

	} catch (error) {
		console.error("Login Error:", error);
		errorDiv.innerText = `Login Error: ${error.message}`;
		errorDiv.style.display = 'block';

		// Reset button state
		loginBtn.disabled = false;
		btnText.innerText = 'Access Portal';
		btnIcon.className = 'fa-solid fa-arrow-right-to-bracket';
		loginBtn.style.opacity = '1';
		loginBtn.style.cursor = 'pointer';
	}
});

