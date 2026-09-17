/* global globalThis */
let parsedRows = [];
let parsedColumns = [];

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const length = text.length;
  for (let i = 0; i < length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field.trim()); field = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field.trim()); field = '';
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
    } else field += char;
    if (i > 0 && i % 1000000 === 0) globalThis.postMessage({ type: 'progress', progress: Math.round((i / length) * 70) });
  }
  row.push(field.trim());
  if (row.some(value => value !== '')) rows.push(row);
  return rows;
}

function hasHeader(firstRow) {
  return firstRow.some(value => value !== '' && Number.isNaN(Number(value)));
}

function uniqueColumnNames(columns) {
  const seen = new Map();
  return columns.map((column, index) => {
    const base = column || `column${index + 1}`;
    const count = seen.get(base) || 0;
    seen.set(base, count + 1);
    return count ? `${base}_${count + 1}` : base;
  });
}

function parseFile(file) {
  const text = new globalThis.FileReaderSync().readAsText(file);
  const rows = parseCSV(text.replace(/^\uFEFF/, ''));
  if (!rows.length) throw new Error('文件中没有可读取的数据');
  const header = hasHeader(rows[0]);
  parsedColumns = uniqueColumnNames(header ? rows.shift() : rows[0].map((_, index) => `column${index + 1}`));
  parsedRows = rows;
  const preview = parsedRows.slice(0, 100).map((values, rowIndex) => {
    const item = { __rowKey: rowIndex };
    parsedColumns.forEach((column, index) => { item[column] = values[index] ?? ''; });
    return item;
  });
  globalThis.postMessage({ type: 'parsed', columns: parsedColumns, preview, rowCount: parsedRows.length });
}

function buildOD(field) {
  const indexes = {};
  Object.keys(field).forEach(key => { indexes[key] = field[key] === '=1' ? -1 : parsedColumns.indexOf(field[key]); });
  const locationTotals = new Map();
  const flowTotals = new Map();
  let invalidRows = 0;
  parsedRows.forEach((row, index) => {
    const slon = Number(row[indexes.SLON]);
    const slat = Number(row[indexes.SLAT]);
    const elon = Number(row[indexes.ELON]);
    const elat = Number(row[indexes.ELAT]);
    const count = indexes.COUNT === -1 ? 1 : Number(row[indexes.COUNT]);
    if (![slon, slat, elon, elat, count].every(Number.isFinite)) { invalidRows += 1; return; }
    const origin = `${slon},${slat}`;
    const dest = `${elon},${elat}`;
    const flowKey = `${origin}\u0000${dest}`;
    locationTotals.set(origin, (locationTotals.get(origin) || 0) + count);
    locationTotals.set(dest, (locationTotals.get(dest) || 0) + count);
    flowTotals.set(flowKey, (flowTotals.get(flowKey) || 0) + count);
    if (index > 0 && index % 10000 === 0) globalThis.postMessage({ type: 'progress', progress: 70 + Math.round((index / parsedRows.length) * 25) });
  });
  const locations = Array.from(locationTotals, ([id, count]) => {
    const separator = id.indexOf(',');
    return { id, count, lon: Number(id.slice(0, separator)), lat: Number(id.slice(separator + 1)) };
  });
  const flows = Array.from(flowTotals, ([key, count]) => {
    const [origin, dest] = key.split('\u0000');
    return { origin, dest, count };
  });
  globalThis.postMessage({ type: 'processed', locations, flows, invalidRows, sourceRowCount: parsedRows.length });
}

globalThis.onmessage = event => {
  try {
    if (event.data.type === 'parse') parseFile(event.data.file);
    if (event.data.type === 'process') buildOD(event.data.field);
  } catch (error) {
    globalThis.postMessage({ type: 'error', message: error.message || '数据处理失败' });
  }
};
