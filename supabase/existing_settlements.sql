-- Existing settled results from the manually tracked sheet.
-- Run after supabase/existing_predictions.sql.
-- NOT LOSE is stored as WIN with 0 VND. LOSE is stored as 10,000 VND.

with result_rows(player_id, match_key, status, penalty_vnd) as (
  values
    -- Mexico vs South Africa
    ('huy', 'mexico_south_africa', 'LOSE', 10000),
    ('tien', 'mexico_south_africa', 'WIN', 0),
    ('lam', 'mexico_south_africa', 'LOSE', 10000),
    ('tai', 'mexico_south_africa', 'WIN', 0),
    ('tang', 'mexico_south_africa', 'WIN', 0),
    ('tuc', 'mexico_south_africa', 'LOSE', 10000),
    ('co', 'mexico_south_africa', 'WIN', 0),
    ('thuong', 'mexico_south_africa', 'LOSE', 10000),
    ('tan', 'mexico_south_africa', 'LOSE', 10000),
    ('long', 'mexico_south_africa', 'WIN', 0),

    -- South Korea vs Czech Republic / Czechia
    ('huy', 'south_korea_czech', 'WIN', 0),
    ('tien', 'south_korea_czech', 'WIN', 0),
    ('lam', 'south_korea_czech', 'LOSE', 10000),
    ('tai', 'south_korea_czech', 'LOSE', 10000),
    ('tang', 'south_korea_czech', 'LOSE', 10000),
    ('tuc', 'south_korea_czech', 'WIN', 0),
    ('co', 'south_korea_czech', 'WIN', 0),
    ('thuong', 'south_korea_czech', 'WIN', 0),
    ('tan', 'south_korea_czech', 'WIN', 0),
    ('long', 'south_korea_czech', 'LOSE', 10000)
),
match_lookup as (
  select
    id,
    case
      when lower(home_team) in ('mexico') and lower(away_team) in ('south africa') then 'mexico_south_africa'
      when lower(home_team) in ('south korea', 'korea republic', 'republic of korea') and lower(away_team) in ('czech republic', 'czechia') then 'south_korea_czech'
    end as match_key
  from public.matches
),
resolved as (
  select
    p.id as prediction_id,
    p.match_id,
    p.player_id,
    r.status,
    r.penalty_vnd
  from result_rows r
  join match_lookup m on m.match_key = r.match_key
  join public.predictions p on p.match_id = m.id and p.player_id = r.player_id
)
insert into public.settlements (prediction_id, match_id, player_id, status, penalty_vnd, settled_at)
select prediction_id, match_id, player_id, status, penalty_vnd, now()
from resolved
on conflict (prediction_id) do update set
  status = excluded.status,
  penalty_vnd = excluded.penalty_vnd,
  settled_at = excluded.settled_at;

-- Check inserted settlement count; should be 20.
select count(*) as existing_settlements_count
from public.settlements s
join public.matches m on m.id = s.match_id
where (lower(m.home_team) = 'mexico' and lower(m.away_team) = 'south africa')
   or (lower(m.home_team) in ('south korea', 'korea republic', 'republic of korea') and lower(m.away_team) in ('czech republic', 'czechia'));
