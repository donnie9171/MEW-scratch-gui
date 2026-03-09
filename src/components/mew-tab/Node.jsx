import React from 'react';
import { getRowModule } from './row-modules/rowModuleRegistry';
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
const Node = ({ id, type, modules = [], data = {}, onModuleChange }) => {
    const handleModuleChange = (moduleId, newValue) => {
        if (onModuleChange) {
            onModuleChange({ nodeId: id, moduleId, newValue });
        }
    };

    return (
        <div className={styles.node} data-node-id={id} data-node-type={type}>
            {modules.map((module, index) => {
                const RowComponent = getRowModule(module.type);
                return (
                    <RowComponent
                        key={module.id || index}
                        id={module.id}
                        {...module.props}
                        onChange={(newValue) => handleModuleChange(module.id, newValue)}
                    />
                );
            })}
        </div>
    );
};

export default Node;