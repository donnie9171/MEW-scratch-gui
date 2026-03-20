const SET_MEW_GRAPH = 'scratch-gui/mew-graph/SET_MEW_GRAPH';
const RESET_MEW_GRAPH = 'scratch-gui/mew-graph/RESET_MEW_GRAPH';

const createEmptyMewGraph = () => ({
    nodes: [],
    viewport: {panX: 0, panY: 0, zoom: 1},
    meta: {version: 1, updatedAt: new Date().toISOString()}
});

export const setMewGraph = graph => ({
    type: SET_MEW_GRAPH,
    graph
});

export const resetMewGraph = () => ({
    type: RESET_MEW_GRAPH
});

export const getMewGraph = state => state.scratchGui?.mewGraph || null;

const initialState = null;

const reducer = (state = initialState, action) => {
    switch (action.type) {
    case SET_MEW_GRAPH:
        return action.graph;
    case RESET_MEW_GRAPH:
        return createEmptyMewGraph();
    default:
        return state;
    }
};

export default reducer;