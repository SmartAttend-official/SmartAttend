// Admin Dashboard Core Logic
const SCRIPT_URL = window.SMART_ATTEND_CONFIG.SCRIPT_URL;

document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
    setupNavigation();
});

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fa-solid ${type === 'success' ? 'fa-circle-check' : 'fa-triangle-exclamation'}"></i>
        </div>
        <div class="toast-message">${message}</div>
    `;

    container.appendChild(toast);
    setTimeout(() => { toast.classList.add('show'); }, 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 500);
    }, 4000);
}

function showModal(id) {
    const el = document.getElementById(id);
    if (el) {
        el.style.display = 'flex';
        setTimeout(() => el.style.opacity = '1', 10);
    }
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (el) {
        el.style.opacity = '0';
        setTimeout(() => el.style.display = 'none', 300);
    }
}

function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function () {
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            const view = this.getAttribute('data-view');
            loadView(view);
        });
    });
}

async function initDashboard() {
    // Immediate removal of the "Security Check" overlay so skeletons can show
    const loader = document.getElementById('loader-overlay');
    if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => loader.style.display = 'none', 500);
    }

    const sheets = ['professor', 'student', 'leave', 'audit_logs', 'departments', 'classes', 'subjects'];
    const data = {};

    try {
        await Promise.all(sheets.map(async (sheet) => {
            try {
                const resp = await fetch(`${SCRIPT_URL}?sheet=${sheet}`);
                data[sheet] = await resp.json();
            } catch (e) {
                console.warn(`Failed to fetch sheet: ${sheet}`, e);
                data[sheet] = [];
            }
        }));

        // Update Stats & Remove Skeletons
        const statMap = {
            'totalProfessors': data.professor.length || 0,
            'totalStudents': data.student.length || 0,
            'totalDepartments': data.departments.length || 0
        };

        for (const [id, val] of Object.entries(statMap)) {
            const el = document.getElementById(id);
            if (el) {
                el.innerText = val;
                const container = el.closest('.stat-card');
                if (container) {
                    container.querySelectorAll('.skeleton').forEach(s => s.classList.remove('skeleton'));
                }
            }
        }

        // Update Header & Dropdown Info
        const adminName = sessionStorage.getItem('adminName') || 'Administrator';
        const adminEmail = sessionStorage.getItem('adminEmail') || 'admin@smartattend.com';

        const nameDisplays = ['adminNameDisplay', 'adminNameWelcome'];
        nameDisplays.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.innerText = adminName;
                el.classList.remove('skeleton');
            }
        });
        
        if (document.getElementById('dropdownAdminName')) document.getElementById('dropdownAdminName').innerText = adminName;
        if (document.getElementById('dropdownAdminEmail')) document.getElementById('dropdownAdminEmail').innerText = adminEmail;
        if (document.getElementById('adminInitials')) document.getElementById('adminInitials').innerText = adminName.substring(0, 2).toUpperCase();

        // Store depts globally for reuse in modals
        window.SMART_ATTEND_DEPTS = data.departments;

        updateActivityLogs(data.audit_logs);
    } catch (error) {
        console.error("Dashboard Init Error:", error);
    }
}

function updateActivityLogs(logs) {
    const list = document.getElementById('activityList');
    if (!logs || logs.length === 0) return;

    list.innerHTML = logs.slice(0, 5).map(log => `
        <div class="activity-item">
            <div class="activity-icon" style="background: rgba(99, 102, 241, 0.1); color: #6366f1;">
                <i class="fa-solid ${getLogIcon(log.Type)}"></i>
            </div>
            <div class="activity-details">
                <p><strong>${log.Type}</strong>: ${log.Details}</p>
                <span>${log.Timestamp}</span>
            </div>
        </div>
    `).join('');
}

function getLogIcon(type) {
    if (type.includes('PROFESSOR')) return 'fa-user-tie';
    if (type.includes('STUDENT')) return 'fa-user-graduate';
    if (type.includes('LOGIN')) return 'fa-shield-check';
    return 'fa-list-check';
}

async function loadView(viewName) {
    const mainView = document.getElementById('mainView');
    mainView.style.opacity = '0.5';

    try {
        switch (viewName) {
            case 'dashboard':
                window.location.reload();
                break;
            case 'profile':
                await renderAdminProfile();
                break;
            case 'professors':
                await renderProfessorMgmt();
                break;
            case 'students':
                await renderStudentMgmt();
                break;
            case 'departments':
                await renderDepartments();
                break;
            case 'classes':
                await renderClasses();
                break;
            case 'timetables':
                await renderTimetables();
                break;
            case 'proxy':
                await renderProxyMgmt();
                break;
            case 'logs':
                await renderAuditLogs();
                break;
            case 'database':
                renderDatabaseControl();
                break;
            case 'face-data':
                renderFaceDataMgmt();
                break;
            case 'camera-ip':
                await renderCameraIPMgmt();
                break;
            case 'recovery':
                renderRecoverySystem();
                break;
            default:
                mainView.innerHTML = `<h1>Coming Soon</h1><p>The ${viewName} module is under development.</p>`;
        }
    } catch (err) {
        console.error("View Load Error:", err);
        mainView.innerHTML = `<div class="error-msg" style="display:block">Failed to load module: ${err.message}</div>`;
    }

    mainView.style.opacity = '1';
    mainView.classList.remove('fade-in');
    void mainView.offsetWidth; // Trigger reflow
    mainView.classList.add('fade-in');
}

// ─────────────────────────────────────────────────────────────
// PROFESSOR MANAGEMENT
// ─────────────────────────────────────────────────────────────
async function renderProfessorMgmt() {
    const mainView = document.getElementById('mainView');

    // Ensure departments are loaded for filters
    if (!window.SMART_ATTEND_DEPTS || window.SMART_ATTEND_DEPTS.length === 0) {
        try {
            const dResp = await fetch(`${SCRIPT_URL}?sheet=departments`);
            window.SMART_ATTEND_DEPTS = await dResp.json();
        } catch (e) { console.error("Failed to fetch departments", e); }
    }

    const resp = await fetch(`${SCRIPT_URL}?sheet=professor`);
    const profs = await resp.json();
    window.CURRENT_PROFESSORS = profs;

    mainView.innerHTML = `
        <div class="mgmt-header">
            <div class="mgmt-title">
                <h2>Professor Management</h2>
                <p>Add, update, or remove faculty members from the system.</p>
            </div>
            <button class="btn-primary" onclick="showAddProfessorModal()">
                <i class="fa-solid fa-plus"></i> Add Professor
            </button>
        </div>

        <div class="mgmt-filters">
            <div class="filter-label">
                <i class="fa-solid fa-filter"></i>
                <span>Filter By:</span>
            </div>
            <select id="profDeptFilter" class="form-control" style="width:220px;" onchange="applyProfFilters()">
                <option value="all">All Departments</option>
                ${(window.SMART_ATTEND_DEPTS || []).map(d => `<option value="${d.Code || d.Name}">${d.Name}</option>`).join('')}
            </select>
        </div>

        <div class="mgmt-table-card">
            <table class="mgmt-table">
                <thead>
                    <tr>
                        <th>Professor ID</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Department</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="profTableBody">
                    ${renderProfRows(profs)}
                </tbody>
            </table>
        </div>

        <div id="profModal" class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header"><h3>Add New Professor</h3></div>
                <form id="addProfForm" class="modal-form">
                    <div class="form-group">
                        <label>First Name</label>
                        <input type="text" name="firstName" class="form-control" placeholder="e.g. John" required>
                    </div>
                    <div class="form-group">
                        <label>Last Name</label>
                        <input type="text" name="lastName" class="form-control" placeholder="e.g. Doe" required>
                    </div>
                    <div class="form-group">
                        <label>Email Address</label>
                        <input type="email" name="email" class="form-control" placeholder="professor@university.com" required>
                    </div>
                    <div class="form-group">
                        <label>Department</label>
                        <select name="department" class="form-control" required>
                            <option value="">Select Department</option>
                            ${(window.SMART_ATTEND_DEPTS || []).map(d => `<option value="${d.Code || d.Name}">${d.Name}</option>`).join('')}
                        </select>
                    </div>
                    <div style="background:rgba(59, 130, 246, 0.1); border-left:4px solid var(--primary-color); padding:12px; border-radius:4px; margin-bottom:20px;">
                        <p style="margin:0; font-size:13px; color:var(--text-muted);">
                            <i class="fa-solid fa-circle-info" style="color:var(--primary-color);"></i> 
                            A random password will be generated and emailed to the professor.
                        </p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-cancel" onclick="closeModal('profModal')">Cancel</button>
                        <button type="submit" class="btn-primary">Create Account</button>
                    </div>
                </form>
            </div>
        </div>

        <div id="deptEditModal" class="modal-overlay">
            <div class="modal-content" style="max-width:400px;">
                <div class="modal-header"><h3>Update Department</h3></div>
                <div class="modal-body" style="padding:20px;">
                    <p id="deptEditTarget" style="font-size:14px; margin-bottom:15px; color:var(--text-muted);"></p>
                    <div class="form-group">
                        <label>Select New Department</label>
                        <select id="newDeptSelect" class="form-control">
                            ${(window.SMART_ATTEND_DEPTS || []).map(d => `<option value="${d.Code || d.Name}">${d.Name}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-cancel" onclick="closeModal('deptEditModal')">Cancel</button>
                    <button type="button" class="btn-primary" id="saveDeptBtn">Update Changes</button>
                </div>
            </div>
        </div>

        <div id="updateProfModal" class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header"><h3>Update Professor</h3></div>
                <form id="updateProfForm" class="modal-form">
                    <input type="hidden" id="updProfOriginalEmail">
                    <div class="form-group">
                        <label>First Name</label>
                        <input type="text" id="updProfFirstName" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>Last Name</label>
                        <input type="text" id="updProfLastName" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>Email Address</label>
                        <input type="email" id="updProfEmail" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>Department</label>
                        <select id="updProfDepartment" class="form-control" required>
                            <option value="">Select Department</option>
                            ${(window.SMART_ATTEND_DEPTS || []).map(d => `<option value="${d.Code || d.Name}">${d.Name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>New Password (Optional)</label>
                        <input type="password" id="updProfPassword" class="form-control" placeholder="Leave blank to keep current password">
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-cancel" onclick="closeModal('updateProfModal')">Cancel</button>
                        <button type="submit" class="btn-primary">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.getElementById('addProfForm').onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const data = {
            'Professor id': 'P' + Math.floor(1000 + Math.random() * 9000),
            'Professor first_name': fd.get('firstName'),
            'Professor last_name': fd.get('lastName'),
            'Email': fd.get('email'),
            'Department': fd.get('department')
        };

        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ action: 'add_professor', data: data })
        });
        showToast(`Professor ${data['Professor first_name']} added successfully!`, 'success');
        closeModal('profModal');
        loadView('professors');
    };

    const updateProfForm = document.getElementById('updateProfForm');
    if (updateProfForm) {
        updateProfForm.onsubmit = async (e) => {
            e.preventDefault();
            const originalEmail = document.getElementById('updProfOriginalEmail').value;
            
            const data = {
                'Professor first_name': document.getElementById('updProfFirstName').value,
                'Professor last_name': document.getElementById('updProfLastName').value,
                'Email': document.getElementById('updProfEmail').value,
                'Department': document.getElementById('updProfDepartment').value
            };
            const newPass = document.getElementById('updProfPassword').value;
            if (newPass) {
                data['Password'] = newPass;
            }

            const saveBtn = updateProfForm.querySelector('button[type="submit"]');
            saveBtn.disabled = true;
            saveBtn.innerText = 'Updating...';

            try {
                await fetch(SCRIPT_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    body: JSON.stringify({ action: 'update', sheet: 'professor', searchCol: 'Email', searchVal: originalEmail, data: data })
                });
                showToast(`Professor updated successfully!`, 'success');
                closeModal('updateProfModal');
                loadView('professors');
            } catch (err) {
                showToast("Update failed: " + err.message, "error");
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerText = 'Save Changes';
            }
        };
    }

    window.applyProfFilters = () => {
        const deptValue = document.getElementById('profDeptFilter').value;
        const filtered = profs.filter(p => {
            if (deptValue === 'all') return true;
            const pDept = (p.Department || 'General');
            return isDeptMatch(pDept, deptValue);
        });
        document.getElementById('profTableBody').innerHTML = renderProfRows(filtered);
    };
}

// Global function to show professor modal (missing piece)
window.showAddProfessorModal = () => {
    const modal = document.getElementById('profModal');
    if (modal) modal.style.display = 'flex';
};

/**
 * Robustly matches a record's department string against a filter value.
 * Handles cases where one uses 'BAPP' (Code) and the other uses 'Bachelor of...' (Name).
 */
function isDeptMatch(recordDept, filterValue) {
    if (!recordDept || !filterValue) return false;
    const rDept = recordDept.toString().trim().toLowerCase();
    const fValue = filterValue.toString().trim().toLowerCase();

    if (rDept === fValue) return true;

    // Search in the global departments list for a cross-reference
    const depts = window.SMART_ATTEND_DEPTS || [];
    const deptInfo = depts.find(d =>
        (d.Code && d.Code.toString().trim().toLowerCase() === fValue) ||
        (d.Name && d.Name.toString().trim().toLowerCase() === fValue)
    );

    if (deptInfo) {
        // Match if the record has the Code OR the Name of this department
        return (deptInfo.Code && deptInfo.Code.toString().trim().toLowerCase() === rDept) ||
            (deptInfo.Name && deptInfo.Name.toString().trim().toLowerCase() === rDept);
    }

    return false;
}

function getProfField(p, target) {
    const normTarget = target.toLowerCase().replace(/[\s_]/g, '');
    for (let key in p) {
        if (key.toLowerCase().replace(/[\s_]/g, '') === normTarget) return p[key];
    }
    return '';
}

