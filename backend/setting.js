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

// Global UX Polish
document.addEventListener('DOMContentLoaded', () => {
  // Auto active sidebar
  const currentUrl = window.location.pathname.split('/').pop() || 'Setting.html';
  document.querySelectorAll('.nav-links a').forEach(link => {
    if (link.getAttribute('href') === currentUrl) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // Camera URL Logic
  const urlInput = document.getElementById('ipCameraUrlInput');
  const savedUrl = localStorage.getItem('ipCameraUrl');
  if (savedUrl) {
    urlInput.value = savedUrl;
  }

  // Email Toggle State Persistence
  const emailToggle = document.getElementById('emailToggle');
  if (emailToggle && localStorage.getItem('emailEnabled') === 'true') {
    emailToggle.checked = true;
  }
  if (emailToggle) {
    emailToggle.addEventListener('change', (e) => {
      localStorage.setItem('emailEnabled', e.target.checked);
    });
  }

  // SMS Toggle State Persistence
  const smsToggle = document.getElementById('smsToggle');
  if (smsToggle && localStorage.getItem('smsEnabled') === 'true') {
    smsToggle.checked = true;
  }
  if (smsToggle) {
    smsToggle.addEventListener('change', (e) => {
      localStorage.setItem('smsEnabled', e.target.checked);
    });
  }

  document.getElementById('saveCameraBtn').addEventListener('click', () => {
    let val = urlInput.value.trim();

    // Validate — must not be empty or just "http://"
    if (!val || val === 'http://' || val === 'https://') {
      alert('Please enter a valid IP Camera URL (e.g. http://192.168.1.5:8080/video)');
      return;
    }

    // Auto-add http:// prefix if missing
    if (!val.startsWith('http://') && !val.startsWith('https://')) {
      val = 'http://' + val;
    }

    urlInput.value = val;
    localStorage.setItem('ipCameraUrl', val);

    const alertBox = document.getElementById('successAlert');
    if(alertBox) {
      alertBox.classList.add('show');
      setTimeout(() => alertBox.classList.remove('show'), 3500);
    }
  });

  const testConnectionBtn = document.getElementById('testConnectionBtn');
  if (testConnectionBtn) {
    testConnectionBtn.addEventListener('click', () => {
      let val = urlInput.value.trim();
      if (!val || val === 'http://' || val === 'https://') {
        alert('Please enter a valid IP Camera URL to test.');
        return;
      }
      if (!val.startsWith('http://') && !val.startsWith('https://')) {
        val = 'http://' + val;
      }

      const originalText = testConnectionBtn.innerHTML;
      testConnectionBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Testing...';
      testConnectionBtn.style.color = '#f8fafc';
      testConnectionBtn.style.borderColor = 'var(--glass-border)';
      testConnectionBtn.disabled = true;

      // Silent Ping
      fetch(val, { mode: 'no-cors', cache: 'no-store' })
        .then(() => {
          testConnectionBtn.innerHTML = '<i class="fa-solid fa-circle-check"></i> Connected';
          testConnectionBtn.style.color = '#10b981';
          testConnectionBtn.style.borderColor = '#10b981';
          setTimeout(() => resetBtn(), 3000);
        })
        .catch(() => {
          testConnectionBtn.innerHTML = '<i class="fa-solid fa-circle-xmark"></i> Failed';
          testConnectionBtn.style.color = '#ef4444';
          testConnectionBtn.style.borderColor = '#ef4444';
          setTimeout(() => resetBtn(), 3000);
        });

      function resetBtn() {
        testConnectionBtn.innerHTML = originalText;
        testConnectionBtn.style.color = 'white';
        testConnectionBtn.style.borderColor = 'var(--glass-border)';
        testConnectionBtn.disabled = false;
      }
    });
  }
});

// Inject dynamic user data globally
document.addEventListener('DOMContentLoaded', () => {
  const name = sessionStorage.getItem('userName') || 'Professor';
  const email = sessionStorage.getItem('userEmail') || '';
  
  const topbarName = document.getElementById('topbarName');
  if(topbarName) topbarName.innerText = name;
  
  const topbarEmail = document.getElementById('topbarEmail');
  if(topbarEmail) topbarEmail.innerText = email;

  const topbarAvatar = document.getElementById('topbarAvatar');
  if(topbarAvatar && name) topbarAvatar.innerText = name.charAt(0).toUpperCase();
});

// --- Analytic Reports Logic ---
document.addEventListener('DOMContentLoaded', async () => {
  const deptSelect = document.getElementById('reportDept');
  const semSelect = document.getElementById('reportSem');
  const subjectSelect = document.getElementById('reportSub');
  const timeframeSelect = document.getElementById('reportTimeframe');
  const emailBtn = document.getElementById('emailReportBtn');
  const btnIcon = document.getElementById('reportBtnIcon');
  const btnText = document.getElementById('reportBtnText');

  if (!deptSelect) return;

  try {
    const [depts, subjects] = await Promise.all([
      fetch(`${window.SMART_ATTEND_CONFIG.SCRIPT_URL}?sheet=departments`).then(res => res.json()),
      fetch(`${window.SMART_ATTEND_CONFIG.SCRIPT_URL}?sheet=subjects`).then(res => res.json())
    ]);

    deptSelect.innerHTML = '<option value="" disabled selected>Select Department</option>';
    if (Array.isArray(depts)) {
      depts.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.Code;
        opt.textContent = d.Name;
        deptSelect.appendChild(opt);
      });
    }

    const updateSubjects = () => {
      const selectedDept = deptSelect.value;
      const rawSem = semSelect.value;
      const formattedSem = rawSem ? (rawSem == 1 ? "1st sem" : rawSem == 2 ? "2nd sem" : rawSem == 3 ? "3rd sem" : rawSem + "th sem") : "";

      if (!selectedDept || !rawSem) {
        subjectSelect.innerHTML = '<option value="" disabled selected>Select Subject (Choose Dept & Sem)</option>';
        return;
      }

      const filteredSubjects = Array.isArray(subjects) ? subjects.filter(s => {
        return (s.DeptCode || s.Department || "").toString().toLowerCase() === selectedDept.toLowerCase() && 
               (s.Semester || "").toString().toLowerCase() === formattedSem.toLowerCase();
      }) : [];

      if (filteredSubjects.length === 0) {
        subjectSelect.innerHTML = '<option value="" disabled>No subjects found</option>';
      } else {
        subjectSelect.innerHTML = '<option value="" disabled selected>Select Subject</option>';
        subjectSelect.innerHTML += '<option value="All Subjects">All Subjects</option>';
        filteredSubjects.forEach(sub => {
          const opt = document.createElement('option');
          opt.value = sub.Code || sub.Name;
          opt.textContent = `${sub.Name} (${sub.Code || ''})`;
          subjectSelect.appendChild(opt);
        });
      }
    };

    deptSelect.addEventListener('change', updateSubjects);
    semSelect.addEventListener('change', updateSubjects);

  } catch (e) {
    console.error("Failed to load dropdowns:", e);
    deptSelect.innerHTML = '<option value="" disabled>Error loading</option>';
  }

  // Handle Email Report
  emailBtn.addEventListener('click', async () => {
    if (!deptSelect.value || !semSelect.value || !subjectSelect.value || !timeframeSelect.value) {
      alert("Please select Department, Semester, Subject, and Timeframe.");
      return;
    }

    emailBtn.disabled = true;
    btnIcon.className = "fa-solid fa-spinner fa-spin";
    btnText.innerText = "Generating Report...";

    try {
      const sessionTypeElement = document.getElementById('reportSessionType');
      const sessionType = sessionTypeElement ? sessionTypeElement.value : 'All';

      const payload = {
        sheet: 'professor',
        action: 'generate_analytic_report',
        professorEmail: sessionStorage.getItem('userEmail'),
        department: deptSelect.options[deptSelect.selectedIndex].text,
        semester: semSelect.value == 1 ? "1st sem" : semSelect.value == 2 ? "2nd sem" : semSelect.value == 3 ? "3rd sem" : semSelect.value + "th sem",
        subject: subjectSelect.options[subjectSelect.selectedIndex].text.split(' (')[0],
        timeframe: timeframeSelect.value,
        sessionType: sessionType
      };

      const res = await fetch(window.SMART_ATTEND_CONFIG.SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.status === 'success') {
        const alertBox = document.getElementById('successAlert');
        if (alertBox) {
          alertBox.innerHTML = '<i class="fa-solid fa-envelope-circle-check"></i> Report emailed successfully!';
          alertBox.classList.add('show');
          setTimeout(() => alertBox.classList.remove('show'), 3500);
        }
      } else {
        alert("Failed to send report: " + (data.message || "Unknown error"));
      }
    } catch (e) {
      console.error(e);
      alert("An error occurred while generating the report.");
    } finally {
      emailBtn.disabled = false;
      btnIcon.className = "fa-solid fa-paper-plane";
      btnText.innerText = "Email Report to Me";
    }
  });
});

