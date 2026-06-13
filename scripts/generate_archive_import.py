import csv
import re
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path

VN_TZ = timezone(timedelta(hours=7))
NAMESPACE = uuid.UUID('8a32be8f-0d6f-4d3a-92f0-8cf7beerc026'.replace('beer', 'beef'))
FALLBACK_AVATAR_BG = '00F06A'

TEAM_ALIASES = {
    'Anh': 'England',
    'Ba Lan': 'Poland',
    'Bỉ': 'Belgium',
    'Bồ Đào Nha': 'Portugal',
    'CH Séc': 'Czech Republic',
    'Hà Lan': 'Netherlands',
    'Hàn Quốc': 'South Korea',
    'Ma-rốc': 'Morocco',
    'Mỹ': 'United States',
    'Nhật': 'Japan',
    'Nhật Bản': 'Japan',
    'Pháp': 'France',
    'Saudi Arabia': 'Saudi Arabia',
    'Tây Ban Nha': 'Spain',
    'Thuỵ Sĩ': 'Switzerland',
    'Thổ Nhĩ Kỳ': 'Turkey',
    'Ukraine': 'Ukraine',
    'Úc': 'Australia',
    'Ý': 'Italy',
    'Áo': 'Austria',
    'Đan Mạch': 'Denmark',
    'Đức': 'Germany',
    # Already-English or acceptable canonical names
    'Albania': 'Albania',
    'Argentina': 'Argentina',
    'Brazil': 'Brazil',
    'Cameroon': 'Cameroon',
    'Canada': 'Canada',
    'Costa Rica': 'Costa Rica',
    'Croatia': 'Croatia',
    'Ecuador': 'Ecuador',
    'Georgia': 'Georgia',
    'Ghana': 'Ghana',
    'Hungary': 'Hungary',
    'Iran': 'Iran',
    'Mexico': 'Mexico',
    'Qatar': 'Qatar',
    'Romania': 'Romania',
    'Scotland': 'Scotland',
    'Senegal': 'Senegal',
    'Serbia': 'Serbia',
    'Slovakia': 'Slovakia',
    'Slovenia': 'Slovenia',
    'Tunisia': 'Tunisia',
    'Uruguay': 'Uruguay',
    'Wales': 'Wales',
}

PLAYER_IDS = {
    'Huy': 'huy',
    'Tiến': 'tien',
    'Lâm': 'lam',
    'Tài': 'tai',
    'Tăng': 'tang',
    'Túc': 'tuc',
    'Cợ': 'co',
    'Thương': 'thuong',
    'Tân': 'tan',
    'Long': 'long',
}

OUTCOME_TO_SETTLEMENT = {
    'NOT LOSE': ('WIN', 0, False),
    'LOSE 1/2': ('LOSE_HALF', 5000, False),
    'LOSE': ('LOSE', 10000, False),
    'LOSE 2': ('LOSE_DOUBLE', 20000, True),
    'NOT LOSE 2': ('WIN', -10000, True),
}

COMPETITIONS = [
    {
        'id': 'euro-2024',
        'name': 'Euro 2024',
        'year': 2024,
        'csv': 'Euro 2024 - Schedule.csv',
        'sql': 'supabase/archive_euro_2024.sql',
        'prefix': 'euro2024',
        'league': 'EURO',
    },
    {
        'id': 'worldcup-2022',
        'name': 'World Cup 2022',
        'year': 2022,
        'csv': 'World Cup 2022 - Schedule.csv',
        'sql': 'supabase/archive_worldcup_2022.sql',
        'prefix': 'wc2022',
        'league': 'WORLD CUP',
    },
]


def sql(value):
    if value is None:
        return 'null'
    if isinstance(value, bool):
        return 'true' if value else 'false'
    if isinstance(value, (int, float)):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def clean_player_name(raw):
    return re.sub(r'^\d+\.\s*o?\s*', '', raw.strip()).strip()


def canonical_team(name):
    name = (name or '').strip()
    return TEAM_ALIASES.get(name, name)


def slug_date_display(raw_date):
    dt = datetime.strptime(raw_date.strip(), '%m/%d/%Y')
    return dt.strftime('%-d %b %Y') if hasattr(dt, 'strftime') else dt.strftime('%d %b %Y')


def parse_datetime(raw_date, raw_time):
    raw_time = raw_time.strip()
    if raw_time.count(':') == 2:
        fmt = '%m/%d/%Y %H:%M:%S'
    else:
        fmt = '%m/%d/%Y %H:%M'
    dt = datetime.strptime(f'{raw_date.strip()} {raw_time}', fmt).replace(tzinfo=VN_TZ)
    return dt


