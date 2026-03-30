const getGlobalScaffoldingVm = () => {
    if (typeof window === "undefined") return null;
    return window?.scaffolding?.vm || null;
};

export const getScratchRuntime = (vm) => {
    if (vm?.runtime) return vm.runtime;
    return getGlobalScaffoldingVm()?.runtime || null;
};

export const isScratchVmReady = (vm) => {
    const runtime = getScratchRuntime(vm);
    return !!(
        runtime &&
        Array.isArray(runtime.targets) &&
        runtime.targets.length > 0
    );
};

export const getScratchVariableAndListNames = (vm) => {
    const runtime = getScratchRuntime(vm);
    if (!runtime || !Array.isArray(runtime.targets)) return [];

    const names = [];

    try {
        for (const target of runtime.targets) {
            const variables = target?.variables;
            if (!variables || typeof variables !== "object") continue;

            for (const variable of Object.values(variables)) {
                const name = Array.isArray(variable)
                    ? variable[0]
                    : variable?.name;
                const type = Array.isArray(variable)
                    ? variable[1]
                    : variable?.type;

                if (!name) continue;
                if (
                    type === "" ||
                    type === "list" ||
                    type === undefined ||
                    type === null
                ) {
                    names.push(name);
                }
            }
        }
    } catch {
        return [];
    }

    return Array.from(new Set(names));
};

const isVariableOrListType = (type) =>
    type === "" || type === "list" || type === undefined || type === null;

const getVariableName = (variable) =>
    Array.isArray(variable) ? variable[0] : variable?.name;

const getVariableType = (variable) =>
    Array.isArray(variable) ? variable[1] : variable?.type;

const getVariableValue = (variable) =>
    Array.isArray(variable) ? variable[2] : variable?.value;

const findScratchVariableRef = (runtime, variableName) => {
    if (!runtime || !Array.isArray(runtime.targets) || !variableName)
        return null;

    for (const target of runtime.targets) {
        const variables = target?.variables;
        if (!variables || typeof variables !== "object") continue;

        for (const [id, variable] of Object.entries(variables)) {
            const name = getVariableName(variable);
            const type = getVariableType(variable);
            if (name !== variableName) continue;
            if (!isVariableOrListType(type)) continue;

            return { target, id, variable };
        }
    }

    return null;
};

