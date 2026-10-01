-- Database security tests for public.private_sync_records.
-- Requires Supabase local Postgres (`supabase test db`), which loads pgtap
-- and the `tests` helper schema (create_supabase_user / authenticate_as).
-- These are not mock client tests.

begin;

select plan(51);

select tests.create_supabase_user('user-a@example.com', 'password');
select tests.create_supabase_user('user-b@example.com', 'password');

select set_config('test.user_a', tests.get_supabase_uid('user-a@example.com')::text, true);
select set_config('test.user_b', tests.get_supabase_uid('user-b@example.com')::text, true);

create function pg_temp.sync_payload(
  owner_id uuid,
  entity_type text,
  entity_id text,
  strategy text,
  version bigint,
  updated_at timestamptz
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'schemaVersion', 1,
    'id', entity_id,
    'entityType', entity_type,
    'strategy', strategy,
    'metadata', pg_catalog.jsonb_build_object(
      'ownerUserId', owner_id::text,
      'version', version,
      'updatedAt', updated_at
    ),
    'data', pg_catalog.jsonb_build_object('id', entity_id)
  );
$$;

grant execute on function pg_temp.sync_payload(uuid, text, text, text, bigint, timestamptz) to public;

insert into public.private_sync_records (
  owner_user_id, entity_type, entity_id, schema_version, strategy, version, domain_updated_at, payload
)
values
  (
    current_setting('test.user_a')::uuid, 'concept', 'concept_known', 1, 'versioned', 1,
    '2026-01-01T00:00:00Z',
    pg_temp.sync_payload(current_setting('test.user_a')::uuid, 'concept', 'concept_known', 'versioned', 1, '2026-01-01T00:00:00Z')
  ),
  (
    current_setting('test.user_b')::uuid, 'concept', 'concept_known', 1, 'versioned', 1,
    '2026-01-01T00:00:00Z',
    pg_temp.sync_payload(current_setting('test.user_b')::uuid, 'concept', 'concept_known', 'versioned', 1, '2026-01-01T00:00:00Z')
  ),
  (
    current_setting('test.user_a')::uuid, 'quizAttemptLog', 'attempt_a', 1, 'append-only', 1,
    '2026-01-01T00:00:00Z',
    pg_temp.sync_payload(current_setting('test.user_a')::uuid, 'quizAttemptLog', 'attempt_a', 'append-only', 1, '2026-01-01T00:00:00Z')
  ),
  (
    current_setting('test.user_b')::uuid, 'quizAttemptLog', 'attempt_b', 1, 'append-only', 1,
    '2026-01-01T00:00:00Z',
    pg_temp.sync_payload(current_setting('test.user_b')::uuid, 'quizAttemptLog', 'attempt_b', 'append-only', 1, '2026-01-01T00:00:00Z')
  ),
  (
    current_setting('test.user_a')::uuid, 'setting', 'setting_domain_colors', 1, 'versioned', 1,
    '2026-01-01T00:00:00Z',
    pg_temp.sync_payload(current_setting('test.user_a')::uuid, 'setting', 'setting_domain_colors', 'versioned', 1, '2026-01-01T00:00:00Z')
  ),
  (
    current_setting('test.user_b')::uuid, 'setting', 'setting_domain_colors', 1, 'versioned', 1,
    '2026-01-01T00:00:00Z',
    pg_temp.sync_payload(current_setting('test.user_b')::uuid, 'setting', 'setting_domain_colors', 'versioned', 1, '2026-01-01T00:00:00Z')
  ),
  (
    current_setting('test.user_a')::uuid, 'media', 'media_a', 1, 'versioned', 1,
    '2026-01-01T00:00:00Z',
    pg_temp.sync_payload(current_setting('test.user_a')::uuid, 'media', 'media_a', 'versioned', 1, '2026-01-01T00:00:00Z')
  ),
  (
    current_setting('test.user_b')::uuid, 'media', 'media_b', 1, 'versioned', 1,
    '2026-01-01T00:00:00Z',
    pg_temp.sync_payload(current_setting('test.user_b')::uuid, 'media', 'media_b', 'versioned', 1, '2026-01-01T00:00:00Z')
  );

