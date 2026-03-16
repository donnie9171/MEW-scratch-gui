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
    const workbenchRef = useRef(null);

    const [draggingNodeId, setDraggingNodeId] = useState(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [dragPreviewPos, setDragPreviewPos] = useState(null);

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

    const moveNodeToPosition = (nodeId, clientX, clientY) => {
        const { x: localX, y: localY } = toLocalCoords(clientX, clientY);

        setGraph(prev => ({
            ...prev,
            nodes: prev.nodes.map(n => (n.id === nodeId ? { ...n, x: localX, y: localY } : n)),
            meta: { ...prev.meta, updatedAt: new Date().toISOString() }
        }));
    };

    const clearDragPreview = () => {
        setDraggingNodeId(null);
        setDragOffset({ x: 0, y: 0 });
        setDragPreviewPos(null);
    };

    const handleNodeDragStart = (event, node) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const dragOffsetX = event.clientX - rect.left;
        const dragOffsetY = event.clientY - rect.top;

        setDraggingNodeId(node.id);
        setDragOffset({ x: dragOffsetX, y: dragOffsetY });
        setDragPreviewPos({ x: node.x, y: node.y });

        event.dataTransfer.setData(
            'application/x-mew-existing-node',
            JSON.stringify({ nodeId: node.id, dragOffsetX, dragOffsetY })
        );
        event.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = event => {
        event.preventDefault();
        const types = Array.from(event.dataTransfer.types || []);
        const isExisting = types.includes('application/x-mew-existing-node');

        event.dataTransfer.dropEffect = isExisting ? 'move' : 'copy';

        // live-follow preview for existing node drags
        if (isExisting && draggingNodeId) {
            const { x, y } = toLocalCoords(
                event.clientX - dragOffset.x,
                event.clientY - dragOffset.y
            );
            setDragPreviewPos({ x, y });
        }
    };

    const handleDrop = event => {
        event.preventDefault();

        // 1) Move existing workbench node
        const existingRaw = event.dataTransfer.getData('application/x-mew-existing-node');
        if (existingRaw) {
            try {
                const parsed = JSON.parse(existingRaw);
                const nodeId = parsed.nodeId;
                const dragOffsetX = Number(parsed.dragOffsetX) || 0;
                const dragOffsetY = Number(parsed.dragOffsetY) || 0;

                if (nodeId) {
                    moveNodeToPosition(
                        nodeId,
                        event.clientX - dragOffsetX,
                        event.clientY - dragOffsetY
                    );
                    clearDragPreview();
                    return;
                }
            } catch {
                // continue to new-node flow
            }
        }

        // 2) Create new node from toolbox
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

        if (!nodeType) {
            nodeType = event.dataTransfer.getData('text/plain');
        }

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
                    draggable
                    onDragStart={event => handleNodeDragStart(event, node)}
                    style={{ position: 'absolute', left: node.x, top: node.y }}
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