const API_BASE = window.SMART_ATTEND_CONFIG.SCRIPT_URL;
let verifiedEmail = '';

// ─────────────────────────────────────
// Step navigation
// ─────────────────────────────────────
function goToStep(n) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById('step-' + n).classList.add('active');
}

// ─────────────────────────────────────
// Show error inside a step
// ─────────────────────────────────────
function showError(id, msg) {
  const el = document.getElementById(id);
  el.querySelector('span').innerText = msg;
  el.classList.add('show');
}

function hideError(id) {
  document.getElementById(id).classList.remove('show');
}

// ─────────────────────────────────────
// STEP 1: Send OTP
// ─────────────────────────────────────
async function handleSendOTP() {
  hideError('step1-error');
  const email = document.getElementById('emailInput').value.trim();
  if (!email) return showError('step1-error', 'Please enter your email address.');

  const btn = document.getElementById('sendOtpBtn');
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';
  btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}?sheet=student&action=verify_student_email&email=${encodeURIComponent(email)}`);
    const data = await res.json();

    if (data.status === 'success') {
      verifiedEmail = email;
      goToStep(2);
      document.querySelector('#otpInputs input').focus();
    } else {
      showError('step1-error', data.message || 'Verification failed.');
    }
  } catch (err) {
    showError('step1-error', 'Connection error. Please try again.');
  } finally {
    btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Verify Email';
    btn.disabled = false;
  }
}

// ─────────────────────────────────────
// STEP 2: Verify OTP
// ─────────────────────────────────────
async function handleVerifyOTP() {
  hideError('step2-error');
  const inputs = document.querySelectorAll('#otpInputs input');
  const otp = Array.from(inputs).map(i => i.value).join('');

  if (otp.length < 5) {
    showError('step2-error', 'Please enter the complete 5-digit OTP.');
    return;
  }

  const btn = document.getElementById('verifyOtpBtn');
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';
  btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}?sheet=student&action=verify_otp_only&email=${encodeURIComponent(verifiedEmail)}&otp=${encodeURIComponent(otp)}`);
    const data = await res.json();

    if (data.status === 'success') {
      goToStep(3);
      document.getElementById('newPassword').focus();
    } else {
      showError('step2-error', data.message || 'Invalid or expired OTP.');
    }
  } catch (err) {
    showError('step2-error', 'Connection error. Please try again.');
  } finally {
    btn.innerHTML = '<i class="fa-solid fa-shield-check"></i> Verify OTP';
    btn.disabled = false;
  }
}

// ─────────────────────────────────────
// STEP 3: Reset Password
// ─────────────────────────────────────
async function handleResetPassword() {
  hideError('step3-error');
  const newPass = document.getElementById('newPassword').value;
  const confirmPass = document.getElementById('confirmPassword').value;

  if (newPass.length < 8) return showError('step3-error', 'Password must be at least 8 characters.');
  if (newPass !== confirmPass) return showError('step3-error', 'Passwords do not match.');

  const inputs = document.querySelectorAll('#otpInputs input');
  const otp = Array.from(inputs).map(i => i.value).join('');

  const btn = document.getElementById('resetBtn');
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';
  btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}?sheet=student&action=verify_otp&email=${encodeURIComponent(verifiedEmail)}&otp=${encodeURIComponent(otp)}&newPassword=${encodeURIComponent(newPass)}`);
    const data = await res.json();

    if (data.status === 'success') {
      // Show top success alert and redirect
      const alertBox = document.getElementById('successAlert');
      alertBox.classList.add('show');
      setTimeout(() => {
        alertBox.classList.remove('show');
        setTimeout(() => { window.location.href = 'student_login.html'; }, 400);
      }, 3000);
    } else {
      showError('step3-error', data.message || 'Failed to update password.');
      if (data.message && data.message.toLowerCase().includes('expired')) {
        setTimeout(() => {
          goToStep(1);
          document.querySelectorAll('#otpInputs input').forEach(input => input.value = '');
        }, 3000);
      }
    }
  } catch (err) {
    showError('step3-error', 'Connection error. Please try again.');
  } finally {
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Update Password';
    btn.disabled = false;
  }
}

// ─────────────────────────────────────
// OTP Input Auto-advance & Backspace
// ─────────────────────────────────────
document.querySelectorAll('#otpInputs input').forEach((input, index, inputs) => {
  input.addEventListener('input', function () {
    // Only allow numbers
    this.value = this.value.replace(/[^0-9]/g, '');
    if (this.value.length === 1 && index < inputs.length - 1) {
      inputs[index + 1].focus();
    }
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'Backspace' && !this.value && index > 0) {
      inputs[index - 1].focus();
    }
    if (e.key === 'Enter') handleVerifyOTP();
  });
});
