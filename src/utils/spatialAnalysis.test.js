import { buildSpatialAnalysis, locationIdsInGeometry, selectFlowsForLocationIds, selectRelatedFlows } from './spatialAnalysis';

const locations = [
  { id: 'a', lon: 113.9001, lat: 22.5001 },
  { id: 'b', lon: 113.9002, lat: 22.5002 },
  { id: 'c', lon: 114.05, lat: 22.62 },
];
const flows = [{ origin: 'a', dest: 'c', count: 3 }, { origin: 'b', dest: 'c', count: 4 }, { origin: 'c', dest: 'a', count: 2 }];

test('aggregates locations and flows into square-grid units', () => {
  const result = buildSpatialAnalysis(locations, flows, { spatialUnit: 'grid', gridSizeKm: 1 });
  expect(result.locations).toHaveLength(2);
  expect(result.flows).toHaveLength(2);
  expect(result.flows.reduce((sum, flow) => sum + flow.count, 0)).toBe(9);
  expect(result.boundaries.features).toHaveLength(2);
});

test('builds fast outgoing, incoming and bidirectional selections', () => {
  const result = buildSpatialAnalysis(locations, flows, { spatialUnit: 'raw' });
  expect(selectRelatedFlows(result, 'a', 'origin')).toHaveLength(1);
  expect(selectRelatedFlows(result, 'a', 'destination')).toHaveLength(1);
  expect(selectRelatedFlows(result, 'a', 'both')).toHaveLength(2);
});

test('aggregates point locations into selectable H3 polygons', () => {
  const result = buildSpatialAnalysis(locations, flows, { spatialUnit: 'h3', h3Resolution: 7 });
  expect(result.locations.length).toBeGreaterThan(0);
  expect(result.boundaries.features).toHaveLength(result.locations.length);
  expect(result.boundaries.features[0].geometry.type).toBe('Polygon');
});

test('spatially joins locations into imported polygon regions', () => {
  const polygonGeoJSON = { type: 'FeatureCollection', features: [
    { type: 'Feature', properties: { id: 'west', name: '西区' }, geometry: { type: 'Polygon', coordinates: [[[113.8, 22.4], [114, 22.4], [114, 22.7], [113.8, 22.7], [113.8, 22.4]]] } },
    { type: 'Feature', properties: { id: 'east', name: '东区' }, geometry: { type: 'Polygon', coordinates: [[[114, 22.4], [114.2, 22.4], [114.2, 22.7], [114, 22.7], [114, 22.4]]] } },
  ] };
  const result = buildSpatialAnalysis(locations, flows, { spatialUnit: 'polygon', polygonGeoJSON });
  expect(result.locations.map(item => item.name).sort()).toEqual(['东区', '西区']);
  expect(result.flows.reduce((sum, flow) => sum + flow.count, 0)).toBe(9);
});

test('selects raw OD flows related to a user-drawn area', () => {
  const geometry = { type: 'Polygon', coordinates: [[[113.8, 22.4], [114, 22.4], [114, 22.7], [113.8, 22.7], [113.8, 22.4]]] };
  const ids = locationIdsInGeometry(locations, geometry);
  expect(Array.from(ids).sort()).toEqual(['a', 'b']);
  expect(selectFlowsForLocationIds(flows, ids, 'origin').reduce((sum, flow) => sum + flow.count, 0)).toBe(7);
  expect(selectFlowsForLocationIds(flows, ids, 'destination').reduce((sum, flow) => sum + flow.count, 0)).toBe(2);
  expect(selectFlowsForLocationIds(flows, ids, 'both')).toHaveLength(3);
});
