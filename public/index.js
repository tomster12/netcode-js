const GAME_FPS = 60;

let globals = {};

class App {
    isConnected;
    events;
    socket;
    game;

    constructor() {
        this.isConnected = false;
        this.events = new ListenBus();
        this.socket = io();
        this.game = new Game(this);

        console.log("Connecting to server...");
        this.socket.on("connect", () => {
            console.log("Socket Connected: " + this.socket.id);
            this.isConnected = true;
            this.events.emit("connect", this.socket);

            this.socket.on("disconnect", () => {
                console.log("Socket Disconnected: " + this.socket.id);
                this.isConnected = false;
                this.events.emit("disconnect", this.socket);
            });
        });
    }

    update() {
        this.game.update();
        this.game.render();
    }
}

class Game {
    app;
    isInitialized;
    state;
    events;
    player;

    constructor(app) {
        this.app = app;
        this.isInitialized = false;
        this.state = null;
        this.events = [];

        this.app.events.on("connect", (socket) => {
            this.app.socket.on("syncState", (data) => {
                if (!this.state) this.state = data;
                else this.state = GameState.reconcileState(this.state, data);
                if (!this.isInitialized && this.state.players[this.app.socket.id]) this.initGame();
            });

            const pos = { x: Math.random() * width, y: height };
            const color = { r: 100 + Math.random() * 155, g: 100 + Math.random() * 155, b: 100 + Math.random() * 155 };
            socket.emit("events", [GameEvents.newPlayerAddEvent(socket.id, pos, color)]);
        });
    }

    initGame() {
        this.player = new Player(this);
        this.isInitialized = true;
    }

    update() {
        if (!this.isInitialized) return;
        this.player.update();
        GameState.updateState(this.state, this.events);
        if (this.events != []) this.app.socket.emit("events", this.events);
        this.events = [];
    }

    render() {
        background(0);

        if (!this.isInitialized) {
            fill(255);
            textAlign(CENTER, CENTER);
            textSize(32);
            text("Connecting...", width / 2, height / 2);
            return;
        }

        for (let id in this.state.players) {
            let player = this.state.players[id];
            fill(player.color.r, player.color.g, player.color.b);
            noStroke();
            ellipse(player.pos.x, player.pos.y, Constants.PLAYER_SIZE);
        }
    }
}

class Player {
    constructor(game) {
        this.game = game;
    }

    update() {
        let inputDir = 0;
        let inputJump = false;
        if (keyIsDown(LEFT_ARROW) || keyIsDown(65)) inputDir -= 1;
        if (keyIsDown(RIGHT_ARROW) || keyIsDown(68)) inputDir += 1;
        if (keyIsDown(UP_ARROW) || keyIsDown(87) || keyIsDown(32)) inputJump = true;

        this.game.events.push({
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