def known_missing_datetime(competition_id, match_number):
    known = {
        ('worldcup-2022', 63): ('12/17/2022', '22:00:00'),
        ('worldcup-2022', 64): ('12/18/2022', '22:00:00'),
    }
    return known.get((competition_id, match_number))


def format_time(raw_time):
    raw_time = raw_time.strip()
    dt = datetime.strptime(raw_time, '%H:%M:%S' if raw_time.count(':') == 2 else '%H:%M')
    return dt.strftime('%H:%M')


def to_float(raw):
    raw = (raw or '').strip()
    if raw == '':
        return 0.0
    return float(raw)


def to_int(raw):
    return int(float(raw.strip()))


def logo_for(team):
    return f'https://ui-avatars.com/api/?name={team.replace(" ", "+")}&background=0A1622&color=00F06A&bold=true&format=svg'


def deterministic_uuid(*parts):
    return str(uuid.uuid5(NAMESPACE, ':'.join(str(part) for part in parts)))


def parse_competition(config):
    path = Path(config['csv'])
    data = list(csv.reader(path.open(newline='', encoding='utf-8-sig')))

    player_cols = []
    for c in range(14, min(len(data[9]), 80), 2):
        name = clean_player_name(data[8][c] if c < len(data[8]) else '')
        if name:
            if name not in PLAYER_IDS:
                raise ValueError(f'Unknown player {name!r} in {path}')
            player_cols.append((name, PLAYER_IDS[name], c, c + 1))

    matches = []
    predictions = []
    settlements = []
    warnings = []

    for row_index, row in enumerate(data[10:], start=11):
        if len(row) < 14 or not row[1].strip().isdigit():
            continue
        if not row[5].strip() or not row[8].strip():
            warnings.append(f'skip empty match row {row_index} no={row[1].strip()}')
            continue

        number = int(row[1].strip())
        home_raw = row[5].strip()
        away_raw = row[8].strip()
        home = canonical_team(home_raw)
        away = canonical_team(away_raw)
        home_goals = to_int(row[6])
        away_goals = to_int(row[7])
        handicap = to_float(row[9]) - to_float(row[10])
        group_raw = row[4].strip()
        is_group = bool(re.fullmatch(r'[A-L]', group_raw))
        match_type = 'group' if is_group else group_raw.lower()
        match_group = group_raw if is_group else None
        raw_date = row[2].strip()
        raw_time = row[3].strip()
        if not raw_date or not raw_time:
            fallback_datetime = known_missing_datetime(config['id'], number)
            if not fallback_datetime:
                warnings.append(f'skip missing datetime row {row_index} no={number}')
                continue
            raw_date, raw_time = fallback_datetime
            warnings.append(f'filled missing datetime row {row_index} match {number}: {raw_date} {raw_time}')

        kickoff = parse_datetime(raw_date, raw_time)
        match_id = f'{config["prefix"]}_{number:03d}'

        matches.append({
            'id': match_id,
            'external_id': f'{config["prefix"]}_{number}',
            'competition_id': config['id'],
            'league': config['league'],
            'home_team': home,
            'away_team': away,
            'home_logo': logo_for(home),
            'away_logo': logo_for(away),
            'handicap': handicap,
            'handicap_is_manual': True,
            'kickoff_at': kickoff.isoformat(),
            'display_time': format_time(raw_time),
            'display_date': kickoff.strftime('%d %b %Y').lstrip('0'),
            'stadium': config['name'],
            'status': 'FINISHED',
            'home_goals': home_goals,
            'away_goals': away_goals,
            'home_scorers': '{}',
            'away_scorers': '{}',
            'live_time_text': None,
            'is_hot': False,
            'last_synced_at': 'now()',
            'odds_updated_at': None,
            'match_type': match_type,
            'match_group': match_group,
        })

        for player_name, player_id, selection_col, result_col in player_cols:
            selection_raw = row[selection_col].strip() if selection_col < len(row) else ''
            result_raw = row[result_col].strip() if result_col < len(row) else ''
            if not result_raw:
                warnings.append(f'missing result row {row_index} match {number} player {player_name}')
                continue
            if result_raw not in OUTCOME_TO_SETTLEMENT:
                raise ValueError(f'Unknown result {result_raw!r} row {row_index} match {number} player {player_name}')

            selection = canonical_team(selection_raw) if selection_raw else home
            if selection not in (home, away):
                if selection_raw == 'Slovenia' and home == 'Slovakia':
                    selection = home
                    warnings.append(f'fixed typo row {row_index} match {number} player {player_name}: Slovenia -> Slovakia')
                else:
                    warnings.append(f'unknown selection row {row_index} match {number} player {player_name}: {selection_raw!r} -> {selection!r}; default HOME')
                    selection = home

            choice = 'HOME' if selection == home else 'AWAY'
            status, penalty_vnd, hope_star = OUTCOME_TO_SETTLEMENT[result_raw]
            prediction_id = deterministic_uuid(config['id'], match_id, player_id)

            predictions.append({
                'id': prediction_id,
                'competition_id': config['id'],
                'match_id': match_id,
                'player_id': player_id,
                'choice': choice,
                'hope_star': hope_star,
            })
            settlements.append({
                'id': deterministic_uuid('settlement', config['id'], match_id, player_id),
                'competition_id': config['id'],
                'match_id': match_id,
                'player_id': player_id,
                'prediction_id': prediction_id,
                'status': status,
                'penalty_vnd': penalty_vnd,
            })

    return player_cols, matches, predictions, settlements, warnings


