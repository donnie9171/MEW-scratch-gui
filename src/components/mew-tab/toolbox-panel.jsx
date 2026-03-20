import React, {useState} from 'react';
import ReactDOM from 'react-dom';
import Node from './Node';
import {NODE_DEFINITIONS, getNodeDefinition} from './nodeCatalog';
import styles from './mew-tab.css';

const ToolboxPanel = () => {
    const [dragPreview, setDragPreview] = useState(null);

    const handlePointerDown = (event, nodeType) => {
        if (event.button !== 0) return;

        event.preventDefault(); // prevent text selection / native drag behavior

        const rect = event.currentTarget.getBoundingClientRect();
        const offsetX = event.clientX - rect.left;
        const offsetY = event.clientY - rect.top;

        setDragPreview({nodeType, x: event.clientX, y: event.clientY, offsetX, offsetY});

        const onMove = moveEvent => {
            moveEvent.preventDefault(); // keep selection from starting during drag
            setDragPreview(prev => (prev ? {...prev, x: moveEvent.clientX, y: moveEvent.clientY} : prev));
        };

        const onUp = upEvent => {
            window.dispatchEvent(new CustomEvent('mew-toolbox-drop', {
                detail: {
                    nodeType,
                    clientX: upEvent.clientX,
                    clientY: upEvent.clientY,
                    offsetX,
                    offsetY
                }
            }));

            setDragPreview(null);
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    };

    return (
        <div className={styles.toolbox} data-mew-toolbox-dropzone="true">
            {Object.keys(NODE_DEFINITIONS).map(nodeType => (
                <div
                    key={nodeType}
                    className={styles.toolboxItem}
                    onPointerDown={e => handlePointerDown(e, nodeType)}
                >
                    <Node type={nodeType} modules={getNodeDefinition(nodeType).rows} />
                </div>
            ))}

            {dragPreview && ReactDOM.createPortal(
                <div
                    className={styles.toolboxDragPreview}
                    style={{
                        left: dragPreview.x - dragPreview.offsetX,
                        top: dragPreview.y - dragPreview.offsetY
                    }}
                >
                    <Node
                        type={dragPreview.nodeType}
                        modules={getNodeDefinition(dragPreview.nodeType).rows}
                    />
                </div>,
                document.body
            )}
        </div>
    );
};

export default ToolboxPanel;