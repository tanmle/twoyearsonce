-- Existing BeerCup predictions from the manually tracked sheet.
-- Run after supabase/schema.sql and supabase/seed_players.sql.
-- This upserts explicit picks and overrides the app's default HOME picks.

with picks(player_id, match_key, picked_team) as (
  values
    -- Mexico vs South Africa
    ('huy', 'mexico_south_africa', 'South Africa'),
    ('tien', 'mexico_south_africa', 'Mexico'),
    ('lam', 'mexico_south_africa', 'South Africa'),
    ('tai', 'mexico_south_africa', 'Mexico'),
    ('tang', 'mexico_south_africa', 'Mexico'),
    ('tuc', 'mexico_south_africa', 'South Africa'),
    ('co', 'mexico_south_africa', 'Mexico'),
    ('thuong', 'mexico_south_africa', 'South Africa'),
    ('tan', 'mexico_south_africa', 'South Africa'),
    ('long', 'mexico_south_africa', 'Mexico'),

    -- South Korea vs Czech Republic / Czechia
    ('huy', 'south_korea_czech', 'South Korea'),
    ('tien', 'south_korea_czech', 'South Korea'),
    ('lam', 'south_korea_czech', 'Czech Republic'),
    ('tai', 'south_korea_czech', 'Czech Republic'),
    ('tang', 'south_korea_czech', 'Czech Republic'),
    ('tuc', 'south_korea_czech', 'South Korea'),
    ('co', 'south_korea_czech', 'South Korea'),
    ('thuong', 'south_korea_czech', 'South Korea'),
    ('tan', 'south_korea_czech', 'South Korea'),
    ('long', 'south_korea_czech', 'Czech Republic'),

    -- Bosnia and Herzegovina vs Canada
    ('huy', 'bosnia_canada', 'Canada'),
    ('tien', 'bosnia_canada', 'Canada'),
    ('lam', 'bosnia_canada', 'Bosnia and Herzegovina'),
    ('tai', 'bosnia_canada', 'Canada'),
    ('tang', 'bosnia_canada', 'Canada'),
    ('tuc', 'bosnia_canada', 'Canada'),
    ('co', 'bosnia_canada', 'Canada'),
    -- Thuong was blank in the sheet for this row; intentionally omitted.
    ('tan', 'bosnia_canada', 'Canada'),
    ('long', 'bosnia_canada', 'Canada'),

    -- Paraguay vs United States
    ('huy', 'paraguay_usa', 'United States'),
    ('tien', 'paraguay_usa', 'United States'),
    ('lam', 'paraguay_usa', 'Paraguay'),
    ('tai', 'paraguay_usa', 'Paraguay'),
    ('tang', 'paraguay_usa', 'Paraguay'),
    ('tuc', 'paraguay_usa', 'United States'),
    ('co', 'paraguay_usa', 'Paraguay'),
    -- Thuong was blank in the sheet for this row; intentionally omitted.
    ('tan', 'paraguay_usa', 'United States'),
    ('long', 'paraguay_usa', 'Paraguay')
),
match_lookup as (
  select
    id,
    case
      when lower(home_team) in ('mexico')
       and lower(away_team) in ('south africa')
        then 'mexico_south_africa'
      when lower(home_team) in ('south korea', 'korea republic', 'republic of korea')
       and lower(away_team) in ('czech republic', 'czechia')
        then 'south_korea_czech'
      when (
        lower(home_team) in ('bosnia and herzegovina', 'bosnia & herzegovina', 'bosnia-herzegovina')
        and lower(away_team) in ('canada')
      ) or (
        lower(home_team) in ('canada')
        and lower(away_team) in ('bosnia and herzegovina', 'bosnia & herzegovina', 'bosnia-herzegovina')
      )
        then 'bosnia_canada'
      when (
        lower(home_team) in ('paraguay')
        and lower(away_team) in ('united states', 'usa', 'united states of america')
      ) or (
        lower(home_team) in ('united states', 'usa', 'united states of america')
        and lower(away_team) in ('paraguay')
      )
        then 'paraguay_usa'
    end as match_key,
    home_team,
    away_team
  from public.matches
),
resolved as (
  select
    p.player_id,
    m.id as match_id,
    case
      when lower(p.picked_team) = lower(m.home_team) then 'HOME'
      when lower(p.picked_team) = lower(m.away_team) then 'AWAY'
      when lower(p.picked_team) = 'czech republic' and lower(m.away_team) = 'czechia' then 'AWAY'
      when lower(p.picked_team) = 'united states' and lower(m.home_team) in ('usa', 'united states of america') then 'HOME'
      when lower(p.picked_team) = 'united states' and lower(m.away_team) in ('usa', 'united states of america') then 'AWAY'
      else null
    end as choice
  from picks p
  join match_lookup m on m.match_key = p.match_key
)
insert into public.predictions (match_id, player_id, choice, updated_at)
select match_id, player_id, choice, now()
from resolved
where choice is not null
on conflict (match_id, player_id) do update set
  choice = excluded.choice,
  updated_at = excluded.updated_at;

