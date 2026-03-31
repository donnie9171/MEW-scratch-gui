import RunNode from '../runNode';
import {getScratchAudioMagnitude} from '../../../helper/scratchVm';

class RunAudioNode extends RunNode {
    patchRuntime (patch) {
        if (typeof this.context?.patchRuntime === 'function') {
            this.context.patchRuntime(this.node.id, patch);
            return;
        }
        this.context.runtimeStore.setNodeState(this.node.id, patch);
    }

    async run () {
        const magnitude = getScratchAudioMagnitude(this.context?.vm || null);

        // Audio node has a dedicated output port in nodeCatalog.
        this.setOutput('audio_level', magnitude);

        // Optional runtime visibility in node tooltip/debug state.
        this.patchRuntime({
            lastMagnitude: magnitude,
            tooltipMessage: String(magnitude)
        });
    }
}

export default RunAudioNode;