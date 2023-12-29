let meetingState;

const defaultCallContraints = {
    video: true,
    audio: true
};

const iceConf = {
    iceServers: [
        {
            urls: "stun:stun.l.google.com:13902"
        }
    ]
}

async function resetState() {
    meetingState = {
        inRoom: false,
        screenSharing: false,
        peerConnection: null,
        localStream: null,
        remoteStream: null,
        screenSharingStream: null,
        localCamera: null,
        remoteCamera: null,
        chatChannel: null,
        dialog: null
    }
}

function wsSendRTCSignal(data) {
    wsSendPrototype("meeting")(data);
}

ws.addEventListener("message", async e => {
    const content = JSON.parse(e.data);

    if (content.context !== "meeting") return;

    if (content.message === "send-offer") {
        if (!meetingState.inRoom) return;
        await createPeerConnection(meetingState.dialog);
        const offer = await meetingState.peerConnection.createOffer();
        await meetingState.peerConnection.setLocalDescription(offer);
        wsSendRTCSignal({
            message: "offer",
            content: offer
        });
    }

    if (content.message === "handle-offer") {
        if (!meetingState.inRoom) return;
        await createPeerConnection(meetingState.dialog);
        const offer = content.content;
        await meetingState.peerConnection.setRemoteDescription(offer);
        const answer = await meetingState.peerConnection.createAnswer();
        await meetingState.peerConnection.setLocalDescription(answer);
        wsSendRTCSignal({
            message: "answer",
            content: answer
        })
    }

    if (content.message === "handle-answer") {
        if (!meetingState.inRoom) return;
        const answer = content.content;
        await meetingState.peerConnection.setRemoteDescription(answer);
    }

    if (content.message === "ice-candidate") {
        if (!meetingState.inRoom) return;
        try {
            await meetingState.peerConnection.addIceCandidate(content.content);
        } catch (err) {
            console.error("error in adding ice candidate", err);
        }
    }
})

