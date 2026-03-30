import RunNode from '../runNode';

const getSpeechRecognitionCtor = () => {
    if (typeof window === 'undefined') return null;
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

class RunMicrophoneNode extends RunNode {
    patchRuntime (patch) {
        if (typeof this.context?.patchRuntime === 'function') {
            this.context.patchRuntime(this.node.id, patch);
            return;
        }
        this.context.runtimeStore.setNodeState(this.node.id, patch);
    }

    recognizeOnce ({language}) {
        return new Promise((resolve, reject) => {
            const SpeechRecognitionCtor = getSpeechRecognitionCtor();
            if (!SpeechRecognitionCtor) {
                reject(new Error('Web Speech API is not supported in this browser.'));
                return;
            }

            const recognition = new SpeechRecognitionCtor();
            recognition.lang = String(language || 'en');
            recognition.continuous = false;
            recognition.interimResults = true;
            recognition.maxAlternatives = 1;

            let finalTranscript = '';
            let latestLive = '';
            let isAudioActive = false;
            let settled = false;

            const finishResolve = transcript => {
                if (settled) return;
                settled = true;
                resolve(transcript);
            };

            const finishReject = error => {
                if (settled) return;
                settled = true;
                reject(error);
            };

            recognition.onaudiostart = () => {
                isAudioActive = true;
                this.patchRuntime({
                    customStatus: 'listening',
                    tooltipForceVisible: true,
                    tooltipMessage: 'Listening...'
                });
            };

            recognition.onaudioend = () => {
                isAudioActive = false;
                this.patchRuntime({
                    customStatus: undefined,
                    tooltipForceVisible: false
                });
            };

            recognition.onresult = event => {
                let interim = '';
                for (let i = event.resultIndex; i < event.results.length; i += 1) {
                    const result = event.results[i];
                    const text = result?.[0]?.transcript || '';
                    if (result?.isFinal) finalTranscript += text;
                    else interim += text;
                }

                latestLive = `${finalTranscript}${interim}`.trim();

                // Only show live-listening UI when mic audio capture is truly active.
                if (isAudioActive) {
                    this.patchRuntime({
                        customStatus: 'listening',
                        tooltipForceVisible: true,
                        tooltipMessage: latestLive || 'Listening...'
                    });
                }
            };

            recognition.onerror = event => {
                this.patchRuntime({
                    customStatus: undefined,
                    tooltipForceVisible: false
                });
                finishReject(new Error(`Microphone transcription failed: ${event?.error || 'unknown error'}`));
            };

            recognition.onend = () => {
                const transcript = (finalTranscript || latestLive || '').trim();
                this.patchRuntime({
                    customStatus: undefined,
                    tooltipForceVisible: false
                });
                finishResolve(transcript);
            };

            // Do not set "listening" before recognition is actually capturing audio.
            try {
                recognition.start();
            } catch (error) {
                finishReject(error);
            }
        });
    }

    async run () {
        const language = this.node?.data?.language?.value || 'en';

        const transcript = await this.recognizeOnce({language});

        this.setOutput('transcript', transcript);
        this.setOutput('out_value', transcript);

        this.patchRuntime({
            customStatus: undefined,
            tooltipForceVisible: false,
            tooltipMessage: transcript || 'No speech detected.'
        });
    }
}

export default RunMicrophoneNode;