def values_block(rows, columns):
    lines = []
    for row in rows:
        values = []
        for column in columns:
            value = row[column]
            if value == 'now()':
                values.append('now()')
            else:
                values.append(sql(value))
        lines.append('  (' + ', '.join(values) + ')')
    return ',\n'.join(lines)


def write_sql(config, player_cols, matches, predictions, settlements, warnings):
    out = []
    out.append(f"-- Archive import for {config['name']}. Generated by scripts/generate_archive_import.py")
    out.append('-- Run after supabase/schema.sql and supabase/seed_players.sql.')
    out.append('')
    out.append('begin;')
    out.append('')
    out.append('insert into public.competitions (id, name, year, status) values')
    out.append(f"  ({sql(config['id'])}, {sql(config['name'])}, {config['year']}, 'archived')")
    out.append('on conflict (id) do update set name = excluded.name, year = excluded.year, status = excluded.status;')
    out.append('')

    match_cols = ['id','external_id','competition_id','league','home_team','away_team','home_logo','away_logo','handicap','handicap_is_manual','kickoff_at','display_time','display_date','stadium','status','home_goals','away_goals','home_scorers','away_scorers','live_time_text','is_hot','last_synced_at','odds_updated_at','match_type','match_group']
    out.append('insert into public.matches (' + ', '.join(match_cols) + ') values')
    out.append(values_block(matches, match_cols))
    out.append('on conflict (id) do update set')
    out.append(',\n'.join(f'  {col} = excluded.{col}' for col in match_cols if col != 'id') + ';')
    out.append('')

    prediction_cols = ['id','competition_id','match_id','player_id','choice','hope_star']
    out.append('insert into public.predictions (' + ', '.join(prediction_cols) + ') values')
    out.append(values_block(predictions, prediction_cols))
    out.append('on conflict (match_id, player_id) do update set')
    out.append('  id = excluded.id,\n  competition_id = excluded.competition_id,\n  choice = excluded.choice,\n  hope_star = excluded.hope_star,\n  updated_at = now();')
    out.append('')

    settlement_cols = ['id','competition_id','match_id','player_id','prediction_id','status','penalty_vnd']
    out.append('insert into public.settlements (' + ', '.join(settlement_cols) + ') values')
    out.append(values_block(settlements, settlement_cols))
    out.append('on conflict (prediction_id) do update set')
    out.append('  competition_id = excluded.competition_id,\n  match_id = excluded.match_id,\n  player_id = excluded.player_id,\n  status = excluded.status,\n  penalty_vnd = excluded.penalty_vnd,\n  settled_at = now();')
    out.append('')
    out.append('commit;')
    out.append('')
    if warnings:
        out.append('-- Warnings:')
        for warning in warnings:
            out.append(f'-- - {warning}')

    Path(config['sql']).write_text('\n'.join(out), encoding='utf-8')


def main():
    for config in COMPETITIONS:
        player_cols, matches, predictions, settlements, warnings = parse_competition(config)
        write_sql(config, player_cols, matches, predictions, settlements, warnings)
        totals = {}
        for settlement in settlements:
            totals[settlement['player_id']] = totals.get(settlement['player_id'], 0) + settlement['penalty_vnd']
        print(f"{config['name']}: {len(matches)} matches, {len(predictions)} predictions, {len(settlements)} settlements")
        print('players:', ', '.join(name for name, _, _, _ in player_cols))
        print('beer totals:', {player: total // 1000 for player, total in sorted(totals.items())})
        if warnings:
            print('warnings:')
            for warning in warnings[:20]:
                print(' -', warning)
            if len(warnings) > 20:
                print(f' - ... {len(warnings) - 20} more')


if __name__ == '__main__':
    main()
