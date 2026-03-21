import React from 'react';
import styles from '../mew-tab.css';

const STATUS_META = {
    queued: {label: 'Queued', className: styles.statusQueued},
    running: {label: 'Running', className: styles.statusRunning},
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

const StatusRow = ({label = 'Node name', value, status, icon}) => {
    const key = normalizeStatus(value ?? status);
    const meta = STATUS_META[key];
    const showBadge = key !== 'null';

    return (
        <div className={styles.statusRow} data-row-type="status">
            <div className={styles.statusLeft}>
                {icon ? <span className={styles.statusNodeIcon}>{renderIcon(icon)}</span> : null}
                <span className={styles.statusLabel}>{label}</span>
            </div>
            {showBadge ? <span className={`${styles.statusBadge} ${meta.className}`}>{meta.label}</span> : null}
        </div>
    );
};

export default StatusRow;