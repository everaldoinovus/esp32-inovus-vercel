-- Fase 7 — Relatório de tempo de LED ligado/desligado
-- Execute este script no SQL Editor do Supabase (rptwqaewbfophayiomyd)

create table if not exists led_events (
  id bigserial primary key,
  state boolean not null,
  triggered_by uuid references profiles(id) on delete set null,
  triggered_at timestamp with time zone not null default now(),
  duration_seconds integer
);

create index if not exists led_events_triggered_at_idx
  on led_events (triggered_at desc);

alter table led_events enable row level security;

create policy "Eventos visiveis para autenticados"
  on led_events for select to authenticated using (true);

create policy "Insert via service role"
  on led_events for insert with check (true);

create policy "Update via service role"
  on led_events for update using (true);