async function renderCallDialog(course) {
    await resetState();

    const [dialog, bsDialog] = await detailsDialog({
        title: course.courseDetails.title,
        size: "fullscreen",
        returnBsDialog: true,
        content: `
        <div class="w-100 d-flex flex-column h-100">
            <div class="w-100 d-flex h-100">
                <div class="w-50 d-flex flex-column justify-content-between align-items-center">
                    <div class="w-75 bg-dark rounded d-flex position-relative justify-content-center align-items-center overflow-hidden" style="height: 350px">
                        <video data-remote class="w-100" autoplay muted></video>
                        <div data-no-peer-cover class="d-flex justify-content-center align-items-center text-light w-100 h-100 bg-dark position-absolute">
                            No peer connected
                        </div>
                    </div>
                    <div class="w-75 bg-dark rounded d-flex justify-content-center align-items-center overflow-hidden" style="height: 350px">
                        <video data-local class="w-100" autoplay muted></video>
                    </div>
                </div>

                <div class="w-50 relative d-flex flex-column">
                    <ul class="nav nav-tabs">
                        <li class="nav-item cursor-pointer" style="width: 20%">
                            <div data-tab="Chat" class="nav-link text-center active" aria-current="page" href="#">Chat</div>
                        </li>
                        <li class="nav-item cursor-pointer" style="width: 20%">
                            <div data-tab="Codes" class="nav-link text-center" aria-current="page" href="#">Codes</div>
                        </li>
                    </ul>
                    <div data-right-content class="flex-fill border-start border-bottom border-end position-relative">
                        <div data-content="Chat" class="h-100">

                            <div data-chat-content style="height: 90%" class="overflow-y-auto p-4">
                            </div>

                            <div style="height: 10%" class="d-flex justify-content-center align-items-center p-2">
                                <input data-chat-input type="text" placeholder="Enter text here" class="form-control w-100">
                                <button data-send-chat type="button" class="btn btn-outline-primary mx-2"><i class="fa-solid fa-paper-plane"></i></button>
                            </div>

                        </div>

                        <div data-content="Codes" class="h-100 d-none p-4">

                        </div>
                    </div>
                </div>
            </div>

            <div class="d-flex justify-content-center align-items-center w-100" style="height: 100px">
                <button data-cam style="width: 50px; height: 50px" type="button" class="btn btn-dark mx-2 py-2 px-3 rounded-circle">
                    <i class="fa-solid fa-video"></i>
                </button>
                <button data-mic style="width: 50px; height: 50px" type="button" class="btn btn-dark mx-2 py-2 px-3 rounded-circle">
                    <i class="fa-solid fa-microphone"></i>
                </button>
                <button data-screen style="width: 50px; height: 50px" type="button" class="btn btn-outline-dark mx-2 py-2 px-3 rounded-circle">
                    <i class="fa-solid fa-desktop"></i>
                </button>
                <button data-end style="width: 50px; height: 50px" type="button" class="btn btn-danger mx-2 py-2 px-3 rounded-circle">
                    <i class="fa-solid fa-phone-slash"></i>
                </button>
            </div>
        </div>
        `,
        buttons: []
    });

    meetingState.dialog = dialog;
    setupContentTabs(dialog);

    meetingState.localCamera = dialog.find("video[data-local]");
    meetingState.remoteCamera = dialog.find("video[data-remote]");

    meetingState.localStream = await getLocalStream();

    meetingState.inRoom = true;
    meetingState.localCamera[0].srcObject = meetingState.localStream;
    meetingState.localStream.getTracks().forEach(track => {
        track.enabled = true;
    });

    dialog.find(`[data-content="Codes"]`).append(textEditor());

    dialog.find("[data-text-editor]").on("input", e => {
        sendRTCCode({
            message: "code",
            content: e.target.value
        })
    })

    dialog.find("[data-input-editor]").on("input", e => {
        sendRTCCode({
            message: "input",
            content: e.target.value
        })
    })

    dialog.find("[data-cam]").on("click", async function(e) {
        const newState = !meetingState.localStream.getVideoTracks()[0].enabled;
        setButtonState($(this), newState);
        meetingState.localStream.getVideoTracks()[0].enabled = newState;
    })

    dialog.find("[data-mic]").on("click", async function(e) {
        const newState = !meetingState.localStream.getAudioTracks()[0].enabled;
        setButtonState($(this), newState);
        meetingState.localStream.getAudioTracks()[0].enabled = newState;
    })

    dialog.find("[data-screen]").on("click", async function(e) {
        setButtonState($(this), !meetingState.screenSharingStream);
        await switchCameraAndScreen();
    })

    const chatInput = dialog.find("[data-chat-input]");
    const chatContent = dialog.find("[data-chat-content]");
    
    dialog.find("[data-send-chat]").on("click", function() {
        if (!chatInput.val().length) return;

        const message = chatInput.val();
        chatInput.val(null);
        
        chatContent.append(userTextBubble(message));
        sendRTCChat({ message: message });
    })

    dialog.find("[data-end]").on("click", e => {
        bsDialog.hide()
    })

    dialog.on("hide.bs.modal", async e => {
        meetingState.peerConnection?.close();
        meetingState.localStream.getTracks().forEach(track => {
            track.stop();
            meetingState.localStream.removeTrack(track);
        });
        await resetState();
    })

    wsSendRTCSignal({
        message: "joined",
        content: course._id
    });
}

function setupContentTabs(dialog) {
    dialog.find("[data-tab]").on("click", function(e) {
        const tab = $(this);
        const tabName = tab.data("tab");
        
        dialog.find("[data-tab]")
            .removeClass("active");

        tab.addClass("active");

        dialog.find("[data-content]")
            .addClass("d-none");

        dialog.find(`[data-content="${tabName}"]`)
            .removeClass("d-none");
    });
}

function userTextBubble(message) {
    return $(`
    <div class="w-100 d-flex mb-2">
        <div class="user-chat-bubble">
            ${message}        
        </div>
    </div>
    `);
}

function peerTextBubble(message) {
    return $(`
    <div class="w-100 d-flex justify-content-end mb-2">
        <div class="peer-chat-bubble">
            ${message}    
        </div>
    </div>
    `)
}

