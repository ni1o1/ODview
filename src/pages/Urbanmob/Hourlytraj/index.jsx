import React, { useEffect,  useState } from 'react'
import {  Col,  Card,  Collapse, Tooltip } from 'antd';
import {
    InfoCircleOutlined
} from '@ant-design/icons';

const { Panel } = Collapse;


export default function Hourlytraj() {

    return (
        <>
            <Col span={24}>
                <Card title="OD Flowmap" extra={<Tooltip title='Import OD data to show flow map'><InfoCircleOutlined/></Tooltip>}
                bordered={false}>
                    <Collapse defaultActiveKey={['Trajectory-Echarts-1']}>
                        <Panel header="Hourly distribution" key="Trajectory-Echarts-1">
                        </Panel>
                        <Panel header="Trajectory settings" key="Traj-Settings">
                        </Panel>
                    </Collapse>
                </Card>
            </Col>
        </>
    )

}