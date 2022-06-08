/* global window */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { _MapContext as MapContext, StaticMap, NavigationControl, ScaleControl, FlyToInterpolator } from 'react-map-gl';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';
import DeckGL from '@deck.gl/react';
import { useSubscribe, usePublish, useUnsubscribe } from '@/utils/usePubSub';
import { useInterval } from 'ahooks';
import { AmbientLight, LightingEffect, MapView, FirstPersonView, _SunLight as SunLight } from '@deck.gl/core';
import { BitmapLayer, IconLayer } from '@deck.gl/layers';
import { TileLayer } from '@deck.gl/geo-layers';
//redux
import { useDispatch, useMappedState } from 'redux-react-hook'
import {
  setlocations_tmp,
  setflows_tmp
} from '@/redux/actions/traj'
//flowmap
import {
  FlowmapLayer,
} from '@flowmap.gl/layers';
import './index.css';

const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoibmkxbzEiLCJhIjoiY2t3ZDgzMmR5NDF4czJ1cm84Z3NqOGt3OSJ9.yOYP6pxDzXzhbHfyk3uORg';

export default function Deckmap() {
  const unsubscribe = useUnsubscribe();//清除更新组件重复订阅的副作用
  /*
    ---------------redux中取出变量---------------
  */
  //#region
  const mapState = useCallback(
    state => ({
      traj: state.traj
    }),
    []
  );
  const { traj } = useMappedState(mapState);
  const { locations, flows, config } = traj
  //dispatch
  const dispatch = useDispatch()
  //#endregion
  /*
  ---------------地图底图设置---------------
  */
  //#region
  //管理光强度
  const [lightintensity, setlightintensity] = useState(2)
  unsubscribe('lightintensity')
  useSubscribe('lightintensity', function (msg: any, data: any) {
    setlightintensity(data)
  });

  //管理光角度X
  const [lightx, setlightx] = useState(1554937300)
  unsubscribe('lightx')
  useSubscribe('lightx', function (msg: any, data: any) {
    setlightx(data)
  });

  //地图光效
  const ambientLight = new AmbientLight({
    color: [255, 255, 255],
    intensity: 1.0
  });


  const sunLight = new SunLight({
    timestamp: lightx,
    color: [255, 255, 255],
    intensity: lightintensity
  });
  const lightingEffect = new LightingEffect({ ambientLight, sunLight });

  const material = {
    ambient: 0.1,
    diffuse: 0.6,
    shininess: 22,
    specularColor: [60, 64, 70]
  };

  const theme = {
    buildingColor: [255, 255, 255],
    trailColor0: [253, 128, 93],
    trailColor1: [23, 184, 190],
    material,
    effects: [lightingEffect]
  };

  //设定默认地图中心点
  const [viewState, setViewState] = React.useState({
    longitude: 139.691,
    latitude: 35.6011,
    zoom: 11,
    pitch: 0,
    bearing: 0
  });

  //默认地图底图
  const [mapStyle, setMapStyle] = React.useState('dark-v9');
  const publish = usePublish();

  //订阅地图样式
  unsubscribe('mapstyle')
  useSubscribe('mapstyle', function (msg: any, data: any) {
    setMapStyle(data)
  });


  useEffect(() => {
    //允许右键旋转视角
    document.getElementById("deckgl-wrapper").addEventListener("contextmenu", evt => evt.preventDefault());
  }, [])

  //第一人称底图
  const minimapBackgroundStyle = {
    position: 'absolute',
    zIndex: -1,
    width: '100%',
    height: '100%',
    background: '#aaa',
    boxShadow: '0 0 8px 2px rgba(0,0,0,0.15)'
  };
  //#endregion
  /*
  ---------------地图旋转按钮---------------
  */
  //#region
  //旋转的函数
  function rotate(pitch, bearing, duration) {
    setViewState({
      ...viewState,
      pitch: pitch,
      bearing: bearing,
      transitionDuration: duration,
      transitionInterpolator: new FlyToInterpolator(),
    });
  }
  const [angle, setangle] = useState(120);
  const [interval, setInterval] = useState(undefined);
  useInterval(() => {
    rotate(viewState.pitch, angle, 2000)
    setangle(angle => angle + 30)
  }, interval, { immediate: true });
  //旋转的按钮
  function rotatecam() {
    setangle(viewState.bearing + 30)
    if (interval != 2000) {
      setInterval(2000)
    } else {
      setInterval(undefined)
      setViewState(viewState)
    }
  };
  //镜头旋转工具
  const [fristperson_isshow, setfristperson_isshow] = useState(false)
  const cameraTools = (
    <div className="mapboxgl-ctrl-group mapboxgl-ctrl">
      <button
        title="Rotatecam"
        onClick={rotatecam}
        style={{ opacity: interval == 2000 ? 1 : 0.2 }}
      > <span className="iconfont icon-camrotate" /></button>
      <button
        title="fristpersoncontrol"
        onClick={() => {
          setfristperson_isshow(!fristperson_isshow)
        }}
        style={{ opacity: fristperson_isshow ? 1 : 0.2 }}
      >
        <span className="iconfont icon-firstperson" /></button>
    </div>
  );


  useEffect(() => {
    if (locations.length > 0) {
      setViewState({ ...viewState, longitude: locations[parseInt(locations.length / 2)].lon, latitude: locations[parseInt(locations.length / 2)].lat })
    }
  }, [locations])
  const [flowcount, setflowcount] = useState(0)
  function getTooltipText(info) {

    if (!info.layer) {
    } else {
      if (info.layer.id === 'my-flowmap-layer') {
        console.log(info.object)
        if (info.object) {
          if (info.object.type == 'flow') {
            return `Count: ${info.object.count}`
          }
          if (info.object.type == 'location') {
            return `In: ${info.object.totals.incomingCount}\nOut: ${info.object.totals.outgoingCount}`
          }
        }

      }
    }
  }
  const getTooltip = useCallback(info => getTooltipText(info));
  const handelhover = (info, event) => {
    if (info) {
      setflowcount(info.count)
    }
  }


  //#endregion
  /*
  ---------------地图图层设置---------------
  */
  //#region

  const layers = [
    fristperson_isshow ? new TileLayer({
      // https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames#Tile_servers
      data: `https://api.mapbox.com/styles/v1/mapbox/${mapStyle}/tiles/{z}/{x}/{y}?access_token=pk.eyJ1IjoibmkxbzEiLCJhIjoiY2t3ZDgzMmR5NDF4czJ1cm84Z3NqOGt3OSJ9.yOYP6pxDzXzhbHfyk3uORg`,
      minZoom: 0,
      maxZoom: 19,
      tileSize: 512,
      renderSubLayers: props => {
        const {
          bbox: { west, south, east, north }
        } = props.tile;
        return new BitmapLayer(props, {
          data: null,
          image: props.data,
          bounds: [west, south, east, north]
        });
      }
    }) : null,
    fristperson_isshow ? new IconLayer({//第一人称位置
      id: 'ref-point',
      data: [{
        color: [68, 142, 247],
        coords: [viewState.longitude, viewState.latitude]
      }],
      iconAtlas: 'images/firstperson.png',
      iconMapping: {
        marker: { x: 0, y: 0, width: 200, height: 200, mask: true }
      },
      sizeScale: 5,
      getIcon: d => 'marker',
      getPosition: d => [...d.coords, 30],
      getSize: d => 5,
      getColor: d => d.color
    }) : null,
    new FlowmapLayer({
      id: 'my-flowmap-layer',
      data: { locations, flows },
      opacity: config.opacity,
      pickable: true,
      colorScheme: config.colorScheme,
      clusteringEnabled: config.clusteringEnabled,
      clusteringAuto: config.clusteringAuto,
      clusteringLevel: config.clusteringLevel,
      animationEnabled: config.animationEnabled,
      locationTotalsEnabled: config.locationTotalsEnabled,
      fadeOpacityEnabled: config.fadeOpacityEnabled,
      fadeEnabled: config.fadeEnabled,
      fadeAmount: config.fadeAmount,
      darkMode: config.darkMode,
      /*       
            fadeAmount: config.fadeAmount,
            locationTotalsEnabled: config.locationTotalsEnabled,
            locationLabelsEnabled: config.locationLabelsEnabled,
            animationEnabled: config.animationEnabled,
            adaptiveScalesEnabled: config.adaptiveScalesEnabled,
            highlightColor: config.highlightColor, */
      getFlowMagnitude: (flow) => flow.count || 0,
      getFlowOriginId: (flow) => flow.origin,
      getFlowDestId: (flow) => flow.dest,
      getLocationId: (loc) => loc.id,
      getLocationLat: (loc) => loc.lat,
      getLocationLon: (loc) => loc.lon,
      getLocationCentroid: (location) => [location.lon, location.lat],
      onHover: handelhover,
    })
  ];
  //#endregion
  /*
  ---------------渲染地图---------------
  */
  //#region
  const onViewStateChange = (newviewState) => {
    const { viewId } = newviewState
    const nviewState = newviewState.viewState
    if (viewId == 'firstPerson') {
      setViewState({ ...viewState, longitude: nviewState.longitude, latitude: nviewState.latitude, bearing: nviewState.bearing })
    } else if (viewId == 'baseMap') {
      setViewState({ ...viewState, longitude: nviewState.longitude, latitude: nviewState.latitude, pitch: nviewState.pitch, bearing: nviewState.bearing, zoom: nviewState.zoom })
    }
  }
  return (
    <div>
      <DeckGL
        layers={layers}
        initialViewState={{
          'baseMap': viewState, 'firstPerson': {
            ...viewState, pitch: 0, zoom: 0, position: [0, 0, 2], transitionDuration: undefined,
            transitionInterpolator: undefined
          }
        }}
        effects={theme.effects}
        controller={{ doubleClickZoom: false, inertia: true, touchRotate: true }}
        style={{ zIndex: 0 }}
        ContextProvider={MapContext.Provider}
        onViewStateChange={onViewStateChange}
        getTooltip={getTooltip}
      >
        <MapView id="baseMap"
          controller={true}
          y="0%"
          height="100%"
          position={
            [0, 0, 0]}>
          <StaticMap reuseMaps key='mapboxgl-ctrl-bottom-left'
            mapboxApiAccessToken={MAPBOX_ACCESS_TOKEN}
            mapStyle={`mapbox://styles/mapbox/${mapStyle}`}
            preventStyleDiffing={true} >
            <div className='mapboxgl-ctrl-bottom-left' style={{ bottom: '20px' }}>
              <ScaleControl maxWidth={100} unit="metric" />
            </div>
          </StaticMap>
          <div className='mapboxgl-ctrl-bottom-right' style={{ bottom: '80px' }}>
            <NavigationControl onViewportChange={viewport => setViewState(viewport)} />
            {cameraTools}
          </div>
        </MapView>
        {fristperson_isshow && (<FirstPersonView id="firstPerson"
          controller={{ scrollZoom: false, dragRotate: true, inertia: true }}
          far={10000}
          focalDistance={1.5}
          x={'68%'}
          y={20}
          width={'30%'}
          height={'50%'}
          clear={true}>
          <div style={minimapBackgroundStyle} /> </FirstPersonView>)}

      </DeckGL>

    </div>
  );
}
//#endregion