const APP_FPS = 60;

let globals = {};

class App {
    eventBus;
    socket;
    game;

    constructor() {
        this.eventBus = new EventBus();
        this.socket = io();
        this.game = new Game(this);

        console.log("Connecting to server...");
        this.socket.on("connect", () => {
            console.log("Socket Connected: " + this.socket.id);
            this.eventBus.emit("connect", this.socket);

            this.socket.on("disconnect", () => {
                console.log("Socket Disconnected");
                this.eventBus.emit("disconnect", this.socket);
            });
        });
    }

    draw() {
        this.game.update();
        this.game.render();
    }
}

class GameEvent {
    static playerConnect() {
        const pos = { x: 100, y: 100 };
        const color = { r: Math.floor(Math.random() * 255), g: Math.floor(Math.random() * 255), b: Math.floor(Math.random() * 255) };
        return { type: "playerConnect", data: { pos, color } };
    }

    static playerInput(input) {
        return { type: "playerInput", data: { input } };
    }
}

class Game {
    app;
    state;
    events;
    client;

    constructor(app) {
        this.app = app;

        this.app.eventBus.on("connect", () => {
            this.state = { players: {} };
            this.events = [];
            this.client = new LockstepClient(this.app.socket, this.tickFrame.bind(this));
        });

        this.app.eventBus.on("disconnect", () => {
            this.state = { players: {} };
            this.events = [];
            this.client = null;
        });
    }

    update() {
        if (this.client && this.client.canUpdate) {
            this.generateEvents();
            this.client.finishFrame(this.events);
        }
    }

    generateEvents() {
        this.events = [];

        if (!this.state.players[this.app.socket.id]) {
            this.events.push(GameEvent.playerConnect());
            return;
        }

        let input = { dir: 0, jump: false };
        if (keyIsDown(LEFT_ARROW) || keyIsDown(65)) input.dir -= 1;
        if (keyIsDown(RIGHT_ARROW) || keyIsDown(68)) input.dir += 1;
        if (keyIsDown(UP_ARROW) || keyIsDown(87) || keyIsDown(32)) input.jump = true;
        this.events.push(GameEvent.playerInput(input));
    }

    tickFrame(events) {
        for (const client in events) {
            for (const event of events[client]) {
                switch (event.type) {
                    case "playerConnect":
                        this.state.players[client] = {
                            pos: event.data.pos,
                            input: { dir: 0, jump: false },
                            color: event.data.color,
                            vel: { x: 0, y: 0 },
                            isGrounded: false,
                        };
                        break;

                    case "playerInput":
                        let player = this.state.players[client];
                        player.input = event.data.input;
                        break;

                    case "playerDisconnect":
                        delete this.state.players[client];
                        break;
                }
            }
        }

        const DT = 1 / APP_FPS;
        const GROUND_POS = 600;

        for (let id in this.state.players) {
            let player = this.state.players[id];

            if (player.input.jump) {
                if (player.isGrounded) player.vel.y = -500;
                player.input.jump = false;
            }

            if (player.input.dir != 0 && Math.abs(player.vel.x) < 350) {
                player.vel.x += DT * 8000 * player.input.dir;
            } else {
                const decel = Math.min(Math.abs(player.vel.x), DT * 8000);
                player.vel.x += -decel * Math.sign(player.vel.x);
                if (Math.abs(player.vel.x) < 10) player.vel.x = 0;
            }

            if (!player.isGrounded) player.vel.y += DT * 2000;

            player.pos.x += player.vel.x * DT;
            player.pos.y += player.vel.y * DT;

            player.isGrounded = player.pos.y == GROUND_POS;
            if (player.pos.y > GROUND_POS) {
                player.pos.y = GROUND_POS;
                player.isGrounded = true;
                player.vel.y = 0;
            }
        }
    }

    render() {
        if (!this.client) return;

        noStroke();
        for (let id in this.state.players) {
            let player = this.state.players[id];
            fill(player.color.r, player.color.g, player.color.b);
            ellipse(player.pos.x, player.pos.y, 30);
        }

        fill(255);
        const syncFPS = 1000 / this.client.syncDT.getAverage();
        text("Sync FPS: " + syncFPS.toFixed(2), 10, 20);
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