function setButtonState(element, isActive) {
    const elementClasses = ["btn-dark", "btn-outline-dark"];
    const toggleClasses = classes => 
        element.addClass(classes[0]).removeClass(classes[1]);
    toggleClasses(isActive ? elementClasses : elementClasses.reverse());
}

async function getLocalStream() {
    const stream = await navigator.mediaDevices.getUserMedia(defaultCallContraints);
    return stream;
}

async function createPeerConnection(dialog) {
    
    function hidePeerVideoCover(isConnected) {
        const visibilityClasses = ["visible", "invisible"];
        (classes => {
            dialog.find("[data-no-peer-cover]")
                .addClass(classes[0])
                .removeClass(classes[1]);
        })(isConnected ? visibilityClasses.reverse() : visibilityClasses);
    }

    meetingState.peerConnection = new RTCPeerConnection(iceConf);
    
    meetingState.chatChannel = meetingState.peerConnection.createDataChannel("chat");

    meetingState.peerConnection.ondatachannel = function(e) {
        const chatChannel = e.channel;

        chatChannel.onopen = () => {
            console.log("Connected to peer")
            hidePeerVideoCover(true);
        }

        chatChannel.onmessage = e => {
            const content = JSON.parse(e.data);

            if (content.context === "chat") {
                const chatContent = dialog.find("[data-chat-content]");
                chatContent.append(
                    peerTextBubble(content.message)
                );

            } else if (content.context === "code") {
                
                if (content.message === "code") {
                    const textEditor = dialog.find("[data-text-editor]");
                    textEditor.val(content.content);
                
                } else if (content.message === "input") {
                    const inputEditor = dialog.find("[data-input-editor]");
                    inputEditor.val(content.content);
                }
                
            }
        }

        chatChannel.onclose = () => {
            hidePeerVideoCover(false);
        }
    }

    meetingState.peerConnection.onicecandidate = event => {
        if (event.candidate) {
            wsSendRTCSignal({
                message: "ice-candidate",
                content: event.candidate
            })
        }
    }

    meetingState.remoteStream = new MediaStream();
    meetingState.remoteCamera[0].srcObject = meetingState.remoteStream;
    meetingState.remoteStream.getTracks().forEach(track => setTrackEndedEvent(track));

    meetingState.peerConnection.ontrack = e => {
        meetingState.remoteStream.addTrack(e.track);
    }

    for (const track of meetingState.localStream.getTracks()) {
        meetingState.peerConnection.addTrack(track, meetingState.localStream);
    }
}

function sendRTCChat(message) {
    if (!meetingState.chatChannel) return;
    meetingState.chatChannel.send(JSON.stringify({
        ...message,
        context: "chat"
    }));
}

function sendRTCCode(message) {
    if (!meetingState.chatChannel) return;
    meetingState.chatChannel.send(JSON.stringify({
        ...message,
        context: "code"
    }));
}

async function switchCameraAndScreen() {
    if (!meetingState.inRoom) return;

    if (meetingState.screenSharing) {
        const sender = meetingState.peerConnection.getSenders()
            .find(s => s.track.kind === meetingState.localStream.getVideoTracks()[0].kind);
        
        if (sender) sender.replaceTrack(meetingState.localStream.getVideoTracks()[0]);

        meetingState.screenSharingStream.getTracks().forEach(track => track.stop());

        meetingState.localCamera[0].srcObject = meetingState.localStream;
        
    } else {
        try {
            meetingState.screenSharingStream = await navigator.mediaDevices.getDisplayMedia({
                video: true
            });
            const sender = meetingState.peerConnection?.getSenders()
                .find(s => s.track.kind === meetingState.screenSharingStream.getVideoTracks()[0].kind);
            
            if (sender) sender.replaceTrack(meetingState.screenSharingStream.getVideoTracks()[0]);
            meetingState.localCamera[0].srcObject = meetingState.screenSharingStream;
        } catch(e) {
            console.error("Failed to share screen.")
        }
    }

    meetingState.screenSharing = !meetingState.screenSharing;
}