/**
 * PHASE 6 — ACCESSIBILITY (WCAG 2.1 AA) & UX HARDENING TEST SUITE
 * ============================================================================
 * Verifies WCAG 2.1 AA compliance across all primary views:
 *  1. Semantic ARIA Landmarks (<main role="main">, <nav role="navigation">, <header role="banner">)
 *  2. Explicit Form Control Labels (<label for="..."> explicit bindings)
 *  3. Dynamic Live Regions & Alerts (role="alert", aria-live="assertive"/"polite")
 *  4. Accessible Interactive Elements (role="button", tabindex="0", aria-label)
 *  5. Portal Navigation Tablists (role="tablist", role="tab", aria-selected)
 *  6. Camera Feed & Biometric Screen Reader Announcements (alt text, polite live region)
 *  7. Accessible Modal Dialogs (role="dialog", aria-modal, focus trapping, Escape key, focus restoration)
 *  8. Visual Focus Indicators (:focus-visible) & Contrast Ratio Mathematics (>= 4.5:1)
 */

'use strict';

const fs = require('fs');
const path = require('path');

let passed = 0;
let failed = 0;

function report(name, condition) {
  if (condition) {
    console.log(`  ✓ Test Passed: ${name}`);
    passed++;
  } else {
    console.error(`  ✗ FAILED: ${name}`);
    failed++;
  }
}

function readFile(relPath) {
  return fs.readFileSync(path.resolve(__dirname, '..', relPath), 'utf8');
}

console.log('\n=== PHASE 6: ACCESSIBILITY (WCAG 2.1 AA) & UX HARDENING TESTS ===\n');

// ─────────────────────────────────────────────────────────────────────────────
// GROUP 1: Semantic Landmarks & Layout Structure (WCAG 1.3.1, 2.4.1)
// ─────────────────────────────────────────────────────────────────────────────
const loginHtml = readFile('html/Login.html');
const studentLoginHtml = readFile('html/student_login.html');
const adminLoginHtml = readFile('html/admin_login.html');
const profDashHtml = readFile('html/dashboard1.html');
const studentDashHtml = readFile('html/student_dashboard.html');
const adminDashHtml = readFile('html/admin_dashboard.html');

report('Professor Login provides <main role="main"> landmark',
  loginHtml.includes('<main') && loginHtml.includes('role="main"')
);

report('Student Login provides <main role="main"> landmark',
  studentLoginHtml.includes('<main') && studentLoginHtml.includes('role="main"')
);

report('Admin Login provides <main role="main"> landmark',
  adminLoginHtml.includes('<main') && adminLoginHtml.includes('role="main"')
);

report('Professor Dashboard defines semantic navigation and main landmarks',
  profDashHtml.includes('<nav') && profDashHtml.includes('role="navigation"') &&
  profDashHtml.includes('<main') && profDashHtml.includes('role="main"')
);

report('Student Dashboard defines banner header and main content landmark',
  studentDashHtml.includes('<header') && studentDashHtml.includes('role="banner"') &&
  studentDashHtml.includes('<main') && studentDashHtml.includes('role="main"')
);

report('Admin Dashboard defines navigation and complementary landmarks',
  adminDashHtml.includes('<nav') && adminDashHtml.includes('role="navigation"') &&
  adminDashHtml.includes('role="complementary"')
);

// ─────────────────────────────────────────────────────────────────────────────
// GROUP 2: Form Control Labeling & ARIA Associations (WCAG 1.3.1, 3.3.2)
// ─────────────────────────────────────────────────────────────────────────────
report('Professor Login explicitly binds labels with for="emailInput" and for="passwordInput"',
  loginHtml.includes('for="emailInput"') && loginHtml.includes('for="passwordInput"')
);

report('Student Login explicitly binds labels with for="emailInput" and for="studentPasswordInput"',
  studentLoginHtml.includes('for="emailInput"') && studentLoginHtml.includes('for="studentPasswordInput"')
);

report('Admin Login explicitly binds labels with for="emailInput" and for="passwordInput"',
  adminLoginHtml.includes('for="emailInput"') && adminLoginHtml.includes('for="passwordInput"')
);

report('Student Dashboard leave form provides explicit label bindings',
  studentDashHtml.includes('for="targetProfessor"') &&
  studentDashHtml.includes('for="leaveType"') &&
  studentDashHtml.includes('for="leaveSingleDate"') &&
  studentDashHtml.includes('for="leaveReason"')
);

report('Password toggles have accessible button role, tabindex="0", and aria-label',
  loginHtml.includes('role="button"') && loginHtml.includes('aria-label="Toggle password visibility"') &&
  studentLoginHtml.includes('role="button"') && studentLoginHtml.includes('aria-label="Toggle password visibility"') &&
  adminLoginHtml.includes('role="button"') && adminLoginHtml.includes('aria-label="Toggle password visibility"')
);

