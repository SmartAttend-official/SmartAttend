document.addEventListener('DOMContentLoaded', async () => {
  const studentEmail = sessionStorage.getItem('studentEmail');
  if (!studentEmail) return;

  // Initialize UI with session data for "Optimistic" loading
  const cachedName = sessionStorage.getItem('studentName') || 'Student';
  document.getElementById('studentNameDisplay').innerText = cachedName.split(' ')[0];
  document.getElementById('welcomeText').innerText = `Welcome back, ${cachedName.split(' ')[0]}!`;

  try {
    const SCRIPT_URL = window.SMART_ATTEND_CONFIG.SCRIPT_URL;
    
    // Fetch Fresh Data from Sheet
    const response = await fetch(`${SCRIPT_URL}?sheet=student&email=${encodeURIComponent(studentEmail)}`);
    const studentData = await response.json();
    
    if (studentData && studentData.length > 0) {
      const s = studentData[0];
      const totalClasses = parseInt(s.Total_Classes) || 0;
      const classesAttended = parseInt(s.Classes_Attended) || 0;
      const missedClasses = totalClasses > classesAttended ? totalClasses - classesAttended : 0;
      const percentage = parseFloat(s.Attendance_Percentage) || 0;

      // Update UI elements
      document.getElementById('statTotal').innerText = totalClasses;
      document.getElementById('statAttended').innerText = classesAttended;

      // Render Chart.js Pie Chart
      const ctx = document.getElementById('attendanceChart').getContext('2d');
      new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Attended', 'Missed'],
          datasets: [{
            data: [classesAttended, missedClasses],
            backgroundColor: ['#10b981', '#ef4444'],
            borderColor: ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.1)'],
            borderWidth: 2,
            hoverOffset: 10
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'bottom',
              labels: { color: '#94a3b8', font: { family: 'Outfit', size: 12 } }
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const label = context.label || '';
                  const value = context.raw || 0;
                  const total = totalClasses || 1;
                  const pct = ((value / total) * 100).toFixed(1);
                  return `${label}: ${value} (${pct}%)`;
                }
              }
            }
          },
          cutout: '70%'
        }
      });

      // Update Status Label
      const statusEl = document.getElementById('progressStatus');
      statusEl.innerText = `${percentage.toFixed(1)}% Attendance`;
      
      if (percentage >= 75) {
        statusEl.style.color = '#10b981';
        statusEl.style.background = 'rgba(16, 185, 129, 0.1)';
        statusEl.innerText = `${percentage.toFixed(1)}% (Safe Zone)`;
      } else {
        statusEl.style.color = '#ef4444';
        statusEl.style.background = 'rgba(239, 68, 68, 0.1)';
        statusEl.innerText = `${percentage.toFixed(1)}% (Below Threshold)`;
      }

      // ── FEATURE 3: SUBJECT-WISE ATTENDANCE ────────────────────────
      try {
        const studentId = sessionStorage.getItem('studentId');
        const subResponse = await fetch(`${SCRIPT_URL}?sheet=SubjectAttendance&studentId=${encodeURIComponent(studentId)}`);
        const subData = await subResponse.json();
        const tbody = document.getElementById('subjectBreakdownBody');
        
        if (subData && subData.length > 0) {
          tbody.innerHTML = '';
          subData.forEach(sub => {
            const getVal = (obj, key) => {
              const foundKey = Object.keys(obj).find(k => k.toLowerCase() === key.toLowerCase());
              return foundKey ? obj[foundKey] : undefined;
            };

            const subAtt = parseInt(getVal(sub, 'Attended')) || 0;
            const subTot = parseInt(getVal(sub, 'Total')) || 0;
            const subPct = parseFloat(getVal(sub, 'Percentage')) || 0;
            const subName = getVal(sub, 'Subject') || 'Unknown';
            
            const subColor = subPct >= 75 ? '#10b981' : (subPct <= 50 ? '#ef4444' : '#f59e0b');
            const subStatus = subPct >= 75 ? 'Safe' : (subPct <= 50 ? 'Critical' : 'Warning');
            
            tbody.innerHTML += `
              <tr>
                <td style="font-weight: 500;">
                  <div style="font-size: 14px;">${subName}</div>
                  <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Recorded Sessions</div>
                </td>
                <td style="font-weight: 700; color: white;">
                  <div style="font-size: 15px;">${subAtt} <span style="color: var(--text-muted); font-weight: 400; font-size: 12px;">/ ${subTot}</span></div>
                </td>
                <td style="text-align: right;">
                  <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                    <span style="color: ${subColor}; font-weight: 800; font-size: 14px;">${subPct.toFixed(1)}%</span>
                    <span style="font-size: 10px; padding: 1px 6px; border-radius: 4px; background: ${subColor}22; color: ${subColor}; border: 1px solid ${subColor}44; text-transform: uppercase;">${subStatus}</span>
                  </div>
                </td>
              </tr>
            `;
          });
        } else {
          tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 30px;">No subject sessions have been recorded yet.</td></tr>';
        }
      } catch (err) {
        console.error('Failed to load subject breakdown', err);
      }

      // ── FEATURE 4: ATTENDANCE RECOVERY PLAN ───────────────────────
      const recoveryContainer = document.getElementById('recoveryPlanContainer');
      if (percentage < 75) {
        // Calculate consecutive classes needed
        const req75 = Math.ceil((0.75 * totalClasses - classesAttended) / 0.25);
        const req65 = Math.ceil((0.65 * totalClasses - classesAttended) / 0.35);

        recoveryContainer.innerHTML = `
          <div class="recovery-card warning">
            <div class="recovery-title"><i class="fa-solid fa-triangle-exclamation"></i> Below Threshold Plan</div>
            <div class="recovery-text">
              <p>• Attend next <strong>${req75 > 0 ? req75 : 0}</strong> consecutive classes to reach the <strong>75% Safe Zone</strong>.</p>
              ${req65 > 0 ? `<p>• Attend next <strong>${req65}</strong> classes to reach <strong>65% (Warning Level)</strong>.</p>` : ''}
              <p style="margin-top: 10px; color: #ef4444; font-weight: 500;">Risk: You are currently ineligible for exams if this status persists.</p>
            </div>
          </div>
        `;
      } else {
        // Safe Zone Logic
        const canMiss = Math.floor((classesAttended - 0.75 * totalClasses) / 0.75);
        recoveryContainer.innerHTML = `
          <div class="recovery-card">
            <div class="recovery-title" style="color: #10b981;"><i class="fa-solid fa-circle-check"></i> Safe Zone Strategy</div>
            <div class="recovery-text">
              <p>• You can safely miss <strong>${canMiss > 0 ? canMiss : 0}</strong> more classes while staying above 75%.</p>
              <p>• Keep maintaining this consistency to secure your exam eligibility.</p>
            </div>
          </div>
        `;
      }

      // ── FEATURE 5: MY TIMETABLE ─────────────────────────────────────
      try {
        const dept = s.DEPARTMENT || s.Department || s.dept || '';
        const sem = s.SEMESTER || s.Semester || s.sem || '';
        const ttContainer = document.getElementById('studentTimetableContainer');
        
        if (dept && sem && ttContainer) {
          const ttResp = await fetch(`${SCRIPT_URL}?action=get_timetable&department=${encodeURIComponent(dept)}&semester=${encodeURIComponent(sem)}`);
          const ttData = await ttResp.json();
          
          if (ttData.status === 'success' && ttData.data) {
            const t = ttData.data;
            ttContainer.innerHTML = `
              <i class="fa-solid fa-calendar-check" style="font-size:32px; color:#10b981; margin-bottom:16px;"></i>
              <h3 style="margin:0 0 8px 0;">Timetable Found</h3>
              <p style="color:var(--text-muted); font-size:14px; margin-bottom:20px;">Uploaded: ${t.UploadedAt || 'Recently'}</p>
              <div style="display:flex; gap:12px; justify-content:center;">
                <a href="${t.ViewURL}" target="_blank" class="btn" style="text-decoration:none; background:#10b981; color:white;"><i class="fa-solid fa-eye"></i> View Online</a>
                <a href="${t.DownloadURL}" target="_blank" class="btn" style="text-decoration:none; background:#10b981; color:white;"><i class="fa-solid fa-download"></i> Download PDF</a>
              </div>
            `;
          } else {
            ttContainer.innerHTML = `
              <i class="fa-solid fa-circle-xmark" style="font-size:32px; color:#ef4444; margin-bottom:12px;"></i>
              <p style="color:var(--text-muted); margin:0;">No timetable found for your class yet.</p>
            `;
          }
        } else if (ttContainer) {
          ttContainer.innerHTML = `
              <i class="fa-solid fa-circle-xmark" style="font-size:32px; color:#f59e0b; margin-bottom:12px;"></i>
              <p style="color:var(--text-muted); margin:0;">Incomplete profile. Cannot load timetable.</p>
            `;
        }
      } catch (err) {
        console.error('Failed to load timetable', err);
        const ttContainer = document.getElementById('studentTimetableContainer');
        if (ttContainer) {
          ttContainer.innerHTML = `
            <i class="fa-solid fa-triangle-exclamation" style="font-size:32px; color:#f59e0b; margin-bottom:12px;"></i>
            <p style="color:var(--text-muted); margin:0;">Error loading timetable.</p>
          `;
        }
      }

      // ── FEATURE 6: CLASS ASSIGNMENTS ──────────────────────────────
      try {
        const dept = s.DEPARTMENT || s.Department || s.dept || '';
        const sem = s.SEMESTER || s.Semester || s.sem || '';
        
        if (dept && sem) {
          // Fetch both assignments and subjects
          const [assignResp, subjectsResp] = await Promise.all([
            fetch(`${SCRIPT_URL}?sheet=student_assignments`),
            fetch(`${SCRIPT_URL}?sheet=subjects`)
          ]);
          const allAssignments = await assignResp.json();
          window.allRegisteredSubjects = await subjectsResp.json();
          window.studentDept = dept;
          
          if (Array.isArray(allAssignments)) {
            const sSemStr = sem.toString().toLowerCase().trim().replace(/[^0-9]/g, '');

            window.studentAssignments = allAssignments.filter(a => {
              const aDept = a.Department || '';
              return isDeptMatchLocal(aDept, dept);
            });

            // Set the default Semester filter value to the student's current semester
            const semFilterSelect = document.getElementById('assignmentSemFilter');
            if (semFilterSelect) {
              semFilterSelect.value = sSemStr;
            }

            // Populate Subject filter dropdown dynamically based on student's dept and current selected semester
            if (window.populateSubjectFilter) {
              window.populateSubjectFilter(dept, sSemStr);
            }

            // Initialize rendering
            renderStudentAssignments();
          } else {
            document.getElementById('studentAssignmentsList').innerHTML = `
              <div style="text-align: center; color: var(--text-muted); padding: 30px;">
                <i class="fa-solid fa-circle-xmark" style="font-size: 28px; color: #ef4444; margin-bottom: 8px;"></i>
                <p style="margin: 0;">Error loading assignments.</p>
              </div>
            `;
          }
        } else {
          document.getElementById('studentAssignmentsList').innerHTML = `
            <div style="text-align: center; color: var(--text-muted); padding: 30px;">
              <i class="fa-solid fa-triangle-exclamation" style="font-size: 28px; color: #f59e0b; margin-bottom: 8px;"></i>
              <p style="margin: 0;">Incomplete profile. Cannot load assignments.</p>
            </div>
          `;
        }
      } catch (err) {
        console.error('Failed to load assignments', err);
        document.getElementById('studentAssignmentsList').innerHTML = `
          <div style="text-align: center; color: var(--text-muted); padding: 30px;">
            <i class="fa-solid fa-circle-xmark" style="font-size: 28px; color: #ef4444; margin-bottom: 8px;"></i>
            <p style="margin: 0;">Failed to load assignments.</p>
          </div>
        `;
      }

    }
  } catch (error) {
    console.error('Failed to sync student data:', error);
  }

  function renderAttendanceChart(present, missed, total) {
    const ctx = document.getElementById('attendanceChart').getContext('2d');
    
    if (attendanceChart) {
      attendanceChart.destroy();
    }

    attendanceChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Attended', 'Missed'],
        datasets: [{
          data: [present, missed],
          backgroundColor: ['#10b981', '#ef4444'],
          borderColor: ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.1)'],
          borderWidth: 2,
          hoverOffset: 10
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: { color: '#94a3b8', font: { family: 'Outfit', size: 12 } }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const label = context.label || '';
                const value = context.raw || 0;
                const pct = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                return `${label}: ${value} (${pct}%)`;
              }
            }
          }
        },
        cutout: '70%'
      }
    });
  }

  // Fetch Professors for Dropdown
  try {
    const profSelect = document.getElementById('targetProfessor');
    if (profSelect) {
      const SCRIPT_URL = window.SMART_ATTEND_CONFIG.SCRIPT_URL;
      const response = await fetch(`${SCRIPT_URL}?sheet=professor`);
      const data = await response.json();
      
      profSelect.innerHTML = '<option value="" disabled selected>Select Professor</option>';
      if (data && data.length > 0) {
        data.forEach(prof => {
          const profName = prof['Professor first_name'] ? `${prof['Professor first_name']} ${prof['Professor Last_name'] || ''}`.trim() : 'Professor';
          if (prof.Email) {
            profSelect.innerHTML += `<option value="${prof.Email}">${profName} (${prof.Email})</option>`;
          }
        });
      } else {
        profSelect.innerHTML = '<option value="" disabled selected>No professors found</option>';
      }
    }
  } catch (error) {
    console.error('Failed to load professors', error);
  }
});

