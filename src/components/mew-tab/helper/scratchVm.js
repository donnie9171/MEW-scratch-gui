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