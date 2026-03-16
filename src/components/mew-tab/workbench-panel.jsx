import React, { useMemo, useRef, useState } from 'react';
import Node from './Node';
import { NODE_DEFINITIONS } from './nodeCatalog';
import styles from './mew-tab.css';
import {
    createEmptyGraph,
    deriveEdges,
    serializeGraph
} from './workbench/graphState';

const WorkbenchPanel = () => {
    const [graph, setGraph] = useState(createEmptyGraph);
    const [draggingNodeId, setDraggingNodeId] = useState(null);
    const workbenchRef = useRef(null);

    // Active in-workbench drag session (pointer-based)
    const dragRef = useRef(null);

    const edges = useMemo(() => deriveEdges(graph.nodes), [graph.nodes]);

    const toLocalCoords = (clientX, clientY) => {
        const rect = workbenchRef.current?.getBoundingClientRect();
        const scrollLeft = workbenchRef.current?.scrollLeft || 0;
        const scrollTop = workbenchRef.current?.scrollTop || 0;

        return {
            x: rect ? clientX - rect.left + scrollLeft : clientX,
            y: rect ? clientY - rect.top + scrollTop : clientY
        };
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
        <div
            ref={workbenchRef}
            className={styles.workbench}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {graph.nodes.map(node => (
                <div
                    key={node.id}
                    onPointerDown={event => handleNodePointerDown(event, node)}
                    className={`${styles.workbenchNode} ${draggingNodeId === node.id ? styles.nodeDragging : ''}`}
                    style={{
                        position: 'absolute',
                        left: node.x,
                        top: node.y,
                        touchAction: 'none'
                    }}
                >
                    <Node type={node.type} modules={NODE_DEFINITIONS[node.type] || []} />
                </div>
            ))}

            <button onClick={() => console.log(serializeGraph(graph))}>
                Export graph JSON
            </button>
            <div>Derived edges: {edges.length}</div>
        </div>
    );
};

export default WorkbenchPanel;