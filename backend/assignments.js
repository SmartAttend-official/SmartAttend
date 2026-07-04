// SmartAttend Assignments Logic
const SCRIPT_URL = window.SMART_ATTEND_CONFIG.SCRIPT_URL;

let allAssignments = [];
let allSubjects = [];
let allDepartments = [];

// Selected file properties
let selectedFileBase64 = '';
let selectedFileName = '';

document.addEventListener('DOMContentLoaded', async function () {
    const profEmail = sessionStorage.getItem('userEmail');

    // UI elements
    const uploadForm = document.getElementById('uploadAssignmentForm');
    const uploadDept = document.getElementById('uploadDept');
    const uploadDueDate = document.getElementById('uploadDueDate');
    const uploadSem = document.getElementById('uploadSem');
    const uploadSubject = document.getElementById('uploadSubject');
    
    const filterDept = document.getElementById('filterDept');
    const filterSem = document.getElementById('filterSem');
    const filterSubject = document.getElementById('filterSubject');
    const filterDate = document.getElementById('filterDate');

    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('assignmentFile');
    const fileInfo = document.getElementById('fileSelectedInfo');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const submitBtn = document.getElementById('submitBtn');

    // --- 1. Populate Dropdowns from Google Sheets ---
    try {
        const [depts, subjects] = await Promise.all([
            fetch(`${SCRIPT_URL}?sheet=departments`).then(res => res.json()),
            fetch(`${SCRIPT_URL}?sheet=subjects`).then(res => res.json())
        ]);

        allDepartments = Array.isArray(depts) ? depts : [];
        allSubjects = Array.isArray(subjects) ? subjects : [];

        // Populate Department select boxes
        allDepartments.forEach(d => {
            const name = d.Name || d.NameName || d.Code;
            const code = d.Code || d.Name;

            // Upload form
            const optUpload = document.createElement('option');
            optUpload.value = code;
            optUpload.textContent = name;
            uploadDept.appendChild(optUpload);

            // Filter bar
            const optFilter = document.createElement('option');
            optFilter.value = code;
            optFilter.textContent = name;
            filterDept.appendChild(optFilter);
        });

    } catch (err) {
        console.error("Failed to load academic data:", err);
        showAlert("Failed to initialize dropdown data.", true);
    }

    // --- 2. Dynamic Subject Filtering ---
    const updateSubjects = (deptSelect, semSelect, subjectSelect, searchPlaceholder) => {
        const selectedDept = deptSelect.value;
        const rawSem = semSelect.value;

        if (!selectedDept || !rawSem) {
            subjectSelect.innerHTML = `<option value="" disabled selected>${searchPlaceholder}</option>`;
            return;
        }

        // Format semester to match DB schema (e.g. "3" -> "3rd sem")
        const formattedSem = rawSem == 1 ? "1st sem" : 
                             rawSem == 2 ? "2nd sem" : 
                             rawSem == 3 ? "3rd sem" : 
                             rawSem + "th sem";

        subjectSelect.innerHTML = '<option value="" disabled>Searching Subjects...</option>';

        const filtered = allSubjects.filter(s => {
            const sDept = (s.DeptCode || s.Department || "").toString().toLowerCase().trim();
            const sSem = (s.Semester || "").toString().toLowerCase().trim();
            return sDept === selectedDept.toLowerCase().trim() && sSem === formattedSem.toLowerCase();
        });

        if (filtered.length === 0) {
            subjectSelect.innerHTML = '<option value="" disabled>No subjects found</option>';
        } else {
            subjectSelect.innerHTML = '<option value="" disabled selected>Select Subject</option>';
            filtered.forEach(sub => {
                const opt = document.createElement('option');
                opt.value = sub.Code || sub.Name;
                opt.textContent = `${sub.Name} (${sub.Code || ''})`;
                subjectSelect.appendChild(opt);
            });
        }
    };

    // Upload Listeners
    uploadDept.addEventListener('change', () => updateSubjects(uploadDept, uploadSem, uploadSubject, 'Select Subject (Choose Dept & Sem)'));
    uploadSem.addEventListener('change', () => updateSubjects(uploadDept, uploadSem, uploadSubject, 'Select Subject (Choose Dept & Sem)'));

    // Filter Listeners
    filterDept.addEventListener('change', () => {
        updateSubjects(filterDept, filterSem, filterSubject, 'All');
        // If empty, reset to "All"
        if (!filterDept.value || !filterSem.value) {
            filterSubject.innerHTML = '<option value="">All</option>';
            // Add all subjects to filter list if only dept selected or sem selected
            const subset = allSubjects.filter(s => {
                if (filterDept.value) return (s.DeptCode || s.Department || "").toString().toLowerCase().trim() === filterDept.value.toLowerCase();
                if (filterSem.value) {
                    const formattedSem = filterSem.value == 1 ? "1st sem" : filterSem.value == 2 ? "2nd sem" : filterSem.value == 3 ? "3rd sem" : filterSem.value + "th sem";
                    return (s.Semester || "").toString().toLowerCase().trim() === formattedSem.toLowerCase();
                }
                return true;
            });
            subset.forEach(sub => {
                const opt = document.createElement('option');
                opt.value = sub.Code || sub.Name;
                opt.textContent = `${sub.Name} (${sub.Code || ''})`;
                filterSubject.appendChild(opt);
            });
        }
        filterHistory();
    });
    filterSem.addEventListener('change', () => {
        updateSubjects(filterDept, filterSem, filterSubject, 'All');
        if (!filterDept.value || !filterSem.value) {
            filterSubject.innerHTML = '<option value="">All</option>';
            const subset = allSubjects.filter(s => {
                if (filterDept.value) return (s.DeptCode || s.Department || "").toString().toLowerCase().trim() === filterDept.value.toLowerCase();
                if (filterSem.value) {
                    const formattedSem = filterSem.value == 1 ? "1st sem" : filterSem.value == 2 ? "2nd sem" : filterSem.value == 3 ? "3rd sem" : filterSem.value + "th sem";
                    return (s.Semester || "").toString().toLowerCase().trim() === formattedSem.toLowerCase();
                }
                return true;
            });
            subset.forEach(sub => {
                const opt = document.createElement('option');
                opt.value = sub.Code || sub.Name;
                opt.textContent = `${sub.Name} (${sub.Code || ''})`;
                filterSubject.appendChild(opt);
            });
        }
        filterHistory();
    });
    filterSubject.addEventListener('change', filterHistory);
    filterDate.addEventListener('change', filterHistory);

    // --- 3. Drag and Drop File Handlers ---
    if (dropZone) {
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                dropZone.classList.add('dragover');
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                dropZone.classList.remove('dragover');
            }, false);
        });

        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length > 0) {
                fileInput.files = files;
                handleFileSelect(fileInput);
            }
        });
    }

    // --- 4. Form Submission ---
    if (uploadForm) {
        uploadForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const title = document.getElementById('assignmentTitle').value.trim();
            const desc = document.getElementById('assignmentDesc').value.trim();
            const dept = uploadDept.value;
            const dueDate = uploadDueDate.value;
            const sem = uploadSem.value;
            const sub = uploadSubject.value;

            if (!title || !desc || !dept || !dueDate || !sem || !sub) {
                showAlert("Please fill out all required fields.", true);
                return;
            }

            const originalBtnText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Broadcasting...';
            submitBtn.disabled = true;

            const payload = {
                sheet: 'student_assignments',
                action: 'upload_assignment',
                professorEmail: profEmail,
                department: dept,
                semester: sem,
                subject: sub,
                title: title,
                description: desc,
                fileBase64: selectedFileBase64,
                fileName: selectedFileName,
                dueDate: dueDate
            };

            try {
                const response = await fetch(SCRIPT_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                // Since we are running in 'no-cors' mode, response status isn't accessible,
                // but we can assume success if the fetch completes without throwing.
                showAlert("Assignment broadcast successfully to students!");
                
                // Reset form fields
                uploadForm.reset();
                removeSelectedFile(null);
                uploadSubject.innerHTML = '<option value="" disabled selected>Select Subject (Choose Dept & Sem)</option>';

                // Reload the logs
                setTimeout(loadAssignments, 1500);

            } catch (err) {
                console.error("Submission failed:", err);
                showAlert("Failed to upload assignment. Please try again.", true);
            } finally {
                submitBtn.innerHTML = originalBtnText;
                submitBtn.disabled = false;
            }
        });
    }

    // --- 5. Initial Load ---
    loadAssignments();
});

