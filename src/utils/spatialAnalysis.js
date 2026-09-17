import { geoToH3, h3ToGeo, h3ToGeoBoundary } from 'h3-js';

function validLocations(locations) {
  return locations.filter(location => Number.isFinite(Number(location.lon)) && Number.isFinite(Number(location.lat)));
}

function rawUnit(location) {
  return {
    id: location.id,
    name: location.name || location.id,
    lon: Number(location.lon),
    lat: Number(location.lat),
    geometry: null,
  };
}

function gridFactory(locations, gridSizeKm) {
  const meanLat = locations.reduce((sum, item) => sum + Number(item.lat), 0) / Math.max(locations.length, 1);
  const latStep = Math.max(gridSizeKm, 0.1) / 110.574;
  const lonStep = Math.max(gridSizeKm, 0.1) / (111.32 * Math.max(Math.cos(meanLat * Math.PI / 180), 0.1));
  return location => {
    const col = Math.floor((Number(location.lon) + 180) / lonStep);
    const row = Math.floor((Number(location.lat) + 90) / latStep);
    const west = col * lonStep - 180;
    const south = row * latStep - 90;
    return {
      id: `grid:${col}:${row}`,
      name: `网格 ${col}–${row}`,
      lon: west + lonStep / 2,
      lat: south + latStep / 2,
      geometry: { type: 'Polygon', coordinates: [[[west, south], [west + lonStep, south], [west + lonStep, south + latStep], [west, south + latStep], [west, south]]] },
    };
  };
}

function h3Unit(location, resolution) {
  const id = geoToH3(Number(location.lat), Number(location.lon), resolution);
  const [lat, lon] = h3ToGeo(id);
  const polygon = h3ToGeoBoundary(id).map(([boundaryLat, boundaryLon]) => [boundaryLon, boundaryLat]);
  polygon.push(polygon[0]);
  return { id, name: `H3 ${id.slice(-7)}`, lon, lat, geometry: { type: 'Polygon', coordinates: [polygon] } };
}

function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersects = ((yi > lat) !== (yj > lat)) && (lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

export function pointInPolygonCoordinates(lon, lat, coordinates) {
  if (!coordinates.length || !pointInRing(lon, lat, coordinates[0])) return false;
  return !coordinates.slice(1).some(hole => pointInRing(lon, lat, hole));
}

export function locationIdsInGeometry(locations, geometry) {
  if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) return new Set();
  const points = flattenCoordinates(geometry.coordinates);
  const bounds = points.reduce((bbox, [lon, lat]) => [
    Math.min(bbox[0], lon), Math.min(bbox[1], lat),
    Math.max(bbox[2], lon), Math.max(bbox[3], lat),
  ], [Infinity, Infinity, -Infinity, -Infinity]);
  const ids = new Set();
  locations.forEach(location => {
    const lon = Number(location.lon);
    const lat = Number(location.lat);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
    if (lon < bounds[0] || lon > bounds[2] || lat < bounds[1] || lat > bounds[3]) return;
    const inside = geometry.type === 'Polygon'
      ? pointInPolygonCoordinates(lon, lat, geometry.coordinates)
      : geometry.coordinates.some(polygon => pointInPolygonCoordinates(lon, lat, polygon));
    if (inside) ids.add(location.id);
  });
  return ids;
}

export function selectFlowsForLocationIds(flows, locationIds, role = 'origin') {
  if (!locationIds?.size) return [];
  return flows.filter(flow => {
    const originInside = locationIds.has(flow.origin);
    const destinationInside = locationIds.has(flow.dest);
    if (role === 'origin') return originInside;
    if (role === 'destination') return destinationInside;
    return originInside || destinationInside;
  });
}

function flattenCoordinates(coordinates, output = []) {
  if (typeof coordinates?.[0] === 'number') output.push(coordinates);
  else coordinates?.forEach(item => flattenCoordinates(item, output));
  return output;
}

