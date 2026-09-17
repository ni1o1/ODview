import { detectODColumns } from './detectODColumns';

const preview = [
  { startLongitude: '113.91', startLatitude: '22.51', endLongitude: '114.08', endLatitude: '22.62', LONCOL: '42', LATCOL: '18', trips: '12' },
];

test('ignores grid column IDs and detects verbose start/end coordinates', () => {
  expect(detectODColumns(Object.keys(preview[0]), preview)).toEqual({
    SLON: 'startLongitude', SLAT: 'startLatitude', ELON: 'endLongitude', ELAT: 'endLatitude', COUNT: 'trips',
  });
});

test('detects origin and destination abbreviations', () => {
  const columns = ['origin_lng', 'origin_lat', 'dest_lng', 'dest_lat', 'volume'];
  expect(detectODColumns(columns, [])).toEqual({
    SLON: 'origin_lng', SLAT: 'origin_lat', ELON: 'dest_lng', ELAT: 'dest_lat', COUNT: 'volume',
  });
});

test('detects compact s/e column names used by the demo data', () => {
  const columns = ['SHBLON', 'SHBLAT', 'EHBLON', 'EHBLAT', 'count'];
  expect(detectODColumns(columns, [])).toEqual({
    SLON: 'SHBLON', SLAT: 'SHBLAT', ELON: 'EHBLON', ELAT: 'EHBLAT', COUNT: 'count',
  });
});

test('uses coordinate order when two generic pairs have no role names', () => {
  const columns = ['Longitude', 'Latitude', 'Longitude_2', 'Latitude_2'];
  expect(detectODColumns(columns, [])).toEqual({
    SLON: 'Longitude', SLAT: 'Latitude', ELON: 'Longitude_2', ELAT: 'Latitude_2', COUNT: '=1',
  });
});

test('does not guess grid indices as coordinates', () => {
  const columns = ['LONCOL', 'LATCOL', 'grid_count'];
  expect(detectODColumns(columns, [])).toEqual({
    SLON: undefined, SLAT: undefined, ELON: undefined, ELAT: undefined, COUNT: '=1',
  });
});
