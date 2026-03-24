import {
    findClusters,
    identifyClusterForNode,
    topologicalSort
} from './graphEngineSequencing';

const byXThenId = (a, b) => {
    const dx = (a.x || 0) - (b.x || 0);
    if (dx !== 0) return dx;
    return String(a.id).localeCompare(String(b.id));
};

export const resolveUpstreamStartNode = (nodes, selectedNodeIds) => {
    if (!Array.isArray(selectedNodeIds) || selectedNodeIds.length === 0) return null;
    if (selectedNodeIds.length === 1) return selectedNodeIds[0];

    const selectedSet = new Set(selectedNodeIds);
    const nodeMap = new Map((nodes || []).map(n => [n.id, n]));

    // Build selected-only dependency counts: upstream -> downstream from outputs.
    const indegree = new Map(selectedNodeIds.map(id => [id, 0]));
    selectedNodeIds.forEach(sourceId => {
        const source = nodeMap.get(sourceId);
        if (!source) return;
        Object.values(source.outputs || {}).forEach(targets => {
            (targets || []).forEach(target => {
                if (!target?.nodeId || !selectedSet.has(target.nodeId)) return;
                indegree.set(target.nodeId, (indegree.get(target.nodeId) || 0) + 1);
            });
        });
    });

    const selectedRoots = selectedNodeIds
        .filter(id => (indegree.get(id) || 0) === 0)
        .map(id => nodeMap.get(id))
        .filter(Boolean)
        .sort(byXThenId);

    if (selectedRoots.length) return selectedRoots[0].id;

    // Fallback to cluster topological order if selected-only roots are unavailable.
    const clusters = findClusters(nodes || []);
    const clusterIndex = identifyClusterForNode(selectedNodeIds[0], clusters);
    if (clusterIndex === -1) return selectedNodeIds[0];

    try {
        const sorted = topologicalSort(clusters[clusterIndex]);
        const candidate = sorted.find(node => selectedSet.has(node.id));
        return candidate ? candidate.id : selectedNodeIds[0];
    } catch {
        // Cycle or invalid ordering; fallback deterministically.
        const fallback = selectedNodeIds
            .map(id => nodeMap.get(id))
            .filter(Boolean)
            .sort(byXThenId);
        return fallback[0]?.id || selectedNodeIds[0];
    }
};
