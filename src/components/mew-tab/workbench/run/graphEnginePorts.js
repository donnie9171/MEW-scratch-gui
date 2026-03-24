/**
 * Port-accurate graph helpers.
 * These are for runtime data routing (not sequencing).
 */

const entriesOf = obj => Object.entries(obj || {});

export const getIncomingEdges = (nodeId, nodes) => {
    const list = Array.isArray(nodes) ? nodes : [];
    const edges = [];

    list.forEach(source => {
        entriesOf(source.outputs).forEach(([fromPortId, targets]) => {
            (targets || []).forEach(target => {
                if (!target || target.nodeId !== nodeId) return;
                edges.push({
                    fromNodeId: source.id,
                    fromPortId,
                    toNodeId: nodeId,
                    toPortId: target.portId
                });
            });
        });
    });

    return edges;
};

export const getOutgoingEdges = (nodeId, nodes) => {
    const node = (nodes || []).find(n => n.id === nodeId);
    if (!node) return [];

    const edges = [];
    entriesOf(node.outputs).forEach(([fromPortId, targets]) => {
        (targets || []).forEach(target => {
            if (!target) return;
            edges.push({
                fromNodeId: nodeId,
                fromPortId,
                toNodeId: target.nodeId,
                toPortId: target.portId
            });
        });
    });

    return edges;
};

export const groupIncomingByInputPort = (nodeId, nodes) => {
    const grouped = {};
    getIncomingEdges(nodeId, nodes).forEach(edge => {
        if (!grouped[edge.toPortId]) grouped[edge.toPortId] = [];
        grouped[edge.toPortId].push(edge);
    });
    return grouped;
};

export const groupOutgoingByOutputPort = (nodeId, nodes) => {
    const grouped = {};
    getOutgoingEdges(nodeId, nodes).forEach(edge => {
        if (!grouped[edge.fromPortId]) grouped[edge.fromPortId] = [];
        grouped[edge.fromPortId].push(edge);
    });
    return grouped;
};