// --- Timetable Logic ---
document.addEventListener('DOMContentLoaded', async () => {
  const profDeptSelect = document.getElementById('profDeptSelect');
  if (profDeptSelect) {
    try {
      const depts = await fetch(`${window.SMART_ATTEND_CONFIG.SCRIPT_URL}?sheet=departments`).then(res => res.json());
      if (Array.isArray(depts)) {
        depts.forEach(d => {
          const opt = document.createElement('option');
          opt.value = d.Name; // Using Name to match backend
          opt.textContent = d.Name;
          profDeptSelect.appendChild(opt);
        });
      }
    } catch (e) {
      console.error("Failed to load departments for timetable", e);
    }
  }
});

window.loadProfTimetable = async () => {
  const dept = document.getElementById('profDeptSelect').value;
  const sem = document.getElementById('profSemSelect').value;
  const resultDiv = document.getElementById('profTimetableResult');

  if (!dept || !sem) {
    alert("Please select both Department and Semester to view the timetable.");
    return;
  }

  resultDiv.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin" style="font-size:32px; color:var(--primary-color); margin-bottom:12px;"></i><p style="color:var(--text-muted); margin:0;">Searching database...</p>';

  try {
    const res = await fetch(`${window.SMART_ATTEND_CONFIG.SCRIPT_URL}?action=get_timetable&department=${encodeURIComponent(dept)}&semester=${encodeURIComponent(sem)}`);
    const data = await res.json();

    if (data.status === 'success' && data.data) {
      const t = data.data;
      resultDiv.innerHTML = `
        <i class="fa-solid fa-calendar-check" style="font-size:32px; color:#10b981; margin-bottom:16px;"></i>
        <h3 style="margin:0 0 8px 0;">Timetable Found</h3>
        <p style="color:var(--text-muted); font-size:14px; margin-bottom:20px;">Uploaded: ${t.UploadedAt || 'Recently'}</p>
        <div style="display:flex; gap:12px; justify-content:center;">
          <a href="${t.ViewURL}" target="_blank" class="btn" style="text-decoration:none; background:#10b981; color:white;"><i class="fa-solid fa-eye"></i> View Online</a>
          <a href="${t.DownloadURL}" target="_blank" class="btn" style="text-decoration:none; background:#10b981; color:white;"><i class="fa-solid fa-download"></i> Download PDF</a>
        </div>
      `;
    } else {
      resultDiv.innerHTML = `
        <i class="fa-solid fa-circle-xmark" style="font-size:32px; color:#ef4444; margin-bottom:12px;"></i>
        <p style="color:var(--text-muted); margin:0;">No timetable found for ${dept} - ${sem}.</p>
      `;
    }
  } catch (err) {
    resultDiv.innerHTML = `
      <i class="fa-solid fa-triangle-exclamation" style="font-size:32px; color:#f59e0b; margin-bottom:12px;"></i>
      <p style="color:var(--text-muted); margin:0;">Error checking timetable. Please try again later.</p>
    `;
  }
};
