import React, { useState } from 'react';
import styles from '../mew-tab.css';

/**
 * DropdownRow – simple select‑box row module.
 *
 * Props
 *  - label?         : optional text label shown before the control
 *  - options        : array of { value, label } items
 *  - value?         : current value
 *  - placeholder?   : shown when no value selected
 *  - onChange?      : fn(newValue) called when selection changes
 *  - id?            : optional identifier for the row
 */
const DropdownRow = ({
    label,
    options = [],
    value = '',
    placeholder = 'Select…',
    onChange,
    id,
}) => {
    const [selected, setSelected] = useState(value);

    const handleChange = (e) => {
        const v = e.target.value;
        setSelected(v);
        if (onChange) onChange(v);
    };

    return (
        <div className={styles.dropdownRow} data-id={id}>
            {/* {label && <label className={styles.inputLabel}>{label}:</label>} */}
            <select
                className={styles.selectField}
                value={selected}
                onChange={handleChange}
            >
                <option value="" disabled>
                    {placeholder}
                </option>
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </div>
    );
};

export default DropdownRow;