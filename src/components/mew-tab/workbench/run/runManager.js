import {
    findClusters,
    topologicalSort,
    identifyClusterForNode
} from './graphEngineSequencing';
import {createRuntimeStore} from './runtimeStore';
import {createRunnerForNode} from './runnerRegistry';

const buildNodeMap = nodes => new Map((nodes || []).map(n => [n.id, n]));

const hasConnectedOutputs = node => {
    const outputs = node?.outputs ? Object.values(node.outputs) : [];
    return outputs.some(targets => (targets || []).some(target => Boolean(target?.nodeId)));
};

export const createRunManager = ({
    getGraph,
    getVm,
    applyNodeStatus,
    applyNodeRuntimePatch,
    onExecutionEvent
}) => {
    const runtimeStore = createRuntimeStore();

    let isRunning = false;

    const emit = (type, payload = {}) => {
        if (typeof onExecutionEvent === 'function') onExecutionEvent({type, ...payload});
    };

    const setStatus = (nodeId, status) => {
        runtimeStore.setNodeState(nodeId, {runStatus: status});
        if (typeof applyNodeStatus === 'function') applyNodeStatus(nodeId, status);
    };

    const patchRuntime = (nodeId, patch) => {
        runtimeStore.setNodeState(nodeId, patch);
        if (typeof applyNodeRuntimePatch === 'function') applyNodeRuntimePatch(nodeId, patch);
    };

    const patchNodeData = (nodeId, rowId, field, value) => {
        if (typeof applyNodeDataPatch === 'function') {
            applyNodeDataPatch(nodeId, rowId, field, value);
        }
    };

    const runNodeById = async nodeId => {
        const graph = getGraph();
        const nodes = graph?.nodes || [];
        const nodeMap = buildNodeMap(nodes);
        const node = nodeMap.get(nodeId);
        if (!node) throw new Error(`runNodeById: node not found: ${nodeId}`);

        const context = {
            nodes,
            runtimeStore,
            graph,
            vm: typeof getVm === 'function' ? getVm() : null,
            patchRuntime: (id, patch) => patchRuntime(id, patch),
            patchNodeData: (id, rowId, field, value) => patchNodeData(id, rowId, field, value)
        };
        const runner = createRunnerForNode(node, context);

        setStatus(node.id, 'running');
        emit('nodeStarted', {nodeId: node.id});

        try {
            await runner.run({triggeredBy: null});
            const isLeafNode = !hasConnectedOutputs(node);
            patchRuntime(node.id, {
                outputsByPort: runtimeStore.getNodeState(node.id).outputsByPort || {},
                tooltipAutoShowUntil: isLeafNode ? Date.now() + 5000 : undefined
            });
            emit('nodeCompleted', {nodeId: node.id});
        } catch (error) {
            setStatus(node.id, 'error');
            patchRuntime(node.id, {error: String(error?.message || error)});
            emit('nodeFailed', {nodeId: node.id, error});
            throw error;
        }
    };

    const runNodeCluster = async startNodeId => {
        if (isRunning) {
            throw new Error('runNodeCluster: execution already in progress');
        }

        isRunning = true;
        let clusterIndex = null;
        let markedRunning = false;

        try {
            const graph = getGraph();
            const nodes = graph?.nodes || [];

            const clusters = findClusters(nodes);
            clusterIndex = identifyClusterForNode(startNodeId, clusters);
            if (clusterIndex === -1) {
                throw new Error(`runNodeCluster: start node not found in any cluster: ${startNodeId}`);
            }

            const clusterNodes = clusters[clusterIndex];
            const sortedNodes = topologicalSort(clusterNodes);

            runtimeStore.markClusterRunning(clusterIndex);
            markedRunning = true;

            emit('clusterStarted', {clusterIndex, startNodeId});

            const clusterSet = new Set(clusterNodes.map(n => n.id));
            nodes.forEach(n => {
                if (!clusterSet.has(n.id)) setStatus(n.id, 'null');
            });

            sortedNodes.forEach((node, order) => {
                patchRuntime(node.id, {cluster: clusterIndex, sortOrder: order});
                setStatus(node.id, 'queued');
                emit('nodeQueued', {nodeId: node.id, clusterIndex, sortOrder: order});
            });

            const triggeredBy = {};

            for (const node of sortedNodes) {
                const runner = createRunnerForNode(node, {
                    nodes,
                    runtimeStore,
                    graph,
                    vm: typeof getVm === 'function' ? getVm() : null,
                    patchRuntime: (id, patch) => patchRuntime(id, patch),
                    patchNodeData: (id, rowId, field, value) => patchNodeData(id, rowId, field, value)
                });

                setStatus(node.id, 'running');
                emit('nodeStarted', {
                    nodeId: node.id,
                    clusterIndex,
                    triggeredBy: triggeredBy[node.id] || null
                });

                try {
                    await runner.run({triggeredBy: triggeredBy[node.id] || null});
                } catch (error) {
                    setStatus(node.id, 'error');
                    patchRuntime(node.id, {error: String(error?.message || error)});
                    emit('nodeFailed', {nodeId: node.id, clusterIndex, error});
                    emit('clusterFailed', {clusterIndex, startNodeId, error});
                    throw error;
                }

                const isLeafNode = !hasConnectedOutputs(node);
                patchRuntime(node.id, {
                    outputsByPort: runtimeStore.getNodeState(node.id).outputsByPort || {},
                    tooltipAutoShowUntil: isLeafNode ? Date.now() + 5000 : undefined
                });
                setStatus(node.id, 'complete');
                emit('nodeCompleted', {nodeId: node.id, clusterIndex});

                (node.outputs ? Object.values(node.outputs) : []).forEach(targets => {
                    (targets || []).forEach(target => {
                        if (!target?.nodeId) return;
                        if (!Object.prototype.hasOwnProperty.call(triggeredBy, target.nodeId)) {
                            triggeredBy[target.nodeId] = node.id;
                        }
                    });
                });
            }

            emit('clusterCompleted', {clusterIndex, startNodeId});
        } finally {
            if (markedRunning && clusterIndex !== null) {
                runtimeStore.unmarkClusterRunning(clusterIndex);
            }
            isRunning = false;
        }
    };

    const reset = () => {
        runtimeStore.reset();
        emit('runtimeReset');
    };

    return {
        runNodeById,
        runNodeCluster,
        reset,
        runtimeStore
    };
};