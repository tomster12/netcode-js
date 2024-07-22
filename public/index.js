const GAME_FPS = 2;

let globals = {};

class App {
    isConnected;
    socket;
    game;

    constructor() {
        this.isConnected = false;
        this.socket = io();
        this.game = new Game(this);

        console.log("Connecting to server...");
        this.socket.on("connect", () => {
            console.log("Socket Connected: " + this.socket.id);
            this.isConnected = true;

            this.socket.on("disconnect", () => {
                console.log("Socket Disconnected: " + this.socket.id);
                this.isConnected = false;
            });
        });
    }

    update() {
        if (!this.isConnected) return;
        this.game.update();
        this.game.render();
    }
}

class Game {
    static PLAYER_RADIUS = 20;
    app;
    gameState;
    dt;
    player;
    gameStartTime;
    timestamps;

    constructor(app) {
        this.app = app;
        this.gameState = new GameState(this);
        this.dt = new DT();
        this.player = new Player(this);
        this.gameStartTime = Date.now();
        this.timestamps = [];
    }

    update() {
        if (!this.app.isConnected) return;
        this.dt.update();
        this.player.update();
        updateGameState(this.dt.current, this.gameState);
        this.timestamps.push({ date: Date.now(), gameTime: this.gameState.data.worldTime });
        this.gameState.sendEvents();
        this.gameState.events = [];
    }

    render() {
        background(0);

        for (let id in this.gameState.data.players) {
            let player = this.gameState.data.players[id];
            fill(player.color.r, player.color.g, player.color.b);
            noStroke();
            ellipse(player.pos.x, player.pos.y, Game.PLAYER_RADIUS * 2);
        }

        fill(255);
        textSize(20);
        if (this.dt.last10.length > 0) {
            let averageGameDT = this.dt.last10.reduce((acc, val) => acc + val) / this.dt.last10.length;
            text(`Game FPS: ${(1 / averageGameDT).toFixed(2)}`, 10, 30);
        }
        if (this.gameState.dt.last10.length > 0) {
            let averageSyncDT = this.gameState.dt.last10.reduce((acc, val) => acc + val) / this.gameState.dt.last10.length;
            text(`Sync FPS: ${(1 / averageSyncDT).toFixed(2)}`, 10, 60);
        }

        if (this.gameState.data.serverTimestamps.length > 0) {
            stroke(200);
            line(0, 100, width, 100);
            line(0, 700, width, 700);

            noStroke();
            let ref = this.gameState.data.serverTimestamps[0].date;
            fill(255, 200, 200);
            for (const ts of this.gameState.data.serverTimestamps) {
                const x = map(ts.date - ref, 0, 5 * 1000, 0, width);
                const y = map(ts.gameTime, 0, 5, 100, 700);
                ellipse(x, y, 12);
            }
            fill(200, 200, 255);
            for (const ts of this.gameState.syncTimestamps) {
                const x = map(ts.date - ref, 0, 5 * 1000, 0, width);
                const y = map(ts.gameTime, 0, 5, 100, 700);
                ellipse(x, y, 12);
            }
            fill(200, 255, 200);
            for (const ts of this.timestamps) {
                const x = map(ts.date - ref, 0, 5 * 1000, 0, width);
                const y = map(ts.gameTime, 0, 5, 100, 700);
                ellipse(x, y, 7);
            }
            const gsX = map(this.gameStartTime - ref, 0, 5 * 1000, 0, width);
            ellipse(gsX, 100, 10);
        }
    }
}

class GameState {
    game;
    dt;
    syncTimestamps;

    constructor(game) {
        this.game = game;
        initGameState(this);
        this.dt = new DT();
        this.syncTimestamps = [];

        this.game.app.socket.on("syncState", (data) => {
            this.onReceiveSyncState(data);
        });
    }

    sendEvents() {
        if (this.events.length === 0) return;
        this.game.app.socket.emit("events", this.events);
    }

    onReceiveSyncState(data) {
        this.data = data;
        this.dt.update();
        this.syncTimestamps.push({ date: Date.now(), gameTime: this.data.worldTime });
    }
}

class Player {
    constructor(game) {
        this.game = game;
        this.game.app.socket.on("connect", () => {
            this.game.gameState.events.push({
                type: "playerAdd",
                data: {
                    id: this.game.app.socket.id,
                    pos: { x: Math.random() * width, y: height },
                    color: { r: Math.random() * 255, g: Math.random() * 255, b: Math.random() * 255 },
                },
            });
        });
    }

    update() {
        if (!this.game.gameState.data.players[this.game.app.socket.id]) return;
        let player = this.game.gameState.data.players[this.game.app.socket.id];

        let inputDir = 0;
        let inputJump = false;
        if (keyIsDown(LEFT_ARROW) || keyIsDown(65)) inputDir -= 1;
        if (keyIsDown(RIGHT_ARROW) || keyIsDown(68)) inputDir += 1;
        if (keyIsDown(UP_ARROW) || keyIsDown(87) || keyIsDown(32)) inputJump = true;

        this.game.gameState.events.push({
            type: "playerInput",
            data: {
                id: this.game.app.socket.id,
                inputDir,
                inputJump,
            },
        });
    }
}

function setup() {
    createCanvas(800, 800);
    noSmooth();
    frameRate(GAME_FPS);
    globals.app = new App();
}

function draw() {
    background(0);
    globals.app.update();
}
