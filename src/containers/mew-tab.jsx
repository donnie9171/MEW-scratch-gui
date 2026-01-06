import PropTypes from 'prop-types';
import React from 'react';
import {connect} from 'react-redux';
import VM from 'scratch-vm';
import MewTabComponent from '../components/mew-tab/mew-tab.jsx';

class MewTab extends React.Component {
    handleTestVm = () => {
        console.log('Test VM button clicked');
        console.log('VM:', this.props.vm);
    };

    handleLogMyVariable = () => {
        const {vm} = this.props;
        // Find the value of the variable called "my variable"
        const target = vm.runtime.getTargetForStage();
        if (target && target.variables) {
            const variableEntry = Object.values(target.variables)
                .find(v => v.name === 'my variable');
            if (variableEntry) {
                console.log('Value of "my variable":', variableEntry.value);
            } else {
                console.log('"my variable" not found');
            }
        } else {
            console.log('No stage target or variables found');
        }
    };

    handleTestAzureApi = async () => {
        const AZURE_SOURCE = "https://multiagent-exploration-workbench-c8htdxerg6d9faa0.uksouth-01.azurewebsites.net";
        const url = AZURE_SOURCE + "/api/oai1";
        const userId = "YOUR_API_KEY"; // Replace with your actual API key or user ID
        const question = "Hello, Azure!"; // Replace or make dynamic as needed
        const messages = [{ role: "user", content: question }];

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-api-key": userId,
                },
                body: JSON.stringify({ messages }),
            });

            let inference = "";

            if (response.ok) {
                const result = await response.json();
                console.log("OpenAI response:", JSON.stringify(result.body, null, 2));
                let choices = result.choices;
                if (choices && choices.length > 0) {
                    inference = choices[0].message?.content || "";
                    console.log("Inference:", inference);
                }
            } else {
                console.error("API call failed:", response.status, response.statusText);
            }
        } catch (err) {
            console.error("API call error:", err);
        }
    };

    render() {
        const {vm} = this.props;
        return (
            <MewTabComponent
                onTestVm={this.handleTestVm}
                onLogMyVariable={this.handleLogMyVariable}
                onTestAzureApi={this.handleTestAzureApi}
                vm={vm}
            />
        );
    }
}

MewTab.propTypes = {
    vm: PropTypes.instanceOf(VM)
};

const mapStateToProps = state => ({
    vm: state.scratchGui.vm
});

export default connect(
    mapStateToProps
)(MewTab);