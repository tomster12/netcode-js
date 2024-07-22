import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { DT, initGameState, updateGameState, cleanGameStateFromSocket } from "../common/shared.js";

const SYNC_FPS = 1;
const GAME_FPS = 4;

let globals = {};

class App {
    isListening;
    expressApp;
    httpServer;
    socketServer;
    game;

    constructor() {
        this.expressApp = express();
        this.expressApp.use(express.static("public"));
        this.expressApp.get("/shared.js", (req, res) => {
            res.sendFile("shared.js", { root: "common" });
        });

        this.httpServer = createServer(this.expressApp);

        this.socketServer = new Server(this.httpServer);
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
            this.startMainLoops();
        });
    }

    startMainLoops() {
        setInterval(() => {
            this.game.update();
        }, 1000 / GAME_FPS);

        setInterval(() => {
            this.game.gameState.sendSyncState();
        }, 1000 / SYNC_FPS);
    }
}

class Game {
    app;
    gameState;
    dt;

    constructor(app) {
        this.app = app;
        this.gameState = new GameState(this);
        this.dt = new DT();

        this.app.socketServer.on("connection", (socket) => {
            socket.on("disconnect", () => {
                console.log("Socket Disconnect: " + socket.id);
                cleanGameStateFromSocket(this.gameState, socket.id);
            });
        });
    }

    update() {
        if (!this.app.isListening) return;
        this.dt.update();
        updateGameState(this.dt.current, this.gameState);
        this.gameState.data.serverTimestamps.push({ date: Date.now(), gameTime: this.gameState.data.worldTime });
        this.gameState.events = [];
    }
}

class GameState {
    game;
    data;
    events;

    constructor(game) {
        this.game = game;
        initGameState(this);

        this.game.app.socketServer.on("connection", (socket) => {
            socket.on("events", (events) => {
                this.onReceiveEvents(events);
            });
        });
    }

    onReceiveEvents(events) {
        this.events.push(...events);
    }

    sendSyncState() {
        this.game.app.socketServer.emit("syncState", this.data);
    }
}

globals.app = new App();
