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

import {BiSolidNotepad} from 'react-icons/bi';
import { TbCalculatorFilled } from "react-icons/tb";
import { RiRadarFill } from "react-icons/ri";
import { TbBuildingBroadcastTowerFilled } from "react-icons/tb";
import { TiMicrophone } from "react-icons/ti";
import { FaIdCardAlt } from "react-icons/fa";
import { FaGears } from "react-icons/fa6";
import { LuAudioWaveform } from "react-icons/lu";
import { FaNoteSticky } from "react-icons/fa6";

import {createEmptyTemplateValue} from './row-modules/utils/notepadTemplateValue';






export const NODE_DEFINITIONS = {
    Agent: {
        rows: [
            { id: 'state', type: 'status', props: {label: "Agent", icon: FaIdCardAlt},                 io: {
                    input: {portId: 'in_value'},
                    output: {portId: 'out_value'}
                }},
            {
                id: 'name',
                type: 'textInput',
                props: {label: 'Name', placeholder: 'Agent name'},
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
            { id: 'state', type: 'status', props: {label: "Notepad", icon: BiSolidNotepad}, io: {
                input: {portId: 'in_value'},
                output: {portId: 'out_value'}
            }},
            {id: 'name', type: 'textInput', props: {label: 'Name', placeholder: 'Notepad name'}},
            {id: 'prompt', type: 'notepadTemplate', props: {placeholder: 'Compose prompt with placeholders...'}}
        ],
        defaults: {
            scope: 'nodeType',
            rules: [
                {rowId: 'name', field: 'value', type: 'template', template: 'Notepad {seq:3}'},
                {rowId: 'prompt', field: 'value', type: 'literal', value: createEmptyTemplateValue()}
            ]
        }
    },

    Variable: {
        rows: [
            { id: 'state', type: 'status', props: {label: "Variable", icon: TbCalculatorFilled}, io: {
                    input: {portId: 'in_value'},
                    output: {portId: 'out_value'}
                }},
            {
                id: 'variableName',
                type: 'dropdown',
                props: {
                    label: 'variableName',
                    options: [
                        {value: 'myvariable', label: 'myvariable'}
                    ],
                    defaultValue: 'myvariable'
                },
                io: {}
            }
        ]
    },

    Receiver: {
        rows: [
            { id: 'state', type: 'status', props: {label: "Receiver", icon: RiRadarFill}},
            {id: 'title', type: 'title', props: {text: 'Receiver'}}
        ]
    },

    Broadcaster: {
        rows: [
            { id: 'state', type: 'status', props: {label: "Broadcaster", icon: TbBuildingBroadcastTowerFilled}},
            {id: 'title', type: 'title', props: {text: 'Broadcaster'}}
        ]
    },

    Comment: {
        rows: [
            { id: 'state', type: 'status', props: {label: "Comment", icon: FaNoteSticky}}
        ]
    },

    Microphone: {
        rows: [
            { id: 'state', type: 'status', props: {label: "Microphone", icon: TiMicrophone}},
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
            { id: 'state', type: 'status', props: {label: "Audio", icon: LuAudioWaveform}},
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
            { id: 'state', type: 'status', props: {label: "Servo", icon: FaGears}},
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