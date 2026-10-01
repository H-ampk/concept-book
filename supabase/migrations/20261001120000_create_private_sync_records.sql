-- Private Sync records only.
-- Public share / snapshot columns and policies are intentionally absent.
-- Storage buckets are out of scope (issue #76).
--
-- RLS is enabled in this same migration so the table is never reachable
-- from the publishable key without owner checks.
--
-- FORCE ROW LEVEL SECURITY applies policies to the table owner.
-- Superuser and BYPASSRLS roles (local postgres, service_role) still bypass
-- RLS. The browser client uses the publishable key and the user JWT, which
-- connect as anon or authenticated and do not bypass RLS.

create table public.private_sync_records (
  owner_user_id uuid not null references auth.users (id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  schema_version integer not null,
  strategy text not null,
  version bigint not null,
  domain_updated_at timestamptz not null,
  deleted_at timestamptz,
  device_id text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now(),
  constraint private_sync_records_pkey
    primary key (owner_user_id, entity_type, entity_id),
  constraint private_sync_records_entity_id_not_empty
    check (char_length(entity_id) > 0),
  constraint private_sync_records_entity_type_check
    check (
      entity_type in (
        'concept',
        'contextCard',
        'quizQuestion',
        'quizDeck',
        'quizAttemptLog',
        'researchReport',
        'learningMaterial',
        'conceptSourceAnchor',
        'setting',
        'media'
      )
    ),
  -- Private Sync schema v1 only. Raise this in a later migration when v2 exists.
  constraint private_sync_records_schema_version_check
    check (schema_version = 1),
  constraint private_sync_records_strategy_check
    check (strategy in ('versioned', 'append-only')),
  constraint private_sync_records_version_check
    check (version >= 1),
  constraint private_sync_records_device_id_check
    check (device_id is null or char_length(device_id) > 0),
  constraint private_sync_records_payload_object_check
    check (jsonb_typeof(payload) = 'object'),
  constraint private_sync_records_payload_metadata_object_check
    check (jsonb_typeof(payload -> 'metadata') = 'object'),
  constraint private_sync_records_payload_id_check
    check (payload ->> 'id' = entity_id),
  constraint private_sync_records_payload_entity_type_check
    check (payload ->> 'entityType' = entity_type),
  constraint private_sync_records_payload_schema_version_check
    check ((payload ->> 'schemaVersion')::integer = schema_version),
  constraint private_sync_records_payload_strategy_check
    check (payload ->> 'strategy' = strategy),
  constraint private_sync_records_payload_owner_check
    check ((payload -> 'metadata' ->> 'ownerUserId') = owner_user_id::text),
  constraint private_sync_records_payload_version_check
    check ((payload -> 'metadata' ->> 'version')::bigint = version),
  constraint private_sync_records_payload_domain_updated_at_check
    check ((payload -> 'metadata' ->> 'updatedAt')::timestamptz = domain_updated_at),
  constraint private_sync_records_payload_deleted_at_check
    check (
      (
        deleted_at is null
        and (payload -> 'metadata' ->> 'deletedAt') is null
      )
      or (
        deleted_at is not null
        and (payload -> 'metadata' ->> 'deletedAt')::timestamptz = deleted_at
      )
    ),
  constraint private_sync_records_payload_device_id_check
    check (
      (
        device_id is null
        and (payload -> 'metadata' ->> 'deviceId') is null
      )
      or (payload -> 'metadata' ->> 'deviceId' = device_id)
    )
);

comment on table public.private_sync_records is
  'Private Sync records. Owner is owner_user_id (auth.uid()), not payload.metadata.ownerUserId. Pull cursors should keyset on (server_updated_at, entity_type, entity_id) within one owner so equal timestamps stay orderable.';

comment on column public.private_sync_records.domain_updated_at is
  'Domain metadata.updatedAt. Not the sync cursor clock.';

comment on column public.private_sync_records.server_updated_at is
  'Server write clock. Maintained by trigger. Cursor tie-break is (entity_type, entity_id), not this column alone.';

-- Pull pages: owner, then server clock, then a stable tie-break.
-- The primary key already indexes (owner_user_id, entity_type, entity_id).
create index private_sync_records_owner_server_cursor_idx
  on public.private_sync_records (owner_user_id, server_updated_at, entity_type, entity_id);

create or replace function public.private_sync_records_set_server_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.server_updated_at := pg_catalog.now();
  return new;
end;
$$;

comment on function public.private_sync_records_set_server_updated_at() is
  'Sets server_updated_at on insert and update. Does not change owner_user_id.';

create trigger private_sync_records_set_server_updated_at
before insert or update on public.private_sync_records
for each row
execute function public.private_sync_records_set_server_updated_at();

alter table public.private_sync_records enable row level security;
alter table public.private_sync_records force row level security;

revoke all on table public.private_sync_records from public;
revoke all on table public.private_sync_records from anon;
revoke all on table public.private_sync_records from authenticated;

grant select, insert, update, delete on table public.private_sync_records to authenticated;

create policy private_sync_select_own
on public.private_sync_records
for select
to authenticated
using (
  (select auth.uid()) is not null
  and (select auth.uid()) = owner_user_id
);

create policy private_sync_insert_own
on public.private_sync_records
for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and owner_user_id = (select auth.uid())
);

create policy private_sync_update_own
on public.private_sync_records
for update
to authenticated
using (
  (select auth.uid()) is not null
  and owner_user_id = (select auth.uid())
)
with check (
  (select auth.uid()) is not null
  and owner_user_id = (select auth.uid())
);

create policy private_sync_delete_own
on public.private_sync_records
for delete
to authenticated
using (
  (select auth.uid()) is not null
  and (select auth.uid()) = owner_user_id
);
