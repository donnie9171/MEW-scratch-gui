// src/components/mew-tab/workbench/run/runners/RunBroadcasterNode.js
import RunNode from '../runNode';
import {sendScratchBroadcastMessage} from '../../../helper/scratchVm';

class RunBroadcasterNode extends RunNode {
    async run () {
        const selectedMessage = String(
            this.node?.data?.message?.value || this.node?.data?.message || ''
        ).trim();
        const vm = this.context?.vm || null;

        // eslint-disable-next-line no-console
        console.log('[MEW BROADCAST DEBUG] Broadcaster.run', {
            nodeId: this.node?.id,
            selectedMessage,
            hasVm: Boolean(vm),
            hasRuntime: Boolean(vm?.runtime)
        });

        if (selectedMessage && vm) {
            const ok = sendScratchBroadcastMessage(vm, selectedMessage);
            // eslint-disable-next-line no-console
            console.log('[MEW BROADCAST DEBUG] sendScratchBroadcastMessage result', {
                nodeId: this.node?.id,
                selectedMessage,
                ok
            });
        } else {
            // eslint-disable-next-line no-console
            console.warn('[MEW BROADCAST DEBUG] skipped emit', {
                nodeId: this.node?.id,
                selectedMessage,
                reason: !selectedMessage ? 'empty-message' : 'missing-vm'
            });
        }

        this.setOutput('trigger', selectedMessage || '');
    }
}

export default RunBroadcasterNode;