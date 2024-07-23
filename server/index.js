import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { GameState } from "../common/shared.js";

const SYNC_FPS = 30;
const GAME_FPS = 60;

let globals = {};

class App {
    isListening;
    expressApp;
    httpServer;
    socketServer;
    game;

    constructor() {
        this.expressApp = express();
        this.httpServer = createServer(this.expressApp);
        this.socketServer = new Server(this.httpServer);

        this.expressApp.use(express.static("public"));
        this.expressApp.get("/shared.js", (req, res) => {
            res.sendFile("shared.js", { root: "common" });
        });

        this.socketServer.on("connection", (socket) => {
            console.log("Socket Connect: " + socket.id);
            socket.on("disconnect", () => {
                console.log("Socket Disconnect: " + socket.id);
            });
        });

        this.game = new Game(this);

        console.log("Starting server...");
        this.httpServer.listen(3000, () => {
            console.log("listening on http://localhost:3000");
            this.isListening = true;
            this.startUpdateLoop();
        });
    }

    startUpdateLoop() {
        setInterval(() => {
            this.game.update();
        }, 1000 / GAME_FPS);

        setInterval(() => {
            this.game.syncState();
        }, 1000 / SYNC_FPS);
    }
}

class Game {
    app;
    state;
    events;

    constructor(app) {
        this.app = app;
        this.state = GameState.initState();
        this.events = [];

        this.app.socketServer.on("connection", (socket) => {
            socket.on("events", (events) => {
                for (const event of events) this.events.push(event);
            });

            socket.on("disconnect", () => {
                GameState.cleanSocketFromState(this.state, socket.id);
            });
        });
    }

    update() {
        if (!this.app.isListening) return;
        GameState.updateState(this.state, this.events);
        this.events = [];
    }

    syncState() {
        this.app.socketServer.emit("syncState", this.state);
    }
}

globals.app = new App();