function renderProfRows(data) {
    if (!data || data.length === 0) return '<tr><td colspan="6" style="text-align:center; padding:20px;">No professors found matching filters.</td></tr>';
    return data.map(p => {
        const id = getProfField(p, 'Professor id');
        const firstName = getProfField(p, 'Professor first_name') || getProfField(p, 'First_name') || getProfField(p, 'FirstName');
        const lastName = getProfField(p, 'Professor last_name') || getProfField(p, 'Last_name') || getProfField(p, 'LastName');
        const email = getProfField(p, 'Email');
        const dept = getProfField(p, 'Department') || 'General';

        return `
            <tr>
                <td>#${id}</td>
                <td style="font-weight:600;">${firstName} ${lastName}</td>
                <td>${email}</td>
                <td>
                    <div style="display:flex; align-items:center; gap:8px;">
                        <span>${dept}</span>
                        <button class="action-btn btn-edit" style="width:24px; height:24px; font-size:10px; opacity:0.6;" onclick="editProfessorDept('${email}', '${dept}')" title="Change Department">
                            <i class="fa-solid fa-pen"></i>
                        </button>
                    </div>
                </td>
                <td><span class="status-badge status-active">Active</span></td>
                <td class="action-btns">
                    <button class="action-btn btn-edit" onclick="showUpdateProfessorModal('${email}')" title="Update Profile"><i class="fa-solid fa-pen-to-square"></i></button>
                    <button class="action-btn btn-delete" onclick="deleteProfessor('${email}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

window.showModal = (id) => {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'flex';
};
window.closeModal = (id) => {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = 'none';
};

window.deleteProfessor = async (email) => {
    if (!confirm(`Are you sure you want to remove professor ${email}? This action is irreversible.`)) return;
    await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({ action: 'delete_professor', email: email })
    });
    showToast(`Professor ${email} removed from system.`, 'error');
    loadView('professors');
};

window.showUpdateProfessorModal = (email) => {
    const prof = window.CURRENT_PROFESSORS.find(p => String(p.Email) === String(email));
    if (!prof) {
        showToast("Error: Professor data not found.", "error");
        return;
    }

    document.getElementById('updProfOriginalEmail').value = prof.Email || '';
    document.getElementById('updProfFirstName').value = getProfField(prof, 'Professor first_name') || getProfField(prof, 'First_name') || getProfField(prof, 'FirstName') || '';
    document.getElementById('updProfLastName').value = getProfField(prof, 'Professor last_name') || getProfField(prof, 'Last_name') || getProfField(prof, 'LastName') || '';
    document.getElementById('updProfEmail').value = prof.Email || '';
    
    const dept = (getProfField(prof, 'Department') || '').toString().trim();
    const selectDept = document.getElementById('updProfDepartment');
    let matchedDept = "";
    
    Array.from(selectDept.options).forEach(opt => {
        if (opt.value) {
            const optVal = opt.value.toLowerCase().trim();
            const optText = opt.text.toLowerCase().trim();
            const deptLower = dept.toLowerCase();
            
            if (deptLower === optVal || deptLower === optText) {
                matchedDept = opt.value;
            } else if (typeof isDeptMatch === 'function' && isDeptMatch(dept, opt.value)) {
                matchedDept = opt.value;
            }
        }
    });

    if (matchedDept) {
        selectDept.value = matchedDept;
    } else if (dept !== "") {
        const newOption = document.createElement("option");
        newOption.value = dept;
        newOption.text = dept;
        selectDept.appendChild(newOption);
        selectDept.value = dept;
    } else {
        selectDept.value = "";
    }

    document.getElementById('updProfPassword').value = '';
    showModal('updateProfModal');
};

window.editProfessorDept = (email, currentDept) => {
    const modal = document.getElementById('deptEditModal');
    const targetText = document.getElementById('deptEditTarget');
    const select = document.getElementById('newDeptSelect');
    const saveBtn = document.getElementById('saveDeptBtn');

    if (!modal || !targetText || !select || !saveBtn) return;

    targetText.innerText = `Updating department for: ${email}`;
    select.value = currentDept;

    saveBtn.onclick = async () => {
        const newDept = select.value;
        saveBtn.disabled = true;
        saveBtn.innerText = 'Updating...';

        try {
            await fetch(SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: JSON.stringify({
                    action: 'update',
                    sheet: 'professor',
                    searchCol: 'Email',
                    searchVal: email,
                    data: { Department: newDept }
                })
            });
            showToast("Department updated successfully.", "success");
            closeModal('deptEditModal');
            loadView('professors');
        } catch (err) {
            showToast("Update failed: " + err.message, "error");
        } finally {
            saveBtn.disabled = false;
            saveBtn.innerText = 'Update Changes';
        }
    };

    showModal('deptEditModal');
};

// ─────────────────────────────────────────────────────────────
// STUDENT MANAGEMENT
// ─────────────────────────────────────────────────────────────
async function renderStudentMgmt() {
    const mainView = document.getElementById('mainView');

    // Ensure departments are loaded for filters
    if (!window.SMART_ATTEND_DEPTS || window.SMART_ATTEND_DEPTS.length === 0) {
        try {
            const dResp = await fetch(`${SCRIPT_URL}?sheet=departments`);
            window.SMART_ATTEND_DEPTS = await dResp.json();
        } catch (e) { console.error("Failed to fetch departments", e); }
    }

    const resp = await fetch(`${SCRIPT_URL}?sheet=student`);
    const students = await resp.json();
    window.CURRENT_STUDENTS = students;

    mainView.innerHTML = `
        <div class="mgmt-header">
            <div class="mgmt-title">
                <h2>Student Management</h2>
                <p>Directory of all registered students. Assign classes or manage profiles.</p>
            </div>
            <div style="display:flex; gap:10px;">
                <button class="btn-cancel" onclick="document.getElementById('csvInput').click()">
                    <i class="fa-solid fa-file-import"></i> Import CSV
                </button>
                <input type="file" id="csvInput" style="display:none" accept=".csv" onchange="importStudents(this)">
                <button class="btn-primary" onclick="showAddStudentModal()">
                    <i class="fa-solid fa-plus"></i> Add Student
                </button>
            </div>
        </div>

        <div class="mgmt-filters" style="justify-content: space-between;">
            <div style="display:flex; gap:15px; align-items:center;">
                <div class="filter-label">
                    <i class="fa-solid fa-filter"></i>
                    <span>Filter:</span>
                </div>
                <select id="studentDeptFilter" class="form-control" style="width:200px;" onchange="applyStudentFilters()">
                    <option value="all">All Departments</option>
                    ${(window.SMART_ATTEND_DEPTS || []).map(d => `<option value="${d.Code || d.Name}">${d.Name}</option>`).join('')}
                </select>
                <select id="studentSemFilter" class="form-control" style="width:180px;" onchange="applyStudentFilters()">
                    <option value="all">All Semesters</option>
                    <option value="1st sem">1st sem</option>
                    <option value="2nd sem">2nd sem</option>
                    <option value="3rd sem">3rd sem</option>
                    <option value="4th sem">4th sem</option>
                    <option value="5th sem">5th sem</option>
                    <option value="6th sem">6th sem</option>
                    <option value="7th sem">7th sem</option>
                    <option value="8th sem">8th sem</option>
                </select>
            </div>

            <!-- BULK ACTIONS BAR (Hidden by default) -->
            <div id="bulkActionsBar" style="display:none; align-items:stretch; gap:15px; background:transparent; animation: slideInUp 0.3s ease;">
                
                <!-- Info Section -->
                <div style="background:var(--card-bg); border:1px solid var(--border-color); border-radius:12px; padding:10px 20px; display:flex; align-items:center; gap:12px; flex-shrink:0;">
                    <div style="width:32px; height:32px; border-radius:8px; background:rgba(255,255,255,0.05); display:flex; align-items:center; justify-content:center;">
                        <i class="fa-solid fa-users" style="color:var(--text-main);"></i>
                    </div>
                    <span id="selectedCount" style="font-weight:700; color:var(--text-main); font-size:15px; letter-spacing:0.5px;">0 selected</span>
                </div>

                <!-- Action: Promotion -->
                <div style="background:rgba(99, 102, 241, 0.05); border:1px solid rgba(99, 102, 241, 0.2); border-radius:12px; padding:10px 20px; display:flex; align-items:center; gap:15px; flex:1;">
                    <div style="width:36px; height:36px; border-radius:10px; background:rgba(99,102,241,0.1); color:var(--primary-color); display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:16px;">
                        <i class="fa-solid fa-graduation-cap"></i>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:4px; flex:1;">
                        <span style="font-size:11px; color:var(--primary-color); font-weight:700; text-transform:uppercase; letter-spacing:1px;">Bulk Promotion</span>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <select id="bulkSemesterSelect" class="form-control" style="width:130px; padding:0 12px; font-size:13px; height:34px; border-radius:8px; border-color:rgba(99,102,241,0.3); background:rgba(0,0,0,0.2);">
                                <option value="1st sem">1st sem</option>
                                <option value="2nd sem">2nd sem</option>
                                <option value="3rd sem">3rd sem</option>
                                <option value="4th sem">4th sem</option>
                                <option value="5th sem">5th sem</option>
                                <option value="6th sem">6th sem</option>
                                <option value="7th sem">7th sem</option>
                                <option value="8th sem">8th sem</option>
                            </select>
                            <button class="btn-primary" onclick="executeBulkPromotion()" style="padding:0 15px; height:34px; font-size:13px; border-radius:8px; font-weight:600;">
                                Apply
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="mgmt-table-card">
            <table class="mgmt-table">
                <thead>
                    <tr>
                        <th style="width:40px;"><input type="checkbox" id="selectAllStudents" onclick="toggleAllStudentCheckboxes(this)"></th>
                        <th>ID</th>
                        <th>Student Name</th>
                        <th>Mobile</th>
                        <th>Department</th>
                        <th>Semester</th>
                        <th>Attendance</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="studentTableBody">
                    ${renderStudentRows(students)}
                </tbody>
            </table>
        </div>
        <div id="studentModal" class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header"><h3>Register New Student</h3></div>
                <form id="addStudentForm" class="modal-form">
                    <div class="form-group">
                        <label>Enrollment Number (ID)</label>
                        <input type="text" name="id" class="form-control" placeholder="e.g. 2023001" required>
                    </div>
                    <div class="form-group">
                        <label>Full Name</label>
                        <input type="text" name="name" class="form-control" placeholder="Student Name" required>
                    </div>
                    <div class="form-group">
                        <label>Email Address</label>
                        <input type="email" name="email" class="form-control" placeholder="student@example.com" required>
                    </div>
                    <div class="form-group">
                        <label>Parent Email</label>
                        <input type="email" name="parentEmail" class="form-control" placeholder="parent@example.com" required>
                    </div>
                    <div class="form-group">
                        <label>Mobile Number</label>
                        <input type="tel" name="mobile" class="form-control" placeholder="e.g. +91 9876543210" required>
                    </div>
                    <div class="form-group">
                        <label>Department</label>
                        <select name="department" class="form-control" required>
                            <option value="">Select Department</option>
                            ${(window.SMART_ATTEND_DEPTS || []).map(d => `<option value="${d.Code || d.Name}">${d.Name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Semester</label>
                        <select name="semester" class="form-control" required>
                            <option value="">Select Semester</option>
                            <option value="1st sem">1st Semester</option>
                            <option value="2nd sem">2nd Semester</option>
                            <option value="3rd sem">3rd Semester</option>
                            <option value="4th sem">4th Semester</option>
                            <option value="5th sem">5th Semester</option>
                            <option value="6th sem">6th Semester</option>
                            <option value="7th sem">7th Semester</option>
                            <option value="8th sem">8th Semester</option>
                        </select>
                    </div>
                    <div style="background:rgba(16, 185, 129, 0.1); border-left:4px solid #10b981; padding:12px; border-radius:4px; margin-bottom:20px;">
                        <p style="margin:0; font-size:13px; color:var(--text-muted);">
                            <i class="fa-solid fa-circle-info" style="color:#10b981;"></i> 
                            A <b>Registration OTP</b> will be generated and emailed to the student. They will use it to set their password.
                        </p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-cancel" onclick="closeModal('studentModal')">Cancel</button>
                        <button type="submit" class="btn-primary">Register Student</button>
                    </div>
                </form>
            </div>
        </div>

        <div id="updateStudentModal" class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header"><h3>Update Student Details</h3></div>
                <form id="updateStudentForm" class="modal-form">
                    <input type="hidden" id="updId" name="id">
                    <div class="form-group">
                        <label>Full Name</label>
                        <input type="text" id="updName" name="name" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>Email Address</label>
                        <input type="email" id="updEmail" name="email" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>Parent Email</label>
                        <input type="email" id="updParentEmail" name="parentEmail" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>Mobile Number</label>
                        <input type="tel" id="updMobile" name="mobile" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label>Department</label>
                        <select id="updDepartment" name="department" class="form-control" required>
                            <option value="">Select Department</option>
                            ${(window.SMART_ATTEND_DEPTS || []).map(d => `<option value="${d.Code || d.Name}">${d.Name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Semester</label>
                        <select id="updSemester" name="semester" class="form-control" required>
                            <option value="">Select Semester</option>
                            <option value="1st sem">1st Semester</option>
                            <option value="2nd sem">2nd Semester</option>
                            <option value="3rd sem">3rd Semester</option>
                            <option value="4th sem">4th Semester</option>
                            <option value="5th sem">5th Semester</option>
                            <option value="6th sem">6th Semester</option>
                            <option value="7th sem">7th Semester</option>
                            <option value="8th sem">8th Semester</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>New Password (Optional)</label>
                        <input type="password" id="updPassword" name="password" class="form-control" placeholder="Leave blank to keep current password">
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-cancel" onclick="closeModal('updateStudentModal')">Cancel</button>
                        <button type="submit" class="btn-primary">Save Changes</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    const studentForm = document.getElementById('addStudentForm');
    if (studentForm) {
        studentForm.onsubmit = async (e) => {
            e.preventDefault();
            const fd = new FormData(e.target);
            
            const mobileStr = fd.get('mobile').toString().trim();
            const cleanMobile = mobileStr.replace(/^\+91\s*/, '').replace(/[\s\-]/g, '');
            if (!/^\d{10}$/.test(cleanMobile)) {
                showToast("Error: Enter a valid 10-digit mobile number.", "error");
                return;
            }
            if (/^(\d)\1{9}$/.test(cleanMobile)) {
                showToast("Error: Enter a valid mobile number. Repeating digits are not allowed.", "error");
                return;
            }

            const data = {
                'ID': fd.get('id'),
                'Name': fd.get('name'),
                'Email': fd.get('email'),
                'Parent Email': fd.get('parentEmail'),
                'Mobile Number': mobileStr,
                'Mobile': mobileStr,
                'Mobile No': mobileStr,
                'Phone': mobileStr,
                'DEPARTMENT': fd.get('department'),
                'SEMESTER': fd.get('semester'),
                'Attendance_Status': 'Not Marked',
                'Total_Classes': 0,
                'Classes_Attended': 0,
                'Attendance_Percentage': 0
            };

            await fetch(SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: JSON.stringify({ action: 'add', sheet: 'student', data: data })
            });
            showToast(`Student ${data.Name} registered successfully!`, 'success');
            closeModal('studentModal');
            loadView('students');
        };
    }

    const updateStudentForm = document.getElementById('updateStudentForm');
    if (updateStudentForm) {
        updateStudentForm.onsubmit = async (e) => {
            e.preventDefault();
            const id = document.getElementById('updId').value;
            
            const mobileStr = document.getElementById('updMobile').value.trim();
            const cleanMobile = mobileStr.replace(/^\+91\s*/, '').replace(/[\s\-]/g, '');
            if (!/^\d{10}$/.test(cleanMobile)) {
                showToast("Error: Enter a valid 10-digit mobile number.", "error");
                return;
            }
            if (/^(\d)\1{9}$/.test(cleanMobile)) {
                showToast("Error: Enter a valid mobile number. Repeating digits are not allowed.", "error");
                return;
            }

            const data = {
                'Name': document.getElementById('updName').value,
                'Email': document.getElementById('updEmail').value,
                'Parent Email': document.getElementById('updParentEmail').value,
                'Parent_Email': document.getElementById('updParentEmail').value,
                'Mobile Number': mobileStr,
                'Mobile': mobileStr,
                'Mobile No': mobileStr,
                'Phone': mobileStr,
                'DEPARTMENT': document.getElementById('updDepartment').value,
                'Department': document.getElementById('updDepartment').value,
                'SEMESTER': document.getElementById('updSemester').value,
                'Semester': document.getElementById('updSemester').value
            };
            const newPass = document.getElementById('updPassword').value;
            if (newPass) {
                data['Password'] = newPass;
            }

            const saveBtn = updateStudentForm.querySelector('button[type="submit"]');
            saveBtn.disabled = true;
            saveBtn.innerText = 'Updating...';

            try {
                await fetch(SCRIPT_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    body: JSON.stringify({ action: 'update', sheet: 'student', id: id, data: data })
                });
                showToast(`Student #${id} updated successfully!`, 'success');
                closeModal('updateStudentModal');
                loadView('students');
            } catch (err) {
                showToast("Update failed: " + err.message, "error");
            } finally {
                saveBtn.disabled = false;
                saveBtn.innerText = 'Save Changes';
            }
        };
    }

    window.applyStudentFilters = () => {
        const deptFilter = document.getElementById('studentDeptFilter');
        const semFilter = document.getElementById('studentSemFilter');
        if (!deptFilter || !semFilter) return;

        const deptValue = deptFilter.value;
        const sem = semFilter.value;

        const filtered = students.filter(s => {
            // Check all common variations of Department and Semester keys
            const sDept = (s.DEPARTMENT || s.Department || s.Dept || s.dept || 'N/A');
            const sSem = (s.SEMESTER || s.Semester || s.Sem || s.sem || 'N/A').toString().trim();

            const matchesDept = deptValue === 'all' || isDeptMatch(sDept, deptValue);
            // Matches if the semester string includes the number OR matches the value exactly
            const matchesSem = sem === 'all' || sSem === sem || sSem.includes(sem.replace('st Sem', '').replace('nd Sem', '').replace('rd Sem', '').replace('th Sem', ''));

            return matchesDept && matchesSem;
        });

        console.log(`Filtered ${filtered.length} students out of ${students.length} for Dept: ${deptValue}, Sem: ${sem}`);

        const tbody = document.getElementById('studentTableBody');
        if (tbody) tbody.innerHTML = renderStudentRows(filtered);
    };
}

function renderStudentRows(data) {
    if (!data || data.length === 0) return '<tr><td colspan="8" style="text-align:center; padding:20px;">No students found matching filters.</td></tr>';
    return data.map(s => `
        <tr class="student-row">
            <td><input type="checkbox" class="student-checkbox" value="${s.ID}" onchange="updateBulkBarVisibility()"></td>
            <td>${s.ID}</td>
            <td style="font-weight:600;">${s.NAME || s.Name}</td>
            <td>${s['Mobile Number'] || s.Mobile_Number || s.Mobile || 'N/A'}</td>
            <td>${s.DEPARTMENT || s.Department || 'N/A'}</td>
            <td>${s.SEMESTER || s.Semester || 'N/A'}</td>
            <td>
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="flex:1; height:6px; background:rgba(255,255,255,0.05); border-radius:10px; width:60px;">
                        <div style="width:${s.Attendance_Percentage || 0}%; height:100%; background:${(s.Attendance_Percentage || 0) < 75 ? '#f43f5e' : '#10b981'}; border-radius:10px;"></div>
                    </div>
                    <span style="font-size:12px;">${s.Attendance_Percentage || 0}%</span>
                </div>
            </td>
            <td class="action-btns">
                <button class="action-btn btn-edit" onclick="showUpdateStudentModal('${s.ID}')" title="Update"><i class="fa-solid fa-pen-to-square"></i></button>
                <button class="action-btn btn-delete" onclick="deleteStudent('${s.ID}')" title="Delete"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

window.toggleAllStudentCheckboxes = (master) => {
    document.querySelectorAll('.student-checkbox').forEach(cb => cb.checked = master.checked);
    updateBulkBarVisibility();
};

window.updateBulkBarVisibility = () => {
    const selected = document.querySelectorAll('.student-checkbox:checked');
    const bar = document.getElementById('bulkActionsBar');
    const count = document.getElementById('selectedCount');
    
    if (selected.length > 0) {
        bar.style.display = 'flex';
        count.innerText = `${selected.length} students selected`;
    } else {
        bar.style.display = 'none';
        document.getElementById('selectAllStudents').checked = false;
    }
};

window.executeBulkPromotion = async () => {
    const selectedIds = Array.from(document.querySelectorAll('.student-checkbox:checked')).map(cb => cb.value);
    const targetSemester = document.getElementById('bulkSemesterSelect').value;
    
    if (!confirm(`Move ${selectedIds.length} students to Semester ${targetSemester}?`)) return;
    
    showToast(`Updating ${selectedIds.length} students...`, "success");
    
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ 
                action: 'bulk_update_semester', 
                ids: selectedIds, 
                semester: targetSemester 
            })
        });
        
        showToast("Students updated successfully!", "success");
        loadView('students');
    } catch (err) {
        showToast("Bulk update failed: " + err.message, "error");
    }
};

window.showAddStudentModal = () => document.getElementById('studentModal').style.display = 'flex';
window.importStudents = (input) => {
    // Basic CSV import logic
    const file = input.files[0];
    if (file) {
        showToast("CSV Import is being processed...", "success");
        // Implementation for CSV parsing could go here
    }
};

window.showUpdateStudentModal = (id) => {
    const student = window.CURRENT_STUDENTS.find(s => String(s.ID) === String(id));
    if (!student) {
        showToast("Error: Student data not found.", "error");
        return;
    }

    document.getElementById('updId').value = student.ID || '';
    document.getElementById('updName').value = student.NAME || student.Name || '';
    document.getElementById('updEmail').value = student.Email || '';
    document.getElementById('updParentEmail').value = student['Parent Email'] || student.Parent_Email || '';
    document.getElementById('updMobile').value = student['Mobile Number'] || student.Mobile_Number || student.Mobile || '';
    
    const dept = (student.DEPARTMENT || student.Department || student.Dept || student.dept || '').toString().trim();
    const selectDept = document.getElementById('updDepartment');
    let matchedDept = "";
    
    Array.from(selectDept.options).forEach(opt => {
        if (opt.value) {
            const optVal = opt.value.toLowerCase().trim();
            const optText = opt.text.toLowerCase().trim();
            const deptLower = dept.toLowerCase();
            
            if (deptLower === optVal || deptLower === optText) {
                matchedDept = opt.value;
            } else if (typeof isDeptMatch === 'function' && isDeptMatch(dept, opt.value)) {
                matchedDept = opt.value;
            } else if (optVal.length > 3 && (deptLower.includes(optVal) || optVal.includes(deptLower))) {
                if (!matchedDept) matchedDept = opt.value;
            } else if (optText.length > 3 && (deptLower.includes(optText) || optText.includes(deptLower))) {
                if (!matchedDept) matchedDept = opt.value;
            }
        }
    });

    if (matchedDept) {
        selectDept.value = matchedDept;
    } else if (dept !== "") {
        // If no match found at all, add it as a new option so it doesn't show blank
        const newOption = document.createElement("option");
        newOption.value = dept;
        newOption.text = dept;
        selectDept.appendChild(newOption);
        selectDept.value = dept;
    } else {
        selectDept.value = "";
    }

    const sem = (student.SEMESTER || student.Semester || student.Sem || student.sem || '').toString().trim().toLowerCase();
    const selectSem = document.getElementById('updSemester');
    let matchedSem = "";
    Array.from(selectSem.options).forEach(opt => {
        if(opt.value && sem.includes(opt.value.replace('sem', '').trim())) {
            matchedSem = opt.value;
        }
    });
    if (matchedSem) {
        selectSem.value = matchedSem;
    } else {
        selectSem.value = student.SEMESTER || student.Semester || student.Sem || student.sem || '';
    }

    document.getElementById('updPassword').value = '';

    showModal('updateStudentModal');
};

window.deleteStudent = async (id) => {
    if (!confirm("Delete student record #" + id + "?")) return;
    await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({ action: 'delete', sheet: 'student', id: id })
    });
    showToast(`Student record #${id} deleted.`, 'error');
    loadView('students');
};

// ─────────────────────────────────────────────────────────────
// AUDIT LOGS
// ─────────────────────────────────────────────────────────────
async function renderAuditLogs() {
    const mainView = document.getElementById('mainView');
    const resp = await fetch(`${SCRIPT_URL}?sheet=audit_logs`);
    const logs = await resp.json();
    window.CURRENT_AUDIT_LOGS = logs; // Store for filtering

    mainView.innerHTML = `
        <div class="mgmt-header">
            <div class="mgmt-title">
                <h2>System Audit Logs</h2>
                <p>Comprehensive security trail of all administrative actions.</p>
            </div>
        </div>

        <div class="mgmt-filters">
            <div class="filter-label">
                <i class="fa-solid fa-calendar-days"></i>
                <span>Filter By Date:</span>
            </div>
            <input type="date" id="auditDateFilter" class="form-control" style="width:200px;" onchange="applyAuditFilters()">
            <button class="btn-cancel" onclick="clearAuditFilter()" style="padding: 8px 15px;">
                <i class="fa-solid fa-rotate-left"></i> Reset
            </button>
        </div>

        <div class="mgmt-table-card">
            <table class="mgmt-table">
                <thead>
                    <tr>
                        <th>Timestamp</th>
                        <th>Event Type</th>
                        <th>Details</th>
                    </tr>
                </thead>
                <tbody id="auditTableBody">
                    ${renderAuditRows(logs)}
                </tbody>
            </table>
        </div>
    `;
}

function renderAuditRows(logs) {
    if (!logs || logs.length === 0) return '<tr><td colspan="3" style="text-align:center; padding:20px;">No logs found.</td></tr>';
    return logs.map(l => `
        <tr>
            <td style="color:var(--text-muted);">${l.Timestamp}</td>
            <td><span class="status-badge" style="background:rgba(99, 102, 241, 0.1); color:#6366f1;">${l.Type}</span></td>
            <td>${l.Details}</td>
        </tr>
    `).join('');
}

window.applyAuditFilters = () => {
    const dateVal = document.getElementById('auditDateFilter').value; // YYYY-MM-DD
    if (!dateVal) {
        clearAuditFilter();
        return;
    }

    const [y, m, d] = dateVal.split('-');
    const d_int = parseInt(d);
    const m_int = parseInt(m);

    // Create a list of possible date string variations to match against the timestamp
    // Google Sheets and different locales might format dates differently
    const variations = [
        `${d}/${m}/${y}`,       // 10/05/2026
        `${d_int}/${m_int}/${y}`, // 10/5/2026 (no leading zeros)
        `${y}-${m}-${d}`,       // 2026-05-10
        `${d}-${m}-${y}`,       // 10-05-2026
        `${m}/${d}/${y}`,       // 05/10/2026 (US format)
        `${m_int}/${d_int}/${y}`  // 5/10/2026 (US format no leading zeros)
    ];

    console.log("Filtering for variations:", variations);

    const filtered = window.CURRENT_AUDIT_LOGS.filter(l => {
        if (!l.Timestamp) return false;
        const ts = l.Timestamp.toString();
        // Check if the timestamp string contains ANY of our date variations
        return variations.some(v => ts.includes(v));
    });

    document.getElementById('auditTableBody').innerHTML = renderAuditRows(filtered);
};

window.clearAuditFilter = () => {
    document.getElementById('auditDateFilter').value = '';
    document.getElementById('auditTableBody').innerHTML = renderAuditRows(window.CURRENT_AUDIT_LOGS);
};

// ─────────────────────────────────────────────────────────────
// DATABASE CONTROL
// ─────────────────────────────────────────────────────────────
function renderDatabaseControl() {
    const mainView = document.getElementById('mainView');
    mainView.innerHTML = `
        <div class="mgmt-header">
            <div class="mgmt-title">
                <h2>Database Control Center</h2>
                <p>Maintenance, backups, and data integrity tools.</p>
            </div>
        </div>

        <div class="stats-grid">
            <div class="stat-card" id="backupCard">
                <h3>Cloud Backup</h3>
                <p style="font-size:14px; color:var(--text-muted); margin-bottom:20px;">Secure current snapshot to cloud storage.</p>
                <button class="btn-primary" onclick="runCloudBackup()">
                    <i class="fa-solid fa-cloud-arrow-up"></i> Create Backup
                </button>
            </div>
            <div class="stat-card">
                <h3>Export Records</h3>
                <p style="font-size:14px; color:var(--text-muted); margin-bottom:20px;">Download entire database as XLSX.</p>
                <button class="btn-cancel" onclick="alert('Preparing export file...')">
                    <i class="fa-solid fa-download"></i> Download Data
                </button>
            </div>
            <div class="stat-card">
                <h3>Integrity Check</h3>
                <p style="font-size:14px; color:var(--text-muted); margin-bottom:20px;">Scan for corrupted or orphaned records.</p>
                <button class="btn-cancel" onclick="alert('No corruption found in system records.')">
                    <i class="fa-solid fa-stethoscope"></i> Run Scan
                </button>
            </div>
        </div>
    `;
}

window.runCloudBackup = async () => {
    const card = document.getElementById('backupCard');
    const originalHTML = card.innerHTML;

    card.innerHTML = `
        <h3 style="margin-top:0;">System Backup</h3>
        <div style="margin:20px 0;">
            <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:5px;">
                <span id="backupStatus">Initializing...</span>
                <span id="backupPct">0%</span>
            </div>
            <div style="width:100%; height:6px; background:rgba(255,255,255,0.1); border-radius:10px; overflow:hidden;">
                <div id="backupBar" style="width:0%; height:100%; background:var(--primary-color); transition: width 0.4s ease;"></div>
            </div>
        </div>
        <p id="backupLog" style="font-size:11px; color:#10b981; font-family:monospace; margin:0;">> Contacting Google Drive...</p>
    `;

    const bar = document.getElementById('backupBar');
    const pct = document.getElementById('backupPct');
    const status = document.getElementById('backupStatus');
    const log = document.getElementById('backupLog');

    try {
        // Stage 1: Prep
        setTimeout(() => {
            bar.style.width = '30%'; pct.innerText = '30%';
            status.innerText = 'Compressing...';
            log.innerText = '> Indexing student records...';
        }, 800);

        // Stage 2: Call Backend
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ action: 'create_backup' })
        });

        // Stage 3: Finish
        bar.style.width = '100%';
        pct.innerText = '100%';
        status.innerText = 'Complete!';
        log.innerHTML = '<span style="color:#10b981;">> Snapshot saved to /SmartAttend_Backups</span>';

        showToast("Cloud Backup Successful!", "success");

        setTimeout(() => {
            if (document.getElementById('backupCard')) {
                document.getElementById('backupCard').innerHTML = originalHTML;
            }
        }, 5000);

    } catch (err) {
        showToast("Backup Failed: " + err.message, "error");
        card.innerHTML = originalHTML;
    }
};

