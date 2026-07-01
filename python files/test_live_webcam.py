import os
import sys
import json
import urllib.request

# ── Fix for Windows Python 3.12+ ──────────────────────────────
try:
    import pkg_resources
except ImportError:
    class FakePkgResources:
        @staticmethod
        def resource_filename(package_or_requirement, resource_name):
            import importlib.util
            spec = importlib.util.find_spec(package_or_requirement)
            if spec and spec.submodule_search_locations:
                return os.path.join(spec.submodule_search_locations[0], resource_name)
            return resource_name
    sys.modules['pkg_resources'] = FakePkgResources()
# ──────────────────────────────────────────────────────────────

try:
    import face_recognition
    import numpy as np
    import cv2
except ImportError as e:
    print(f"\n❌ Missing library: {e}")
    print("Please run: pip install face_recognition opencv-python numpy")
    sys.exit(1)

# ══════════════════════════════════════════════════════════════
#   CONFIGURATION — Edit these values before running
# ══════════════════════════════════════════════════════════════

# Your Student ID (must match what is stored in Google Sheet)
STUDENT_ID = "BCA051"

# Path to the locally saved .npy encoding file (from generate_encoding.py)
LOCAL_ENCODING_PATH = r"c:/Users/LENOVO/Desktop/SmartAttend2@/images/students/BCA051_average_encoding.npy"

# ── IP Webcam URL (from the IP Webcam app on your phone) ──────
# Open the IP Webcam app → tap "Start Server"
# You will see an IP like: http://192.168.1.5:8080
# Set your phone's IP below (keep /video at the end):
IP_WEBCAM_URL = "http://192.168.1.5:8080/video"

# ── Match Tolerance ──────────────────────────────────────────
# Lower = stricter. 0.45 is very strict, 0.55 is normal, 0.6 is lenient
TOLERANCE = 0.50

# ══════════════════════════════════════════════════════════════


def load_encoding_from_local():
    """Load face encoding from the locally saved .npy file."""
    if not os.path.exists(LOCAL_ENCODING_PATH):
        print(f"❌ Encoding file not found at:\n   {LOCAL_ENCODING_PATH}")
        print("   Please run generate_encoding.py first!")
        return None
    encoding = np.load(LOCAL_ENCODING_PATH)
    print(f"✅ Loaded encoding from local file for [{STUDENT_ID}]")
    return encoding


def load_encoding_from_server(server_url):
    """Fetch face encoding directly from Supabase via the Node.js API."""
    try:
        url = f"{server_url}?action=get_encoding&id={STUDENT_ID}"
        print(f"🌐 Fetching encoding from Supabase Server...")
        req = urllib.request.urlopen(url, timeout=10)
        data = json.loads(req.read().decode())
        if data.get("status") == "success" and data.get("encoding"):
            encoding = np.array(data["encoding"])
            print(f"✅ Loaded encoding from Server for [{STUDENT_ID}]")
            return encoding
        else:
            print(f"⚠️  Server returned: {data.get('message', 'No encoding found')}")
            return None
    except Exception as ex:
        print(f"⚠️  Could not fetch from Server: {ex}")
        return None


def run_live_test(known_encoding):
    """Open IP Webcam stream and do real-time face recognition."""
    print("\n" + "═" * 55)
    print("   🎥  SmartAttend — Live Face Recognition Test")
    print("═" * 55)
    print(f"   Student : {STUDENT_ID}")
    print(f"   Stream  : {IP_WEBCAM_URL}")
    print(f"   Press Q to quit")
    print("═" * 55 + "\n")

    cap = cv2.VideoCapture(IP_WEBCAM_URL)

    if not cap.isOpened():
        print("❌ Could not connect to IP Webcam.")
        print("\n💡 Troubleshooting:")
        print("   1. Open 'IP Webcam' app on your phone and tap 'Start Server'")
        print("   2. Make sure your phone and PC are on the SAME Wi-Fi network")
        print("   3. Copy the IP shown in the app (e.g. http://192.168.1.5:8080)")
        print("   4. Update IP_WEBCAM_URL in this script and run again")
        return

    frame_skip = 0  # Process every 3rd frame for performance

    while True:
        ret, frame = cap.read()
        if not ret:
            print("⚠️  Frame dropped. Retrying...")
            continue

        frame_skip += 1
        if frame_skip % 3 != 0:
            # Still show the frame even if we skip recognition
            cv2.imshow("SmartAttend — Face Recognition Test (Q to quit)", frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
            continue

        # Resize for faster processing (half size)
        small_frame = cv2.resize(frame, (0, 0), fx=0.5, fy=0.5)
        rgb_small = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)

        # Detect faces and encode
        face_locations = face_recognition.face_locations(rgb_small)
        face_encodings = face_recognition.face_encodings(rgb_small, face_locations)

        for (top, right, bottom, left), face_enc in zip(face_locations, face_encodings):
            # Scale back up (we processed at half size)
            top    *= 2
            right  *= 2
            bottom *= 2
            left   *= 2

            # Compare with known encoding
            match = face_recognition.compare_faces([known_encoding], face_enc, tolerance=TOLERANCE)
            distance = face_recognition.face_distance([known_encoding], face_enc)[0]
            match_pct = round((1 - distance) * 100, 1)

            if match[0]:
                label   = f"✔ {STUDENT_ID} ({match_pct}%)"
                color   = (0, 220, 0)   # Green
                bg      = (0, 180, 0)
            else:
                label   = f"✘ Unknown ({match_pct}%)"
                color   = (0, 0, 220)   # Red
                bg      = (0, 0, 180)

            # Draw bounding box
            cv2.rectangle(frame, (left, top), (right, bottom), color, 2)

            # Draw label background
            cv2.rectangle(frame, (left, bottom - 36), (right, bottom), bg, cv2.FILLED)

            # Draw label text
            cv2.putText(frame, label, (left + 6, bottom - 10),
                        cv2.FONT_HERSHEY_DUPLEX, 0.65, (255, 255, 255), 1)

        # Show on screen
        cv2.imshow("SmartAttend — Face Recognition Test (Q to quit)", frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()
    print("\n✅ Test session ended.")


# ── MAIN ──────────────────────────────────────────────────────
if __name__ == "__main__":
    print("\n" + "═" * 55)
    print("   SmartAttend — Live IP Webcam Face Test")
    print("═" * 55)

    # Step 1: Load encoding (local .npy file is fastest)
    known_encoding = load_encoding_from_local()

    if known_encoding is None:
        print("\n⚠️  Local encoding not found. Falling back to Supabase Server...")
        SERVER_URL = "https://smartattend-o2te.onrender.com/"
        known_encoding = load_encoding_from_server(SERVER_URL)

    if known_encoding is None:
        print("\n⚠️  Encoding not found locally or on server. Cannot continue.")
        print("   Run generate_encoding.py first, then retry.")
        sys.exit(1)

    # Step 2: Start live recognition
    run_live_test(known_encoding)
