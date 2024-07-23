import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { LockstepServer } from "../common/shared.js";

let globals = {};

class App {
    isListening;
    expressApp;
    httpServer;
    socketServer;
    lockstepServer;

    constructor() {
        this.expressApp = express();
        this.httpServer = createServer(this.expressApp);
        this.socketServer = new Server(this.httpServer);

        this.expressApp.use(express.static("public"));
        this.expressApp.get("/shared.js", (req, res) => {
            res.sendFile("shared.js", { root: "common" });
        });

        this.lockstepServer = new LockstepServer(this.socketServer);

        console.log("Starting server...");
        this.httpServer.listen(3000, () => {
            console.log("listening on http://localhost:3000");
        });
    }
}

globals.app = new App();
