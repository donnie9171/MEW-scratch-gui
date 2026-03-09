import React, { useState } from 'react';
import styles from '../mew-tab.css';

/**
 * TextInputRow - an editable text input row module.
 * 
 * @component
 * @param {Object} props
 * @param {string} [props.label] - Optional label for the input
 * @param {string} [props.placeholder] - Placeholder text
 * @param {string} [props.value] - Initial value
 * @param {Function} [props.onChange] - Callback when value changes
 * @param {string} [props.id] - Optional unique identifier
 */
const TextInputRow = ({ label, placeholder = '', value = '', onChange, id }) => {
    const [inputValue, setInputValue] = useState(value);

    const handleChange = (event) => {
        const newValue = event.target.value;
        setInputValue(newValue);
        if (onChange) {
            onChange(newValue);
        }
    };

    return (
        <div className={styles.textInputRow} data-id={id}>
            {/* {label && <label className={styles.inputLabel}>{label}:</label>} */}
            <input
                type="text"
                className={styles.inputField}
                placeholder={placeholder}
                value={inputValue}
                onChange={handleChange}
            />
        </div>
    );
};

export default TextInputRow;