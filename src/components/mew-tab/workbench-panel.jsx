import React, {
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import ReactDOM from "react-dom";
import Node from "./Node";
import { getNodeDefinition } from "./nodeCatalog";
import { resolveNodeDefaults } from "./workbench/defaultValueRules";
import styles from "./mew-tab.css";
import { connect } from "react-redux";
import {
    setMewGraph,
    getMewGraph,
    undoMewGraph,
    checkpointMewGraph,
} from "../../reducers/mew-graph";
import { getIsShowingProject } from "../../reducers/project-state";
import { getActiveTabIndex, MEW_TAB_INDEX } from "../../reducers/editor-tab";
import {
    areNodeIdsConnected,
    setNodesStatus,
    createRunManager,
    registerDefaultRunners,
    resolveUpstreamStartNode,
    findClusters,
    identifyClusterForNode,
} from "./workbench/run";
import { IoPlay } from "react-icons/io5";

import {
    createEmptyGraph,
    deriveEdges,
    serializeGraph,
    deserializeGraph,
    validateGraph,
} from "./workbench/graphState";

import { getConnectedUpstreamSourcesFromEdges } from "./row-modules/utils/notepadTemplateValue";
import {
    getScratchVariableAndListNames,
    getScratchBroadcastNames,
    setupScratchBroadcastReceiver,
    attachScratchBroadcastProbe,
    detachScratchBroadcastHooks
} from "./helper/scratchVm";
import { sendServoPositionToEsp32 } from "./helper/esp32Serial";
import { AZURE_SOURCE } from "./helper/azureConfig";
import { userId } from "./helper/userId";

const PROJECT_STORAGE_KEY = "mew.project.graph.v1";
const STATUS_ROW_ID = "state";
const VM_POLL_INTERVAL_MS = 1000;
const TOKEN_BUCKET_STORAGE_KEY = "tokenBucketEstimate";
const MAX_TOKENS = 1000;
const REFILL_RATE = 1;

const areStringArraysEqual = (a = [], b = []) => {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i += 1) {
        if (a[i] !== b[i]) return false;
    }
    return true;
};

const loadInitialGraph = () => {
    if (typeof window === "undefined") return createEmptyGraph();

    try {
        const raw = window.localStorage.getItem(PROJECT_STORAGE_KEY);
        if (!raw) return createEmptyGraph();
        return deserializeGraph(raw);
    } catch {
        return createEmptyGraph();
    }
};

const loadLocalGraph = () => {
    if (typeof window === "undefined") return null;
    try {
        const raw = window.localStorage.getItem(PROJECT_STORAGE_KEY);
        if (!raw) return null;
        return deserializeGraph(raw);
    } catch {
        return null;
    }
};

const loadStoredTokenBucket = () => {
    if (typeof window === "undefined") {
        return {
            userId: "unknown",
            tokensRemaining: MAX_TOKENS,
            lastRefill: Date.now(),
            maxTokens: MAX_TOKENS,
            refillRate: REFILL_RATE,
        };
    }

    try {
        const raw = window.localStorage.getItem(TOKEN_BUCKET_STORAGE_KEY);
        if (!raw) {
            const initialValue = {
                userId: "unknown",
                tokensRemaining: MAX_TOKENS,
                lastRefill: Date.now(),
                maxTokens: MAX_TOKENS,
                refillRate: REFILL_RATE,
            };
            window.localStorage.setItem(
                TOKEN_BUCKET_STORAGE_KEY,
                JSON.stringify(initialValue),
            );
            return initialValue;
        }

        return JSON.parse(raw);
    } catch {
        return {
            userId: "unknown",
            tokensRemaining: MAX_TOKENS,
            lastRefill: Date.now(),
            maxTokens: MAX_TOKENS,
            refillRate: REFILL_RATE,
        };
    }
};

const storeTokenBucketEstimate = (estimateObj) => {
    try {
        window.localStorage.setItem(
            TOKEN_BUCKET_STORAGE_KEY,
            JSON.stringify(estimateObj),
        );
    } catch {
        // ignore
    }
};

const normalizeTokenBucketEstimate = (tokenBucket = {}) => ({
    userId: tokenBucket.userId || "unknown",
    tokensRemaining: Math.max(
        0,
        Math.min(
            MAX_TOKENS,
            Math.floor(Number(tokenBucket.tokensRemaining) || MAX_TOKENS),
        ),
    ),
    lastRefill: Number(tokenBucket.lastRefill) || Date.now(),
    maxTokens: MAX_TOKENS,
    refillRate: REFILL_RATE,
});

const computeTokenBucketView = (tokenBucket) => {
    const normalized = normalizeTokenBucketEstimate(tokenBucket);
    const now = Date.now();
    const secondsSinceRefill = Math.floor(
        (now - normalized.lastRefill) / 1000,
    );
    const estimatedTokens = Math.min(
        normalized.maxTokens,
        normalized.tokensRemaining + secondsSinceRefill * normalized.refillRate,
    );

    return {
        ...normalized,
        tokensRemaining: Math.max(0, Math.floor(estimatedTokens)),
        percent: Math.max(0, Math.min(1, estimatedTokens / normalized.maxTokens)),
    };
};

