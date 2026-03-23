const buildAdjacency = nodes => {
    const map = new Map((nodes || []).map(n => [n.id, new Set()]));

    (nodes || []).forEach(node => {
        Object.values(node.outputs || {}).forEach(targets => {
            (targets || []).forEach(t => {
                if (!map.has(node.id) || !map.has(t.nodeId)) return;
                map.get(node.id).add(t.nodeId);
                map.get(t.nodeId).add(node.id);
            });
        });

        Object.values(node.inputs || {}).forEach(sources => {
            (sources || []).forEach(s => {
                if (!map.has(node.id) || !map.has(s.nodeId)) return;
                map.get(node.id).add(s.nodeId);
                map.get(s.nodeId).add(node.id);
            });
        });
    });

    return map;
};

export const areNodeIdsConnected = (nodes, nodeIds) => {
    if (!nodeIds || nodeIds.length === 0) return false;
    if (nodeIds.length === 1) return true;

    const selected = new Set(nodeIds);
    const adjacency = buildAdjacency(nodes);

    const start = nodeIds[0];
    const visited = new Set([start]);
    const queue = [start];

    while (queue.length) {
        const cur = queue.shift();
        (adjacency.get(cur) || new Set()).forEach(next => {
            if (visited.has(next)) return;
            visited.add(next);
            queue.push(next);
        });
    }

    return [...selected].every(id => visited.has(id));
};