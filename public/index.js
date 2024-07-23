const APP_FPS = 60;

let globals = {};

class App {
    isConnected;
    eventBus;
    socket;
    game;

    constructor() {
        this.isConnected = false;
        this.eventBus = new EventBus();
        this.socket = io();
        this.game = new Game(this);

        console.log("Connecting to server...");
        this.socket.on("connect", () => {
            console.log("Socket Connected: " + this.socket.id);
            this.isConnected = true;
            this.eventBus.emit("connect", this.socket);

            this.socket.on("disconnect", () => {
                console.log("Socket Disconnected");
                this.isConnected = false;
                this.eventBus.emit("disconnect", this.socket);
            });
        });
    }

    draw() {
        this.game.draw();
    }
}

class GameEvent {
    static playerConnect(pos, color) {
        return { type: "playerConnect", data: { pos, color } };
    }

    static playerInputChange(inputDir, inputJump) {
        return { type: "playerInputChange", data: { inputDir, inputJump } };
    }
}

class Game {
    app;
    state;
    client;
    toUpdate;
    syncTimer;

    constructor(app) {
        this.app = app;

        this.app.eventBus.on("connect", () => {
            this.state = { players: {} };
            this.client = new LockstepClient(this.app.socket);
            this.toUpdate = false;
            this.syncTimer = new DT();

            this.client.eventBus.on("initFrame", (clientEventHistory) => {
                for (const clientEvents of clientEventHistory) this.updateState(clientEvents);
                this.toUpdate = true;
                this.syncTimer.reset();
            });

            this.client.eventBus.on("syncFrame", (clientEvents) => {
                this.updateState(clientEvents);
                this.toUpdate = true;
                this.syncTimer.set();
            });
        });

        this.app.eventBus.on("disconnect", () => {
            this.state = { players: {} };
            this.client = null;
            this.toUpdate = false;
        });
    }

    updateState(clientEvents) {
        for (const client in clientEvents) {
            for (const event of clientEvents[client]) {
                switch (event.type) {
                    case "playerConnect":
                        this.state.players[client] = {
                            pos: event.data.pos,
                            inputDir: 0,
                            inputJump: false,
                            color: event.data.color,
                            vel: { x: 0, y: 0 },
                            isGrounded: false,
                        };
                        break;

                    case "playerInputChange":
                        let player = this.state.players[client];
                        player.inputDir = event.data.inputDir;
                        player.inputJump = event.data.inputJump;
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

            if (player.inputJump) {
                if (player.isGrounded) player.vel.y = -500;
                player.inputJump = false;
            }

            if (player.inputDir != 0 && Math.abs(player.vel.x) < 350) {
                player.vel.x += DT * 8000 * player.inputDir;
            } else {
                const decel = Math.min(Math.abs(player.vel.x), DT * 8000);
                player.vel.x += -decel * Math.sign(player.vel.x);
                if (Math.abs(player.vel.x) < 10) player.vel.x = 0;
            }

            if (!player.isGrounded) {
                player.vel.y += DT * 2000;
            }

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

    draw() {
        if (this.toUpdate) {
            this.handleEvents();
            this.client.sendEvents();
            this.toUpdate = false;
        }

        this.render();
    }

    handleEvents() {
        if (!this.state.players[this.app.socket.id]) {
            const pos = { x: 100, y: 100 };
            const color = { r: Math.floor(Math.random() * 255), g: Math.floor(Math.random() * 255), b: Math.floor(Math.random() * 255) };
            this.client.addEvent(GameEvent.playerConnect(pos, color));
            return;
        }

        let inputDir = 0;
        let inputJump = false;
        if (keyIsDown(LEFT_ARROW) || keyIsDown(65)) inputDir -= 1;
        if (keyIsDown(RIGHT_ARROW) || keyIsDown(68)) inputDir += 1;
        if (keyIsDown(UP_ARROW) || keyIsDown(87) || keyIsDown(32)) inputJump = true;
        this.client.addEvent(GameEvent.playerInputChange(inputDir, inputJump));
    }

    render() {
        if (!this.state) return;

        background(0);

        noStroke();
        for (let id in this.state.players) {
            let player = this.state.players[id];
            fill(player.color.r, player.color.g, player.color.b);
            ellipse(player.pos.x, player.pos.y, 30);
        }

        fill(255);
        const syncFPS = 1000 / this.syncTimer.getAverage();
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
