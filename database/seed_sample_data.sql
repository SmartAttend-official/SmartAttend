-- ==============================================================================
-- SmartAttend — Synthetic Sample Seed Data for Demonstration & Hackathon Testing
-- ==============================================================================
-- OPTIONAL: Run this script after 'schema.sql' to pre-populate demo accounts,
-- departments, subjects, and synthetic students for immediate evaluation.
--
-- DEFAULT DEMO CREDENTIALS:
-- 1. Administrator:
--    Email    : admin@smartattend.edu
--    Password : Admin@123
--
-- 2. Faculty / Professor (BCA Department):
--    Email    : prof.sharma@smartattend.edu
--    Password : Professor@123
--
-- 3. Student (BCA Semester 3):
--    ID       : TEST001
--    Email    : aarav.patel@smartattend.edu
--    Password : Student@123
-- ==============================================================================

-- 1. Insert Demo Administrator
INSERT INTO public."ADMIN" ("Email", "Password", "Name", "TwoFactorEnabled")
VALUES (
    'admin@smartattend.edu',
    '$2b$10$lGErZgDbCug29yV07NLwr.x/Qy5LDIUFGMenPYffkVM3qmQqVk/nm',
    'System Administrator',
    FALSE
)
ON CONFLICT ("Email") DO NOTHING;

-- 2. Insert Academic Departments
INSERT INTO public."Departments" ("Name", "Department_Name", "Code")
VALUES
    ('Bachelor of Computer Applications', 'BCA', 'BCA'),
    ('Master of Computer Applications', 'MCA', 'MCA'),
    ('Bachelor of Business Administration', 'BBA', 'BBA'),
    ('Master of Business Administration', 'MBA', 'MBA')
ON CONFLICT ("Department_Name") DO NOTHING;

-- 3. Insert Demo Faculty in BCA Department & Unified Professors Table
INSERT INTO public."professors" (
    "ID", "Email", "Password", "Name",
    "Professor  first_name", "Professor  last_name",
    "Department", "Designation", "TwoFactorEnabled"
)
VALUES (
    'PROF001',
    'prof.sharma@smartattend.edu',
    '$2b$10$r/ow1tEZB/bzHMtNyp9xluhbdBKSROmhSQd7KAZ3oCZ.Z/IhLnpSy',
    'Dr. Rajesh Sharma',
    'Rajesh',
    'Sharma',
    'BCA',
    'Head of Department',
    FALSE
)
ON CONFLICT ("Email") DO NOTHING;

INSERT INTO public."BCA" (
    "ID", "Email", "Password", "Name",
    "Professor  first_name", "Professor  last_name",
    "Department", "Designation", "TwoFactorEnabled"
)
VALUES (
    'PROF001',
    'prof.sharma@smartattend.edu',
    '$2b$10$r/ow1tEZB/bzHMtNyp9xluhbdBKSROmhSQd7KAZ3oCZ.Z/IhLnpSy',
    'Dr. Rajesh Sharma',
    'Rajesh',
    'Sharma',
    'BCA',
    'Head of Department',
    FALSE
)
ON CONFLICT ("Email") DO NOTHING;

-- 4. Insert Demo Subjects
INSERT INTO public."Subjects" ("Name", "Code", "Department", "Semester", "Credits", "SubjectType")
VALUES
    ('Data Structures and Algorithms', 'BCA301', 'BCA', 'Semester 3', 4, 'Theory'),
    ('Database Management Systems', 'BCA302', 'BCA', 'Semester 3', 4, 'Theory'),
    ('DBMS Laboratory', 'BCA302-L', 'BCA', 'Semester 3', 2, 'Lab'),
    ('Web Technologies', 'BCA303', 'BCA', 'Semester 3', 3, 'Theory'),
    ('Python Programming', 'BCA501', 'BCA', 'Semester 5', 4, 'Theory')
ON CONFLICT DO NOTHING;

-- 5. Insert Demo Classes
INSERT INTO public."Classes" ("Name", "Code", "Department", "Semester", "Section")
VALUES
    ('BCA 2nd Year - Sec A', 'BCA-3A', 'BCA', 'Semester 3', 'A'),
    ('BCA 3rd Year - Sec A', 'BCA-5A', 'BCA', 'Semester 5', 'A')
ON CONFLICT DO NOTHING;

-- 6. Insert Demo Students
INSERT INTO public."students" (
    "ID", "Name", "Email", "Password",
    "Department", "Semester", "Parent_Email", "Mobile",
    "Total_Classes", "Attended_Classes", "Percentage"
)
VALUES
    (
        'TEST001',
        'Aarav Patel',
        'aarav.patel@smartattend.edu',
        '$2b$10$u13uf10BjG1y.AnV3h6XtOlQYXlrlJh4.aZ1wjz4hJH2oRaTZy1V.',
        'BCA',
        'Semester 3',
        'parent.patel@example.com',
        '9876543210',
        20, 18, 90.00
    ),
    (
        'TEST002',
        'Sneha Verma',
        'sneha.verma@smartattend.edu',
        '$2b$10$u13uf10BjG1y.AnV3h6XtOlQYXlrlJh4.aZ1wjz4hJH2oRaTZy1V.',
        'BCA',
        'Semester 3',
        'parent.verma@example.com',
        '9876543211',
        20, 16, 80.00
    ),
    (
        'TEST003',
        'Rohan Gupta',
        'rohan.gupta@smartattend.edu',
        '$2b$10$u13uf10BjG1y.AnV3h6XtOlQYXlrlJh4.aZ1wjz4hJH2oRaTZy1V.',
        'BCA',
        'Semester 3',
        'parent.gupta@example.com',
        '9876543212',
        20, 11, 55.00
    ),
    (
        'TEST004',
        'Priya Singh',
        'priya.singh@smartattend.edu',
        '$2b$10$u13uf10BjG1y.AnV3h6XtOlQYXlrlJh4.aZ1wjz4hJH2oRaTZy1V.',
        'BCA',
        'Semester 3',
        'parent.singh@example.com',
        '9876543213',
        20, 9, 45.00
    )
ON CONFLICT ("ID") DO NOTHING;

-- 7. Insert Demo Classroom Camera Mapping
INSERT INTO public."Camera_IPs" ("Department_Name", "Classroom_Name", "IP_Address")
VALUES
    ('BCA', 'Room 301 (BCA Lab)', 'http://192.168.1.50:8080/video'),
    ('BCA', 'Room 302 (Lecture Hall)', 'http://192.168.1.51:8080/video')
ON CONFLICT ("Classroom_Name") DO NOTHING;
