create or replace function public.get_event_attendees(
  requested_event_id text
)
returns table (
  display_name text,
  is_private boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    attendee.display_name,
    attendee.is_private
  from (
    select
      case
        when response.is_private then 'Anónimo'
        else concat(
          name_parts.first_name,
          case
            when name_parts.last_name is null then ''
            else ' ' || upper(left(name_parts.last_name, 1)) || '.'
          end
        )
      end as display_name,
      response.is_private,
      response.created_at
    from public.event_attendance_responses as response
    join public.events as event
      on event.id = response.event_id
      and event.is_published
    left join public.profiles as profile
      on profile.id = response.user_id
    cross join lateral (
      select
        coalesce(
          nullif(btrim(profile.first_name), ''),
          nullif(
            split_part(btrim(coalesce(profile.full_name, '')), ' ', 1),
            ''
          ),
          'Socio'
        ) as first_name,
        coalesce(
          nullif(btrim(profile.last_name), ''),
          nullif(
            btrim(
              regexp_replace(
                coalesce(profile.full_name, ''),
                '^\S+\s*',
                ''
              )
            ),
            ''
          )
        ) as last_name
    ) as name_parts
    where response.attending
      and response.event_id = requested_event_id
  ) as attendee
  order by
    attendee.is_private,
    lower(attendee.display_name),
    attendee.created_at;
$$;

revoke all on function public.get_event_attendees(text) from public;
grant execute on function public.get_event_attendees(text)
  to authenticated;