-- auth.uid() must match the fixture user before any RLS assertion.
select tests.authenticate_as('user-a@example.com');
set local role authenticated;

select is(
  auth.uid(),
  current_setting('test.user_a')::uuid,
  'auth.uid() is user A after authenticate_as'
);

reset role;
select tests.authenticate_as('user-b@example.com');
set local role authenticated;

select is(
  auth.uid(),
  current_setting('test.user_b')::uuid,
  'auth.uid() is user B after authenticate_as'
);

reset role;

-- Trigger overwrites a client-supplied server clock. Admin context, not an RLS assertion.
insert into public.private_sync_records (
  owner_user_id, entity_type, entity_id, schema_version, strategy, version,
  domain_updated_at, server_updated_at, payload
)
values (
  current_setting('test.user_a')::uuid, 'concept', 'concept_clock', 1, 'versioned', 1,
  '2026-01-01T00:00:00Z', '1999-01-01T00:00:00Z',
  pg_temp.sync_payload(current_setting('test.user_a')::uuid, 'concept', 'concept_clock', 'versioned', 1, '2026-01-01T00:00:00Z')
);

select is(
  (
    select server_updated_at = '1999-01-01T00:00:00Z'::timestamptz
    from public.private_sync_records
    where entity_id = 'concept_clock'
  ),
  false,
  'insert trigger overwrites a client-supplied server_updated_at'
);

select is(
  (
    select domain_updated_at = '2026-01-01T00:00:00Z'::timestamptz
      and server_updated_at <> domain_updated_at
    from public.private_sync_records
    where entity_id = 'concept_clock'
  ),
  true,
  'domain_updated_at stays the domain clock and is distinct from server_updated_at'
);

update public.private_sync_records
set server_updated_at = '2099-01-01T00:00:00Z'
where entity_id = 'concept_clock';

select is(
  (
    select server_updated_at = '2099-01-01T00:00:00Z'::timestamptz
    from public.private_sync_records
    where entity_id = 'concept_clock'
  ),
  false,
  'update trigger overwrites a client-supplied server_updated_at'
);

-- Test A: User A reads own rows.
select tests.authenticate_as('user-a@example.com');
set local role authenticated;

select is(
  (
    select count(*)
    from public.private_sync_records
    where owner_user_id = current_setting('test.user_a')::uuid
  ),
  4::bigint,
  'A: user A selects own concept, quizAttemptLog, setting, and media rows'
);

select results_eq(
  $$
    select entity_type
    from public.private_sync_records
    order by entity_type
  $$,
  $$
    select entity_type
    from (values ('concept'::text), ('media'), ('quizAttemptLog'), ('setting')) as expected(entity_type)
    order by entity_type
  $$,
  'A: user A list contains only own entity types'
);

-- Test B: cross-user read, including a known entity_id.
select is(
  (
    select count(*)
    from public.private_sync_records
    where owner_user_id = current_setting('test.user_b')::uuid
  ),
  0::bigint,
  'B: user A list query does not return user B rows'
);

select is(
  (
    select count(*)
    from public.private_sync_records
    where entity_id = 'concept_known'
      and owner_user_id = current_setting('test.user_b')::uuid
  ),
  0::bigint,
  'B: user A cannot read user B concept by known entity_id'
);

select is(
  (
    select count(*)
    from public.private_sync_records
    where entity_id in ('attempt_b', 'setting_domain_colors', 'media_b')
      and owner_user_id = current_setting('test.user_b')::uuid
  ),
  0::bigint,
  'B: user A cannot read user B quizAttemptLog, setting, or media by known entity_id'
);

select is(
  (select count(*) from public.private_sync_records where entity_id = 'concept_known'),
  1::bigint,
  'B: known concept id returns only user A own row'
);

-- Test C: cross-user update does not change B.
select is(
  (
    with updated as (
      update public.private_sync_records
      set version = 99,
          payload = pg_temp.sync_payload(
            current_setting('test.user_b')::uuid,
            'concept',
            'concept_known',
            'versioned',
            99,
            '2026-01-01T00:00:00Z'
          )
      where entity_id = 'concept_known'
        and owner_user_id = current_setting('test.user_b')::uuid
      returning 1
    )
    select count(*) from updated
  ),
  0::bigint,
  'C: user A update of user B concept affects zero rows'
);

