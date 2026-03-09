import React from 'react';
import styles from './mew-tab.css';
import ToolboxPanel from './toolbox-panel.jsx';
import WorkbenchPanel from './workbench-panel.jsx';

const MewTabComponent = props => (
    <div className={styles.wrapper}>
        <div className={styles.layout}>
            <ToolboxPanel />
            <WorkbenchPanel />
        </div>
        {/* <div className={styles.buttonBar}>
            <button className={styles.button} onClick={props.onTestVm}>Test VM</button>
            <button className={styles.button} onClick={props.onLogMyVariable}>Log "my variable"</button>
            <button className={styles.button} onClick={props.onTestAzureApi}>Test Azure API</button>
        </div> */}
    </div>
);

export default MewTabComponent;