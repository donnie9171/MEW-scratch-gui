import RunNode from '../runNode';
import {
    getScratchVariableValue,
    setScratchVariableValue
} from '../../../helper/scratchVm';

const toInputString = value => {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);

    if (typeof value === 'object') {
        return Object.values(value)
            .map(v => (v === undefined || v === null ? '' : (typeof v === 'string' ? v : JSON.stringify(v))))
            .join('');
    }

    return String(value);
};

class RunVariableNode extends RunNode {
    async run () {
        const selectedVariableName = String(
            this.node?.data?.variableName?.value || this.node?.data?.variableName || ''
        ).trim();

        const incomingEdges = this.getAllIncomingEdges();

        const vm = this.context?.vm || null;

        if(!vm) {
            throw new Error(`missing vm in RunVariableNode context`);
        }

        if (incomingEdges.length > 0 && selectedVariableName) {
            const concatenatedInput = incomingEdges
                .map(edge => this.context.runtimeStore.getOutputValue(edge.fromNodeId, edge.fromPortId))
                .map(toInputString)
                .join('');

            setScratchVariableValue(vm, selectedVariableName, concatenatedInput);

        }

        const outputValue = selectedVariableName
        ? getScratchVariableValue(vm, selectedVariableName)
        : '';

        this.setOutput('out_value', outputValue);
    }
}

export default RunVariableNode;