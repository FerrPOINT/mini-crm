// Self-hosted Linux installation: use the standard Supabase migration ledger.
import { execFileSync, spawnSync } from 'node:child_process';

if (process.platform !== 'linux') throw new Error('Run db:migrate on the Linux Docker host');
if (!process.env.POSTGRES_PASSWORD) throw new Error('Missing POSTGRES_PASSWORD');
const container = execFileSync(
  'docker',
  ['compose', '--env-file', '.env.local', '-f', 'deploy/compose.yml', 'ps', '-q', 'db'],
  { encoding: 'utf8' },
).trim();
if (!container) throw new Error('Start the database before applying migrations');
const info = JSON.parse(execFileSync('docker', ['inspect', container], { encoding: 'utf8' }))[0];
const address = info.NetworkSettings.Networks['mini-crm_default']?.IPAddress;
if (!address) throw new Error('Database is not connected to mini-crm_default');
const result = spawnSync(
  'supabase',
  [
    'db',
    'push',
    '--db-url',
    `postgresql://postgres@${address}:5432/postgres?sslmode=disable`,
    '--yes',
  ],
  {
    stdio: 'inherit',
    env: { ...process.env, PGPASSWORD: process.env.POSTGRES_PASSWORD },
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
