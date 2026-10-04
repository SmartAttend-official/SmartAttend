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

  window.loadedLeaveRequests = {};

  requests.forEach(req => {
    window.loadedLeaveRequests[req.id] = req;
    const card = document.createElement('div');
    card.className = 'request-card';
    card.style.opacity = req.status === 'Pending' ? '1' : '0.8';
    
    let attachmentsHTML = '';
    const hasImage = Boolean(req.image && req.image.length > 50);
    const hasPdf = Boolean(req.pdf && req.pdf.length > 50);

    if (hasImage || hasPdf || req.reason) {
      attachmentsHTML += '<div class="attachments" style="flex-direction: column; gap: 12px; margin-top: 16px;">';
      
      if (hasImage) {
        attachmentsHTML += `
          <div style="width: 100%; border: 1px solid var(--glass-border); border-radius: 8px; padding: 8px; background: rgba(0,0,0,0.2);">
            <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
              <span><i class="fa-regular fa-image"></i> Attached Medical Image:</span>
            </div>
            <img src="${req.image}" style="width: 100%; max-height: 250px; object-fit: contain; border-radius: 4px;" alt="Medical Document">
          </div>`;
      }
      
      if (hasPdf) {
        attachmentsHTML += `
          <a href="${req.pdf}" download="Medical_Report_${req.studentId}.pdf" class="attach-btn" style="background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.3); display: flex; align-items: center; gap: 8px; text-decoration: none; padding: 10px 14px; border-radius: 8px; color: #ef4444; font-size: 13px; font-weight: 600;">
            <i class="fa-solid fa-file-pdf" style="font-size: 16px;"></i> Download Medical (PDF)
          </a>`;
      }

      attachmentsHTML += `
        <button onclick="analyzeDocWithAI('${req.id}')" id="aiBtn-${req.id}" style="background: linear-gradient(135deg, #8b5cf6, #3b82f6); border: none; color: white; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 4px 14px rgba(139, 92, 246, 0.4); margin-top: 4px; transition: 0.3s;">
          <i class="fa-solid fa-wand-magic-sparkles"></i> AI Verify Medical Document 🤖
        </button>`;

      attachmentsHTML += `<div id="aiResult-${req.id}" style="display:none; margin-top: 12px;"></div>`;
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

async function analyzeDocWithAI(reqId) {
  const req = (window.loadedLeaveRequests && window.loadedLeaveRequests[reqId]) || null;
  if (!req) return;

  const btn = document.getElementById(`aiBtn-${reqId}`);
  const resultDiv = document.getElementById(`aiResult-${reqId}`);
  if (!btn || !resultDiv) return;

  const originalHTML = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> AI Auditing...';
  btn.disabled = true;

  resultDiv.style.display = 'block';
  resultDiv.innerHTML = '<div style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 12px; background: rgba(139, 92, 246, 0.1); border-radius: 8px; border: 1px dashed rgba(139, 92, 246, 0.4);"><i class="fa-solid fa-brain fa-spin"></i> SmartAttend AI is analyzing document authenticity & OCR text...</div>';

  const token = sessionStorage.getItem('token');
  const serverUrl = window.SMART_ATTEND_CONFIG.SCRIPT_URL;

  try {
    const res = await fetch(`${serverUrl}/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        action: 'verify_leave_proof',
        image: req.image || null,
        pdf: req.pdf || null,
        text: req.reason || '',
        studentName: req.studentName || '',
        studentId: req.studentId || '',
        date: req.date || ''
      })
    });

    const data = await res.json();
    if (data.status === 'success' && data.data) {
      const ai = data.data;
      let badgeBg = 'rgba(16, 185, 129, 0.2)';
      let badgeBorder = 'rgba(16, 185, 129, 0.5)';
      let badgeColor = '#10b981';
      let icon = 'fa-circle-check';

      if (ai.verdict === 'SUSPICIOUS') {
        badgeBg = 'rgba(245, 158, 11, 0.2)';
        badgeBorder = 'rgba(245, 158, 11, 0.5)';
        badgeColor = '#f59e0b';
        icon = 'fa-triangle-exclamation';
      } else if (ai.verdict === 'INVALID' || ai.verdict === 'REJECTED') {
        badgeBg = 'rgba(239, 68, 68, 0.2)';
        badgeBorder = 'rgba(239, 68, 68, 0.5)';
        badgeColor = '#ef4444';
        icon = 'fa-circle-xmark';
      }

      resultDiv.innerHTML = `
        <div style="background: rgba(15, 23, 42, 0.85); border: 1px solid ${badgeBorder}; border-radius: 10px; padding: 14px; box-shadow: 0 4px 20px rgba(0,0,0,0.4); margin-top: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--purple); letter-spacing: 0.5px;"><i class="fa-solid fa-robot"></i> SmartAttend AI Audit</span>
            <span style="background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeBorder}; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 700;">
              <i class="fa-solid ${icon}"></i> ${ai.verdict || 'VERIFIED'} (${ai.confidenceScore || 0}% match)
            </span>
          </div>
          <div style="font-size: 12px; line-height: 1.5; color: var(--text-main); margin-bottom: 8px;">${ai.aiSummary || 'Document parsed.'}</div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; font-size: 11px;">
            ${ai.nameMatches !== undefined ? `<span style="background: rgba(255,255,255,0.05); padding: 3px 8px; border-radius: 4px; color: ${ai.nameMatches ? '#10b981':'#ef4444'};"><i class="fa-solid ${ai.nameMatches ? 'fa-check':'fa-xmark'}"></i> ${ai.nameMatches ? 'Student Name Matched' : 'Name Mismatch'}</span>` : ''}
            ${ai.hasDoctorSignatureOrStamp !== undefined ? `<span style="background: rgba(255,255,255,0.05); padding: 3px 8px; border-radius: 4px; color: ${ai.hasDoctorSignatureOrStamp ? '#10b981':'#f59e0b'};"><i class="fa-solid ${ai.hasDoctorSignatureOrStamp ? 'fa-signature':'fa-question'}"></i> ${ai.hasDoctorSignatureOrStamp ? 'Doctor Stamp Detected' : 'No Doctor Stamp'}</span>` : ''}
            ${ai.medicalDiagnosis ? `<span style="background: rgba(255,255,255,0.05); padding: 3px 8px; border-radius: 4px; color: var(--text-muted);"><i class="fa-solid fa-notes-medical"></i> ${ai.medicalDiagnosis}</span>` : ''}
          </div>
        </div>
      `;
    } else {
      resultDiv.innerHTML = `<div style="font-size: 12px; color: #ef4444; padding: 8px; background: rgba(239,68,68,0.1); border-radius: 6px;"><i class="fa-solid fa-circle-exclamation"></i> AI Analysis error: ${data.message || 'Unknown failure.'}</div>`;
    }
  } catch (err) {
    console.error("AI audit failed:", err);
    resultDiv.innerHTML = `<div style="font-size: 12px; color: #ef4444; padding: 8px; background: rgba(239,68,68,0.1); border-radius: 6px;"><i class="fa-solid fa-circle-exclamation"></i> Connection error with AI service.</div>`;
  } finally {
    btn.innerHTML = originalHTML;
    btn.disabled = false;
  }
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
