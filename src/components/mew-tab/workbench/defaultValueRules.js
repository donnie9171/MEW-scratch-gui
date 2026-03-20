const SEQ_TOKEN_REGEX = /\{seq:(\d+)\}/;

const pad = (n, width) => String(n).padStart(width, '0');

const getExistingValues = ({graph, nodeType, rowId, field = 'value', scope = 'nodeType'}) => {
    const values = new Set();
    const nodes = (graph?.nodes || []).filter(n => scope === 'global' || n.type === nodeType);

    for (const n of nodes) {
        const v = n?.data?.[rowId]?.[field];
        if (typeof v === 'string' || typeof v === 'number') values.add(String(v));
    }
    return values;
};

const resolveTemplateWithSeq = (template, existingValues) => {
    const match = template.match(SEQ_TOKEN_REGEX);
    if (!match) return template;

    const width = Number(match[1]) || 1;
    let i = 1;
    while (i < 1000000) {
        const candidate = template.replace(SEQ_TOKEN_REGEX, pad(i, width));
        if (!existingValues.has(candidate)) return candidate;
        i += 1;
    }
    return template.replace(SEQ_TOKEN_REGEX, pad(Date.now() % 1000, width));
};

export const resolveNodeDefaults = ({nodeType, definition, graph}) => {
    const data = {};
    const defaults = definition?.defaults;
    if (!defaults || !Array.isArray(defaults.rules)) return data;

    const scope = defaults.scope || 'nodeType';

    for (const rule of defaults.rules) {
        const rowId = rule?.rowId;
        const field = rule?.field || 'value';
        if (!rowId) continue;

        if (!data[rowId]) data[rowId] = {};

        if (rule.type === 'literal') {
            data[rowId][field] = rule.value;
            continue;
        }

        if (rule.type === 'template') {
            const existing = getExistingValues({graph, nodeType, rowId, field, scope});
            data[rowId][field] = resolveTemplateWithSeq(String(rule.template || ''), existing);
            continue;
        }

        if (rule.type === 'sequence') {
            const existing = getExistingValues({graph, nodeType, rowId, field, scope});
            const width = Number(rule.pad || 3);
            const prefix = rule.prefix || '';
            const suffix = rule.suffix || '';
            let i = Number(rule.start || 1);
            while (i < 1000000) {
                const candidate = `${prefix}${pad(i, width)}${suffix}`;
                if (!existing.has(candidate)) {
                    data[rowId][field] = candidate;
                    break;
                }
                i += 1;
            }
        }
    }

    return data;
};