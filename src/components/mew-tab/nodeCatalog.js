/**
 * Node catalog - defines all available node types and their row module compositions.
 * Each node type is an array of row module definitions.
 */

export const NODE_DEFINITIONS = {
    Agent: [
        { 
            id: 'name', 
            type: 'textInput', 
            props: { label: 'Name', placeholder: 'Agent name' }, 
            io: { 
                input: { 
                    portId: 'in_value' 
                }, 
                output: { 
                    portId: 'out_value' 
                } 
            } 
        },
        {
            id: 'model',
            type: 'dropdown',
            props: {
                label: 'model',
                options: [
                    { value: 'gpt3.5 turbo', label: 'GPT3.5 Turbo' },
                    { value: 'gemini', label: 'Gemini' },
                ],
                placeholder: 'Choose a model',
            },
            io: { 
                input: { 
                    portId: 'in_value' 
                }
            } 
        },
    ],

    Notepad: [
        { id: 'name', type: 'textInput', props: { label: 'Name', placeholder: 'Notepad name' } },
    ],

    Variable: [
        { id: 'title', type: 'title', props: { text: 'Variable' } },
    ],

    Receiver: [
        { id: 'title', type: 'title', props: { text: 'Receiver' } },
    ],

    Broadcaster: [
        { id: 'title', type: 'title', props: { text: 'Broadcaster' } },
    ],

    Comment: [
        { id: 'title', type: 'title', props: { text: 'Comment' } },
    ],

    Microphone: [
        { id: 'name', type: 'textInput', props: { label: 'Name', placeholder: 'Microphone name' } },
    ],

    Audio: [
        { id: 'name', type: 'textInput', props: { label: 'Name', placeholder: 'Audio name' } },
    ],

    Servo: [
        { id: 'title', type: 'title', props: { text: 'Servo' } },
    ],
};

/**
 * Get a node definition by type.
 * @param {string} nodeType - The node type (e.g. 'Agent', 'Variable')
 * @returns {Array<Object>} The module array for that node type
 */
export const getNodeDefinition = (nodeType) => {
    return NODE_DEFINITIONS[nodeType];
};