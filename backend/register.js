const API_URL = `${window.SMART_ATTEND_CONFIG.SCRIPT_URL}?sheet=student`;
const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';

let students = [];
let cameraStream = null;
let modelsReady = false;

function setStatus(msg, color) {
  const el = document.getElementById('statusBar');
  el.textContent = msg;
  el.style.color = color || 'white';
}

function setStep(n) {
  for (let i = 1; i <= 3; i++) {
    const el = document.getElementById('step' + i);
    el.className = 'step' + (i < n ? ' done' : i === n ? ' active' : '');
  }
}

// Load models and students in parallel
// Helper for department matching (similar to isDeptMatch in record.js)
function isDeptMatch(studentDept, selectedDept) {
  if (selectedDept === 'all') return true;
  if (!studentDept) return false;
  
  const sDept = studentDept.toString().trim().toLowerCase();
  const selDept = selectedDept.toString().trim().toLowerCase();
  
  if (sDept === selDept) return true;
  if (sDept.includes(selDept) || selDept.includes(sDept)) return true;
  
  return false;
}

// Helper for semester matching
function isSemMatch(studentSem, selectedSem) {
  if (selectedSem === 'all') return true;
  if (!studentSem) return false;
  
  const sSem = studentSem.toString().trim().toLowerCase();
  const selSem = selectedSem.toString().trim().toLowerCase();
  
  if (sSem === selSem) return true;
  
  // Natural semester matching (e.g. "2nd sem" matches "2" or "2nd semester")
  const sNum = sSem.replace(/[^0-9]/g, '');
  const selNum = selSem.replace(/[^0-9]/g, '');
  
  if (sNum && selNum && sNum === selNum) return true;
  
  return false;
}

// Load models, students, and departments in parallel
async function init() {
  try {
    const [, data, deptsData] = await Promise.all([
      Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]),
      fetch(API_URL).then(r => r.json()),
      fetch(`${window.SMART_ATTEND_CONFIG.SCRIPT_URL}?sheet=departments`).then(r => r.json()).catch(() => [])
    ]);

    // Populate students
    data.sort((a, b) => String(a.ID).localeCompare(String(b.ID), undefined, { numeric: true }));
    students = data;

    const deptSel = document.getElementById('deptSelect');
    const semSel = document.getElementById('semesterSelect');

    // Populate departments dropdown
    if (deptsData && deptsData.length > 0) {
      deptsData.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.Code || d.Name;
        opt.textContent = d.Name;
        deptSel.appendChild(opt);
      });
    } else {
      // Fallback: extract unique departments from students list
      const uniqueDepts = new Set();
      students.forEach(s => {
        const dept = s.Department || s.DEPARTMENT || s.DEPT || s.Dept || s.dept || s.DepartmentName || 'N/A';
        uniqueDepts.add(dept.trim());
      });
      Array.from(uniqueDepts).sort().forEach(d => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = d;
        deptSel.appendChild(opt);
      });
    }

    // Populate semesters dropdown (1st to 8th Semester)
    const semesters = [
      "1st Sem",
      "2nd Sem",
      "3rd Sem",
      "4th Sem",
      "5th Sem",
      "6th Sem",
      "7th Sem",
      "8th Sem"
    ];
    semesters.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      semSel.appendChild(opt);
    });

    // Add change event listeners to filter student list
    deptSel.addEventListener('change', filterStudents);
    semSel.addEventListener('change', filterStudents);

    // Initial population of student dropdown
    filterStudents();

    modelsReady = true;
    document.getElementById('loadingBar').style.display = 'none';
    document.getElementById('formArea').style.display = 'block';

    // Show already-registered students
    refreshResultList();

  } catch (e) {
    document.getElementById('loadingBar').innerHTML =
      '<i class="fa-solid fa-circle-exclamation" style="color:#f87171;"></i> Failed to load. Check internet connection.';
    console.error(e);
  }
}

function filterStudents() {
  const selectedDept = document.getElementById('deptSelect').value;
  const selectedSem = document.getElementById('semesterSelect').value;
  const studentSel = document.getElementById('studentSelect');
  
  // Keep the current selection if it still matches the filter
  const currentSelectedValue = studentSel.value;
  
  // Clear options except the first one
  studentSel.innerHTML = '<option value="">-- Select Student --</option>';
  
  // Filter students based on dept and semester using matching helpers
  const filtered = students.filter(s => {
    const sDept = s.Department || s.DEPARTMENT || s.DEPT || s.Dept || s.dept || s.DepartmentName || 'N/A';
    const sSem = s.Semester || s.SEMESTER || s.Sem || 'Not Set';
    
    return isDeptMatch(sDept, selectedDept) && isSemMatch(sSem, selectedSem);
  });
  
  filtered.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.ID;
    const tick = s.Face_Encoding ? ' ✅' : '';
    opt.textContent = `${s.ID} — ${s.Name}${tick}`;
    studentSel.appendChild(opt);
  });
  
  // Restore selection if possible
  if (currentSelectedValue && filtered.some(s => s.ID === currentSelectedValue)) {
    studentSel.value = currentSelectedValue;
  } else {
    // Reset select
    studentSel.value = '';
    // If the active student is no longer in the list, stop camera if it's running
    if (cameraStream) {
      stopCamera();
    }
  }
}


