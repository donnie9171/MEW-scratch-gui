// reference code from v1, not to be used 

// 1. Define the runtimeState object
const runtimeState = {
    nodesState: {
        // "nodeID": {
        //   cluster: 0,
        //   sortOrder: 0,
        //   runStatus: "queued" | "running" | "error" | "complete",
        //   outputValue: null,
        // }
    },
    getNodeById(id) {
        return window.nodeData.find(node => node.id === id);
    },
    setNodeState(id, state) {
        if (!this.nodesState[id]) this.nodesState[id] = {};
        Object.assign(this.nodesState[id], state);
    },
    getNodeState(id) {
        return this.nodesState[id] || {};
    }
};

window.runtimeState = runtimeState;

// 2. Choose the correct runner class based on node type
function getRunnerForNode(node) {
    switch (node.type) {
        case 'tool':
            if (node.toolType === 'variable') return new window.RunVariableNode(node, runtimeState);
            if (node.toolType === 'notepad') return new window.RunTextNode(node, runtimeState);
            if (node.toolType === 'costume') return new window.RunCostumeNode(node, runtimeState);
            if (node.toolType === 'gate') return new window.RunGateNode(node, runtimeState);
            if (node.toolType === 'servo') return new window.RunServoNode(node, runtimeState);
            if (node.toolType === 'audio-observer') return new window.RunAudioObserverNode(node, runtimeState);
            if (node.toolType === 'microphone') return new window.RunMicrophoneNode(node, runtimeState);
            // Add more tool types as needed
            break;
        case 'agent':
            return new window.RunAgentNode(node, runtimeState);
        case 'receiver':
            return new window.RunReceiverNode(node, runtimeState);
        case 'broadcaster':
            return new window.RunBroadcasterNode(node, runtimeState);
        case 'comment':
            return new window.RunCommentNode(node, runtimeState);
        default:
            return new window.RunNode(node, runtimeState); // fallback
    }
}

// 3. Run a node by ID
async function runNodeById(nodeId) {
    const node = runtimeState.getNodeById(nodeId);
    if (!node) {
        console.warn('Node not found:', nodeId);
        return;
    }
    const runner = getRunnerForNode(node);
    // Default: no triggering input node for manual/cluster run
    await runner.run();
}

// Helper: Find all clusters (connected components)
function findClusters(nodes) {
    const visited = new Set();
    const clusters = [];

    function dfs(node, cluster) {
        visited.add(node.id);
        cluster.push(node);
        const neighbors = [...(node.inputs || []), ...(node.outputs || [])]
            .map(id => nodes.find(n => n.id === id))
            .filter(Boolean);
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor.id)) {
                dfs(neighbor, cluster);
            }
        }
    }

    for (const node of nodes) {
        if (!visited.has(node.id)) {
            const cluster = [];
            dfs(node, cluster);
            clusters.push(cluster);
        }
    }
    return clusters;
}

function identifyClusterForNode(nodeId) {
    const nodes = window.nodeData;
    const clusters = findClusters(nodes);
    for (let i = 0; i < clusters.length; i++) {
        if (clusters[i].some(n => n.id === nodeId)) {
            return i;
        }
    }
    return -1; // Not found
}

window.identifyClusterForNode = identifyClusterForNode;

// Helper: Topological sort for a cluster
function topologicalSort(cluster) {
    const sorted = [];
    const visited = new Set();
    const temp = new Set();

    const nodeMap = Object.fromEntries(cluster.map(n => [n.id, n]));

    function visit(node) {
        if (visited.has(node.id)) return;
        if (temp.has(node.id)) throw new Error('Cycle detected in node graph!');
        temp.add(node.id);
        for (const inputId of node.inputs || []) {
            if (nodeMap[inputId]) visit(nodeMap[inputId]);
        }
        temp.delete(node.id);
        visited.add(node.id);
        sorted.push(node);
    }

    for (const node of cluster) {
        if (!visited.has(node.id)) visit(node);
    }
    return sorted;
}

window.runningClusters = {}; // To track running clusters
console.log("Initialized window.runningClusters", window.runningClusters);

async function runNodeCluster(nodeId){
    const nodes = window.nodeData;
    const clusters = findClusters(nodes);

    const clusterIdx = clusters.findIndex(cluster =>
        cluster.some(node => node.id === nodeId)
    );

    // Map nodeId to cluster index and sort order for debugging
    const nodeDebugInfo = {};

    clusters.forEach((cluster, clusterIdx) => {
        const ordered = topologicalSort(cluster);
        ordered.forEach((node, sortIdx) => {
            nodeDebugInfo[node.id] = {
                cluster: clusterIdx,
                sortOrder: sortIdx
            };
            // Store cluster and sortOrder in runtimeState
            runtimeState.setNodeState(node.id, {
                cluster: clusterIdx,
                sortOrder: sortIdx
            });
        });
    });

    // Attach debug info to node DOM elements
    clusters.forEach((cluster, clusterIdx) => {
        const ordered = topologicalSort(cluster);
        ordered.forEach((node, sortIdx) => {
            const el = document.querySelector(`.card[data-id="${node.id}"]`);
            if (el) {
                el.title = `Cluster: ${clusterIdx}, Order: ${sortIdx}`;
                runtimeState.setNodeState(node.id, { cluster: clusterIdx, sortOrder: sortIdx });
            }
        });
    });

    if (clusterIdx < 0 || clusterIdx >= clusters.length) {
        console.warn('Invalid cluster index:', clusterIdx);
        return;
    }
    const ordered = topologicalSort(clusters[clusterIdx]);
    window.runningClusters[clusterIdx] = true;
    console.log("Running clusters: ", window.runningClusters);
    for (const node of ordered){
        runtimeState.setNodeState(node.id, { runStatus: "queued" });
        window.updateNodeRunStatusBadge(node);
    }
    // Track which node triggered each node (for passing triggeringInputNodeId)
    const triggeredBy = {};
    // The first node in the cluster is triggered manually (no input)
    for (let i = 0; i < ordered.length; i++) {
        const node = ordered[i];
        const runner = getRunnerForNode(node);
        const el = document.querySelector(`.card[data-id="${node.id}"]`);
        runtimeState.setNodeState(node.id, { runStatus: "running" });
        window.updateNodeRunStatusBadge(node);
        try {
            // Pass the triggering node's ID if available
            const triggerId = triggeredBy[node.id];
            await runner.run(triggerId);
            runtimeState.setNodeState(node.id, { runStatus: "complete" });
            window.updateNodeRunStatusBadge(node);
            // After running, mark all outputs as triggered by this node
            if (node.outputs && node.outputs.length > 0) {
                for (const outId of node.outputs) {
                    // Only set if not already set (first trigger wins)
                    if (!triggeredBy[outId]) triggeredBy[outId] = node.id;
                }
            }
        } catch (e) {
            runtimeState.setNodeState(node.id, { runStatus: "error" });
            window.updateNodeRunStatusBadge(node);
            // make sure the execution stops on error
            console.error(`Error running node ${node.id}:`, e);
            break;
        }
    }
    delete window.runningClusters[clusterIdx];
    console.log("Running clusters: ", window.runningClusters);
}

window.runNodeCluster = runNodeCluster;