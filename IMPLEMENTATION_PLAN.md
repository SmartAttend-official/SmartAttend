# Implementation Plan: SmartAttend Scaling & Stabilization

This document outlines the technical steps required to transition SmartAttend from a single-sheet architecture to a multi-sheet, department-specific scalable model.

## 📋 Project Goals
1. **Zero-Latency Scaling**: Distribute student data across multiple Google Sheets based on department to prevent API timeouts.
2. **Dynamic Routing**: Implement a registry-based lookup for spreadsheet IDs in the Apps Script backend.
3. **Notification Integrity**: Finalize the attendance threshold alert system (50%, 60%, 75%) with robust delivery logic.

---

## 🛠 Phase 1: Registry Infrastructure
Currently, the system is bottlenecked by a single `STUDENT_SHEET_ID`. We will implement a "Registry" pattern.

### 1.1 Create the Registry Sheet
- **Location**: `ACADEMIC_SHEET_ID` spreadsheet.
- **Tab Name**: `SheetRegistry`
- **Schema**:
  | Department_Code | Department_Name | Spreadsheet_ID | Status |
  | :--- | :--- | :--- | :--- |
  | BCA | Bachelor of Computer Application | 1hT6YWR... (BCA ID) | Active |
  | MCA | Master of Computer Application | 2jK9XLP... (MCA ID) | Active |

### 1.2 Backend Resolver Refactoring (`SmartAttend_AppScript_FINAL.gs`)
- **Remove Hardcoded IDs**: Deprecate `STUDENT_SHEET_ID` as the primary source.
- **Implement Resolver Function**:
  ```javascript
  function getSheetIdForDept(deptName) {
    var ss = SpreadsheetApp.openById(ACADEMIC_SHEET_ID);
    var ws = ss.getSheetByName('SheetRegistry');
    var registry = sheetToJSON(ws);
    var match = registry.find(r => r.Department_Name === deptName || r.Department_Code === deptName);
    return match ? match.Spreadsheet_ID : STUDENT_SHEET_ID; // Fallback to Legacy Master
  }
  ```
- **Update Core Handlers**: Refactor `doGet` and `doPost` to use `getSheetIdForDept(e.parameter.dept)`.

---

## 💻 Phase 2: Frontend Integration & UI Logic
The frontend must now be "Department-Aware" in all data-fetching operations.

### 2.1 Admin Dashboard (`backend/admin_dashboard.js`)
- **Registry Manager**: Create a UI view to add/edit entries in the `SheetRegistry`.
- **Departmental Fetching**: Update `renderStudentMgmt` to load students from the specific sheet assigned to the selected department filter.

### 2.2 Professor Portal (`backend/start_attendance.js`)
- **Session Payload**: Ensure the `save_session` action includes the `dept` parameter so the backend knows which sheet to update.

---

## 📢 Phase 3: Notification Engine Stabilization
Refining the logic starting at line 1520 of `SmartAttend_AppScript_FINAL.gs`.

### 3.1 Threshold Alert Logic
- **Lock Mechanism**: Add a column `Last_Alert_Level` to the student sheets to prevent sending multiple emails for the same threshold in a single day.
- **Template Polishing**: Finalize HTML email templates for 50%, 60%, and 75% warnings.
- **Parental Escalation**: Ensure 50% alerts go to both Student and Parent, while 75% alerts are primarily for Student recovery guidance.

---

## 🧪 Phase 4: Migration & Deployment
1. **Template Creation**: Create a master "Student Sheet Template" with all required headers.
2. **Data Sharding**: Run a migration script to move existing rows from the Master Sheet to their respective Department Sheets based on the `Department` column.
3. **Deployment**: Update the Apps Script to a "New Deployment" and update the `SCRIPT_URL` in `backend/config.js`.

---

## 📅 Estimated Timeline
| Task | Effort | Status |
| :--- | :--- | :--- |
| Registry Creation | 1 hr | ⏳ Pending |
| Backend Resolver Implementation | 2 hrs | ⏳ Pending |
| Admin UI Updates | 2 hrs | ⏳ Pending |
| Data Migration & Testing | 2 hrs | ⏳ Pending |

---
*Created by Antigravity on May 13, 2026*
