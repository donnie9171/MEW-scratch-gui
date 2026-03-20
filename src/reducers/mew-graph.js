const SET_MEW_GRAPH = 'scratch-gui/mew-graph/SET_MEW_GRAPH';
const CHECKPOINT_MEW_GRAPH = 'scratch-gui/mew-graph/CHECKPOINT_MEW_GRAPH';
const UNDO_MEW_GRAPH = 'scratch-gui/mew-graph/UNDO_MEW_GRAPH';
const REDO_MEW_GRAPH = 'scratch-gui/mew-graph/REDO_MEW_GRAPH';
const RESET_MEW_GRAPH = 'scratch-gui/mew-graph/RESET_MEW_GRAPH';

const MAX_HISTORY = 100;

const isMetaOnlyChange = (prev, next) => {
    if (!prev || !next) return false;
    return (
        prev !== next &&
        prev.nodes === next.nodes &&
        prev.viewport === next.viewport
    );
};

export const checkpointMewGraph = () => ({type: CHECKPOINT_MEW_GRAPH});

const createEmptyMewGraph = () => ({
    nodes: [],
    viewport: {panX: 0, panY: 0, zoom: 1},
    meta: {version: 1, updatedAt: new Date().toISOString()}
});

const asHistoryState = state => {
    if (state && Array.isArray(state.past) && Object.prototype.hasOwnProperty.call(state, 'present')) {
        return state;
    }
    // Backward compatibility if old state was just the graph object/null.
    return {
        past: [],
        present: state || null,
        future: []
    };
};

const pushPast = (past, present) => {
    if (!present) return past;
    const next = [...past, present];
    if (next.length > MAX_HISTORY) next.shift();
    return next;
};

export const setMewGraph = (graph, options = {}) => ({
    type: SET_MEW_GRAPH,
    graph,
    checkpoint: options.checkpoint !== false
});

// Alias for clarity in future callsites.
export const applyMewGraph = setMewGraph;

export const undoMewGraph = () => ({type: UNDO_MEW_GRAPH});
export const redoMewGraph = () => ({type: REDO_MEW_GRAPH});

export const resetMewGraph = () => ({type: RESET_MEW_GRAPH});

export const getMewGraph = state => {
    const raw = state.scratchGui?.mewGraph;
    const normalized = asHistoryState(raw);
    return normalized.present;
};

export const getCanUndoMewGraph = state => {
    const raw = state.scratchGui?.mewGraph;
    const normalized = asHistoryState(raw);
    return normalized.past.length > 0;
};

export const getCanRedoMewGraph = state => {
    const raw = state.scratchGui?.mewGraph;
    const normalized = asHistoryState(raw);
    return normalized.future.length > 0;
};

const initialState = {
    past: [],
    present: null,
    future: []
};

const reducer = (state = initialState, action) => {
    const current = asHistoryState(state);

    switch (action.type) {
    case CHECKPOINT_MEW_GRAPH:
        return {
            past: pushPast(current.past, current.present),
            present: current.present,
            future: []
        };

    case SET_MEW_GRAPH: {
        const nextPresent = action.graph ?? null;
        if (nextPresent === current.present) return current;

        const updatedAtBefore = current.present?.meta?.updatedAt;
        const updatedAtAfter = nextPresent?.meta?.updatedAt;

        const shouldCheckpoint =
            action.checkpoint &&
            updatedAtAfter !== updatedAtBefore &&
            !isMetaOnlyChange(current.present, nextPresent);

        return {
            past: shouldCheckpoint ? pushPast(current.past, current.present) : current.past,
            present: nextPresent,
            future: []
        };
    }

    case UNDO_MEW_GRAPH: {
        if (!current.past.length) return current;
        const previous = current.past[current.past.length - 1];
        return {
            past: current.past.slice(0, -1),
            present: previous,
            future: current.present ? [current.present, ...current.future] : current.future
        };
    }

    case REDO_MEW_GRAPH: {
        if (!current.future.length) return current;
        const next = current.future[0];
        return {
            past: current.present ? pushPast(current.past, current.present) : current.past,
            present: next,
            future: current.future.slice(1)
        };
    }

    case RESET_MEW_GRAPH:
        return {
            past: [],
            present: createEmptyMewGraph(),
            future: []
        };

    default:
        return current;
    }
};

export default reducer;