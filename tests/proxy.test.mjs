import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomInt, randomUUID } from 'node:crypto';
import { test } from 'node:test';

const docker = (...args) =>
  execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const container = 'mini-crm-web-1';
const info = JSON.parse(docker('inspect', container))[0];
const network = info.NetworkSettings.Networks['mini-crm_default'];
assert.ok(network?.IPAddress, 'Web must use the application network');
const webAddress = network.IPAddress;
const gateway = network.Gateway;
const marker = `proxy-test-${randomUUID()}`;
const address = () =>
  `2001:db8:${Array.from({ length: 6 }, () => randomInt(1, 0x10000).toString(16)).join(':')}`;

async function trusted(ip, grant = 'unsupported') {
  const response = await fetch(
    `http://127.0.0.1:8788/api/auth/v1/token?grant_type=${grant}&probe=${marker}`,
    {
      method: 'POST',
      headers: { 'X-Real-IP': ip, 'Content-Type': 'application/json' },
      body: '{}',
    },
  );
  await response.arrayBuffer();
  return response.status;
}

test('trusted client IPs have separate login quotas; refresh has its own budget', async () => {
  const a = address();
  const b = address();
  const c = address();
  const requests = [];
  for (let i = 0; i < 13; i++) requests.push(await trusted(a));
  assert.ok(requests.includes(429), 'Password quota must reject a burst');
  assert.equal(await trusted(b), 400, 'One client must not block a different client');
  for (let i = 0; i < 13; i++) assert.equal(await trusted(c, 'refresh_token'), 400);
  assert.equal(await trusted(c), 400, 'Refresh requests must not spend password quota');
  const logs = docker('logs', '--since', '30s', container);
  assert.ok(
    logs.includes(`${a} peer=${gateway}`),
    'Canonical IP must come from the trusted header',
  );
});

test('a container peer cannot forge X-Real-IP', () => {
  const forged = '198.51.100.247';
  docker(
    'exec',
    container,
    'wget',
    '-q',
    '-O',
    '/dev/null',
    '--header',
    `X-Real-IP: ${forged}`,
    `http://${webAddress}:8080/?probe=${marker}-untrusted`,
  );
  const line = docker('logs', '--since', '30s', container)
    .split('\n')
    .find((line) => line.includes(`${marker}-untrusted`));
  assert.ok(line, 'Request must appear in access log');
  assert.ok(
    line.startsWith(`${webAddress} peer=${webAddress}`),
    'Untrusted header must be ignored',
  );
});

test('the public gateway replaces forged client-address headers', async () => {
  assert.ok(process.env.PUBLIC_URL, 'Set PUBLIC_URL for the deployed gateway');
  const forged = '198.51.100.248';
  const response = await fetch(`${process.env.PUBLIC_URL}/?probe=${marker}-public`, {
    headers: { 'X-Real-IP': forged, 'X-Forwarded-For': forged, 'CF-Connecting-IP': forged },
  });
  await response.arrayBuffer();
  assert.equal(response.status, 200);
  const line = docker('logs', '--since', '30s', container)
    .split('\n')
    .find((line) => line.includes(`${marker}-public`));
  assert.ok(line?.includes(`peer=${gateway}`), 'Traffic must arrive through the trusted gateway');
  assert.ok(!line.startsWith(forged), 'External clients cannot set their canonical address');
});
