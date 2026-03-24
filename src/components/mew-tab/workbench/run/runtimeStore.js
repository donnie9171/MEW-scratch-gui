/**
 * Runtime execution store (in-memory, per run session).
 * Keeps execution metadata separate from graph source of truth.
 */

const createInitialState = () => ({
    nodesState: {},       // nodeId -> runtime fields
    runningClusters: new Set()
});

export const createRuntimeStore = () => {
    let state = createInitialState();

    const getState = () => state;

    const reset = () => {
        state = createInitialState();
    };

    const getNodeState = nodeId => state.nodesState[nodeId] || {};

    const setNodeState = (nodeId, patch) => {
        state = {
            ...state,
            nodesState: {
                ...state.nodesState,
                [nodeId]: {
                    ...getNodeState(nodeId),
                    ...patch
                }
            }
        };
        return state.nodesState[nodeId];
    };

    const getOutputValue = (nodeId, outPortId) => {
        const outputsByPort = getNodeState(nodeId).outputsByPort || {};
        return outputsByPort[outPortId];
    };

    const setOutputValue = (nodeId, outPortId, value) => {
        const nodeState = getNodeState(nodeId);
        const outputsByPort = {
            ...(nodeState.outputsByPort || {}),
            [outPortId]: value
        };
        setNodeState(nodeId, {outputsByPort});
        return value;
    };

    const markClusterRunning = clusterIndex => {
        const next = new Set(state.runningClusters);
        next.add(clusterIndex);
        state = {...state, runningClusters: next};
    };

    const unmarkClusterRunning = clusterIndex => {
        const next = new Set(state.runningClusters);
        next.delete(clusterIndex);
        state = {...state, runningClusters: next};
    };

    return {
        getState,
        reset,
        getNodeState,
        setNodeState,
        getOutputValue,
        setOutputValue,
        markClusterRunning,
        unmarkClusterRunning
    };
};