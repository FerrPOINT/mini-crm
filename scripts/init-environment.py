"""Create new installation credentials once; never print secret values."""
from pathlib import Path
import base64
import argparse
import hashlib
import hmac
import json
import os
import secrets
import time

path = Path('.env.local')
parser = argparse.ArgumentParser()
parser.add_argument('--public-url', default='http://127.0.0.1:8788')
options = parser.parse_args()
if path.exists():
    raise SystemExit('Environment already exists; preserved without changes.')
secret = secrets.token_hex(32)
def encode(data):
    return base64.urlsafe_b64encode(json.dumps(data, separators=(',', ':')).encode()).decode().rstrip('=')
def token(role):
    content = encode({'alg': 'HS256', 'typ': 'JWT'}) + '.' + encode({'iss': 'supabase', 'role': role, 'iat': int(time.time()), 'exp': int(time.time()) + 31536000})
    signature = base64.urlsafe_b64encode(hmac.new(secret.encode(), content.encode(), hashlib.sha256).digest()).decode().rstrip('=')
    return content + '.' + signature
anon = token('anon')
values = {
    'PUBLIC_URL': options.public_url.rstrip('/'),
    'POSTGRES_PASSWORD': secrets.token_hex(24), 'JWT_SECRET': secret,
    'AUTH_DB_PASSWORD': secrets.token_hex(24),
    'REST_DB_PASSWORD': secrets.token_hex(24),
    'VITE_SUPABASE_URL': '/api', 'VITE_SUPABASE_ANON_KEY': anon,
    'SUPABASE_SERVICE_ROLE_KEY': token('service_role'),
    'SUPABASE_ADMIN_AUTH_URL': 'http://127.0.0.1:54329',
    'SUPABASE_SCRIPT_URL': 'http://127.0.0.1:8788/api',
    'DEMO_MANAGER_PASSWORD': secrets.token_urlsafe(18),
    'DEMO_EXECUTOR1_PASSWORD': secrets.token_urlsafe(18),
    'DEMO_EXECUTOR2_PASSWORD': secrets.token_urlsafe(18),
}
fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w') as out:
    out.write(''.join(f'{key}={value}\n' for key, value in values.items()))
print('Created private installation environment (0600).')
