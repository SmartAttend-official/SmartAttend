// Global Initialization
document.addEventListener('DOMContentLoaded', async () => {
    // 1. Sidebar Active State
    const currentUrl = window.location.pathname.split('/').pop() || 'History.html';
    document.querySelectorAll('.nav-links a').forEach(link => {
        if (link.getAttribute('href') === currentUrl) link.classList.add('active');
    });

    // 2. Profile Info
    const name = sessionStorage.getItem('userName') || 'Professor';
    const email = sessionStorage.getItem('userEmail') || '';
    if (document.getElementById('topbarName')) document.getElementById('topbarName').innerText = name;
    if (document.getElementById('topbarEmail')) document.getElementById('topbarEmail').innerText = email;
    if (document.getElementById('topbarAvatar')) document.getElementById('topbarAvatar').innerText = name.charAt(0).toUpperCase();

    // 3. Set default date to today
    const dateInput = document.getElementById('historyDate');
    const today = new Date().toLocaleDateString('en-CA');
    if (dateInput) dateInput.value = today;

    // 4. Load Data
    await fetchDepartments();
    const allSubjects = await fetchAllSubjects();

    // 5. Dynamic Filtering Logic
    const deptSelect = document.getElementById('historyDept');
    const semSelect = document.getElementById('historySem');
    const subSelect = document.getElementById('historySub');

    const updateSubjects = () => {
        const selectedDept = deptSelect.value;
        const selectedSem = semSelect.value;

        subSelect.innerHTML = '<option value="">Select Subject</option>';
        if (!selectedDept || !selectedSem) return;

        const filtered = allSubjects.filter(s => {
            const sDept = (s.DeptCode || s.Department || "").toString().toLowerCase();
            const sSem = (s.Semester || "").toString().toLowerCase();
            return sDept === selectedDept.toLowerCase() && sSem === selectedSem.toLowerCase();
        });

        filtered.forEach(sub => {
            const opt = document.createElement('option');
            opt.value = sub.Code || sub.Name;
            opt.textContent = sub.Name;
            subSelect.appendChild(opt);
        });
    };

    deptSelect.addEventListener('change', updateSubjects);
    semSelect.addEventListener('change', updateSubjects);
});

async function fetchAllSubjects() {
    try {
        const SCRIPT_URL = window.SMART_ATTEND_CONFIG.SCRIPT_URL;
        const resp = await fetch(`${SCRIPT_URL}?sheet=subjects`);
        return await resp.json();
    } catch (e) {
        console.error("Failed to load subjects", e);
        return [];
    }
}

async function fetchDepartments() {
    try {
        const SCRIPT_URL = window.SMART_ATTEND_CONFIG.SCRIPT_URL;
        const resp = await fetch(`${SCRIPT_URL}?sheet=departments`);
        const depts = await resp.json();
        window.SMART_ATTEND_DEPTS = depts;

        const deptSelect = document.getElementById('historyDept');
        if (deptSelect) {
            deptSelect.innerHTML = '<option value="">Select Department</option>';
            depts.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.Code || d.Name;
                opt.textContent = d.Name;
                deptSelect.appendChild(opt);
            });
        }
    } catch (e) {
        console.error("Failed to load departments", e);
    }
}

// Fetch History Logic
async function fetchHistory() {
    const date = document.getElementById('historyDate').value;
    
    const deptSelect = document.getElementById('historyDept');
    const semSelect = document.getElementById('historySem');
    const subSelect = document.getElementById('historySub');
    
    const deptValue = deptSelect.value;
    const semValue = semSelect.value;
    const subValue = subSelect.value;

    if (!date || !deptValue || !semValue || !subValue) {
        alert("Please select all filters (Date, Department, Semester, and Subject) to search.");
        return;
    }

    // Match exact strings used during saving (in start_attendance.js)
    const deptName = deptSelect.options[deptSelect.selectedIndex].text;
    const semName = semValue.toLowerCase(); // converts "1st Sem" to "1st sem"
    const baseSubName = subSelect.options[subSelect.selectedIndex].text;
    
    // NEW: Session Type Logic
    const sessionType = document.getElementById('historyType') ? document.getElementById('historyType').value : 'All';
    const labSubName = baseSubName + " (Lab)";

    const tbody = document.getElementById('historyTbody');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: var(--text-muted);"><i class="fa-solid fa-spinner fa-spin"></i> Searching historical logs...</td></tr>';

    try {
        const SCRIPT_URL = window.SMART_ATTEND_CONFIG.SCRIPT_URL;
        let data = [];

        // Fetch Theory Class Records
        if (sessionType === 'All' || sessionType === 'Class') {
            const fetchUrlClass = `${SCRIPT_URL}?sheet=attendance_history&date=${encodeURIComponent(date)}&dept=${encodeURIComponent(deptName)}&sem=${encodeURIComponent(semName)}&sub=${encodeURIComponent(baseSubName)}`;
            const resClass = await fetch(fetchUrlClass);
            const dataClass = await resClass.json();
            if (Array.isArray(dataClass)) data = data.concat(dataClass);
        }

        // Fetch Lab Session Records
        if (sessionType === 'All' || sessionType === 'Lab') {
            const fetchUrlLab = `${SCRIPT_URL}?sheet=attendance_history&date=${encodeURIComponent(date)}&dept=${encodeURIComponent(deptName)}&sem=${encodeURIComponent(semName)}&sub=${encodeURIComponent(labSubName)}`;
            const resLab = await fetch(fetchUrlLab);
            const dataLab = await resLab.json();
            if (Array.isArray(dataLab)) data = data.concat(dataLab);
        }

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 60px; color: var(--text-muted);">No records found for the selected criteria.</td></tr>';
            return;
        }

        // Fetch student names to supplement the history logs (which store IDs)
        const studentRes = await fetch(`${SCRIPT_URL}?sheet=student`);
        const students = await studentRes.json();
        const studentNameMap = {};
        students.forEach(s => studentNameMap[String(s.ID || s.id)] = s.Name || s.NAME || "Unknown");

        tbody.innerHTML = '';
        data.forEach(log => {
            const tr = document.createElement('tr');
            const statusClass = (log.Status || '').toLowerCase() === 'present' ? 'badge-success' : 'badge-danger';
            const studentName = studentNameMap[String(log.StudentID)] || "Unknown Student";

            tr.innerHTML = `
                <td>${log.StudentID}</td>
                <td><strong>${studentName}</strong></td>
                <td><span class="badge ${statusClass}">${log.Status}</span></td>
                <td>${log.Date}</td>
                <td style="color: var(--text-muted); font-size: 13px;">${log.Subject}</td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error("Failed to fetch history:", err);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: #ef4444;">Error retrieving data from server.</td></tr>';
    }
}
