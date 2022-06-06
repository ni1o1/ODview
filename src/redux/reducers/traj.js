const initState = {
    tripsinfo: {
        trips: [], //轨迹
        loopLength: 7200, //循环时长
        starttime: 0 //开始时间
    },
    play: false,
    time: 0
}
export default function trajReducer(preState = initState, action) {
    const { type, data } = action
    switch (type) {
        case 'setTripsinfo':
            return {...preState, tripsinfo: data }
        case 'setPlay':
            return {...preState, play: data }
        case 'setTime':
            return {...preState, time: data }
        default:
            return preState;
    }
}