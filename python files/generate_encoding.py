import os
import sys

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

directory = r"c:/Users/LENOVO/Desktop/SmartAttend2@/images/students/BCA051"
encodings = []

print(f"Starting to process images in {directory}...")

for filename in os.listdir(directory):
    if filename.endswith((".png", ".jpg", ".jpeg")):
        filepath = os.path.join(directory, filename)
        try:
            image = face_recognition.load_image_file(filepath)
            face_encodings = face_recognition.face_encodings(image)
            
            if len(face_encodings) > 0:
                encodings.append(face_encodings[0])
                print(f"Successfully encoded {filename}")
            else:
                print(f"Warning: No face found in {filename}")
        except Exception as e:
            print(f"Error processing {filename}: {e}")

if len(encodings) > 0:
    average_encoding = np.mean(encodings, axis=0)
    print(f"\nSuccessfully generated average encoding from {len(encodings)} images.")
    
    # Save the encoding to a file
    output_path = r"c:/Users/LENOVO/Desktop/SmartAttend2@/images/students/BCA051_average_encoding.npy"
    np.save(output_path, average_encoding)
    print(f"Saved average encoding to {output_path}")
    
    # Also save as a text list for easy copy-pasting
    txt_output_path = r"c:/Users/LENOVO/Desktop/SmartAttend2@/images/students/BCA051_average_encoding.txt"
    with open(txt_output_path, "w") as f:
        f.write(str(average_encoding.tolist()))
    print(f"Saved average encoding text format to {txt_output_path}")

else:
    print("Could not generate any encodings. Ensure the images contain clear faces.")
