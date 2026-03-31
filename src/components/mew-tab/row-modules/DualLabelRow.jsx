import React, { useEffect, useState } from 'react';
import { MdOutlineSwapHoriz } from 'react-icons/md';
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
    disabled = false,
    showSwapButton = true
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

    const handleSwap = () => {
        const swapped = {
            left: draft.right,
            right: draft.left
        };
        setDraft(swapped);
        if (onChange) onChange(swapped);
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
            {showSwapButton && (
                <button
                    className={styles.swapButton}
                    onClick={handleSwap}
                    disabled={disabled}
                    type='button'
                    aria-label='Swap left and right values'
                >
                    <MdOutlineSwapHoriz />
                </button>
            )}
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