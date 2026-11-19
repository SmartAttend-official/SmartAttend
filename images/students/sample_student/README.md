# Synthetic Test Student Directory

This directory provides a template and synthetic test data for offline Python biometric tools (`generate_encoding.py`, `test_encoding.py`, `test_live_webcam.py`).

## Privacy & Biometrics Policy
In accordance with biometric privacy standards and repository security best practices:
- **No real student facial photographs or identifying biometrics are stored in this public repository.**
- The production web application (`html/dashboard1.html`, `html/student_dashboard.html`) performs biometric extraction entirely **client-side in the browser** via `face-api.js` and securely stores normalized 128-dimensional embedding vectors directly in Supabase PostgreSQL (`Face_Encoding` table).

## How to Test Offline Python Scripts Locally
1. Create a student folder with your student ID (e.g. `images/students/TEST001/`).
2. Place 3 to 10 sample face photographs named `1.jpg`, `2.jpg`, etc.
3. Run:
   ```bash
   python "python files/generate_encoding.py"
   ```
4. This will generate `TEST001_average_encoding.npy` locally. (All local student folders and `*.npy` files are excluded from Git via `.gitignore`).
