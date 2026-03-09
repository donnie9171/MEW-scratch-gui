import React, { useRef } from 'react';
import Node from './Node';
import { NODE_DEFINITIONS } from './nodeCatalog';
import styles from './mew-tab.css';

const ToolboxPanel = () => {
    const touchDataRef = useRef(null);

    const handleDragStart = (event, nodeType) => {
        event.dataTransfer.setData('text/plain', nodeType);
    };

    const handleTouchStart = (event, nodeType) => {
        touchDataRef.current = nodeType;
        event.target.style.opacity = '0.7';
    };

    const handleTouchEnd = (event) => {
        event.target.style.opacity = '1';
        touchDataRef.current = null;
    };

    return (
        <div className={styles.toolbox}>
            {Object.keys(NODE_DEFINITIONS).map((nodeType) => (
                <div
                    key={nodeType}
                    draggable
                    onDragStart={(event) => handleDragStart(event, nodeType)}
                    onTouchStart={(event) => handleTouchStart(event, nodeType)}
                    onTouchEnd={handleTouchEnd}
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