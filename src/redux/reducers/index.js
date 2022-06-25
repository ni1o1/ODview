//汇总reducer
import { combineReducers } from 'redux'
import traj from './traj'
import layer from './layer'
export default combineReducers({
    traj,
    layer
})