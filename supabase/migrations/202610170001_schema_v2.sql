-- Remindly schema v2.
--
-- Replaces the original tables outright (no data was kept). Main changes:
--   * Category, task, priority and completion are real columns, not JSON in notes.
--   * All-day events store calendar dates; timed events store instants + a time zone.
--   * Repeats support an interval ("every 2 weeks") and per-occurrence exceptions.
--   * Reminders are rules; the database keeps `next_due_at` current for every
--     occurrence of a repeating event, and deliveries are logged once per occurrence.
--   * Devices are one row per device, not one per platform.

-- Only drop the v1 tables (recognizable by events.is_archived). If this file is
-- ever run a second time on a v2 database, it stops at the first CREATE below
-- instead of wiping real data.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'events' and column_name = 'is_archived'
  ) then
    drop table public.live_activity_runs, public.reminders, public.devices, public.events cascade;
    drop function public.set_updated_at() cascade;
  end if;
end;
$$;

create extension if not exists pgcrypto;

-- ─── Helpers ──────────────────────────────────────────────────────────────────

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── Profiles ─────────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'UTC',
  week_start smallint not null default 0 check (week_start between 0 and 6),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Categories ───────────────────────────────────────────────────────────────

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  -- A palette name, not a hex value, so the app can pick light/dark shades.
  color text not null default 'gray'
    check (color in ('gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index categories_user_idx on public.categories(user_id, sort_order);

-- ─── Events (and tasks) ───────────────────────────────────────────────────────

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null default 'event' check (kind in ('event', 'task')),
  title text not null check (char_length(trim(title)) > 0),
  notes text not null default '',
  location text not null default '',
  category_id uuid references public.categories(id) on delete set null,

  -- Timed events use starts_at/ends_at; all-day events use start_date/end_date
  -- (end_date inclusive, so multi-day events are possible).
  all_day boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  start_date date,
  end_date date,
  -- IANA zone the event was created in; repeats keep their wall-clock time across DST.
  timezone text not null default 'UTC',

  repeat_freq text check (repeat_freq in ('daily', 'weekly', 'monthly', 'yearly')),
  repeat_interval smallint not null default 1 check (repeat_interval between 1 and 99),
  repeat_until date,

  priority text check (priority in ('low', 'medium', 'high')),
  completed_at timestamptz,

  -- Where the event came from, for future calendar imports.
  source text not null default 'manual',
  external_id text,

  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint events_time_shape check (
    (all_day and start_date is not null and end_date is not null and end_date >= start_date
      and starts_at is null and ends_at is null)
    or (not all_day and starts_at is not null and ends_at is not null and ends_at > starts_at
      and start_date is null and end_date is null)
  ),
  constraint events_task_fields check (kind = 'task' or (priority is null and completed_at is null)),
  constraint events_repeat_until check (repeat_until is null or repeat_freq is not null),
  unique (user_id, source, external_id)
);

create index events_user_idx on public.events(user_id) where deleted_at is null;

-- One occurrence of a repeating event that was skipped or changed.
create table public.event_exceptions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- The date the occurrence would normally fall on (event time zone).
  occurrence_date date not null,
  cancelled boolean not null default false,
  -- Overrides; null keeps the series value.
  title text,
  notes text,
  starts_at timestamptz,
  ends_at timestamptz,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, occurrence_date)
);

-- ─── Reminders ────────────────────────────────────────────────────────────────

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- Minutes before the occurrence starts. Negative means after the start, e.g.
  -- -540 on an all-day event or task is 9:00 AM that day.
  offset_minutes integer not null check (offset_minutes between -1440 and 525600),
  channel text not null default 'live_activity' check (channel in ('live_activity', 'notification')),
  -- Maintained by triggers; null when there's no future occurrence to remind about.
  next_due_at timestamptz,
  next_occurrence_date date,
  created_at timestamptz not null default now(),
  unique (event_id, offset_minutes, channel)
);

