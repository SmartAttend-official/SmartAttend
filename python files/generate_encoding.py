import os
import sys
import urllib.request
import json

# --- UGLY HACK TO FIX WINDOWS PYTHON 3.12+ COMPATIBILITY ISSUE ---
# Newer Python versions removed 'pkg_resources', which crashes face_recognition.
# We will create a fake 'pkg_resources' to trick it into working!
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
# -----------------------------------------------------------------

try:
    import face_recognition
    import numpy as np
except ImportError as e:
    print(f"Error: Required libraries not found. {e}")
    sys.exit(1)

BASE_DIR = r"c:/Users/LENOVO/Desktop/SmartAttend2@/images/students"
SERVER_URL = "https://smartattend-o2te.onrender.com/"
BATCH_SIZE = 50

def upload_to_server(student_id, encoding_array):
    data = {
        "action": "save_encoding",
        "id": student_id,
        "encoding": encoding_array.tolist()
    }
    req = urllib.request.Request(SERVER_URL, json.dumps(data).encode('utf-8'), {'Content-Type': 'application/json'})
    try:
        response = urllib.request.urlopen(req, timeout=15)
        result = json.loads(response.read().decode())
        if result.get("status") == "success":
            print(f"✅ Successfully uploaded encoding for {student_id} to Supabase!")
        else:
            print(f"❌ Server Error for {student_id}: {result.get('message')}")
    except Exception as e:
        print(f"⚠️ Failed to upload {student_id} to server: {e}")

def process_student_folder(student_id, folder_path):
    encodings = []
    print(f"\nProcessing {student_id}...")
    for filename in os.listdir(folder_path):
        if filename.lower().endswith((".png", ".jpg", ".jpeg")):
            filepath = os.path.join(folder_path, filename)
            try:
                image = face_recognition.load_image_file(filepath)
                face_encodings = face_recognition.face_encodings(image)
                
                if len(face_encodings) > 0:
                    encodings.append(face_encodings[0])
                else:
                    print(f"  Warning: No face found in {filename}")
            except Exception as e:
                print(f"  Error processing {filename}: {e}")
    
    if len(encodings) > 0:
        average_encoding = np.mean(encodings, axis=0)
        
        # Save locally as backup
        output_path = os.path.join(BASE_DIR, f"{student_id}_average_encoding.npy")
        np.save(output_path, average_encoding)
        
        # Upload to Supabase
        upload_to_server(student_id, average_encoding)
    else:
        print(f"⚠️ Could not generate encoding for {student_id}")

def main():
    if not os.path.exists(BASE_DIR):
        print(f"Directory not found: {BASE_DIR}")
        return
        
    # Get all student directories inside the images/students folder
    student_folders = [f for f in os.listdir(BASE_DIR) if os.path.isdir(os.path.join(BASE_DIR, f))]
    
    print(f"Found {len(student_folders)} student folders. Processing in batches of {BATCH_SIZE}...")
    
    # Process in batches
    for i in range(0, len(student_folders), BATCH_SIZE):
        batch = student_folders[i:i + BATCH_SIZE]
        print(f"\n--- Processing Batch {i//BATCH_SIZE + 1} ({len(batch)} students) ---")
        
        for student_id in batch:
            folder_path = os.path.join(BASE_DIR, student_id)
            process_student_folder(student_id, folder_path)
            
        print(f"--- Finished Batch {i//BATCH_SIZE + 1}. Freeing memory... ---")
        # Python's garbage collector automatically frees local variables after the loop
        
    print("\n✅ All batches completed successfully!")

if __name__ == "__main__":
    main()
