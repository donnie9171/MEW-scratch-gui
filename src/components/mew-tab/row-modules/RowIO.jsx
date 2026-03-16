import React from 'react';
import styles from '../mew-tab.css';

const RowIO = ({ nodeId, rowId, io = {}, onPortPointerDown }) => {
    const handleDown = (event, direction, portId) => {
        if (!onPortPointerDown || !portId) return;
        onPortPointerDown(event, { nodeId, rowId, direction, portId });
    };

    return (
        <div className={styles.rowIo}>
            {io?.input ? (
                <button
                    type="button"
                    className={`${styles.portDot} ${styles.inputPort}`}
                    onPointerDown={(e) => handleDown(e, 'input', io.input.portId)}
                    aria-label={`Input ${io.input.portId}`}
                />
            ) : <span className={styles.portSpacer} />}
            {io?.output ? (
                <button
                    type="button"
                    className={`${styles.portDot} ${styles.outputPort}`}
                    onPointerDown={(e) => handleDown(e, 'output', io.output.portId)}
                    aria-label={`Output ${io.output.portId}`}
                />
            ) : <span className={styles.portSpacer} />}
        </div>
    );
};

export default RowIO;