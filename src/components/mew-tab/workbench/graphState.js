export const createEmptyGraph = () => ({
    nodes: [],
    viewport: { panX: 0, panY: 0, zoom: 1 },
    meta: { version: 1, updatedAt: new Date().toISOString() }
});

export const deriveEdges = (nodes = []) => {
    const edges = [];

    for (const fromNode of nodes) {
        const outputs = fromNode.outputs || {};
        for (const [fromPortId, targets] of Object.entries(outputs)) {
            for (const target of targets || []) {
                if (!target?.nodeId || !target?.portId) continue;
                edges.push({
                    id: `${fromNode.id}:${fromPortId}->${target.nodeId}:${target.portId}`,
                    fromNodeId: fromNode.id,
                    fromPortId,
                    toNodeId: target.nodeId,
                    toPortId: target.portId
                });
            }
        }
    }

    return edges;
};

export const validateGraph = graph => {
    if (!graph || !Array.isArray(graph.nodes)) {
        return { valid: false, errors: ['graph.nodes must be an array'] };
    }

    const ids = new Set();
    const errors = [];

    for (const node of graph.nodes) {
        if (!node?.id) errors.push('node.id is required');
        if (node?.id && ids.has(node.id)) errors.push(`duplicate node id: ${node.id}`);
        if (node?.id) ids.add(node.id);

        if (typeof node?.x !== 'number' || typeof node?.y !== 'number') {
            errors.push(`node ${node?.id || '(unknown)'} must have numeric x/y`);
        }
    }

    return { valid: errors.length === 0, errors };
};

export const serializeGraph = graph => JSON.stringify(graph);

export const deserializeGraph = raw => {
    const parsed = JSON.parse(raw);
    const check = validateGraph(parsed);
    if (!check.valid) throw new Error(`Invalid graph: ${check.errors.join('; ')}`);
    return parsed;
};