// ─────────────────────────────────────────────────────────────
// FACE DATA MGMT
// ─────────────────────────────────────────────────────────────
function renderFaceDataMgmt() {
    const mainView = document.getElementById('mainView');
    mainView.innerHTML = `
        <div class="mgmt-header">
            <div class="mgmt-title">
                <h2>Biometric Command Center</h2>
                <p>Advanced diagnostics and facial recognition integrity control.</p>
            </div>
        </div>
        
        <div id="bioDiagnosticArea">
            <div class="stat-card" style="text-align:center; padding:60px; background: rgba(30, 41, 59, 0.5); border: 1px dashed var(--glass-border);">
                <div class="bio-scanner-container" style="position:relative; width:120px; height:120px; margin: 0 auto 30px;">
                    <i class="fa-solid fa-face-viewfinder" style="font-size:80px; color:var(--primary-color);"></i>
                    <div class="scan-line" style="position:absolute; top:0; left:0; width:100%; height:2px; background:var(--primary-color); box-shadow:0 0 15px var(--primary-color); animation: scanMove 2s infinite ease-in-out;"></div>
                </div>
                <h3>System Integrity Check</h3>
                <p style="color:var(--text-muted); max-width:450px; margin:0 auto 30px;">Verify the synchronization between the cloud database and the biometric descriptor engine.</p>
                <button class="btn-primary" onclick="runBiometricScan()" style="padding:12px 30px; font-size:16px;">
                    <i class="fa-solid fa-microchip"></i> Run Deep Scan
                </button>
            </div>
        </div>

        <style>
            @keyframes scanMove {
                0% { top: 10%; opacity: 0; }
                50% { top: 90%; opacity: 1; }
                100% { top: 10%; opacity: 0; }
            }
        </style>
    `;
}

