import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomInt, randomUUID } from 'node:crypto';
import { test } from 'node:test';

const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8' });
const container = 'mini-crm-web-1';
const info = JSON.parse(docker('inspect', container))[0];
const ingress = info.NetworkSettings.Networks['mini-crm_ingress']?.IPAddress;
assert.ok(ingress, 'Web must use the isolated tunnel network');
const marker = `proxy-test-${randomUUID()}`;
const address = () =>
  `2001:db8:${Array.from({ length: 6 }, () => randomInt(1, 0x10000).toString(16)).join(':')}`;

function trusted(ip, grant = 'unsupported') {
  // Existing web container acts as a trusted ingress peer; no credentials or writes.
  const response = docker(
    'exec',
    container,
    'sh',
    '-c',
    'wget -S -O /dev/null --header "CF-Connecting-IP: $1" --post-data="{}" "$2" 2>&1 || true',
    'test',
    ip,
    `http://${ingress}:8080/api/auth/v1/token?grant_type=${grant}&probe=${marker}`,
  );
  const code = /HTTP\/1\.1 (\d+)/.exec(response)?.[1];
  assert.ok(code, response);
  return Number(code);
}

test('trusted client IPs have separate login quotas; refresh has its own budget', () => {
  const a = address();
  const b = address();
  const c = address();
  const requests = Array.from({ length: 13 }, () => trusted(a));
  assert.ok(requests.includes(429), 'Password quota must reject a burst');
  assert.equal(trusted(b), 400, 'One client must not block a different client');
  for (let i = 0; i < 13; i++) assert.equal(trusted(c, 'refresh_token'), 400);
  assert.equal(trusted(c), 400, 'Refresh requests must not spend password quota');
  const logs = docker('logs', '--since', '30s', container);
  assert.ok(
    logs.includes(`${a} peer=${ingress}`),
    'Canonical IP must come from the trusted header',
  );
});

test('an untrusted direct peer cannot forge CF-Connecting-IP', async () => {
  const forged = '198.51.100.247';
  const response = await fetch(`http://127.0.0.1:8788/?probe=${marker}-untrusted`, {
    headers: { 'CF-Connecting-IP': forged },
  });
  assert.equal(response.status, 200);
  const line = docker('logs', '--since', '30s', container)
    .split('\n')
    .find((line) => line.includes(`${marker}-untrusted`));
  assert.ok(line, 'Request must appear in access log');
  assert.ok(!line.startsWith(forged), 'Untrusted header must be ignored');
});
