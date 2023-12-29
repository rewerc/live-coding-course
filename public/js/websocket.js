const ws = new WebSocket("ws://localhost:3000");

function wsSendPrototype(context) {
    return data => {
        ws.send(JSON.stringify({
            context: context,
            ...data
        }));
    }
}