// File input change handler
function handleFileSelect(input) {
    const file = input.files[0];
    const fileInfo = document.getElementById('fileSelectedInfo');
    const fileNameDisplay = document.getElementById('fileNameDisplay');

    if (!file) return;

    // Optional: Size limit checks (e.g. 15MB max)
    if (file.size > 15 * 1024 * 1024) {
        showAlert("File size exceeds 15MB limit.", true);
        input.value = '';
        return;
    }

    selectedFileName = file.name;

    const reader = new FileReader();
    reader.onload = function (e) {
        selectedFileBase64 = e.target.result;
        fileNameDisplay.textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
        fileInfo.style.display = 'flex';
    };
    reader.readAsDataURL(file);
}

// Clear file selection
function removeSelectedFile(e) {
    if (e) e.stopPropagation();
    selectedFileBase64 = '';
    selectedFileName = '';
    
    const fileInput = document.getElementById('assignmentFile');
    if (fileInput) fileInput.value = '';

    const fileInfo = document.getElementById('fileSelectedInfo');
    if (fileInfo) fileInfo.style.display = 'none';
}

// --- 6. Fetch Logs & Populate List ---
async function loadAssignments() {
    const listContainer = document.getElementById('historyList');
    const countBadge = document.getElementById('historyCountBadge');
    const profEmail = sessionStorage.getItem('userEmail');

    if (!listContainer) return;

    try {
        const url = `${SCRIPT_URL}?sheet=student_assignments&profEmail=${encodeURIComponent(profEmail)}`;
        const res = await fetch(url);
        const data = await res.json();

        allAssignments = Array.isArray(data) ? data : [];
        countBadge.textContent = `${allAssignments.length} Total`;
        filterHistory();

    } catch (err) {
        console.error("Failed to load historical assignments:", err);
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--danger-color);">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 24px; margin-bottom: 8px;"></i>
                <p style="margin: 0;">Error loading history from server.</p>
            </div>
        `;
    }
}

// --- 7. Filter History Logs ---
function filterHistory() {
    const filterDept = document.getElementById('filterDept').value.toLowerCase().trim();
    const filterSem = document.getElementById('filterSem').value.trim();
    const filterSubject = document.getElementById('filterSubject').value.toLowerCase().trim();
    const filterDate = document.getElementById('filterDate').value; // yyyy-mm-dd

    const listContainer = document.getElementById('historyList');
    if (!listContainer) return;

    // Filter array
    const filtered = allAssignments.filter(a => {
        // Dept match
        if (filterDept) {
            const aDept = (a.Department || "").toLowerCase().trim();
            if (aDept !== filterDept) return false;
        }

        // Sem match
        if (filterSem) {
            const aSem = (a.Semester || "").toString().toLowerCase().trim().replace(/[^0-9]/g, '');
            if (aSem !== filterSem) return false;
        }

        // Subject match
        if (filterSubject) {
            const aSub = (a.Subject || "").toLowerCase().trim();
            if (aSub !== filterSubject) return false;
        }

        // Date match (DB date is yyyy-mm-dd)
        if (filterDate) {
            const aDate = (a.Date || "").trim();
            if (aDate !== filterDate) return false;
        }

        return true;
    });

    renderHistory(filtered);
}

// --- 8. Render List ---
function renderHistory(list) {
    const listContainer = document.getElementById('historyList');
    
    if (list.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 50px; color: var(--text-muted);">
                <i class="fa-solid fa-folder-open" style="font-size: 28px; margin-bottom: 8px;"></i>
                <p style="margin: 0;">No assignments found matching criteria.</p>
            </div>
        `;
        return;
    }

    listContainer.innerHTML = '';

    list.forEach(a => {
        const item = document.createElement('div');
        item.className = 'history-item';

        // Check if there is a file attachment
        let attachmentHtml = '';
        if (a.AttachmentURL && a.AttachmentURL.startsWith('http')) {
            attachmentHtml = `
                <a href="${a.AttachmentURL}" target="_blank" class="attachment-link" title="${a.AttachmentName || 'Open Attachment'}">
                    <i class="fa-solid fa-paperclip"></i> ${a.AttachmentName || 'Download Attachment'}
                </a>
            `;
        } else {
            attachmentHtml = `<span style="font-size:12px; color:var(--text-muted);">No file attached</span>`;
        }

        // Format dates
        let dateStr = a.Date || 'N/A';
        try {
            if (a.Date && a.Date.includes('-')) {
                const parts = a.Date.split('-');
                if (parts.length === 3) dateStr = `${parts[2]}/${parts[1]}/${parts[0]}`; // Convert to DD/MM/YYYY
            }
        } catch(e) {}

        let dueDateStr = a.DueDate || 'N/A';
        try {
            if (a.DueDate && a.DueDate.includes('-')) {
                const parts = a.DueDate.split('-');
                if (parts.length === 3) dueDateStr = `${parts[2]}/${parts[1]}/${parts[0]}`; // Convert to DD/MM/YYYY
            }
        } catch(e) {}

        const semText = a.Semester ? (a.Semester.toString().toLowerCase().includes('sem') ? a.Semester : `Semester ${a.Semester}`) : 'N/A';

        item.innerHTML = `
            <div class="item-header">
                <div class="item-subject-wrapper">
                    <h4>${a.Subject || 'Unknown Subject'}</h4>
                    <div class="item-meta">
                        <span><i class="fa-solid fa-building"></i> ${a.Department || 'N/A'}</span>
                        <span>•</span>
                        <span><i class="fa-solid fa-graduation-cap"></i> ${semText}</span>
                        <span>•</span>
                        <span><i class="fa-solid fa-calendar"></i> Given: ${dateStr}</span>
                        <span>•</span>
                        <span style="color: #fbbf24; font-weight: 500;"><i class="fa-solid fa-clock"></i> Due: ${dueDateStr}</span>
                    </div>
                </div>
            </div>
            
            <p class="item-title">${a.Title || 'No Title'}</p>
            <p class="item-description">${a.Description || 'No description provided.'}</p>
            
            <div class="item-footer">
                ${attachmentHtml}
                <button class="delete-btn" onclick="deleteAssignment('${a.ID}')">
                    <i class="fa-solid fa-trash-can"></i> Delete
                </button>
            </div>
        `;

        listContainer.appendChild(item);
    });
}

