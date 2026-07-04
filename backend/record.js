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

// Modal Functions
let currentRowToEdit = null;

function openEditModal(btnElement) {
  currentRowToEdit = btnElement.closest('tr');
  const studentId = currentRowToEdit.querySelector('td:nth-child(1)').innerText.trim();
  const name = currentRowToEdit.querySelector('.student-name').innerText.trim();
  const email = currentRowToEdit.querySelector('.student-email').innerText.trim();
  const sem = currentRowToEdit.querySelector('td:nth-child(4)').innerText.trim();
  document.getElementById('editId').value = studentId;
  document.getElementById('editName').value = name;
  document.getElementById('editEmail').value = email;

  // Pre-select current semester
  const semSelect = document.getElementById('editSem');
  const options = Array.from(semSelect.options);
  const match = options.find(o => o.value === sem || o.text.startsWith(sem));
  if (match) semSelect.value = match.value;

  document.getElementById('editModal').classList.add('active');
}

function closeEditModal() {
  document.getElementById('editModal').classList.remove('active');
  currentRowToEdit = null;
}

async function handleDeleteStudent() {
  const rawId = document.getElementById('editId').value;
  if (!rawId) return;

  const studentId = rawId.trim();
  if (!confirm(`Are you sure you want to delete student ${studentId}?`)) return;

  const btn = document.querySelector('button[onclick="handleDeleteStudent()"]');
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
  btn.disabled = true;

  try {
    const SCRIPT_URL = window.SMART_ATTEND_CONFIG.SCRIPT_URL;
    await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheet: 'student', action: 'delete', id: studentId })
    });

    await fetchRecords();
    closeEditModal();
    alert('Student deleted successfully!');
  } catch (err) {
    console.error(err);
    alert('Failed to delete student.');
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

async function handleEditSubmit(event) {
  event.preventDefault();

  if (currentRowToEdit) {
    const newName = document.getElementById('editName').value.trim();
    const newEmail = document.getElementById('editEmail').value.trim();
    const newSem = document.getElementById('editSem').value;
    const newAttendance = parseInt(document.getElementById('editAttendance').value);
    const studentId = document.getElementById('editId').value.trim();

    // ── Save to Google Sheets (persist semester & name permanently) ──
    const btn = document.querySelector('#editStudentForm .btn-save');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    btn.disabled = true;

    try {
      const SCRIPT_URL = window.SMART_ATTEND_CONFIG.SCRIPT_URL;
      await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheet: 'student', action: 'update', id: studentId, data: { Name: newName, Semester: newSem, 'Email': newEmail } })
      });
    } catch (err) {
      console.error('Failed to save to Google Sheets:', err);
    } finally {
      btn.innerHTML = originalText;
      btn.disabled = false;
    }

    // ── Update DOM row instantly ──
    currentRowToEdit.querySelector('.student-name').innerText = newName;
    currentRowToEdit.querySelector('.student-email').innerText = newEmail;
    currentRowToEdit.querySelector('.student-avatar').innerText = newName.charAt(0).toUpperCase();
    currentRowToEdit.querySelector('td:nth-child(4)').innerText = newSem;

    // Attendance logic removed
  }

  closeEditModal();
}

