-- Migration: recompute settled predictions for the half-loss handicap rule.
-- New settlement rule:
--   selected_margin > 0      => WIN (Hope Star: -10000, normal: 0)
--   selected_margin = 0      => WIN / 0
--   selected_margin = -0.25  => LOSE_HALF / 5000 (Hope Star: LOSE / 10000)
--   selected_margin < 0 else => LOSE / 10000 (Hope Star: LOSE_DOUBLE / 20000)
-- where selected_margin is from the selected team's perspective:
--   HOME: home_goals + handicap - away_goals
--   AWAY: -(home_goals + handicap - away_goals)
-- Safe to run multiple times.

begin;

-- Preview rows that will change.
with calculated as (
  select
    s.id as settlement_id,
    s.competition_id,
    s.match_id,
    s.player_id,
    p.choice,
    p.hope_star,
    m.match_type,
    m.home_team,
    m.away_team,
    m.home_goals,
    m.away_goals,
    m.handicap,
    case
      when p.choice = 'HOME' then m.home_goals::numeric + m.handicap - m.away_goals::numeric
      else -(m.home_goals::numeric + m.handicap - m.away_goals::numeric)
    end as selected_margin,
    s.status as old_status,
    s.penalty_vnd as old_penalty_vnd
  from public.settlements s
  join public.matches m on m.id = s.match_id
  join public.predictions p on p.id = s.prediction_id
  where m.status = 'FINISHED'
    and m.home_goals is not null
    and m.away_goals is not null
    and p.choice in ('HOME', 'AWAY')
), recalculated as (
  select
    *,
    (hope_star and match_type is not null and match_type <> 'group') as uses_hope_star,
    case
      when selected_margin > 0.0001 then 'WIN'
      when abs(selected_margin) < 0.0001 then 'WIN'
      when abs(selected_margin + 0.25) < 0.0001 and (hope_star and match_type is not null and match_type <> 'group') then 'LOSE'
      when abs(selected_margin + 0.25) < 0.0001 then 'LOSE_HALF'
      when hope_star and match_type is not null and match_type <> 'group' then 'LOSE_DOUBLE'
      else 'LOSE'
    end as new_status,
    case
      when selected_margin > 0.0001 and (hope_star and match_type is not null and match_type <> 'group') then -10000
      when selected_margin > 0.0001 then 0
      when abs(selected_margin) < 0.0001 then 0
      when abs(selected_margin + 0.25) < 0.0001 and (hope_star and match_type is not null and match_type <> 'group') then 10000
      when abs(selected_margin + 0.25) < 0.0001 then 5000
      when hope_star and match_type is not null and match_type <> 'group' then 20000
      else 10000
    end as new_penalty_vnd
  from calculated
)
select
  settlement_id,
  competition_id,
  match_id,
  player_id,
  choice,
  hope_star,
  match_type,
  home_team,
  away_team,
  home_goals,
  away_goals,
  handicap,
  selected_margin,
  old_status,
  old_penalty_vnd,
  new_status,
  new_penalty_vnd
from recalculated
where old_status <> new_status or old_penalty_vnd <> new_penalty_vnd
order by competition_id, match_id, player_id;

-- Apply recalculated results.
with calculated as (
  select
    s.id as settlement_id,
    p.choice,
    p.hope_star,
    m.match_type,
    case
      when p.choice = 'HOME' then m.home_goals::numeric + m.handicap - m.away_goals::numeric
      else -(m.home_goals::numeric + m.handicap - m.away_goals::numeric)
    end as selected_margin,
    s.status as old_status,
    s.penalty_vnd as old_penalty_vnd
  from public.settlements s
  join public.matches m on m.id = s.match_id
  join public.predictions p on p.id = s.prediction_id
  where m.status = 'FINISHED'
    and m.home_goals is not null
    and m.away_goals is not null
    and p.choice in ('HOME', 'AWAY')
), recalculated as (
  select
    settlement_id,
    case
      when selected_margin > 0.0001 then 'WIN'
      when abs(selected_margin) < 0.0001 then 'WIN'
      when abs(selected_margin + 0.25) < 0.0001 and (hope_star and match_type is not null and match_type <> 'group') then 'LOSE'
      when abs(selected_margin + 0.25) < 0.0001 then 'LOSE_HALF'
      when hope_star and match_type is not null and match_type <> 'group' then 'LOSE_DOUBLE'
      else 'LOSE'
    end as new_status,
    case
      when selected_margin > 0.0001 and (hope_star and match_type is not null and match_type <> 'group') then -10000
      when selected_margin > 0.0001 then 0
      when abs(selected_margin) < 0.0001 then 0
      when abs(selected_margin + 0.25) < 0.0001 and (hope_star and match_type is not null and match_type <> 'group') then 10000
      when abs(selected_margin + 0.25) < 0.0001 then 5000
      when hope_star and match_type is not null and match_type <> 'group' then 20000
      else 10000
    end as new_penalty_vnd,
    old_status,
    old_penalty_vnd
  from calculated
)
update public.settlements s
set
  status = r.new_status,
  penalty_vnd = r.new_penalty_vnd,
  settled_at = now()
from recalculated r
where s.id = r.settlement_id
  and (r.old_status <> r.new_status or r.old_penalty_vnd <> r.new_penalty_vnd);

-- Verify all settled rows now match the new calculation.
with calculated as (
  select
    s.id as settlement_id,
    p.choice,
    p.hope_star,
    m.match_type,
    case
      when p.choice = 'HOME' then m.home_goals::numeric + m.handicap - m.away_goals::numeric
      else -(m.home_goals::numeric + m.handicap - m.away_goals::numeric)
    end as selected_margin,
    s.status as old_status,
    s.penalty_vnd as old_penalty_vnd
  from public.settlements s
  join public.matches m on m.id = s.match_id
  join public.predictions p on p.id = s.prediction_id
  where m.status = 'FINISHED'
    and m.home_goals is not null
    and m.away_goals is not null
    and p.choice in ('HOME', 'AWAY')
), recalculated as (
  select
    settlement_id,
    case
      when selected_margin > 0.0001 then 'WIN'
      when abs(selected_margin) < 0.0001 then 'WIN'
      when abs(selected_margin + 0.25) < 0.0001 and (hope_star and match_type is not null and match_type <> 'group') then 'LOSE'
      when abs(selected_margin + 0.25) < 0.0001 then 'LOSE_HALF'
      when hope_star and match_type is not null and match_type <> 'group' then 'LOSE_DOUBLE'
      else 'LOSE'
    end as new_status,
    case
      when selected_margin > 0.0001 and (hope_star and match_type is not null and match_type <> 'group') then -10000
      when selected_margin > 0.0001 then 0
      when abs(selected_margin) < 0.0001 then 0
      when abs(selected_margin + 0.25) < 0.0001 and (hope_star and match_type is not null and match_type <> 'group') then 10000
      when abs(selected_margin + 0.25) < 0.0001 then 5000
      when hope_star and match_type is not null and match_type <> 'group' then 20000
      else 10000
    end as new_penalty_vnd,
    old_status,
    old_penalty_vnd
  from calculated
)
select count(*) as remaining_mismatched_settlements
from recalculated
where old_status <> new_status or old_penalty_vnd <> new_penalty_vnd;

commit;
