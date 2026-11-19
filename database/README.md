# SmartAttend — Database Architecture & Setup Guide

This directory contains the database definitions, table schemas, Row-Level Security (RLS) policies, and synthetic seed datasets for **SmartAttend**, backed by **Supabase PostgreSQL**.

---

## Architecture Overview

SmartAttend uses Supabase PostgreSQL as its central data store. The architecture enforces strict privilege separation:

```
+-----------------------------------------------------------------------------------+
|                            CLIENT BROWSERS & APK APP                              |
|   (Professor Panel, Student Dashboard, Admin Panel, Face Registration Portal)    |
+-----------------------------------------------------------------------------------+
                                         |
                                         | HTTPS (with JWT Bearer Token)
                                         v
+-----------------------------------------------------------------------------------+
|                        SMARTATTEND BACKEND (Express / Node.js)                    |
|          • Validates JWTs & enforces RBAC rules (admin / professor / student)    |
|          • Sanitizes input queries & rate-limits incoming traffic                 |
|          • Communicates with PostgreSQL via SUPABASE_SERVICE_ROLE_KEY             |
+-----------------------------------------------------------------------------------+
                                         |
                                         | TLS Port 5432 / HTTPS REST API
                                         v
+-----------------------------------------------------------------------------------+
|                           SUPABASE POSTGRESQL DATABASE                            |
|          • Row-Level Security (RLS) enabled on ALL 19 tables                      |
|          • Anonymous public access DENIED by default                              |
|          • High-performance indexes on StudentID, Date, Subject, and Locks       |
+-----------------------------------------------------------------------------------+
```

---

## Quick Setup Guide (For Judges & Evaluators)

### Step 1: Create a Free Supabase Project
1. Log in to [Supabase](https://supabase.com) and click **New Project**.
2. Choose a project name (e.g. `smartattend-demo`), set a secure database password, and select your preferred region.

### Step 2: Run the Schema Migration Script
1. In your Supabase Dashboard, navigate to the **SQL Editor** tab from the left sidebar.
2. Click **New Query**.
3. Copy the entire contents of [`schema.sql`](schema.sql) and paste them into the editor.
4. Click **Run** (or press `Ctrl + Enter`).
   - This creates all 19 relational tables, performance indexes, and configures Row-Level Security (RLS).
   - The script is **idempotent** (`IF NOT EXISTS`), making it safe to re-run.

### Step 3 (Optional): Populate Synthetic Demo Data
1. In the Supabase **SQL Editor**, open another **New Query**.
2. Copy the contents of [`seed_sample_data.sql`](seed_sample_data.sql) and click **Run**.
3. This creates pre-configured test users and academic data:

| Role | Email / Identifier | Password | Department & Details |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin@smartattend.edu` | `Admin@123` | Full ERP administrative control |
| **BCA Professor** | `prof.sharma@smartattend.edu` | `Professor@123` | Head of Department, BCA Faculty |
| **Student** | `aarav.patel@smartattend.edu` (ID: `TEST001`) | `Student@123` | BCA Semester 3 (90% attendance) |
| **Student (At-Risk)** | `rohan.gupta@smartattend.edu` (ID: `TEST003`) | `Student@123` | BCA Semester 3 (55% attendance) |

### Step 4: Link Credentials to Backend
1. In your Supabase Dashboard, go to **Project Settings > API**.
2. Copy:
   - **Project URL** $\rightarrow$ Set as `SUPABASE_URL` in `server/.env`.
   - **service_role (secret)** $\rightarrow$ Set as `SUPABASE_SERVICE_ROLE_KEY` in `server/.env`.

---

## Schema Reference

### 1. Identity & Academic
- `ADMIN`: Administrator credentials, 2FA states, and recovery tokens.
- `students`: Student roster, department, semester, contact information, attendance percentages, and client-side face recognition templates (`Face_Encoding`).
- `BCA`, `MCA`, `BBA`, `MBA`: Faculty accounts segregated by academic department.
- `Departments`, `Classes`, `Subjects`: Academic curriculum structure.
- `Camera_IPs`: Classroom-to-IP-camera hardware routing.
- `Proxies`: Substitute faculty assignments.

### 2. Attendance & Auditing
- `AttendanceHistory`: Master immutable attendance session logs with status (`Present`, `Absent`, `On Leave`), type (`Classroom` or `Lab`), and late minutes.
- `Active_Codes`: Ephemeral, timestamped OTP codes for secure laboratory attendance.
- `Lab_Access_Logs`: Physical/virtual laboratory sign-in audit logs.
- `AttendanceWarningLogs`: Persistent ledger tracking automated attendance notifications for the 60% and 50% thresholds.
- `LeaveRequests`: Formal student leave petitions, attached medical documents, and Google Gemini multimodal OCR verification verdicts.
- `Timetables`: Uploaded class schedules and course documents.
- `StudentAssignments`: Faculty course homework and assignment distribution.

### 3. Security
- `SecurityEvents`: Account lockout persistence, brute-force attack counters, and cool-down timers.
- `AuditLogs`: Administrative and security event trail.

---

## Row-Level Security (RLS) Policy

All tables have Row-Level Security explicitly enabled. By default:
1. **Public/Anonymous (`anon`)**: All direct reads, writes, and modifications are blocked (`USING (false)`).
2. **Backend Engine (`service_role`)**: The backend Node.js process holds the private `service_role` key, granting authorized server-side operations while shielding direct table exposure from client browsers.
