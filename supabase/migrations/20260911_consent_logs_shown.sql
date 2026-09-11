-- 2026-09-11: banner impressions. choice = 'shown' rows record that the
-- banner was displayed (once per browser session) so accept rate can be
-- measured against everyone who saw it, not only those who clicked.
alter table public.consent_logs drop constraint if exists consent_logs_choice_check;
alter table public.consent_logs
  add constraint consent_logs_choice_check check (choice in ('granted', 'essential', 'shown'));
