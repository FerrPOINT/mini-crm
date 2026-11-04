"""Prepare the exact public Base UI package without changing the producer checkout."""
import io
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import tarfile

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('base_repository', type=Path)
SOURCE = parser.parse_args().base_repository.resolve()
REVISION = '5b6a3f3b0e538c9e6eb0ed0a7f455dca05bf67de'
destination = ROOT / '.local' / 'base-ui-source'
destination.mkdir(parents=True, exist_ok=True)
archive = subprocess.check_output(['git', '-C', str(SOURCE), 'archive', REVISION + ':base-modules/ui'])
with tarfile.open(fileobj=io.BytesIO(archive)) as source:
    source.extractall(destination, filter='data')
for name in ['LICENSE', 'NOTICE']:
    (destination / name).write_bytes(subprocess.check_output(['git', '-C', str(SOURCE), 'show', REVISION + ':' + name]))
package = json.loads((destination / 'package.json').read_text())
package['files'] += ['LICENSE', 'NOTICE']
(destination / 'package.json').write_text(json.dumps(package, indent=2) + '\n')
(ROOT / 'vendor').mkdir(exist_ok=True)
subprocess.run([shutil.which('pnpm.cmd') or 'pnpm', 'pack', '--pack-destination', str(ROOT / 'vendor')], cwd=destination, check=True, stdout=subprocess.DEVNULL)
(ROOT / '.base-ui-revision').write_text(REVISION + '\n')
