import {NODE_DEFINITIONS} from '../../nodeCatalog';
import {registerRunnerByType} from './runnerRegistry';
import RunDebugPassthroughNode from './runners/RunDebugPassthroughNode';
import RunAgentNode from './runners/RunAgentNode';
import RunNotepadNode from './runners/RunNotepadNode';
import RunVariableNode from './runners/RunVariableNode';
import RunReceiverNode from './runners/RunReceiverNode';
import RunBroadcasterNode from './runners/RunBroadcasterNode';
import RunMicrophoneNode from './runners/RunMicrophoneNode';

let didRegisterDefaultRunners = false;

export const registerDefaultRunners = () => {
    if (didRegisterDefaultRunners) return;

    Object.keys(NODE_DEFINITIONS || {}).forEach(type => {
        registerRunnerByType(type, RunDebugPassthroughNode);
    });

    // Override specific implemented runners.
    registerRunnerByType('Agent', RunAgentNode);
    registerRunnerByType('Notepad', RunNotepadNode);
    registerRunnerByType('Variable', RunVariableNode);
    registerRunnerByType('Receiver', RunReceiverNode);
    registerRunnerByType('Broadcaster', RunBroadcasterNode);
    registerRunnerByType('Microphone', RunMicrophoneNode);
    didRegisterDefaultRunners = true;
};