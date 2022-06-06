const initState = {
    locations: [],
    flows: [],
    config: {
        colorScheme: 'Blues',
        opacity: 1,
        clusteringEnabled: true,
        animationEnabled: false,
        locationTotalsEnabled: true,
        fadeOpacityEnabled: true,
        fadeEnabled: false,
        fadeAmount: 50,
        clusteringAuto: true,
        clusteringLevel: 10,
        darkMode: true,
        maxTopFlowsDisplayNum: 100,
    },
}
export default function trajReducer(preState = initState, action) {
    const { type, data } = action
    switch (type) {
        case 'setlocations':
            return {...preState, locations: data }
        case 'setflows':
            return {...preState, flows: data }
        case 'setconfig':
            return {...preState, config: data }
        default:
            return preState;
    }
}