// Leave Form Submit Logic
document.getElementById('leaveForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  const original = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';
  btn.disabled = true;

  try {
    // Get professor email — from dropdown OR manual input
    const dropdown = document.getElementById('targetProfessor');
    const manual = document.getElementById('targetProfessorManual');
    const targetProfessor = (dropdown && dropdown.value && dropdown.value.trim())
                          || (manual && manual.value && manual.value.trim())
                          || '';

    if (!targetProfessor) {
      btn.innerHTML = original;
      btn.disabled = false;
      alert('Please select a professor or type their email address.');
      return;
    }

    const rawDate = e.target.querySelector('input[type="date"]').value;
    const dateParts = rawDate.split('-');
    const date = `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`; // Convert YYYY-MM-DD to DD/MM/YYYY
    const reason = e.target.querySelector('textarea').value;
    
    // Read files as base64
    const imageInput = document.getElementById('leaveImageInput');
    const pdfInput = document.getElementById('medicalPdfInput');
    
    const getBase64 = (file) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });

    let imageBase64 = null;
    let pdfBase64 = null;
    
    if (imageInput.files[0]) imageBase64 = await getBase64(imageInput.files[0]);
    if (pdfInput.files[0]) pdfBase64 = await getBase64(pdfInput.files[0]);

    // Create Request Object
    const request = {
      id: Date.now().toString(),
      studentId: sessionStorage.getItem('studentId') || 'Unknown ID',
      studentName: sessionStorage.getItem('studentName') || 'Unknown Student',
      targetProfessor: targetProfessor,
      date: date,
      reason: reason,
      image: imageBase64,
      pdf: pdfBase64,
      status: 'Pending'
      // submittedAt is now handled by the backend server for better accuracy
    };

    // Save to Google Sheets instead of localStorage
    const SCRIPT_URL = window.SMART_ATTEND_CONFIG.SCRIPT_URL;
    
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'submit_leave',
        data: request
      })
    });

    // Note: with no-cors we can't read the response body, but if it doesn't throw, it likely succeeded.
    // For a better UX, we'll assume success if no error.

    btn.innerHTML = '<i class="fa-solid fa-check"></i> Request Sent to Professor!';
    btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
    
    setTimeout(() => {
      btn.innerHTML = original;
      btn.disabled = false;
      btn.style.background = '';
      e.target.reset();
      document.getElementById('leaveFileName').innerText = 'No file selected';
      document.getElementById('medicalFileName').innerText = 'No file selected';
      renderLeaveHistory(); // Refresh after submission
    }, 3000);

  } catch (error) {
    console.error('Error saving request:', error);
    btn.innerHTML = '<i class="fa-solid fa-xmark"></i> Error submitting request';
    btn.style.background = '#ef4444';
    setTimeout(() => {
      btn.innerHTML = original;
      btn.disabled = false;
      btn.style.background = '';
    }, 3000);
  }
});

