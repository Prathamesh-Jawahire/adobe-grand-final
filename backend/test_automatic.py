import os
import subprocess
import json
from pathlib import Path
import sys

# --- Configuration ---
# Define the directory structure for the project.
# This makes the script easily configurable.
PDF_DIR = Path("./data/pdfs")
JSON_DIR = Path("./data/json")
INPUT_DIR = Path("./data/selected_text")
OUTPUT_DIR = Path("./output")
SELECTED_TEXT_FILE = INPUT_DIR / "selected_text.json"
RESULT_FILE = OUTPUT_DIR / "extracted_sections_with_highlighting.json"

# --- Helper Functions ---

def setup_directories():
    """
    Create the necessary output directories for the pipeline.
    Input directories are expected to exist.
    """
    print("Setting up project directories...")
    # Only create directories where the scripts will write files.
    JSON_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print("Directories are ready.")

def validate_inputs():
    """
    Validates that all required input files and directories exist before running.
    """
    print("Validating inputs...")
    all_valid = True
    
    # Check 1: Ensure the PDF directory exists
    if not PDF_DIR.is_dir():
        print(f"ERROR: PDF directory not found at '{PDF_DIR}'")
        all_valid = False

    # Check 2: Ensure there are PDFs in the directory
    elif not any(PDF_DIR.glob("*.pdf")):
        print(f"ERROR: No PDF files found in '{PDF_DIR}'. Please add your PDF documents.")
        all_valid = False
        
    # Check 3: Ensure the input file for round_2 exists
    if not SELECTED_TEXT_FILE.is_file():
        print(f"ERROR: Selected text input file not found at '{SELECTED_TEXT_FILE}'")
        all_valid = False

    if not all_valid:
        print("\nInput validation failed. Please fix the issues above and try again.")
        sys.exit(1)
        
    print("All inputs validated successfully.")


def run_script(script_name: str, args: list):
    """
    Runs a Python script as a subprocess and handles errors.
    
    Args:
        script_name (str): The name of the python script to run.
        args (list): A list of command-line arguments for the script.
    """
    command = [sys.executable, script_name] + args
    print(f"\n--- Running: {' '.join(command)} ---")
    try:
        result = subprocess.run(command, check=True, capture_output=True, text=True)
        print(f"--- Successfully completed {script_name} ---")
        # Print stdout to show progress from the script (e.g., progress bars)
        if result.stdout:
            print("Output:\n", result.stdout)
    except FileNotFoundError:
        print(f"--- ERROR: Script not found: {script_name} ---")
        print("Please ensure all scripts (round_1A.py, round_2.py) are in the same directory.")
        sys.exit(1)
    except subprocess.CalledProcessError as e:
        print(f"--- ERROR running {script_name} ---")
        print("Return Code:", e.returncode)
        print("Stdout:", e.stdout)
        print("Stderr:", e.stderr)
        sys.exit(1) # Exit if a step fails

# --- Main Execution ---

def main():
    """Main function to orchestrate the entire workflow."""
    
    # 1. Setup environment
    setup_directories()
    validate_inputs()

    # 2. Run round_1A.py to process PDFs into JSONs
    # This assumes round_1A.py is configured to read from './data/pdfs'
    # and write to './data/json' as per its internal constants.
    run_script("round_1A.py", [])

    # 3. Run round_2.py to perform the analysis
    run_script("round_2.py", [
        "--input", str(SELECTED_TEXT_FILE),
        "--json_dir", str(JSON_DIR),
        "--output", str(RESULT_FILE)
    ])

    # 4. Final confirmation
    print("\n--- Workflow Complete ---")
    if RESULT_FILE.exists():
        print(f"Final results are available in: {RESULT_FILE}")
    else:
        print("Workflow finished, but the result file was not created.")

if __name__ == "__main__":
    main()
