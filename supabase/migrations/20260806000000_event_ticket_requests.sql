alter table public.event_attendance_responses
  add column if not exists ticket_requested boolean not null default false;

comment on column public.event_attendance_responses.ticket_requested is
  'Whether the member is requesting an event ticket from Pena Oasis.';