reset role;

select is(
  (
    select version
    from public.private_sync_records
    where owner_user_id = current_setting('test.user_b')::uuid
      and entity_id = 'concept_known'
  ),
  1::bigint,
  'C: user B concept version is unchanged'
);

select is(
  (
    select payload -> 'metadata' ->> 'version'
    from public.private_sync_records
    where owner_user_id = current_setting('test.user_b')::uuid
      and entity_id = 'concept_known'
  ),
  '1',
  'C: user B concept payload version is unchanged'
);

-- Test D: cross-user delete leaves the row.
select tests.authenticate_as('user-a@example.com');
set local role authenticated;

select is(
  (
    with deleted as (
      delete from public.private_sync_records
      where entity_id = 'media_b'
        and owner_user_id = current_setting('test.user_b')::uuid
      returning 1
    )
    select count(*) from deleted
  ),
  0::bigint,
  'D: user A delete of user B media affects zero rows'
);

reset role;

select is(
  (
    select count(*)
    from public.private_sync_records
    where owner_user_id = current_setting('test.user_b')::uuid
      and entity_id = 'media_b'
  ),
  1::bigint,
  'D: user B media row remains'
);

-- Test E: forged owner insert is rejected and not rewritten as user A.
select tests.authenticate_as('user-a@example.com');
set local role authenticated;

select throws_ok(
  $$
    insert into public.private_sync_records (
      owner_user_id,
      entity_type,
      entity_id,
      schema_version,
      strategy,
      version,
      domain_updated_at,
      payload
    )
    values (
      current_setting('test.user_b')::uuid,
      'concept',
      'concept_forged',
      1,
      'versioned',
      1,
      '2026-01-02T00:00:00Z',
      pg_temp.sync_payload(
        current_setting('test.user_b')::uuid,
        'concept',
        'concept_forged',
        'versioned',
        1,
        '2026-01-02T00:00:00Z'
      )
    )
  $$,
  '42501',
  'E: insert with owner_user_id of user B is rejected'
);

reset role;

select is(
  (select count(*) from public.private_sync_records where entity_id = 'concept_forged'),
  0::bigint,
  'E: forged row is not stored for user B or rewritten for user A'
);

-- Test F: owner cannot be reassigned A -> B.
select tests.authenticate_as('user-a@example.com');
set local role authenticated;

select throws_ok(
  $$
    update public.private_sync_records
    set owner_user_id = current_setting('test.user_b')::uuid,
        payload = pg_temp.sync_payload(
          current_setting('test.user_b')::uuid,
          'concept',
          'concept_known',
          'versioned',
          1,
          '2026-01-01T00:00:00Z'
        )
    where entity_id = 'concept_known'
      and owner_user_id = current_setting('test.user_a')::uuid
  $$,
  '42501',
  'F: user A cannot change owner_user_id to user B'
);

reset role;

select is(
  (
    select owner_user_id = current_setting('test.user_a')::uuid
    from public.private_sync_records
    where entity_type = 'concept'
      and entity_id = 'concept_known'
      and owner_user_id = current_setting('test.user_a')::uuid
  ),
  true,
  'F: concept owner remains user A'
);

-- Own write still works, including representative entity types.
select tests.authenticate_as('user-a@example.com');
set local role authenticated;

select lives_ok(
  $$
    update public.private_sync_records
    set version = 2,
        payload = pg_temp.sync_payload(
          current_setting('test.user_a')::uuid,
          'setting',
          'setting_domain_colors',
          'versioned',
          2,
          '2026-01-01T00:00:00Z'
        )
    where entity_type = 'setting'
      and entity_id = 'setting_domain_colors'
  $$,
  'user A can update own setting row'
);

select lives_ok(
  $$
    delete from public.private_sync_records
    where entity_type = 'quizAttemptLog'
      and entity_id = 'attempt_a'
  $$,
  'user A can delete own quizAttemptLog row'
);

reset role;

