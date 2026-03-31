import React, { useEffect, useState } from 'react';
import styles from '../mew-tab.css';

const DualLabelRow = ({
    leftLabel = '',
    rightLabel = '',
    editable = false,
    leftPlaceholder = '',
    rightPlaceholder = '',
    value,
    onChange,
    id,
    disabled = false
}) => {
    const getLeft = (v) =>
        v && typeof v === 'object' && typeof v.left === 'string' ? v.left : leftLabel;
    const getRight = (v) =>
        v && typeof v === 'object' && typeof v.right === 'string' ? v.right : rightLabel;

    const [draft, setDraft] = useState({
        left: getLeft(value),
        right: getRight(value)
    });

    useEffect(() => {
        setDraft({
            left: getLeft(value),
            right: getRight(value)
        });
    }, [value, leftLabel, rightLabel]);

    const update = (nextPart) => {
        const next = { ...draft, ...nextPart };
        setDraft(next);
        if (onChange) onChange(next);
    };

    if (!editable) {
        return (
            <div className={styles.dualLabelRow} data-id={id}>
                <span className={styles.dualLabelLeft}>{draft.left}</span>
                <span className={styles.dualLabelRight}>{draft.right}</span>
            </div>
        );
    }

    return (
        <div className={styles.dualLabelRow} data-id={id}>
            <input
                type='text'
                className={`${styles.dualLabelInput} ${styles.dualLabelInputLeft}`}
                value={draft.left}
                placeholder={leftPlaceholder}
                onChange={e => update({ left: e.target.value })}
                disabled={disabled}
            />
            <input
                type='text'
                className={`${styles.dualLabelInput} ${styles.dualLabelInputRight}`}
                value={draft.right}
                placeholder={rightPlaceholder}
                onChange={e => update({ right: e.target.value })}
                disabled={disabled}
            />
        </div>
    );
};

export default DualLabelRow;