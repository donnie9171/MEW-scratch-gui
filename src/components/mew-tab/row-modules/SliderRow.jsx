import React, { useEffect, useRef, useState } from 'react';
import styles from '../mew-tab.css';

const toFiniteNumber = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const clamp01 = value => Math.max(0, Math.min(1, value));
const percentFromNormalized = normalized => `${clamp01(normalized) * 100}%`;

const formatNumber = value => {
    if (!Number.isFinite(value)) return '-';
    return value.toFixed(3).replace(/\.?0+$/, '');
};

const SliderRow = ({
    min = 0,
    max = 1,
    step = 0.01,
    value,
    defaultValue,
    onChange,
    id,
    disabled = false,

    // Row-context driven behavior for Servo
    controlledValue,
    inputRangeMin = 0,
    inputRangeMax = 1,
    rangeMin = 0,
    rangeMax = 180,
    showTooltips = true
}) => {
    const initial =
        typeof value === 'number'
            ? clamp01(value)
            : typeof value === 'string' && value !== ''
                ? clamp01(toFiniteNumber(value, toFiniteNumber(defaultValue, min)))
                : clamp01(toFiniteNumber(defaultValue, min));

    const [sliderValue, setSliderValue] = useState(initial);
    const [tooltipsVisible, setTooltipsVisible] = useState(false);
    const [isHovering, setIsHovering] = useState(false);
    const shouldShowTooltips = showTooltips && (tooltipsVisible || isHovering);
    const hideTimerRef = useRef(null);
    const mountedRef = useRef(false);

    const hasControlledValue = Number.isFinite(Number(controlledValue));
    const controlledNormalized = hasControlledValue
        ? clamp01(Number(controlledValue))
        : undefined;

    const revealTooltips = () => {
        if (!showTooltips) return;
        setTooltipsVisible(true);
        if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
        hideTimerRef.current = window.setTimeout(() => {
            setTooltipsVisible(false);
        }, 1400);
    };

    useEffect(() => {
        return () => {
            if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
        };
    }, []);

    useEffect(() => {
        if (hasControlledValue) return;
        if (typeof value === 'number') {
            setSliderValue(clamp01(value));
            return;
        }
        if (typeof value === 'string' && value !== '') {
            const parsed = Number(value);
            if (Number.isFinite(parsed)) setSliderValue(clamp01(parsed));
        }
    }, [value, hasControlledValue]);

    useEffect(() => {
        if (!hasControlledValue) return;
        setSliderValue(controlledNormalized);

        if (!mountedRef.current) {
            mountedRef.current = true;
            return;
        }
        revealTooltips();
    }, [hasControlledValue, controlledNormalized]);

    const effectiveNormalized = hasControlledValue ? controlledNormalized : sliderValue;
    const inputValue =
        toFiniteNumber(inputRangeMin, 0) +
        effectiveNormalized * (toFiniteNumber(inputRangeMax, 1) - toFiniteNumber(inputRangeMin, 0));
    const convertedValue =
        toFiniteNumber(rangeMin, 0) +
        effectiveNormalized * (toFiniteNumber(rangeMax, 180) - toFiniteNumber(rangeMin, 0));

    const handleChange = e => {
        const next = clamp01(toFiniteNumber(e.target.value, 0));
        setSliderValue(next);
        if (onChange) onChange(next);
        revealTooltips();
    };

    return (
        <div
            className={styles.sliderRow}
            data-id={id}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
        >
            {shouldShowTooltips && (
                <div
                    className={`${styles.sliderTooltip} ${styles.sliderTooltipTop}`}
                    style={{ left: percentFromNormalized(effectiveNormalized) }}
                >
                    {formatNumber(inputValue)}
                </div>
            )}

            <input
                type='range'
                className={styles.sliderInput}
                min={min}
                max={max}
                step={step}
                value={effectiveNormalized}
                onChange={handleChange}
                disabled={disabled || hasControlledValue}
            />

            {shouldShowTooltips && (
                <div
                    className={`${styles.sliderTooltip} ${styles.sliderTooltipBottom}`}
                    style={{ left: percentFromNormalized(effectiveNormalized) }}
                >
                    {formatNumber(convertedValue)}
                </div>
            )}
        </div>
    );
};

export default SliderRow;