import RunNode from '../runNode';
import {userId} from '../../../helper/userId';
import {AZURE_SOURCE} from '../../../helper/azureConfig';

const toStringInput = value => {
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);

    // Multi-input map from RunNode.getInput(portId): { sourceName: value }
    if (typeof value === 'object') {
        return Object.values(value)
            .map(v => (v === undefined || v === null ? '' : (typeof v === 'string' ? v : JSON.stringify(v))))
            .join('');
    }

    return String(value);
};

const normalizeModel = raw => {
    const v = String(raw || '').trim().toLowerCase();
    if (!v) return 'gpt-3.5-turbo';
    if (v === 'gpt3.5 turbo' || v === 'gpt-3.5 turbo') return 'gpt-3.5-turbo';
    if (v === 'llama3.2' || v === 'llama-3.2') return 'llama-3.2';
    return v;
};

const getAzureSource = context => {
    // Allow optional override via injected services, default to legacy constant
    return context?.services?.azureSource || AZURE_SOURCE;
};

const getApiKey = context => {
    // Allow optional override via injected services, default to legacy userId
    return context?.services?.apiKey || userId;
};

class RunAgentNode extends RunNode {
    patchRuntime (patch) {
        // If runManager passes patchRuntime, use it so UI can sync.
        if (typeof this.context?.patchRuntime === 'function') {
            this.context.patchRuntime(this.node.id, patch);
            return;
        }

        // Fallback: runtime store only.
        this.context.runtimeStore.setNodeState(this.node.id, patch);
    }

    async run (triggerContext = {}) {
        const inputValue = this.getInput('in_value');
        const question = toStringInput(inputValue) || 'Hello world!';
        const model = normalizeModel(this.node?.data?.model?.value || this.node?.data?.model);

        this.patchRuntime({
            prompt: question,
            inference: '',
            model,
            error: undefined
        });

        if (model === 'llama-3.2') {
            await this.runLlama(question, triggerContext);
            return;
        }

        if (model === 'gpt-3.5-turbo') {
            await this.runAzureGpt(question, triggerContext);
            return;
        }

        throw new Error(`Unknown model: ${model}`);
    }

    async runLlama (question) {
        const url = 'http://localhost:11434/api/chat';
        const payload = {
            model: 'llama3.2',
            messages: [{role: 'user', content: question}]
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Llama API error ${response.status}: ${errorText}`);
        }

        if (!response.body) {
            throw new Error('Llama response body is empty');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');

        let done = false;
        let inference = '';
        while (!done) {
            const {value, done: readerDone} = await reader.read();
            done = readerDone;

            if (!value) continue;

            const chunk = decoder.decode(value, {stream: true});
            const lines = chunk.split('\n').filter(line => line.trim() !== '');

            for (const line of lines) {
                try {
                    const jsonData = JSON.parse(line);
                    const piece = jsonData?.message?.content || '';
                    if (!piece) continue;

                    inference += piece;
                    this.patchRuntime({inference});
                } catch (error) {
                    // Keep streaming on malformed chunks.
                    // eslint-disable-next-line no-console
                    console.warn('[MEW RUN DEBUG] llama chunk parse failed', {line, error: String(error)});
                }
            }
        }

        this.setOutput('out_value', inference);
        this.patchRuntime({inference, error: undefined});
    }

    async runAzureGpt (question) {
        const azureSource = getAzureSource(this.context);
        const apiKey = getApiKey(this.context);

        if (!azureSource) {
            throw new Error('Agent runner missing Azure source. Set services.azureSource or window.__MEW_AZURE_SOURCE__');
        }
        if (!apiKey) {
            throw new Error('Agent runner missing API key. Set services.apiKey or window.__MEW_API_KEY__');
        }

        const url = `${azureSource}/api/oai1`;
        const messages = [{role: 'user', content: question}];

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey
            },
            body: JSON.stringify({messages})
        });

        if (!response.ok) {
            if (response.status === 429) {
                throw new Error('Tokens exhausted. Please wait for recharge.');
            }
            const errorText = await response.text();
            throw new Error(`Azure API error ${response.status}: ${errorText}`);
        }

        const result = await response.json();
        const choices = result?.choices;
        let inference = '';

        if (Array.isArray(choices) && choices.length > 0) {
            inference = choices[0]?.message?.content || '';
        } else if (result?.body?.error) {
            inference = `Error: ${result.body.error.message || JSON.stringify(result.body.error)}`;
        } else {
            inference = JSON.stringify(result, null, 2);
        }

        // eslint-disable-next-line no-console
        console.log('[MEW RUN DEBUG] Azure return', {
            nodeId: this.node.id,
            model: 'gpt-3.5-turbo',
            prompt: question,
            inference,
            rawResult: result
        });

        this.setOutput('out_value', inference);
        this.patchRuntime({
            inference,
            tokenBucket: result?.tokenBucket,
            error: undefined
        });
    }
}

export default RunAgentNode;