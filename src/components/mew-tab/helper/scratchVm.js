const getGlobalScaffoldingVm = () => {
    if (typeof window === 'undefined') return null;
    return window?.scaffolding?.vm || null;
};

export const getScratchRuntime = vm => {
    if (vm?.runtime) return vm.runtime;
    return getGlobalScaffoldingVm()?.runtime || null;
};

export const isScratchVmReady = vm => {
    const runtime = getScratchRuntime(vm);
    return !!(runtime && Array.isArray(runtime.targets) && runtime.targets.length > 0);
};

export const getScratchVariableAndListNames = vm => {
    const runtime = getScratchRuntime(vm);
    if (!runtime || !Array.isArray(runtime.targets)) return [];

    const names = [];

    try {
        for (const target of runtime.targets) {
            const variables = target?.variables;
            if (!variables || typeof variables !== 'object') continue;

            for (const variable of Object.values(variables)) {
                const name = Array.isArray(variable) ? variable[0] : variable?.name;
                const type = Array.isArray(variable) ? variable[1] : variable?.type;

                if (!name) continue;
                if (type === '' || type === 'list' || type === undefined || type === null) {
                    names.push(name);
                }
            }
        }
    } catch {
        return [];
    }

    return Array.from(new Set(names));
};

const isVariableOrListType = type => (
    type === '' || type === 'list' || type === undefined || type === null
);

const getVariableName = variable => (
    Array.isArray(variable) ? variable[0] : variable?.name
);

const getVariableType = variable => (
    Array.isArray(variable) ? variable[1] : variable?.type
);

const getVariableValue = variable => (
    Array.isArray(variable) ? variable[2] : variable?.value
);

const findScratchVariableRef = (runtime, variableName) => {
    if (!runtime || !Array.isArray(runtime.targets) || !variableName) return null;

    for (const target of runtime.targets) {
        const variables = target?.variables;
        if (!variables || typeof variables !== 'object') continue;

        for (const [id, variable] of Object.entries(variables)) {
            const name = getVariableName(variable);
            const type = getVariableType(variable);
            if (name !== variableName) continue;
            if (!isVariableOrListType(type)) continue;

            return {target, id, variable};
        }
    }

    return null;
};

export const getScratchVariableValue = (vm, variableName) => {
    const runtime = getScratchRuntime(vm);
    const ref = findScratchVariableRef(runtime, variableName);
    if (!ref) return '';
    return getVariableValue(ref.variable);
};

export const setScratchVariableValue = (vm, variableName, nextValue) => {
    const runtime = getScratchRuntime(vm);
    const ref = findScratchVariableRef(runtime, variableName);
    if (!ref) return false;

    if (Array.isArray(ref.variable)) {
        ref.variable[2] = nextValue;
        return true;
    }

    ref.variable.value = nextValue;
    return true;
};