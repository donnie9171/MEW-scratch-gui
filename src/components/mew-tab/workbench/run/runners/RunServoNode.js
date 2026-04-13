import RunNode from '../runNode';
import { sendServoPositionToEsp32 } from "../../../helper/esp32Serial";

const toFiniteNumber = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const clamp01 = value => Math.max(0, Math.min(1, value));

const resolveInputValue = (rawInput, fallback = 0.5) => {
    if (rawInput === undefined || rawInput === null) return toFiniteNumber(fallback, 0.5);

    if (typeof rawInput === 'number' || typeof rawInput === 'string') {
        return toFiniteNumber(rawInput, fallback);
    }

    if (typeof rawInput === 'object') {
        const first = Object.values(rawInput)
            .map(v => toFiniteNumber(v, NaN))
            .find(v => Number.isFinite(v));
        return Number.isFinite(first) ? first : toFiniteNumber(fallback, 0.5);
    }

    return toFiniteNumber(fallback, 0.5);
};

class RunServoNode extends RunNode {
    patchRuntime (patch) {
        if (typeof this.context?.patchRuntime === 'function') {
            this.context.patchRuntime(this.node.id, patch);
            return;
        }
        this.context.runtimeStore.setNodeState(this.node.id, patch);
    }

    async run () {
        const normalizedRange = this.node?.data?.normalizedLabel?.value || {};
        const normalizedMin = toFiniteNumber(normalizedRange.left, 0);
        const normalizedMax = toFiniteNumber(normalizedRange.right, 1);

        const servoRange = this.node?.data?.servoRange?.value || {};
        const servoMin = toFiniteNumber(servoRange.left, 0);
        const servoMax = toFiniteNumber(servoRange.right, 180);

        const manualSlider = toFiniteNumber(this.node?.data?.servoValue?.value, 0.5);
        const incomingNormalized = this.getInput('normalized_value');
        
        // Convert from input range to 0-1
        let normalized;
        if (incomingNormalized !== undefined && incomingNormalized !== null) {
            const inValue = resolveInputValue(incomingNormalized, manualSlider);
            const span = normalizedMax - normalizedMin;
            // Map from [normalizedMin, normalizedMax] to [0, 1]
            normalized = span === 0 ? 0 : (inValue - normalizedMin) / span;
            normalized = clamp01(normalized);
            
            if (typeof this.context?.patchNodeData === 'function') {
                this.context.patchNodeData(this.node.id, 'servoValue', 'value', normalized);
            }
        } else {
            normalized = clamp01(manualSlider);
        }

        // Convert from 0-1 to servo range
        const servoPosition = servoMin + normalized * (servoMax - servoMin);

        const servoKey = String(this.node?.data?.servoId?.value || "").trim();

        if (servoKey) {
            try {
                await sendServoPositionToEsp32({
                    servoKey,
                    position: servoPosition
                });
            } catch (error) {
                this.patchRuntime({
                    serialError: String(error?.message || error)
                });
            }
        }

        this.setOutput('servo_position', servoPosition);

        this.patchRuntime({
            servoNormalizedInput: normalized,
            servoPosition,
            tooltipMessage: String(servoPosition)
        });
    }
}

export default RunServoNode;