// Render Student's Leave Request History
async function renderLeaveHistory() {
  const container = document.getElementById('leaveRequestHistory');
  if (!container) return;

  const currentStudentId = sessionStorage.getItem('studentId');
  if (!currentStudentId) {
    container.innerHTML = '<div style="text-align: center; color: #ef4444; padding: 20px;">Session error. Please log in again.</div>';
    return;
  }

  let allRequests = [];
  try {
    const SCRIPT_URL = window.SMART_ATTEND_CONFIG.SCRIPT_URL;
    const response = await fetch(`${SCRIPT_URL}?sheet=leave&studentId=${currentStudentId}`);
    allRequests = await response.json();
  } catch (error) {
    console.error('Failed to fetch leave history:', error);
    container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">Error loading history.</div>';
    return;
  }

  const dateFilter = document.getElementById('studentLeaveDateFilter')?.value;

  // Filter by date if active
  let myRequests = allRequests;
  if (dateFilter) {
    const [y, m, d] = dateFilter.split('-');
    const formattedFilter = `${d}/${m}/${y}`;
    myRequests = allRequests.filter(req => req.date === formattedFilter);
  }

  if (myRequests.length === 0) {
    container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px;">You haven\'t submitted any requests yet.</div>';
    return;
  }

  // Sort by submission date (newest first)
  myRequests.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));

  container.innerHTML = myRequests.map(req => {
    let statusColor = '#f59e0b'; // Yellow for Pending
    let statusBg = 'rgba(245, 158, 11, 0.15)';
    
    if (req.status === 'Approved') {
      statusColor = '#10b981'; // Green
      statusBg = 'rgba(16, 185, 129, 0.15)';
    } else if (req.status === 'Rejected') {
      statusColor = '#ef4444'; // Red
      statusBg = 'rgba(239, 68, 68, 0.15)';
    }

    return `
      <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--glass-border); border-radius: 12px; padding: 16px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-weight: 600; color: white; margin-bottom: 2px;">Requested Date: ${req.date}</div>
          <div style="font-size: 11px; color: #60a5fa; margin-bottom: 6px;"><i class="fa-solid fa-clock"></i> Submitted: ${req.submittedAt || 'N/A'}</div>
          <div style="font-size: 13px; color: var(--text-muted);">To Professor: ${req.targetProfessor}</div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Reason: ${req.reason.substring(0, 60)}${req.reason.length > 60 ? '...' : ''}</div>
        </div>
        <div style="background: ${statusBg}; color: ${statusColor}; border: 1px solid ${statusColor}44; padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 700; min-width: 85px; text-align: center;">
          ${req.status}
        </div>
      </div>
    `;
  }).join('');
}