select is(
  (select count(*) from public.private_sync_records where entity_id = 'attempt_a'),
  0::bigint,
  'user A own quizAttemptLog delete removed the row'
);

select is(
  (
    select version
    from public.private_sync_records
    where entity_type = 'setting'
      and entity_id = 'setting_domain_colors'
      and owner_user_id = current_setting('test.user_a')::uuid
  ),
  2::bigint,
  'user A setting version update persisted'
);

select is(
  (
    select version
    from public.private_sync_records
    where entity_type = 'setting'
      and entity_id = 'setting_domain_colors'
      and owner_user_id = current_setting('test.user_b')::uuid
  ),
  1::bigint,
  'user B setting with the same entity_id was not updated'
);

-- Payload owner mismatch is rejected even when the row owner is the caller.
select tests.authenticate_as('user-a@example.com');
set local role authenticated;

select throws_ok(
  $$
    insert into public.private_sync_records (
      owner_user_id,
      entity_type,
      entity_id,
      schema_version,
      strategy,
      version,
      domain_updated_at,
      payload
    )
    values (
      current_setting('test.user_a')::uuid,
      'media',
      'media_mismatch',
      1,
      'versioned',
      1,
      '2026-01-03T00:00:00Z',
      pg_temp.sync_payload(
        current_setting('test.user_b')::uuid,
        'media',
        'media_mismatch',
        'versioned',
        1,
        '2026-01-03T00:00:00Z'
      )
    )
  $$,
  '23514',
  'payload metadata.ownerUserId must equal owner_user_id'
);

select throws_ok(
  $$
    insert into public.private_sync_records (
      owner_user_id,
      entity_type,
      entity_id,
      schema_version,
      strategy,
      version,
      domain_updated_at,
      payload
    )
    values (
      current_setting('test.user_a')::uuid,
      'concept',
      'concept_bad_payload',
      1,
      'versioned',
      1,
      '2026-01-03T00:00:00Z',
      '"not-an-object"'::jsonb
    )
  $$,
  '23514',
  'payload must be a JSON object'
);

select throws_ok(
  $$
    insert into public.private_sync_records (
      owner_user_id, entity_type, entity_id, schema_version, strategy, version, domain_updated_at, payload
    )
    values (
      current_setting('test.user_a')::uuid, 'concept', 'concept_empty', 1, 'versioned', 1,
      '2026-01-03T00:00:00Z', '{}'::jsonb
    )
  $$,
  '23514',
  'empty payload object is rejected'
);

select throws_ok(
  $$
    insert into public.private_sync_records (
      owner_user_id, entity_type, entity_id, schema_version, strategy, version, domain_updated_at, payload
    )
    values (
      current_setting('test.user_a')::uuid, 'concept', 'concept_no_metadata', 1, 'versioned', 1,
      '2026-01-03T00:00:00Z',
      jsonb_build_object(
        'schemaVersion', 1, 'id', 'concept_no_metadata', 'entityType', 'concept', 'strategy', 'versioned',
        'data', jsonb_build_object('id', 'concept_no_metadata')
      )
    )
  $$,
  '23514',
  'payload without metadata is rejected'
);

select throws_ok(
  $$
    insert into public.private_sync_records (
      owner_user_id, entity_type, entity_id, schema_version, strategy, version, domain_updated_at, payload
    )
    values (
      current_setting('test.user_a')::uuid, 'concept', 'concept_no_id', 1, 'versioned', 1,
      '2026-01-03T00:00:00Z',
      pg_temp.sync_payload(current_setting('test.user_a')::uuid, 'concept', 'concept_no_id', 'versioned', 1, '2026-01-03T00:00:00Z') - 'id'
    )
  $$,
  '23514',
  'payload without id is rejected'
);

select throws_ok(
  $$
    insert into public.private_sync_records (
      owner_user_id, entity_type, entity_id, schema_version, strategy, version, domain_updated_at, payload
    )
    values (
      current_setting('test.user_a')::uuid, 'concept', 'concept_no_type', 1, 'versioned', 1,
      '2026-01-03T00:00:00Z',
      pg_temp.sync_payload(current_setting('test.user_a')::uuid, 'concept', 'concept_no_type', 'versioned', 1, '2026-01-03T00:00:00Z') - 'entityType'
    )
  $$,
  '23514',
  'payload without entityType is rejected'
);