-- Optional sanity check: this should return no rows. If it returns rows, team names in public.matches differ from the aliases above.
with picks(player_id, match_key, picked_team) as (
  values
    ('huy', 'mexico_south_africa', 'South Africa'),
    ('tien', 'mexico_south_africa', 'Mexico'),
    ('lam', 'mexico_south_africa', 'South Africa'),
    ('tai', 'mexico_south_africa', 'Mexico'),
    ('tang', 'mexico_south_africa', 'Mexico'),
    ('tuc', 'mexico_south_africa', 'South Africa'),
    ('co', 'mexico_south_africa', 'Mexico'),
    ('thuong', 'mexico_south_africa', 'South Africa'),
    ('tan', 'mexico_south_africa', 'South Africa'),
    ('long', 'mexico_south_africa', 'Mexico'),
    ('huy', 'south_korea_czech', 'South Korea'),
    ('tien', 'south_korea_czech', 'South Korea'),
    ('lam', 'south_korea_czech', 'Czech Republic'),
    ('tai', 'south_korea_czech', 'Czech Republic'),
    ('tang', 'south_korea_czech', 'Czech Republic'),
    ('tuc', 'south_korea_czech', 'South Korea'),
    ('co', 'south_korea_czech', 'South Korea'),
    ('thuong', 'south_korea_czech', 'South Korea'),
    ('tan', 'south_korea_czech', 'South Korea'),
    ('long', 'south_korea_czech', 'Czech Republic'),
    ('huy', 'bosnia_canada', 'Canada'),
    ('tien', 'bosnia_canada', 'Canada'),
    ('lam', 'bosnia_canada', 'Bosnia and Herzegovina'),
    ('tai', 'bosnia_canada', 'Canada'),
    ('tang', 'bosnia_canada', 'Canada'),
    ('tuc', 'bosnia_canada', 'Canada'),
    ('co', 'bosnia_canada', 'Canada'),
    ('tan', 'bosnia_canada', 'Canada'),
    ('long', 'bosnia_canada', 'Canada'),
    ('huy', 'paraguay_usa', 'United States'),
    ('tien', 'paraguay_usa', 'United States'),
    ('lam', 'paraguay_usa', 'Paraguay'),
    ('tai', 'paraguay_usa', 'Paraguay'),
    ('tang', 'paraguay_usa', 'Paraguay'),
    ('tuc', 'paraguay_usa', 'United States'),
    ('co', 'paraguay_usa', 'Paraguay'),
    ('tan', 'paraguay_usa', 'United States'),
    ('long', 'paraguay_usa', 'Paraguay')
),
matched_keys as (
  select distinct case
    when lower(home_team) in ('mexico') and lower(away_team) in ('south africa') then 'mexico_south_africa'
    when lower(home_team) in ('south korea', 'korea republic', 'republic of korea') and lower(away_team) in ('czech republic', 'czechia') then 'south_korea_czech'
    when (
      lower(home_team) in ('bosnia and herzegovina', 'bosnia & herzegovina', 'bosnia-herzegovina') and lower(away_team) in ('canada')
    ) or (
      lower(home_team) in ('canada') and lower(away_team) in ('bosnia and herzegovina', 'bosnia & herzegovina', 'bosnia-herzegovina')
    ) then 'bosnia_canada'
    when (
      lower(home_team) in ('paraguay') and lower(away_team) in ('united states', 'usa', 'united states of america')
    ) or (
      lower(home_team) in ('united states', 'usa', 'united states of america') and lower(away_team) in ('paraguay')
    ) then 'paraguay_usa'
  end as match_key
  from public.matches
)
select distinct p.match_key as missing_match_key
from picks p
left join matched_keys mk on mk.match_key = p.match_key
where mk.match_key is null;
