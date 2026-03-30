import React from 'react';
import styles from '../mew-tab.css';

const STATUS_META = {
    queued: {label: 'Queued', className: styles.statusQueued},
    running: {label: 'Running', className: styles.statusRunning},
    listening: {label: 'Listening', className: styles.statusListening},
    error: {label: 'Error', className: styles.statusError},
    complete: {label: 'Complete', className: styles.statusComplete},
    null: {label: 'Not in Cluster', className: styles.statusNull}
};

const normalizeStatus = status => {
    if (status === null || status === undefined || status === '') return 'null';
    const s = String(status).toLowerCase();
    return STATUS_META[s] ? s : 'null';
};

const renderIcon = icon => {
    if (!icon) return null;

    // Already-instantiated JSX icon
    if (React.isValidElement(icon)) return icon;

    // React component reference (e.g. BiSolidNotepad)
    if (typeof icon === 'function' || (typeof icon === 'object' && icon.$$typeof)) {
        const IconComponent = icon;
        return <IconComponent className={styles.statusNodeIconSvg} aria-hidden="true" />;
    }

    // URL string
    if (typeof icon === 'string') {
        return <img src={icon} alt="" className={styles.statusNodeIconImg} draggable={false} />;
    }

    // {src, alt}
    if (icon && typeof icon === 'object' && icon.src) {
        return <img src={icon.src} alt={icon.alt || ''} className={styles.statusNodeIconImg} draggable={false} />;
    }

    return null;
};

const getFirstOutputValue = outputsByPort => {
    if (!outputsByPort || typeof outputsByPort !== 'object') return undefined;
    if (Object.prototype.hasOwnProperty.call(outputsByPort, 'out_value')) {
        return outputsByPort.out_value;
    }

    const firstPort = Object.keys(outputsByPort)[0];
    return firstPort ? outputsByPort[firstPort] : undefined;
};

const stringifyRuntimeValue = runtimeValue => {
    if (runtimeValue === undefined || runtimeValue === null || runtimeValue === '') return 'No output available.';
    if (typeof runtimeValue === 'string') return runtimeValue;
    if (typeof runtimeValue === 'number' || typeof runtimeValue === 'boolean') return String(runtimeValue);

    try {
        return JSON.stringify(runtimeValue, null, 2);
    } catch {
        return String(runtimeValue);
    }
};

const getTooltipMessage = (statusKey, runtime = {}) => {
    if (typeof runtime?.tooltipMessage === 'string' && runtime.tooltipMessage.trim()) {
        return runtime.tooltipMessage;
    }

    if (statusKey === 'queued') return 'This node will run after its inputs are done running.';
    if (statusKey === 'running') return 'This node is currently running.';
    if (statusKey === 'listening') return 'Listening...';
    if (statusKey === 'error') return stringifyRuntimeValue(runtime.error);

    if (statusKey === 'complete') {
        const output = getFirstOutputValue(runtime.outputsByPort);
        return stringifyRuntimeValue(output);
    }

    return '';
};

const StatusRow = ({label = 'Node name', value, status, icon, centerContent, runtime}) => {
    const key = normalizeStatus(runtime?.customStatus ?? value ?? status);
    const meta = STATUS_META[key];
    const showBadge = key !== 'null';
    const tooltipMessage = getTooltipMessage(key, runtime);
    const [isAutoTooltipVisible, setIsAutoTooltipVisible] = React.useState(false);

    React.useEffect(() => {
        const forceVisible = Boolean(runtime?.tooltipForceVisible);

        if (forceVisible) {
            setIsAutoTooltipVisible(true);
            return undefined;
        }

        const autoShowUntil = Number(runtime?.tooltipAutoShowUntil || 0);
        const msRemaining = autoShowUntil - Date.now();

        if (key !== 'complete' || msRemaining <= 0) {
            setIsAutoTooltipVisible(false);
            return undefined;
        }

        setIsAutoTooltipVisible(true);
        const timer = setTimeout(() => setIsAutoTooltipVisible(false), msRemaining);
        return () => clearTimeout(timer);
    }, [key, runtime?.tooltipAutoShowUntil, runtime?.tooltipForceVisible]);

    return (
        <div className={styles.statusRow} data-row-type="status">
            <div className={styles.statusLeft}>
                {icon ? <span className={styles.statusNodeIcon}>{renderIcon(icon)}</span> : null}
                {centerContent ? (
                    <span className={styles.statusCenterContent}>{centerContent}</span>
                ) : (
                    <span className={styles.statusLabel}>{label}</span>
                )}
            </div>
            {showBadge ? (
                <div className={styles.statusBadgeWrapper}>
                    <span className={`${styles.statusBadge} ${meta.className}`}>{meta.label}</span>
                    <div
                        className={`${styles.statusBadgeTooltip} ${isAutoTooltipVisible ? styles.statusBadgeTooltipVisible : ''}`}
                    >
                        <div className={styles.statusBadgeTooltipContent}>{tooltipMessage}</div>
                    </div>
                </div>
            ) : null}
        </div>
    );
};

export default StatusRow;