export const getScratchVariableValue = (vm, variableName) => {
    const runtime = getScratchRuntime(vm);
    const ref = findScratchVariableRef(runtime, variableName);
    if (!ref) return "";
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

const isBroadcastMessageType = (type) => type === "broadcast_msg";

export const getScratchBroadcastNames = (vm) => {
    const runtime = getScratchRuntime(vm);
    if (!runtime || !Array.isArray(runtime.targets)) return [];

    const names = [];

    try {
        for (const target of runtime.targets) {
            const variables = target?.variables;
            if (!variables || typeof variables !== "object") continue;

            for (const variable of Object.values(variables)) {
                const name = getVariableName(variable);
                const type = getVariableType(variable);

                if (!name) continue;
                if (isBroadcastMessageType(type)) {
                    names.push(name);
                }
            }
        }
    } catch {
        return [];
    }

    return Array.from(new Set(names));
};

const getBroadcastRuntimes = (vm) => {
    const candidates = [
        vm?.runtime || null,
        getScratchRuntime(vm),
        getGlobalScaffoldingVm()?.runtime || null,
    ].filter(Boolean);

    return Array.from(new Set(candidates));
};

export const sendScratchBroadcastMessage = (vm, messageName) => {
    const safeMessage = String(messageName || "").trim();
    const runtimes = getBroadcastRuntimes(vm);

    // eslint-disable-next-line no-console
    console.log("[MEW BROADCAST DEBUG] emit attempt", {
        safeMessage,
        hasVm: Boolean(vm),
        runtimeCount: runtimes.length,
        listenerCounts: runtimes.map((runtime, index) => ({
            index,
            count:
                typeof runtime?.listenerCount === "function"
                    ? runtime.listenerCount("broadcast_message")
                    : "n/a",
        })),
    });

    if (!safeMessage) return false;
    if (!runtimes.length) return false;

    let emitted = false;

    for (const runtime of runtimes) {
        try {
            runtime.startHats("event_whenbroadcastreceived", {
                BROADCAST_OPTION: safeMessage,
            });
            emitted = true;
        } catch (error) {
            // eslint-disable-next-line no-console
            console.warn("[MEW] Failed to emit broadcast on one runtime:", error);
        }
    }

    // eslint-disable-next-line no-console
    console.log("[MEW BROADCAST DEBUG] emit done", {
        safeMessage,
        emitted,
        runtimeCount: runtimes.length,
    });

    return emitted;
};

const normalizeBroadcastKey = (value) =>
    String(value || "").trim().toLowerCase();

const extractBroadcastFromStartHats = (requestedHatOpcode, matchFields) => {
    if (requestedHatOpcode !== "event_whenbroadcastreceived") return "";
    return String(matchFields?.BROADCAST_OPTION || "").trim();
};

export const setupScratchBroadcastReceiver =
    (vm) =>
    ({messageName, onReceive}) => {
        const runtime = vm?.runtime || getScratchRuntime(vm);

        // eslint-disable-next-line no-console
        console.log("[MEW BROADCAST DEBUG] receiver setup attempt", {
            messageName,
            hasVm: Boolean(vm),
            hasRuntime: Boolean(runtime),
        });

        if (!runtime || typeof messageName !== "string") return () => {};

        const expectedRaw = String(messageName || "").trim();
        const expectedKey = normalizeBroadcastKey(expectedRaw);
        if (!expectedKey) return () => {};

        const originalStartHats =
            typeof runtime.startHats === "function"
                ? runtime.startHats.bind(runtime)
                : null;

        if (!originalStartHats) {
            // eslint-disable-next-line no-console
            console.warn("[MEW BROADCAST DEBUG] runtime.startHats unavailable");
            return () => {};
        }

        runtime.startHats = (requestedHatOpcode, matchFields, target) => {
            const incomingRaw = extractBroadcastFromStartHats(
                requestedHatOpcode,
                matchFields,
            );
            const incomingKey = normalizeBroadcastKey(incomingRaw);

            if (incomingKey) {
                // eslint-disable-next-line no-console
                console.log("[MEW BROADCAST DEBUG] startHats intercepted", {
                    requestedHatOpcode,
                    expectedRaw,
                    incomingRaw,
                    expectedKey,
                    incomingKey,
                    matched: incomingKey === expectedKey,
                    targetId: target?.id,
                });

                if (incomingKey === expectedKey && typeof onReceive === "function") {
                    onReceive(incomingRaw);
                }
            }

            return originalStartHats(requestedHatOpcode, matchFields, target);
        };

        return () => {
            runtime.startHats = originalStartHats;
        };
    };


    export const attachScratchBroadcastProbe = (vm) => {
    const runtime = vm?.runtime || getScratchRuntime(vm);
    if (!runtime) {
        // eslint-disable-next-line no-console
        console.warn("[MEW BROADCAST PROBE] no runtime");
        return () => {};
    }

    const originals = {
        emit: runtime.emit?.bind(runtime),
        startHats: runtime.startHats?.bind(runtime),
        startHatsAndReturnPrimitives:
            runtime.startHatsAndReturnPrimitives?.bind(runtime),
    };

    const looksBroadcastLike = (value) => {
        const text =
            typeof value === "string"
                ? value
                : (() => {
                      try {
                          return JSON.stringify(value);
                      } catch {
                          return String(value);
                      }
                  })();

        return /broadcast|whenbroadcastreceived|broadcast_message/i.test(text);
    };

    if (originals.emit) {
        runtime.emit = (eventName, ...args) => {
            if (looksBroadcastLike(eventName) || args.some(looksBroadcastLike)) {
                // eslint-disable-next-line no-console
                console.log("[MEW BROADCAST PROBE] runtime.emit", {
                    eventName,
                    args,
                });
            }
            return originals.emit(eventName, ...args);
        };
    }

    if (originals.startHats) {
        runtime.startHats = (requestedHatOpcode, matchFields, target) => {
            if (
                looksBroadcastLike(requestedHatOpcode) ||
                looksBroadcastLike(matchFields)
            ) {
                // eslint-disable-next-line no-console
                console.log("[MEW BROADCAST PROBE] runtime.startHats", {
                    requestedHatOpcode,
                    matchFields,
                    targetId: target?.id,
                });
            }
            return originals.startHats(requestedHatOpcode, matchFields, target);
        };
    }

    if (originals.startHatsAndReturnPrimitives) {
        runtime.startHatsAndReturnPrimitives = (
            requestedHatOpcode,
            matchFields,
            target
        ) => {
            if (
                looksBroadcastLike(requestedHatOpcode) ||
                looksBroadcastLike(matchFields)
            ) {
                // eslint-disable-next-line no-console
                console.log(
                    "[MEW BROADCAST PROBE] runtime.startHatsAndReturnPrimitives",
                    {
                        requestedHatOpcode,
                        matchFields,
                        targetId: target?.id,
                    }
                );
            }
            return originals.startHatsAndReturnPrimitives(
                requestedHatOpcode,
                matchFields,
                target
            );
        };
    }

    // eslint-disable-next-line no-console
    console.log("[MEW BROADCAST PROBE] attached");

    return () => {
        if (originals.emit) runtime.emit = originals.emit;
        if (originals.startHats) runtime.startHats = originals.startHats;
        if (originals.startHatsAndReturnPrimitives) {
            runtime.startHatsAndReturnPrimitives =
                originals.startHatsAndReturnPrimitives;
        }
        // eslint-disable-next-line no-console
        console.log("[MEW BROADCAST PROBE] detached");
    };
};