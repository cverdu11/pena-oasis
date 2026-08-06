alter table public.event_attendance_responses
  add column if not exists ticket_requested boolean not null default false;

create index if not exists event_attendance_responses_ticket_requested_event_idx
  on public.event_attendance_responses (event_id)
  where ticket_requested;