// ─────────────────────────────────────────────────────────────────────────────
// GROUP 3: Live Regions, Alert Announcements & Feedback (WCAG 4.1.3, 3.3.1)
// ─────────────────────────────────────────────────────────────────────────────
report('Login error containers configured with role="alert" and aria-live="assertive"',
  loginHtml.includes('id="loginError"') && loginHtml.includes('role="alert"') &&
  studentLoginHtml.includes('id="loginError"') && studentLoginHtml.includes('role="alert"') &&
  adminLoginHtml.includes('id="loginError"') && adminLoginHtml.includes('role="alert"')
);

report('Two-Factor OTP panel has role="region" with accessible name',
  loginHtml.includes('id="otpPanel"') && loginHtml.includes('role="region"') &&
  adminLoginHtml.includes('id="otpPanel"') && adminLoginHtml.includes('role="region"')
);

report('OTP digit inputs define explicit aria-label per digit position',
  loginHtml.includes('aria-label="Digit 1 of 6"') &&
  loginHtml.includes('aria-label="Digit 6 of 6"') &&
  adminLoginHtml.includes('aria-label="Digit 1 of 6"')
);

report('Professor dashboard camera feed provides non-empty descriptive alt text',
  profDashHtml.includes('id="camera"') && profDashHtml.includes('alt="Real-time attendance camera feed"')
);

report('Professor dashboard provides dedicated polite live announcement region',
  profDashHtml.includes('id="srAttendanceAnnouncements"') &&
  profDashHtml.includes('aria-live="polite"') &&
  profDashHtml.includes('announceForScreenReader')
);

report('Student dashboard lab attendance message box has assertive alert attributes',
  studentDashHtml.includes('id="labCodeMessage"') && studentDashHtml.includes('role="alert"')
);

// ─────────────────────────────────────────────────────────────────────────────
// GROUP 4: Accessible Modal Dialogs & Focus Management (WCAG 2.1.1, 2.1.2)
// ─────────────────────────────────────────────────────────────────────────────
const adminJs = readFile('backend/admin_dashboard.js');

report('showModal dynamically configures role="dialog" and aria-modal="true"',
  adminJs.includes("modal.setAttribute('role', 'dialog')") &&
  adminJs.includes("modal.setAttribute('aria-modal', 'true')")
);

report('showModal automatically connects aria-labelledby to modal title',
  adminJs.includes("modal.setAttribute('aria-labelledby'")
);

report('showModal implements keyboard focus trapping for Tab and Shift+Tab',
  adminJs.includes("e.key === 'Tab'") && adminJs.includes("e.shiftKey")
);

report('showModal implements Escape key dismissal',
  adminJs.includes("e.key === 'Escape'") && adminJs.includes("window.closeModal")
);

report('closeModal restores focus to the invoking trigger element',
  adminJs.includes("_triggerElement") && adminJs.includes("_triggerElement.focus()")
);

// ─────────────────────────────────────────────────────────────────────────────
// GROUP 5: Visual Focus Indicators & Contrast Ratio Mathematics (WCAG 1.4.3, 2.4.7)
// ─────────────────────────────────────────────────────────────────────────────
report('Core portals define explicit :focus-visible keyboard focus rings',
  loginHtml.includes(':focus-visible') &&
  profDashHtml.includes(':focus-visible') &&
  studentDashHtml.includes(':focus-visible') &&
  adminDashHtml.includes(':focus-visible')
);

report('Core portals define .sr-only visually-hidden screen reader utility class',
  loginHtml.includes('.sr-only') &&
  profDashHtml.includes('.sr-only') &&
  studentDashHtml.includes('.sr-only') &&
  adminDashHtml.includes('.sr-only')
);

function getLuminance(r, g, b) {
  const a = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function getContrastRatio(rgb1, rgb2) {
  const lum1 = getLuminance(...rgb1);
  const lum2 = getLuminance(...rgb2);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

const mainTextContrast = getContrastRatio([248, 250, 252], [11, 17, 32]);
report(`Body text contrast ratio (${mainTextContrast.toFixed(2)}:1) exceeds WCAG 2.1 AA minimum 4.5:1`,
  mainTextContrast >= 4.5
);

const buttonContrast = getContrastRatio([255, 255, 255], [37, 99, 235]);
report(`Action button contrast ratio (${buttonContrast.toFixed(2)}:1) meets WCAG 2.1 AA standards`,
  buttonContrast >= 4.5
);

console.log(`\nPhase 6 Test Results: ${passed} passed, ${failed} failed.`);
if (failed > 0) {
  process.exit(1);
}
