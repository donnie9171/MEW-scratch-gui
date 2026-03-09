/**
 * Central registry for all row module components.
 * Maps type strings to React components.
 */

// Import row modules as we create them
import TitleRow from './TitleRow';
import TextInputRow from './TextInputRow';
import DropdownRow from './DropdownRow';

const rowModuleRegistry = {
    title: TitleRow,
    textInput: TextInputRow,
    dropdown: DropdownRow,
};

/**
 * Get a row module component by type.
 * @param {string} type - The row module type
 * @returns {React.FC} The row module component
 * @throws {Error} If the type is not found in the registry
 */
export const getRowModule = (type) => {
    if (!rowModuleRegistry[type]) {
        throw new Error(`Row module type "${type}" not found in registry. Available types: ${Object.keys(rowModuleRegistry).join(', ')}`);
    }
    return rowModuleRegistry[type];
};

/**
 * Register a new row module type.
 * @param {string} type - The row module type
 * @param {React.FC} component - The row module component
 */
export const registerRowModule = (type, component) => {
    rowModuleRegistry[type] = component;
};

export default rowModuleRegistry;