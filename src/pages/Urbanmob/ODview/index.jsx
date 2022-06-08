import React, { useEffect, useState, useCallback } from 'react'
import { Typography, Divider, Col, Upload, message, Switch, Table, Modal, Row, Button, Slider, Card, Form, Select, Collapse, Tooltip } from 'antd';
import {
    InfoCircleOutlined
} from '@ant-design/icons';
import { nanoid } from 'nanoid';

//redux
import { useDispatch, useMappedState } from 'redux-react-hook'
import {
    setlocations_tmp,
    setflows_tmp,
    setconfig_tmp
} from '@/redux/actions/traj'
import { downloadFile } from '@/utils/downloadFile';
import axios from 'axios'

const { Title, Paragraph, Text, Link } = Typography;

const csv = require('csvtojson')
const { Panel } = Collapse;
const { Option } = Select;

export default function ODview() {

    const dispatch = useDispatch()
    const setlocations = (data) => {
        dispatch(setlocations_tmp(data))
    }
    const setflows = (data) => {
        dispatch(setflows_tmp(data))
    }
    const setconfig = (data) => {
        dispatch(setconfig_tmp(data))
    }
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
    const { flows, locations, config } = traj
    /*
      ---------------OD数据读取---------------
    */
    //#region
    const handleupload_traj = (file) => {
        message.loading({ content: '读取数据中', key: 'readcsv', duration: 0 })
        return new Promise(resolve => {

            const reader = new FileReader();
            reader.readAsText(file)
            reader.onload = function (f) {
                const data = f.target.result
                let csvoption
                if (data.slice(0, data.indexOf('\n')).split(',').map(f => isNaN(f[0])).indexOf(false) == -1) {
                    //有列名
                    csvoption = {}
                } else {
                    //无列名
                    csvoption = {
                        noheader: true
                    }
                }
                csv(csvoption).fromString(data).then((jsonObj) => {
                    message.destroy('readcsv')
                    setisModalVisible(true)
                    const columns = []
                    Object.keys(jsonObj[0]).forEach(function (key) {
                        columns.push({ 'title': key, 'dataIndex': key, 'key': key })
                    })
                    setTableinfo({ ...tableinfo, columns, data: jsonObj })
                    const columnsnames = columns.map(f => f.key)
                    const SLON = columnsnames[columnsnames.map(f => f.toLowerCase().indexOf('slon') >= 0).indexOf(true)]
                    const SLAT = columnsnames[columnsnames.map(f => f.toLowerCase().indexOf('slat') >= 0).indexOf(true)]
                    const ELON = columnsnames[columnsnames.map(f => f.toLowerCase().indexOf('elon') >= 0).indexOf(true)]
                    const ELAT = columnsnames[columnsnames.map(f => f.toLowerCase().indexOf('elat') >= 0).indexOf(true)]
                    const COUNT = columnsnames[columnsnames.map(f => f.toLowerCase().indexOf('count') >= 0).indexOf(true)]
                    form.setFieldsValue({
                        SLON: typeof SLON === 'undefined' ? columnsnames[0] : SLON,
                        SLAT: typeof SLAT === 'undefined' ? columnsnames[1] : SLAT,
                        ELON: typeof ELON === 'undefined' ? columnsnames[2] : ELON,
                        ELAT: typeof ELAT === 'undefined' ? columnsnames[3] : ELAT,
                        COUNT: typeof COUNT === 'undefined' ? columnsnames[4] : COUNT,
                    })
                })
            }
        })
    }
    const [tableinfo, setTableinfo] = useState({
        columns: [],
        data: [],
        count: 0,
        current: 1
    })
    //表单连接
    const [form] = Form.useForm()
    const [isModalVisible, setisModalVisible] = useState(false)

    const settraj = () => {
        setisModalVisible(false)
        const field = form.getFieldValue()
        processod(field, tableinfo.data)
    }
    //整理OD
    const processod = (field, data) => {
        //提取字段
        const { SLON, SLAT, ELON, ELAT, COUNT } = field
        const locations_tmp = {}
        const flows = data.map(f => {
            const sname = f[SLON] + ',' + f[SLAT]
            const ename = f[ELON] + ',' + f[ELAT]
            if (typeof locations_tmp[sname] == 'undefined') {
                if (COUNT == '=1') {
                    locations_tmp[sname] = 1
                } else {
                    locations_tmp[sname] = parseFloat(f[COUNT])
                }
            } else {
                if (COUNT == '=1') {
                    locations_tmp[sname] += 1
                } else {
                    locations_tmp[sname] += parseFloat(f[COUNT])
                }
            }
            if (typeof locations_tmp[ename] == 'undefined') {
                if (COUNT == '=1') {
                    locations_tmp[ename] = 1
                } else {
                    locations_tmp[ename] = parseFloat(f[COUNT])
                }
            } else {
                if (COUNT == '=1') {
                    locations_tmp[ename] += 1
                } else {
                    locations_tmp[ename] += parseFloat(f[COUNT])
                }
            }
            if (COUNT == '=1') {
                return {
                    origin: sname,
                    dest: ename,
                    count: 1
                }
            } else {
                return {
                    origin: sname,
                    dest: ename,
                    count: parseFloat(f[COUNT])
                }
            }
        })
        const locations = []
        for (let key in locations_tmp) {
            locations.push({ id: key, count: locations_tmp[key], lon: parseFloat(key.split(',')[0]), lat: parseFloat(key.split(',')[1]) })
        }
        setmaxflow(flows.reduce((x, y) => { return x.count > y.count ? x : y }).count)
        setconfig({ ...config, maxTopFlowsDisplayNum: flows.reduce((x, y) => { return x.count > y.count ? x : y }).count })
        setflows(flows)
        setlocations(locations)
    }

    useEffect(() => {
        axios.get('data/flows.json').then(response => {
            const flows = response.data
            axios.get('data/locations.json').then(response => {
                const locations = response.data
                
                setlocations(locations)
                setflows(flows)
                setmaxflow( flows.reduce((x, y) => { return x.count > y.count ? x : y }).count)
                setconfig({ ...config, maxTopFlowsDisplayNum:  flows.reduce((x, y) => { return x.count > y.count ? x : y }).count })
            })
        })
    }, [])
    /*
      ---------------设置改变---------------
    */
    //#region
    const [form2] = Form.useForm()
    const handleconfigchange = (d) => {
        setconfig({ ...config, ...d })
    }
    const [maxflow, setmaxflow] = useState(100)


    return (
        <>
            <Col span={24}>
                <Card title="OD Flowmap" extra={<Tooltip title='Import OD data to show flow map'><InfoCircleOutlined /></Tooltip>}
                    bordered={false}>
                    <Collapse defaultActiveKey={['Trajectory-Echarts-1', "Traj-Settings"]}>
                        <Panel header="Data Manage" key="Trajectory-Echarts-1">
                            <Row gutters={4}>
                                <Col>
                                    <Upload showUploadList={false} beforeUpload={handleupload_traj}><Button type='primary'>Import OD</Button></Upload>
                                </Col>
                                {/* <Button type='primary' onClick={()=>{downloadFile(flows, "flows");downloadFile(locations, "locations")}}>downloadFile</Button> */}
                            </Row>
                        </Panel>
                        <Panel header="OD settings" key="Traj-Settings">
                            <Form
                                {...{
                                    labelCol: { span: 16 },
                                    wrapperCol: { span: 8 },
                                }}
                                size="small"
                                name="basic"
                                layout='inline'
                                form={form2}
                                initialValues={config}
                                autoComplete="off"
                                onValuesChange={handleconfigchange}
                            >
                                <Title level={4}>Basic</Title>
                                <Row gutters={4}>
                                    <Col span={24}>
                                        <Form.Item name="colorScheme" label="colorScheme">
                                            <Select defaultValue='Teal'>
                                                {['Blues', 'BluGrn', 'BluYl', 'BrwnYl', 'BuGn', 'BuPu', 'Burg', 'BurgYl', 'Cool', 'DarkMint', 'Emrld', 'GnBu', 'Grayish', 'Greens', 'Greys', 'Inferno', 'Magenta', 'Magma', 'Mint', 'Oranges', 'OrRd', 'OrYel', 'Peach', 'Plasma', 'PinkYl', 'PuBu', 'PuBuGn', 'PuRd', 'Purp', 'Purples', 'PurpOr', 'RdPu', 'RedOr', 'Reds', 'Sunset', 'SunsetDark', 'Teal', 'TealGrn', 'Viridis', 'Warm', 'YlGn', 'YlGnBu', 'YlOrBr', 'YlOrRd'].map(v => { return <Option value={v}>{v}</Option> })}
                                            </Select>
                                        </Form.Item>
                                    </Col>
                                    <Col span={24}>
                                        <Form.Item name="opacity" label="opacity">
                                            <Slider
                                                min={0}
                                                max={1}
                                                step={0.01}
                                                value={typeof config.opacity === 'number' ? config.opacity : 0}
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Col span={24}>
                                        <Form.Item name="animationEnabled" label="animationEnabled">
                                            <Switch size="small" checked={config.animationEnabled} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={24}>
                                        <Form.Item name="locationTotalsEnabled" label="locationTotalsEnabled">
                                            <Switch size="small" checked={config.locationTotalsEnabled} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={24}>
                                        <Form.Item name="darkMode" label="darkMode">
                                            <Switch size="small" checked={config.darkMode} />
                                        </Form.Item>
                                    </Col>
                                    
                                </Row>

                                <Divider />
                                <Title level={4}>Cluster</Title>
                                <Row gutters={4}>
                                    <Col span={24}>
                                        <Form.Item name="clusteringEnabled" label="clusteringEnabled">
                                            <Switch size="small" checked={config.clusteringEnabled} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={24}>
                                        <Form.Item name="clusteringAuto" label="clusteringAuto">
                                            <Switch size="small" checked={config.clusteringAuto} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={24}>
                                        <Form.Item name="clusteringLevel" label="clusteringLevel">
                                            <Slider
                                                min={0}
                                                max={20}
                                                step={1}
                                                value={typeof config.clusteringLevel === 'number' ? config.clusteringLevel : 0}
                                            />
                                        </Form.Item>
                                    </Col>
                                    <Divider />
                                    <Title level={4}>Fade</Title>

                                    <Col span={24}>
                                        <Form.Item name="fadeEnabled" label="fadeEnabled">
                                            <Switch size="small" checked={config.fadeEnabled} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={24}>
                                        <Form.Item name="fadeOpacityEnabled" label="fadeOpacityEnabled">
                                            <Switch size="small" checked={config.fadeOpacityEnabled} />
                                        </Form.Item>
                                    </Col>
                                    <Col span={24}>
                                        <Form.Item name="fadeAmount" label="fadeAmount">
                                            <Slider
                                                min={0}
                                                max={100}
                                                step={0.1}
                                                value={typeof config.fadeAmount === 'number' ? config.fadeAmount : 0}
                                            />
                                        </Form.Item>
                                    </Col>
                                </Row>
                            </Form>
                        </Panel>
                    </Collapse>
                </Card>
            </Col>


            <Modal key="model" title="轨迹数据预览"
                width='80vw'
                height='80vh'
                visible={isModalVisible} onOk={settraj} onCancel={() => {
                    setisModalVisible(false)
                }}>


                <Form
                    {...{
                        labelCol: { span: 8 },
                        wrapperCol: { span: 0 },
                    }}
                    name="basic"
                    form={form}
                    initialValues={{ remember: true }}
                    autoComplete="off"
                >
                    <Row>
                        <Col span={4}>
                            <Form.Item name="SLON" label="slon">
                                <Select style={{ width: 120 }}>
                                    {tableinfo.columns.map(v => { return <Option value={v.key}>{v.key}</Option> })}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={4}>
                            <Form.Item name="SLAT" label="slat">
                                <Select style={{ width: 120 }}>
                                    {tableinfo.columns.map(v => { return <Option value={v.key}>{v.key}</Option> })}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={4}>
                            <Form.Item name="ELON" label="elon">
                                <Select style={{ width: 120 }}>
                                    {tableinfo.columns.map(v => { return <Option value={v.key}>{v.key}</Option> })}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={4}>
                            <Form.Item name="ELAT" label="elat">
                                <Select style={{ width: 120 }}>
                                    {tableinfo.columns.map(v => { return <Option value={v.key}>{v.key}</Option> })}
                                </Select>
                            </Form.Item>
                        </Col>
                        <Col span={4}>
                            <Form.Item name="COUNT" label="count">
                                <Select style={{ width: 120 }}>
                                    {[...tableinfo.columns, { key: '=1' }].map(v => { return <Option value={v.key}>{v.key}</Option> })}
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>
                </Form>
                <Table columns={tableinfo.columns}
                    dataSource={tableinfo.data}
                    rowKey={columns => nanoid()}
                    scroll={{ x: '100%' }}
                    size='small'
                    style={{
                        'overflowX': 'auto',
                        'overflowY': 'auto'
                    }} />
            </Modal>
        </>
    )

}