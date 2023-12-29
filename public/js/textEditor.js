let runtimeConfig = {};

function resetRuntime() {
    runtimeConfig = {
        sessionId: null,
        addOutput: null,
        getOutput: null,
    };
}

function wsSendIDE(data) {
    if (!runtimeConfig.sessionId) return;
    wsSendPrototype("ide")(data);
}

ws.addEventListener("message", async e => {
    const content = JSON.parse(e.data);
    
    if (content.context != "ide" || !runtimeConfig.sessionId) return;

    if (content.message === "output") {
        runtimeConfig?.addOutput(content.content);
    }

    if (content.message === "done") {
        runtimeConfig?.addOutput("\n\n---END---")
        resetRuntime();
    }
})

function textEditor() {
    resetRuntime();

    const textEditor = createTextEditor();
    const outputContent = createOutputContent();
    const runButton = createRunButton(
        textEditor, 
        outputContent.find("[data-output-content]")
    );

    const textEditorContainer = $(`<div class="h-100 w-100"></div>`);
    textEditorContainer.append(
        $(`<div class="d-flex" style="height: 65%"></div>`)
            .append(textEditor)
    );
    textEditorContainer.append(runButton);
    textEditorContainer.append(outputContent);

    return textEditorContainer;
}

function createTextEditor() {
    const textEditor = $(`<textarea data-text-editor placeholder="Enter your code here" spellcheck="false" autocorrect="off"></textarea>`);

    textEditor.addClass("form-control w-100 text-editor text-light bg-dark h-100 p-4");
    textEditor.css("resize", "none");
    
    textEditor.on("keydown", function(e) {
        
        if (e.key === "Tab") {
            e.preventDefault();
            curValue = this.value;
            this.value = curValue.substring(0, this.selectionStart) +
                            "\t" + curValue.substring(this.selectionEnd);

        }

    })

    return textEditor;
}

function createInputEditor() {
    const inputEditor = $(`<textarea data-input-editor placeholder="Enter program input here" spellcheck="false" autocorrect="off"></textarea>`);

    inputEditor.addClass("form-control w-25 text-editor text-light bg-dark h-100 p-4");
    inputEditor.css("resize", "none");

    return inputEditor;
}

function createRunButton(textEditor, outputContent, inputContent) {

    const runBtn = $(`<button data-run-code type="button">Run <i class="fa-solid fa-play"></i></button>`)

    runBtn.addClass("btn btn-success w-100")
    runBtn.css("height", "5%");

    runBtn.on("click", async function(e) {

        runtimeConfig.addOutput = function(data) {
            outputContent.val(outputContent.val() + data
                                        .replace(/\\r/g, '\r')
                                        .replace(/\\n/g, '\n')
                                        .replace(/\\"/g, '\"')
                                        .replace(/\\\\"/g, '\\"'));
        }
    
        runtimeConfig.getOutput = function() {
            return outputContent.val();
        }

        outputContent.val("");
        const code = textEditor.val();
        runtimeConfig.sessionId = await runPythonCode(code);
    });

    return runBtn;
}

function createOutputContent() {
    
    const output = $(`<textarea data-output-content spellcheck="false" autocorrect="off" disabled></textarea>`);
    const input = $(`<input data-program-input class="form-control text-editor">`);

    input.on("keydown", e => {
        if (e.key !== "Enter") return;
        if (!e.target.value) return;
        if (!runtimeConfig.sessionId) return;

        runtimeConfig?.addOutput(e.target.value + "\n");

        wsSendIDE({
            context: "ide",
            message: "input",
            content: {
                input: e.target.value,
                sessionId: runtimeConfig.sessionId
            }
        });
        input.val("");
    });

    output.addClass("form-control h-100 text-editor text-light bg-dark p-4");
    output.css("resize", "none");
    
    const outputContainer = $(`<div></div>`)
    outputContainer.css("height", "25%"); 
    outputContainer.append(output);
    outputContainer.append(input)

    return outputContainer;
}

async function runPythonCode(code) {
    const response = await $.ajax({
        method: "POST",
        url: "/run-python-code",
        data: {
            code: code
        }
    });
    runtimeConfig.sessionId = response.sessionId;
    return response;
}