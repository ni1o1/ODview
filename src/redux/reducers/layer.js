const initState = {
    layerdata: [{
        "name": "OD",
        "show": true
    }, {
        "name": "OD2",
        "show": true
    }],
}
export default function trajReducer(preState = initState, action) {
    const { type, data } = action
    switch (type) {
        case 'setlayerdata':
            return {...preState, layerdata: data }
        default:
            return preState;
    }
}