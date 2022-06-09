import React, { useEffect, useState, } from 'react'
import { useSubscribe, usePublish, useUnsubscribe } from '@/utils/usePubSub';
import axios from 'axios';
import { PageHeader, Menu, Dropdown, Modal, message, Button } from 'antd';
import { DownOutlined, SettingOutlined, UpOutlined, SyncOutlined, LockOutlined, ExportOutlined, GlobalOutlined } from '@ant-design/icons';
import { publish } from 'pubsub-js';
import './index.css';
const { SubMenu } = Menu;

export default function Header(props) {

    //定义Hooks
    const [collapsed, setCollapsed] = useState(true);
    //缩小sidebar
    function toggleCollapsed() {
        setCollapsed(!collapsed);
        //导航至页面
        publish('showpanel', !collapsed)
    };
    const menu = (<Menu>
        <SubMenu key='Mapstyle' title="Mapstyle" icon={<GlobalOutlined />}>
            <Menu.Item key="dark" onClick={() => { publish('mapstyle', "cjetnd20i1vbi2qqxbh0by7p8") }}>Dark</Menu.Item>
            <Menu.Item key="light" onClick={() => { publish('mapstyle', "cl38pr5lx001f15nyyersk7in") }}>Light</Menu.Item>
            <Menu.Item key="satellite" onClick={() => { publish('mapstyle', "cjv36gyklf43q1fnuwibiuetl") }}>Cali Terrain</Menu.Item>
            <Menu.Item key="outdoors" onClick={() => { publish('mapstyle', "outdoors-v10") }}>Outdoors</Menu.Item>
        </SubMenu>
    </Menu>
    );

    return (
        <>
            {collapsed ? <PageHeader
                className="site-page-header"
                key="site-page-header"
                title="OD View by 小旭学长"
                subTitle=''
                avatar={{ src: 'images/logodark_3durbanmob.png', shape: 'square' }}
                {...props}
                extra={[
                    <div key='settings1'>
                        <Dropdown key='settings' overlay={menu} trigger={['click']}>
                            <Button key='Settingbuttom' type="text" >
                                <SettingOutlined />
                            </Button>
                        </Dropdown>
                        <Button key='navicollapsed' type="text" onClick={toggleCollapsed}>
                            {React.createElement(collapsed ? UpOutlined : DownOutlined)}
                        </Button>
                    </div>
                ]}
            >
            </PageHeader> : <Button key='navicollapsed' type="text" onClick={toggleCollapsed}>
                {React.createElement(collapsed ? UpOutlined : DownOutlined)}
            </Button>}

        </>
    )
}