function startCamera() {
  const studentId = document.getElementById('studentSelect').value;
  if (!studentId) {
    alert('Please select a student first!');
    return;
  }

  setStep(2);
  const cameraBtn = document.getElementById('cameraBtn');
  cameraBtn.disabled = true;
  cameraBtn.innerHTML = '<i class="fa-solid fa-spinner spinner"></i> Starting...';

  navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } })
    .then(stream => {
      cameraStream = stream;
      const video = document.getElementById('regVideo');
      video.srcObject = stream;
      video.style.display = 'block';
      document.getElementById('placeholder').style.display = 'none';

      cameraBtn.innerHTML = '<i class="fa-solid fa-video-slash"></i> Stop Camera';
      cameraBtn.onclick = stopCamera;
      cameraBtn.disabled = false;
      document.getElementById('captureBtn').disabled = false;

      setStatus('✅ Camera ready — look straight at the camera and click Capture!', '#34d399');
    })
    .catch(err => {
      cameraBtn.disabled = false;
      cameraBtn.innerHTML = '<i class="fa-solid fa-video"></i> Start Camera';
      setStatus('❌ Camera blocked! Please allow camera access in your browser.', '#f87171');
      console.error(err);
    });
}

function stopCamera() {
  if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
  const video = document.getElementById('regVideo');
  video.style.display = 'none';
  video.srcObject = null;
  document.getElementById('placeholder').style.display = 'flex';
  const cameraBtn = document.getElementById('cameraBtn');
  cameraBtn.innerHTML = '<i class="fa-solid fa-video"></i> Start Camera';
  cameraBtn.onclick = startCamera;
  document.getElementById('captureBtn').disabled = true;
  setStatus('');
  setStep(1);
}

async function captureAndSave() {
  const studentId = document.getElementById('studentSelect').value;
  if (!studentId) { alert('Select a student first!'); return; }

  const captureBtn = document.getElementById('captureBtn');
  captureBtn.disabled = true;
  captureBtn.innerHTML = '<i class="fa-solid fa-spinner spinner"></i> Processing...';
  setStatus('🔍 Detecting face...', 'white');
  setStep(3);

  const video = document.getElementById('regVideo');
  const canvas = document.getElementById('regCanvas');
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  canvas.getContext('2d').drawImage(video, 0, 0);

  try {
    const det = await faceapi
      .detectSingleFace(canvas, new faceapi.TinyFaceDetectorOptions({ inputSize: 320 }))
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!det) {
      setStatus('❌ No face detected! Move closer, ensure good lighting, and try again.', '#f87171');
      captureBtn.disabled = false;
      captureBtn.innerHTML = '<i class="fa-solid fa-camera"></i> Capture Face';
      setStep(2);
      return;
    }

    // Save to Google Sheets instead of localStorage
    const arr = Array.from(det.descriptor);
    const SCRIPT_URL = window.SMART_ATTEND_CONFIG.SCRIPT_URL;
    
    await fetch(SCRIPT_URL, {
      method: 'POST',
      body: JSON.stringify({
        sheet: 'student',
        action: 'update',
        id: studentId,
        data: { Face_Encoding: JSON.stringify(arr) }
      })
    });

    const student = students.find(s => s.ID === studentId);
    if(student) student.Face_Encoding = JSON.stringify(arr);
    setStatus(`✅ ${student ? student.Name : studentId} registered successfully!`, '#34d399');

    // Update dropdown option
    const sel = document.getElementById('studentSelect');
    const opt = Array.from(sel.options).find(o => o.value === studentId);
    if (opt && !opt.textContent.includes('✅')) opt.textContent += ' ✅';

    // Reset for next student
    setTimeout(() => {
      captureBtn.disabled = false;
      captureBtn.innerHTML = '<i class="fa-solid fa-camera"></i> Capture Face';
      sel.value = '';
      setStatus('👆 Select the next student and capture again.', '#94a3b8');
      setStep(1);
      refreshResultList();
    }, 2000);

  } catch (e) {
    setStatus('💥 Error: ' + (e.message || e), '#f87171');
    captureBtn.disabled = false;
    captureBtn.innerHTML = '<i class="fa-solid fa-camera"></i> Capture Face';
    setStep(2);
  }
}

function refreshResultList() {
  const wrap = document.getElementById('resultList');
  const items = document.getElementById('resultItems');
  items.innerHTML = '';

  const registered = students.filter(s => s.Face_Encoding && s.Face_Encoding.length > 10);
  if (registered.length === 0) { wrap.style.display = 'none'; return; }

  registered.forEach(s => {
    const div = document.createElement('div');
    div.className = 'result-item';
    div.innerHTML = `<div><strong>${s.ID}</strong> — ${s.Name}</div><span>✅</span>`;
    items.appendChild(div);
  });

  wrap.style.display = 'block';
}

window.addEventListener('load', init);
