import React from 'react';
import styles from '../mew-tab.css';

const RowIO = ({ nodeId, rowId, io = {}, onPortPointerDown }) => {
    const emitDown = (event, direction, portId) => {
        event.stopPropagation();
        event.preventDefault();
        if (onPortPointerDown) {
            onPortPointerDown(event, { nodeId, rowId, direction, portId });
        }
    };

    return (
        <div className={styles.rowIo}>
            {io?.input ? (
                <button
                    type="button"
                    className={`${styles.portDot} ${styles.inputPort} ${styles.nodePoint}`}
                    data-node-id={nodeId}
                    data-row-id={rowId}
                    data-port-id={io.input.portId}
                    data-port-direction="input"
                    onPointerDown={(e) => emitDown(e, 'input', io.input.portId)}
                    aria-label={`Input ${io.input.portId}`}
                />
            ) : <span className={styles.portSpacer} />}

            {io?.output ? (
                <button
                    type="button"
                    className={`${styles.portDot} ${styles.outputPort} ${styles.nodePoint}`}
                    data-node-id={nodeId}
                    data-row-id={rowId}
                    data-port-id={io.output.portId}
                    data-port-direction="output"
                    onPointerDown={(e) => emitDown(e, 'output', io.output.portId)}
                    aria-label={`Output ${io.output.portId}`}
                />
            ) : <span className={styles.portSpacer} />}
        </div>
    );
};

export default RowIO;