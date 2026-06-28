// Configuration
const SCRIPT_URL = window.SMART_ATTEND_CONFIG.SCRIPT_URL;

document.addEventListener('DOMContentLoaded', async function () {
    const dateInput = document.getElementById('date');
    const deptSelect = document.getElementById('department');
    const semSelect = document.getElementById('semester');
    const subjectSelect = document.getElementById('subject');
    const professorEmail = sessionStorage.getItem('userEmail');

    if (dateInput) {
        const todayStr = new Date().toLocaleDateString('en-CA');
        dateInput.value = todayStr;
        dateInput.min = todayStr;
    }

    // --- Loading State ---
    deptSelect.innerHTML = '<option value="" disabled selected>Loading Departments...</option>';
    subjectSelect.innerHTML = '<option value="" disabled selected>Select Subject (Choose Dept & Sem)</option>';

    try {
        // 1. Fetch All Required Data
        const [depts, subjects] = await Promise.all([
            fetch(`${SCRIPT_URL}?sheet=departments`).then(res => res.json()),
            fetch(`${SCRIPT_URL}?sheet=subjects`).then(res => res.json())
        ]);

        // 2. Populate Departments
        deptSelect.innerHTML = '<option value="" disabled selected>Select Department</option>';
        if (Array.isArray(depts)) {
            depts.forEach(d => {
                const opt = document.createElement('option');
                opt.value = d.Code; // Using Code for internal matching
                opt.textContent = d.Name;
                deptSelect.appendChild(opt);
            });
        }

        // 3. Subject Filtering Logic (Triggers on Dept or Sem change)
        const updateSubjects = () => {
            const selectedDept = deptSelect.value;
            const rawSem = semSelect.value;
            
            // Format semester to match database (e.g. "3" -> "3rd sem")
            const formattedSem = rawSem ? (
                rawSem == 1 ? "1st sem" : 
                rawSem == 2 ? "2nd sem" : 
                rawSem == 3 ? "3rd sem" : 
                rawSem + "th sem"
            ) : "";

            if (!selectedDept || !rawSem) {
                subjectSelect.innerHTML = '<option value="" disabled selected>Select Subject (Choose Dept & Sem)</option>';
                return;
            }

            subjectSelect.innerHTML = '<option value="" disabled selected>Searching Subjects...</option>';

            const filteredSubjects = Array.isArray(subjects) ? subjects.filter(s => {
                const sDept = (s.DeptCode || s.Department || "").toString().toLowerCase();
                const sSem = (s.Semester || "").toString().toLowerCase();
                
                return sDept === selectedDept.toLowerCase() && sSem === formattedSem.toLowerCase();
            }) : [];

            if (filteredSubjects.length === 0) {
                subjectSelect.innerHTML = '<option value="" disabled>No subjects found for this criteria</option>';
            } else {
                subjectSelect.innerHTML = '<option value="" disabled selected>Select Subject</option>';
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

    } catch (err) {
        console.error("Failed to fetch academic data:", err);
        deptSelect.innerHTML = '<option value="" disabled>Error loading data</option>';
    }

    // --- Form Submission ---
    document.getElementById('attendanceForm').addEventListener('submit', function (e) {
        e.preventDefault();

        const selectedDate = new Date(dateInput.value);
        const day = selectedDate.getDay(); // 0=Sunday, 6=Saturday
        if (day === 0 || day === 6) {
            const dayName = (day === 0) ? "Sunday" : "Saturday";
            if (window.showGlobalAlert) showGlobalAlert(`Attendance cannot be initialized on a ${dayName}!`);
            return;
        }

        // Standardize data for next screen
        const deptCode = deptSelect.value;
        const deptName = deptSelect.options[deptSelect.selectedIndex].text;
        const semNum = semSelect.value;
        const formattedSem = semNum == 1 ? "1st sem" : semNum == 2 ? "2nd sem" : semNum == 3 ? "3rd sem" : semNum + "th sem";
        const subjectName = subjectSelect.options[subjectSelect.selectedIndex].text.split(' (')[0];
        const subjectCode = subjectSelect.value;

        // Save to localStorage for attendance portal
        localStorage.setItem('activeClassDept', deptName);
        localStorage.setItem('activeClassDeptCode', deptCode);
        localStorage.setItem('activeClassSem', formattedSem);
        localStorage.setItem('activeClassSub', subjectName);
        localStorage.setItem('activeClassSubCode', subjectCode);
        localStorage.setItem('attendanceDate', dateInput.value);

        window.location.href = 'dashboard1.html';
    });
});

// Sidebar & Profile Logic
function toggleProfile() {
    const dropdown = document.getElementById('profileDropdown');
    if (!dropdown) return;
    if (dropdown.style.display === 'flex') {
        dropdown.classList.remove('show');
        setTimeout(() => dropdown.style.display = 'none', 300);
    } else {
        dropdown.style.display = 'flex';
        setTimeout(() => dropdown.classList.add('show'), 10);
    }
}

document.addEventListener('click', function (event) {
    const wrapper = document.querySelector('.user-profile-wrapper');
    const dropdown = document.getElementById('profileDropdown');
    if (wrapper && !wrapper.contains(event.target) && dropdown && dropdown.classList.contains('show')) {
        dropdown.classList.remove('show');
        setTimeout(() => dropdown.style.display = 'none', 300);
    }
});

// Inject user info
document.addEventListener('DOMContentLoaded', () => {
    const name = sessionStorage.getItem('userName') || 'Professor';
    const email = sessionStorage.getItem('userEmail') || '';
    if (document.getElementById('topbarName')) document.getElementById('topbarName').innerText = name;
    if (document.getElementById('topbarEmail')) document.getElementById('topbarEmail').innerText = email;
    if (document.getElementById('topbarAvatar')) document.getElementById('topbarAvatar').innerText = name.charAt(0).toUpperCase();
});

function logoutUser() {
    sessionStorage.clear();
    window.location.replace('Login.html');
}
window.logoutUser = logoutUser;
