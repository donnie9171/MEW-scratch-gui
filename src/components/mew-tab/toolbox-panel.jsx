import React, { useRef } from 'react';
import Node from './Node';
import { NODE_DEFINITIONS } from './nodeCatalog';
import styles from './mew-tab.css';

const ToolboxPanel = () => {

    const handleDragStart = (event, nodeType) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const dragOffsetX = event.clientX - rect.left;
        const dragOffsetY = event.clientY - rect.top;

        const payload = JSON.stringify({
            nodeType,
            dragOffsetX,
            dragOffsetY
        });

        event.dataTransfer.setData('application/x-mew-node', payload);
        event.dataTransfer.setData('text/plain', nodeType); // fallback
        event.dataTransfer.effectAllowed = 'copy';
    };

    return (
        <div className={styles.toolbox}>
            {Object.keys(NODE_DEFINITIONS).map((nodeType) => (
                <div
                    key={nodeType}
                    draggable
                    onDragStart={(event) => handleDragStart(event, nodeType)}
                    className={styles.toolboxItem}
                >
                    <Node
                        type={nodeType}
                        modules={NODE_DEFINITIONS[nodeType]}
                    />
                </div>
            ))}
        </div>
    );
};

export default ToolboxPanel;