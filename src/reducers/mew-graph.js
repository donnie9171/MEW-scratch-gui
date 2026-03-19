const SET_MEW_GRAPH = 'scratch-gui/mew-graph/SET_MEW_GRAPH';

export const setMewGraph = graph => ({
    type: SET_MEW_GRAPH,
    graph
});

export const getMewGraph = state => state.scratchGui?.mewGraph || null;

const initialState = null;

const reducer = (state = initialState, action) => {
    switch (action.type) {
    case SET_MEW_GRAPH:
        return action.graph;
    default:
        return state;
    }
};

export default reducer;