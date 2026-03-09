import React from 'react';
import styles from '../mew-tab.css';

/**
 * TitleRow - displays a title/header for a node.
 * This is a read-only row module.
 * 
 * @component
 * @param {Object} props
 * @param {string} props.text - The title text to display
 * @param {string} [props.id] - Optional unique identifier for this row
 */
const TitleRow = ({ text, id }) => (
    <div className={styles.titleRow} data-id={id}>
        <h3 className={styles.titleText}>{text}</h3>
    </div>
);

export default TitleRow;