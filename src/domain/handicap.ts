function formatHandicapSide(value: number): string {
  const whole = Math.floor(value);
  const quarter = Math.round((value - whole) * 4);

  if (quarter === 0) return `${whole}`;
  if (quarter === 1) return whole === 0 ? '1/4' : `${whole} 1/4`;
  if (quarter === 2) return whole === 0 ? '1/2' : `${whole} 1/2`;
  if (quarter === 3) return whole === 0 ? '3/4' : `${whole} 3/4`;

  return `${whole + 1}`;
}

export function formatHandicap(handicap: number): string {
  if (!Number.isFinite(handicap) || handicap === 0) return '0:0';

  const formattedSide = formatHandicapSide(Math.abs(handicap));

  // Left side is always the home team. Positive handicap means home team receives the handicap.
  return handicap > 0 ? `${formattedSide}:0` : `0:${formattedSide}`;
}

function parseHandicapSide(rawSide: string): number {
  const side = rawSide.trim();
  if (!side || side === '0') return 0;

  const mixedMatch = side.match(/^(\d+)\s+(1\/4|1\/2|3\/4)$/);
  if (mixedMatch) {
    return Number(mixedMatch[1]) + parseFraction(mixedMatch[2]);
  }

  if (side.includes('/')) return parseFraction(side);

  const numeric = Number(side.replace(',', '.'));
  if (!Number.isFinite(numeric)) throw new Error('Handicap không hợp lệ');
  return numeric;
}

function parseFraction(fraction: string): number {
  if (fraction === '1/4') return 0.25;
  if (fraction === '1/2') return 0.5;
  if (fraction === '3/4') return 0.75;
  throw new Error('Handicap không hợp lệ');
}

export function parseHandicapInput(input: string): number {
  const normalized = input.trim();
  if (!normalized) throw new Error('Vui lòng nhập kèo chấp');

  if (normalized.includes(':')) {
    const [homeRaw, awayRaw, extra] = normalized.split(':');
    if (extra !== undefined) throw new Error('Kèo chỉ được có một dấu :');

    const home = parseHandicapSide(homeRaw);
    const away = parseHandicapSide(awayRaw);
    if (home > 0 && away > 0) throw new Error('Chỉ một bên được nhận kèo');

    return home - away;
  }

  const decimal = Number(normalized.replace(',', '.'));
  if (!Number.isFinite(decimal)) throw new Error('Handicap không hợp lệ');
  return decimal;
}
