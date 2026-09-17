import React from 'react';
import { Button } from 'antd';
import { CloseOutlined, MenuOutlined } from '@ant-design/icons';
import PubSub from 'pubsub-js';
import './index.css';

export default function Header({ expanded }) {
  if (!expanded) return <header className="panel-header panel-header--closed"><Button type="text" aria-label="展开分析面板" icon={<MenuOutlined />} onClick={() => PubSub.publish('showpanel', true)} /></header>;
  return <header className="panel-header">
    <div className="brand-mark"><span /><span /><span /></div>
    <div className="brand-copy"><b>ODVIEW</b><small>MOBILITY FLOW LAB</small></div>
    <div className="header-actions">
      <Button type="text" aria-label="收起分析面板" icon={<CloseOutlined />} onClick={() => PubSub.publish('showpanel', false)} />
    </div>
  </header>;
}