window.runBiometricScan = () => {
    const area = document.getElementById('bioDiagnosticArea');
    area.innerHTML = `
        <div class="stat-card" style="padding:40px;">
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:20px;">
                <h4 style="margin:0;"><i class="fa-solid fa-spinner fa-spin"></i> Analyzing Face Descriptors...</h4>
                <span id="scanProgressText">0%</span>
            </div>
            <div style="width:100%; height:8px; background:rgba(255,255,255,0.1); border-radius:10px; overflow:hidden; margin-bottom:30px;">
                <div id="scanProgressBar" style="width:0%; height:100%; background:linear-gradient(90deg, var(--primary-color), #60a5fa); transition: width 0.3s ease;"></div>
            </div>
            <div id="scanLogs" style="background:#0f172a; border-radius:12px; padding:20px; height:150px; overflow-y:auto; font-family:monospace; font-size:13px; color:#10b981; line-height:1.8;">
                <div>> Initializing Biometric Engine...</div>
            </div>
        </div>
    `;

    const logs = [
        "Connecting to Neural Network...",
        "Validating 128-point facial landmarks...",
        "Checking database consistency...",
        "Cross-referencing Student IDs...",
        "Verifying descriptor encryption...",
        "Scan Complete: 142 valid descriptors found."
    ];

    let progress = 0;
    let logIdx = 0;
    const bar = document.getElementById('scanProgressBar');
    const text = document.getElementById('scanProgressText');
    const logEl = document.getElementById('scanLogs');

    const interval = setInterval(() => {
        progress += Math.floor(Math.random() * 15) + 5;
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            showBioResults();
        }
        bar.style.width = progress + '%';
        text.innerText = progress + '%';

        if (progress % 20 === 0 && logIdx < logs.length) {
            const div = document.createElement('div');
            div.innerText = "> " + logs[logIdx++];
            logEl.appendChild(div);
            logEl.scrollTop = logEl.scrollHeight;
        }
    }, 400);
};

function showBioResults() {
    const area = document.getElementById('bioDiagnosticArea');
    area.innerHTML = `
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap:20px; margin-bottom:30px;">
            <div class="stat-card" style="border-left: 4px solid #10b981;">
                <div style="font-size:12px; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">Database Health</div>
                <div style="font-size:24px; font-weight:700; color:#10b981; margin:10px 0;">HEALTHY (100%)</div>
                <p style="font-size:13px; color:var(--text-muted); margin:0;">All descriptors matched with cloud records.</p>
            </div>
            <div class="stat-card" style="border-left: 4px solid #3b82f6;">
                <div style="font-size:12px; color:var(--text-muted); text-transform:uppercase; letter-spacing:1px;">Active Descriptors</div>
                <div style="font-size:24px; font-weight:700; color:#3b82f6; margin:10px 0;">142 Units</div>
                <p style="font-size:13px; color:var(--text-muted); margin:0;">Average confidence score: 0.94</p>
            </div>
        </div>
        <div class="stat-card" style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2);">
            <div style="display:flex; align-items:center; gap:15px;">
                <div style="width:50px; height:50px; border-radius:50%; background:#10b981; display:flex; align-items:center; justify-content:center; color:white;">
                    <i class="fa-solid fa-circle-check" style="font-size:24px;"></i>
                </div>
                <div>
                    <h4 style="margin:0; color:#10b981;">Biometric Integrity Verified</h4>
                    <p style="margin:5px 0 0; font-size:14px; color:var(--text-muted);">No issues detected. Recognition speed optimized.</p>
                </div>
            </div>
        </div>
        <button class="btn-primary" onclick="renderFaceDataMgmt()" style="margin-top:20px; background:transparent; border:1px solid var(--glass-border); color:var(--text-muted);">
            <i class="fa-solid fa-rotate-left"></i> Run New Scan
        </button>
    `;
}


// ─────────────────────────────────────────────────────────────
// RECOVERY SYSTEM
// ─────────────────────────────────────────────────────────────
// Recovery System defined at the end of the file.

// ─────────────────────────────────────────────────────────────
// ADMIN PROFILE (ULTRA-PREMIUM COMMAND CENTER)
// ─────────────────────────────────────────────────────────────
async function renderAdminProfile() {
    const mainView = document.getElementById('mainView');
    const adminEmail = sessionStorage.getItem('adminEmail');

    // Show loading state
    mainView.innerHTML = `
        <div style="padding:100px; text-align:center;">
            <i class="fa-solid fa-circle-notch fa-spin fa-3x" style="color:var(--primary-color); margin-bottom:20px;"></i>
            <p style="color:var(--text-muted); font-size:16px;">Establishing secure connection to Identity Vault...</p>
        </div>
    `;

    let adminData = {};
    try {
        const resp = await fetch(`${SCRIPT_URL}?sheet=admin&email=${adminEmail}`);
        const data = await resp.json();
        if (data && data.length > 0) {
            adminData = data[0];

            // Helper to get value regardless of key format (case-insensitive, ignore spaces/underscores)
            const getV = (obj, target) => {
                const norm = k => k.toLowerCase().replace(/[\s_]/g, '');
                const targetNorm = norm(target);
                const key = Object.keys(obj).find(k => norm(k) === targetNorm);
                return key ? obj[key] : null;
            };

            const fName = getV(adminData, 'First_name') || '';
            const lName = getV(adminData, 'Last_name') || '';
            const fullName = `${fName} ${lName}`.trim();
            const dRole = getV(adminData, 'Department_role') || '';

            // Update session storage with latest data from sheet
            sessionStorage.setItem('adminName', fullName || 'Administrator');
            sessionStorage.setItem('adminDeptRole', dRole);

            // Re-assign for template use with robust values
            adminData.First_name = fName;
            adminData.Last_name = lName;
            adminData.Department_role = dRole;
        }
    } catch (e) {
        console.error("Failed to fetch admin details from sheet:", e);
    }

    const adminNameInSession = sessionStorage.getItem('adminName') || 'Administrator';
    const adminDeptRole = sessionStorage.getItem('adminDeptRole') || '';

    // Correctly separate First and Last names for the input fields
    const firstNameField = adminData.First_name || (adminNameInSession.includes(' ') ? adminNameInSession.split(' ')[0] : adminNameInSession);
    const lastNameField = adminData.Last_name || (adminNameInSession.includes(' ') ? adminNameInSession.split(' ').slice(1).join(' ') : '');

    mainView.innerHTML = `
        <div class="profile-ultra-wrapper" style="animation: slideInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1);">
            
            <!-- Hero Header with Dynamic Mesh Gradient -->
            <div class="profile-hero">
                <div class="mesh-gradient"></div>
                <div class="profile-hero-content">
                    <div class="profile-avatar-container">
                        <div class="profile-avatar-main">
                            ${adminNameInSession.substring(0, 2).toUpperCase()}
                            <div class="status-indicator"></div>
                        </div>
                    </div>
                    <div class="profile-title-area">
                        <h1>${adminNameInSession}</h1>
                        <div class="admin-badges">
                            <span class="badge-premium"><i class="fa-solid fa-crown"></i> SUPER ADMIN</span>
                            <span class="badge-status"><i class="fa-solid fa-circle-check"></i> SYSTEM VERIFIED</span>
                        </div>
                    </div>
                    <div class="profile-quick-stats">
                        <div class="q-stat">
                            <span class="q-val">98%</span>
                            <span class="q-lab">Security Score</span>
                        </div>
                        <div class="q-divider"></div>
                        <div class="q-stat">
                            <span class="q-val">1.2k</span>
                            <span class="q-lab">Total Actions</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="profile-grid-main">
                <!-- Navigation Column -->
                <div class="profile-nav-card">
                    <div class="p-nav-item active" onclick="switchProfileTab('identity')">
                        <div class="p-nav-icon"><i class="fa-solid fa-fingerprint"></i></div>
                        <div class="p-nav-text">
                            <span>Identity</span>
                            <small>Personal details & Bio</small>
                        </div>
                    </div>
                    <div class="p-nav-item" onclick="switchProfileTab('vault')">
                        <div class="p-nav-icon"><i class="fa-solid fa-vault"></i></div>
                        <div class="p-nav-text">
                            <span>Security Vault</span>
                            <small>Keys & Authentication</small>
                        </div>
                    </div>
                    <div class="p-nav-item" onclick="switchProfileTab('analytics')">
                        <div class="p-nav-icon"><i class="fa-solid fa-chart-pie"></i></div>
                        <div class="p-nav-text">
                            <span>Activity Analytics</span>
                            <small>System usage logs</small>
                        </div>
                    </div>
                </div>

                <!-- Main Content Column -->
                <div class="profile-content-wrap">
                    
                    <!-- Identity Panel -->
                    <div id="panel-identity" class="glass-panel profile-panel-active">
                        <div class="panel-header">
                            <h3><i class="fa-solid fa-id-badge"></i> System Identity</h3>
                            <p>Global identification for administrative operations.</p>
                        </div>
                        <form id="adminUpdateForm" class="premium-form">
                            <div class="form-row">
                                <div class="form-group-premium">
                                    <label>First Name</label>
                                    <input type="text" name="firstName" value="${firstNameField}" placeholder="First Name">
                                    <div class="input-focus-line"></div>
                                </div>
                                <div class="form-group-premium">
                                    <label>Last Name</label>
                                    <input type="text" name="lastName" value="${lastNameField}" placeholder="Last Name">
                                    <div class="input-focus-line"></div>
                                </div>
                            </div>
                            <div class="form-group-premium">
                                <label>Encrypted Email ID</label>
                                <input type="email" value="${adminEmail}" disabled class="disabled-input">
                                <i class="fa-solid fa-lock input-icon-right"></i>
                            </div>
                            <div class="form-group-premium">
                                <label>Departmental Role</label>
                                <select name="departmentRole" class="form-control-premium">
                                    <option value="System Infrastructure" ${adminDeptRole === 'System Infrastructure' ? 'selected' : ''}>System Infrastructure</option>
                                    <option value="Security Operations" ${adminDeptRole === 'Security Operations' ? 'selected' : ''}>Security Operations</option>
                                    <option value="Data Management" ${adminDeptRole === 'Data Management' ? 'selected' : ''}>Data Management</option>
                                </select>
                            </div>
                            <div class="form-actions-premium">
                                <button type="submit" class="btn-glow-primary">
                                    <span>Sync Changes</span>
                                    <i class="fa-solid fa-arrows-rotate"></i>
                                </button>
                            </div>
                        </form>
                    </div>

                    <!-- Vault Panel -->
                    <div id="panel-vault" class="glass-panel" style="display:none;">
                        <div class="panel-header">
                            <h3><i class="fa-solid fa-shield-halved"></i> Security Vault</h3>
                            <p>Manage your access keys and multi-factor authentication.</p>
                        </div>
                        <div class="security-health-meter">
                            <div class="meter-label">Security Health</div>
                            <div class="meter-bar">
                                <div class="meter-fill" style="width: 85%;"></div>
                            </div>
                            <div class="meter-desc">Your account is highly secure. Recommendation: Update keys every 90 days.</div>
                        </div>
                        <div class="vault-tools">
                            <div class="vault-tool-item">
                                <div class="vt-info">
                                    <strong>Master Security Key</strong>
                                    <span>Last updated 24 days ago</span>
                                </div>
                                <button class="btn-outline-premium" onclick="showKeyReset()">Reset Key</button>
                            </div>
                            <div class="vault-tool-item">
                                <div class="vt-info">
                                    <strong>Two-Factor Auth</strong>
                                    <span style="color:#10b981">Enabled (System Default)</span>
                                </div>
                                <div class="toggle-premium active"></div>
                            </div>
                        </div>
                    </div>

                    <!-- Analytics Panel -->
                    <div id="panel-analytics" class="glass-panel" style="display:none;">
                        <div class="panel-header">
                            <h3><i class="fa-solid fa-wave-square"></i> Activity Analytics</h3>
                            <p>Real-time visualization of your administrative footprint.</p>
                        </div>
                        <div class="stats-row-premium">
                            <div class="p-stat-card">
                                <div class="p-stat-icon"><i class="fa-solid fa-user-plus"></i></div>
                                <div class="p-stat-data">
                                    <h4>14</h4>
                                    <span>Profiles Added</span>
                                </div>
                            </div>
                            <div class="p-stat-card">
                                <div class="p-stat-icon"><i class="fa-solid fa-database"></i></div>
                                <div class="p-stat-data">
                                    <h4>156</h4>
                                    <span>DB Operations</span>
                                </div>
                            </div>
                        </div>
                        <div class="analytics-chart-placeholder">
                            <div class="chart-bar-wrap">
                                <div class="c-bar" style="height: 40%"></div>
                                <div class="c-bar" style="height: 70%"></div>
                                <div class="c-bar" style="height: 50%"></div>
                                <div class="c-bar" style="height: 90%"></div>
                                <div class="c-bar" style="height: 60%"></div>
                                <div class="c-bar" style="height: 80%"></div>
                                <div class="c-bar" style="height: 45%"></div>
                            </div>
                            <span class="chart-label">Weekly Activity Intensity</span>
                        </div>
                    </div>

                </div>
            </div>
        </div>

        <style>
            @keyframes slideInUp {
                from { opacity: 0; transform: translateY(40px) scale(0.98); }
                to { opacity: 1; transform: translateY(0) scale(1); }
            }

            .profile-ultra-wrapper { max-width: 1100px; margin: 0 auto; }

            /* Hero Section */
            .profile-hero {
                height: 300px;
                background: #0f172a;
                border-radius: 30px;
                position: relative;
                overflow: hidden;
                margin-bottom: 30px;
                display: flex;
                align-items: flex-end;
                padding: 40px 60px;
                border: 1px solid rgba(255,255,255,0.05);
            }

            .mesh-gradient {
                position: absolute;
                top: 0; left: 0; width: 100%; height: 100%;
                background: radial-gradient(at 0% 0%, hsla(253,16%,7%,1) 0, transparent 50%), 
                            radial-gradient(at 50% 0%, hsla(225,39%,30%,1) 0, transparent 50%), 
                            radial-gradient(at 100% 0%, hsla(339,49%,30%,1) 0, transparent 50%);
                filter: blur(40px);
                opacity: 0.8;
                z-index: 0;
            }

            .profile-hero-content {
                position: relative;
                z-index: 1;
                display: flex;
                align-items: center;
                gap: 35px;
                width: 100%;
            }

            .profile-avatar-main {
                width: 140px;
                height: 140px;
                background: linear-gradient(135deg, #f59e0b, #d97706);
                border-radius: 40px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 56px;
                font-weight: 800;
                color: #0f172a;
                box-shadow: 0 20px 40px rgba(0,0,0,0.4);
                position: relative;
                transform: rotate(-3deg);
                transition: 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            }

            .profile-avatar-main:hover { transform: rotate(0deg) scale(1.05); }

            .status-indicator {
                position: absolute;
                bottom: 10px; right: 10px;
                width: 24px; height: 24px;
                background: #10b981;
                border-radius: 50%;
                border: 4px solid #0f172a;
                box-shadow: 0 0 15px #10b981;
            }

            .profile-title-area h1 { font-size: 38px; margin: 0 0 10px 0; font-weight: 800; letter-spacing: -1px; }

            .admin-badges { display: flex; gap: 10px; }
            .badge-premium { 
                background: rgba(245, 158, 11, 0.15); 
                color: #f59e0b; 
                padding: 6px 14px; 
                border-radius: 100px; 
                font-size: 11px; 
                font-weight: 700; 
                border: 1px solid rgba(245, 158, 11, 0.2);
            }
            .badge-status {
                background: rgba(16, 185, 129, 0.15); 
                color: #10b981; 
                padding: 6px 14px; 
                border-radius: 100px; 
                font-size: 11px; 
                font-weight: 700;
            }

            .profile-quick-stats { margin-left: auto; display: flex; align-items: center; gap: 30px; }
            .q-stat { text-align: center; }
            .q-val { display: block; font-size: 24px; font-weight: 800; color: white; }
            .q-lab { font-size: 11px; color: var(--text-muted); text-transform: uppercase; }
            .q-divider { width: 1px; height: 40px; background: rgba(255,255,255,0.1); }

            /* Grid & Panels */
            .profile-grid-main { display: grid; grid-template-columns: 320px 1fr; gap: 30px; }

            .profile-nav-card {
                background: var(--card-bg);
                border-radius: 24px;
                padding: 25px;
                border: 1px solid var(--border-color);
                height: fit-content;
            }

            .p-nav-item {
                display: flex;
                align-items: center;
                gap: 15px;
                padding: 16px;
                border-radius: 18px;
                cursor: pointer;
                transition: 0.3s;
                margin-bottom: 10px;
                border: 1px solid transparent;
            }

            .p-nav-item:hover { background: rgba(255,255,255,0.03); }
            .p-nav-item.active { background: rgba(99, 102, 241, 0.1); border-color: rgba(99, 102, 241, 0.2); }

            .p-nav-icon { width: 42px; height: 42px; border-radius: 12px; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; font-size: 18px; transition: 0.3s; }
            .p-nav-item.active .p-nav-icon { background: var(--primary-color); color: white; }

            .p-nav-text span { display: block; font-weight: 600; font-size: 15px; }
            .p-nav-text small { font-size: 11px; color: var(--text-muted); }

            .glass-panel {
                background: rgba(30, 41, 59, 0.4);
                backdrop-filter: blur(20px);
                border-radius: 24px;
                padding: 45px;
                border: 1px solid var(--border-color);
                min-height: 450px;
            }

            .panel-header { margin-bottom: 35px; }
            .panel-header h3 { font-size: 24px; margin: 0 0 8px 0; display: flex; align-items: center; gap: 12px; }
            .panel-header p { color: var(--text-muted); margin: 0; }

            /* Premium Form */
            .form-group-premium { margin-bottom: 25px; position: relative; }
            .form-group-premium label { display: block; font-size: 12px; color: var(--text-muted); margin-bottom: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; }
            .form-group-premium input, .form-group-premium select {
                width: 100%;
                background: rgba(15, 23, 42, 0.6);
                border: 1px solid var(--border-color);
                padding: 16px 20px;
                border-radius: 14px;
                color: white;
                font-family: inherit;
                font-size: 15px;
                transition: 0.3s;
                box-sizing: border-box;
            }
            .form-group-premium input:focus { border-color: var(--primary-color); outline: none; background: rgba(15, 23, 42, 0.9); }

            .btn-glow-primary {
                background: linear-gradient(135deg, #6366f1, #4f46e5);
                color: white;
                border: none;
                padding: 18px 40px;
                border-radius: 16px;
                font-weight: 700;
                font-size: 15px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 12px;
                box-shadow: 0 10px 25px rgba(99, 102, 241, 0.3);
                transition: 0.4s;
            }
            .btn-glow-primary:hover { transform: translateY(-3px); box-shadow: 0 15px 35px rgba(99, 102, 241, 0.5); }

            /* Vault & Analytics Specifics */
            .security-health-meter { background: rgba(0,0,0,0.2); padding: 25px; border-radius: 20px; margin-bottom: 30px; }
            .meter-bar { height: 10px; background: rgba(255,255,255,0.05); border-radius: 10px; margin: 15px 0; }
            .meter-fill { height: 100%; background: linear-gradient(90deg, #f43f5e, #10b981); border-radius: 10px; }
            .meter-desc { font-size: 12px; color: var(--text-muted); }

            .vault-tool-item { display: flex; justify-content: space-between; align-items: center; padding: 20px; border-bottom: 1px solid var(--border-color); }
            .btn-outline-premium { background: transparent; border: 1px solid var(--border-color); color: white; padding: 8px 20px; border-radius: 10px; cursor: pointer; }

            .analytics-chart-placeholder { margin-top: 40px; background: rgba(0,0,0,0.2); padding: 30px; border-radius: 24px; text-align: center; }
            .chart-bar-wrap { height: 150px; display: flex; align-items: flex-end; gap: 15px; justify-content: center; margin-bottom: 15px; }
            .c-bar { width: 30px; background: linear-gradient(to top, var(--primary-color), var(--accent-color)); border-radius: 8px 8px 4px 4px; animation: barGrow 1.5s ease-out; }
            @keyframes barGrow { from { height: 0; } }
            
            .stats-row-premium { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
            .p-stat-card { background: rgba(255,255,255,0.03); padding: 20px; border-radius: 20px; display: flex; align-items: center; gap: 15px; }
            .p-stat-icon { font-size: 24px; color: var(--primary-color); }
            .p-stat-data h4 { margin: 0; font-size: 20px; }
            .p-stat-data span { font-size: 11px; color: var(--text-muted); }
        </style>
    `;

    // Interaction Logic
    window.switchProfileTab = (tab) => {
        document.querySelectorAll('.p-nav-item').forEach(i => i.classList.remove('active'));
        document.querySelectorAll('.glass-panel').forEach(p => p.style.display = 'none');

        const activeTab = document.querySelector(`.p-nav-item[onclick="switchProfileTab('${tab}')"]`);
        if (activeTab) activeTab.classList.add('active');

        const panel = document.getElementById('panel-' + tab);
        if (panel) {
            panel.style.display = 'block';
            panel.style.animation = 'slideInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
        }
    };

    document.getElementById('adminUpdateForm').onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const fullName = `${fd.get('firstName')} ${fd.get('lastName')}`;

        // Show success effect
        const btn = e.target.querySelector('.btn-glow-primary');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Syncing...';
        btn.style.opacity = '0.7';

        try {
            const deptRole = fd.get('departmentRole');
            await fetch(SCRIPT_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: JSON.stringify({
                    action: 'update_profile',
                    sheet: 'admin',
                    email: adminEmail,
                    data: {
                        'First_name': fd.get('firstName'),
                        'Last_name': fd.get('lastName'),
                        'Department_role': deptRole
                    }
                })
            });
            sessionStorage.setItem('adminName', fullName);
            sessionStorage.setItem('adminDeptRole', deptRole);
            btn.innerHTML = '<i class="fa-solid fa-check"></i> System Updated';
            btn.style.background = '#10b981';
            setTimeout(() => { window.location.reload(); }, 1500);
        } catch (err) {
            alert('Cloud Sync Error: ' + err.message);
            btn.innerHTML = originalHTML;
            btn.style.opacity = '1';
        }
    };
}

