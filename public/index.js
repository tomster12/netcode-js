const GAME_FPS = 120;

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

    constructor(app) {
        this.app = app;
        this.gameState = new GameState(this);
        this.dt = new DT();
        this.player = new Player(this);
    }

    update() {
        if (!this.app.isConnected) return;
        this.dt.update();
        this.player.update();
        updateGameState(this.dt.current, this.gameState);
        this.gameState.sendEvents();
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
    }
}

class GameState {
    game;
    dt;

    constructor(game) {
        this.game = game;
        initGameState(this);
        this.dt = new DT();

        this.game.app.socket.on("syncState", (data) => {
            this.onReceiveSyncState(data);
        });
    }

    sendEvents() {
        if (this.events.length === 0) return;
        this.game.app.socket.emit("events", this.events);
        this.events = [];
    }

    onReceiveSyncState(data) {
        this.data = data;
        this.dt.update();
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
                    pos: { x: Math.random() * width, y: height / 2 },
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
