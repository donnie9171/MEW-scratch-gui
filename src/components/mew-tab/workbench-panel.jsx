import React, { useRef, useState } from 'react';
import styles from './mew-tab.css';

const WorkbenchPanel = () => {
    const [placedNodes, setPlacedNodes] = useState([]);
    const touchDataRef = useRef(null);

    const handleDragOver = (event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = (event) => {
        event.preventDefault();
        const nodeType = event.dataTransfer.getData('text/plain');
        if (nodeType) {
            addNodeAtPosition(nodeType, event.clientX, event.clientY);
        }
    };

    const handleTouchMove = (event) => {
        event.preventDefault();
    };

    const handleTouchEnd = (event) => {
        if (touchDataRef.current) {
            const touch = event.changedTouches[0];
            addNodeAtPosition(touchDataRef.current, touch.clientX, touch.clientY);
            touchDataRef.current = null;
        }
    };

    const addNodeAtPosition = (nodeType, x, y) => {
        const newNode = {
            id: `${nodeType}-${Date.now()}`,
            type: nodeType,
            x,
            y,
        };
        setPlacedNodes([...placedNodes, newNode]);
    };

    return (
        <div
            className={styles.workbench}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            <div>Workbench Area</div>
            {placedNodes.length > 0 && (
                <div>Placed {placedNodes.length} node(s)</div>
            )}
        </div>
    );
};

export default WorkbenchPanel;