// Initial load
document.addEventListener('DOMContentLoaded', () => {
  renderLeaveHistory();
  
  // Add listener for date filter
  const dateFilter = document.getElementById('studentLeaveDateFilter');
  if (dateFilter) {
    dateFilter.addEventListener('change', () => renderLeaveHistory());
  }

  // Add listener for assignments date filter
  const assignDateFilter = document.getElementById('assignmentDateFilter');
  if (assignDateFilter) {
    assignDateFilter.addEventListener('change', () => renderStudentAssignments());
  }

  // Add listener for semester filter
  const assignSemFilter = document.getElementById('assignmentSemFilter');
  if (assignSemFilter) {
    assignSemFilter.addEventListener('change', () => {
      if (window.populateSubjectFilter && window.studentDept) {
        window.populateSubjectFilter(window.studentDept, assignSemFilter.value);
      }
      renderStudentAssignments();
    });
  }

  // Add listener for subject filter
  const assignSubjectFilter = document.getElementById('assignmentSubjectFilter');
  if (assignSubjectFilter) {
    assignSubjectFilter.addEventListener('change', () => renderStudentAssignments());
  }
});

// ── LAB ATTENDANCE SUBMISSION ───────────────────────
async function getDeviceId() {
  // LocalStorage UUID (Primary Device ID to prevent identical phone collisions)
  let deviceId = localStorage.getItem('smart_attend_device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID ? crypto.randomUUID() : 'id_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    localStorage.setItem('smart_attend_device_id', deviceId);
  }
  return deviceId;
}