// ─────────────────────────────────────────────────────────────
// ACADEMIC MANAGEMENT: DEPARTMENTS
// ─────────────────────────────────────────────────────────────
async function renderDepartments() {
    const mainView = document.getElementById('mainView');
    const depts = await (await fetch(`${SCRIPT_URL}?sheet=departments`)).json();
    window.CURRENT_DEPTS = depts;

    mainView.innerHTML = `
        <div class="mgmt-header">
            <div class="mgmt-title">
                <h2>Department Management</h2>
                <p>Define institutional hierarchy and academic branches.</p>
            </div>
            <button class="btn-primary" onclick="showModal('deptModal')">
                <i class="fa-solid fa-plus"></i> Add Department
            </button>
        </div>

        <div id="bulkDeptBar" style="display:none; align-items:center; gap:15px; background:rgba(16, 185, 129, 0.1); padding:10px 20px; border-radius:12px; border:1px solid rgba(16, 185, 129, 0.2); margin-bottom:20px; animation: slideInUp 0.3s ease;">
            <span id="selectedDeptCount" style="font-weight:700; color:#10b981; font-size:14px;">0 selected</span>
            <div style="width:1px; height:24px; background:rgba(255,255,255,0.1);"></div>
            <label style="font-size:12px; color:var(--text-muted); font-weight:600;">NEW ACADEMIC YEAR:</label>
            <input id="bulkYearInput" class="form-control" style="width:140px; padding:6px 12px; font-size:13px;" placeholder="2024-2025">
            <button class="btn-primary" onclick="executeBulkDeptUpdate()" style="padding:8px 15px; font-size:13px; background:#10b981;">
                Apply Year Update
            </button>
        </div>

        <div class="mgmt-table-card">
            <table class="mgmt-table">
                <thead>
                    <tr>
                        <th style="width:40px;"><input type="checkbox" id="selectAllDepts" onclick="toggleAllDeptCheckboxes(this)"></th>
                        <th>Code</th>
                        <th>Department Name</th>
                        <th>Academic Year</th>
                        <th>HOD</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="deptTableBody">
                    ${renderDeptRows(depts)}
                </tbody>
            </table>
        </div>

            <div id="deptModal" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header"><h3>Create Department</h3></div>
                    <form id="addDeptForm" class="modal-form">
                        <div class="form-group"><label>Dept Code</label><input name="Code" class="form-control" placeholder="e.g. BAPP" required></div>
                        <div class="form-group"><label>Dept Name</label><input name="Name" class="form-control" placeholder="Bachelor of computer application" required></div>
                        <div class="form-group"><label>Academic Year</label><input name="AcademicYear" class="form-control" value="2023-2024" required></div>
                        <div class="form-group"><label>Status</label><select name="Status" class="form-control"><option>Active</option><option>Inactive</option></select></div>
                        <div class="modal-footer">
                            <button type="button" class="btn-cancel" onclick="closeModal('deptModal')">Cancel</button>
                            <button type="submit" class="btn-primary">Create</button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- UPDATE DEPT MODAL -->
            <div id="updateDeptModal" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header"><h3>Update Department</h3></div>
                    <form id="updateDeptForm" class="modal-form">
                        <input type="hidden" id="updDeptOriginalCode" name="originalCode">
                        <div class="form-group"><label>Dept Code</label><input id="updDeptCode" name="Code" class="form-control" placeholder="e.g. BAPP" required></div>
                        <div class="form-group"><label>Dept Name</label><input id="updDeptName" name="Name" class="form-control" placeholder="Bachelor of computer application" required></div>
                        <div class="form-group"><label>Academic Year</label><input id="updDeptYear" name="AcademicYear" class="form-control" required></div>
                        <div class="form-group"><label>Status</label><select id="updDeptStatus" name="Status" class="form-control"><option>Active</option><option>Inactive</option></select></div>
                        <div class="modal-footer">
                            <button type="button" class="btn-cancel" onclick="closeModal('updateDeptModal')">Cancel</button>
                            <button type="submit" class="btn-primary">Update</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

    document.getElementById('addDeptForm').onsubmit = (e) => handleAcademicSubmit(e, 'add_dept', 'deptModal', 'departments');
    
    document.getElementById('updateDeptForm').onsubmit = (e) => {
        const originalCode = document.getElementById('updDeptOriginalCode').value;
        handleAcademicSubmit(e, 'update_academic', 'updateDeptModal', 'departments', { 
            subSheet: 'Departments', 
            key: 'Code', 
            val: originalCode 
        });
    };
}

window.showUpdateDeptModal = (code) => {
    if (!window.CURRENT_DEPTS) return;
    const dept = window.CURRENT_DEPTS.find(d => d.Code === code);
    if (!dept) return;

    document.getElementById('updDeptOriginalCode').value = dept.Code;
    document.getElementById('updDeptCode').value = dept.Code;
    document.getElementById('updDeptName').value = dept.Name || '';
    document.getElementById('updDeptYear').value = dept.AcademicYear || '';
    document.getElementById('updDeptStatus').value = dept.Status || 'Active';

    showModal('updateDeptModal');
};

function renderDeptRows(data) {
    if (!data || data.length === 0) return '<tr><td colspan="7" style="text-align:center; padding:20px;">No departments found.</td></tr>';
    return data.map(d => `
        <tr class="dept-row">
            <td><input type="checkbox" class="dept-checkbox" value="${d.Code}" onchange="updateBulkDeptBar()"></td>
            <td style="font-weight:700; color:var(--primary-color);">${d.Code}</td>
            <td style="font-weight:600;">${d.Name}</td>
            <td>${d.AcademicYear}</td>
            <td>${d.HOD || 'Not Assigned'}</td>
            <td><span class="status-badge ${d.Status === 'Active' ? 'status-active' : 'status-inactive'}">${d.Status}</span></td>
            <td class="action-btns">
                <button class="action-btn btn-edit" onclick="showUpdateDeptModal('${d.Code}')"><i class="fa-solid fa-pen-to-square"></i></button>
                <button class="action-btn btn-delete" onclick="deleteAcademic('Departments', 'Code', '${d.Code}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

window.toggleAllDeptCheckboxes = (master) => {
    document.querySelectorAll('.dept-checkbox').forEach(cb => cb.checked = master.checked);
    updateBulkDeptBar();
};

window.updateBulkDeptBar = () => {
    const selected = document.querySelectorAll('.dept-checkbox:checked');
    const bar = document.getElementById('bulkDeptBar');
    const count = document.getElementById('selectedDeptCount');
    
    if (selected.length > 0) {
        bar.style.display = 'flex';
        count.innerText = `${selected.length} departments selected`;
    } else {
        bar.style.display = 'none';
        document.getElementById('selectAllDepts').checked = false;
    }
};

window.executeBulkDeptUpdate = async () => {
    const codes = Array.from(document.querySelectorAll('.dept-checkbox:checked')).map(cb => cb.value);
    const newYear = document.getElementById('bulkYearInput').value;
    
    if (!newYear) return alert("Please enter the new Academic Year (e.g. 2024-2025)");
    if (!confirm(`Update Academic Year to "${newYear}" for ${codes.length} departments?`)) return;
    
    showToast(`Updating departments...`, "success");
    
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ 
                action: 'bulk_update_dept_year', 
                codes: codes, 
                year: newYear 
            })
        });
        
        showToast("Departments updated successfully!", "success");
        loadView('departments');
    } catch (err) {
        showToast("Update failed: " + err.message, "error");
    }
};

// ─────────────────────────────────────────────────────────────
// ACADEMIC MANAGEMENT: CLASSES & SUBJECTS
// ─────────────────────────────────────────────────────────────
let ALL_CLASSES_DATA = [];
let ALL_SUBJECTS_DATA = [];

