#!/usr/bin/env python3
"""Rebuild the bundled shortcut on macOS. Apple validates it during signing."""
import base64
import json
from pathlib import Path
import plistlib
import subprocess
import tempfile

root = Path(__file__).resolve().parent.parent
source = root / 'assets/shortcuts/import-statement.workflow.json'
with tempfile.TemporaryDirectory(prefix='gasfinder-shortcut-') as directory:
    unsigned = Path(directory) / 'unsigned.shortcut'
    signed = Path(directory) / 'GasFinder Import Statement.shortcut'
    unsigned.write_bytes(plistlib.dumps(json.loads(source.read_text())))
    subprocess.run(['/usr/bin/shortcuts', 'sign', '--mode', 'anyone', '--input', str(unsigned), '--output', str(signed)], check=True)
    output = {'name': 'GasFinder Import Statement', 'filename': signed.name, 'base64': base64.b64encode(signed.read_bytes()).decode('ascii')}
    (root / 'assets/shortcuts/import-statement.signed.json').write_text(json.dumps(output, indent=2) + '\n')
