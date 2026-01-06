import React from 'react';
import styles from './mew-tab.css';
const MewTabComponent = props => (
    <div className={styles.wrapper}>
        <button className={styles.button} onClick={props.onTestVm}>Test VM</button>
        <button className={styles.button} onClick={props.onLogMyVariable}>Log "my variable"</button>
        <button className={styles.button} onClick={props.onTestAzureApi}>Test Azure API</button>
    </div>
);

export default MewTabComponent;