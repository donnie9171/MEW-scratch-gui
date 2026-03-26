// Notepad template value model shared by row modules and runners.
// Source of truth for mixed text + placeholder segments.

const TEMPLATE_VERSION = 1;

export const DEFAULT_DISPLAY_FIELD_BY_NODE_TYPE = {
    Agent: 'name',
    Variable: 'variableName',
    Receiver: 'title',
    Broadcaster: 'title',
    Servo: 'title',
    Audio: 'name',
    Microphone: 'name',
    Notepad: 'name'
};

const makeId = prefix => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const toSafeString = value => {
    if (value === undefined || value === null) return '';
    return String(value);
};

const readRowValue = (node, rowId) => {
    if (!node || !rowId) return undefined;
    const row = node.data && node.data[rowId];
    if (row && Object.prototype.hasOwnProperty.call(row, 'value')) return row.value;
    return undefined;
};

const readDisplayField = (node, fieldName) => {
    if (!node || !fieldName) return undefined;

    // Preferred shape: node.data[fieldName].value
    const rowValue = readRowValue(node, fieldName);
    if (rowValue !== undefined && rowValue !== null && rowValue !== '') return rowValue;

    // Fallback: node.data[fieldName]
    const direct = node.data && node.data[fieldName];
    if (typeof direct === 'string' || typeof direct === 'number' || typeof direct === 'boolean') {
        return direct;
    }

    return undefined;
};

export const createTextSegment = (text = '') => ({
    id: makeId('txt'),
    type: 'text',
    text: String(text)
});

export const createTokenSegment = ({
    sourceNodeId,
    sourcePortId = 'out_value',
    label = '',
    alias = '',
    resolverField = null
}) => ({
    id: makeId('tok'),
    type: 'token',
    sourceNodeId: String(sourceNodeId || ''),
    sourcePortId: String(sourcePortId || 'out_value'),
    label: String(label || ''),
    alias: String(alias || ''),
    resolverField: resolverField ? String(resolverField) : null
});

export const createEmptyTemplateValue = () => ({
    version: TEMPLATE_VERSION,
    segments: [createTextSegment('')],
    // Optional per-node-type display field preference for token labels.
    // Example: { Agent: 'name', Variable: 'variableName', Receiver: 'title' }
    displayFieldByNodeType: {}
});

const isTextSegment = s => s && s.type === 'text' && typeof s.text === 'string';

const isTokenSegment = s => (
    s &&
    s.type === 'token' &&
    typeof s.sourceNodeId === 'string' &&
    typeof s.sourcePortId === 'string'
);

export const normalizeTemplateValue = raw => {
    if (!raw || typeof raw !== 'object') return createEmptyTemplateValue();

    const version = Number(raw.version) || TEMPLATE_VERSION;

    const inputSegments = Array.isArray(raw.segments) ? raw.segments : [];
    const segments = inputSegments
        .map(seg => {
            if (isTextSegment(seg)) {
                return {
                    id: seg.id || makeId('txt'),
                    type: 'text',
                    text: seg.text
                };
            }

            if (isTokenSegment(seg)) {
                return {
                    id: seg.id || makeId('tok'),
                    type: 'token',
                    sourceNodeId: seg.sourceNodeId,
                    sourcePortId: seg.sourcePortId,
                    label: String(seg.label || ''),
                    alias: String(seg.alias || ''),
                    resolverField: seg.resolverField ? String(seg.resolverField) : null
                };
            }

            return null;
        })
        .filter(Boolean);

    return {
        version,
        segments: segments.length ? segments : [createTextSegment('')],
        displayFieldByNodeType:
            raw.displayFieldByNodeType && typeof raw.displayFieldByNodeType === 'object'
                ? {...raw.displayFieldByNodeType}
                : {}
    };
};

export const getTokenRefs = templateValue => {
    const t = normalizeTemplateValue(templateValue);
    return t.segments
        .filter(seg => seg.type === 'token')
        .map(seg => ({sourceNodeId: seg.sourceNodeId, sourcePortId: seg.sourcePortId}));
};

export const resolveNodeDisplayLabel = ({
    sourceNode,
    displayFieldByNodeType = {},
    defaultDisplayFieldByNodeType = DEFAULT_DISPLAY_FIELD_BY_NODE_TYPE
}) => {
    if (!sourceNode) {
        return {label: '', resolverFieldUsed: null};
    }

    const nodeType = sourceNode.type || '';
    const preferredField =
        displayFieldByNodeType[nodeType] ||
        defaultDisplayFieldByNodeType[nodeType] ||
        null;

    const fallbackFields = ['name', 'title', 'variableName'];
    const fieldOrder = preferredField
        ? [preferredField].concat(fallbackFields.filter(f => f !== preferredField))
        : fallbackFields;

    for (let i = 0; i < fieldOrder.length; i += 1) {
        const field = fieldOrder[i];
        const value = readDisplayField(sourceNode, field);
        if (value !== undefined && value !== null && value !== '') {
            return {label: toSafeString(value), resolverFieldUsed: field};
        }
    }

    const shortId = toSafeString(sourceNode.id || '').slice(-4) || 'node';
    const fallbackLabel = `${nodeType || 'Node'} ${shortId}`;
    return {label: fallbackLabel, resolverFieldUsed: null};
};

