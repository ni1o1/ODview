import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';
//redux
import { createStore, applyMiddleware } from 'redux';
import { StoreContext } from 'redux-react-hook'
import reducer from './redux/reducers'
import thunk from 'redux-thunk'
import { composeWithDevTools } from 'redux-devtools-extension'
const store = createStore(reducer, composeWithDevTools(applyMiddleware(thunk)));

ReactDOM.render(
    //Provider包裹App，子组件可以收到store
    <
    StoreContext.Provider value = { store } >
    <
    App / >
    <
    /StoreContext.Provider>, document.getElementById('root')
);