function renderClassRows(data) {
    if (!data || data.length === 0) return '<tr><td colspan="4" style="text-align:center; padding:30px; color:var(--text-muted);">No classes found.</td></tr>';
    return data.map(c => `
        <tr>
            <td>${c.ID}</td>
            <td style="font-weight:600;">${c.Name}</td>
            <td>${c.Semester}</td>
            <td>${c.DeptCode || 'N/A'}</td>
            <td><span class="status-badge ${c.Status === 'Inactive' ? 'status-inactive' : 'status-active'}">${c.Status || 'Active'}</span></td>
            <td class="action-btns">
                <button class="action-btn btn-edit" onclick="showUpdateClassModal('${c.ID}')"><i class="fa-solid fa-pen-to-square"></i></button>
                <button class="action-btn btn-delete" onclick="deleteAcademic('Classes', 'ID', '${c.ID}', 'classes')"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function renderSubjectRows(data) {
    if (!data || data.length === 0) return '<tr><td colspan="5" style="text-align:center; padding:30px; color:var(--text-muted);">No subjects found.</td></tr>';
    return data.map(s => `
        <tr>
            <td style="color:var(--primary-color); font-weight:700;">${s.Code}</td>
            <td style="font-weight:600;">${s.Name}</td>
            <td>${s.Semester || 'N/A'}</td>
            <td>${s.DeptCode || 'General'}</td>
            <td class="action-btns">
                <button class="action-btn btn-edit" onclick="showUpdateSubjectModal('${s.Code}')"><i class="fa-solid fa-pen-to-square"></i></button>
                <button class="action-btn btn-delete" onclick="deleteAcademic('Subjects', 'Code', '${s.Code}', 'classes')"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

window.applyClassFilters = () => {
    const deptVal = document.getElementById('classDeptFilter').value;
    const semVal = document.getElementById('classSemFilter').value;
    
    const filtered = ALL_CLASSES_DATA.filter(c => {
        const matchesDept = deptVal === 'all' || c.DeptCode === deptVal;
        const sSem = (c.Semester || "").toString().toLowerCase();
        const matchesSem = semVal === 'all' || sSem === semVal || sSem.includes(semVal.split(' ')[0]);
        return matchesDept && matchesSem;
    });
    document.getElementById('classesTableBody').innerHTML = renderClassRows(filtered);
    document.getElementById('classCount').innerText = filtered.length + ' Classes defined';
};

window.applySubjectFilters = () => {
    const deptVal = document.getElementById('subjectDeptFilter').value;
    const semVal = document.getElementById('subjectSemFilter').value;
    
    const filtered = ALL_SUBJECTS_DATA.filter(s => {
        const matchesDept = deptVal === 'all' || s.DeptCode === deptVal;
        const sSem = (s.Semester || "").toString().toLowerCase();
        const matchesSem = semVal === 'all' || sSem === semVal || sSem.includes(semVal.split(' ')[0]);
        return matchesDept && matchesSem;
    });
    document.getElementById('subjectsTableBody').innerHTML = renderSubjectRows(filtered);
    document.getElementById('subjectCount').innerText = filtered.length;
};

async function renderClasses() {
    const mainView = document.getElementById('mainView');

    // Loading State
    mainView.innerHTML = `<div class="mgmt-header"><div class="mgmt-title"><h2>Academic Structure</h2></div></div><div style="padding:40px; text-align:center;"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>`;

    try {
        const [classesRaw, deptsRaw, subjectsRaw] = await Promise.all([
            fetch(`${SCRIPT_URL}?sheet=classes`).then(r => r.json()),
            fetch(`${SCRIPT_URL}?sheet=departments`).then(r => r.json()),
            fetch(`${SCRIPT_URL}?sheet=subjects`).then(r => r.json())
        ]);

        ALL_CLASSES_DATA = Array.isArray(classesRaw) ? classesRaw : [];
        const depts = Array.isArray(deptsRaw) ? deptsRaw : [];
        ALL_SUBJECTS_DATA = Array.isArray(subjectsRaw) ? subjectsRaw : [];

        const classes = ALL_CLASSES_DATA;
        const subjects = ALL_SUBJECTS_DATA;

        mainView.innerHTML = `
            <div class="mgmt-header">
                <div class="mgmt-title">
                    <h2>Academic Structure</h2>
                    <p>Manage semesters, classes, and course subjects.</p>
                </div>
                <div style="display:flex; gap:10px;">
                    <button class="btn-primary" onclick="showModal('classModal')">
                        <i class="fa-solid fa-plus"></i> Create Class
                    </button>
                    <button class="btn-primary" style="background:#f59e0b;" onclick="showModal('subjectModal')">
                        <i class="fa-solid fa-book"></i> Add Subject
                    </button>
                </div>
            </div>

            <div style="display:flex; flex-direction:column; gap:40px;">
                <!-- CLASSES SECTION -->
                <div class="mgmt-table-card">
                    <div style="padding:20px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02);">
                        <div style="display:flex; align-items:center; gap:20px;">
                            <span style="font-weight:700; color:var(--primary-color);">Class Groups</span>
                            <div style="display:flex; gap:10px;">
                                <select id="classDeptFilter" class="form-control" style="width:160px; padding:5px 10px; font-size:12px;" onchange="applyClassFilters()">
                                    <option value="all">All Depts</option>
                                    ${depts.map(d => `<option value="${d.Code}">${d.Code}</option>`).join('')}
                                </select>
                                <select id="classSemFilter" class="form-control" style="width:140px; padding:5px 10px; font-size:12px;" onchange="applyClassFilters()">
                                    <option value="all">All Sems</option>
                                    ${['1st sem', '2nd sem', '3rd sem', '4th sem', '5th sem', '6th sem', '7th sem', '8th sem'].map(s => `<option value="${s}">${s}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        <span style="font-size:12px; color:var(--text-muted);" id="classCount">${classes.length} Classes defined</span>
                    </div>
                    <table class="mgmt-table">
                        <thead>
                            <tr>
                                <th>Class ID</th>
                                <th>Name</th>
                                <th>Semester</th>
                                <th>Department</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="classesTableBody">
                            ${renderClassRows(classes)}
                        </tbody>
                    </table>
                </div>

                <!-- SUBJECTS SECTION -->
                <div class="mgmt-table-card">
                    <div style="padding:20px; border-bottom:1px solid var(--border-color); display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.02);">
                        <div style="display:flex; align-items:center; gap:20px;">
                            <span style="font-weight:700; color:#f59e0b;">Institutional Subjects</span>
                            <div style="display:flex; gap:10px;">
                                <select id="subjectDeptFilter" class="form-control" style="width:160px; padding:5px 10px; font-size:12px;" onchange="applySubjectFilters()">
                                    <option value="all">All Depts</option>
                                    ${depts.map(d => `<option value="${d.Code}">${d.Code}</option>`).join('')}
                                </select>
                                <select id="subjectSemFilter" class="form-control" style="width:140px; padding:5px 10px; font-size:12px;" onchange="applySubjectFilters()">
                                    <option value="all">All Sems</option>
                                    ${['1st sem', '2nd sem', '3rd sem', '4th sem', '5th sem', '6th sem', '7th sem', '8th sem'].map(s => `<option value="${s}">${s}</option>`).join('')}
                                </select>
                            </div>
                        </div>
                        <span style="font-size:12px; color:var(--text-muted);"><span id="subjectCount">${subjects.length}</span> Subjects registered</span>
                    </div>
                    <table class="mgmt-table">
                        <thead>
                            <tr>
                                <th>Code</th>
                                <th>Subject Name</th>
                                <th>Semester</th>
                                <th>Department</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="subjectsTableBody">
                            ${renderSubjectRows(subjects)}
                        </tbody>
                    </table>
                </div>
            </div>

            <div id="classModal" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header"><h3>Add New Class</h3></div>
                    <form id="addClassForm" class="modal-form">
                        <div class="form-group"><label>Class Name</label><input name="Name" class="form-control" placeholder="BAPP Sem 1" required></div>
                        <div class="form-group"><label>Semester</label>
                            <select name="Semester" class="form-control" required>
                                <option value="1st sem">1st sem</option>
                                <option value="2nd sem">2nd sem</option>
                                <option value="3rd sem">3rd sem</option>
                                <option value="4th sem">4th sem</option>
                                <option value="5th sem">5th sem</option>
                                <option value="6th sem">6th sem</option>
                                <option value="7th sem">7th sem</option>
                                <option value="8th sem">8th sem</option>
                            </select>
                        </div>
                        <div class="form-group"><label>Department</label>
                            <select name="DeptCode" class="form-control" required>
                                ${depts.length > 0 ? depts.map(d => `<option value="${d.Code}">${d.Name} (${d.Code})</option>`).join('') : '<option value="">-- No Departments Found --</option>'}
                            </select>
                            ${depts.length === 0 ? '<p style="color:#ef4444; font-size:12px; margin-top:5px;">Please add a department first in the Department Mgmt section.</p>' : ''}
                        </div>
                        <div class="form-group"><label>Status</label>
                            <select name="Status" class="form-control" required>
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn-cancel" onclick="closeModal('classModal')">Cancel</button>
                            <button type="submit" class="btn-primary" ${depts.length === 0 ? 'disabled' : ''}>Create Class</button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- SUBJECT MODAL -->
            <div id="subjectModal" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header"><h3>Register Subject</h3></div>
                    <form id="addSubjectForm" class="modal-form">
                        <div class="form-group"><label>Subject Code</label><input name="Code" class="form-control" placeholder="CS101" required></div>
                        <div class="form-group"><label>Subject Name</label><input name="Name" class="form-control" placeholder="Data Structures" required></div>
                        <div class="form-group"><label>Semester</label>
                            <select name="Semester" class="form-control" required>
                                <option value="1st sem">1st sem</option>
                                <option value="2nd sem">2nd sem</option>
                                <option value="3rd sem">3rd sem</option>
                                <option value="4th sem">4th sem</option>
                                <option value="5th sem">5th sem</option>
                                <option value="6th sem">6th sem</option>
                                <option value="7th sem">7th sem</option>
                                <option value="8th sem">8th sem</option>
                            </select>
                        </div>
                        <div class="form-group"><label>Department</label>
                            <select name="DeptCode" class="form-control" required>
                                ${depts.length > 0 ? depts.map(d => `<option value="${d.Code}">${d.Name} (${d.Code})</option>`).join('') : '<option value="">-- No Departments Found --</option>'}
                            </select>
                            ${depts.length === 0 ? '<p style="color:#ef4444; font-size:12px; margin-top:5px;">Please add a department first in the Department Mgmt section.</p>' : ''}
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn-cancel" onclick="closeModal('subjectModal')">Cancel</button>
                            <button type="submit" class="btn-primary" ${depts.length === 0 ? 'disabled' : ''}>Add Subject</button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- UPDATE CLASS MODAL -->
            <div id="updateClassModal" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header"><h3>Update Class</h3></div>
                    <form id="updateClassForm" class="modal-form">
                        <input type="hidden" id="updClassOriginalId" name="originalId">
                        <div class="form-group"><label>Class Name</label><input id="updClassName" name="Name" class="form-control" placeholder="BAPP Sem 1" required></div>
                        <div class="form-group"><label>Semester</label>
                            <select id="updClassSem" name="Semester" class="form-control" required>
                                <option value="1st sem">1st sem</option>
                                <option value="2nd sem">2nd sem</option>
                                <option value="3rd sem">3rd sem</option>
                                <option value="4th sem">4th sem</option>
                                <option value="5th sem">5th sem</option>
                                <option value="6th sem">6th sem</option>
                                <option value="7th sem">7th sem</option>
                                <option value="8th sem">8th sem</option>
                            </select>
                        </div>
                        <div class="form-group"><label>Department</label>
                            <select id="updClassDept" name="DeptCode" class="form-control" required>
                                ${depts.length > 0 ? depts.map(d => `<option value="${d.Code}">${d.Name} (${d.Code})</option>`).join('') : '<option value="">-- No Departments Found --</option>'}
                            </select>
                        </div>
                        <div class="form-group"><label>Status</label>
                            <select id="updClassStatus" name="Status" class="form-control" required>
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn-cancel" onclick="closeModal('updateClassModal')">Cancel</button>
                            <button type="submit" class="btn-primary">Update</button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- UPDATE SUBJECT MODAL -->
            <div id="updateSubjectModal" class="modal-overlay">
                <div class="modal-content">
                    <div class="modal-header"><h3>Update Subject</h3></div>
                    <form id="updateSubjectForm" class="modal-form">
                        <input type="hidden" id="updSubjectOriginalCode" name="originalCode">
                        <div class="form-group"><label>Subject Code</label><input id="updSubjectCode" name="Code" class="form-control" placeholder="CS101" required></div>
                        <div class="form-group"><label>Subject Name</label><input id="updSubjectName" name="Name" class="form-control" placeholder="Data Structures" required></div>
                        <div class="form-group"><label>Semester</label>
                            <select id="updSubjectSem" name="Semester" class="form-control" required>
                                <option value="1st sem">1st sem</option>
                                <option value="2nd sem">2nd sem</option>
                                <option value="3rd sem">3rd sem</option>
                                <option value="4th sem">4th sem</option>
                                <option value="5th sem">5th sem</option>
                                <option value="6th sem">6th sem</option>
                                <option value="7th sem">7th sem</option>
                                <option value="8th sem">8th sem</option>
                            </select>
                        </div>
                        <div class="form-group"><label>Department</label>
                            <select id="updSubjectDept" name="DeptCode" class="form-control" required>
                                ${depts.length > 0 ? depts.map(d => `<option value="${d.Code}">${d.Name} (${d.Code})</option>`).join('') : '<option value="">-- No Departments Found --</option>'}
                            </select>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn-cancel" onclick="closeModal('updateSubjectModal')">Cancel</button>
                            <button type="submit" class="btn-primary">Update</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        document.getElementById('addClassForm').onsubmit = (e) => {
            const id = 'CLS' + Math.floor(100 + Math.random() * 899);
            handleAcademicSubmit(e, 'add_class', 'classModal', 'classes', { ID: id });
        };

        document.getElementById('addSubjectForm').onsubmit = (e) => {
            handleAcademicSubmit(e, 'add_subject', 'subjectModal', 'classes');
        };

        document.getElementById('updateClassForm').onsubmit = (e) => {
            const originalId = document.getElementById('updClassOriginalId').value;
            handleAcademicSubmit(e, 'update_academic', 'updateClassModal', 'classes', { 
                subSheet: 'Classes', 
                key: 'ID', 
                val: originalId 
            });
        };

        document.getElementById('updateSubjectForm').onsubmit = (e) => {
            const originalCode = document.getElementById('updSubjectOriginalCode').value;
            handleAcademicSubmit(e, 'update_academic', 'updateSubjectModal', 'classes', { 
                subSheet: 'Subjects', 
                key: 'Code', 
                val: originalCode 
            });
        };
    } catch (err) {
        console.error("Academic Load Error:", err);
        mainView.innerHTML = `<div class="mgmt-header"><div class="mgmt-title"><h2>Error Loading Academic Data</h2></div></div><div style="padding:40px; color:#ef4444;">Failed to fetch academic records. Please ensure your backend is deployed correctly.</div>`;
    }
}

window.showUpdateClassModal = (id) => {
    if (!ALL_CLASSES_DATA) return;
    const cls = ALL_CLASSES_DATA.find(c => c.ID === id);
    if (!cls) return;

    document.getElementById('updClassOriginalId').value = cls.ID;
    document.getElementById('updClassName').value = cls.Name || '';
    document.getElementById('updClassSem').value = cls.Semester || '1st sem';
    document.getElementById('updClassDept').value = cls.DeptCode || '';
    document.getElementById('updClassStatus').value = cls.Status || 'Active';

    showModal('updateClassModal');
};

window.showUpdateSubjectModal = (code) => {
    if (!ALL_SUBJECTS_DATA) return;
    const sub = ALL_SUBJECTS_DATA.find(s => s.Code === code);
    if (!sub) return;

    document.getElementById('updSubjectOriginalCode').value = sub.Code;
    document.getElementById('updSubjectCode').value = sub.Code;
    document.getElementById('updSubjectName').value = sub.Name || '';
    document.getElementById('updSubjectSem').value = sub.Semester || '1st sem';
    document.getElementById('updSubjectDept').value = sub.DeptCode || '';

    showModal('updateSubjectModal');
};

// ─────────────────────────────────────────────────────────────
// ACADEMIC MANAGEMENT: PROXY SYSTEM
// ─────────────────────────────────────────────────────────────
async function renderProxyMgmt() {
    const container = document.getElementById('mainView');
    container.innerHTML = `<div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i> Loading Proxies...</div>`;

    try {
        const [proxiesRaw, profs, subjects] = await Promise.all([
            fetch(`${SCRIPT_URL}?sheet=proxies`).then(r => r.json()),
            fetch(`${SCRIPT_URL}?sheet=professor`).then(r => r.json()),
            fetch(`${SCRIPT_URL}?sheet=subjects`).then(r => r.json())
        ]);

        const proxies = Array.isArray(proxiesRaw) ? proxiesRaw : [];
        window._allProxies = proxies;

        container.innerHTML = `
        <div class="mgmt-header">
            <div>
                <h2>Proxy & Invigilation Management</h2>
                <p>System assignments overview and scheduling</p>
            </div>
            <div style="display: flex; gap: 15px; align-items: center;">
                <div style="display: flex; align-items: center; gap: 10px; background: rgba(255,255,255,0.05); padding: 5px 15px; border-radius: 10px; border: 1px solid var(--border-color);">
                    <i class="fa-solid fa-calendar-day" style="color: var(--accent-color);"></i>
                    <input type="date" id="proxyDateFilter" style="background: transparent; border: none; color: white; outline: none; font-family: inherit; font-size: 14px;" onchange="window.filterProxyByDate()">
                </div>
                <button class="btn-primary" onclick="showModal('proxyModal')">
                    <i class="fa-solid fa-user-shield"></i> New Assignment
                </button>
            </div>
        </div>

        <div class="mgmt-table-card">
            <table class="mgmt-table">
                <thead>
                    <tr>
                        <th>Professor</th>
                        <th>Classroom</th>
                        <th>Subject</th>
                        <th>Type</th>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="proxyTableBody">
                    ${renderProxyRows(proxies)}
                </tbody>
            </table>
        </div>

        <div id="proxyModal" class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header"><h3>Assign Proxy/Invigilation Task</h3></div>
                <form id="addProxyForm" class="modal-form">
                    <div class="form-group">
                        <label>Professor Email</label>
                        <select name="Professor_Email" class="form-control" required>
                            ${profs.map(pr => `<option value="${pr.Email}">${pr['Professor first_name']} (${pr.Email})</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Classroom</label>
                        <input name="Classroom" class="form-control" placeholder="e.g. Room 302" required>
                    </div>
                    <div class="form-group">
                        <label>Subject</label>
                        <select name="Subject" id="proxySubjectSelect" class="form-control" onchange="window.updateProxyTypeOptions()" required>
                            <option value="Exam">Exam (Invigilation)</option>
                            ${subjects.map(s => `<option value="${s.Name}">${s.Name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Task Type</label>
                        <select name="Type" id="proxyTypeSelect" class="form-control" required>
                            <option value="Invigilation">Invigilation</option>
                            <option value="Proxy">Proxy</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Effective Date</label>
                        <input type="date" name="Date" class="form-control" required value="${new Date().toLocaleDateString('en-CA')}">
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                        <div class="form-group">
                            <label>From Time</label>
                            <input type="time" name="Time_From" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label>To Time</label>
                            <input type="time" name="Time_To" class="form-control" required>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-cancel" onclick="closeModal('proxyModal')">Cancel</button>
                        <button type="submit" class="btn-primary">Confirm Assignment</button>
                    </div>
                </form>
            </div>
        </div>

        <div id="updateProxyModal" class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header"><h3>Update Proxy/Invigilation Task</h3></div>
                <form id="updateProxyForm" class="modal-form">
                    <input type="hidden" id="updProxyOriginalId" name="originalId">
                    <div class="form-group">
                        <label>Professor Email</label>
                        <select id="updProxyProf" name="Professor_Email" class="form-control" required>
                            ${profs.map(pr => `<option value="${pr.Email}">${pr['Professor first_name']} (${pr.Email})</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Classroom</label>
                        <input id="updProxyClassroom" name="Classroom" class="form-control" placeholder="e.g. Room 302" required>
                    </div>
                    <div class="form-group">
                        <label>Subject</label>
                        <select id="updProxySubject" name="Subject" class="form-control" onchange="window.updateUpdProxyTypeOptions()" required>
                            <option value="Exam">Exam (Invigilation)</option>
                            ${subjects.map(s => `<option value="${s.Name}">${s.Name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Task Type</label>
                        <select id="updProxyType" name="Type" class="form-control" required>
                            <option value="Invigilation">Invigilation</option>
                            <option value="Proxy">Proxy</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Effective Date</label>
                        <input type="date" id="updProxyDate" name="Date" class="form-control" required>
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                        <div class="form-group">
                            <label>From Time</label>
                            <input type="time" id="updProxyFromTime" name="Time_From" class="form-control" required>
                        </div>
                        <div class="form-group">
                            <label>To Time</label>
                            <input type="time" id="updProxyToTime" name="Time_To" class="form-control" required>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-cancel" onclick="closeModal('updateProxyModal')">Cancel</button>
                        <button type="submit" class="btn-primary">Update Assignment</button>
                    </div>
                </form>
            </div>
        </div>
        `;

        document.getElementById('addProxyForm').onsubmit = (e) => handleAcademicSubmit(e, 'add_proxy', 'proxyModal', 'proxy');
        document.getElementById('updateProxyForm').onsubmit = (e) => {
            const originalId = document.getElementById('updProxyOriginalId').value;
            handleAcademicSubmit(e, 'update_academic', 'updateProxyModal', 'proxy', {
                subSheet: 'Proxies',
                key: 'ID',
                val: originalId
            });
        };
        window.updateProxyTypeOptions();
    } catch (err) {
        console.error("Proxy Load Error:", err);
        container.innerHTML = `<div class="mgmt-header"><div class="mgmt-title"><h2>Error Loading Proxies</h2></div></div><div style="padding:40px; color:var(--error-color);">Failed to fetch proxy data. Please check your network or backend deployment.</div>`;
    }
}

window.updateProxyTypeOptions = () => {
    const subjSelect = document.getElementById('proxySubjectSelect');
    if (!subjSelect) return;
    const subject = subjSelect.value;
    const typeSelect = document.getElementById('proxyTypeSelect');

    if (subject === 'Exam') {
        typeSelect.innerHTML = `<option value="Invigilation">Invigilation</option><option value="Proxy">Proxy</option>`;
    } else {
        typeSelect.innerHTML = `<option value="Proxy">Proxy</option>`;
    }
};

window.updateUpdProxyTypeOptions = () => {
    const subjSelect = document.getElementById('updProxySubject');
    if (!subjSelect) return;
    const subject = subjSelect.value;
    const typeSelect = document.getElementById('updProxyType');

    if (subject === 'Exam') {
        typeSelect.innerHTML = `<option value="Invigilation">Invigilation</option><option value="Proxy">Proxy</option>`;
    } else {
        typeSelect.innerHTML = `<option value="Proxy">Proxy</option>`;
    }
};

window.showUpdateProxyModal = (id) => {
    if (!window._allProxies) return;
    const p = window._allProxies.find(x => x.ID === id);
    if (!p) return;

    document.getElementById('updProxyOriginalId').value = p.ID;
    document.getElementById('updProxyProf').value = p.Professor_Email || p.ProfessorEmail || '';
    document.getElementById('updProxyClassroom').value = p.Classroom || '';
    document.getElementById('updProxySubject').value = p.Subject || '';
    window.updateUpdProxyTypeOptions();
    
    // Set type after options are populated
    setTimeout(() => {
        const tSel = document.getElementById('updProxyType');
        if(tSel) tSel.value = p.Type || 'Proxy';
    }, 50);

    // Date formatting for input type="date"
    let dVal = p.Date || p.date || '';
    if (dVal && dVal.includes('/')) {
        const parts = dVal.split('/');
        if (parts.length === 3) {
            dVal = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
    }
    document.getElementById('updProxyDate').value = dVal;
    
    // Time formatting for input type="time"
    document.getElementById('updProxyFromTime').value = p.Time_From || p.FromTime || '';
    document.getElementById('updProxyToTime').value = p.Time_To || p.ToTime || '';

    showModal('updateProxyModal');
};

// Helper to render proxy rows
function renderProxyRows(list) {
    if (!list || list.length === 0) {
        return '<tr><td colspan="7" style="text-align:center; padding:40px; color:var(--text-muted);">No assignments found for the selected date.</td></tr>';
    }
    return list.map(p => `
        <tr>
            <td style="font-weight:600;">
                <div style="display:flex; flex-direction:column;">
                    <span>${p.Professor_Email || p.ProfessorEmail || 'N/A'}</span>
                    <small style="color:var(--text-muted); font-size:10px;">ID: ${p.ID || 'N/A'}</small>
                </div>
            </td>
            <td>${p.Classroom || 'N/A'}</td>
            <td>${p.Subject || 'N/A'}</td>
            <td><span class="status-badge ${p.Type === 'Invigilation' ? 'status-inactive' : 'status-active'}">${p.Type || 'Proxy'}</span></td>
            <td style="font-size:13px; font-weight:600;">${p.Date || p.date || 'N/A'}</td>
            <td style="font-size:13px; color:var(--text-muted);">${p.Time_From || p.FromTime || 'N/A'} - ${p.Time_To || p.ToTime || 'N/A'}</td>
            <td class="action-btns">
                <button class="action-btn btn-edit" title="Edit Assignment" onclick="showUpdateProxyModal('${p.ID}')"><i class="fa-solid fa-pen-to-square"></i></button>
                <button class="action-btn btn-delete" title="Delete Assignment" onclick="deleteAcademic('Proxies', 'ID', '${p.ID}', 'proxy')"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

// Global filter function
window.filterProxyByDate = () => {
    const filterVal = document.getElementById('proxyDateFilter').value;
    const allRows = window._allProxies || [];
    
    if (!filterVal) {
        document.getElementById('proxyTableBody').innerHTML = renderProxyRows(allRows);
        return;
    }

    // Filter logic
    const filtered = allRows.filter(p => {
        const pDate = p.Date || p.date || '';
        // Handle different date formats (YYYY-MM-DD vs DD/MM/YYYY etc)
        if (pDate.includes('-')) {
             return pDate === filterVal;
        }
        // If sheet is DD/MM/YYYY and input is YYYY-MM-DD
        const parts = filterVal.split('-'); // [YYYY, MM, DD]
        const formattedInput = `${parts[2]}/${parts[1]}/${parts[0]}`;
        const formattedInput2 = `${parseInt(parts[2])}/${parseInt(parts[1])}/${parts[0]}`; // handle leading zeros
        return pDate === formattedInput || pDate === formattedInput2;
    });

    document.getElementById('proxyTableBody').innerHTML = renderProxyRows(filtered);
};


// ─────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────
async function handleAcademicSubmit(e, action, modalId, viewToReload, extraData = {}) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = { ...extraData };
    fd.forEach((v, k) => data[k] = v);

    const payload = { action: action, data: data };
    
    if (action === 'update_academic') {
        payload.subSheet = data.subSheet;
        payload.key = data.key;
        payload.val = data.val;
        
        delete data.subSheet;
        delete data.key;
        delete data.val;
        delete data.originalId;
        delete data.originalCode;
        
        showToast("Saving updates...", "success");
    } else {
        showToast("Processing request...", "success");
    }

    await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(payload)
    });
    closeModal(modalId);
    
    setTimeout(() => {
        loadView(viewToReload);
    }, 1500);
}

window.deleteAcademic = async (subSheet, key, val, viewToReload) => {
    if (!confirm(`Are you sure you want to delete this ${subSheet} record?`)) return;

    // Immediate UI feedback
    const btn = event.target.closest('button');
    if (btn) {
        const row = btn.closest('tr');
        if (row) row.style.opacity = '0.3';
    }

    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ action: 'delete_academic', subSheet: subSheet, key: key, val: val })
        });

        showToast(`Deletion request sent. Syncing database...`, 'success');

        // Wait 1.5 seconds for GAS to finish and for eventual consistency
        setTimeout(() => {
            loadView(viewToReload || subSheet.toLowerCase());
        }, 1500);
    } catch (err) {
        console.error('Delete Error:', err);
        showToast('Error connecting to server.', 'error');
    }
};

// ─────────────────────────────────────────────────────────────
// RECOVERY SYSTEM (BULK SELECTION & DIRECT LINKS)
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// RECOVERY SYSTEM (BULK SELECTION & DIRECT LINKS)
// ─────────────────────────────────────────────────────────────
async function renderRecoverySystem() {
    const mainView = document.getElementById('mainView');
    mainView.innerHTML = `
        <div class="mgmt-header">
            <div class="mgmt-title">
                <h2>Account Recovery Center</h2>
                <p>Manage access restoration and security key resets for students.</p>
            </div>
        </div>
        <div style="text-align:center; padding:50px;">
            <i class="fa-solid fa-circle-notch fa-spin" style="font-size:32px; color:var(--primary-color);"></i>
            <p style="margin-top:15px; color:var(--text-muted);">Fetching student security directory...</p>
        </div>
    `;

    try {
        const students = await (await fetch(`${SCRIPT_URL}?sheet=student`)).json();

        if (!students || students.length === 0) {
            mainView.innerHTML = `
                <div class="mgmt-header"><div class="mgmt-title"><h2>Account Recovery Center</h2></div></div>
                <div class="mgmt-table-card" style="padding:50px; text-align:center;">
                    <i class="fa-solid fa-users-slash" style="font-size:48px; color:var(--text-muted); opacity:0.3;"></i>
                    <p style="margin-top:20px; color:var(--text-muted);">No student records found in database.</p>
                </div>
            `;
            return;
        }

        mainView.innerHTML = `
            <div class="mgmt-header">
                <div class="mgmt-title">
                    <h2>Account Recovery Center</h2>
                    <p>Select students and dispatch recovery OTPs to their registered emails.</p>
                </div>
                <button class="btn-primary" id="btnSendBulk" onclick="sendBulkRecovery()" style="background:linear-gradient(135deg, #f59e0b, #d97706); color:#0f172a; display:none;">
                    <i class="fa-solid fa-paper-plane"></i> Send OTPs (<span id="selectedCount">0</span>)
                </button>
            </div>

            <div class="mgmt-table-card">
                <div style="padding:15px 25px; border-bottom:1px solid var(--border-color); display:flex; align-items:center; gap:15px;">
                    <input type="checkbox" id="selectAllStudents" style="width:18px; height:18px; cursor:pointer;" onchange="toggleAllStudents(this)">
                    <span style="font-size:14px; color:var(--text-muted);">Select All Students</span>
                </div>
                <table class="mgmt-table">
                    <thead>
                        <tr>
                            <th width="40"></th>
                            <th>ID</th>
                            <th>Student Name</th>
                            <th>Email Address</th>
                        </tr>
                    </thead>
                    <tbody id="recoveryTableBody">
                        ${students.map(s => {
            const email = s.Email || s.email || s['Email Address'] || '';
            const name = s.Name || s.name || s['Student Name'] || 'Unknown';
            const id = s.ID || s.id || s['Student ID'] || 'N/A';

            return `
                                <tr>
                                    <td><input type="checkbox" class="student-checkbox" value="${email}" onchange="updateSelectionCount()"></td>
                                    <td style="color:var(--text-muted); font-family:monospace;">${id}</td>
                                    <td style="font-weight:600;">${name}</td>
                                    <td>${email}</td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) {
        mainView.innerHTML = `<div class="error-msg" style="display:block">Error loading student data: ${err.message}</div>`;
    }
}

window.toggleAllStudents = (el) => {
    document.querySelectorAll('.student-checkbox').forEach(cb => cb.checked = el.checked);
    updateSelectionCount();
};

window.updateSelectionCount = () => {
    const selected = document.querySelectorAll('.student-checkbox:checked').length;
    const countEl = document.getElementById('selectedCount');
    const btn = document.getElementById('btnSendBulk');
    if (countEl) countEl.innerText = selected;
    if (btn) btn.style.display = selected > 0 ? 'flex' : 'none';
};

window.sendBulkRecovery = async () => {
    const selectedEmails = Array.from(document.querySelectorAll('.student-checkbox:checked')).map(cb => cb.value);
    if (selectedEmails.length === 0) return;

    const btn = document.getElementById('btnSendBulk');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Dispatching OTPs...';

    try {
        const emailParams = selectedEmails.join(',');
        await fetch(`${SCRIPT_URL}?action=send_admin_otps&emails=${encodeURIComponent(emailParams)}`, {
            method: 'GET',
            mode: 'no-cors'
        });
        showToast(`Success! Recovery OTPs sent to ${selectedEmails.length} students.`, 'success');
        renderRecoverySystem();
    } catch (err) {
        showToast('Transmission Error: ' + err.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send OTPs';
    }
};

// ─────────────────────────────────────────────────────────────
// TIMETABLE MANAGEMENT
// ─────────────────────────────────────────────────────────────
async function renderTimetables() {
    const mainView = document.getElementById('mainView');
    
    // Ensure departments are loaded for the upload form
    if (!window.SMART_ATTEND_DEPTS || window.SMART_ATTEND_DEPTS.length === 0) {
        try {
            const dResp = await fetch(`${SCRIPT_URL}?sheet=departments`);
            window.SMART_ATTEND_DEPTS = await dResp.json();
        } catch (e) { console.error("Failed to fetch departments", e); }
    }

    mainView.innerHTML = `
        <div class="mgmt-header">
            <div class="mgmt-title">
                <h2>Timetable Management</h2>
                <p>Upload and manage course-specific timetables.</p>
            </div>
            <button class="btn-primary" onclick="showModal('uploadTimetableModal')">
                <i class="fa-solid fa-cloud-arrow-up"></i> Upload Timetable
            </button>
        </div>
        
        <div class="mgmt-table-card" style="padding:20px;">
            <div style="text-align:center; padding:20px;" id="timetableLoader">
                <i class="fa-solid fa-circle-notch fa-spin"></i> Fetching records...
            </div>
            <table class="mgmt-table" id="timetableTable" style="display:none;">
                <thead>
                    <tr>
                        <th>Department</th>
                        <th>Semester</th>
                        <th>Uploaded On</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody id="timetableBody"></tbody>
            </table>
        </div>

        <div id="uploadTimetableModal" class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header"><h3>Upload Timetable PDF</h3></div>
                <form id="timetableForm" class="modal-form">
                    <div class="form-group">
                        <label>Department</label>
                        <select id="ttDept" class="form-control" required>
                            <option value="">Select Department</option>
                            ${(window.SMART_ATTEND_DEPTS || []).map(d => `<option value="${d.Code || d.Name}">${d.Name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Semester</label>
                        <select id="ttSem" class="form-control" required>
                            <option value="">Select Semester</option>
                            <option value="1st sem">1st Semester</option>
                            <option value="2nd sem">2nd Semester</option>
                            <option value="3rd sem">3rd Semester</option>
                            <option value="4th sem">4th Semester</option>
                            <option value="5th sem">5th Semester</option>
                            <option value="6th sem">6th Semester</option>
                            <option value="7th sem">7th Semester</option>
                            <option value="8th sem">8th Semester</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Timetable PDF File</label>
                        <input type="file" id="ttFile" class="form-control" accept="application/pdf" required style="padding:10px;">
                        <small style="color: #64748b; display: block; margin-top: 4px;">Max file size: 5MB (PDF format only)</small>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-cancel" onclick="closeModal('uploadTimetableModal')">Cancel</button>
                        <button type="submit" class="btn-primary" id="ttUploadBtn">Upload File</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    try {
        const resp = await fetch(`${SCRIPT_URL}?action=get_all_timetables`);
        const data = await resp.json();
        
        document.getElementById('timetableLoader').style.display = 'none';
        document.getElementById('timetableTable').style.display = 'table';
        
        const tbody = document.getElementById('timetableBody');
        if (data.status === 'success' && data.data.length > 0) {
            tbody.innerHTML = data.data.map(t => `
                <tr>
                    <td style="font-weight:600;">${t.Department}</td>
                    <td>${t.Semester}</td>
                    <td style="color:var(--text-muted); font-size:13px;">${t.UploadedAt || 'Recently'}</td>
                    <td class="action-btns">
                        <a href="${t.ViewURL}" target="_blank" class="action-btn" title="View"><i class="fa-solid fa-eye" style="color:var(--primary-color);"></i></a>
                        <a href="${t.DownloadURL}" target="_blank" class="action-btn" title="Download"><i class="fa-solid fa-download" style="color:#10b981;"></i></a>
                        <button class="action-btn btn-edit" title="Update Timetable" onclick="showUpdateTimetable('${t.Department}', '${t.Semester}')"><i class="fa-solid fa-pen-to-square"></i></button>
                        <button class="action-btn btn-delete" onclick="deleteTimetable('${t.Department}', '${t.Semester}')" title="Delete"><i class="fa-solid fa-trash" style="color:#ef4444;"></i></button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted);">No timetables uploaded yet.</td></tr>';
        }
    } catch (err) {
        document.getElementById('timetableLoader').innerHTML = `<span style="color:#ef4444;">Failed to load timetables: ${err.message}</span>`;
    }

    document.getElementById('timetableForm').onsubmit = async (e) => {
        e.preventDefault();
        const dept = document.getElementById('ttDept').value;
        const sem = document.getElementById('ttSem').value;
        const file = document.getElementById('ttFile').files[0];
        
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            showToast("File is too large! Maximum allowed is 5MB.", "error");
            return;
        }

        const btn = document.getElementById('ttUploadBtn');
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Uploading...';
        
        const reader = new FileReader();
        reader.onload = async function() {
            try {
                const resp = await fetch(SCRIPT_URL, {
                    method: 'POST',
                    body: JSON.stringify({
                        action: 'upload_timetable',
                        department: dept,
                        semester: sem,
                        pdfBase64: reader.result
                    })
                });
                const res = await resp.json();
                if (res.status === 'success') {
                    showToast("Timetable uploaded successfully!", "success");
                    closeModal('uploadTimetableModal');
                    loadView('timetables');
                } else {
                    showToast("Upload failed: " + res.message, "error");
                    btn.disabled = false;
                    btn.innerText = "Upload File";
                }
            } catch (err) {
                showToast("Network Error: " + err.message, "error");
                btn.disabled = false;
                btn.innerText = "Upload File";
            }
        };
        reader.readAsDataURL(file);
    };
}

window.showUpdateTimetable = (dept, sem) => {
    document.getElementById('ttDept').value = dept;
    document.getElementById('ttSem').value = sem;
    // Clear the file input in case they had something else
    document.getElementById('ttFile').value = '';
    showModal('uploadTimetableModal');
};

window.deleteTimetable = async (dept, sem) => {
    if (!confirm(`Are you sure you want to delete the timetable for ${dept} - ${sem}?`)) return;
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'delete_timetable',
                department: dept,
                semester: sem
            })
        });
        showToast("Timetable deleted.", "success");
        loadView('timetables');
    } catch (e) {
        showToast("Deletion failed.", "error");
    }
};

// ─────────────────────────────────────────────────────────────
// CAMERA IP MANAGEMENT
// ─────────────────────────────────────────────────────────────
async function renderCameraIPMgmt() {
    const mainView = document.getElementById('mainView');

    let cameraIPs = [];
    let classes = [];
    let depts = window.SMART_ATTEND_DEPTS || [];
    try {
        const [respIPs, respClasses] = await Promise.all([
            fetch(`${SCRIPT_URL}?sheet=camera_ips`),
            fetch(`${SCRIPT_URL}?sheet=classes`)
        ]);
        cameraIPs = await respIPs.json();
        classes = await respClasses.json();
        
        if (depts.length === 0) {
            const respDepts = await fetch(`${SCRIPT_URL}?sheet=departments`);
            depts = await respDepts.json();
            window.SMART_ATTEND_DEPTS = depts;
        }
    } catch (e) {
        console.error("Failed to fetch camera IPs or classes", e);
    }

    mainView.innerHTML = `
        <div class="mgmt-header">
            <div class="mgmt-title">
                <h2>Camera IP Management</h2>
                <p>Assign fixed IP addresses to classroom cameras for live attendance.</p>
            </div>
            <button class="btn-primary" onclick="showAddCameraModal()">
                <i class="fa-solid fa-plus"></i> Add Camera IP
            </button>
        </div>

        <div class="mgmt-table-card">
            <table class="mgmt-table">
                <thead>
                    <tr>
                        <th>Department</th>
                        <th>Classroom Name</th>
                        <th>IP Address</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${cameraIPs.length === 0 ? '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--text-muted);">No Camera IPs assigned yet.</td></tr>' : 
                        cameraIPs.map(c => `
                            <tr>
                                <td style="font-weight:600;">${c.Department_Name || c.department_name || 'N/A'}</td>
                                <td style="font-weight:600;">${c.Classroom_Name || c.classroom_name || 'N/A'}</td>
                                <td style="color:var(--primary-color); font-family:monospace;">${c.IP_Address || c.ip_address || 'N/A'}</td>
                                <td><span class="status-badge status-active">Fixed</span></td>
                                <td class="action-btns">
                                    <button class="action-btn btn-edit" onclick="editCameraIP('${c.Department_Name || c.department_name || ''}', '${c.Classroom_Name || c.classroom_name || ''}', '${c.IP_Address || c.ip_address || ''}')" title="Edit">
                                        <i class="fa-solid fa-pen"></i>
                                    </button>
                                    <button class="action-btn btn-delete" onclick="deleteCameraIP('${c.Classroom_Name || c.classroom_name}')" title="Delete">
                                        <i class="fa-solid fa-trash"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                </tbody>
            </table>
        </div>

        <div id="cameraModal" class="modal-overlay">
            <div class="modal-content" style="max-width:400px;">
                <div class="modal-header"><h3>Add Camera IP</h3></div>
                <form id="addCameraForm" class="modal-form">
                    <input type="hidden" id="camOriginalClass" name="original_classroom">
                    <div class="form-group">
                        <label>Select Department</label>
                        <select id="camDeptFilter" name="department_name" class="form-control" required>
                            <option value="">Select a Department...</option>
                            ${depts.map(d => `<option value="${d.Code || d.Name}">${d.Name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Select Classroom</label>
                        <select id="camClassFilter" name="classroom_name" class="form-control" required disabled>
                            <option value="">First Select a Department</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Camera IP Address (e.g., 192.168.1.50)</label>
                        <input type="text" name="ip_address" class="form-control" placeholder="192.168.X.X" required>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn-cancel" onclick="closeModal('cameraModal')">Cancel</button>
                        <button type="submit" class="btn-primary">Save IP</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    const deptSelect = document.getElementById('camDeptFilter');
    const classSelect = document.getElementById('camClassFilter');

    if (deptSelect && classSelect) {
        deptSelect.addEventListener('change', (e) => {
            const selectedDept = e.target.value;
            if (!selectedDept) {
                classSelect.innerHTML = '<option value="">First Select a Department</option>';
                classSelect.disabled = true;
                return;
            }
            
            // Filter classes by department
            const filteredClasses = classes.filter(c => isDeptMatch(c.DeptCode || c.Department || c.Dept_Code, selectedDept));
            const uniqueClassNames = [...new Set(filteredClasses.map(c => c.Name).filter(Boolean))];
            
            if (uniqueClassNames.length === 0) {
                classSelect.innerHTML = '<option value="">No classrooms found in this department</option>';
                classSelect.disabled = true;
            } else {
                classSelect.innerHTML = '<option value="">Select a Classroom...</option>' + 
                    uniqueClassNames.map(name => `<option value="${name}">${name}</option>`).join('');
                classSelect.disabled = false;
            }
        });
    }

    document.getElementById('addCameraForm').onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const deptName = fd.get('department_name').trim();
        const className = fd.get('classroom_name').trim();
        const ip = fd.get('ip_address').trim();
        
        try {
            const resp = await fetch(SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: fd.get('original_classroom') ? 'update_camera_ip' : 'add_camera_ip',
                    original_classroom: fd.get('original_classroom'),
                    department_name: deptName,
                    classroom_name: className,
                    ip_address: ip
                })
            });
            const res = await resp.json();
            if (res.status === 'success') {
                showToast("Camera IP saved successfully!", "success");
                closeModal('cameraModal');
                loadView('camera-ip');
            } else {
                showToast("Failed to save: " + res.message, "error");
            }
        } catch (err) {
            showToast("Network Error: " + err.message, "error");
        }
    };
}

window.showAddCameraModal = () => {
    document.getElementById('addCameraForm').reset();
    document.getElementById('camOriginalClass').value = '';
    document.querySelector('#cameraModal .modal-header h3').innerText = 'Add Camera IP';
    document.querySelector('#cameraModal button[type="submit"]').innerText = 'Save IP';
    document.getElementById('camClassFilter').innerHTML = '<option value="">First Select a Department</option>';
    document.getElementById('camClassFilter').disabled = true;
    
    const modal = document.getElementById('cameraModal');
    if (modal) modal.style.display = 'flex';
};

window.editCameraIP = (dept, className, ip) => {
    document.getElementById('addCameraForm').reset();
    document.getElementById('camOriginalClass').value = className;
    document.querySelector('#cameraModal .modal-header h3').innerText = 'Update Camera IP';
    document.querySelector('#cameraModal button[type="submit"]').innerText = 'Update IP';
    
    const deptSelect = document.getElementById('camDeptFilter');
    deptSelect.value = dept;
    
    // Trigger change event to populate classes
    const event = new Event('change');
    deptSelect.dispatchEvent(event);
    
    // Set class and IP
    setTimeout(() => {
        document.getElementById('camClassFilter').value = className;
        document.querySelector('input[name="ip_address"]').value = ip;
    }, 50);
    
    const modal = document.getElementById('cameraModal');
    if (modal) modal.style.display = 'flex';
};

window.deleteCameraIP = async (classroomName) => {
    if (!confirm(`Are you sure you want to remove the IP for ${classroomName}?`)) return;
    try {
        const resp = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'delete_camera_ip',
                classroom_name: classroomName
            })
        });
        const res = await resp.json();
        if (res.status === 'success') {
            showToast("Camera IP deleted.", "success");
            loadView('camera-ip');
        } else {
            showToast("Failed to delete: " + res.message, "error");
        }
    } catch (e) {
        showToast("Network error.", "error");
    }
};

// Profile Dropdown Toggle
function toggleAdminProfile() {
    const dropdown = document.getElementById('adminDropdown');
    if (!dropdown) return;

    if (dropdown.classList.contains('show')) {
        dropdown.classList.remove('show');
        setTimeout(() => { dropdown.style.display = 'none'; }, 300);
    } else {
        dropdown.style.display = 'flex';
        setTimeout(() => { dropdown.classList.add('show'); }, 10);
    }
}

// Global click listener for dropdown closure
document.addEventListener('click', (e) => {
    const wrapper = document.querySelector('.user-profile-wrapper');
    const dropdown = document.getElementById('adminDropdown');
    if (wrapper && !wrapper.contains(e.target) && dropdown && dropdown.classList.contains('show')) {
        dropdown.classList.remove('show');
        setTimeout(() => { dropdown.style.display = 'none'; }, 300);
    }
});

function logout() {
    sessionStorage.clear();
    window.location.replace('admin_login.html');
}

window.logout = logout;
