"""Real PostgreSQL lock regression. Run on the disposable self-hosted test installation."""
import json
import queue
import subprocess
import threading
import time
import uuid

BASE = ['docker', 'exec', '-i', 'mini-crm-db-1', 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-At']


def sql(statement):
    return subprocess.check_output(BASE + ['-v', 'ON_ERROR_STOP=1'], input=statement,
                                   text=True, timeout=15).strip()


def check_role_passwords():
    for role, variable, allowed in [
        ('postgres', 'POSTGRES_PASSWORD', True),
        ('authenticator', 'REST_DB_PASSWORD', True),
        ('supabase_auth_admin', 'AUTH_DB_PASSWORD', True),
        ('postgres', 'AUTH_DB_PASSWORD', False),
        ('postgres', 'REST_DB_PASSWORD', False),
        ('authenticator', 'POSTGRES_PASSWORD', False),
        ('supabase_auth_admin', 'POSTGRES_PASSWORD', False),
        ('authenticator', 'AUTH_DB_PASSWORD', False),
    ]:
        # Resolve secrets inside the container; neither argv nor output contains them.
        result = subprocess.run(['docker', 'exec', 'mini-crm-db-1', 'sh', '-c',
                                 f'PGPASSWORD="${variable}" psql -X -h 127.0.0.1 -U "$1" -d postgres -At -c "select 1"',
                                 'test', role], capture_output=True, text=True, timeout=10)
        assert (result.returncode == 0) == allowed, f'Unexpected password boundary for {role}/{variable}'
        if not allowed:
            assert 'password authentication failed' in result.stderr


check_role_passwords()


class Session:
    def __init__(self, name, actor):
        self.lines = []
        self.output = queue.Queue()
        self.process = subprocess.Popen(BASE + ['-v', 'VERBOSITY=verbose'], stdin=subprocess.PIPE,
                                        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                        text=True, bufsize=1)

        def collect():
            for line in self.process.stdout:
                self.lines.append(line.rstrip())
                self.output.put(line.rstrip())

        self.reader = threading.Thread(target=collect, daemon=True)
        self.reader.start()
        self.send(f"begin; set local statement_timeout='8s'; set local application_name='{name}';"
                  f"set local role authenticated; select set_config('request.jwt.claim.sub','{actor}',true);")

    def send(self, statement):
        self.process.stdin.write(statement + '\n')
        self.process.stdin.flush()

    def until(self, marker):
        deadline = time.monotonic() + 12
        while self.output.get(timeout=max(0.01, deadline - time.monotonic())) != marker:
            pass

    def close(self):
        if self.process.poll() is None:
            self.send('rollback;\n\\q')
            self.process.stdin.close()
            self.process.wait(timeout=12)
        self.reader.join(timeout=2)


manager = sql("select id from public.profiles where role='manager' order by id limit 1;")
executor = sql("select id from public.profiles where role='executor' order by id limit 1;")
assert manager and executor, 'Seed the test installation first'
site, task, created = [str(uuid.uuid4()) for _ in range(3)]
sessions = []
try:
    sql(f"begin; select set_config('request.jwt.claim.sub','{manager}',true);"
        f"select public.create_site('{site}','Lock regression','Disposable fixture');"
        f"select public.create_task('{task}','Lock regression','','{site}','{executor}'); commit;")

    deletion = Session('crm_test_delete', manager)
    editing = Session('crm_test_edit', manager)
    creating = Session('crm_test_create', manager)
    sessions = [deletion, editing, creating]
    # Simulate delete_site between taking the parent lock and updating its children.
    deletion.send(f"select id from public.sites where id='{site}' for update;\n\\echo SITE_LOCKED")
    deletion.until('SITE_LOCKED')
    editing.send(f"select public.update_task('{task}','{site}','{site}','Edited','','{executor}');\n\\echo EDIT_DONE")
    creating.send(f"select public.create_task('{created}','Created','','{site}','{executor}');\n\\echo CREATE_DONE")
    deadline = time.monotonic() + 5
    while sql("select count(*) from pg_stat_activity where application_name in ('crm_test_edit','crm_test_create') and wait_event_type='Lock';") != '2':
        assert time.monotonic() < deadline, 'Both writes must wait for the parent lock'
        time.sleep(0.05)
    deletion.send(f"select public.delete_site('{site}'); commit;\n\\echo DELETE_DONE")
    deletion.until('DELETE_DONE')
    editing.until('EDIT_DONE')
    creating.until('CREATE_DONE')
    assert any('42501' in line for line in editing.lines), editing.lines
    assert any('23514' in line for line in creating.lines), creating.lines
    assert not any('40P01' in line or '57014' in line for s in sessions for line in s.lines)
    assert sql(f"select count(*) from public.tasks where site_id='{site}' and deleted_at is null;") == '0'
    for session in sessions:
        session.close()
    sessions = []

    # Neighboring case: an edit that owns the parent lock finishes before deletion.
    sql(f"update public.sites set deleted_at=null where id='{site}';"
        f"update public.tasks set deleted_at=null where id='{task}';")
    editing = Session('crm_test_edit_first', manager)
    deletion = Session('crm_test_delete_second', manager)
    sessions = [editing, deletion]
    editing.send(f"select public.update_task('{task}','{site}','{site}','Edited','','{executor}');\n\\echo EDIT_HELD")
    editing.until('EDIT_HELD')
    deletion.send(f"select public.delete_site('{site}'); commit;\n\\echo DELETE_DONE")
    deadline = time.monotonic() + 5
    while sql("select count(*) from pg_stat_activity where application_name='crm_test_delete_second' and wait_event_type='Lock';") != '1':
        assert time.monotonic() < deadline, 'Deletion must wait for the edit'
        time.sleep(0.05)
    editing.send('commit;\n\\echo EDIT_DONE')
    editing.until('EDIT_DONE')
    deletion.until('DELETE_DONE')
    assert not any('ERROR:' in line for s in sessions for line in s.lines)
    assert sql(f"select count(*) from public.tasks where site_id='{site}' and deleted_at is null;") == '0'
    print(json.dumps({'delete_first': 'PASS', 'edit_first': 'PASS', 'create_during_delete': 'PASS'}))
finally:
    for session in sessions:
        session.close()
    sql(f"begin; delete from public.task_history where task_id in ('{task}','{created}');"
        f"delete from public.tasks where id in ('{task}','{created}');"
        f"delete from public.sites where id='{site}'; commit;")
