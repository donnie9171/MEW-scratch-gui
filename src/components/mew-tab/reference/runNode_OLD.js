// old Base class for all node runners, for reference only
class RunNode {
    constructor(node, context) {
        this.node = node;         // The node data object
        this.context = context;   // Shared context (e.g. graph, variable state, etc)
    }

    // Override in subclasses
    async run() {
        throw new Error('run() not implemented for base RunNode');
    }

    // Helper: get input nodes
    getInputs() {
        if (!this.node.inputs) return [];
        return this.node.inputs.map(id => this.context.getNodeById(id));
    }

    // Helper: get output nodes
    getOutputs() {
        if (!this.node.outputs) return [];
        return this.node.outputs.map(id => this.context.getNodeById(id));
    }

    setOutputValue(value){
        // this.node.data.outputValue = value; // Store output value in node data
        window.runtimeState.setNodeState(this.node.id, { outputValue: value })
        return;
    }
}

// Export classes for use in RunManager
window.RunNode = RunNode;