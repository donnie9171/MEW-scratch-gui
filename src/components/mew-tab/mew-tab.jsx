import React from 'react';
const MewTabComponent = props => (
    <div>
        <button onClick={props.onTestVm}>Test VM</button>
        <button onClick={props.onLogMyVariable}>Log "my variable"</button>
        <button onClick={props.onTestAzureApi}>Test Azure API</button>
    </div>
);

export default MewTabComponent;