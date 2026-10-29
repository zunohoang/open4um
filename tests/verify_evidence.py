"""Verify a completed run's artifact checksums without accessing the application."""
import argparse
from pathlib import Path
from evidence_support import verify

parser = argparse.ArgumentParser()
parser.add_argument("run_directory", type=Path)
args = parser.parse_args()
errors = verify(args.run_directory)
for error in errors:
    print(error)
print("INTEGRITY VERIFIED" if not errors else "INTEGRITY FAILED")
raise SystemExit(1 if errors else 0)
