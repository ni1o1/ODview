import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Typography, Col, Upload, message, Switch, Table, Modal, Row, Slider,
  Form, Select, Tag, Progress, Space,
} from 'antd';
import { ApartmentOutlined, DatabaseOutlined, InboxOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useDispatch, useMappedState } from 'redux-react-hook';
import { GeoJsonLayer } from '@deck.gl/layers';
import { setlocations_tmp, setflows_tmp, setconfig_tmp, setcustomlayers_tmp } from '@/redux/actions/traj';
import { detectODColumns } from '@/utils/detectODColumns';
import './index.css';

const { Dragger } = Upload;
const { Text } = Typography;
const { Option } = Select;

export default function ODview() {
  const dispatch = useDispatch();
  const mapState = useCallback(state => ({ traj: state.traj }), []);
  const { traj } = useMappedState(mapState);
  const { flows, locations, config, customlayers } = traj;
  const configRef = useRef(config);
  const [mappingForm] = Form.useForm();
  const workerRef = useRef(null);
  const [layernum, setLayernum] = useState(1);
  const [isModalVisible, setModalVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [sourceRows, setSourceRows] = useState(0);
  const [tableinfo, setTableinfo] = useState({ columns: [], data: [] });
  const [panelTab, setPanelTab] = useState('analysis');

  useEffect(() => { configRef.current = config; }, [config]);
  const setLocations = useCallback(data => dispatch(setlocations_tmp(data)), [dispatch]);
  const setFlows = useCallback(data => dispatch(setflows_tmp(data)), [dispatch]);
  const setConfig = useCallback(data => dispatch(setconfig_tmp(data)), [dispatch]);
  const setCustomlayers = useCallback(data => dispatch(setcustomlayers_tmp(data)), [dispatch]);

  useEffect(() => {
    const worker = new Worker(new URL('./odParser.worker.js', import.meta.url));
    workerRef.current = worker;
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') setProgress(data.progress);
      if (data.type === 'parsed') {
        const columns = data.columns.map(key => ({ title: key, dataIndex: key, key, ellipsis: true }));
        setTableinfo({ columns, data: data.preview });
        setSourceRows(data.rowCount);
        const detectedFields = detectODColumns(data.columns, data.preview);
        mappingForm.resetFields();
        mappingForm.setFieldsValue(detectedFields);
        const missingCoordinates = ['SLON', 'SLAT', 'ELON', 'ELAT'].filter(key => !detectedFields[key]);
        setBusy(false); setProgress(100); setModalVisible(true);
        if (missingCoordinates.length) {
          message.warning({ content: '部分经纬度字段无法可靠判断，请在映射窗口中确认', key: 'readcsv', duration: 5 });
        } else {
          message.success({ content: `已读取 ${data.rowCount.toLocaleString()} 条记录并智能识别经纬度字段`, key: 'readcsv' });
        }
      }
      if (data.type === 'processed') {
        const nextConfig = {
          ...configRef.current,
          maxTopFlowsDisplayNum: Math.min(data.flows.length, 50000),
          animationEnabled: data.flows.length > 20000 ? false : configRef.current.animationEnabled,
        };
        configRef.current = nextConfig;
        setLocations(data.locations); setFlows(data.flows); setConfig(nextConfig);
        setBusy(false); setProgress(100); setModalVisible(false);
        const skipped = data.invalidRows ? `，跳过 ${data.invalidRows.toLocaleString()} 条异常记录` : '';
        message.success({ content: `已聚合为 ${data.flows.length.toLocaleString()} 条 OD 流${skipped}`, key: 'readcsv', duration: 4 });
      }
      if (data.type === 'error') { setBusy(false); message.error({ content: data.message, key: 'readcsv' }); }
    };
    return () => worker.terminate();
  }, [mappingForm, setConfig, setFlows, setLocations]);

  useEffect(() => {
    Promise.all([
      fetch('data/flows.json').then(response => response.json()),
      fetch('data/locations.json').then(response => response.json()),
    ]).then(([defaultFlows, defaultLocations]) => {
      setLocations(defaultLocations); setFlows(defaultFlows);
      setConfig({ ...configRef.current, maxTopFlowsDisplayNum: Math.min(defaultFlows.length, 50000) });
    }).catch(() => message.warning('默认数据加载失败，请导入本地数据'));
  }, [setConfig, setFlows, setLocations]);

  const handleUpload = file => {
    const extension = file.name.split('.').pop().toLowerCase();
    if (extension === 'csv') {
      setBusy(true); setProgress(2);
      message.loading({ content: '正在后台解析 CSV…', key: 'readcsv', duration: 0 });
      workerRef.current.postMessage({ type: 'parse', file });
    } else if (extension === 'json' || extension === 'geojson') {
      setBusy(true);
      file.text().then(text => {
        const jsondata = JSON.parse(text);
        if (!jsondata.features?.length) throw new Error('无效的 GeoJSON 文件');
        const layer = new GeoJsonLayer({
          id: `Layer${layernum}`, type: jsondata.features[0].geometry.type, data: jsondata,
          pickable: true, stroked: true, filled: true, extruded: false,
          lineWidthMinPixels: 1, opacity: 0.75, getFillColor: [111, 132, 121, 28],
          getLineColor: [94, 112, 103, 170], getPointRadius: 100, getLineWidth: 1.5,
        });
        setCustomlayers([...customlayers, layer]); setLayernum(value => value + 1); setBusy(false);
        message.success('图层已加载');
      }).catch(error => { setBusy(false); message.error(error.message); });
    } else message.error('请选择 CSV 或 GeoJSON 文件');
    return false;
  };

  const processOD = () => {
    mappingForm.validateFields().then(field => {
      setBusy(true); setProgress(70);
      message.loading({ content: '正在聚合 OD 流…', key: 'readcsv', duration: 0 });
      workerRef.current.postMessage({ type: 'process', field });
    });
  };
  const updateConfig = useCallback(patch => {
    const next = { ...configRef.current, ...patch };
    configRef.current = next;
    setConfig(next);
  }, [setConfig]);

  const setLayerVisible = (layer, visible) => updateConfig({
    layerVisibility: { ...configRef.current.layerVisibility, [layer]: visible },
  });

  const setCustomLayerVisible = (id, visible) => {
    setCustomlayers(customlayers.map(layer => layer.id === id ? layer.clone({ visible }) : layer));
  };

  const setMapStyle = mapStyle => updateConfig({
    mapStyle,
    darkMode: ['clvlrr1re03yv01phbhwge3k3', 'cjetnd20i1vbi2qqxbh0by7p8', 'cjv36gyklf43q1fnuwibiuetl'].includes(mapStyle),
  });

  const startDrawing = () => updateConfig({ drawingMode: true, draftSelectionCoordinates: [], selectionGeometry: null, selectedRegion: null, selectionProcessing: false });
  const finishDrawing = () => {
    const coordinates = configRef.current.draftSelectionCoordinates || [];
    if (coordinates.length < 3) { message.warning('请至少在地图上选取 3 个点'); return; }
    const geometry = { type: 'Polygon', coordinates: [[...coordinates, coordinates[0]]] };
    updateConfig({ drawingMode: false, selectionGeometry: geometry, selectionProcessing: true,
      selectedRegion: { name: '手绘分析区域', members: 0, outgoing: 0, incoming: 0 } });
  };
  const columnNames = tableinfo.columns.map(column => column.key);
  const statItems = useMemo(() => [
    { label: '流向', value: flows.length.toLocaleString(), icon: <ThunderboltOutlined /> },
    { label: '节点', value: locations.length.toLocaleString(), icon: <ApartmentOutlined /> },
    { label: '图层', value: customlayers.length + 3, icon: <DatabaseOutlined /> },
  ], [customlayers.length, flows.length, locations.length]);

  const mapStyles = [
    ['cl38pr5lx001f15nyyersk7in', '明亮 · 中文'], ['ckwfx658z4dpb14ocnz6tky9d', '明亮 · English'],
    ['clvlrr1re03yv01phbhwge3k3', '暗色 · 中文'], ['cjetnd20i1vbi2qqxbh0by7p8', '暗色 · English'],
    ['cjv36gyklf43q1fnuwibiuetl', '卫星影像'], ['outdoors-v10', '户外地图'],
  ];
  const selected = config.selectedRegion;

  return <div className="od-workspace">
    <div className="od-summary">{statItems.map(item => <div className="od-stat" key={item.label}>
      <span className="od-stat-icon">{item.icon}</span><span><b>{item.value}</b><small>{item.label}</small></span>
    </div>)}</div>

    <section className="import-priority">
      <div className="import-priority-title"><span><DatabaseOutlined /><b>导入你的 OD 数据</b></span><small>CSV · GeoJSON</small></div>
      <Dragger className="od-uploader compact" maxCount={1} beforeUpload={handleUpload} showUploadList={false} disabled={busy}>
        <p className="ant-upload-drag-icon"><InboxOutlined /></p>
        <div><p className="ant-upload-text">点击选择或拖入文件</p><p className="ant-upload-hint">大型 CSV 会在后台解析与聚合</p></div>
      </Dragger>
      {busy && <Progress className="od-progress" percent={progress} size="small" strokeColor="#179c57" showInfo={false} />}
    </section>

    <nav className="workspace-tabs" aria-label="OD 分析功能">
      {[['analysis', '分析'], ['display', '图层样式']].map(([key, label]) =>
        <button type="button" key={key} className={panelTab === key ? 'active' : ''} onClick={() => setPanelTab(key)}>{label}</button>
      )}
    </nav>

    {panelTab === 'analysis' && <section className="workspace-panel">
      <div className="region-filter-panel">
        {!config.drawingMode && !selected && !config.selectionProcessing && <button type="button" className="draw-region-button" onClick={startDrawing}>
          <span>筛选区域</span><small>在地图上圈选</small>
        </button>}
        {config.drawingMode && <div className="drawing-actions">
          <div><b>正在圈选</b><small>在地图上逐点单击 · {(config.draftSelectionCoordinates || []).length} 个点</small></div>
          <button type="button" onClick={finishDrawing} disabled={(config.draftSelectionCoordinates || []).length < 3}>完成圈选</button>
          <button type="button" className="cancel" onClick={() => updateConfig({ drawingMode: false, draftSelectionCoordinates: [] })}>取消</button>
        </div>}
        {config.selectionProcessing ? <div className="selection-processing"><i />正在筛选关联流向…</div> : selected && <div className="selected-region">
          <div><strong>{selected.name}</strong><small>{`${selected.members.toLocaleString()} 个圈内节点`}</small></div>
          <span className="workspace-label selection-role-label">关联方式</span>
          <div className="relation-switch">
            {[['origin', '作为 O'], ['destination', '作为 D'], ['both', '双向']].map(([value, label]) =>
              <button type="button" key={value} className={config.selectionRole === value ? 'active' : ''} onClick={() => updateConfig({ selectionRole: value, selectionProcessing: true })}>{label}</button>
            )}
          </div>
          <div className="selected-stats"><span className="origin">出发 {selected.outgoing.toLocaleString()}</span><span className="destination">到达 {selected.incoming.toLocaleString()}</span></div>
          <div className="selection-actions"><button type="button" onClick={startDrawing}>重新筛选</button><button type="button" className="clear-selection" onClick={() => updateConfig({ drawingMode: false, draftSelectionCoordinates: [], selectionGeometry: null, selectedRegion: null, selectionProcessing: false })}>清除</button></div>
        </div>}
      </div>
    </section>}

    {panelTab === 'display' && <section className="workspace-panel">
      <div className="control-block"><label className="workspace-label">底图</label><Select value={config.mapStyle} onChange={setMapStyle}>{mapStyles.map(([value, label]) => <Option key={value} value={value}>{label}</Option>)}</Select></div>
      <div className="analysis-section"><span className="workspace-label">数据图层</span>
        {[
          ['flows', '#2f76b7', 'OD 流向', `${flows.length.toLocaleString()} 条`],
          ['nodes', '#506f9b', 'FlowMap 节点', '原生进出量分瓣圆'],
          ...((config.selectionGeometry || config.drawingMode) ? [['selection', '#2f76b7', '分析选区', '手绘多边形及高亮']] : []),
        ].map(([key, color, label, hint]) => <div className="layer-row" key={key}><i style={{ background: color }} /><span><b>{label}</b><small>{hint}</small></span><Switch size="small" checked={Boolean(config.layerVisibility?.[key])} onChange={checked => setLayerVisible(key, checked)} /></div>)}
      </div>
      {customlayers.length > 0 && <div className="analysis-section"><span className="workspace-label">导入图层</span>{customlayers.map(layer => <div className="layer-row" key={layer.id}><i style={{ background: '#8f70b5' }} /><span><b>{layer.id}</b><small>{layer.props.type || 'GeoJSON'}</small></span><Switch size="small" checked={layer.props.visible !== false} onChange={visible => setCustomLayerVisible(layer.id, visible)} /></div>)}</div>}
      <div className="analysis-section"><div className="control-block"><label className="workspace-label">FlowMap 聚类</label><Select value={config.aggregationMode} onChange={aggregationMode => updateConfig({ aggregationMode })}><Option value="none">不聚类</Option><Option value="auto">自动（跟随缩放）</Option><Option value="manual">手动层级</Option></Select></div>
      {config.aggregationMode === 'manual' && <div className="control-block"><label className="workspace-label">聚类层级 <b>{config.clusteringLevel}</b></label><Slider min={0} max={20} step={1} value={config.clusteringLevel} onChange={clusteringLevel => updateConfig({ clusteringLevel })} /></div>}
      </div>
      <div className="analysis-section"><span className="workspace-label">流向样式</span>
        <div className="control-row"><div><label className="workspace-label">色带</label><Select value={config.colorScheme} onChange={colorScheme => updateConfig({ colorScheme })}>{['Blues', 'BluGrn', 'Cool', 'DarkMint', 'Emrld', 'Inferno', 'Magma', 'Mint', 'Oranges', 'Plasma', 'Sunset', 'Teal', 'Viridis', 'Warm'].map(value => <Option value={value} key={value}>{value}</Option>)}</Select></div><div><label className="workspace-label">透明度</label><Slider min={0} max={1} step={0.05} value={config.opacity} onChange={opacity => updateConfig({ opacity })} /></div></div>
      </div>
      <div className="analysis-section"><span className="workspace-label">动画与效果</span>
        <div className="layer-row"><i className="effect-dot" /><span><b>流动动画</b><small>大数据导入时自动关闭</small></span><Switch size="small" checked={config.animationEnabled} onChange={animationEnabled => updateConfig({ animationEnabled })} /></div>
        <div className="layer-row"><i className="effect-dot muted" /><span><b>距离渐隐</b><small>弱化次要连线</small></span><Switch size="small" checked={config.fadeEnabled} onChange={fadeEnabled => updateConfig({ fadeEnabled })} /></div>
        {config.fadeEnabled && <div className="control-block nested"><label className="workspace-label">渐隐强度 <b>{config.fadeAmount}</b></label><Slider min={0} max={100} step={1} value={config.fadeAmount} onChange={fadeAmount => updateConfig({ fadeAmount })} /></div>}
      </div>
    </section>}
    <Modal className="mapping-modal" title={<Space><DatabaseOutlined />字段映射 <Tag color="green">{sourceRows.toLocaleString()} 行</Tag></Space>}
      width="min(1080px, 92vw)" visible={isModalVisible} onOk={processOD} okText="生成流向图" confirmLoading={busy} onCancel={() => setModalVisible(false)}>
      <Text type="secondary">已自动识别字段。为保持流畅，下方仅预览前 100 行，完整数据会在后台处理。</Text>
      <Form className="mapping-form" form={mappingForm} layout="vertical"><Row gutter={12}>
        {[['SLON', '起点经度'], ['SLAT', '起点纬度'], ['ELON', '终点经度'], ['ELAT', '终点纬度'], ['COUNT', '流量']].map(([name, label]) => <Col xs={12} md={name === 'COUNT' ? 4 : 5} key={name}><Form.Item name={name} label={label} rules={[{ required: true }]}><Select>{[...columnNames, ...(name === 'COUNT' ? ['=1'] : [])].map(value => <Option value={value} key={value}>{value}</Option>)}</Select></Form.Item></Col>)}
      </Row></Form>
      <Table columns={tableinfo.columns} dataSource={tableinfo.data} rowKey="__rowKey" pagination={false} scroll={{ x: true, y: 360 }} size="small" />
    </Modal>
  </div>;
}
