create extension if not exists pgcrypto;

create table public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) > 0),
  notes text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  timezone text not null default 'UTC',
  is_all_day boolean not null default false,
  repeat_frequency text not null default 'none' check (repeat_frequency in ('none', 'daily', 'weekly', 'monthly')),
  repeat_until timestamptz,
  is_archived boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (repeat_until is null or repeat_until >= starts_at)
);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  offset_minutes integer not null check (offset_minutes >= 0),
  channel text not null default 'live_activity' check (channel in ('live_activity', 'notification')),
  due_at timestamptz not null,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (event_id, offset_minutes, channel)
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'ios' check (platform in ('ios', 'web')),
  apns_device_token text,
  activity_push_to_start_token text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, platform),
  unique (user_id, activity_push_to_start_token)
);

create table public.live_activity_runs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  reminder_id uuid references public.reminders(id) on delete set null,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid references public.devices(id) on delete set null,
  activity_id text,
  update_token text,
  phase text not null default 'upcoming' check (phase in ('upcoming', 'starting', 'in_progress', 'ended', 'stale')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index events_user_start_idx on public.events(user_id, starts_at) where deleted_at is null;
create index reminders_due_idx on public.reminders(due_at) where delivered_at is null;
create index reminders_user_idx on public.reminders(user_id, due_at);
create index devices_user_idx on public.devices(user_id);
create index live_activity_runs_user_idx on public.live_activity_runs(user_id, event_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_updated_at();

alter table public.events enable row level security;
alter table public.reminders enable row level security;
alter table public.devices enable row level security;
alter table public.live_activity_runs enable row level security;

create policy "events_select_own"
on public.events for select
to authenticated
using (auth.uid() = user_id);

create policy "events_insert_own"
on public.events for insert
to authenticated
with check (auth.uid() = user_id);

create policy "events_update_own"
on public.events for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "events_delete_own"
on public.events for delete
to authenticated
using (auth.uid() = user_id);

create policy "reminders_select_own"
on public.reminders for select
to authenticated
using (auth.uid() = user_id);

create policy "reminders_insert_own"
on public.reminders for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.events
    where events.id = reminders.event_id
    and events.user_id = auth.uid()
  )
);

create policy "reminders_update_own"
on public.reminders for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "reminders_delete_own"
on public.reminders for delete
to authenticated
using (auth.uid() = user_id);

create policy "devices_manage_own"
on public.devices for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "live_activity_runs_select_own"
on public.live_activity_runs for select
to authenticated
using (auth.uid() = user_id);

create policy "live_activity_runs_insert_own"
on public.live_activity_runs for insert
to authenticated
with check (auth.uid() = user_id);

create policy "live_activity_runs_update_own"
on public.live_activity_runs for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
