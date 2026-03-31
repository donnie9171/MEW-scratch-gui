import React, { useEffect, useState } from 'react';
import styles from '../mew-tab.css';

const SliderRow = ({
    min = 0,
    max = 1,
    step = 0.01,
    value,
    defaultValue,
    onChange,
    id,
    disabled = false
}) => {
    const initial =
        typeof value === 'number'
            ? value
            : typeof value === 'string' && value !== ''
                ? Number(value)
                : (defaultValue ?? min);

    const [sliderValue, setSliderValue] = useState(initial);

    useEffect(() => {
        if (typeof value === 'number') {
            setSliderValue(value);
            return;
        }
        if (typeof value === 'string' && value !== '' && !Number.isNaN(Number(value))) {
            setSliderValue(Number(value));
        }
    }, [value]);

    const handleChange = e => {
        const next = Number(e.target.value);
        setSliderValue(next);
        if (onChange) onChange(next);
    };

    return (
        <div className={styles.sliderRow} data-id={id}>
            <input
                type='range'
                className={styles.sliderInput}
                min={min}
                max={max}
                step={step}
                value={sliderValue}
                onChange={handleChange}
                disabled={disabled}
            />
        </div>
    );
};

export default SliderRow;