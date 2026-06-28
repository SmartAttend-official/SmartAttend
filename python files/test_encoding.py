import os
import sys

# Fix for Windows Python 3.12+ (Same as before)
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

import face_recognition
import numpy as np

print("========================================")
print("     FACE ENCODING TESTER")
print("========================================")

# 1. Load the Average Encoding we just generated
average_encoding_path = r"c:/Users/LENOVO/Desktop/SmartAttend2@/images/students/BCA051_average_encoding.npy"
try:
    known_encoding = np.load(average_encoding_path)
    print("✅ Successfully loaded the Average Encoding for BCA051.")
except Exception as e:
    print(f"Error loading encoding file. Make sure you generated it first! Error: {e}")
    sys.exit(1)

# 2. Ask the user for a test image
print("\nDrag and drop an image file into this terminal, or type the full path.")
print("Try using a DIFFERENT photo of BCA051, or a photo of someone else to see if it catches them!")
test_image_path = input("Image Path: ").strip()

# Clean up the path if Windows adds quotes around it
if test_image_path.startswith('"') and test_image_path.endswith('"'):
    test_image_path = test_image_path[1:-1]
if test_image_path.startswith("'") and test_image_path.endswith("'"):
    test_image_path = test_image_path[1:-1]

if not os.path.exists(test_image_path):
    print("❌ Error: Could not find that image file. Check the path and try again.")
    sys.exit(1)

try:
    print("\nProcessing test image...")
    # Load test image
    test_image = face_recognition.load_image_file(test_image_path)
    
    # Get encodings for the test image
    test_encodings = face_recognition.face_encodings(test_image)
    
    if len(test_encodings) == 0:
        print("❌ No face found in the test image.")
        sys.exit(1)
        
    print(f"Found a face! Comparing it with BCA051's Average Encoding...\n")
    
    # Test the first face found in the test image
    face_to_test = test_encodings[0]
    
    # Compare faces. Tolerance of 0.5 is strict. 0.6 is default.
    results = face_recognition.compare_faces([known_encoding], face_to_test, tolerance=0.5)
    face_distance = face_recognition.face_distance([known_encoding], face_to_test)[0]
    
    # Calculate a readable "Match Score"
    match_percentage = round((1 - face_distance) * 100, 2)
    
    if results[0]:
        print("🟢 RESULT: MATCH! (This is BCA051)")
    else:
        print("🔴 RESULT: NO MATCH. (This is NOT BCA051)")
        
    print(f"Similarity Score: {match_percentage}%")
    print(f"(Scores above ~50% are considered a match)")
    print("========================================\n")

except Exception as e:
    print(f"An error occurred during testing: {e}")
