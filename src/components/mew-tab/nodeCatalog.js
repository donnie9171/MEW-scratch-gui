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

import {createEmptyTemplateValue} from './row-modules/utils/notepadTemplateValue';






export const NODE_DEFINITIONS = {
    Agent: {
        rows: [
            { id: 'state', type: 'status', props: {
                    label: "Agent",
                    icon: FaIdCardAlt,
                    centerModule: {
                        type: 'textInput',
                        rowId: 'name',
                        props: {placeholder: 'Agent'}
                    }
                },                 io: {
                    input: {portId: 'in_value'},
                    output: {portId: 'out_value'}
                }},
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
            { id: 'state', type: 'status', props: {
                label: "Notepad",
                icon: BiSolidNotepad,
                centerModule: {
                    type: 'textInput',
                    rowId: 'name',
                    props: {placeholder: 'Notepad'}
                }
            }, io: {
                input: {portId: 'in_value'},
                output: {portId: 'out_value'}
            }},
            {id: 'prompt', type: 'notepadTemplate', props: {}}
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
            { id: 'state', type: 'status', props: {
                    label: "Variable",
                    icon: TbCalculatorFilled,
                    centerModule: {
                        type: 'dropdown',
                        rowId: 'variableName',
                        props: {
                            options: [
                                {value: '', label: 'Variable'}
                            ],
                            defaultValue: '',
                            disabled: true
                        }
                    }
                }, io: {
                    input: {portId: 'in_value'},
                    output: {portId: 'out_value'}
                }}
        ]
    },

    Receiver: {
        rows: [
            { id: 'state', type: 'status', props: {label: "When I receive", icon: RiRadarFill}, io:{
                output: {portId: 'trigger'}
            }},
            {
                id: 'message',
                type: 'dropdown',
                props: {
                    label: 'message',
                    options: [
                        {value: '', label: 'Message'}
                    ],
                    defaultValue: ''
                },
                io: {}
            }
        ]
    },

    Broadcaster: {
        rows: [
            { id: 'state', type: 'status', props: {label: "Broadcast", icon: TbBuildingBroadcastTowerFilled}, io:{
                input: {portId: 'trigger'}
            }},
            {
                id: 'message',
                type: 'dropdown',
                props: {
                    label: 'message',
                    options: [
                        {value: '', label: 'Message'}
                    ],
                    defaultValue: ''
                },
                io: {}
            }
        ]
    },

    Microphone: {
        rows: [
            { id: 'state', type: 'status', props: {label: "Microphone", icon: TiMicrophone,             
                centerModule: {
                    type: 'textInput',
                    rowId: 'name',
                    props: {placeholder: 'Microphone'}
                }}, 
            io:{
                input: {portId: 'trigger'},
                output: {portId: 'transcript'}
            }},
            {id: 'language', type: 'dropdown', props: {label: 'Language', options: [{value: 'en', label: 'English'}], defaultValue: 'en'}}
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
            { id: 'state', type: 'status', props: {label: "Audio level", icon: LuAudioWaveform}, io:{
                input: {portId: 'trigger'},
                output: {portId: 'audio_level'}
            }}
        ]
    },
    Servo: {
        rows: [
            { id: 'state', type: 'status', props: {label: "Servo", icon: FaGears}},
            {id: 'servoId', type: 'textInput', props: {label: 'Servo ID', placeholder: 'servo pin number'}},
            {
                id: 'normalizedLabel',
                type: 'dualLabel',
                props: {
                    leftLabel: '0',
                    rightLabel: '1',
                    editable: true,
                },
                io:{
                    input: {portId: 'normalized_value'}
                }
            },
        {
            id: 'servoValue',
            type: 'slider',
            props: {
                min: 0,
                max: 1,
                step: 0.01,
                defaultValue: 0.5
            }
        },
        {
            id: 'servoRange',
            type: 'dualLabel',
            props: {
                leftLabel: '0',
                rightLabel: '180',
                editable: true,
            },
            io:{
                output: {portId: 'servo_position'}
            }
        }
        ],
        defaults: {
            scope: 'nodeType',
            rules: [
                {
                    rowId: 'normalizedLabel',
                    field: 'value',
                    type: 'literal',
                    value: { left: '0', right: '1' }
                },
                {
                    rowId: 'servoRange',
                    field: 'value',
                    type: 'literal',
                    value: { left: '0', right: '180' }
                }
            ]
        }
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