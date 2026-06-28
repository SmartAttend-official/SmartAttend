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

document.addEventListener('DOMContentLoaded', () => {
  const name = sessionStorage.getItem('userName') || 'Professor';
  const email = sessionStorage.getItem('userEmail') || '';
  const topbarName = document.getElementById('topbarName');
  if (topbarName) topbarName.innerText = name;
  const topbarEmail = document.getElementById('topbarEmail');
  if (topbarEmail) topbarEmail.innerText = email;
  const topbarAvatar = document.getElementById('topbarAvatar');
  if (topbarAvatar && name) topbarAvatar.innerText = name.charAt(0).toUpperCase();

  renderRequests();
});

const SCRIPT_URL = window.SMART_ATTEND_CONFIG.SCRIPT_URL;

async function renderRequests() {
  const container = document.getElementById('requestsContainer');
  const profEmail = sessionStorage.getItem('userEmail');
  const dateFilter = document.getElementById('leaveDateFilter')?.value;

  container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;"><i class="fa-solid fa-spinner fa-spin"></i> Loading requests...</div>';

  let requests = [];
  try {
    const response = await fetch(`${SCRIPT_URL}?sheet=leave&profEmail=${profEmail}`);
    requests = await response.json();
  } catch (error) {
    console.error('Failed to fetch requests:', error);
    container.innerHTML = '<div class="empty-state">Error loading requests.</div>';
    return;
  }

  // Client-side date filter if needed (though backend handles profEmail)
  if (dateFilter) {
    const [y, m, d] = dateFilter.split('-');
    const formattedFilter = `${d}/${m}/${y}`;
    requests = requests.filter(req => req.date === formattedFilter);
  }

  if (requests.length === 0) {
    container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-inbox fa-2x" style="margin-bottom:16px;"></i><br>No leave requests found.</div>';
    return;
  }

  container.innerHTML = '';

  // Sort: Pending first, then newest
  requests.sort((a, b) => {
    if (a.status === 'Pending' && b.status !== 'Pending') return -1;
    if (a.status !== 'Pending' && b.status === 'Pending') return 1;
    return new Date(b.submittedAt) - new Date(a.submittedAt);
  });

  requests.forEach(req => {
    const card = document.createElement('div');
    card.className = 'request-card';
    card.style.opacity = req.status === 'Pending' ? '1' : '0.8';
    
    let attachmentsHTML = '';
    if (req.image || req.pdf) {
      attachmentsHTML += '<div class="attachments" style="flex-direction: column; gap: 12px; margin-top: 16px;">';
      if (req.image) {
        attachmentsHTML += `
          <div style="width: 100%; border: 1px solid var(--glass-border); border-radius: 8px; padding: 8px; background: rgba(0,0,0,0.2);">
            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;"><i class="fa-regular fa-image"></i> Attached Image:</div>
            <img src="${req.image}" style="width: 100%; max-height: 250px; object-fit: contain; border-radius: 4px;" alt="Document">
          </div>`;
      }
      if (req.pdf) {
        attachmentsHTML += `
          <a href="${req.pdf}" download="Medical_Report_${req.studentId}.pdf" class="attach-btn" style="background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.3);">
            <i class="fa-solid fa-file-pdf" style="color:#ef4444;"></i> Download Medical (PDF)
          </a>`;
      }
      attachmentsHTML += '</div>';
    }

    let statusBadgeColor = '#f59e0b';
    if (req.status === 'Approved') statusBadgeColor = '#10b981';
    if (req.status === 'Rejected') statusBadgeColor = '#ef4444';

    let actionsHTML = '';
    if (req.status === 'Pending') {
      actionsHTML = `
        <div class="actions">
          <button class="btn-approve" onclick="resolveRequest('${req.id}', 'Approved')"><i class="fa-solid fa-check"></i> Approve</button>
          <button class="btn-reject" onclick="resolveRequest('${req.id}', 'Rejected')"><i class="fa-solid fa-xmark"></i> Reject</button>
        </div>`;
    } else {
      actionsHTML = `<div style="margin-top: 16px; font-size: 13px; color: var(--text-muted); font-style: italic; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 12px;">Processed</div>`;
    }

    card.innerHTML = `
      <div class="request-header">
        <div class="student-info">
          <h3>${req.studentName}</h3>
          <span>ID: ${req.studentId}</span>
        </div>
        <span class="status-badge" style="background: ${statusBadgeColor}22; color: ${statusBadgeColor}; border: 1px solid ${statusBadgeColor}44;">${req.status}</span>
      </div>
      <div class="request-body">
        <div class="date">Requested Date: ${req.date}</div>
        <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 12px;"><i class="fa-solid fa-clock"></i> Submitted: ${req.submittedAt || 'N/A'}</div>
        <p class="reason">${req.reason}</p>
        ${attachmentsHTML}
      </div>
      ${actionsHTML}
    `;
    container.appendChild(card);
  });
}

async function resolveRequest(id, decision) {
  try {
    await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'resolve_leave',
        id: id,
        status: decision
      })
    });

    showDecisionAlert(`Request ${decision} successfully!`, decision);
    
    // Refresh the list after a short delay (Apps Script takes a moment to update)
    setTimeout(() => renderRequests(), 1500);
  } catch (error) {
    console.error('Failed to resolve request:', error);
    alert('Error updating status. Please try again.');
  }
}

function showDecisionAlert(message, decision) {
  const alertDiv = document.createElement('div');
  const isApprove = decision === 'Approved';
  const color = isApprove ? '#10b981' : '#ef4444';
  
  alertDiv.innerHTML = `
    <div style="position: fixed; top: 24px; right: 24px; background: white; border: 2px solid ${color}; color: ${color}; padding: 16px 24px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); z-index: 9999; display: flex; align-items: center; gap: 12px; font-weight: 600; animation: slideIn 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);">
      <i class="fa-solid ${isApprove ? 'fa-circle-check' : 'fa-circle-xmark'}" style="font-size: 20px;"></i>
      <span>${message}</span>
    </div>
    <style>
      @keyframes slideIn {
        from { transform: translateX(120%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(120%); opacity: 0; }
      }
    </style>
  `;
  document.body.appendChild(alertDiv);
  
  setTimeout(() => {
    alertDiv.firstElementChild.style.animation = 'slideOut 0.4s ease forwards';
    setTimeout(() => alertDiv.remove(), 400);
  }, 3000);
}
