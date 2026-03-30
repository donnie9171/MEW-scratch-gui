import RunNode from '../runNode';

class RunReceiverNode extends RunNode {
    async run () {
        const selectedMessage = String(
            this.node?.data?.message?.value || this.node?.data?.message || ''
        ).trim();

        this.setOutput('trigger', selectedMessage || '');
    }
}

export default RunReceiverNode;