import {NODE_DEFINITIONS} from '../../nodeCatalog';
import {registerRunnerByType} from './runnerRegistry';
import RunDebugPassthroughNode from './runners/RunDebugPassthroughNode';
import RunAgentNode from './runners/RunAgentNode';

let didRegisterDefaultRunners = false;

export const registerDefaultRunners = () => {
    if (didRegisterDefaultRunners) return;

    Object.keys(NODE_DEFINITIONS || {}).forEach(type => {
        registerRunnerByType(type, RunDebugPassthroughNode);
    });

    // Override specific implemented runners.
    registerRunnerByType('Agent', RunAgentNode);

    didRegisterDefaultRunners = true;
};