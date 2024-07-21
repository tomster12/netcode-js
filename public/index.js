const GAME_FPS = 120;

let globals = {};

class App {
    isConnected;
    socket;
    gameState;
    game;

    constructor() {
        this.socket = io();

        this.gameState = new GameState(this);
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
        this.gameState.sendEvents();
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
        this.dt = new DT();

        this.app.socket.on("syncState", (data) => {
            this.onSyncState(data);
        });
    }

    sendEvents() {
        if (this.events.length === 0) return;
        this.app.socket.emit("events", this.events);
        this.events = [];
    }

    onSyncState(data) {
        this.state = data;
        this.dt.update();
    }
}

class Game {
    static PLAYER_RADIUS = 20;
    app;
    dt;
    player;

    constructor(app) {
        this.app = app;
        this.dt = new DT();
        this.player = null;

        this.app.socket.on("connect", () => {
            this.player = new Player(this);
        });
    }

    update() {
        if (!this.app.isConnected) return;
        this.dt.update();
        this.player.update();
        updateGameState(this.dt.current, this.app.gameState);
    }

    render() {
        background(0);

        for (let id in this.app.gameState.state.players) {
            let player = this.app.gameState.state.players[id];
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
        if (this.app.gameState.dt.last10.length > 0) {
            let syncFPS = 1000 / (this.app.gameState.dt.last10.reduce((acc, val) => acc + val) / this.app.gameState.dt.last10.length);
            text(`Sync FPS: ${syncFPS.toFixed(2)}`, 10, 60);
        }
    }
}

class Player {
    constructor(game) {
        this.game = game;
        this.game.app.gameState.events.push({
            type: "addPlayer",
            data: {
                id: this.game.app.socket.id,
                color: { r: Math.random() * 255, g: Math.random() * 255, b: Math.random() * 255 },
            },
        });
    }

    update() {
        let mousePos = { x: mouseX, y: mouseY };
        this.game.app.gameState.events.push({
            type: "movePlayer",
            data: { id: this.game.app.socket.id, pos: mousePos },
        });
    }
}

function setup() {
    createCanvas(500, 800);
    noSmooth();
    frameRate(GAME_FPS);
    globals.app = new App();
}

function draw() {
    background(0);
    globals.app.update();
}
