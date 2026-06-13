import { Match } from '../types';

const STAGE_LABELS: Record<string, string> = {
  r32: 'VÒNG 32 ĐỘI',
  round32: 'VÒNG 32 ĐỘI',
  round_of_32: 'VÒNG 32 ĐỘI',
  'round of 32': 'VÒNG 32 ĐỘI',
  r16: 'VÒNG 16 ĐỘI',
  round16: 'VÒNG 16 ĐỘI',
  round_of_16: 'VÒNG 16 ĐỘI',
  'round of 16': 'VÒNG 16 ĐỘI',
  qf: 'TỨ KẾT',
  quarterfinal: 'TỨ KẾT',
  quarter_final: 'TỨ KẾT',
  'quarter final': 'TỨ KẾT',
  sf: 'BÁN KẾT',
  semifinal: 'BÁN KẾT',
  semi_final: 'BÁN KẾT',
  'semi final': 'BÁN KẾT',
  '3rd': 'TRANH HẠNG BA',
  third_place: 'TRANH HẠNG BA',
  'third place': 'TRANH HẠNG BA',
  f: 'CHUNG KẾT',
  final: 'CHUNG KẾT',
};

function formatStageType(rawType: string) {
  const normalized = rawType.toLowerCase().replace(/[\s-]+/g, '_');
  return STAGE_LABELS[normalized] ?? STAGE_LABELS[rawType.toLowerCase()] ?? rawType.toUpperCase();
}

export function formatMatchStage(match: Match) {
  const rawType = match.matchType?.trim();
  if (rawType && rawType.toLowerCase() !== 'group') return formatStageType(rawType);

  const rawGroup = match.matchGroup?.trim();
  if (rawGroup) {
    return /^[A-L]$/i.test(rawGroup) ? `BẢNG ${rawGroup.toUpperCase()}` : formatStageType(rawGroup);
  }

  return match.league;
}
