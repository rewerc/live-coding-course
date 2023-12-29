import WebSocket, { WebSocketServer } from "ws";
import fs from "fs";
import utils from "./utils.js";
import course from "./models/course.js";

const meetingRooms = {};
const connectedClients = {};
const runtimeSessions = {};

export default function(server) {

    function removeUserFromRoom(ws) {
        if (!ws.currentRoom) return;
        const bookedId = ws.currentRoom;
    
        meetingRooms[bookedId] = meetingRooms[bookedId]
                                    .filter(user => user !== ws.email);
        delete ws.currentRoom;
    }

    function removeUserRuntimes(ws) {
        for (const rt of Object.keys(runtimeSessions)) {
            if (runtimeSessions[rt].user === ws.email) {
                fs.unlinkSync(runtimeSessions[rt].path);
                delete runtimeSessions[rt];
            }
        }
    }

    const wss = new WebSocketServer({ server: server });
    
    wss.sendByEmail = (email, message) => {
        const sendByEmail = em => {
            const receiver = connectedClients[em];
            if (!receiver) return;
            receiver.send(JSON.stringify(message));
        }

        if (typeof email === "string") {
            sendByEmail(email);
        } else {
            for (const em of email) sendByEmail(em);
        }
    }

    wss.addRuntimeSession = (sessionId, filepath, process, email) => {
        runtimeSessions[sessionId] = {
            path: filepath,
            process: process,
            user: email
        }
    }

    wss.removeRuntime = sessionId => {
        delete runtimeSessions[sessionId];
    }
    
    wss.on("connection", ws => {
    
        console.log("[NEW USER CONNECTED]")
    
        ws.on("message", async message => {
            const content = JSON.parse(message.toString());

            if (content.context === "home") {

                if (content.message === "initialize") {
                    ws.email = content.content;
                    connectedClients[ws.email] = ws;
        
                    const courseDetails = await utils.getBookedDetailsByInstructor(ws.email);
                    wss.sendByEmail(ws.email, {
                        message: "booked",
                        content: courseDetails
                    })
                }
            }

            if (content.context === "ide") {
                
                if (content.message === "input") {
                    const input = content.content.input;
                    const sessionId = content.content.sessionId.sessionId;
                    runtimeSessions[sessionId].process.stdin.write(input + "\n");
                }
            }

            if (content.context === "meeting") {

                if (content.message === "joined") {
                    const bookedId = content.content;
                    
                    const bookedRoom = meetingRooms[bookedId] || [];

                    if (bookedRoom.length < 2) {
                        bookedRoom.push(ws.email);
                        ws.currentRoom = bookedId;
                    } else if (bookedRoom.length > 2) {
                        wss.sendByEmail(ws.email, {
                            context: "error",
                            message: "Room is occupied."
                        });
                        return;
                    }

                    if (bookedRoom.length === 2) {
                        wss.sendByEmail(ws.email, {
                            context: "meeting",
                            message: "send-offer"
                        })
                    }

                    meetingRooms[bookedId] = bookedRoom;
                }

                if (content.message === "left") {
                    removeUserFromRoom(ws);
                }

                if (content.message === "offer") {
                    const offer = content.content;
                    const peer = meetingRooms[ws.currentRoom].find(user => user !== ws.email);

                    if (!peer) return;
                    wss.sendByEmail(peer, {
                        context: "meeting",
                        message: "handle-offer",
                        content: offer
                    });
                }

                if (content.message === "answer") {
                    const peer = meetingRooms[ws.currentRoom].find(user => user !== ws.email);

                    if (!peer) return;
                    wss.sendByEmail(peer, {
                        context: "meeting",
                        message: "handle-answer",
                        content: content.content
                    })
                }

                if (content.message === "ice-candidate") {
                    const peer = meetingRooms[ws.currentRoom].find(user => user !== ws.email);

                    if (!peer) return;
                    wss.sendByEmail(peer, {
                        context: "meeting",
                        message: "ice-candidate",
                        content: content.content
                    })
                }
            }
            
        });
    
        ws.on("close", () => {
            delete connectedClients[ws.email];
            removeUserRuntimes(ws);
            removeUserFromRoom(ws);
        })
    })
    
    return wss;
}