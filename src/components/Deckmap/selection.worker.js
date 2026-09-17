/* global globalThis */
let sourceLocations = [];
let sourceFlows = [];
let outgoingIndex = new Map();
let incomingIndex = new Map();

function pointInRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (((yi > lat) !== (yj > lat)) && (lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

function pointInPolygon(lon, lat, coordinates) {
  return coordinates.length > 0 && pointInRing(lon, lat, coordinates[0])
    && !coordinates.slice(1).some(hole => pointInRing(lon, lat, hole));
}

function flatten(coordinates, output = []) {
  if (typeof coordinates?.[0] === 'number') output.push(coordinates);
  else coordinates?.forEach(item => flatten(item, output));
  return output;
}

function selectedIds(geometry) {
  const points = flatten(geometry.coordinates);
  const bbox = points.reduce((bounds, [lon, lat]) => [
    Math.min(bounds[0], lon), Math.min(bounds[1], lat),
    Math.max(bounds[2], lon), Math.max(bounds[3], lat),
  ], [Infinity, Infinity, -Infinity, -Infinity]);
  const ids = new Set();
  sourceLocations.forEach(location => {
    const lon = Number(location.lon);
    const lat = Number(location.lat);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
    if (lon < bbox[0] || lon > bbox[2] || lat < bbox[1] || lat > bbox[3]) return;
    const inside = geometry.type === 'Polygon'
      ? pointInPolygon(lon, lat, geometry.coordinates)
      : geometry.coordinates.some(polygon => pointInPolygon(lon, lat, polygon));
    if (inside) ids.add(location.id);
  });
  return ids;
}

function buildIndexes() {
  outgoingIndex = new Map();
  incomingIndex = new Map();
  sourceFlows.forEach((flow, index) => {
    if (!outgoingIndex.has(flow.origin)) outgoingIndex.set(flow.origin, []);
    if (!incomingIndex.has(flow.dest)) incomingIndex.set(flow.dest, []);
    outgoingIndex.get(flow.origin).push(index);
    incomingIndex.get(flow.dest).push(index);
  });
}

globalThis.onmessage = ({ data }) => {
  if (data.type === 'init') {
    sourceLocations = data.locations || [];
    sourceFlows = data.flows || [];
    buildIndexes();
    globalThis.postMessage({ type: 'ready', version: data.version });
    return;
  }
  if (data.type !== 'select' || !data.geometry) return;

  const ids = selectedIds(data.geometry);
  const pickedIndexes = new Set();
  let outgoing = 0;
  let incoming = 0;
  ids.forEach(id => {
    (outgoingIndex.get(id) || []).forEach(index => {
      outgoing += Number(sourceFlows[index].count) || 0;
      if (data.role !== 'destination') pickedIndexes.add(index);
    });
    (incomingIndex.get(id) || []).forEach(index => {
      incoming += Number(sourceFlows[index].count) || 0;
      if (data.role !== 'origin') pickedIndexes.add(index);
    });
  });
  const selectedFlows = Array.from(pickedIndexes, index => sourceFlows[index]);
  globalThis.postMessage({
    type: 'selected', requestId: data.requestId, flows: selectedFlows,
    members: ids.size, outgoing, incoming,
  });
};
