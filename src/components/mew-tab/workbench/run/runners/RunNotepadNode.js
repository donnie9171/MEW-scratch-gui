import RunNode from '../runNode';
import {
    createTextSegment,
    createTokenSegment,
    normalizeTemplateValue,
    renderTemplateWithDiagnostics
} from '../../../row-modules/utils/notepadTemplateValue';

const toRuntimeTemplateValue = templateValue => {
    if (!templateValue || !Array.isArray(templateValue.listItems)) return templateValue;

    const normalized = normalizeTemplateValue(templateValue);
    const segments = [];

    templateValue.listItems.forEach((item, index) => {
        const isPlaceholder = item && item.type === 'placeholder' && item.sourceNodeId;

        if (isPlaceholder) {
            segments.push(createTokenSegment({
                sourceNodeId: String(item.sourceNodeId || ''),
                sourcePortId: String(item.sourcePortId || 'out_value'),
                label: String(item.label || ''),
                resolverField: item.resolverField ? String(item.resolverField) : null
            }));
        } else {
            segments.push(createTextSegment(String(item?.content || '')));
        }

        if (index < templateValue.listItems.length - 1) {
            segments.push(createTextSegment('\n'));
        }
    });

    return {
        ...normalized,
        listItems: templateValue.listItems,
        segments: segments.length ? segments : [createTextSegment('')]
    };
};

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
        const runtimeTemplate = toRuntimeTemplateValue(templateValue);

        const rendered = renderTemplateWithDiagnostics(
            runtimeTemplate,
            tokenRef => this.context.runtimeStore.getOutputValue(tokenRef.sourceNodeId, tokenRef.sourcePortId)
        );

        this.setOutput('out_value', rendered.text);
        console.log(`[RunNotepadNode] Rendered output:`, rendered.text, 'with diagnostics:', rendered.diagnostics);

        this.patchRuntime({
            parsedText: rendered.text,
            unresolvedTokens: rendered.unresolvedTokens,
            unresolvedCount: rendered.unresolvedTokens.length,
            error: undefined
        });
    }
}

export default RunNotepadNode;