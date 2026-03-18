import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Node from './Node';
import { NODE_DEFINITIONS } from './nodeCatalog';
import styles from './mew-tab.css';
import {
    createEmptyGraph,
    deriveEdges,
    serializeGraph,
    deserializeGraph
} from './workbench/graphState';

const PROJECT_STORAGE_KEY = 'mew.project.graph.v1';

const loadInitialGraph = () => {
    if (typeof window === 'undefined') return createEmptyGraph();

    try {
        const raw = window.localStorage.getItem(PROJECT_STORAGE_KEY);
        if (!raw) return createEmptyGraph();
        return deserializeGraph(raw);
    } catch {
        return createEmptyGraph();
    }
};

const WorkbenchPanel = () => {
    const [graph, setGraph] = useState(loadInitialGraph);
    const [draggingNodeId, setDraggingNodeId] = useState(null);
    const [connecting, setConnecting] = useState(null);
    const connectingRef = useRef(null);
    const workbenchRef = useRef(null);
    const dragRef = useRef(null);

    const [overlaySize, setOverlaySize] = useState({ width: 1, height: 1 });
    const [layoutVersion, setLayoutVersion] = useState(0);

    const edges = useMemo(() => deriveEdges(graph.nodes), [graph.nodes]);


    useEffect(() => {
        try {
            window.localStorage.setItem(PROJECT_STORAGE_KEY, serializeGraph(graph));
        } catch {
            // ignore storage errors (quota/private mode)
        }
    }, [graph]);

    useLayoutEffect(() => {
        const wb = workbenchRef.current;
        if (!wb) return;

        const sync = () => {
            setOverlaySize({
                width: Math.max(wb.scrollWidth, wb.clientWidth, 1),
                height: Math.max(wb.scrollHeight, wb.clientHeight, 1)
            });
            setLayoutVersion(v => v + 1); // force edge re-measure after layout
        };

        sync();

        const ro = new ResizeObserver(sync);
        ro.observe(wb);
        wb.addEventListener('scroll', sync, { passive: true });
        window.addEventListener('resize', sync);

        return () => {
            ro.disconnect();
            wb.removeEventListener('scroll', sync);
            window.removeEventListener('resize', sync);
        };
    }, []);

    useLayoutEffect(() => {
        // after nodes/edges change, wait one frame so ports exist in DOM
        const id = requestAnimationFrame(() => setLayoutVersion(v => v + 1));
        return () => cancelAnimationFrame(id);
    }, [graph.nodes, edges.length]);

    const toLocalCoords = (clientX, clientY) => {
        const rect = workbenchRef.current?.getBoundingClientRect();
        const scrollLeft = workbenchRef.current?.scrollLeft || 0;
        const scrollTop = workbenchRef.current?.scrollTop || 0;
        return {
            x: rect ? clientX - rect.left + scrollLeft : clientX,
            y: rect ? clientY - rect.top + scrollTop : clientY
        };
    };

    const getPortCenter = (nodeId, portId, direction) => {
        const wb = workbenchRef.current;
        if (!wb) return null;
        const rect = wb.getBoundingClientRect();
        const el = wb.querySelector(
            `[data-node-id="${nodeId}"][data-port-id="${portId}"][data-port-direction="${direction}"]`
        );
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
            x: r.left - rect.left + wb.scrollLeft + (r.width / 2),
            y: r.top - rect.top + wb.scrollTop + (r.height / 2)
        };
    };

    const bezierPath = (p1, p2) => {
        const dx = Math.abs(p2.x - p1.x) * 0.5;
        return `M ${p1.x} ${p1.y} C ${p1.x + dx} ${p1.y}, ${p2.x - dx} ${p2.y}, ${p2.x} ${p2.y}`;
    };

    const connectPorts = (fromNodeId, fromPortId, toNodeId, toPortId) => {
        if (fromNodeId === toNodeId) return;
        setGraph(prev => {
            const nodes = prev.nodes.map(n => {
                if (n.id === fromNodeId) {
                    const outputs = { ...(n.outputs || {}) };
                    const list = [...(outputs[fromPortId] || [])];
                    const exists = list.some(t => t.nodeId === toNodeId && t.portId === toPortId);
                    if (!exists) list.push({ nodeId: toNodeId, portId: toPortId });
                    outputs[fromPortId] = list;
                    return { ...n, outputs };
                }
                if (n.id === toNodeId) {
                    const inputs = { ...(n.inputs || {}) };
                    const list = [...(inputs[toPortId] || [])];
                    const exists = list.some(t => t.nodeId === fromNodeId && t.portId === fromPortId);
                    if (!exists) list.push({ nodeId: fromNodeId, portId: fromPortId });
                    inputs[toPortId] = list;
                    return { ...n, inputs };
                }
                return n;
            });
            return {
                ...prev,
                nodes,
                meta: { ...prev.meta, updatedAt: new Date().toISOString() }
            };
        });
    };

    const clearPortActive = () => {
        const wb = workbenchRef.current;
        if (!wb) return;
        wb.querySelectorAll(`.${styles.nodePoint}.active`).forEach(el => el.classList.remove('active'));
    };

    const handlePortPointerDown = (event, meta) => {
        if (meta.direction !== 'output') return;

        const sourceEl = event.currentTarget;
        sourceEl.classList.add('active');

        const startConn = {
            fromNodeId: meta.nodeId,
            fromPortId: meta.portId,
            pointer: toLocalCoords(event.clientX, event.clientY)
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
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };

        const onUp = (e) => {
            const c = connectingRef.current;
            if (!c) return cleanup();

            const target = document
                .elementFromPoint(e.clientX, e.clientY)
                ?.closest('[data-port-direction="input"]');

            if (target) {
                const toNodeId = target.getAttribute('data-node-id');
                const toPortId = target.getAttribute('data-port-id');
                if (toNodeId && toPortId) {
                    connectPorts(c.fromNodeId, c.fromPortId, toNodeId, toPortId);
                    target.classList.add('active');
                    setTimeout(() => target.classList.remove('active'), 250);
                }
            }

            cleanup();
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    };

    const addNodeAtPosition = (nodeType, clientX, clientY) => {
        const { x: localX, y: localY } = toLocalCoords(clientX, clientY);

        const newNode = {
            id: `${nodeType}-${Date.now()}`,
            type: nodeType,
            x: localX,
            y: localY,
            inputs: {},
            outputs: {},
            data: {}
        };

        setGraph(prev => ({
            ...prev,
            nodes: [...prev.nodes, newNode],
            meta: { ...prev.meta, updatedAt: new Date().toISOString() }
        }));
    };

    const moveNodeToPosition = (nodeId, x, y) => {
        setGraph(prev => ({
            ...prev,
            nodes: prev.nodes.map(n => (n.id === nodeId ? { ...n, x, y } : n))
        }));
    };

    // Pointer-based drag for existing workbench nodes
    const handleNodePointerDown = (event, node) => {
        // Allow interacting with controls inside a node
        const interactive = event.target.closest('input, textarea, select, button, [contenteditable="true"]');
        if (interactive) return;

        event.preventDefault();
        setDraggingNodeId(node.id);

        dragRef.current = {
            nodeId: node.id,
            startClientX: event.clientX,
            startClientY: event.clientY,
            startNodeX: node.x,
            startNodeY: node.y
        };

        const onPointerMove = (moveEvent) => {
            const active = dragRef.current;
            if (!active) return;

            const dx = moveEvent.clientX - active.startClientX;
            const dy = moveEvent.clientY - active.startClientY;

            moveNodeToPosition(
                active.nodeId,
                active.startNodeX + dx,
                active.startNodeY + dy
            );
        };

        const onPointerUp = () => {
            dragRef.current = null;
            setDraggingNodeId(null);
            setGraph(prev => ({
                ...prev,
                meta: { ...prev.meta, updatedAt: new Date().toISOString() }
            }));
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
    };

    const handleDragOver = event => {
        // keep HTML5 DnD for toolbox -> workbench
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = event => {
        event.preventDefault();

        let nodeType = '';
        let dragOffsetX = 0;
        let dragOffsetY = 0;

        const raw = event.dataTransfer.getData('application/x-mew-node');
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                nodeType = parsed.nodeType || '';
                dragOffsetX = Number(parsed.dragOffsetX) || 0;
                dragOffsetY = Number(parsed.dragOffsetY) || 0;
            } catch {
                // fallback below
            }
        }

        if (!nodeType) nodeType = event.dataTransfer.getData('text/plain');
        if (!nodeType) return;

        addNodeAtPosition(
            nodeType,
            event.clientX - dragOffsetX,
            event.clientY - dragOffsetY
        );
    };

    return (
        <div ref={workbenchRef} className={styles.workbench} onDragOver={handleDragOver} onDrop={handleDrop}>
            <svg
                key={layoutVersion}
                className={styles.connectionsLayer}
                width={overlaySize.width}
                height={overlaySize.height}
            >
                {edges.map(edge => {
                    const p1 = getPortCenter(edge.fromNodeId, edge.fromPortId, 'output');
                    const p2 = getPortCenter(edge.toNodeId, edge.toPortId, 'input');
                    if (!p1 || !p2) return null;
                    return <path key={edge.id} className={styles.connectionPath} d={bezierPath(p1, p2)} />;
                })}

                {connecting && (() => {
                    const from = getPortCenter(connecting.fromNodeId, connecting.fromPortId, 'output');
                    if (!from) return null;
                    return (
                        <path
                            className={styles.tempConnectionPath}
                            d={bezierPath(from, connecting.pointer)}
                        />
                    );
                })()}
            </svg>

            {graph.nodes.map(node => (
                <div
                    key={node.id}
                    onPointerDown={event => handleNodePointerDown(event, node)}
                    className={`${styles.workbenchNode} ${draggingNodeId === node.id ? styles.nodeDragging : ''}`}
                    style={{ position: 'absolute', left: node.x, top: node.y, touchAction: 'none' }}
                >
                    <Node
                        id={node.id}
                        type={node.type}
                        modules={NODE_DEFINITIONS[node.type] || []}
                        onPortPointerDown={handlePortPointerDown}
                    />
                </div>
            ))}

            {/* <button onClick={() => console.log(serializeGraph(graph))}>Export graph JSON</button>
            <div>Derived edges: {edges.length}</div> */}
        </div>
    );
};

export default WorkbenchPanel;