import RunNode from '../runNode';
import {
    renderTemplateWithDiagnostics
} from '../../../row-modules/utils/notepadTemplateValue';

class RunNotepadNode extends RunNode {
    patchRuntime (patch) {
        if (typeof this.context?.patchRuntime === 'function') {
            this.context.patchRuntime(this.node.id, patch);
            return;
        }

        this.context.runtimeStore.setNodeState(this.node.id, patch);
    }

    async run () {
        const templateValue = this.node?.data?.prompt?.value;

        const rendered = renderTemplateWithDiagnostics(
            templateValue,
            tokenRef => this.context.runtimeStore.getOutputValue(tokenRef.sourceNodeId, tokenRef.sourcePortId)
        );

        this.setOutput('out_value', rendered.text);

        this.patchRuntime({
            parsedText: rendered.text,
            unresolvedTokens: rendered.unresolvedTokens,
            unresolvedCount: rendered.unresolvedTokens.length,
            error: undefined
        });
    }
}

export default RunNotepadNode;