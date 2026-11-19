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
  const loadingBar = document.getElementById('loadingBar');
  try {
    if (typeof faceapi === 'undefined') {
      throw new Error('Face recognition AI library (face-api.js) is not loaded. Please check your internet connection or reload.');
    }

    const token = sessionStorage.getItem('smartattend_token') || 
                  localStorage.getItem('smartattend_token') || 
                  sessionStorage.getItem('token') || 
                  localStorage.getItem('token') || '';

    const reqHeaders = { 'Content-Type': 'application/json' };
    if (token) {
      reqHeaders['Authorization'] = `Bearer ${token}`;
    }

    if (loadingBar) {
      loadingBar.innerHTML = '<i class="fa-solid fa-spinner spinner"></i> Loading AI models & student list...';
    }

    // Dual CDN fallback for face models
    const MODEL_CDN_PRIMARY = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';
    const MODEL_CDN_FALLBACK = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights';

    async function loadModelsWithFallback() {
      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_CDN_PRIMARY),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_CDN_PRIMARY),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_CDN_PRIMARY),
        ]);
      } catch (cdnErr) {
        console.warn('Primary CDN weights failed, attempting fallback...', cdnErr);
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_CDN_FALLBACK),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_CDN_FALLBACK),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_CDN_FALLBACK),
        ]);
      }
    }

    const [, studentData, deptsData] = await Promise.all([
      loadModelsWithFallback(),
      fetch(API_URL, { headers: reqHeaders }).then(async r => {
        const json = await r.json();
        if (!r.ok || !Array.isArray(json)) {
          if (json && (json.message || json.status === 'error')) {
            throw new Error(json.message || 'Authentication required to access student list.');
          }
          throw new Error(`Failed to load students: Server returned HTTP ${r.status}`);
        }
        return json;
      }),
      fetch(`${window.SMART_ATTEND_CONFIG.SCRIPT_URL}?sheet=departments`, { headers: reqHeaders })
        .then(r => r.json())
        .catch(() => [])
    ]);

    if (!Array.isArray(studentData)) {
      throw new Error('Student data received is not a valid list.');
    }

    // Populate students
    studentData.sort((a, b) => String(a.ID || a.id).localeCompare(String(b.ID || b.id), undefined, { numeric: true }));
    students = studentData;

    const deptSel = document.getElementById('deptSelect');
    const semSel = document.getElementById('semesterSelect');

    // Populate departments dropdown
    if (deptsData && Array.isArray(deptsData) && deptsData.length > 0) {
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
    semSel.innerHTML = '<option value="all">All Semesters</option>';
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
    if (loadingBar) loadingBar.style.display = 'none';
    const formArea = document.getElementById('formArea');
    if (formArea) formArea.style.display = 'block';

    // Show already-registered students
    refreshResultList();

  } catch (e) {
    console.error("Init Error in Register Portal:", e);
    const msg = e.message || String(e);
    if (loadingBar) {
      if (msg.includes('Session Expired') || msg.includes('log in again') || msg.includes('Authentication required')) {
        loadingBar.innerHTML =
          `<i class="fa-solid fa-lock" style="color:#f87171;"></i> Session expired. Please <a href="login.html" style="color:#60a5fa; text-decoration:underline; font-weight:600;">log in again</a>.`;
      } else {
        loadingBar.innerHTML =
          `<i class="fa-solid fa-circle-exclamation" style="color:#f87171;"></i> ${msg}<br>` +
          `<button onclick="location.reload()" style="margin-top:12px; padding:8px 18px; border-radius:8px; border:none; background:#6366f1; color:white; font-weight:600; cursor:pointer;">Retry</button>`;
      }
    }
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
    const sId = s.ID || s.id;
    opt.value = sId;
    const tick = s.Face_Encoding ? ' ✅' : '';
    opt.textContent = `${sId} — ${s.Name || 'Student'}${tick}`;
    studentSel.appendChild(opt);
  });
  
  // Restore selection if possible
  if (currentSelectedValue && filtered.some(s => (s.ID || s.id) === currentSelectedValue)) {
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


// Multi-Sample Pose Registration State
let currentPoseIndex = 1; // 1: Front, 2: Left 15°, 3: Right 15°
let capturedTemplates = [];

function updatePoseUI() {
  const guide = document.getElementById('poseGuideContainer');
  const progText = document.getElementById('poseProgressText');
  const captureBtn = document.getElementById('captureBtn');
  const resetBtn = document.getElementById('resetBtn');
  const oval = document.getElementById('faceGuideOval');

  if (guide) guide.style.display = cameraStream ? 'block' : 'none';
  if (resetBtn) resetBtn.style.display = (cameraStream && capturedTemplates.length > 0) ? 'inline-flex' : 'none';
  if (oval) oval.style.display = cameraStream ? 'block' : 'none';

  if (progText) {
    progText.textContent = `Sample ${currentPoseIndex} of 3`;
  }

  for (let i = 1; i <= 3; i++) {
    const card = document.getElementById(`poseCard${i}`);
    const sub = document.getElementById(`poseSub${i}`);
    if (!card) continue;

    card.className = 'pose-card';
    if (i < currentPoseIndex) {
      card.classList.add('done');
      if (sub) sub.textContent = '✅ Captured';
    } else if (i === currentPoseIndex) {
      card.classList.add('active');
      if (sub) sub.textContent = 'Active Target';
    } else {
      if (sub) sub.textContent = 'Pending';
    }
  }

  if (captureBtn && cameraStream) {
    let label = 'Capture Pose 1 (Front)';
    if (currentPoseIndex === 2) label = 'Capture Pose 2 (Left 15°)';
    if (currentPoseIndex === 3) label = 'Capture Pose 3 (Right 15°)';
    captureBtn.innerHTML = `<i class="fa-solid fa-camera"></i> ${label}`;
  }
}

function resetCaptureSession() {
  currentPoseIndex = 1;
  capturedTemplates = [];
  updatePoseUI();
  setStatus('🔄 Session reset. Pose 1: Look straight at the camera.', '#94a3b8');
  const captureBtn = document.getElementById('captureBtn');
  if (captureBtn && cameraStream) captureBtn.disabled = false;
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

      resetCaptureSession();
      updatePoseUI();
      setStatus('✅ Camera ready — look straight at camera for Pose 1 (Front).', '#34d399');
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
  
  resetCaptureSession();
  updatePoseUI();
  setStatus('');
  setStep(1);
}

async function captureAndSave() {
  const studentId = document.getElementById('studentSelect').value;
  if (!studentId) { alert('Select a student first!'); return; }

  const captureBtn = document.getElementById('captureBtn');
  captureBtn.disabled = true;
  captureBtn.innerHTML = '<i class="fa-solid fa-spinner spinner"></i> Analyzing sample...';
  setStatus(`🔍 Quality check for Pose ${currentPoseIndex}/3...`, 'white');
  setStep(3);

  const video = document.getElementById('regVideo');
  const canvas = document.getElementById('regCanvas');
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0);

  try {
    // 1. Detect all faces to enforce single-face invariant
    const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.6 });
    const detections = await faceapi
      .detectAllFaces(canvas, options)
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (!detections || detections.length === 0) {
      setStatus('❌ No face detected! Center your face inside the guide oval with good lighting.', '#f87171');
      captureBtn.disabled = false;
      updatePoseUI();
      setStep(2);
      return;
    }

    if (detections.length > 1) {
      setStatus('❌ Multiple faces detected! Only the student should be in the camera frame.', '#f87171');
      captureBtn.disabled = false;
      updatePoseUI();
      setStep(2);
      return;
    }

    const det = detections[0];
    const box = det.detection.box;

    // 2. Face Size Check (Resolution gate: >= 110px width & height)
    if (box.width < 110 || box.height < 110) {
      setStatus(`⚠️ Face is too far away (${Math.round(box.width)}px). Please move closer to camera (min 110px).`, '#fbbf24');
      captureBtn.disabled = false;
      updatePoseUI();
      setStep(2);
      return;
    }

    // 3. Photometric Illumination Check (RGB Luma gate: 40 to 230)
    const bx = Math.max(0, Math.floor(box.x));
    const by = Math.max(0, Math.floor(box.y));
    const bw = Math.min(canvas.width - bx, Math.floor(box.width));
    const bh = Math.min(canvas.height - by, Math.floor(box.height));
    const facePixels = ctx.getImageData(bx, by, bw, bh).data;
    let sumLuma = 0;
    for (let i = 0; i < facePixels.length; i += 4) {
      sumLuma += (0.299 * facePixels[i] + 0.587 * facePixels[i + 1] + 0.114 * facePixels[i + 2]);
    }
    const avgLuma = Math.round(sumLuma / (facePixels.length / 4));
    if (avgLuma < 40) {
      setStatus(`⚠️ Illumination too dark (${avgLuma}/255). Please ensure adequate lighting on the face.`, '#fbbf24');
      captureBtn.disabled = false;
      updatePoseUI();
      setStep(2);
      return;
    }
    if (avgLuma > 230) {
      setStatus(`⚠️ Illumination overexposed / harsh backlight (${avgLuma}/255). Reduce glare.`, '#fbbf24');
      captureBtn.disabled = false;
      updatePoseUI();
      setStep(2);
      return;
    }

    // 4. Pose Orientation Check using 68 Landmarks
    const landmarks = det.landmarks.positions;
    const noseTip = landmarks[30];
    const jawLeft = landmarks[0];
    const jawRight = landmarks[16];
    const leftDist = Math.abs(noseTip.x - jawLeft.x);
    const rightDist = Math.abs(jawRight.x - noseTip.x);
    const yawRatio = leftDist / (rightDist || 0.001);

    // Provide friendly feedback if angle is completely contrary to requested pose
    if (currentPoseIndex === 1 && (yawRatio < 0.5 || yawRatio > 2.0)) {
      setStatus('⚠️ Look directly at the camera with a neutral face for Pose 1.', '#fbbf24');
      captureBtn.disabled = false;
      updatePoseUI();
      setStep(2);
      return;
    }

    // Store descriptor
    const descriptorArr = Array.from(det.descriptor);
    capturedTemplates.push(descriptorArr);

    if (currentPoseIndex < 3) {
      currentPoseIndex++;
      updatePoseUI();
      captureBtn.disabled = false;
      setStep(2);
      const nextPoseName = currentPoseIndex === 2 ? 'turn head slightly LEFT (~15°) 👈' : 'turn head slightly RIGHT (~15°) 👉';
      setStatus(`✅ Sample ${currentPoseIndex - 1}/3 passed quality gates! Next: ${nextPoseName}`, '#34d399');
      return;
    }

    // All 3 samples successfully captured! Submit v2 multi-template payload
    captureBtn.innerHTML = '<i class="fa-solid fa-spinner spinner"></i> Saving biometric templates...';
    setStatus('💾 Saving 3 biometric face templates to secure server...', '#818cf8');

    const multiTemplatePayload = {
      version: 2,
      count: capturedTemplates.length,
      enrolled_at: new Date().toISOString(),
      templates: capturedTemplates
    };

    const SCRIPT_URL = window.SMART_ATTEND_CONFIG.SCRIPT_URL;
    const token = sessionStorage.getItem('smartattend_token') || 
                  localStorage.getItem('smartattend_token') || 
                  sessionStorage.getItem('token') || 
                  localStorage.getItem('token') || '';
    const saveHeaders = { 'Content-Type': 'application/json' };
    if (token) saveHeaders['Authorization'] = `Bearer ${token}`;

    // Try dedicated 'save_encoding' action first
    let saveRes = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: saveHeaders,
      body: JSON.stringify({
        action: 'save_encoding',
        studentId: studentId,
        encoding: multiTemplatePayload
      })
    });

    // Fallback to action: 'update' if save_encoding returned 404 or old route
    if (!saveRes.ok) {
      saveRes = await fetch(SCRIPT_URL, {
        method: 'POST',
        headers: saveHeaders,
        body: JSON.stringify({
          sheet: 'student',
          action: 'update',
          id: studentId,
          data: { Face_Encoding: JSON.stringify(multiTemplatePayload) }
        })
      });
    }

    const saveJson = await saveRes.json();
    if (!saveRes.ok || (saveJson && saveJson.status === 'error')) {
      throw new Error((saveJson && saveJson.message) || `Failed to save biometric templates (HTTP ${saveRes.status})`);
    }

    const student = students.find(s => (s.ID === studentId || s.id === studentId));
    if (student) student.Face_Encoding = JSON.stringify(multiTemplatePayload);

    setStatus(`🎉 Success! 3 pose templates registered for ${student ? (student.Name || student.ID) : studentId}.`, '#34d399');

    // Update dropdown option with checkmark
    const sel = document.getElementById('studentSelect');
    const opt = Array.from(sel.options).find(o => o.value === studentId);
    if (opt && !opt.textContent.includes('✅')) opt.textContent += ' ✅';

    // Mark all cards done
    for (let i = 1; i <= 3; i++) {
      const card = document.getElementById(`poseCard${i}`);
      const sub = document.getElementById(`poseSub${i}`);
      if (card) { card.className = 'pose-card done'; }
      if (sub) { sub.textContent = '✅ Stored'; }
    }

    // Reset session after 2.5s for the next student
    setTimeout(() => {
      resetCaptureSession();
      sel.value = '';
      setStatus('👆 Select the next student to register.', '#94a3b8');
      setStep(1);
      refreshResultList();
    }, 2500);

  } catch (e) {
    console.error('Registration error:', e);
    setStatus('💥 Registration error: ' + (e.message || e), '#f87171');
    captureBtn.disabled = false;
    updatePoseUI();
    setStep(2);
  }
}

function refreshResultList() {
  const wrap = document.getElementById('resultList');
  const items = document.getElementById('resultItems');
  if (!wrap || !items) return;
  items.innerHTML = '';

  const registered = students.filter(s => s.Face_Encoding && s.Face_Encoding.length > 10);
  if (registered.length === 0) { wrap.style.display = 'none'; return; }

  registered.forEach(s => {
    let sampleLabel = '1 Template';
    try {
      const parsed = JSON.parse(s.Face_Encoding);
      if (parsed && parsed.templates && Array.isArray(parsed.templates)) {
        sampleLabel = `${parsed.templates.length} Poses`;
      }
    } catch (e) {}

    const div = document.createElement('div');
    div.className = 'result-item';
    div.innerHTML = `<div><strong>${s.ID || s.id}</strong> — ${s.Name || 'Student'} <span style="font-size:11px; margin-left:8px; padding:2px 8px; border-radius:6px; background:rgba(99, 102, 241, 0.2); color:#a5b4fc; font-weight:600;">${sampleLabel}</span></div><span>✅</span>`;
    items.appendChild(div);
  });

  wrap.style.display = 'block';
}

window.addEventListener('load', init);
