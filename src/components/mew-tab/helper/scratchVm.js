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
            console.warn(
                "[MEW] Failed to emit broadcast on one runtime:",
                error,
            );
        }
    }

    return emitted;
};

const normalizeBroadcastKey = (value) =>
    String(value || "")
        .trim()
        .toLowerCase();

const extractBroadcastFromStartHats = (requestedHatOpcode, matchFields) => {
    if (requestedHatOpcode !== "event_whenbroadcastreceived") return "";
    return String(matchFields?.BROADCAST_OPTION || "").trim();
};

export const setupScratchBroadcastReceiver =
    (vm) =>
    ({ messageName, onReceive }) => {
        const runtime = vm?.runtime || getScratchRuntime(vm);

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

                if (
                    incomingKey === expectedKey &&
                    typeof onReceive === "function"
                ) {
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
            if (
                looksBroadcastLike(eventName) ||
                args.some(looksBroadcastLike)
            ) {
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
            }
            return originals.startHats(requestedHatOpcode, matchFields, target);
        };
    }

    if (originals.startHatsAndReturnPrimitives) {
        runtime.startHatsAndReturnPrimitives = (
            requestedHatOpcode,
            matchFields,
            target,
        ) => {
            if (
                looksBroadcastLike(requestedHatOpcode) ||
                looksBroadcastLike(matchFields)
            ) {
            }
            return originals.startHatsAndReturnPrimitives(
                requestedHatOpcode,
                matchFields,
                target,
            );
        };
    }

    return () => {
        if (originals.emit) runtime.emit = originals.emit;
        if (originals.startHats) runtime.startHats = originals.startHats;
        if (originals.startHatsAndReturnPrimitives) {
            runtime.startHatsAndReturnPrimitives =
                originals.startHatsAndReturnPrimitives;
        }
    };
};

const clamp01 = (value) => Math.min(1, Math.max(0, value));

const toNormalizedMagnitude01 = (value) => {
    if (!Number.isFinite(value)) return 0;
    if (value <= 0) return 0;
    // Scratch audio is typically 0-1 on output. Scale if needed.
    const normalized = value <= 1 ? value : value / 100;
    return clamp01(normalized);
};

/**
 * Get the current audio output level from the Scratch project (not microphone input).
 * Reads from the output bus analyser attached during AudioEngine initialization.
 * Returns value in 0-1 range where 1 is peak loudness.
 * @param {VM} vm Scratch VM instance
 * @returns {number} Normalized audio level 0-1, or 0 if unavailable
 */
export const getScratchAudioMagnitude = (vm) => {
    const runtime = getScratchRuntime(vm);
    if (!runtime) return 0;

    // New path: Read from output analyser (project audio, not microphone)
    const audioEngine = runtime?.audioEngine;
    if (audioEngine && audioEngine._outputAnalyser && audioEngine._analyserDataArray) {
        try {
            audioEngine._outputAnalyser.getFloatTimeDomainData(audioEngine._analyserDataArray);
            
            // Compute RMS of output signal
            let sum = 0;
            for (let i = 0; i < audioEngine._analyserDataArray.length; i++) {
                sum += Math.pow(audioEngine._analyserDataArray[i], 2);
            }
            const rms = Math.sqrt(sum / audioEngine._analyserDataArray.length);
            
            // Scale and smooth (typical audio levels are small, so amplify)
            const scaled = Math.min(1, rms * 5);
            return toNormalizedMagnitude01(scaled);
        } catch (e) {
            // Analyser not ready or disconnected
            return 0;
        }
    }

    // Fallback: return 0 instead of triggering mic (safe default)
    return 0;
};