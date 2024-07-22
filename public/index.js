const GAME_FPS = 60;

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
    app;
    state;
    events;
    player;

    constructor(app) {
        this.app = app;
        this.state = initGameState();
        this.events = [];
        this.player = new Player(this);

        this.app.socket.on("syncState", (data) => {
            this.state = reconcileGameState(this.state, data);
        });
    }

    update() {
        if (!this.app.isConnected) return;
        this.player.update();
        updateGameState(this.state, this.events);
        if (this.events != []) this.app.socket.emit("events", this.events);
        this.events = [];
    }

    render() {
        background(0);

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
        this.game.app.socket.on("connect", () => {
            this.game.events.push({
                type: "playerAdd",
                data: {
                    id: this.game.app.socket.id,
                    pos: { x: Math.random() * width, y: height },
                    color: {
                        r: 100 + Math.random() * 155,
                        g: 100 + Math.random() * 155,
                        b: 100 + Math.random() * 155,
                    },
                },
            });
        });
    }

    update() {
        if (!this.game.state.players[this.game.app.socket.id]) return;

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
