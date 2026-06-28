// Toggle Profile Dropdown
function toggleProfile() {
  const dropdown = document.getElementById('profileDropdown');
  if (dropdown.style.display === 'flex') {
    dropdown.classList.remove('show');
    setTimeout(() => dropdown.style.display = 'none', 300);
  } else {
    dropdown.style.display = 'flex';
    setTimeout(() => dropdown.classList.add('show'), 10);
  }
}

// Close dropdown if clicked outside
document.addEventListener('click', function (event) {
  const wrapper = document.querySelector('.user-profile-wrapper');
  const dropdown = document.getElementById('profileDropdown');
  if (wrapper && !wrapper.contains(event.target) && dropdown.classList.contains('show')) {
    dropdown.classList.remove('show');
    setTimeout(() => dropdown.style.display = 'none', 300);
  }
});

// Helper to show alert
function showAlert(message, isError = false) {
  const alertBox = document.getElementById('globalAlert');
  const text = document.getElementById('globalAlertText');
  const icon = alertBox.querySelector('i');

  text.innerText = message;
  if (isError) {
    alertBox.style.borderColor = '#ef4444';
    alertBox.style.color = '#ef4444';
    icon.className = 'fa-solid fa-circle-xmark';
  } else {
    alertBox.style.borderColor = '#10b981';
    alertBox.style.color = '#10b981';
    icon.className = 'fa-solid fa-circle-check';
  }

  alertBox.classList.add('show');
  setTimeout(() => alertBox.classList.remove('show'), 3000);
}

// API Call: Update Email
async function updatePersonalInfo(event) {
  event.preventDefault();
  const btn = document.getElementById('updateProfileBtn');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
  btn.disabled = true;

  const newEmail = document.getElementById('profileEmail').value.trim();
  const newFirstName = document.getElementById('profileFirstName').value.trim();
  const newLastName = document.getElementById('profileLastName').value.trim();
  const currentEmail = sessionStorage.getItem('userEmail');

  try {
    const SCRIPT_URL = window.SMART_ATTEND_CONFIG.SCRIPT_URL;
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sheet: 'professor', action: 'update', searchCol: 'Email', searchVal: currentEmail,
        data: {
          Email: newEmail,
          "Professor  first_name": newFirstName,
          "Professor  last_name": newLastName
        }
      })
    });

    if (response.ok) {
      sessionStorage.setItem('userEmail', newEmail);
      sessionStorage.setItem('userName', `${newFirstName} ${newLastName}`.trim());

      // Instantly update Topbar and Avatar
      const topbarName = document.getElementById('topbarName');
      if (topbarName) topbarName.innerText = `${newFirstName} ${newLastName}`.trim();
      const topbarAvatar = document.getElementById('topbarAvatar');
      if (topbarAvatar) topbarAvatar.innerText = newFirstName.charAt(0).toUpperCase();
      const profileName = document.getElementById('profileName');
      if (profileName) profileName.innerText = `${newFirstName} ${newLastName}`.trim();
      const profileLargeAvatar = document.getElementById('profileLargeAvatar');
      if (profileLargeAvatar) {
        profileLargeAvatar.innerHTML = newFirstName.charAt(0).toUpperCase() + `
  <div class="edit-avatar-btn" title="Change Avatar">
    <i class="fa-solid fa-camera"></i>
  </div>`;
      }
      sessionStorage.setItem('userEmail', newEmail);
      showAlert('Profile updated successfully!');
    } else {
      throw new Error('API Error');
    }
  } catch (err) {
    console.error(err);
    showAlert('Failed to update profile.', true);
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

// API Call: Update Password
async function updatePassword(event) {
  event.preventDefault();
  const currentEmail = sessionStorage.getItem('userEmail');
  const currentPasswordInput = document.getElementById('currentPassword').value;
  const newPasswordInput = document.getElementById('newPassword').value;

  const btn = document.getElementById('updatePasswordBtn');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';
  btn.disabled = true;

  try {
    // 1. Fetch user to verify current password
    const SCRIPT_URL = window.SMART_ATTEND_CONFIG.SCRIPT_URL;
    const userRes = await fetch(`${SCRIPT_URL}?sheet=professor&email=${encodeURIComponent(currentEmail)}`);
    const userData = await userRes.json();

    if (userData && userData.length > 0) {
      const actualPassword = userData[0].Password;
      if (actualPassword !== currentPasswordInput) {
        showAlert('Incorrect current password.', true);
        return;
      }

      // 2. Passwords match, update to new password
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';
      const updateRes = await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheet: 'professor', action: 'update', searchCol: 'Email', searchVal: currentEmail, data: { Password: newPasswordInput } })
      });

      if (updateRes.ok) {
        showAlert('Password changed successfully!');
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
      } else {
        throw new Error('Update failed');
      }
    } else {
      showAlert('User record not found.', true);
    }
  } catch (err) {
    console.error(err);
    showAlert('Failed to change password.', true);
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

// Handle Toggle Changes
function handleToggle() {
  showAlert("Preferences updated");
}

// Toggle Password Visibility
function togglePasswordVisibility(inputId, iconElement) {
  const input = document.getElementById(inputId);
  if (input.type === "password") {
    input.type = "text";
    iconElement.classList.remove("fa-eye");
    iconElement.classList.add("fa-eye-slash");
    iconElement.style.color = "var(--accent-hover)";
  } else {
    input.type = "password";
    iconElement.classList.remove("fa-eye-slash");
    iconElement.classList.add("fa-eye");
    iconElement.style.color = "var(--text-muted)";
  }
}

// Trigger logic when profile loads
document.addEventListener('DOMContentLoaded', () => {
    console.log("Profile page ready.");
});
