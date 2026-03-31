import { setupSerialConnection } from "simple-web-serial";

let connection = null;
let connectPromise = null;

const ensureConnection = async () => {
    if (connection?.ready?.()) return connection;
    if (connectPromise) return connectPromise;

    connectPromise = (async () => {
        const conn = connection || setupSerialConnection({
            requestAccessOnPageLoad: false,
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
    // Initialize serial first so first interaction prompts immediately.
    const conn = await ensureConnection();
    if (typeof conn?.send !== "function") return false;

    const key = String(servoKey || "").trim();
    if (!key) return false;

    await conn.send("browser-event", { [key]: position });
    return true;
};