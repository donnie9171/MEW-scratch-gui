import {
    getIncomingEdges,
    getOutgoingEdges,
    groupIncomingByInputPort
} from './graphEnginePorts';

/**
 * Base runner class. Concrete node runners should extend this.
 */
class RunNode {
    constructor (node, context) {
        this.node = node;
        this.context = context;
    }

    /**
     * Required override in subclass.
     */
    // eslint-disable-next-line class-methods-use-this
    async run () {
        throw new Error(`RunNode.run() not implemented for node type: ${this.node?.type}`);
    }

    getAllIncomingEdges () {
        return getIncomingEdges(this.node.id, this.context.nodes);
    }

    getAllOutgoingEdges () {
        return getOutgoingEdges(this.node.id, this.context.nodes);
    }

    getIncomingByInputPort () {
        return groupIncomingByInputPort(this.node.id, this.context.nodes);
    }

    /**
     * Resolve input(s) for one input port id.
     * - no edges: undefined
     * - one edge: raw value
     * - multiple edges: { [sourceNodeNameOrId]: value }
     */
    getInput (inPortId) {
        const edges = this.getIncomingByInputPort()[inPortId] || [];
        if (!edges.length) return undefined;

        const toValue = edge => this.context.runtimeStore.getOutputValue(edge.fromNodeId, edge.fromPortId);

        if (edges.length === 1) {
            return toValue(edges[0]);
        }

        const bySource = {};
        edges.forEach(edge => {
            const sourceNode = this.context.nodes.find(n => n.id === edge.fromNodeId);
            const key = sourceNode?.data?.name?.value || sourceNode?.id || edge.fromNodeId;
            bySource[key] = toValue(edge);
        });

        return bySource;
    }

    getAllInputs () {
        const grouped = this.getIncomingByInputPort();
        const values = {};

        Object.keys(grouped).forEach(inPortId => {
            values[inPortId] = this.getInput(inPortId);
        });

        return values;
    }

    setOutput (outPortId, value) {
        this.context.runtimeStore.setOutputValue(this.node.id, outPortId, value);
        return value;
    }
}

export default RunNode;