window.submitLabCode = async function() {
  const codeInput = document.getElementById('labCodeInput');
  const code = codeInput.value.trim();
  const msgEl = document.getElementById('labCodeMessage');
  const btn = document.getElementById('submitLabCodeBtn');
  
  if (!code || code.length < 6) {
    msgEl.style.display = 'block';
    msgEl.style.color = '#ef4444';
    msgEl.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Please enter a valid 6-digit code.';
    return;
  }

  const studentId = sessionStorage.getItem('studentId');
  if (!studentId) {
    alert("Session error. Please login again.");
    return;
  }

  // UI Loading State
  btn.disabled = true;
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Verifying...';
  msgEl.style.display = 'none';

  try {
    const deviceId = await getDeviceId();
    const SCRIPT_URL = window.SMART_ATTEND_CONFIG.SCRIPT_URL;
    
    const payload = {
      sheet: 'student',
      action: 'verify_lab_code',
      studentId: studentId,
      code: code,
      deviceId: deviceId
    };

    const res = await fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    
    msgEl.style.display = 'block';
    if (data.status === 'success') {
      msgEl.style.color = '#10b981';
      msgEl.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${data.message}`;
      codeInput.value = ''; // clear
      
      // Auto-refresh the dashboard to show updated stats
      setTimeout(() => location.reload(), 2500);
    } else {
      msgEl.style.color = '#ef4444';
      msgEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${data.message}`;
    }
  } catch (error) {
    console.error("Lab verification error:", error);
    msgEl.style.display = 'block';
    msgEl.style.color = '#ef4444';
    msgEl.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> Network error. Please try again.`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
};

// ── RENDER STUDENT ASSIGNMENTS ────────────────────────────────
window.renderStudentAssignments = function() {
  const container = document.getElementById('studentAssignmentsList');
  if (!container) return;

  const semFilter = document.getElementById('assignmentSemFilter')?.value; // e.g. "2"
  const subjectFilter = document.getElementById('assignmentSubjectFilter')?.value; // e.g. "relational database management system (rdbms)"
  const dateFilter = document.getElementById('assignmentDateFilter')?.value; // yyyy-mm-dd
  
  const assignments = window.studentAssignments || [];
  
  let filtered = assignments;

  // 1. Filter by Semester if specified
  if (semFilter) {
    filtered = filtered.filter(a => {
      const aSem = (a.Semester || '').toString().toLowerCase().trim().replace(/[^0-9]/g, '');
      return aSem === semFilter;
    });
  }

  // 2. Filter by Subject if specified
  if (subjectFilter) {
    filtered = filtered.filter(a => {
      const aSub = (a.Subject || '').toLowerCase().trim();
      return aSub === subjectFilter;
    });
  }

  // 3. Filter by Date if specified
  if (dateFilter) {
    filtered = filtered.filter(a => a.Date === dateFilter);
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 50px;">
        <i class="fa-solid fa-folder-open" style="font-size: 28px; margin-bottom: 8px;"></i>
        <p style="margin: 0;">No assignments found${dateFilter ? ' for this date' : ''}.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(a => {
    // Format Date given
    let dateStr = a.Date || 'N/A';
    try {
      if (a.Date && a.Date.includes('-')) {
        const parts = a.Date.split('-');
        if (parts.length === 3) dateStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    } catch(e) {}
    
    // Format Due Date
    let dueDateStr = a.DueDate || 'N/A';
    try {
      if (a.DueDate && a.DueDate.includes('-')) {
        const parts = a.DueDate.split('-');
        if (parts.length === 3) dueDateStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    } catch(e) {}

    // Download link
    let downloadHtml = '';
    if (a.AttachmentURL && a.AttachmentURL.startsWith('http')) {
      downloadHtml = `
        <a href="${a.AttachmentURL}" target="_blank" class="btn btn-outline" style="padding: 6px 12px; border: 1px solid rgba(16, 185, 129, 0.3); color: #34d399; text-decoration: none; font-size: 13px; display: inline-flex; align-items: center; gap: 6px; width: fit-content; transition: all 0.3s;" onmouseover="this.style.background='rgba(16, 185, 129, 0.1)';" onmouseout="this.style.background='transparent';">
          <i class="fa-solid fa-download"></i> Download Assignment (${a.AttachmentName || 'File'})
        </a>
      `;
    } else {
      downloadHtml = `<span style="font-size:12px; color:var(--text-muted); font-style:italic;">No attachment file</span>`;
    }

    // Due Date Red Box styling
    let dueDateBox = `
      <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 6px 12px; font-weight: 700; color: #ef4444; font-size: 13px; display: inline-flex; align-items: center; gap: 6px; width: fit-content;">
        <i class="fa-solid fa-clock"></i> Due: ${dueDateStr}
      </div>
    `;

    return `
      <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid var(--glass-border); border-radius: 12px; padding: 18px; display: flex; flex-direction: column; gap: 12px; transition: all 0.3s;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 10px;">
          <div>
            <h4 style="margin: 0 0 4px 0; font-size: 16px; color: white;">${a.Title || 'No Title'}</h4>
            <div style="font-size: 12px; color: var(--text-muted); display: flex; gap: 8px; align-items: center;">
              <span><i class="fa-solid fa-book"></i> ${a.Subject || 'Subject'}</span>
              <span>•</span>
              <span><i class="fa-solid fa-user-tie"></i> Professor: ${a.ProfessorEmail || 'N/A'}</span>
              <span>•</span>
              <span><i class="fa-solid fa-calendar"></i> Given: ${dateStr}</span>
            </div>
          </div>
          ${dueDateBox}
        </div>
        <p style="margin: 0; font-size: 13px; color: var(--text-muted); line-height: 1.5; white-space: pre-wrap;">${a.Description || 'No description provided.'}</p>
        <div style="display: flex; align-items: center; margin-top: 4px;">
          ${downloadHtml}
        </div>
      </div>
    `;
  }).join('');
};

// Helper for robust department matching
function isDeptMatchLocal(d1, d2) {
  if (!d1 || !d2) return false;
  const a = d1.toString().toLowerCase().trim().replace(/[\s_]/g, '');
  const b = d2.toString().toLowerCase().trim().replace(/[\s_]/g, '');
  if (a === b) return true;
  
  // check abbreviations
  const abbrev = (str) => str.split(/[\s_]+/).map(w => w[0]).join('');
  const aAbbrev = abbrev(d1.toString().toLowerCase().trim());
  const bAbbrev = abbrev(d2.toString().toLowerCase().trim());
  if (aAbbrev === b && bAbbrev === a) return true;
  if (a.indexOf(b) !== -1 || b.indexOf(a) !== -1) return true;
  
  const maps = {
    "bca": "bachelorofcomputerapplication",
    "bba": "bachelorofbusinessadministration",
    "mca": "masterofcomputerapplication",
    "mba": "masterofbusinessadministration"
  };
  if (maps[a] === b || maps[b] === a) return true;
  return false;
}

// Populate Subject filter dropdown dynamically based on registered subjects, department, and semester
window.populateSubjectFilter = function(deptCode, selectedSemNum) {
  const subjectFilterSelect = document.getElementById('assignmentSubjectFilter');
  if (!subjectFilterSelect) return;

  subjectFilterSelect.innerHTML = '<option value="">All Subjects</option>';
  
  if (!window.allRegisteredSubjects || !Array.isArray(window.allRegisteredSubjects)) return;

  // Filter registered subjects by student's department and selected semester (if any)
  const filteredSubjects = window.allRegisteredSubjects.filter(sub => {
    // Dept match
    const sDept = sub.DeptCode || sub.Department || '';
    const deptMatch = isDeptMatchLocal(sDept, deptCode);
    if (!deptMatch) return false;

    // Sem match (if sem selected)
    if (selectedSemNum) {
      // Format selected semester number to match database schema (e.g. "3" -> "3rd sem")
      const formattedSem = selectedSemNum == 1 ? "1st sem" : 
                           selectedSemNum == 2 ? "2nd sem" : 
                           selectedSemNum == 3 ? "3rd sem" : 
                           selectedSemNum + "th sem";
      const sSem = (sub.Semester || '').toString().toLowerCase().trim();
      return sSem === formattedSem;
    }

    return true;
  });

  // Extract unique subject names
  const uniqueSubNames = [...new Set(filteredSubjects.map(sub => sub.Name).filter(Boolean))];
  uniqueSubNames.sort().forEach(sub => {
    const opt = document.createElement('option');
    opt.value = sub.toLowerCase().trim();
    opt.textContent = sub;
    subjectFilterSelect.appendChild(opt);
  });
};
