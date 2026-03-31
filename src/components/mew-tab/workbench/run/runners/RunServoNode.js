import RunNode from '../runNode';
import { sendServoPositionToEsp32 } from "../../../helper/esp32Serial";

const toFiniteNumber = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const clamp01 = value => Math.max(0, Math.min(1, value));

const resolveNormalizedInput = (rawInput, fallback = 0.5) => {
    if (rawInput === undefined || rawInput === null) return clamp01(fallback);

    if (typeof rawInput === 'number' || typeof rawInput === 'string') {
        return clamp01(toFiniteNumber(rawInput, fallback));
    }

    if (typeof rawInput === 'object') {
        const first = Object.values(rawInput)
            .map(v => toFiniteNumber(v, NaN))
            .find(v => Number.isFinite(v));
        return clamp01(Number.isFinite(first) ? first : fallback);
    }

    return clamp01(fallback);
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
        const range = this.node?.data?.servoRange?.value || {};
        const rangeMin = toFiniteNumber(range.left, 0);
        const rangeMax = toFiniteNumber(range.right, 180);

        const manualSlider = toFiniteNumber(this.node?.data?.servoValue?.value, 0.5);
        const incomingNormalized = this.getInput('normalized_value');
        const normalized = resolveNormalizedInput(incomingNormalized, manualSlider);

        if (incomingNormalized !== undefined && incomingNormalized !== null) {
            if (typeof this.context?.patchNodeData === 'function') {
                this.context.patchNodeData(this.node.id, 'servoValue', 'value', normalized);
            }
        }

        const servoPosition = rangeMin + normalized * (rangeMax - rangeMin);

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