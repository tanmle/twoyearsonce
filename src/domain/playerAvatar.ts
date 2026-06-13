const KIT_COLORS = ['#00F06A', '#38BDF8', '#F97316', '#F43F5E', '#A78BFA', '#FACC15', '#22C55E', '#FB7185'];
const HAIR_COLORS = ['#111827', '#3F2A1D', '#5C4033', '#1F2937'];
const SKIN_COLORS = ['#F2C7A5', '#D9A066', '#B8794A', '#F0B98D'];

function hashName(name: string) {
  return [...name].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7);
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'BC';
}

export function createFootballerAvatar(name: string) {
  const hash = hashName(name);
  const kit = KIT_COLORS[hash % KIT_COLORS.length];
  const hair = HAIR_COLORS[hash % HAIR_COLORS.length];
  const skin = SKIN_COLORS[hash % SKIN_COLORS.length];
  const number = (hash % 99) + 1;
  const label = initials(name);

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96">
  <rect width="96" height="96" fill="#0A1622"/>
  <circle cx="48" cy="48" r="42" fill="#102133" stroke="${kit}" stroke-width="3"/>
  <path d="M27 88V69c0-10 9-18 21-18s21 8 21 18v19H27z" fill="${kit}"/>
  <path d="M35 58l13 9 13-9 8 10-10 20H37L27 68l8-10z" fill="${kit}"/>
  <path d="M39 55l9 12 9-12" fill="#ffffff" opacity="0.9"/>
  <circle cx="48" cy="38" r="17" fill="${skin}"/>
  <path d="M31 36c2-15 13-22 27-17 7 3 10 9 9 17-9-7-22-7-36 0z" fill="${hair}"/>
  <circle cx="41" cy="39" r="2" fill="#111827"/>
  <circle cx="55" cy="39" r="2" fill="#111827"/>
  <path d="M42 47c4 3 8 3 12 0" stroke="#7F1D1D" stroke-width="2" fill="none" stroke-linecap="round"/>
  <text x="48" y="82" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="900" fill="#02090F">${number}</text>
  <text x="48" y="24" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" font-weight="900" fill="#ffffff" opacity="0.9">${label}</text>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
