export const setNodesStatus = (nodes, nodeIds, status, rowId = 'state') => {
    const set = new Set(nodeIds || []);
    return (nodes || []).map(n => {
        if (!set.has(n.id)) return n;
        return {
            ...n,
            data: {
                ...(n.data || {}),
                [rowId]: {
                    ...((n.data && n.data[rowId]) || {}),
                    value: status
                }
            }
        };
    });
};