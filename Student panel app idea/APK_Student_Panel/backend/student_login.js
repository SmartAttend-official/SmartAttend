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
		// Optimize: Pass email to backend to filter on server-side
		const response = await fetch(`${SCRIPT_URL}?sheet=student&email=${encodeURIComponent(email)}`);

		if (!response.ok) {
			const text = await response.text();
			throw new Error(`Server returned ${response.status}: ${text.substring(0, 50)}`);
		}

		let data;
		try {
			data = await response.json();
		} catch (e) {
			throw new Error("Invalid response format from server.");
		}

		// Handle error object returned from server
		if (data.status === 'error') {
			throw new Error(data.message || "Unknown server error.");
		}

		if (!Array.isArray(data)) {
			throw new Error("Unexpected data format from server.");
		}

		// Check matching record (still doing local check for password safety)
		const student = data.find(row => {
			const rEmail = (row.Email || row.email || "").toString().toLowerCase().trim();
			return rEmail === email.toLowerCase() && row.Password === password;
		});

		if (student) {
			// Authentic user
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

