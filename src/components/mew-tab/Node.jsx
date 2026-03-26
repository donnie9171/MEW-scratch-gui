import React from 'react';
import { getRowModule } from './row-modules/rowModuleRegistry';
import RowIO from './row-modules/RowIO';
import styles from './mew-tab.css';

/**
 * Node - a container component that renders a list of row modules.
 * Each node is composed of one or more row modules stacked vertically.
 * 
 * @component
 * @param {Object} props
 * @param {string} [props.id] - Unique identifier for this node instance
 * @param {string} [props.type] - Node type (e.g. 'MathAdd', 'Log')
 * @param {Array<Object>} props.modules - Array of row module definitions
 *   Each definition should have:
 *   - type: string (e.g. 'title', 'textInput')
 *   - props: Object (props to pass to the row module component)
 * @param {Object} [props.data] - Optional node-level data that can be passed to modules
 * @param {Function} [props.onModuleChange] - Optional callback when a module's data changes
 */

const toNodeTypeClass = type => {
    const safe = String(type || 'unknown')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return `mew-node-type-${safe || 'unknown'}`;
};

const Node = ({ id, type, modules = [], data = {}, onModuleChange, onPortPointerDown, rowContextById = {} }) => {
    const handleModuleChange = (moduleId, newValue) => {
        if (onModuleChange) onModuleChange({nodeId: id, moduleId, newValue});
    };

    const moduleList = Array.isArray(modules) ? modules : (modules?.rows || []);
    const nodeTypeClass = toNodeTypeClass(type);

    return (
        <div
            className={`${styles.node} ${nodeTypeClass}`}
            data-node-type={type}
        >
            {moduleList.map((module, index) => {
                const RowComponent = getRowModule(module.type);
                if (!RowComponent) return null;

                const rowData = data[module.id] || {};
                const rowContext = rowContextById[module.id] || {};
                const moduleProps = {...(module.props || {})};

                if (module.type === 'status' && moduleProps.centerModule) {
                    const centerDefinition = moduleProps.centerModule;
                    const centerType = centerDefinition?.type;

                    if (centerType) {
                        const CenterRowComponent = getRowModule(centerType);
                        const centerRowId = centerDefinition?.rowId || module.id;
                        const centerRowData = data[centerRowId] || {};
                        const centerProps = centerDefinition?.props || {};

                        moduleProps.centerContent = (
                            <CenterRowComponent
                                id={centerRowId}
                                {...centerProps}
                                value={centerRowData.value}
                                onChange={(newValue) => handleModuleChange(centerRowId, newValue)}
                                embedded
                                compact
                            />
                        );
                    }
                }

                return (
                    <div key={module.id || index} className={styles.rowModule}>
                        <RowIO
                            nodeId={id}
                            rowId={module.id}
                            io={module.io}
                            onPortPointerDown={onPortPointerDown}
                        />
                        <RowComponent
                            id={module.id}
                            {...moduleProps}
                            {...rowContext}
                            value={rowData.value}
                            onChange={(newValue) => handleModuleChange(module.id, newValue)}
                        />
                    </div>
                );
            })}
        </div>
    );
};

export default Node;