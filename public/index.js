const APP_FPS = 1;

let globals = {};

class App {
    isConnected;
    events;
    socket;
    game;

    constructor() {
        this.isConnected = false;
        this.events = new EventBus();
        this.socket = io();
        this.game = new Game(this);

        console.log("Connecting to server...");
        this.socket.on("connect", () => {
            console.log("Socket Connected: " + this.socket.id);
            this.isConnected = true;
            this.events.emit("connect", this.socket);

            this.socket.on("disconnect", () => {
                console.log("Socket Disconnected");
                this.isConnected = false;
                this.events.emit("disconnect", this.socket);
            });
        });
    }

    draw() {
        this.game.draw();
    }
}

class Game {
    app;
    client;
    state;
    events;

    constructor(app) {
        this.app = app;
        this.app.events.on("connect", () => {
            this.client = new RollbackClient(this.app.socket, this);
            this.setState(GameStateUtil.initState());
        });
        this.app.events.on("disconnect", () => {
            this.client = null;
        });
    }

    draw() {
        if (this.client) {
            this.generateEvents();
            this.updateState(this.events);
            this.client.tickFrame(this.state, this.events);
        }
        this.render();
    }

    generateEvents() {
        this.events = [];
        if (!this.state.players[this.app.socket.id]) {
            this.events.push(GameEventUtil.newPlayerConnectEvent(this.app.socket.id));
        } else {
            let input = { dir: 0, jump: false };
            if (keyIsDown(LEFT_ARROW) || keyIsDown(65)) input.dir -= 1;
            if (keyIsDown(RIGHT_ARROW) || keyIsDown(68)) input.dir += 1;
            if (keyIsDown(UP_ARROW) || keyIsDown(87) || keyIsDown(32)) input.jump = true;
            this.events.push(GameEventUtil.newPlayerInputEvent(this.app.socket.id, input));
        }
    }

    updateState(events) {
        GameStateUtil.updateState(this.state, events);
    }

    getState() {
        return this.state;
    }

    setState(state) {
        this.state = state;
    }

    render() {
        if (!this.client) return;

        noStroke();
        for (let id in this.state.players) {
            let player = this.state.players[id];
            fill(player.color.r, player.color.g, player.color.b);
            ellipse(player.pos.x, player.pos.y, 30);
        }
    }
}

function setup() {
    createCanvas(800, 800);
    noSmooth();
    frameRate(APP_FPS);
    globals.app = new App();
}

function draw() {
    background(0);
    globals.app.draw();
}