function filterRecords() {
  const searchValue = document.getElementById('searchInput').value.toLowerCase().trim();
  const semesterValue = document.getElementById('semesterFilter').value;
  const departmentValue = document.getElementById('departmentFilter').value;
  const rows = document.querySelectorAll('.records-table tbody tr');

  // ── ID Lookup: show name + semester when input looks like an ID ──
  const lookupResult = document.getElementById('idLookupResult');
  const lookupText = document.getElementById('idLookupText');
  let foundByID = null;
  if (searchValue.length >= 2) {
    rows.forEach(row => {
      const idCell = row.querySelector('td:nth-child(1)');
      if (idCell && idCell.innerText.toLowerCase().trim() === searchValue) {
        const name = row.querySelector('.student-name')?.innerText.trim() || '';
        const sem = row.querySelector('td:nth-child(4)')?.innerText.trim() || '';
        foundByID = { name, sem };
      }
    });
  }
  if (foundByID) {
    lookupText.innerText = `${foundByID.name} — ${foundByID.sem}`;
    lookupResult.style.display = 'block';
  } else {
    lookupResult.style.display = 'none';
  }

    rows.forEach(row => {
    const textContent = row.innerText.toLowerCase();
    const deptText = row.querySelector('td:nth-child(3)').innerText.trim();
    const semesterText = row.querySelector('td:nth-child(4)').innerText.trim();
    
    const matchesSearch = textContent.includes(searchValue);
    
    // Flexible semester matching (matches '1' with '1st Sem' etc)
    const matchesSemester = (semesterValue === 'all') || 
                           (semesterText === semesterValue) || 
                           (semesterText.toLowerCase().includes(semesterValue.toLowerCase().replace('st sem','').replace('nd sem','').replace('rd sem','').replace('th sem','').trim()));

    const matchesDepartment = (departmentValue === 'all') || isDeptMatch(deptText, departmentValue);

    if (matchesSearch && matchesSemester && matchesDepartment) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

function openViewModal(btnElement) {
  const row = btnElement.closest('tr');
  const studentId = row.querySelector('td:nth-child(1)').innerText;
  const name = row.querySelector('.student-name').innerText;
  const email = row.querySelector('.student-email').innerText;
  const dept = row.querySelector('td:nth-child(3)').innerText;
  const sem = row.querySelector('td:nth-child(4)').innerText;
  document.getElementById('viewAvatar').innerText = name.charAt(0).toUpperCase();
  document.getElementById('viewName').innerText = name;
  document.getElementById('viewId').innerText = studentId;
  document.getElementById('viewEmail').innerText = email;
  document.getElementById('viewDeptText').innerText = dept;
  document.getElementById('viewSemText').innerText = sem;

  // Assign random nice gradient to avatar background
  const gradients = [
    'linear-gradient(135deg, #3b82f6, #8b5cf6)',
    'linear-gradient(135deg, #ec4899, #f43f5e)',
    'linear-gradient(135deg, #10b981, #3b82f6)',
    'linear-gradient(135deg, #f59e0b, #ef4444)'
  ];
  document.getElementById('viewAvatar').style.background = gradients[name.length % gradients.length];

  document.getElementById('viewModal').classList.add('active');
}

function closeViewModal() {
  document.getElementById('viewModal').classList.remove('active');
}

// Fetch and Render records from Google Sheets API
const API_URL = `${window.SMART_ATTEND_CONFIG.SCRIPT_URL}?sheet=student`;

async function fetchRecords() {
  try {
    const response = await fetch(API_URL);
    const data = await response.json();

    // Sort data by ID to ensure sequence is maintained
    data.sort((a, b) => {
      if (!a.ID) return 1;
      if (!b.ID) return -1;
      return a.ID.localeCompare(b.ID, undefined, { numeric: true, sensitivity: 'base' });
    });

    const tbody = document.getElementById('recordsTbody');
    tbody.innerHTML = ''; // Clear loading spinner

    data.forEach(student => {
      const percentage = parseFloat(student.Attendance_Percentage || student.Percentage || student.PERCENTAGE) || 0;
      const statusColor = percentage >= 75 ? '#34d399' : '#f87171';
      const statusText = percentage >= 75 ? 'Safe' : 'Below Threshold';
      const badgeClass = percentage >= 75 ? 'badge-success' : 'badge-danger';

      const studentName = student.Name || student.NAME || student['Student Name'] || student.Student_Name || 'Unknown';
      const initial = studentName !== 'Unknown' ? studentName.charAt(0).toUpperCase() : 'U';
      
      const dept = student.Department || student.DEPARTMENT || student.DEPT || student.Dept || student.dept || student.DepartmentName || 'N/A';
      const sem = student.Semester || student.SEMESTER || student.Sem || 'Not Set';
      const email = student.Email || student.EMAIL || student.email || 'N/A';
      const studentId = student.ID || student.id || student.StudentID || student.RollNo || 'N/A';

      const gradients = ['linear-gradient(135deg, #3b82f6, #8b5cf6)', 'linear-gradient(135deg, #ec4899, #f43f5e)', 'linear-gradient(135deg, #10b981, #3b82f6)', 'linear-gradient(135deg, #f59e0b, #ef4444)'];
      const gradient = gradients[studentName.length % gradients.length];
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${studentId}</td>
        <td>
          <div class="student-info">
            <div class="student-avatar" style="background: ${gradient}">${initial}</div>
            <div class="student-details">
              <span class="student-name">${studentName}</span>
              <span class="student-email">${email}</span>
            </div>
          </div>
        </td>
        <td>${dept}</td>
        <td>${sem}</td>
        <td style="font-weight: 700; color: ${statusColor}">${percentage.toFixed(1)}%</td>
        <td><span class="badge ${badgeClass}">${statusText}</span></td>
        <td>
          <button class="action-btn view-new-btn"><i class="fa-solid fa-eye"></i></button>
          <button class="action-btn edit-new-btn"><i class="fa-solid fa-pen-to-square"></i></button>
        </td>
      `;
      tr.querySelector('.view-new-btn').addEventListener('click', function () { openViewModal(this); });
      tr.querySelector('.edit-new-btn').addEventListener('click', function () { openEditModal(this); });
      tbody.appendChild(tr);
    });
  } catch (e) {
    console.error("Failed to load records from Google Sheets", e);
    document.getElementById('recordsTbody').innerHTML = '<tr><td colspan="7" style="text-align: center; color: #ef4444;">Failed to load data from Google Sheets</td></tr>';
  }
}

// Attach click listeners to all edit buttons
document.addEventListener('DOMContentLoaded', () => {
  // Setup Search and Filter
  document.getElementById('searchInput').addEventListener('input', filterRecords);
  document.getElementById('semesterFilter').addEventListener('change', filterRecords);
  document.getElementById('departmentFilter').addEventListener('change', filterRecords);

  // Fetch Live Google Sheets Data
  fetchRecords();
  fetchDepartments();
});

async function fetchDepartments() {
  try {
    const SCRIPT_URL = window.SMART_ATTEND_CONFIG.SCRIPT_URL;
    const resp = await fetch(`${SCRIPT_URL}?sheet=departments`);
    const depts = await resp.json();
    window.SMART_ATTEND_DEPTS = depts;

    const deptFilter = document.getElementById('departmentFilter');
    const addDeptSelect = document.getElementById('addDept');
    
    if (deptFilter) {
      deptFilter.innerHTML = '<option value="all" style="background: var(--bg-dark); color: white;">All Departments</option>';
      depts.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.Code || d.Name;
        opt.textContent = d.Name;
        opt.style.background = 'var(--bg-dark)';
        opt.style.color = 'white';
        deptFilter.appendChild(opt);
      });
    }

    if (addDeptSelect) {
      addDeptSelect.innerHTML = '<option value="" disabled selected>Select Department</option>';
      depts.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.Code || d.Name;
        opt.textContent = d.Name;
        addDeptSelect.appendChild(opt);
      });
    }
  } catch (e) {
    console.error("Failed to load departments", e);
  }
}

function isDeptMatch(recordDept, filterValue) {
  if (!recordDept || !filterValue) return false;
  const rDept = recordDept.toString().trim().toLowerCase();
  const fValue = filterValue.toString().trim().toLowerCase();
  
  if (rDept === fValue) return true;
  if (rDept.includes(fValue) || fValue.includes(rDept)) return true;

  const depts = window.SMART_ATTEND_DEPTS || [];
  const deptInfo = depts.find(d => 
    (d.Code && d.Code.toString().trim().toLowerCase() === fValue) ||
    (d.Name && d.Name.toString().trim().toLowerCase() === fValue)
  );

  if (deptInfo) {
    const code = (deptInfo.Code || '').toString().trim().toLowerCase();
    const name = (deptInfo.Name || '').toString().trim().toLowerCase();
    return rDept === code || rDept === name || rDept.includes(name) || name.includes(rDept);
  }
  return false;
}

// ── 📤 EXCEL EXPORT ───────────────────────────────────────────────────────
function exportToExcel() {
  const rows = document.querySelectorAll('.records-table tbody tr');
  if (!rows.length) { alert('No data to export!'); return; }

  const data = [['Roll No', 'Name', 'Department', 'Semester', 'Status']];
  rows.forEach(row => {
    const cells = row.querySelectorAll('td');
    if (cells.length < 6) return;
    data.push([
      cells[0].innerText.trim(),
      row.querySelector('.student-name')?.innerText.trim() || '',
      cells[2].innerText.trim(),
      cells[3].innerText.trim(),
      cells[5].innerText.trim()
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(data);
  ws['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 20 }, { wch: 12 }, { wch: 15 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Student Records');
  XLSX.writeFile(wb, 'SmartAttend_Records.xlsx');
}


// Export HTML Table to CSV
function exportTableToCSV(filename) {
  const csv = [];
  const rows = document.querySelectorAll("table tr");

  for (let i = 0; i < rows.length; i++) {
    const row = [], cols = rows[i].querySelectorAll("td, th");
    // Skip rows that are hidden
    if (rows[i].style.display === "none") continue;

    // Skip the last column (Actions)
    for (let j = 0; j < cols.length; j++) {
      if (cols[j].innerText === 'Actions' || cols[j].querySelector('.action-btn')) continue;
      let text = cols[j].innerText.replace(/(\r\n|\n|\r)/gm, " ");
      text = text.trim();
      row.push('"' + text + '"');
    }
    if (row.length > 0) csv.push(row.join(","));
  }
  downloadCSV(csv.join("\n"), filename);
}

// Export HTML Table to PDF
function exportTableToPDF(filename) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("SmartAttend University Report", 14, 22);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text("Student Records & Attendance Data", 14, 30);

  const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.text("Generated: " + dateStr, 14, 38);

  const rows = [];
  const tableRows = document.querySelectorAll("table tr");

  for (let i = 1; i < tableRows.length; i++) { // Skip header row
    const rowData = [];
    const cols = tableRows[i].querySelectorAll("td");

    // Skip hidden rows
    if (tableRows[i].style.display === "none") continue;

    for (let j = 0; j < cols.length - 1; j++) { // Skip actions col
      rowData.push(cols[j].innerText.replace(/(\r\n|\n|\r)/gm, " ").trim());
    }
    if (rowData.length > 0) rows.push(rowData);
  }

  doc.autoTable({
    head: [['Roll No', 'Student Details', 'Department', 'Semester', 'Attendance %', 'Status']],
    body: rows,
    startY: 45,
    theme: 'grid',
    styles: { font: "helvetica", fontSize: 10, cellPadding: 4 },
    headStyles: { fillColor: [59, 130, 246] }
  });

  doc.save(filename);
}

function downloadCSV(csv, filename) {
  let csvFile = new Blob([csv], { type: "text/csv" });
  let downloadLink = document.createElement("a");
  downloadLink.download = filename;
  downloadLink.href = window.URL.createObjectURL(csvFile);
  downloadLink.style.display = "none";
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
}

// Global UX Polish
document.addEventListener('DOMContentLoaded', () => {
  // Auto active sidebar
  const currentUrl = window.location.pathname.split('/').pop() || 'Record.html';
  document.querySelectorAll('.nav-links a').forEach(link => {
    if (link.getAttribute('href') === currentUrl) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
});

// Inject dynamic user data globally
document.addEventListener('DOMContentLoaded', () => {
  const name = sessionStorage.getItem('userName') || 'Professor';
  const email = sessionStorage.getItem('userEmail') || '';

  const topbarName = document.getElementById('topbarName');
  if (topbarName) topbarName.innerText = name;

  const topbarEmail = document.getElementById('topbarEmail');
  if (topbarEmail) topbarEmail.innerText = email;

  const topbarAvatar = document.getElementById('topbarAvatar');
  if (topbarAvatar && name) topbarAvatar.innerText = name.charAt(0).toUpperCase();
});