const WorkbenchPanel = ({
    setMewGraph: dispatchSetMewGraph,
    undoMewGraph: dispatchUndoMewGraph,
    checkpointMewGraph: dispatchCheckpointMewGraph,
    mewGraph,
    isMewTabActive,
    isScratchProjectReady,
    vm,
}) => {
    const [graph, setGraph] = useState(
        () => mewGraph || loadLocalGraph() || createEmptyGraph(),
    );
    const graphRef = useRef(graph);
    const runManagerRef = useRef(null);
    const isHydratingFromReduxRef = useRef(false);
    const lastAppliedReduxUpdatedAt = useRef(null);
    const [draggingNodeId, setDraggingNodeId] = useState(null);
    const [deletingNodeId, setDeletingNodeId] = useState(null);
    const [dragOverToolbox, setDragOverToolbox] = useState(false);
    const [connecting, setConnecting] = useState(null);
    const connectingRef = useRef(null);
    const workbenchRef = useRef(null);
    const dragRef = useRef(null);
    const [dragPreviews, setDragPreviews] = useState([]);
    const dragOverToolboxRef = useRef(false);
    const tokenBucketRef = useRef(loadStoredTokenBucket());
    const [tokenBucketView, setTokenBucketView] = useState(() =>
        computeTokenBucketView(tokenBucketRef.current),
    );
    const updateTokenBucketBarRef = useRef(null);
    const [isRefillingTokens, setIsRefillingTokens] = useState(false);

    const [overlaySize, setOverlaySize] = useState({ width: 1, height: 1 });
    const [layoutVersion, setLayoutVersion] = useState(0);
    const [scratchVariableNames, setScratchVariableNames] = useState([]);

    const scratchVariableDropdownOptions = useMemo(
        () =>
            scratchVariableNames.length > 0
                ? scratchVariableNames.map((name) => ({
                      value: name,
                      label: name,
                  }))
                : [{ value: "", label: "(no variables or lists found)" }],
        [scratchVariableNames],
    );

    const [scratchBroadcastNames, setScratchBroadcastNames] = useState([]);

    const scratchBroadcastDropdownOptions = useMemo(
        () =>
            scratchBroadcastNames.length > 0
                ? scratchBroadcastNames.map((name) => ({
                      value: name,
                      label: name,
                  }))
                : [{ value: "", label: "(no broadcast messages found)" }],
        [scratchBroadcastNames],
    );

    const edges = useMemo(() => deriveEdges(graph.nodes), [graph.nodes]);

    const notepadUpstreamSourcesByNodeId = useMemo(() => {
        const result = {};
        graph.nodes.forEach((node) => {
            if (node.type !== "Notepad") return;
            const promptValue = node?.data?.prompt?.value;
            result[node.id] = getConnectedUpstreamSourcesFromEdges({
                targetNodeId: node.id,
                nodes: graph.nodes,
                edges,
                templateValue: promptValue,
            });
        });
        return result;
    }, [graph.nodes, edges]);

    const [selectedNodeIds, setSelectedNodeIds] = useState([]);
    const [selectionBox, setSelectionBox] = useState(null);
    const marqueeRef = useRef(null);

    const isNodeSelected = (nodeId) => selectedNodeIds.includes(nodeId);

    const suppressNextCheckpointRef = useRef(false);

    const canRunSelectedCluster = useMemo(
        () => areNodeIdsConnected(graph.nodes, selectedNodeIds),
        [graph.nodes, selectedNodeIds],
    );

    const handleRunSelected = async () => {
        if (!canRunSelectedCluster || !selectedNodeIds.length) {
            return;
        }

        const startNodeId = resolveUpstreamStartNode(
            graph.nodes,
            selectedNodeIds,
        );
        if (!startNodeId) {
            return;
        }

        if (!runManagerRef.current) {
            return;
        }

        try {
            await runManagerRef.current.runNodeCluster(startNodeId);
        } catch (error) {
            void error;
        }
    };

    const selectOnlyNode = (nodeId) => {
        setSelectedNodeIds([nodeId]);
    };

    const toggleNodeSelection = (nodeId) => {
        setSelectedNodeIds((prev) =>
            prev.includes(nodeId)
                ? prev.filter((id) => id !== nodeId)
                : [...prev, nodeId],
        );
    };

    const clearSelection = () => {
        setSelectedNodeIds([]);
    };

    const isEditableElement = (el) => {
        if (!el) return false;
        const tag = el.tagName?.toLowerCase();
        return (
            el.isContentEditable ||
            tag === "input" ||
            tag === "textarea" ||
            tag === "select"
        );
    };

    const getEdgeArrowPath = (p1, p2) => {
        // Bezier curve control points (from bezierPath function)
        const dx = Math.abs(p2.x - p1.x) * 0.5;
        const cp1 = { x: p1.x + dx, y: p1.y };
        const cp2 = { x: p2.x - dx, y: p2.y };
        
        // Calculate position and tangent at t=0.5 on the bezier curve
        const t = 0.5;
        const mt = 1 - t; // 0.5
        
        // Position on curve: B(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
        const px = mt*mt*mt * p1.x + 3*mt*mt*t * cp1.x + 3*mt*t*t * cp2.x + t*t*t * p2.x;
        const py = mt*mt*mt * p1.y + 3*mt*mt*t * cp1.y + 3*mt*t*t * cp2.y + t*t*t * p2.y;
        
        // Tangent vector (derivative) at t=0.5: B'(t) = 3(1-t)²(P1-P0) + 6(1-t)t(P2-P1) + 3t²(P3-P2)
        const tangentX = 3*mt*mt * (cp1.x - p1.x) + 6*mt*t * (cp2.x - cp1.x) + 3*t*t * (p2.x - cp2.x);
        const tangentY = 3*mt*mt * (cp1.y - p1.y) + 6*mt*t * (cp2.y - cp1.y) + 3*t*t * (p2.y - cp2.y);
        
        // Get angle from tangent vector
        const angle = Math.atan2(tangentY, tangentX);
        
        // Triangle arrow size
        const arrowLength = 6;
        const arrowWidth = 6;
        
        // Calculate triangle points (pointing along tangent direction)
        const tipX = px + arrowLength * Math.cos(angle);
        const tipY = py + arrowLength * Math.sin(angle);
        
        // Back corners perpendicular to tangent direction
        const perpAngle = angle + Math.PI / 2;
        const c1x = px - arrowLength * Math.cos(angle) + arrowWidth * Math.cos(perpAngle);
        const c1y = py - arrowLength * Math.sin(angle) + arrowWidth * Math.sin(perpAngle);
        const c2x = px - arrowLength * Math.cos(angle) - arrowWidth * Math.cos(perpAngle);
        const c2y = py - arrowLength * Math.sin(angle) - arrowWidth * Math.sin(perpAngle);
        
        return `M ${tipX} ${tipY} L ${c1x} ${c1y} L ${c2x} ${c2y} Z`;
    };

    const blurActiveEditableIfClickOff = (target) => {
        const active = document.activeElement;
        if (!isEditableElement(active)) return;

        // keep focus if user clicked inside the currently focused editable
        if (target && active.contains && active.contains(target)) return;

        active.blur();
    };

    updateTokenBucketBarRef.current = (incomingTokenBucket) => {
        if (!incomingTokenBucket) return;

        const normalizedIncoming = normalizeTokenBucketEstimate(
            incomingTokenBucket,
        );
        const currentTokenBucket = tokenBucketRef.current;

        if (
            !currentTokenBucket ||
            normalizedIncoming.lastRefill >= currentTokenBucket.lastRefill
        ) {
            tokenBucketRef.current = normalizedIncoming;
        }

        const nextView = computeTokenBucketView(tokenBucketRef.current);
        setTokenBucketView(nextView);
        storeTokenBucketEstimate({
            ...tokenBucketRef.current,
            tokensRemaining: nextView.tokensRemaining,
        });

        if (typeof window !== "undefined") {
            window.currentTokenBucketInfo = {
                ...tokenBucketRef.current,
                tokensRemaining: nextView.tokensRemaining,
            };
        }
    };

    useEffect(() => {
        if (typeof window === "undefined") return undefined;

        const tick = () => {
            const nextView = computeTokenBucketView(tokenBucketRef.current);
            setTokenBucketView(nextView);
            storeTokenBucketEstimate({
                ...tokenBucketRef.current,
                tokensRemaining: nextView.tokensRemaining,
            });
            window.currentTokenBucketInfo = {
                ...tokenBucketRef.current,
                tokensRemaining: nextView.tokensRemaining,
            };
        };

        tick();
        const intervalId = window.setInterval(tick, 1000);
        const legacyUpdater = (incomingTokenBucket) => {
            updateTokenBucketBarRef.current?.(incomingTokenBucket);
        };

        window.updateTokenBucketBar = legacyUpdater;

        return () => {
            window.clearInterval(intervalId);
            if (window.updateTokenBucketBar === legacyUpdater) {
                delete window.updateTokenBucketBar;
            }
        };
    }, []);

    const handleRefillTokens = async () => {
        if (isRefillingTokens) return;

        setIsRefillingTokens(true);

        try {
            const response = await fetch(`${AZURE_SOURCE}/api/refillBucket`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": userId,
                },
            });

            let result;
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                result = await response.json();
            } else {
                result = { message: await response.text() };
            }

            if (response.ok && result.tokenBucket) {
                updateTokenBucketBarRef.current?.(result.tokenBucket);
                if (typeof window !== "undefined") {
                    window.alert("Tokens refilled!");
                }
                return;
            }

            if (typeof window !== "undefined") {
                window.alert(
                    result.message || "Refill failed. You may not be whitelisted.",
                );
            }
        } catch (error) {
            if (typeof window !== "undefined") {
                window.alert(`Error contacting server: ${error.message}`);
            }
        } finally {
            setIsRefillingTokens(false);
        }
    };

    const normalizeRect = (box) => {
        if (!box) return null;
        return {
            left: Math.min(box.x1, box.x2),
            top: Math.min(box.y1, box.y2),
            right: Math.max(box.x1, box.x2),
            bottom: Math.max(box.y1, box.y2),
        };
    };

    const getWorkbenchNodeRect = (nodeId) => {
        const wb = workbenchRef.current;
        if (!wb) return null;

        const el = wb.querySelector(`[data-workbench-node-id="${nodeId}"]`);
        if (!el) return null;

        const wbRect = wb.getBoundingClientRect();
        const r = el.getBoundingClientRect();

        return {
            left: r.left - wbRect.left + wb.scrollLeft,
            top: r.top - wbRect.top + wb.scrollTop,
            right: r.right - wbRect.left + wb.scrollLeft,
            bottom: r.bottom - wbRect.top + wb.scrollTop,
        };
    };

    const isRectOverlapping = (a, b) =>
        a.left < b.right &&
        a.right > b.left &&
        a.top < b.bottom &&
        a.bottom > b.top;

    const buildGroupPreviews = (active, dx, dy, deleting = false) => {
        const wb = workbenchRef.current;
        if (!wb) return [];
        const wbRect = wb.getBoundingClientRect();

        return (active.draggedNodeIds || [])
            .map((nodeId) => {
                const start = active.startPositions[nodeId];
                const node = graph.nodes.find((n) => n.id === nodeId);
                if (!start || !node) return null;

                const localX = start.x + dx;
                const localY = start.y + dy;

                return {
                    nodeId,
                    nodeType: node.type,
                    x: wbRect.left - wb.scrollLeft + localX,
                    y: wbRect.top - wb.scrollTop + localY,
                    deleting,
                };
            })
            .filter(Boolean);
    };

    useEffect(() => {
        // If this render came from Redux hydration, skip pushing back to Redux.
        if (isHydratingFromReduxRef.current) {
            isHydratingFromReduxRef.current = false;
            suppressNextCheckpointRef.current = false;
            return;
        }
        const checkpoint = !suppressNextCheckpointRef.current;
        dispatchSetMewGraph(graph, { checkpoint });
        lastAppliedReduxUpdatedAt.current = graph?.meta?.updatedAt || null;
        suppressNextCheckpointRef.current = false;
    }, [dispatchSetMewGraph, graph]);

    useEffect(() => {
        graphRef.current = graph;
    }, [graph]);

    const vmRef = useRef(vm);
    useEffect(() => {
        vmRef.current = vm;
    }, [vm]);

    const receiverBroadcastRegistrationsRef = useRef(new Map());

    useEffect(() => {
        registerDefaultRunners();

        runManagerRef.current = createRunManager({
            getGraph: () => graphRef.current,
            getVm: () => vmRef.current,
            applyNodeStatus: (nodeId, status) => {
                suppressNextCheckpointRef.current = true;
                setGraph((prev) => ({
                    ...prev,
                    nodes: setNodesStatus(
                        prev.nodes,
                        [nodeId],
                        status,
                        STATUS_ROW_ID,
                    ),
                }));
            },
            applyNodeRuntimePatch: (nodeId, patch) => {
                suppressNextCheckpointRef.current = true;
                setGraph((prev) => ({
                    ...prev,
                    nodes: prev.nodes.map((node) => {
                        if (node.id !== nodeId) return node;
                        return {
                            ...node,
                            data: {
                                ...(node.data || {}),
                                __runtime: {
                                    ...((node.data && node.data.__runtime) ||
                                        {}),
                                    ...patch,
                                },
                            },
                        };
                    }),
                }));
                if (patch?.tokenBucket) {
                    updateTokenBucketBarRef.current?.(patch.tokenBucket);
                }
            },
            applyNodeDataPatch: (nodeId, rowId, field, value) => {
                suppressNextCheckpointRef.current = true;
                setGraph((prev) => ({
                    ...prev,
                    nodes: prev.nodes.map((node) => {
                        if (node.id !== nodeId) return node;
                        return {
                            ...node,
                            data: {
                                ...(node.data || {}),
                                [rowId]: {
                                    ...((node.data && node.data[rowId]) || {}),
                                    [field]: value,
                                },
                            },
                        };
                    }),
                }));
            },
            onExecutionEvent: (event) => {
                void event;
            },
        });

        if (typeof window !== "undefined") {
            window.__MEW_RUN_MANAGER__ = runManagerRef.current;
        }
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        window.__MEW_RUN_DEBUG__ = {
            runSelected: () => handleRunSelected(),
            getRuntimeState: () =>
                runManagerRef.current?.runtimeStore?.getState(),
            resetRuntime: () => runManagerRef.current?.reset?.(),
            getGraph: () => graphRef.current,
        };
    }, [handleRunSelected, graph]);

    useEffect(() => {
        if (!isScratchProjectReady) {
            setScratchVariableNames((prev) =>
                prev.length ? [] : prev,
            );
            setScratchBroadcastNames((prev) =>
                prev.length ? [] : prev,
            );
            return undefined;
        }

        let canceled = false;

        const syncScratchVariables = () => {
            const names = getScratchVariableAndListNames(vm);

            setScratchVariableNames((prev) =>
                areStringArraysEqual(prev, names) ? prev : names,
            );
        };

        const syncScratchBroadcasts = () => {
            const names = getScratchBroadcastNames(vm);

            setScratchBroadcastNames((prev) =>
                areStringArraysEqual(prev, names) ? prev : names,
            );
        };

        syncScratchVariables();
        syncScratchBroadcasts();

        const intervalId = window.setInterval(() => {
            if (canceled) return;
            syncScratchVariables();
            syncScratchBroadcasts();
        }, VM_POLL_INTERVAL_MS);

        return () => {
            canceled = true;
            window.clearInterval(intervalId);
        };
    }, [vm, isScratchProjectReady]);

    useEffect(() => {
        if (!isScratchProjectReady || scratchVariableNames.length === 0) {
            return;
        }

        const availableNames = new Set(scratchVariableNames);
        const fallbackValue = scratchVariableNames[0] || "";

        setGraph((prev) => {
            let didChange = false;

            const nextNodes = prev.nodes.map((node) => {
                if (node.type !== "Variable") return node;

                const currentValue = node?.data?.variableName?.value;
                const nextValue =
                    typeof currentValue === "string" &&
                    availableNames.has(currentValue)
                        ? currentValue
                        : fallbackValue;

                if (nextValue === currentValue) return node;

                didChange = true;
                return {
                    ...node,
                    data: {
                        ...(node.data || {}),
                        variableName: {
                            ...((node.data && node.data.variableName) || {}),
                            value: nextValue,
                        },
                    },
                };
            });

            if (!didChange) return prev;

            return {
                ...prev,
                nodes: nextNodes,
                meta: { ...prev.meta, updatedAt: new Date().toISOString() },
            };
        });
    }, [scratchVariableNames, isScratchProjectReady]);

    useEffect(() => {
        if (!isScratchProjectReady || scratchBroadcastNames.length === 0) {
            return;
        }

        const availableNames = new Set(scratchBroadcastNames);
        const fallbackValue = scratchBroadcastNames[0] || "";

        setGraph((prev) => {
            let didChange = false;

            const nextNodes = prev.nodes.map((node) => {
                if (node.type !== "Receiver" && node.type !== "Broadcaster")
                    return node;

                const currentValue = node?.data?.message?.value;
                const nextValue =
                    typeof currentValue === "string" &&
                    availableNames.has(currentValue)
                        ? currentValue
                        : fallbackValue;

                if (nextValue === currentValue) return node;

                didChange = true;
                return {
                    ...node,
                    data: {
                        ...(node.data || {}),
                        message: {
                            ...((node.data && node.data.message) || {}),
                            value: nextValue,
                        },
                    },
                };
            });

            if (!didChange) return prev;

            return {
                ...prev,
                nodes: nextNodes,
                meta: { ...prev.meta, updatedAt: new Date().toISOString() },
            };
        });
    }, [scratchBroadcastNames, isScratchProjectReady]);

    useEffect(() => {
        if (!vm) return undefined;

        const detachProbe = attachScratchBroadcastProbe(vm);

        return () => {
            detachProbe();
            receiverBroadcastRegistrationsRef.current.forEach((cleanup) => {
                cleanup();
            });
            receiverBroadcastRegistrationsRef.current.clear();
            detachScratchBroadcastHooks(vm);
        };
    }, [vm]);

    useEffect(() => {
        const runManager = runManagerRef.current;
        if (!runManager || !vm) return;

        const currentRegistrations = receiverBroadcastRegistrationsRef.current;
        const nextKeys = new Set();
        const setupReceiver = setupScratchBroadcastReceiver(vm);

        (graph.nodes || [])
            .filter((node) => node.type === "Receiver")
            .forEach((node) => {
                const messageName = String(
                    node?.data?.message?.value || node?.data?.message || "",
                ).trim();

                if (!messageName) return;

                const registrationKey = `${node.id}::${messageName}`;
                nextKeys.add(registrationKey);

                if (currentRegistrations.has(registrationKey)) return;

                const cleanup = setupReceiver({
                    messageName,
                    onReceive: () => {
                        const latestNodes = graphRef.current?.nodes || [];
                        const clusters = findClusters(latestNodes);
                        const clusterIndex = identifyClusterForNode(
                            node.id,
                            clusters,
                        );

                        if (clusterIndex === -1) return;

                        const runningClusters =
                            runManager.runtimeStore.getState().runningClusters;
                        const alreadyRunning =
                            runningClusters &&
                            runningClusters.has(clusterIndex);

                        if (alreadyRunning) return;

                        const startCluster = () => {
                            runManager.runNodeCluster(node.id).catch(() => {});
                        };

                        if (typeof queueMicrotask === "function") {
                            queueMicrotask(startCluster);
                        } else {
                            setTimeout(startCluster, 0);
                        }
                    },
                });

                currentRegistrations.set(registrationKey, cleanup);
            });

        currentRegistrations.forEach((cleanup, registrationKey) => {
            if (nextKeys.has(registrationKey)) return;
            cleanup();
            currentRegistrations.delete(registrationKey);
        });
    }, [graph.nodes, vm]);

    const toFiniteNumber = (value, fallback) => {
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    };

    const getRowContextByNodeType = (nodeType, node = null) => {
        if (nodeType === "Variable") {
            return {
                variableName: {
                    options: scratchVariableDropdownOptions,
                    defaultValue: scratchVariableDropdownOptions[0]?.value || "",
                    disabled: scratchVariableNames.length === 0,
                },
            };
        }

        if (nodeType === "Receiver" || nodeType === "Broadcaster") {
            return {
                message: {
                    options: scratchBroadcastDropdownOptions,
                    defaultValue: scratchBroadcastDropdownOptions[0]?.value || "",
                    disabled: scratchBroadcastNames.length === 0,
                },
            };
        }

        if (nodeType === "Servo" && node) {
            const runtime = node?.data?.__runtime || {};
            const clusterIndex = runtime?.cluster;
            const runningClusters =
                runManagerRef.current?.runtimeStore?.getState?.()?.runningClusters;

            const inRunningCluster =
                typeof clusterIndex === "number" &&
                runningClusters instanceof Set &&
                runningClusters.has(clusterIndex);

            const rangeValue = node?.data?.servoRange?.value || {};
            const rangeMin = toFiniteNumber(rangeValue.left, 0);
            const rangeMax = toFiniteNumber(rangeValue.right, 180);
            const inputRangeValue = node?.data?.normalizedLabel?.value || {};
            const inputRangeMin = toFiniteNumber(inputRangeValue.left, 0);
            const inputRangeMax = toFiniteNumber(inputRangeValue.right, 1);

            return {
                servoValue: {
                    controlledValue: inRunningCluster ? runtime?.servoNormalizedInput : undefined,
                    disabled: inRunningCluster,
                    showTooltips: true,
                    inputRangeMin,
                    inputRangeMax,
                    rangeMin,
                    rangeMax,
                },
            };
        }

        return {};
    };

    const idCounterRef = useRef(0);

    const makeNodeId = (type) => {
        idCounterRef.current += 1;
        return `${type}-${Date.now()}-${idCounterRef.current}`;
    };

    const selectedBounds = useMemo(() => {
        if (!selectedNodeIds.length) return null;

        const rects = selectedNodeIds
            .map((id) => getWorkbenchNodeRect(id))
            .filter(Boolean);

        if (!rects.length) return null;

        return rects.reduce((acc, r) => ({
            left: Math.min(acc.left, r.left),
            top: Math.min(acc.top, r.top),
            right: Math.max(acc.right, r.right),
            bottom: Math.max(acc.bottom, r.bottom),
        }));
    }, [selectedNodeIds, graph.nodes, layoutVersion]);

    const handleDeleteSelected = () => {
        if (!selectedNodeIds.length) return;
        removeNodesAndEdges(selectedNodeIds);
        setSelectedNodeIds([]);
    };

    const handleDuplicateSelected = () => {
        if (!selectedNodeIds.length) return;

        const selectedSet = new Set(selectedNodeIds);
        const sourceNodes = graph.nodes.filter((n) => selectedSet.has(n.id));
        if (!sourceNodes.length) return;

        const idMap = {};
        sourceNodes.forEach((n) => {
            idMap[n.id] = makeNodeId(n.type);
        });

        // Rolling graph snapshot so uniqueness increments across this duplicate batch.
        const workingGraph = {
            ...graph,
            nodes: [...graph.nodes],
        };

        const pairs = sourceNodes.map((orig) => {
            const definition = getNodeDefinition(orig.type);

            // Preserve existing data by default.
            const nextData = JSON.parse(JSON.stringify(orig.data || {}));

            // Re-resolve only unique-like rules on duplicate.
            const defaults = definition?.defaults;
            const rules = Array.isArray(defaults?.rules) ? defaults.rules : [];
            const uniqueRules = rules.filter(
                (r) => r && (r.type === "template" || r.type === "sequence"),
            );

            if (uniqueRules.length) {
                const uniqueResolved = resolveNodeDefaults({
                    nodeType: orig.type,
                    definition: {
                        ...definition,
                        defaults: {
                            ...(defaults || {}),
                            rules: uniqueRules,
                        },
                    },
                    graph: workingGraph,
                });

                Object.entries(uniqueResolved).forEach(([rowId, rowPatch]) => {
                    nextData[rowId] = {
                        ...(nextData[rowId] || {}),
                        ...rowPatch,
                    };
                });
            }

            const clone = {
                ...orig,
                id: idMap[orig.id],
                x: orig.x + 24,
                y: orig.y + 24,
                data: nextData,
                inputs: {},
                outputs: {},
            };

            // Add clone immediately so later clones see its names/values for uniqueness checks.
            workingGraph.nodes.push(clone);

            return { orig, clone };
        });

        // Keep only internal edges among selected nodes, remapped to cloned ids.
        pairs.forEach((pair) => {
            const nextOutputs = {};
            for (const [outPortId, targets] of Object.entries(
                pair.orig.outputs || {},
            )) {
                const remapped = (targets || [])
                    .filter((t) => selectedSet.has(t.nodeId))
                    .map((t) => ({
                        nodeId: idMap[t.nodeId],
                        portId: t.portId,
                    }));
                if (remapped.length) nextOutputs[outPortId] = remapped;
            }
            pair.clone.outputs = nextOutputs;
        });

        // Rebuild cloned inputs from cloned outputs.
        const clonedById = Object.fromEntries(
            pairs.map((p) => [p.clone.id, p.clone]),
        );
        pairs.forEach(({ clone }) => {
            for (const [outPortId, targets] of Object.entries(
                clone.outputs || {},
            )) {
                (targets || []).forEach((t) => {
                    const targetNode = clonedById[t.nodeId];
                    if (!targetNode) return;
                    const list = [...(targetNode.inputs[t.portId] || [])];
                    list.push({ nodeId: clone.id, portId: outPortId });
                    targetNode.inputs[t.portId] = list;
                });
            }
        });

        const clonedNodes = pairs.map((p) => p.clone);
        setGraph((prev) => ({
            ...prev,
            nodes: [...prev.nodes, ...clonedNodes],
            meta: { ...prev.meta, updatedAt: new Date().toISOString() },
        }));

        setSelectedNodeIds(clonedNodes.map((n) => n.id));
    };

    const getLeftmostNodeFromIds = (nodeIds) => {
        const selected = graph.nodes.filter((n) => nodeIds.includes(n.id));
        if (!selected.length) return null;
        return selected.reduce((leftmost, n) => {
            if (!leftmost) return n;
            if (n.x < leftmost.x) return n;
            if (n.x === leftmost.x && n.y < leftmost.y) return n;
            return leftmost;
        }, null);
    };

    const beginDragForNodes = (event, anchorNode, draggedNodeIds) => {
        // checkpoint BEFORE position mutations so one undo restores original positions
        dispatchCheckpointMewGraph();

        event.preventDefault();
        event.stopPropagation();

        setDraggingNodeId(anchorNode.id);

        // Always use leftmost node as delete reference for group drag consistency
        const deleteRefNode =
            getLeftmostNodeFromIds(draggedNodeIds) || anchorNode;

        const deleteRefEl = workbenchRef.current?.querySelector(
            `[data-workbench-node-id="${deleteRefNode.id}"]`,
        );
        const rect = (
            deleteRefEl || event.currentTarget
        ).getBoundingClientRect();

        const offsetX = event.clientX - rect.left;
        const offsetY = event.clientY - rect.top;

        const startPositions = {};
        for (const n of graph.nodes) {
            if (draggedNodeIds.includes(n.id)) {
                startPositions[n.id] = { x: n.x, y: n.y };
            }
        }

        setDragPreviews([]);
        dragOverToolboxRef.current = false;
        setDragOverToolbox(false);

        dragRef.current = {
            nodeId: anchorNode.id,
            nodeType: anchorNode.type,
            draggedNodeIds,
            startPositions,
            startClientX: event.clientX,
            startClientY: event.clientY,
            offsetX,
            offsetY,
            width: rect.width,
            height: rect.height,
            deleteRefNodeId: deleteRefNode.id,
            deleteRefNodeType: deleteRefNode.type,
        };

        const onPointerMove = (moveEvent) => {
            const active = dragRef.current;
            if (!active) return;

            const dx = moveEvent.clientX - active.startClientX;
            const dy = moveEvent.clientY - active.startClientY;

            moveDraggedNodesByDelta(
                active.draggedNodeIds,
                active.startPositions,
                dx,
                dy,
            );

            // overlap/delete reference is ALWAYS leftmost node
            const nodeRect = {
                left: moveEvent.clientX - active.offsetX,
                top: moveEvent.clientY - active.offsetY,
                right: moveEvent.clientX - active.offsetX + active.width,
                bottom: moveEvent.clientY - active.offsetY + active.height,
            };

            const toolboxEl = document.querySelector(
                '[data-mew-toolbox-dropzone="true"]',
            );
            const toolboxRect = toolboxEl
                ? toolboxEl.getBoundingClientRect()
                : null;
            const isOverToolbox = toolboxRect
                ? isRectOverlapping(nodeRect, toolboxRect)
                : false;
            if (isOverToolbox !== dragOverToolboxRef.current) {
                dragOverToolboxRef.current = isOverToolbox;
                setDragOverToolbox(isOverToolbox);
                if (!isOverToolbox) setDragPreviews([]);
            }

            if (isOverToolbox) {
                setDragPreviews(buildGroupPreviews(active, dx, dy, false));
            }
        };

        const onPointerUp = (upEvent) => {
            const active = dragRef.current;

            const nodeRect = active
                ? {
                      left: upEvent.clientX - active.offsetX,
                      top: upEvent.clientY - active.offsetY,
                      right: upEvent.clientX - active.offsetX + active.width,
                      bottom: upEvent.clientY - active.offsetY + active.height,
                  }
                : null;

            const toolboxEl = document.querySelector(
                '[data-mew-toolbox-dropzone="true"]',
            );
            const toolboxRect = toolboxEl
                ? toolboxEl.getBoundingClientRect()
                : null;
            const droppedInToolbox =
                nodeRect && toolboxRect
                    ? isRectOverlapping(nodeRect, toolboxRect)
                    : false;

            dragRef.current = null;
            setDraggingNodeId(null);
            dragOverToolboxRef.current = false;
            setDragOverToolbox(false);

            if (droppedInToolbox) {
                const idsToDelete = active?.draggedNodeIds || [anchorNode.id];

                if (
                    idsToDelete.length > 1 &&
                    !window.confirm(`Delete ${idsToDelete.length} nodes?`)
                ) {
                    setDragPreviews([]);
                    setGraph((prev) => ({
                        ...prev,
                        meta: {
                            ...prev.meta,
                            updatedAt: new Date().toISOString(),
                        },
                    }));
                    window.removeEventListener("pointermove", onPointerMove);
                    window.removeEventListener("pointerup", onPointerUp);
                    return;
                }

                setDeletingNodeId(active?.deleteRefNodeId || anchorNode.id);

                const dx = upEvent.clientX - active.startClientX;
                const dy = upEvent.clientY - active.startClientY;
                setDragPreviews(buildGroupPreviews(active, dx, dy, true));

                window.setTimeout(() => {
                    suppressNextCheckpointRef.current = true;
                    removeNodesAndEdges(idsToDelete);
                    setSelectedNodeIds((prev) =>
                        prev.filter((id) => !idsToDelete.includes(id)),
                    );
                    setDeletingNodeId(null);
                    setDragPreviews([]);
                }, 170);
            } else {
                setDragPreviews([]);
                setGraph((prev) => ({
                    ...prev,
                    meta: { ...prev.meta, updatedAt: new Date().toISOString() },
                }));
            }

            window.removeEventListener("pointermove", onPointerMove);
            window.removeEventListener("pointerup", onPointerUp);
        };

        window.addEventListener("pointermove", onPointerMove);
        window.addEventListener("pointerup", onPointerUp);
    };

    const handleSelectionBoundsPointerDown = (event) => {
        if (event.button !== 0) return;
        if (selectedNodeIds.length < 2) return;

        const anchorNode = graph.nodes.find((n) => n.id === selectedNodeIds[0]);
        if (!anchorNode) return;

        beginDragForNodes(event, anchorNode, selectedNodeIds);
    };

    useEffect(() => {
        if (!mewGraph) return;

        const check = validateGraph(mewGraph);
        if (!check.valid) return;

        const incomingUpdatedAt = mewGraph?.meta?.updatedAt || null;
        const localUpdatedAt = graphRef.current?.meta?.updatedAt || null;

        // No-op if already same graph.
        if (mewGraph === graphRef.current) return;
        if (incomingUpdatedAt && incomingUpdatedAt === localUpdatedAt) return;
        if (
            incomingUpdatedAt &&
            incomingUpdatedAt === lastAppliedReduxUpdatedAt.current
        )
            return;

        lastAppliedReduxUpdatedAt.current = incomingUpdatedAt;
        isHydratingFromReduxRef.current = true;
        setGraph(mewGraph);
    }, [mewGraph]);

    // Keep localStorage as fallback cache
    useEffect(() => {
        try {
            window.localStorage.setItem(
                PROJECT_STORAGE_KEY,
                serializeGraph(graph),
            );
        } catch {
            // ignore
        }
    }, [graph]);

    useEffect(() => {
        const onKeyDown = (event) => {
            if (!isMewTabActive) return; // gate all MEW shortcuts to MEW tab only

            const target = event.target;
            const tag = target?.tagName?.toLowerCase();
            const isTyping =
                target?.isContentEditable ||
                tag === "input" ||
                tag === "textarea" ||
                tag === "select";
            if (isTyping) return;

            const key = (event.key || "").toLowerCase();
            const hasMod = event.metaKey || event.ctrlKey;

            if (hasMod && key === "z" && !event.shiftKey) {
                event.preventDefault();
                dispatchUndoMewGraph();
                return;
            }

            // Delete / Backspace -> delete selected
            if (
                (event.key === "Delete" || event.key === "Backspace") &&
                selectedNodeIds.length > 0
            ) {
                event.preventDefault();
                handleDeleteSelected();
                return;
            }

            // Cmd/Ctrl + D -> duplicate selected
            if (hasMod && key === "d" && selectedNodeIds.length > 0) {
                event.preventDefault();
                handleDuplicateSelected();
                return;
            }

            // Esc -> clear selection
            if (event.key === "Escape" && selectedNodeIds.length > 0) {
                event.preventDefault();
                clearSelection();
                return;
            }

            // Cmd/Ctrl + A -> select all nodes (optional from phase plan)
            if (hasMod && key === "a") {
                event.preventDefault();
                setSelectedNodeIds(graph.nodes.map((n) => n.id));
            }
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [
        selectedNodeIds,
        graph.nodes,
        handleDeleteSelected,
        handleDuplicateSelected,
        dispatchUndoMewGraph,
        isMewTabActive,
    ]);

    useLayoutEffect(() => {
        const wb = workbenchRef.current;
        if (!wb) return undefined;

        let rafId = null;
        let lastWidth = -1;
        let lastHeight = -1;

        const measure = () => {
            rafId = null;

            const nextWidth = Math.max(wb.scrollWidth, wb.clientWidth, 1);
            const nextHeight = Math.max(wb.scrollHeight, wb.clientHeight, 1);

            setOverlaySize((prev) =>
                prev.width === nextWidth && prev.height === nextHeight
                    ? prev
                    : { width: nextWidth, height: nextHeight },
            );

            if (nextWidth !== lastWidth || nextHeight !== lastHeight) {
                lastWidth = nextWidth;
                lastHeight = nextHeight;
                setLayoutVersion((v) => v + 1);
            }
        };

        const scheduleMeasure = () => {
            if (rafId !== null) return;
            rafId = requestAnimationFrame(measure);
        };

        scheduleMeasure();

        const ro = new ResizeObserver(() => {
            scheduleMeasure();
        });
        ro.observe(wb);

        wb.addEventListener("scroll", scheduleMeasure, { passive: true });
        window.addEventListener("resize", scheduleMeasure);

        return () => {
            ro.disconnect();
            wb.removeEventListener("scroll", scheduleMeasure);
            window.removeEventListener("resize", scheduleMeasure);
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
            }
        };
    }, []);

    useLayoutEffect(() => {
        // after nodes/edges change, wait one frame so ports exist in DOM
        const id = requestAnimationFrame(() => setLayoutVersion((v) => v + 1));
        return () => cancelAnimationFrame(id);
    }, [graph.nodes, edges.length]);

    const toLocalCoords = (clientX, clientY) => {
        const rect = workbenchRef.current?.getBoundingClientRect();
        const scrollLeft = workbenchRef.current?.scrollLeft || 0;
        const scrollTop = workbenchRef.current?.scrollTop || 0;
        return {
            x: rect ? clientX - rect.left + scrollLeft : clientX,
            y: rect ? clientY - rect.top + scrollTop : clientY,
        };
    };

    const getPortCenter = (nodeId, portId, direction) => {
        const wb = workbenchRef.current;
        if (!wb) return null;
        const rect = wb.getBoundingClientRect();
        const el = wb.querySelector(
            `[data-node-id="${nodeId}"][data-port-id="${portId}"][data-port-direction="${direction}"]`,
        );
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
            x: r.left - rect.left + wb.scrollLeft + r.width / 2,
            y: r.top - rect.top + wb.scrollTop + r.height / 2,
        };
    };

    const bezierPath = (p1, p2) => {
        const dx = Math.abs(p2.x - p1.x) * 0.5;
        return `M ${p1.x} ${p1.y} C ${p1.x + dx} ${p1.y}, ${p2.x - dx} ${p2.y}, ${p2.x} ${p2.y}`;
    };

    const connectPorts = (fromNodeId, fromPortId, toNodeId, toPortId) => {
        if (fromNodeId === toNodeId) return;
        setGraph((prev) => {
            const nodes = prev.nodes.map((n) => {
                if (n.id === fromNodeId) {
                    const outputs = { ...(n.outputs || {}) };
                    const list = [...(outputs[fromPortId] || [])];
                    const exists = list.some(
                        (t) => t.nodeId === toNodeId && t.portId === toPortId,
                    );
                    if (!exists)
                        list.push({ nodeId: toNodeId, portId: toPortId });
                    outputs[fromPortId] = list;
                    return { ...n, outputs };
                }
                if (n.id === toNodeId) {
                    const inputs = { ...(n.inputs || {}) };
                    const list = [...(inputs[toPortId] || [])];
                    const exists = list.some(
                        (t) =>
                            t.nodeId === fromNodeId && t.portId === fromPortId,
                    );
                    if (!exists)
                        list.push({ nodeId: fromNodeId, portId: fromPortId });
                    inputs[toPortId] = list;
                    return { ...n, inputs };
                }
                return n;
            });
            return {
                ...prev,
                nodes,
                meta: { ...prev.meta, updatedAt: new Date().toISOString() },
            };
        });
    };

    const clearPortActive = () => {
        const wb = workbenchRef.current;
        if (!wb) return;
        wb.querySelectorAll(`.${styles.nodePoint}.active`).forEach((el) =>
            el.classList.remove("active"),
        );
    };

    const removeNodeAndEdges = (nodeId) => {
        setGraph((prev) => {
            const nextNodes = prev.nodes
                .filter((n) => n.id !== nodeId)
                .map((n) => {
                    const nextOutputs = {};
                    for (const [portId, targets] of Object.entries(
                        n.outputs || {},
                    )) {
                        const kept = (targets || []).filter(
                            (t) => t.nodeId !== nodeId,
                        );
                        if (kept.length) nextOutputs[portId] = kept;
                    }

                    const nextInputs = {};
                    for (const [portId, sources] of Object.entries(
                        n.inputs || {},
                    )) {
                        const kept = (sources || []).filter(
                            (s) => s.nodeId !== nodeId,
                        );
                        if (kept.length) nextInputs[portId] = kept;
                    }

                    return {
                        ...n,
                        outputs: nextOutputs,
                        inputs: nextInputs,
                    };
                });

            return {
                ...prev,
                nodes: nextNodes,
                meta: { ...prev.meta, updatedAt: new Date().toISOString() },
            };
        });
    };

    const removeNodesAndEdges = (nodeIds) => {
        const removeSet = new Set(nodeIds);
        setGraph((prev) => {
            const nextNodes = prev.nodes
                .filter((n) => !removeSet.has(n.id))
                .map((n) => {
                    const nextOutputs = {};
                    for (const [portId, targets] of Object.entries(
                        n.outputs || {},
                    )) {
                        const kept = (targets || []).filter(
                            (t) => !removeSet.has(t.nodeId),
                        );
                        if (kept.length) nextOutputs[portId] = kept;
                    }

                    const nextInputs = {};
                    for (const [portId, sources] of Object.entries(
                        n.inputs || {},
                    )) {
                        const kept = (sources || []).filter(
                            (s) => !removeSet.has(s.nodeId),
                        );
                        if (kept.length) nextInputs[portId] = kept;
                    }

                    return { ...n, outputs: nextOutputs, inputs: nextInputs };
                });

            return {
                ...prev,
                nodes: nextNodes,
                meta: { ...prev.meta, updatedAt: new Date().toISOString() },
            };
        });
    };

    const moveDraggedNodesByDelta = (
        draggedNodeIds,
        startPositions,
        dx,
        dy,
    ) => {
        const dragSet = new Set(draggedNodeIds);
        setGraph((prev) => ({
            ...prev,
            nodes: prev.nodes.map((n) => {
                if (!dragSet.has(n.id)) return n;
                const start = startPositions[n.id];
                return start ? { ...n, x: start.x + dx, y: start.y + dy } : n;
            }),
        }));
    };

    const computeMarqueeHitIds = (box) => {
        const rect = normalizeRect(box);
        if (!rect) return [];
        return graph.nodes
            .filter((n) => {
                const nr = getWorkbenchNodeRect(n.id);
                return nr && isRectOverlapping(rect, nr);
            })
            .map((n) => n.id);
    };

    const handleWorkbenchPointerDown = (event) => {
        if (event.button !== 0) return;

        // Click on empty workbench should remove input focus
        blurActiveEditableIfClickOff(event.target);

        const clickedNode = event.target.closest("[data-workbench-node-id]");
        const clickedPort = event.target.closest("[data-port-direction]");
        const interactive = event.target.closest(
            'input, textarea, select, button, [contenteditable="true"]',
        );
        if (clickedNode || clickedPort || interactive) return;

        event.preventDefault();

        const start = toLocalCoords(event.clientX, event.clientY);
        const initialBox = {
            x1: start.x,
            y1: start.y,
            x2: start.x,
            y2: start.y,
        };

        marqueeRef.current = {
            start,
            additive: event.shiftKey,
            baseSelection: selectedNodeIds, // snapshot for additive selection
            box: initialBox,
        };

        if (!event.shiftKey) clearSelection();
        setSelectionBox(initialBox);

        const onMove = (moveEvent) => {
            const m = marqueeRef.current;
            if (!m) return;

            const p = toLocalCoords(moveEvent.clientX, moveEvent.clientY);
            const nextBox = { x1: m.start.x, y1: m.start.y, x2: p.x, y2: p.y };

            m.box = nextBox;
            setSelectionBox(nextBox);

            // live selection update while dragging marquee
            const hitIds = computeMarqueeHitIds(nextBox);
            if (m.additive) {
                setSelectedNodeIds(
                    Array.from(
                        new Set([...(m.baseSelection || []), ...hitIds]),
                    ),
                );
            } else {
                setSelectedNodeIds(hitIds);
            }
        };

        const onUp = () => {
            const m = marqueeRef.current;
            marqueeRef.current = null;

            // final sync (in case last move event was missed)
            const hitIds = computeMarqueeHitIds(m?.box || initialBox);
            if (m?.additive) {
                setSelectedNodeIds(
                    Array.from(
                        new Set([...(m.baseSelection || []), ...hitIds]),
                    ),
                );
            } else {
                setSelectedNodeIds(hitIds);
            }

            setSelectionBox(null);
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
    };

    const handlePortPointerDown = (event, meta) => {
        if (meta.direction !== "output") return;

        const sourceEl = event.currentTarget;
        sourceEl.classList.add("active");

        const startConn = {
            fromNodeId: meta.nodeId,
            fromPortId: meta.portId,
            pointer: toLocalCoords(event.clientX, event.clientY),
        };

        connectingRef.current = startConn;
        setConnecting(startConn);

        const onMove = (e) => {
            const c = connectingRef.current;
            if (!c) return;
            const next = { ...c, pointer: toLocalCoords(e.clientX, e.clientY) };
            connectingRef.current = next;
            setConnecting(next);
        };

        const cleanup = () => {
            connectingRef.current = null;
            setConnecting(null);
            clearPortActive();
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
        };

        const onUp = (e) => {
            const c = connectingRef.current;
            if (!c) return cleanup();

            const target = document
                .elementFromPoint(e.clientX, e.clientY)
                ?.closest('[data-port-direction="input"]');

            if (target) {
                const toNodeId = target.getAttribute("data-node-id");
                const toPortId = target.getAttribute("data-port-id");
                if (toNodeId && toPortId) {
                    connectPorts(
                        c.fromNodeId,
                        c.fromPortId,
                        toNodeId,
                        toPortId,
                    );
                    target.classList.add("active");
                    setTimeout(() => target.classList.remove("active"), 250);
                }
            }

            cleanup();
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
    };

    const addNodeAtPosition = (nodeType, clientX, clientY) => {
        const { x: localX, y: localY } = toLocalCoords(clientX, clientY);

        setGraph((prev) => {
            const definition = getNodeDefinition(nodeType);
            const initialData = resolveNodeDefaults({
                nodeType,
                definition,
                graph: prev,
            });

            if (nodeType === "Variable") {
                const fallbackVariable = scratchVariableNames[0] || "";
                initialData.variableName = {
                    ...(initialData.variableName || {}),
                    value:
                        typeof initialData?.variableName?.value === "string"
                            ? initialData.variableName.value
                            : fallbackVariable,
                };
            }

            const newNode = {
                id: `${nodeType}-${Date.now()}`,
                type: nodeType,
                x: localX,
                y: localY,
                inputs: {},
                outputs: {},
                data: initialData,
            };

            return {
                ...prev,
                nodes: [...prev.nodes, newNode],
                meta: { ...prev.meta, updatedAt: new Date().toISOString() },
            };
        });
    };

    const moveNodeToPosition = (nodeId, x, y) => {
        setGraph((prev) => ({
            ...prev,
            nodes: prev.nodes.map((n) =>
                n.id === nodeId ? { ...n, x, y } : n,
            ),
        }));
    };

    // Pointer-based drag for existing workbench nodes
    const handleNodePointerDown = (event, node) => {
        if (deletingNodeId === node.id) return;

        const interactive = event.target.closest(
            'input, textarea, select, button, [contenteditable="true"]',
        );
        if (interactive) return;

        // Clicking node body (selection/drag handle) should remove input focus
        blurActiveEditableIfClickOff(event.target);

        if (event.shiftKey) {
            toggleNodeSelection(node.id);
            return;
        }

        const draggedNodeIds = isNodeSelected(node.id)
            ? selectedNodeIds
            : [node.id];
        if (!isNodeSelected(node.id)) selectOnlyNode(node.id);

        beginDragForNodes(event, node, draggedNodeIds);
    };

    const isDraggingSelectionGroup =
        selectedNodeIds.length > 1 &&
        draggingNodeId &&
        selectedNodeIds.includes(draggingNodeId);

    useEffect(() => {
        const onToolboxDrop = (event) => {
            const wb = workbenchRef.current;
            if (!wb) return;

            const {
                nodeType,
                clientX,
                clientY,
                offsetX = 0,
                offsetY = 0,
            } = event.detail || {};
            if (!nodeType) return;

            const r = wb.getBoundingClientRect();
            const inside =
                clientX >= r.left &&
                clientX <= r.right &&
                clientY >= r.top &&
                clientY <= r.bottom;
            if (!inside) return;

            addNodeAtPosition(nodeType, clientX - offsetX, clientY - offsetY);
        };

        window.addEventListener("mew-toolbox-drop", onToolboxDrop);
        return () =>
            window.removeEventListener("mew-toolbox-drop", onToolboxDrop);
    }, [addNodeAtPosition]);

    const handleNodeModuleChange = ({ nodeId, moduleId, newValue }) => {
        const node = graphRef.current?.nodes?.find(n => n.id === nodeId);

        if (node?.type === "Servo" && moduleId === "servoValue") {
            const normalized = Math.max(0, Math.min(1, toFiniteNumber(newValue, 0.5)));
            const range = node?.data?.servoRange?.value || {};
            const min = toFiniteNumber(range.left, 0);
            const max = toFiniteNumber(range.right, 180);
            const servoPosition = min + normalized * (max - min);

            const servoKey = String(node?.data?.servoId?.value || "").trim();
            if (servoKey) {
                sendServoPositionToEsp32({
                    servoKey,
                    position: servoPosition
                }).catch(() => {});
            }
        }

        setGraph((prev) => ({
            ...prev,
            nodes: prev.nodes.map((n) => {
                if (n.id !== nodeId) return n;
                return {
                    ...n,
                    data: {
                        ...(n.data || {}),
                        [moduleId]: {
                            ...((n.data && n.data[moduleId]) || {}),
                            value: newValue,
                        },
                    },
                };
            }),
            meta: { ...prev.meta, updatedAt: new Date().toISOString() },
        }));
    };

    return (
        <div
            ref={workbenchRef}
            className={styles.workbench}
            onPointerDown={handleWorkbenchPointerDown}
        >
            <div className={styles.tokenBucketBarShell}>
                <div
                    className={styles.tokenBucketBar}
                    onPointerDown={(event) => event.stopPropagation()}
                >
                    <div
                        className={styles.tokenBucketBarTrack}
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={tokenBucketView.maxTokens}
                        aria-valuenow={tokenBucketView.tokensRemaining}
                        aria-label="Token bucket remaining"
                    >
                        <div
                            className={styles.tokenBucketBarFill}
                            style={{
                                width: `${tokenBucketView.percent * 100}%`,
                            }}
                        >
                        <span className={styles.tokenBucketBarText}>
                            Tokens: {tokenBucketView.tokensRemaining}/
                            {tokenBucketView.maxTokens}
                        </span>
                        </div>

                    </div>
                </div>
            </div>
            <svg
                key={layoutVersion}
                className={styles.connectionsLayer}
                width={overlaySize.width}
                height={overlaySize.height}
            >
                {edges.map((edge) => {
                    const p1 = getPortCenter(
                        edge.fromNodeId,
                        edge.fromPortId,
                        "output",
                    );
                    const p2 = getPortCenter(
                        edge.toNodeId,
                        edge.toPortId,
                        "input",
                    );
                    if (!p1 || !p2) return null;
                    return (
                        <g key={edge.id}>
                            <path
                                className={styles.connectionPath}
                                d={bezierPath(p1, p2)}
                            />
                            <path
                                className={styles.edgeArrow}
                                d={getEdgeArrowPath(p1, p2)}
                                fill="white"
                                stroke="none"
                            />
                        </g>
                    );
                })}

                {connecting &&
                    (() => {
                        const from = getPortCenter(
                            connecting.fromNodeId,
                            connecting.fromPortId,
                            "output",
                        );
                        if (!from) return null;
                        return (
                            <path
                                className={styles.tempConnectionPath}
                                d={bezierPath(from, connecting.pointer)}
                            />
                        );
                    })()}
            </svg>

            {graph.nodes.map((node) => {
                const promptValue = node?.data?.prompt?.value;

                const baseModules = getNodeDefinition(node.type).rows;
                const notepadUpstreamSources =
                    notepadUpstreamSourcesByNodeId[node.id] || [];

                const modulesForNode =
                    node.type === "Notepad"
                        ? baseModules.map((row) => {
                              if (row.id !== "prompt") return row;
                              return {
                                  ...row,
                                  props: {
                                      ...(row.props || {}),
                                      upstreamSources: notepadUpstreamSources,
                                  },
                              };
                          })
                        : baseModules;

                const rowContextById = getRowContextByNodeType(node.type, node);

                return (
                    <div
                        key={node.id}
                        data-workbench-node-id={node.id}
                        onPointerDown={(event) =>
                            handleNodePointerDown(event, node)
                        }
                        className={[
                            styles.workbenchNode,
                            isNodeSelected(node.id) ? styles.nodeSelected : "",
                            draggingNodeId === node.id
                                ? styles.nodeDragging
                                : "",
                            dragOverToolbox && draggingNodeId === node.id
                                ? styles.nodeOverDeleteZone
                                : "",
                            deletingNodeId === node.id
                                ? styles.nodeDeleting
                                : "",
                        ].join(" ")}
                        style={{
                            position: "absolute",
                            left: node.x,
                            top: node.y,
                            touchAction: "none",
                            // keep original hidden for entire preview lifecycle (including delete animation)
                            visibility: dragPreviews.some(
                                (p) => p.nodeId === node.id,
                            )
                                ? "hidden"
                                : "visible",
                        }}
                    >
                        <Node
                            id={node.id}
                            type={node.type}
                            modules={modulesForNode}
                            data={node.data || {}}
                            onModuleChange={handleNodeModuleChange}
                            onPortPointerDown={handlePortPointerDown}
                            rowContextById={rowContextById}
                        />
                    </div>
                );
            })}

            {selectionBox &&
                (() => {
                    const r = normalizeRect(selectionBox);
                    return (
                        <div
                            className={styles.selectionMarquee}
                            style={{
                                left: r.left,
                                top: r.top,
                                width: Math.max(1, r.right - r.left),
                                height: Math.max(1, r.bottom - r.top),
                            }}
                        />
                    );
                })()}

            {!selectionBox && selectedBounds && selectedNodeIds.length > 1 && (
                <div
                    className={[
                        styles.selectionGroupBounds,
                        styles.selectionGroupBoundsHandle,
                        isDraggingSelectionGroup
                            ? styles.selectionGroupBoundsDragging
                            : "",
                    ].join(" ")}
                    style={{
                        left: selectedBounds.left - 6,
                        top: selectedBounds.top - 6,
                        width: selectedBounds.right - selectedBounds.left + 12,
                        height: selectedBounds.bottom - selectedBounds.top + 12,
                    }}
                    onPointerDown={handleSelectionBoundsPointerDown}
                />
            )}

            {selectedBounds && selectedNodeIds.length > 0 && (
                <div
                    className={styles.selectionActions}
                    style={{
                        left: (selectedBounds.left + selectedBounds.right) / 2,
                        top: selectedBounds.bottom + 10,
                        transform: "translateX(-50%)",
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                >
                    {canRunSelectedCluster && (
                        <button
                            type="button"
                            className={styles.selectionActionButton}
                            onClick={handleRunSelected}
                        >
                            <IoPlay
                                aria-hidden="true"
                                style={{
                                    color: "#22c55e",
                                    marginRight: 6,
                                    verticalAlign: "middle",
                                }}
                            />
                            Run
                        </button>
                    )}
                    <button
                        type="button"
                        className={styles.selectionActionButton}
                        onClick={handleDuplicateSelected}
                    >
                        Duplicate
                    </button>
                    <button
                        type="button"
                        className={styles.selectionActionButton}
                        onClick={handleDeleteSelected}
                    >
                        Delete
                    </button>
                </div>
            )}

            {dragPreviews.length > 0 &&
                ReactDOM.createPortal(
                    <>
                        {dragPreviews.map((preview) => (
                            <div
                                key={preview.nodeId}
                                className={[
                                    styles.dragPortalNode,
                                    dragOverToolbox
                                        ? styles.nodeOverDeleteZone
                                        : "",
                                    preview.deleting ? styles.nodeDeleting : "",
                                ].join(" ")}
                                style={{ left: preview.x, top: preview.y }}
                            >
                                <Node
                                    id={preview.nodeId}
                                    type={preview.nodeType}
                                    modules={
                                        getNodeDefinition(preview.nodeType).rows
                                    }
                                    data={
                                        graph.nodes.find(
                                            (n) => n.id === preview.nodeId,
                                        )?.data || {}
                                    }
                                    onModuleChange={() => {}}
                                    onPortPointerDown={() => {}}
                                    rowContextById={getRowContextByNodeType(
                                        preview.nodeType,
                                        graph.nodes.find((n) => n.id === preview.nodeId) || null
                                    )}
                                />
                            </div>
                        ))}
                    </>,
                    document.body,
                )}
        </div>
    );
};

const mapStateToProps = (state) => ({
    isScratchProjectReady: getIsShowingProject(
        state.scratchGui.projectState.loadingState,
    ),
    mewGraph: getMewGraph(state),
    isMewTabActive: getActiveTabIndex(state) === MEW_TAB_INDEX,
    vm: state.scratchGui.vm,
});

const mapDispatchToProps = {
    setMewGraph,
    undoMewGraph,
    checkpointMewGraph,
};

export default connect(mapStateToProps, mapDispatchToProps)(WorkbenchPanel);
