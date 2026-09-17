import React, { useState, useEffect } from 'react';
import Deckmap from '@@/Deckmap';
import MyHeader from '@@/Header';
import Panelpage from './Panelpage';
import 'antd/dist/antd.css';
import './index.css';
import PubSub from 'pubsub-js';

export default function Urbanmob() {
  const [showpanel, setShowpanel] = useState(true);
  useEffect(() => {
    const token = PubSub.subscribe('showpanel', (_, visible) => setShowpanel(visible));
    return () => PubSub.unsubscribe(token);
  }, []);
  return <main className="urban-shell">
    <Deckmap />
    <aside className={`panel ${showpanel ? 'panel--open' : 'panel--closed'}`}>
      <MyHeader expanded={showpanel} />
      {showpanel && <div className="panel-scroll"><Panelpage /></div>}
    </aside>
  </main>;
}
