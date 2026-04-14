import { setupSerialConnection } from "simple-web-serial";

let connection = null;
let connectPromise = null;

// Per-servo fixed-rate throttle state.
// Sends at most once per THROTTLE_MS while keeping the latest pending position.
const throttleStateByKey = new Map(); // Map<servoKey, { lastSentAt, lastSentPosition, pendingPosition, timerId, isFlushing }>
const THROTTLE_MS = 0;
const BAUD_RATE = 921600; // or 115200, but must match firmware exactly


const getThrottleState = key => {
    if (!throttleStateByKey.has(key)) {
        throttleStateByKey.set(key, {
            lastSentAt: 0,
            lastSentPosition: null,
            pendingPosition: null,
            timerId: null,
            isFlushing: false,
        });
    }
    return throttleStateByKey.get(key);
};

const scheduleFlush = (key, delayMs = THROTTLE_MS) => {
    const state = getThrottleState(key);
    if (state.timerId !== null) return;

    state.timerId = setTimeout(() => {
        state.timerId = null;
        flushServoSend(key).catch(() => {});
    }, Math.max(0, delayMs));
};

const flushServoSend = async key => {
    const state = getThrottleState(key);
    if (state.isFlushing) return false;
    if (!Number.isFinite(state.pendingPosition)) return false;

    const elapsed = Date.now() - state.lastSentAt;
    if (elapsed < THROTTLE_MS) {
        scheduleFlush(key, THROTTLE_MS - elapsed);
        return false;
    }

    const nextPosition = state.pendingPosition;

    state.isFlushing = true;
    try {
        const conn = await ensureConnection();
        if (typeof conn?.send !== "function") return false;

        await conn.send("browser-event", { [key]: nextPosition });

        state.lastSentAt = Date.now();
        state.lastSentPosition = nextPosition;
        return true;
    } finally {
        state.isFlushing = false;

        // If a newer value arrived while sending, schedule the next fixed-rate flush.
        if (state.pendingPosition !== state.lastSentPosition) {
            scheduleFlush(key, THROTTLE_MS);
        }
    }
};

const ensureConnection = async () => {
    if (connection?.ready?.()) return connection;
    if (connectPromise) return connectPromise;

    connectPromise = (async () => {
        const conn = connection || setupSerialConnection({
            requestAccessOnPageLoad: false,
            baudRate: BAUD_RATE,
        });

        // v1.4.1 API: this is what triggers the browser port picker.
        if (!conn.ready()) {
            await conn.startConnection();
        }

        connection = conn;
        return connection;
    })();

    try {
        return await connectPromise;
    } finally {
        connectPromise = null;
    }
};

export const sendServoPositionToEsp32 = async ({ servoKey, position }) => {
    const key = String(servoKey || "").trim();
    if (!key) return false;

    // Clamp position to 0-180 degrees and round to integer (servos only accept integer positions)
    const clampedPosition = Math.round(Math.max(0, Math.min(180, position)));

    const state = getThrottleState(key);

    // Drop no-op updates: if this value is already pending or was just sent,
    // there is nothing new to transmit.
    if (state.pendingPosition === clampedPosition) {
        return false;
    }
    if (
        !Number.isFinite(state.pendingPosition) &&
        state.lastSentPosition === clampedPosition
    ) {
        return false;
    }

    state.pendingPosition = clampedPosition;

    // If enough time has elapsed, flush immediately; otherwise, send on the next slot.
    const elapsed = Date.now() - state.lastSentAt;
    if (!state.isFlushing && elapsed >= THROTTLE_MS) {
        return flushServoSend(key);
    }

    scheduleFlush(key, Math.max(0, THROTTLE_MS - elapsed));
    return false;
};