function polygonFactory(geojson) {
  const regions = (geojson?.features || []).map((feature, index) => {
    const points = flattenCoordinates(feature.geometry?.coordinates || []);
    if (!points.length || !['Polygon', 'MultiPolygon'].includes(feature.geometry?.type)) return null;
    const bbox = points.reduce((bounds, [lon, lat]) => [
      Math.min(bounds[0], lon), Math.min(bounds[1], lat),
      Math.max(bounds[2], lon), Math.max(bounds[3], lat),
    ], [Infinity, Infinity, -Infinity, -Infinity]);
    const id = String(feature.properties?.id ?? feature.properties?.ID ?? feature.properties?.code ?? feature.properties?.CODE ?? `region-${index + 1}`);
    return {
      id: `region:${id}`,
      name: feature.properties?.name || feature.properties?.NAME || feature.properties?.['名称'] || `区域 ${index + 1}`,
      lon: (bbox[0] + bbox[2]) / 2,
      lat: (bbox[1] + bbox[3]) / 2,
      geometry: feature.geometry,
      bbox,
    };
  }).filter(Boolean);

  return location => {
    const lon = Number(location.lon);
    const lat = Number(location.lat);
    return regions.find(region => {
      if (lon < region.bbox[0] || lon > region.bbox[2] || lat < region.bbox[1] || lat > region.bbox[3]) return false;
      if (region.geometry.type === 'Polygon') return pointInPolygonCoordinates(lon, lat, region.geometry.coordinates);
      return region.geometry.coordinates.some(polygon => pointInPolygonCoordinates(lon, lat, polygon));
    });
  };
}

export function buildSpatialAnalysis(locations, flows, options = {}) {
  const sourceLocations = validLocations(locations);
  const spatialUnit = options.spatialUnit || 'raw';
  const makeUnit = spatialUnit === 'grid'
    ? gridFactory(sourceLocations, Number(options.gridSizeKm) || 1)
    : spatialUnit === 'h3'
      ? location => h3Unit(location, Number(options.h3Resolution) || 8)
      : spatialUnit === 'polygon'
        ? polygonFactory(options.polygonGeoJSON)
      : rawUnit;

  const unitBySourceId = new Map();
  const unitMap = new Map();
  sourceLocations.forEach(location => {
    const unit = makeUnit(location);
    if (!unit) return;
    unitBySourceId.set(location.id, unit.id);
    if (!unitMap.has(unit.id)) unitMap.set(unit.id, { ...unit, incoming: 0, outgoing: 0, members: 0 });
    unitMap.get(unit.id).members += 1;
  });

  const flowMap = new Map();
  flows.forEach(flow => {
    const origin = unitBySourceId.get(flow.origin);
    const dest = unitBySourceId.get(flow.dest);
    const count = Number(flow.count) || 0;
    if (!origin || !dest || count <= 0) return;
    const key = `${origin}\u0000${dest}`;
    if (!flowMap.has(key)) flowMap.set(key, { origin, dest, count: 0 });
    flowMap.get(key).count += count;
  });

  const aggregatedFlows = Array.from(flowMap.values());
  const outgoingIndex = new Map();
  const incomingIndex = new Map();
  aggregatedFlows.forEach(flow => {
    const originUnit = unitMap.get(flow.origin);
    const destUnit = unitMap.get(flow.dest);
    originUnit.outgoing += flow.count;
    destUnit.incoming += flow.count;
    if (!outgoingIndex.has(flow.origin)) outgoingIndex.set(flow.origin, []);
    if (!incomingIndex.has(flow.dest)) incomingIndex.set(flow.dest, []);
    outgoingIndex.get(flow.origin).push(flow);
    incomingIndex.get(flow.dest).push(flow);
  });

  const aggregatedLocations = Array.from(unitMap.values()).map(unit => ({ ...unit, count: unit.incoming + unit.outgoing }));
  const boundaries = {
    type: 'FeatureCollection',
    features: aggregatedLocations.filter(unit => unit.geometry).map(unit => ({
      type: 'Feature',
      properties: { id: unit.id, name: unit.name, incoming: unit.incoming, outgoing: unit.outgoing },
      geometry: unit.geometry,
    })),
  };

  return { locations: aggregatedLocations, flows: aggregatedFlows, boundaries, outgoingIndex, incomingIndex, unitMap };
}

export function selectRelatedFlows(analysis, selectedId, role = 'origin') {
  if (!selectedId) return [];
  if (role === 'origin') return analysis.outgoingIndex.get(selectedId) || [];
  if (role === 'destination') return analysis.incomingIndex.get(selectedId) || [];
  const union = new Map();
  [...(analysis.outgoingIndex.get(selectedId) || []), ...(analysis.incomingIndex.get(selectedId) || [])]
    .forEach(flow => union.set(`${flow.origin}\u0000${flow.dest}`, flow));
  return Array.from(union.values());
}
