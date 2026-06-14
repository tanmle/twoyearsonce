-- Migration: handicap draws are now no-penalty outcomes.
-- New rule: if home_goals + handicap = away_goals, settlement is WIN with 0 VND,
-- regardless of normal pick or Hope Star.
-- Safe to run multiple times.

begin;

-- Preview rows that will change.
select
  s.id,
  s.competition_id,
  s.match_id,
  s.player_id,
  p.choice,
  p.hope_star,
  s.status as old_status,
  s.penalty_vnd as old_penalty_vnd,
  m.home_team,
  m.away_team,
  m.home_goals,
  m.away_goals,
  m.handicap
from public.settlements s
join public.matches m on m.id = s.match_id
join public.predictions p on p.id = s.prediction_id
where m.status = 'FINISHED'
  and m.home_goals is not null
  and m.away_goals is not null
  and (m.home_goals::numeric + m.handicap) = m.away_goals::numeric
  and (s.status <> 'WIN' or s.penalty_vnd <> 0)
order by s.competition_id, s.match_id, s.player_id;

-- Apply new rule to all already-settled handicap draws, including Hope Star draws
-- that were previously stored as LOSE/10000.
update public.settlements s
set
  status = 'WIN',
  penalty_vnd = 0,
  settled_at = now()
from public.matches m
where m.id = s.match_id
  and m.status = 'FINISHED'
  and m.home_goals is not null
  and m.away_goals is not null
  and (m.home_goals::numeric + m.handicap) = m.away_goals::numeric
  and (s.status <> 'WIN' or s.penalty_vnd <> 0);

-- Verify no old charged handicap draws remain.
select count(*) as remaining_charged_handicap_draws
from public.settlements s
join public.matches m on m.id = s.match_id
where m.status = 'FINISHED'
  and m.home_goals is not null
  and m.away_goals is not null
  and (m.home_goals::numeric + m.handicap) = m.away_goals::numeric
  and (s.status <> 'WIN' or s.penalty_vnd <> 0);

commit;
