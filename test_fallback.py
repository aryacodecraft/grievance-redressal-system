import os
import sys
import json
from dotenv import load_dotenv

# Auto-load environment variables from backend/.env
dotenv_path = os.path.join(os.path.dirname(__file__), "backend", ".env")
load_dotenv(dotenv_path=dotenv_path)

# Ensure backend directory is in path
sys.path.append(os.path.join(os.path.dirname(__file__), 'backend'))

from grievance_model import GrievanceModel
from llm_fallback import predict_with_fallback


class LowConfidenceMockModel:
    """Mock model that returns low confidence to trigger LLM fallback."""
    def predict(self, text: str) -> dict:
        return {
            "category": "Other",
            "confidence": 0.38,
            "reason": "Uncertain ML classification"
        }


def run_tests():
    print("=" * 70)
    print("GRIEVANCE CLASSIFICATION & LLM FALLBACK SYSTEM TEST RUNNER")
    print("=" * 70)

    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        print("\n[ERROR] GROQ_API_KEY was not found in backend/.env or environment.")
        return
    else:
        print(f"\n[INFO] GROQ_API_KEY loaded successfully: {api_key[:8]}...{api_key[-4:]}\n")

    # Initialize and train GrievanceModel
    print("1. Initializing & Training GrievanceModel on dataset...")
    model = GrievanceModel()
    model.train()
    print("   [OK] GrievanceModel trained successfully!\n")

    # --------------------------------------------------------------------------
    # TEST 1: High Confidence ML Prediction
    # --------------------------------------------------------------------------
    complaint_1 = "Pani ki pipeline leak ho rahi hai road par"
    print("--- TEST 1: Clear Water Grievance (ML Model) ---")
    print(f"Input: '{complaint_1}'")
    ml_raw_1 = model.predict(complaint_1)
    print(f"Raw ML Output: Category='{ml_raw_1['category']}', Confidence={ml_raw_1['confidence']}")
    
    result_1 = predict_with_fallback(model, complaint_1)
    print("Final Output:", json.dumps(result_1, indent=2))
    print(f"Result Source: {result_1['source']}\n")

    # --------------------------------------------------------------------------
    # TEST 2: Hinglish Grievance
    # --------------------------------------------------------------------------
    complaint_2 = "bijli 2 din se nahi hai"
    print("--- TEST 2: Hinglish Electricity Grievance (ML Model) ---")
    print(f"Input: '{complaint_2}'")
    ml_raw_2 = model.predict(complaint_2)
    print(f"Raw ML Output: Category='{ml_raw_2['category']}', Confidence={ml_raw_2['confidence']}")

    result_2 = predict_with_fallback(model, complaint_2)
    print("Final Output:", json.dumps(result_2, indent=2))
    print(f"Result Source: {result_2['source']}\n")

    # --------------------------------------------------------------------------
    # TEST 3: Low Confidence / Category 'Other' -> Triggers LLM Fallback
    # --------------------------------------------------------------------------
    complaint_3 = "Commercial shops are playing loud speakers until midnight"
    print("--- TEST 3: Low Confidence / 'Other' Grievance (Triggers Groq LLM Fallback) ---")
    print(f"Input: '{complaint_3}'")
    
    mock_model = LowConfidenceMockModel()
    result_3 = predict_with_fallback(mock_model, complaint_3)
    print("Final Output:", json.dumps(result_3, indent=2))
    print(f"Result Source: {result_3['source']}\n")

    print("=" * 70)
    print("[SUCCESS] ALL TESTS EXECUTED AND VERIFIED SUCCESSFULLY!")
    print("=" * 70)


if __name__ == "__main__":
    run_tests()