select throws_ok(
  $$
    insert into public.private_sync_records (
      owner_user_id, entity_type, entity_id, schema_version, strategy, version, domain_updated_at, payload
    )
    values (
      current_setting('test.user_a')::uuid, 'concept', 'concept_no_schema', 1, 'versioned', 1,
      '2026-01-03T00:00:00Z',
      pg_temp.sync_payload(current_setting('test.user_a')::uuid, 'concept', 'concept_no_schema', 'versioned', 1, '2026-01-03T00:00:00Z') - 'schemaVersion'
    )
  $$,
  '23514',
  'payload without schemaVersion is rejected'
);

select throws_ok(
  $$
    insert into public.private_sync_records (
      owner_user_id, entity_type, entity_id, schema_version, strategy, version, domain_updated_at, payload
    )
    values (
      current_setting('test.user_a')::uuid, 'concept', 'concept_no_strategy', 1, 'versioned', 1,
      '2026-01-03T00:00:00Z',
      pg_temp.sync_payload(current_setting('test.user_a')::uuid, 'concept', 'concept_no_strategy', 'versioned', 1, '2026-01-03T00:00:00Z') - 'strategy'
    )
  $$,
  '23514',
  'payload without strategy is rejected'
);

select throws_ok(
  $$
    insert into public.private_sync_records (
      owner_user_id, entity_type, entity_id, schema_version, strategy, version, domain_updated_at, payload
    )
    values (
      current_setting('test.user_a')::uuid, 'concept', 'concept_no_owner', 1, 'versioned', 1,
      '2026-01-03T00:00:00Z',
      jsonb_set(
        pg_temp.sync_payload(current_setting('test.user_a')::uuid, 'concept', 'concept_no_owner', 'versioned', 1, '2026-01-03T00:00:00Z'),
        '{metadata}',
        (pg_temp.sync_payload(current_setting('test.user_a')::uuid, 'concept', 'concept_no_owner', 'versioned', 1, '2026-01-03T00:00:00Z') -> 'metadata') - 'ownerUserId'
      )
    )
  $$,
  '23514',
  'payload metadata without ownerUserId is rejected'
);

select throws_ok(
  $$
    insert into public.private_sync_records (
      owner_user_id, entity_type, entity_id, schema_version, strategy, version, domain_updated_at, payload
    )
    values (
      current_setting('test.user_a')::uuid, 'concept', 'concept_no_version', 1, 'versioned', 1,
      '2026-01-03T00:00:00Z',
      jsonb_set(
        pg_temp.sync_payload(current_setting('test.user_a')::uuid, 'concept', 'concept_no_version', 'versioned', 1, '2026-01-03T00:00:00Z'),
        '{metadata}',
        (pg_temp.sync_payload(current_setting('test.user_a')::uuid, 'concept', 'concept_no_version', 'versioned', 1, '2026-01-03T00:00:00Z') -> 'metadata') - 'version'
      )
    )
  $$,
  '23514',
  'payload metadata without version is rejected'
);

select throws_ok(
  $$
    insert into public.private_sync_records (
      owner_user_id, entity_type, entity_id, schema_version, strategy, version, domain_updated_at, payload
    )
    values (
      current_setting('test.user_a')::uuid, 'concept', 'concept_no_updated', 1, 'versioned', 1,
      '2026-01-03T00:00:00Z',
      jsonb_set(
        pg_temp.sync_payload(current_setting('test.user_a')::uuid, 'concept', 'concept_no_updated', 'versioned', 1, '2026-01-03T00:00:00Z'),
        '{metadata}',
        (pg_temp.sync_payload(current_setting('test.user_a')::uuid, 'concept', 'concept_no_updated', 'versioned', 1, '2026-01-03T00:00:00Z') -> 'metadata') - 'updatedAt'
      )
    )
  $$,
  '23514',
  'payload metadata without updatedAt is rejected'
);

reset role;

-- Test G: anonymous role cannot read or write.
set local role anon;
select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.sub', '', true);

