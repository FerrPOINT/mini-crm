-- Adapted from supabase/supabase docker/volumes/db/roles.sql (Apache-2.0).
-- Upstream revision: 82671cbb65257a001ec5530d781aa86d54d38345.
\set restpass `echo "$REST_DB_PASSWORD"`
\set authpass `echo "$AUTH_DB_PASSWORD"`
ALTER USER authenticator WITH PASSWORD :'restpass';
ALTER USER supabase_auth_admin WITH PASSWORD :'authpass';
