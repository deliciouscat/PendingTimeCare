"""Read the same Markdown catalog used by the Convex content preparation."""
import json
import subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]

def load_columns():
    result=subprocess.run(['node','--import','tsx','scripts/export-columns.ts','--stdout'],cwd=ROOT,capture_output=True,text=True,check=True)
    return json.loads(result.stdout)