select throws_ok(
  $$ select * from public.private_sync_records $$,
  '42501',
  'G: anon select is permission denied'
);

select throws_ok(
  $$
    insert into public.private_sync_records (
      owner_user_id,
      entity_type,
      entity_id,
      schema_version,
      strategy,
      version,
      domain_updated_at,
      payload
    )
    values (
      current_setting('test.user_a')::uuid,
      'concept',
      'concept_anon',
      1,
      'versioned',
      1,
      '2026-01-04T00:00:00Z',
      pg_temp.sync_payload(
        current_setting('test.user_a')::uuid,
        'concept',
        'concept_anon',
        'versioned',
        1,
        '2026-01-04T00:00:00Z'
      )
    )
  $$,
  '42501',
  'G: anon insert is permission denied'
);

select throws_ok(
  $$
    update public.private_sync_records
    set version = 5
    where entity_id = 'concept_known'
  $$,
  '42501',
  'G: anon update is permission denied'
);

select throws_ok(
  $$
    delete from public.private_sync_records
    where entity_id = 'concept_known'
  $$,
  '42501',
  'G: anon delete is permission denied'
);

reset role;

select is(
  (select count(*) from public.private_sync_records where entity_id = 'concept_anon'),
  0::bigint,
  'G: anon insert did not create a row'
);

select is(
  (select count(*) from public.private_sync_records where entity_id = 'concept_known'),
  2::bigint,
  'G: anon update and delete left both concept_known rows'
);

-- Test H: authenticated role without auth.uid() fails closed.
set local role authenticated;
select set_config('request.jwt.claims', '{}', true);
select set_config('request.jwt.claim.sub', '', true);

select is(
  (select count(*) from public.private_sync_records),
  0::bigint,
  'H: missing auth.uid() select returns no rows'
);

select throws_ok(
  $$
    insert into public.private_sync_records (
      owner_user_id,
      entity_type,
      entity_id,
      schema_version,
      strategy,
      version,
      domain_updated_at,
      payload
    )
    values (
      current_setting('test.user_a')::uuid,
      'concept',
      'concept_no_identity',
      1,
      'versioned',
      1,
      '2026-01-05T00:00:00Z',
      pg_temp.sync_payload(
        current_setting('test.user_a')::uuid,
        'concept',
        'concept_no_identity',
        'versioned',
        1,
        '2026-01-05T00:00:00Z'
      )
    )
  $$,
  '42501',
  'H: missing auth.uid() insert is rejected'
);

select is(
  (
    with updated as (
      update public.private_sync_records
      set version = 8
      where entity_id = 'concept_known'
      returning 1
    )
    select count(*) from updated
  ),
  0::bigint,
  'H: missing auth.uid() update affects zero rows'
);

select is(
  (
    with deleted as (
      delete from public.private_sync_records
      where entity_id = 'concept_known'
      returning 1
    )
    select count(*) from deleted
  ),
  0::bigint,
  'H: missing auth.uid() delete affects zero rows'
);

reset role;

select is(
  (select count(*) from public.private_sync_records where entity_id = 'concept_no_identity'),
  0::bigint,
  'H: missing identity insert did not create a row'
);

select is(
  (select count(*) from public.private_sync_records where entity_id = 'concept_known'),
  2::bigint,
  'H: missing identity did not change existing concept rows'
);

select is(
  (
    select count(*)
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'private_sync_records'
      and grantee = 'anon'
  ),
  0::bigint,
  'anon has no table privileges on private_sync_records'
);

select results_eq(
  $$
    select privilege_type
    from information_schema.role_table_grants
    where table_schema = 'public'
      and table_name = 'private_sync_records'
      and grantee = 'authenticated'
    order by privilege_type
  $$,
  $$
    select privilege_type
    from (values ('DELETE'::text), ('INSERT'), ('SELECT'), ('UPDATE')) as expected(privilege_type)
    order by privilege_type
  $$,
  'authenticated has only select, insert, update, and delete'
);

select has_index(
  'public',
  'private_sync_records',
  'private_sync_records_owner_server_cursor_idx',
  'cursor index exists for owner and server_updated_at tie-break'
);

select * from finish();

rollback;
