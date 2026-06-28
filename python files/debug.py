import sys

print("Testing direct import of face_recognition_models...")
try:
    import face_recognition_models
    print("✅ Successfully imported face_recognition_models!")
except Exception as e:
    print("❌ Failed to import face_recognition_models.")
    print("THE REAL ERROR IS:")
    print(repr(e))