export const getConnectedUpstreamSourcesForTemplate = ({
    targetNode,
    nodes = [],
    templateValue
}) => {
    if (!targetNode || !Array.isArray(nodes)) return [];

    const t = normalizeTemplateValue(templateValue);
    const displayFieldByNodeType = t.displayFieldByNodeType || {};

    const targetNodeId = String(targetNode.id || '');
    const allRefs = [];

    // Primary source of truth: scan all outputs for edges into targetNode.
    nodes.forEach(sourceNode => {
        const sourceNodeId = String(sourceNode?.id || '');
        if (!sourceNodeId) return;

        const outputs = sourceNode?.outputs || {};
        Object.keys(outputs).forEach(outPortId => {
            const targets = Array.isArray(outputs[outPortId]) ? outputs[outPortId] : [];
            targets.forEach(target => {
                if (!target || !target.nodeId) return;
                if (String(target.nodeId) !== targetNodeId) return;

                allRefs.push({
                    sourceNodeId,
                    sourcePortId: String(outPortId || target.portId || 'out_value'),
                    targetInputPortId: String(target.portId || 'in_value')
                });
            });
        });
    });

    // Fallback for legacy/incomplete graphs that only have inputs.
    if (!allRefs.length) {
        const inMap = targetNode.inputs || {};
        Object.keys(inMap).forEach(inPortId => {
            const refs = Array.isArray(inMap[inPortId]) ? inMap[inPortId] : [];
            refs.forEach(ref => {
                if (!ref || !ref.nodeId) return;
                allRefs.push({
                    sourceNodeId: String(ref.nodeId),
                    sourcePortId: String(ref.portId || 'out_value'),
                    targetInputPortId: String(inPortId)
                });
            });
        });
    }

    const dedupMap = new Map();
    allRefs.forEach(ref => {
        const key = `${ref.sourceNodeId}:${ref.sourcePortId}:${ref.targetInputPortId}`;
        if (!dedupMap.has(key)) dedupMap.set(key, ref);
    });

    const nodeById = new Map(nodes.map(n => [String(n.id), n]));

    const result = Array.from(dedupMap.values()).map(ref => {
        const sourceNode = nodeById.get(ref.sourceNodeId);
        const resolved = resolveNodeDisplayLabel({
            sourceNode,
            displayFieldByNodeType
        });

        return {
            sourceNodeId: ref.sourceNodeId,
            sourcePortId: ref.sourcePortId,
            targetInputPortId: ref.targetInputPortId,
            sourceNodeType: sourceNode ? sourceNode.type : null,
            label: resolved.label,
            resolverFieldUsed: resolved.resolverFieldUsed
        };
    });

    return result;
};

export const getConnectedUpstreamSourcesFromEdges = ({
    targetNodeId,
    nodes = [],
    edges = [],
    templateValue
}) => {
    if (!targetNodeId || !Array.isArray(nodes) || !Array.isArray(edges)) return [];

    const t = normalizeTemplateValue(templateValue);
    const displayFieldByNodeType = t.displayFieldByNodeType || {};
    const nodeById = new Map(nodes.map(n => [String(n.id), n]));
    const dedup = new Map();

    edges.forEach(edge => {
        if (String(edge.toNodeId) !== String(targetNodeId)) return;

        const sourceNode = nodeById.get(String(edge.fromNodeId));
        const resolved = resolveNodeDisplayLabel({
            sourceNode,
            displayFieldByNodeType
        });

        const item = {
            sourceNodeId: String(edge.fromNodeId),
            sourcePortId: String(edge.fromPortId || 'out_value'),
            targetInputPortId: String(edge.toPortId || 'in_value'),
            sourceNodeType: sourceNode ? sourceNode.type : null,
            label: resolved.label,
            resolverFieldUsed: resolved.resolverFieldUsed
        };

        const key = `${item.sourceNodeId}:${item.sourcePortId}:${item.targetInputPortId}`;
        dedup.set(key, item);
    });

    return Array.from(dedup.values());
};

export const renderTemplateWithDiagnostics = (templateValue, resolveTokenValue) => {
    const t = normalizeTemplateValue(templateValue);
    const unresolvedTokens = [];
    const parts = t.segments.map(seg => {
        if (seg.type === 'text') return seg.text;

        const tokenRef = {
            sourceNodeId: seg.sourceNodeId,
            sourcePortId: seg.sourcePortId,
            label: seg.label,
            alias: seg.alias
        };

        const resolved = resolveTokenValue ? resolveTokenValue(tokenRef) : '';

        if (resolved === undefined || resolved === null) {
            unresolvedTokens.push(tokenRef);
            return '';
        }
        if (typeof resolved === 'string') return resolved;
        if (typeof resolved === 'number' || typeof resolved === 'boolean') return String(resolved);
        return JSON.stringify(resolved);
    });

    return {
        text: parts.join(''),
        unresolvedTokens
    };
};

export const renderTemplateToString = (templateValue, resolveTokenValue) => (
    renderTemplateWithDiagnostics(templateValue, resolveTokenValue).text
);