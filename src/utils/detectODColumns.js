const GRID_NAME_PATTERN = /(loncol|latcol|grid|cell|mesh|geohash|row(?:id|no|num|index)?|col(?:umn)?(?:id|no|num|index)?|网格|栅格|行号|列号)/i;

const AXIS_PATTERNS = {
  lon: /(longitude|lng|lon|经度)/i,
  lat: /(latitude|lat|纬度)/i,
};

const ROLE_WORDS = {
  start: ['start', 'origin', 'orig', 'source', 'from', 'pickup', 'begin', 'departure', '起点', '起始', '出发'],
  end: ['end', 'destination', 'dest', 'target', 'to', 'dropoff', 'arrival', '终点', '目的', '到达'],
};

function normalizeName(name) {
  return String(name)
    .replace(/([a-z\d])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .replace(/[^a-z\d\u4e00-\u9fff]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function valuesFor(column, preview) {
  return preview.map(row => row[column]).filter(value => value !== '' && value !== null && value !== undefined);
}

function coordinateQuality(column, axis, preview) {
  const values = valuesFor(column, preview);
  if (!values.length) return 0;
  const numbers = values.map(Number).filter(Number.isFinite);
  if (!numbers.length) return -12;
  const limit = axis === 'lat' ? 90 : 180;
  const numericRatio = numbers.length / values.length;
  const rangeRatio = numbers.filter(value => Math.abs(value) <= limit).length / numbers.length;
  return numericRatio * 5 + rangeRatio * 8;
}

function roleScore(normalized, role, axis) {
  const compact = normalized.replace(/_/g, '');
  const ownWords = ROLE_WORDS[role];
  const otherWords = ROLE_WORDS[role === 'start' ? 'end' : 'start'];
  let score = 0;
  if (ownWords.some(word => normalized.includes(word))) score += 34;
  if (otherWords.some(word => normalized.includes(word))) score -= 42;

  const axisSuffix = axis === 'lon' ? '(?:longitude|lng|lon|经度)' : '(?:latitude|lat|纬度)';
  const shortPrefix = role === 'start' ? '[so]' : '[ed]';
  if (new RegExp(`^${shortPrefix}${axisSuffix}$`, 'i').test(compact)) score += 38;
  else if (new RegExp(`^${shortPrefix}.+${axisSuffix}$`, 'i').test(compact)) score += 22;

  const tokens = normalized.split('_');
  if (tokens.includes(role === 'start' ? 's' : 'e')) score += 25;
  if (tokens.includes(role === 'start' ? 'o' : 'd')) score += 18;
  return score;
}

function axisScore(column, axis, preview) {
  const normalized = normalizeName(column);
  const compact = normalized.replace(/_/g, '');
  if (GRID_NAME_PATTERN.test(compact) || GRID_NAME_PATTERN.test(normalized)) return -Infinity;
  if (!AXIS_PATTERNS[axis].test(normalized)) return -Infinity;
  const exactAliases = axis === 'lon' ? ['lon', 'lng', 'longitude', '经度'] : ['lat', 'latitude', '纬度'];
  const exact = exactAliases.includes(normalized) ? 18 : 12;
  return exact + coordinateQuality(column, axis, preview);
}

function pickCoordinatePair(columns, preview, axis) {
  const candidates = columns
    .map((column, index) => ({
      column,
      index,
      base: axisScore(column, axis, preview),
      normalized: normalizeName(column),
    }))
    .filter(candidate => Number.isFinite(candidate.base));

  if (!candidates.length) return { start: undefined, end: undefined };
  if (candidates.length === 1) return { start: candidates[0].column, end: undefined };

  let best;
  candidates.forEach(start => {
    candidates.forEach(end => {
      if (start.column === end.column) return;
      const score = start.base + end.base
        + roleScore(start.normalized, 'start', axis)
        + roleScore(end.normalized, 'end', axis)
        + (end.index > start.index ? 3 : 0);
      if (!best || score > best.score) best = { start: start.column, end: end.column, score };
    });
  });
  return best || { start: undefined, end: undefined };
}

function pickCount(columns, preview) {
  const aliases = /(count|volume|weight|magnitude|frequency|freq|trips?|flow|amount|数量|流量|次数)/i;
  const candidates = columns.map((column, index) => {
    const normalized = normalizeName(column);
    if (GRID_NAME_PATTERN.test(normalized)) return { column, score: -Infinity };
    const nameScore = aliases.test(normalized) ? 30 : 0;
    const values = valuesFor(column, preview);
    const numericRatio = values.length ? values.filter(value => Number.isFinite(Number(value))).length / values.length : 0;
    return { column, index, score: nameScore + numericRatio * 5 };
  }).filter(candidate => candidate.score >= 30).sort((a, b) => b.score - a.score || a.index - b.index);
  return candidates[0]?.column || '=1';
}

export function detectODColumns(columns, preview = []) {
  const longitude = pickCoordinatePair(columns, preview, 'lon');
  const latitude = pickCoordinatePair(columns, preview, 'lat');
  return {
    SLON: longitude.start,
    SLAT: latitude.start,
    ELON: longitude.end,
    ELAT: latitude.end,
    COUNT: pickCount(columns, preview),
  };
}

export { normalizeName };
