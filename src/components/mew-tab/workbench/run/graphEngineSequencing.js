/**
 * Sequencing-only graph helpers.
 *
 * IMPORTANT:
 * - These functions normalize to node-level relationships for ordering/connectivity.
 * - Port IDs are intentionally ignored here.
 * - Port-accurate value routing should happen in a separate runtime/ports module.
 */

const toNodeIdListFromPortMap = portMap => {
    if (!portMap || typeof portMap !== 'object') return [];
    const ids = [];

    Object.values(portMap).forEach(edges => {
        (edges || []).forEach(edge => {
            if (edge && edge.nodeId) ids.push(edge.nodeId);
        });
    });

    return ids;
};

const getNodeMap = nodes => new Map((nodes || []).map(n => [n.id, n]));

const getUndirectedNeighbors = (node, nodeMap) => {
    const neighbors = new Set();

    // inputs -> upstream neighbors
    toNodeIdListFromPortMap(node.inputs).forEach(id => {
        if (nodeMap.has(id) && id !== node.id) neighbors.add(id);
    });

    // outputs -> downstream neighbors
    toNodeIdListFromPortMap(node.outputs).forEach(id => {
        if (nodeMap.has(id) && id !== node.id) neighbors.add(id);
    });

    return neighbors;
};

const buildDependencyMap = nodes => {
    // dependencyMap[nodeId] = Set(upstream nodeIds that must run first)
    const nodeMap = getNodeMap(nodes);
    const dependencyMap = new Map((nodes || []).map(n => [n.id, new Set()]));

    // 1) direct from inputs (preferred)
    (nodes || []).forEach(node => {
        const deps = dependencyMap.get(node.id);
        toNodeIdListFromPortMap(node.inputs).forEach(upId => {
            if (nodeMap.has(upId) && upId !== node.id) deps.add(upId);
        });
    });

    // 2) reinforce from outputs (in case inputs are sparse/derived)
    (nodes || []).forEach(source => {
        toNodeIdListFromPortMap(source.outputs).forEach(targetId => {
            if (!dependencyMap.has(targetId) || targetId === source.id) return;
            dependencyMap.get(targetId).add(source.id);
        });
    });

    return dependencyMap;
};

/**
 * Find connected components (clusters), treating edges as undirected.
 * Returns: Array<Array<Node>>
 */
export const findClusters = nodes => {
    const list = Array.isArray(nodes) ? nodes : [];
    const nodeMap = getNodeMap(list);
    const visited = new Set();
    const clusters = [];

    list.forEach(startNode => {
        if (visited.has(startNode.id)) return;

        const stack = [startNode.id];
        visited.add(startNode.id);
        const clusterIds = [];

        while (stack.length) {
            const currentId = stack.pop();
            const currentNode = nodeMap.get(currentId);
            if (!currentNode) continue;

            clusterIds.push(currentId);

            const neighbors = getUndirectedNeighbors(currentNode, nodeMap);
            neighbors.forEach(neighborId => {
                if (visited.has(neighborId)) return;
                visited.add(neighborId);
                stack.push(neighborId);
            });
        }

        clusters.push(clusterIds.map(id => nodeMap.get(id)).filter(Boolean));
    });

    return clusters;
};

/**
 * Topological sort within a cluster.
 * Input: Array<Node>
 * Output: Array<Node> in dependency order.
 * Throws on cycle.
 */
export const topologicalSort = clusterNodes => {
    const nodes = Array.isArray(clusterNodes) ? clusterNodes : [];
    const nodeMap = getNodeMap(nodes);
    const deps = buildDependencyMap(nodes);

    // Keep only dependencies inside this cluster.
    deps.forEach((depSet, nodeId) => {
        const filtered = new Set([...depSet].filter(depId => nodeMap.has(depId)));
        deps.set(nodeId, filtered);
    });

    // Kahn's algorithm.
    const indegree = new Map();
    deps.forEach((depSet, nodeId) => indegree.set(nodeId, depSet.size));

    const reverse = new Map((nodes || []).map(n => [n.id, new Set()]));
    deps.forEach((depSet, nodeId) => {
        depSet.forEach(depId => {
            if (!reverse.has(depId)) reverse.set(depId, new Set());
            reverse.get(depId).add(nodeId);
        });
    });

    const queue = [];
    indegree.forEach((deg, nodeId) => {
        if (deg === 0) queue.push(nodeId);
    });

    // Deterministic order.
    queue.sort();

    const orderedIds = [];
    while (queue.length) {
        const currentId = queue.shift();
        orderedIds.push(currentId);

        (reverse.get(currentId) || new Set()).forEach(downstreamId => {
            const nextDeg = (indegree.get(downstreamId) || 0) - 1;
            indegree.set(downstreamId, nextDeg);
            if (nextDeg === 0) {
                queue.push(downstreamId);
                queue.sort();
            }
        });
    }

    if (orderedIds.length !== nodes.length) {
        const remaining = nodes
            .map(n => n.id)
            .filter(id => !orderedIds.includes(id));
        throw new Error(
            `Cycle detected in cluster. Remaining nodes: ${remaining.join(', ')}`
        );
    }

    return orderedIds.map(id => nodeMap.get(id)).filter(Boolean);
};

/**
 * Returns the index of the cluster containing nodeId, or -1 if not found.
 */
export const identifyClusterForNode = (nodeId, clusters) => {
    const list = Array.isArray(clusters) ? clusters : [];
    for (let i = 0; i < list.length; i += 1) {
        if ((list[i] || []).some(node => node && node.id === nodeId)) return i;
    }
    return -1;
};