import React, { useState, useEffect } from 'react'
import { Layout } from 'antd';


import Deckmap from '@@/Deckmap';
import MyHeader from '@@/Header'
import Panelpage from './Panelpage';
import 'antd/dist/antd.css';
import './index.css';
import { useSubscribe, useUnsubscribe } from '@/utils/usePubSub';

const { Sider } = Layout;

export default function Urbanmob() {


  const [showpanel, setshowpanel] = useState(true)
  const unsubscribe = useUnsubscribe();//清除更新组件重复订阅的副作用
  //订阅panel展开收起
  unsubscribe('showpanel');
  const updateshowpanel = useSubscribe('showpanel', function (msg: any, data: any) {
    setshowpanel(data)
  });


  return (
    <div>
      <Layout>
        <Sider
          width={showpanel?'45%':'50px'}
          className="panel"
        >
          <Layout>
            <MyHeader />
            <div style={showpanel ? {} : { height: '0px', overflowY: 'hidden' }}>
              <Panelpage />
            </div>
          </Layout>
        </Sider>
        <Deckmap></Deckmap>
      </Layout>
    </div>
  )

}
