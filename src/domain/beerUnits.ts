const VND_PER_BEER = 1000;

export function formatBeerUnits(vnd: number) {
  const beers = vnd / VND_PER_BEER;
  const formatted = Number.isInteger(beers)
    ? beers.toLocaleString('vi-VN')
    : beers.toLocaleString('vi-VN', { maximumFractionDigits: 1 });

  return `${formatted} 🍺`;
}
