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
            let gameFPS = 1000 / (this.dt.last10.reduce((acc, val) => acc + val) / this.dt.last10.length);
            text(`Game FPS: ${gameFPS.toFixed(2)}`, 10, 30);
        }
        if (this.gameState.dt.last10.length > 0) {
            let syncFPS = 1000 / (this.gameState.dt.last10.reduce((acc, val) => acc + val) / this.gameState.dt.last10.length);
            text(`Sync FPS: ${syncFPS.toFixed(2)}`, 10, 60);
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
            this.onSyncState(data);
        });
    }

    sendEvents() {
        if (this.events.length === 0) return;
        this.game.app.socket.emit("events", this.events);
        this.events = [];
    }

    onSyncState(data) {
        this.data = data;
        this.dt.update();
    }
}

class Player {
    constructor(game) {
        this.game = game;
        this.game.app.socket.on("connect", () => {
            this.game.gameState.events.push({
                type: "addPlayer",
                data: {
                    id: this.game.app.socket.id,
                    color: { r: Math.random() * 255, g: Math.random() * 255, b: Math.random() * 255 },
                },
            });
        });
    }

    update() {
        let mousePos = { x: mouseX, y: mouseY };
        this.game.gameState.events.push({
            type: "movePlayer",
            data: { id: this.game.app.socket.id, pos: mousePos },
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
