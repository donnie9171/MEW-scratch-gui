
import { userId } from "../helper/userId";
import { AZURE_SOURCE } from "../helper/azureConfig";

class RunAgentNode extends window.RunNode {
  async run() {
    let question =
      "Hello world!"; // fallback question

    if (this.node.inputs && this.node.inputs.length > 0) {
      // If there are inputs, we can process them
      let tempQuestion = "";
      const inputNodes = this.getInputs();
      for (const inputNode of inputNodes) {
        tempQuestion +=
          window.runtimeState.getNodeState(inputNode.id)?.outputValue || "";
      }
      question = tempQuestion;
    }

    const model = this.node.data?.model || "gpt-3.5-turbo";
    let url, messages;
    if (model === "llama-3.2") {
      url = "http://localhost:11434/api/chat";
      payload = {
        model: "llama3.2",
        messages: [{ role: "user", content: question }],
      };
      // Llama streaming response
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let done = false;
        let inference = "";

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;

          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk
              .split("\n")
              .filter((line) => line.trim() !== "");

            for (const line of lines) {
              try {
                const jsonData = JSON.parse(line);
                if (jsonData.message && jsonData.message.content) {
                  inference += jsonData.message.content;
                  window.runtimeState.setNodeState(this.node.id, {
                    prompt: question,
                    inference: inference,
                  });
                  window.updateAgentPanel();
                }
              } catch (error) {
                console.error(
                  `Failed to parse line: ${line} with error ${error}`
                );
              }
            }
          }
        }
        this.setOutputValue(inference);
      } else {
        console.error(`Error: ${response.status}`);
        const errorText = await response.text();
        console.error(errorText);
      }
    } else if (model === "gpt-3.5-turbo") {
      url = AZURE_SOURCE + "/api/oai1";
      // payload = {
      //   payload: {
      //     model: "gpt-3.5-turbo",
      //     messages: [{ role: "user", content: question }],
      //   },
      // };
      messages = [{ role: "user", content: question }];
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": userId,
        },
        body: JSON.stringify({messages}),
      });

      let inference = "";

      if (response.ok) {
        const result = await response.json();
        console.log("OpenAI response:", JSON.stringify(result.body, null, 2));
        let choices = null;
        choices = result.choices;
        if (choices && choices.length > 0) {
          inference = choices[0].message?.content || "";
        } else if (result && result.body && result.body.error) {
          inference = `Error: ${
            result.body.error.message || JSON.stringify(result.body.error)
          }`;
        } else {
          inference = JSON.stringify(result, null, 2);
        }
        window.runtimeState.setNodeState(this.node.id, {
          prompt: question,
          inference: inference,
          error: undefined
        });
        window.updateAgentPanel();
        this.setOutputValue(inference);
        console.log("Token Bucket Info:", result.tokenBucket);
        window.updateTokenBucketBar(result.tokenBucket);
      } else {
        console.error(`Error: ${response.status}`);

        let errormsg = '';
        // Check for rate limit exceeded (429)
        console.log(response.status);
        if (response.status === 429) {
          // Show error badge on agent node
          if (this.node && this.node.el) {
            this.node.el.classList.add("error-badge");
          }
          // Reuse cutmode modal for error message
          const cutTooltip = document.getElementById("cut-tooltip");
          if (cutTooltip) {
            cutTooltip.textContent =
              "Tokens exhausted! Please wait for tokens to recharge.";
            cutTooltip.style.display = "block";
            cutTooltip.classList.add("shake");
            setTimeout(() => {
              cutTooltip.classList.remove("shake");
            }, 1000);
            setTimeout(() => {
              cutTooltip.style.display = "none";
            }, 10000);
          }
          errormsg = "Tokens exhausted! Please wait for tokens to recharge.";
        }else{
          const errorText = await response.text();
          window.runtimeState.setNodeState(this.node.id, {
            prompt: question,
            inference: `API error: ${errorText}`,
          });
          this.setOutputValue(`API error: ${errorText}`);
          console.error(errorText);
          errormsg = `API error: ${errorText}`;
        }
        window.runtimeState.setNodeState(this.node.id, {
          error: errormsg
        });
        window.updateAgentPanel();
        throw new Error(errormsg);


      }
    } else {
      let errormsg = `Unknown model: ${model}`;
      window.runtimeState.setNodeState(this.node.id, {
        error: errormsg
      });
      window.updateAgentPanel();
      throw new Error(errormsg);
    }
  }
}

window.RunAgentNode = RunAgentNode;
