-- One occurrence of a repeating event can also get its own location and
-- category ("This event" edits in the web and iOS editors). Null keeps the
-- series value, like the other override columns.

alter table public.event_exceptions
  add column location text,
  add column category_id uuid references public.categories(id) on delete set null;

-- Same rule as events: the category has to belong to the same user.
drop policy event_exceptions_own on public.event_exceptions;
create policy event_exceptions_own on public.event_exceptions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.events ev where ev.id = event_id and ev.user_id = (select auth.uid()))
    and (category_id is null or exists (
      select 1 from public.categories c where c.id = category_id and c.user_id = (select auth.uid())
    ))
  );
