import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { _MapContext as MapContext, StaticMap, NavigationControl, ScaleControl } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import DeckGL from '@deck.gl/react';
import { MapView } from '@deck.gl/core';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { FlowmapLayer } from '@flowmap.gl/layers';
import { useDispatch, useMappedState } from 'redux-react-hook';
import { setconfig_tmp } from '@/redux/actions/traj';
import './index.css';

const MAPBOX_ACCESS_TOKEN = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;

class ControllableFlowmapLayer extends FlowmapLayer {
  renderLayers() {
    return super.renderLayers().filter(layer => {
      const id = layer?.id || '';
      const isFlow = id.includes('flow-lines');
      const isNode = id.includes('circles') || id.includes('location-highlight') || id.includes('location-label');
      if (isFlow) return this.props.showFlows;
      if (isNode) return this.props.showNodes;
      return true;
    });
  }
}

export default function Deckmap() {
  const dispatch = useDispatch();
  const mapState = useCallback(state => ({ traj: state.traj }), []);
  const { traj } = useMappedState(mapState);
  const { locations, flows, config, customlayers } = traj;
  const layerVisibility = config.layerVisibility || {};
  const [viewState, setViewState] = useState({ longitude: 139.691, latitude: 35.6011, zoom: 11, pitch: 0, bearing: 0 });
  const [selectedFlows, setSelectedFlows] = useState([]);
  const selectionWorkerRef = useRef(null);
  const selectionRequestRef = useRef(0);
  const configRef = useRef(config);

  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => {
    const worker = new Worker(new URL('./selection.worker.js', import.meta.url));
    selectionWorkerRef.current = worker;
    worker.onmessage = ({ data }) => {
      if (data.type !== 'selected' || data.requestId !== selectionRequestRef.current) return;
      setSelectedFlows(data.flows);
      const latest = configRef.current;
      dispatch(setconfig_tmp({ ...latest, selectionProcessing: false,
        selectedRegion: { name: '手绘分析区域', members: data.members, outgoing: data.outgoing, incoming: data.incoming } }));
    };
    return () => worker.terminate();
  }, [dispatch]);

  useEffect(() => {
    selectionWorkerRef.current?.postMessage({ type: 'init', version: Date.now(), locations, flows });
    setSelectedFlows([]);
  }, [locations, flows]);

  useEffect(() => {
    if (config.analysisMode !== 'related' || !config.selectionGeometry) {
      setSelectedFlows([]);
      return;
    }
    const requestId = selectionRequestRef.current + 1;
    selectionRequestRef.current = requestId;
    setSelectedFlows([]);
    selectionWorkerRef.current?.postMessage({
      type: 'select', requestId, geometry: config.selectionGeometry, role: config.selectionRole,
    });
  }, [config.analysisMode, config.selectionGeometry, config.selectionRole]);

  useEffect(() => {
    if (!locations.length) return;
    const center = locations[Math.floor(locations.length / 2)];
    setViewState(current => ({ ...current, longitude: center.lon, latitude: center.lat }));
  }, [locations]);

  useEffect(() => {
    const wrapper = document.getElementById('deckgl-wrapper');
    const preventContextMenu = event => event.preventDefault();
    wrapper?.addEventListener('contextmenu', preventContextMenu);
    return () => wrapper?.removeEventListener('contextmenu', preventContextMenu);
  }, []);

  const flowLayer = useMemo(() => {
    const showNodes = layerVisibility.nodes !== false;
    const visibleFlows = config.analysisMode === 'related' ? selectedFlows : flows;
    if ((!layerVisibility.flows && !showNodes) || !visibleFlows.length) return null;
    return new ControllableFlowmapLayer({
      id: 'OD',
      data: { locations, flows: visibleFlows },
      opacity: config.opacity,
      pickable: true,
      colorScheme: config.colorScheme,
      clusteringEnabled: config.aggregationMode !== 'none',
      clusteringAuto: config.aggregationMode === 'auto',
      clusteringLevel: config.clusteringLevel,
      animationEnabled: config.animationEnabled,
      locationTotalsEnabled: showNodes,
      showFlows: Boolean(layerVisibility.flows),
      showNodes,
      fadeOpacityEnabled: config.fadeOpacityEnabled,
      fadeEnabled: config.fadeEnabled,
      fadeAmount: config.fadeAmount,
      darkMode: config.darkMode,
      maxTopFlowsDisplayNum: config.maxTopFlowsDisplayNum,
      getFlowMagnitude: flow => flow.count || 0,
      getFlowOriginId: flow => flow.origin,
      getFlowDestId: flow => flow.dest,
      getLocationId: location => location.id,
      getLocationName: location => location.name || location.id,
      getLocationLat: location => location.lat,
      getLocationLon: location => location.lon,
      getLocationCentroid: location => [location.lon, location.lat],
    });
  }, [
    locations, flows, selectedFlows, config.analysisMode, layerVisibility.flows, layerVisibility.nodes,
    config.opacity, config.colorScheme, config.aggregationMode, config.clusteringLevel,
    config.animationEnabled, config.fadeOpacityEnabled, config.fadeEnabled,
    config.fadeAmount, config.darkMode, config.maxTopFlowsDisplayNum,
  ]);

  const selectionLayer = useMemo(() => {
    if (config.analysisMode !== 'related' || layerVisibility.selection === false) return null;
    const draft = config.draftSelectionCoordinates || [];
    const draftGeometry = draft.length > 2
      ? { type: 'Polygon', coordinates: [[...draft, draft[0]]] }
      : draft.length > 1 ? { type: 'LineString', coordinates: draft } : null;
    const geometry = config.drawingMode ? draftGeometry : config.selectionGeometry;
    const data = { type: 'FeatureCollection', features: geometry
      ? [{ type: 'Feature', properties: { selection: true }, geometry }]
      : [] };
    return new GeoJsonLayer({
      id: 'od-selection-area', data,
      pickable: false, filled: true, stroked: true,
      lineWidthMinPixels: 2, getLineColor: [28, 101, 160, 230],
      getFillColor: config.drawingMode ? [47, 118, 183, 22] : [47, 118, 183, 38],
    });
  }, [config.analysisMode, config.draftSelectionCoordinates, config.drawingMode, config.selectionGeometry, layerVisibility.selection]);

  const draftPointLayer = useMemo(() => {
    if (!config.drawingMode || layerVisibility.selection === false) return null;
    return new ScatterplotLayer({
      id: 'od-selection-points', data: config.draftSelectionCoordinates || [], pickable: false,
      radiusUnits: 'pixels', getRadius: 5, stroked: true, lineWidthMinPixels: 2,
      getPosition: coordinate => coordinate, getFillColor: [255, 255, 255, 255], getLineColor: [28, 101, 160, 255],
    });
  }, [config.draftSelectionCoordinates, config.drawingMode, layerVisibility.selection]);

  const getTooltip = useCallback(info => {
    const object = info.object;
    if (!object) return null;
    if (object.type === 'location') {
      return `${object.name || object.id}\n出发: ${(object.totals?.outgoingCount || 0).toLocaleString()}\n到达: ${(object.totals?.incomingCount || 0).toLocaleString()}`;
    }
    if (object.properties) {
      if (!Number.isFinite(object.properties.outgoing)) return null;
      return `${object.properties.name}\n出发: ${object.properties.outgoing.toLocaleString()}\n到达: ${object.properties.incoming.toLocaleString()}`;
    }
    if (Number.isFinite(object.outgoing)) {
      return `${object.name || object.id}\n出发: ${object.outgoing.toLocaleString()}\n到达: ${object.incoming.toLocaleString()}`;
    }
    if (object.type === 'flow') return `流量: ${object.count}`;
    return null;
  }, []);

  const layers = [...customlayers, flowLayer, selectionLayer, draftPointLayer].filter(Boolean);
  const onViewStateChange = event => setViewState(event.viewState);
  const onMapClick = useCallback(info => {
    if (!config.drawingMode || !info.coordinate) return;
    dispatch(setconfig_tmp({ ...config, draftSelectionCoordinates: [
      ...(config.draftSelectionCoordinates || []), info.coordinate.slice(0, 2),
    ] }));
  }, [config, dispatch]);

  return <DeckGL
    layers={layers}
    viewState={viewState}
    controller={{ doubleClickZoom: false, inertia: true, touchRotate: true }}
    style={{ zIndex: 0 }}
    ContextProvider={MapContext.Provider}
    onViewStateChange={onViewStateChange}
    onClick={onMapClick}
    getTooltip={getTooltip}
  >
    <MapView id="baseMap" controller y="0%" height="100%">
      <StaticMap key="map-canvas" reuseMaps mapboxApiAccessToken={MAPBOX_ACCESS_TOKEN} mapStyle={`mapbox://styles/ni1o1/${config.mapStyle}`} preventStyleDiffing>
        <div className="mapboxgl-ctrl-bottom-left" style={{ bottom: '20px' }}><ScaleControl maxWidth={100} unit="metric" /></div>
      </StaticMap>
      <div key="map-navigation" className="mapboxgl-ctrl-bottom-right" style={{ bottom: '80px' }}><NavigationControl /></div>
    </MapView>
  </DeckGL>;
}
