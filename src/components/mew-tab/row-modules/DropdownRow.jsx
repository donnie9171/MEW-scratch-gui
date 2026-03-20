import React, { useEffect, useState } from 'react';
import styles from '../mew-tab.css';

/**
 * DropdownRow – select-box row module.
 *
 * Props
 *  - label?         : optional text label
 *  - options        : array of { value, label }
 *  - value?         : controlled value (optional)
 *  - defaultValue?  : initial/default selected value
 *  - onChange?      : fn(newValue)
 *  - id?            : optional identifier
 */
const DropdownRow = ({
    label,
    options = [],
    value,
    defaultValue = '',
    onChange,
    id,
}) => {
    const computedDefault = defaultValue || (options[0]?.value ?? '');
    const [selected, setSelected] = useState(
        typeof value === 'string' ? value : computedDefault
    );

    useEffect(() => {
        if (typeof value === 'string') setSelected(value);
    }, [value]);

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