create index reminders_due_idx on public.reminders(next_due_at) where next_due_at is not null;

-- One row per reminder per occurrence: the dispatcher's record of what it sent.
create table public.reminder_deliveries (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  occurrence_date date not null,
  due_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  attempts integer not null default 0,
  last_attempt_at timestamptz,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (reminder_id, occurrence_date)
);

create index reminder_deliveries_retry_idx on public.reminder_deliveries(created_at) where status <> 'sent';

-- ─── Devices & Live Activities ────────────────────────────────────────────────

create table public.devices (
  -- The app picks this id (e.g. identifierForVendor) and upserts on it.
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  platform text not null default 'ios' check (platform in ('ios', 'web')),
  name text,
  apns_token text unique,
  push_to_start_token text unique,
  -- Set when APNs reports the token is no longer valid.
  disabled_at timestamptz,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index devices_user_idx on public.devices(user_id);

create table public.live_activity_runs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete cascade,
  occurrence_date date not null,
  activity_id text,
  -- Token for pushing updates to this running activity.
  update_token text,
  phase text not null default 'upcoming' check (phase in ('upcoming', 'starting', 'in_progress', 'ended', 'stale')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  unique (device_id, event_id, occurrence_date)
);

-- ─── updated_at triggers ──────────────────────────────────────────────────────

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger categories_set_updated_at before update on public.categories
  for each row execute function public.set_updated_at();
create trigger events_set_updated_at before update on public.events
  for each row execute function public.set_updated_at();
create trigger event_exceptions_set_updated_at before update on public.event_exceptions
  for each row execute function public.set_updated_at();

-- ─── New users get a profile and starter categories ───────────────────────────

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tz text := new.raw_user_meta_data ->> 'timezone';
begin
  if tz is null or not exists (select 1 from pg_catalog.pg_timezone_names where name = tz) then
    tz := 'UTC';
  end if;

  insert into public.profiles (id, display_name, timezone)
  values (new.id, new.raw_user_meta_data ->> 'full_name', tz);

  insert into public.categories (user_id, name, color, sort_order) values
    (new.id, 'Work', 'blue', 0),
    (new.id, 'Personal', 'purple', 1),
    (new.id, 'Health', 'green', 2),
    (new.id, 'Social', 'orange', 3);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Accounts that existed before this migration get the same starting point.
insert into public.profiles (id, display_name, timezone)
select u.id, u.raw_user_meta_data ->> 'full_name',
  coalesce((select name from pg_timezone_names where name = u.raw_user_meta_data ->> 'timezone'), 'UTC')
from auth.users u
on conflict (id) do nothing;

insert into public.categories (user_id, name, color, sort_order)
select u.id, c.name, c.color, c.sort_order
from auth.users u
cross join (values ('Work', 'blue', 0), ('Personal', 'purple', 1), ('Health', 'green', 2), ('Social', 'orange', 3))
  as c(name, color, sort_order)
where not exists (select 1 from public.categories existing where existing.user_id = u.id);

-- ─── Occurrence math (mirrors apps/web/lib/calendar/recurrence.ts) ────────────

-- Start/end of one occurrence, applying any exception that moved it.
create function public.occurrence_bounds(e public.events, occ_date date, x public.event_exceptions)
returns table (occ_start timestamptz, occ_end timestamptz)
language plpgsql
stable
set search_path = ''
as $$
declare
  span interval;
  local_start timestamp;
begin
  if e.all_day then
    if x.start_date is not null then
      occ_start := x.start_date::timestamp at time zone e.timezone;
      occ_end := (coalesce(x.end_date, x.start_date) + 1)::timestamp at time zone e.timezone;
    else
      occ_start := occ_date::timestamp at time zone e.timezone;
      occ_end := (occ_date + (e.end_date - e.start_date) + 1)::timestamp at time zone e.timezone;
    end if;
  elsif x.starts_at is not null then
    occ_start := x.starts_at;
    occ_end := coalesce(x.ends_at, x.starts_at + (e.ends_at - e.starts_at));
  else
    span := e.ends_at - e.starts_at;
    local_start := occ_date + (e.starts_at at time zone e.timezone)::time;
    occ_start := local_start at time zone e.timezone;
    occ_end := occ_start + span;
  end if;
  return next;
end;
$$;

-- The next occurrence whose reminder (start minus offset) is after `after`.
-- Monthly/yearly repeats skip months without the start's day (the 31st, Feb 29).
create function public.next_reminder(e public.events, offset_minutes integer, after timestamptz)
returns table (occurrence_date date, due_at timestamptz)
language plpgsql
stable
set search_path = ''
as $$
declare
  first_date date := case when e.all_day then e.start_date else (e.starts_at at time zone e.timezone)::date end;
  target_date date := ((after + make_interval(mins => offset_minutes)) at time zone e.timezone)::date;
  step integer := e.repeat_interval;
  k integer;
  candidate date;
  x public.event_exceptions;
  b record;
begin
  if e.deleted_at is not null or e.completed_at is not null then
    return;
  end if;

  if e.repeat_freq is null then
    k := 0;
  elsif e.repeat_freq in ('daily', 'weekly') then
    -- Start a little before the target so moved occurrences aren't missed.
    k := greatest(0, ((target_date - first_date) / (case e.repeat_freq when 'daily' then 1 else 7 end) / step) - 2);
  else
    k := greatest(0, ((extract(year from age(target_date, first_date)) * 12 + extract(month from age(target_date, first_date)))::integer
      / (case e.repeat_freq when 'monthly' then 1 else 12 end) / step) - 2);
  end if;

  for i in 0..500 loop
    candidate := case e.repeat_freq
      when 'daily' then first_date + k * step
      when 'weekly' then first_date + k * step * 7
      when 'monthly' then (first_date + make_interval(months => k * step))::date
      when 'yearly' then (first_date + make_interval(years => k * step))::date
      else first_date
    end;
    exit when e.repeat_until is not null and candidate > e.repeat_until;

    if e.repeat_freq not in ('monthly', 'yearly') or extract(day from candidate) = extract(day from first_date) then
      select * into x from public.event_exceptions ex where ex.event_id = e.id and ex.occurrence_date = candidate;
      if not coalesce(x.cancelled, false) then
        select * into b from public.occurrence_bounds(e, candidate, x);
        if b.occ_start - make_interval(mins => offset_minutes) > after then
          occurrence_date := candidate;
          due_at := b.occ_start - make_interval(mins => offset_minutes);
          return next;
          return;
        end if;
      end if;
    end if;

    exit when e.repeat_freq is null;
    k := k + 1;
  end loop;
end;
$$;

-- ─── Keep reminders.next_due_at current ───────────────────────────────────────

create function public.reminders_compute_next()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  e public.events;
  r record;
begin
  select * into e from public.events where id = new.event_id;
  select * into r from public.next_reminder(e, new.offset_minutes, now());
  new.next_occurrence_date := r.occurrence_date;
  new.next_due_at := r.due_at;
  return new;
end;
$$;

create trigger reminders_compute_next
  before insert or update of offset_minutes, event_id, next_due_at on public.reminders
  for each row execute function public.reminders_compute_next();

-- Touching next_due_at re-runs the trigger above for every reminder on the event.
create function public.refresh_event_reminders()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.reminders set next_due_at = null
  where event_id = case when tg_op = 'DELETE' then old.event_id else new.event_id end;
  return null;
end;
$$;

create function public.refresh_reminders_for_event()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.reminders set next_due_at = null where event_id = new.id;
  return null;
end;
$$;

create trigger events_refresh_reminders
  after update of starts_at, ends_at, start_date, end_date, all_day, timezone,
    repeat_freq, repeat_interval, repeat_until, completed_at, deleted_at
  on public.events
  for each row execute function public.refresh_reminders_for_event();

create trigger event_exceptions_refresh_reminders
  after insert or update or delete on public.event_exceptions
  for each row execute function public.refresh_event_reminders();

-- ─── Dispatcher entry point ───────────────────────────────────────────────────

-- Hands out reminders that are due (plus recent failed sends to retry), logging
-- each occurrence once so two overlapping runs can't double-send, then moves
-- the reminder on to its next occurrence. Only the service role may call it.
create function public.claim_due_reminders(max_count integer default 100)
returns table (
  delivery_id uuid,
  reminder_id uuid,
  user_id uuid,
  event_id uuid,
  title text,
  kind text,
  channel text,
  offset_minutes integer,
  occurrence_date date,
  occurrence_start timestamptz,
  occurrence_end timestamptz
)
language plpgsql
set search_path = ''
as $$
#variable_conflict use_column
declare
  r public.reminders;
  d public.reminder_deliveries;
  e public.events;
  x public.event_exceptions;
  b record;
begin
  for r in
    select * from public.reminders
    where next_due_at <= now()
    order by next_due_at
    limit max_count
    for update skip locked
  loop
    insert into public.reminder_deliveries (reminder_id, event_id, user_id, occurrence_date, due_at)
    values (r.id, r.event_id, r.user_id, r.next_occurrence_date, r.next_due_at)
    on conflict on constraint reminder_deliveries_reminder_id_occurrence_date_key do nothing;
    -- Move on to the next occurrence either way.
    update public.reminders set next_due_at = null where id = r.id;
  end loop;

  for d in
    update public.reminder_deliveries rd
    set attempts = rd.attempts + 1, last_attempt_at = now()
    where rd.id in (
      select id from public.reminder_deliveries
      where status <> 'sent' and attempts < 3 and created_at > now() - interval '15 minutes'
        -- Leave a send that another run just picked up alone for a minute.
        and (last_attempt_at is null or last_attempt_at < now() - interval '1 minute')
      order by created_at
      limit max_count
      for update skip locked
    )
    returning rd.*
  loop
    select * into e from public.events where id = d.event_id;
    continue when e.deleted_at is not null;
    select * into x from public.event_exceptions ex where ex.event_id = e.id and ex.occurrence_date = d.occurrence_date;
    select * into b from public.occurrence_bounds(e, d.occurrence_date, x);

    delivery_id := d.id;
    reminder_id := d.reminder_id;
    user_id := d.user_id;
    event_id := d.event_id;
    title := coalesce(x.title, e.title);
    kind := e.kind;
    select rm.channel, rm.offset_minutes into channel, offset_minutes from public.reminders rm where rm.id = d.reminder_id;
    occurrence_date := d.occurrence_date;
    occurrence_start := b.occ_start;
    occurrence_end := b.occ_end;
    return next;
  end loop;
end;
$$;

revoke execute on function public.claim_due_reminders(integer) from public, anon, authenticated;

-- ─── Row-level security ───────────────────────────────────────────────────────

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.events enable row level security;
alter table public.event_exceptions enable row level security;
alter table public.reminders enable row level security;
alter table public.reminder_deliveries enable row level security;
alter table public.devices enable row level security;
alter table public.live_activity_runs enable row level security;

create policy profiles_own on public.profiles for all to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy categories_own on public.categories for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Foreign keys skip RLS, so also check the category belongs to the same user.
create policy events_own on public.events for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (category_id is null or exists (
      select 1 from public.categories c where c.id = category_id and c.user_id = (select auth.uid())
    ))
  );

create policy event_exceptions_own on public.event_exceptions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.events ev where ev.id = event_id and ev.user_id = (select auth.uid()))
  );

create policy reminders_own on public.reminders for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.events ev where ev.id = event_id and ev.user_id = (select auth.uid()))
  );

-- Written by the dispatcher (service role); users can only read their history.
create policy reminder_deliveries_read_own on public.reminder_deliveries for select to authenticated
  using (user_id = (select auth.uid()));

create policy devices_own on public.devices for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy live_activity_runs_own on public.live_activity_runs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