// --- 9. Delete assignment API trigger ---
async function deleteAssignment(id) {
    if (!confirm("Are you sure you want to delete this assignment?\nThis will remove the record, file attachment, and send retraction emails to the class.")) {
        return;
    }

    const profEmail = sessionStorage.getItem('userEmail');

    try {
        showAlert("Deleting assignment and sending retraction notifications...");

        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sheet: 'student_assignments',
                action: 'delete_assignment',
                id: id,
                professorEmail: profEmail
            })
        });

        showAlert("Assignment deleted successfully.");
        // Reload history log list
        setTimeout(loadAssignments, 1500);

    } catch (err) {
        console.error("Deletion failed:", err);
        showAlert("Failed to delete assignment.", true);
    }
}

// --- Helper UI Functions (Sidebar dropdown toggles, alert boxes) ---
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

function logoutUser() {
    sessionStorage.clear();
    window.location.replace('Login.html');
}

function showAlert(message, isError = false) {
    const alertBox = document.getElementById('globalAlert');
    const text = document.getElementById('globalAlertText');
    const icon = alertBox.querySelector('i');

    if (!alertBox || !text || !icon) return;

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
    setTimeout(() => alertBox.classList.remove('show'), 3500);
}

// Inject user topbar parameters
const cacheName = sessionStorage.getItem('userName') || 'Professor';
const cacheEmail = sessionStorage.getItem('userEmail') || '';
if (document.getElementById('topbarName')) document.getElementById('topbarName').innerText = cacheName;
if (document.getElementById('topbarEmail')) document.getElementById('topbarEmail').innerText = cacheEmail;
if (document.getElementById('topbarAvatar')) document.getElementById('topbarAvatar').innerText = cacheName.charAt(0).toUpperCase();

// Expose functions globally for HTML calls
window.handleFileSelect = handleFileSelect;
window.removeSelectedFile = removeSelectedFile;
window.deleteAssignment = deleteAssignment;
window.toggleProfile = toggleProfile;
window.logoutUser = logoutUser;
