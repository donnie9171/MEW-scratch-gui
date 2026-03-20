/**
 * Node catalog - defines all available node types and their row module compositions.
 * New schema:
 * {
 *   [type]: {
 *     rows: Array<RowDefinition>,
 *     defaults?: { scope?: 'nodeType' | 'global', rules: Array<DefaultRule> }
 *   }
 * }
 * Backward compatibility: array-only definitions are still accepted.
 */

export const NODE_DEFINITIONS = {
    Agent: {
        rows: [
            {
                id: 'name',
                type: 'textInput',
                props: {label: 'Name', placeholder: 'Agent name'},
                io: {
                    input: {portId: 'in_value'},
                    output: {portId: 'out_value'}
                }
            },
            {
                id: 'model',
                type: 'dropdown',
                props: {
                    label: 'model',
                    options: [
                        {value: 'gpt3.5 turbo', label: 'GPT3.5 Turbo'}
                    ],
                    defaultValue: 'gpt3.5 turbo'
                },
                io: {}
            }
        ],
        defaults: {
            scope: 'nodeType',
            rules: [
                {rowId: 'name', field: 'value', type: 'template', template: 'Agent {seq:3}'},
                {rowId: 'model', field: 'value', type: 'literal', value: 'gpt3.5 turbo'}
            ]
        }
    },

    Notepad: {
        rows: [
            {id: 'name', type: 'textInput', props: {label: 'Name', placeholder: 'Notepad name'}}
        ],
        defaults: {
            scope: 'nodeType',
            rules: [
                {rowId: 'name', field: 'value', type: 'template', template: 'Notepad {seq:3}'}
            ]
        }
    },

    Variable: {
        rows: [
            {id: 'title', type: 'title', props: {text: 'Variable'}}
        ]
    },

    Receiver: {
        rows: [
            {id: 'title', type: 'title', props: {text: 'Receiver'}}
        ]
    },

    Broadcaster: {
        rows: [
            {id: 'title', type: 'title', props: {text: 'Broadcaster'}}
        ]
    },

    Comment: {
        rows: [
            {id: 'title', type: 'title', props: {text: 'Comment'}}
        ]
    },

    Microphone: {
        rows: [
            {id: 'name', type: 'textInput', props: {label: 'Name', placeholder: 'Microphone name'}}
        ],
        defaults: {
            scope: 'nodeType',
            rules: [
                {rowId: 'name', field: 'value', type: 'template', template: 'Microphone {seq:3}'}
            ]
        }
    },

    Audio: {
        rows: [
            {id: 'name', type: 'textInput', props: {label: 'Name', placeholder: 'Audio name'}}
        ],
        defaults: {
            scope: 'nodeType',
            rules: [
                {rowId: 'name', field: 'value', type: 'template', template: 'Audio {seq:3}'}
            ]
        }
    },

    Servo: {
        rows: [
            {id: 'title', type: 'title', props: {text: 'Servo'}}
        ]
    }
};

const normalizeDefinition = definition => {
    if (Array.isArray(definition)) {
        return {rows: definition, defaults: null};
    }
    return {
        rows: definition?.rows || [],
        defaults: definition?.defaults || null
    };
};

/**
 * Get normalized node definition by type.
 * @param {string} nodeType
 * @returns {{rows: Array<Object>, defaults: Object|null}}
 */
export const getNodeDefinition = nodeType => normalizeDefinition(NODE_DEFINITIONS[nodeType]);

/**
 * Convenience: get row definitions only.
 * @param {string} nodeType
 * @returns {Array<Object>}
 */
export const getNodeRows = nodeType => getNodeDefinition(nodeType).rows;

/**
 * Convenience: get defaults config only.
 * @param {string} nodeType
 * @returns {Object|null}
 */
export const getNodeDefaults = nodeType => getNodeDefinition(nodeType).defaults;