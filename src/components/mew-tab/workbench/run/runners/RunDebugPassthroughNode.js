import RunNode from '../runNode';

/**
 * Temporary debug runner used to validate execution plumbing.
 * It captures inputs, writes deterministic outputs, and logs context.
 */
class RunDebugPassthroughNode extends RunNode {
    async run (triggerContext = {}) {
        const allInputs = this.getAllInputs();
        const outgoingEdges = this.getAllOutgoingEdges();
        const outputPortIds = [...new Set(outgoingEdges.map(e => e.fromPortId).filter(Boolean))];

        const payload = {
            nodeId: this.node.id,
            nodeType: this.node.type,
            triggerContext,
            inputs: allInputs,
            at: new Date().toISOString()
        };

        if (!outputPortIds.length) {
            this.setOutput('out_value', payload);
        } else {
            outputPortIds.forEach(portId => this.setOutput(portId, payload));
        }

        // Quick visibility while implementation is in progress.
        // eslint-disable-next-line no-console
        console.log('[MEW RUN DEBUG] runner executed', {
            nodeId: this.node.id,
            nodeType: this.node.type,
            outputPortIds,
            triggerContext,
            inputs: allInputs
        });
    }
}

export default RunDebugPassthroughNode;
