import RunNode from './runNode';

const byType = new Map();
const byToolType = new Map();

export const registerRunnerByType = (type, RunnerClass) => {
    if (!type || typeof RunnerClass !== 'function') return;
    byType.set(type, RunnerClass);
};

export const registerRunnerByToolType = (toolType, RunnerClass) => {
    if (!toolType || typeof RunnerClass !== 'function') return;
    byToolType.set(toolType, RunnerClass);
};

export const getRunnerClassForNode = node => {
    if (!node) return RunNode;
    if (node.toolType && byToolType.has(node.toolType)) return byToolType.get(node.toolType);
    if (node.type && byType.has(node.type)) return byType.get(node.type);
    return RunNode;
};

export const createRunnerForNode = (node, context) => {
    const RunnerClass = getRunnerClassForNode(node);
    return new RunnerClass(node, context);
};

export const clearRunnerRegistry = () => {
    byType.clear();
    byToolType.clear();
};