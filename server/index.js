import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { DT, initGameState, updateGameState } from "../common/shared.js";

const SYNC_FPS = 40;
const GAME_FPS = 120;

let globals = {};

class App {
    isListening;
    expressApp;
    httpServer;
    socketServer;
    gameState;
    game;

    constructor() {
        this.expressApp = express();
        this.httpServer = createServer(this.expressApp);
        this.socketServer = new Server(this.httpServer);

        this.expressApp.use(express.static("public"));
        this.expressApp.get("/shared.js", (req, res) => {
            res.sendFile("shared.js", { root: "common" });
        });

        this.gameState = new GameState(this);
        this.game = new Game(this);

        this.socketServer.on("connection", (socket) => {
            console.log("Socket Connect: " + socket.id);

            socket.on("disconnect", () => {
                console.log("Socket Disconnect: " + socket.id);
            });
        });

        console.log("Starting server...");
        this.httpServer.listen(3000, () => {
            console.log("listening on http://localhost:3000");
            this.isListening = true;

            this.startMainLoops();
        });
    }

    startMainLoops() {
        setInterval(() => {
            this.gameState.syncState();
        }, 1000 / SYNC_FPS);

        setInterval(() => {
            this.game.update();
        }, 1000 / GAME_FPS);
    }
}

class GameState {
    app;
    state;
    events;

    constructor(app) {
        this.app = app;
        this.state = initGameState();
        this.events = [];

        this.app.socketServer.on("connection", (socket) => {
            socket.on("events", (events) => {
                this.onReceiveEvents(events);
            });
        });
    }

    onReceiveEvents(events) {
        this.events.push(...events);
    }

    syncState() {
        this.app.socketServer.emit("syncState", this.state);
    }
}

class Game {
    app;
    dt;

    constructor(app) {
        this.app = app;
        this.dt = new DT();
    }

    update() {
        if (!this.app.isListening) return;
        this.dt.update();
        updateGameState(this.dt.current, this.app.gameState);
        this.app.gameState.events = [];
    }
}

globals.app = new App();
