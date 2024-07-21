const SET_FRAMERATE = 60;

let globals = {};

function setup() {
    createCanvas(500, 800);
    noSmooth();
    frameRate(SET_FRAMERATE);
    globals.app = new App();
}

function draw() {
    background(0);
    globals.app.update();
}

// --------------------------------------------------------------------------------

class App {
    socket;
    gameState;
    game;

    constructor() {
        this.socket = io();
        this.gameState = new GameState(this.socket);
        this.game = new Game(this.gameState);
    }

    update() {
        this.deltaTime = 1 / frameRate();
        this.game.update();
        this.game.render();
        this.gameState.sendEvents();
    }
}

class GameState {
    socket;
    state;

    constructor(socket) {
        this.socket = socket;
        this.state = {
            events: [],
            players: {},
        };
        this.socket.on("syncState", onSyncState);
    }

    sendEvents() {
        if (this.state.events.length === 0) return;
        this.socket.emit("events", this.state.events);
        this.state.events = [];
    }

    onSyncState(data) {
        this.state = data;
    }
}

class Game {
    gameState;
    player;

    constructor(gameState) {
        this.gameState = gameState;
        this.player = new Player(this);
    }

    update() {
        this.player.update();
        this.simulateState();
    }

    simulateState() {}

    render() {}
}

class Player {
    constructor(game) {
        this.game = game;

        // Add new player event
        this.game.gameState.state.events.push({
            type: "addPlayer",
            data: { id: this.game.gameState.socket.id },
        });
    }

    update() {
        // Get mouse position
        let mousePos = { x: mouseX, y: mouseY };

        // Add move event
        this.game.gameState.state.events.push({
            type: "move",
            data: { id: this.game.gameState.socket.id, pos: mousePos },
        });
    }
}

/*
class World {
    static GRID_SIZE = 35;
    game;
    tiles;
    drawSettings;
    worldGridSize;

    constructor(game, drawSettings) {
        this.game = game;
        this.tiles = [];
        this.drawSettings = drawSettings;
        this.worldGridSize = { x: 10, y: 20 };
    }

    update() {}

    draw() {
        noFill();
        stroke(255);
        rect(
            this.drawSettings.centreX - (this.worldGridSize.x * World.GRID_SIZE) / 2,
            this.drawSettings.centreY - (this.worldGridSize.y * World.GRID_SIZE) / 2,
            this.worldGridSize.x * World.GRID_SIZE,
            this.worldGridSize.y * World.GRID_SIZE
        );
    }

    gridToWorld(pos) {
        return {
            x: this.drawSettings.centreX - (this.worldGridSize.x * World.GRID_SIZE) / 2 + pos.x * World.GRID_SIZE,
            y: this.drawSettings.centreY + (this.worldGridSize.y * World.GRID_SIZE) / 2 - pos.y * World.GRID_SIZE,
        };
    }
}

class Player {
    static SIZE = { x: 20, y: 20 };
    static MOVEMENT_DRAG = 0.75;
    static MOVEMENT_SPEED = 2;
    game;
    gridPos;
    moveVel;
    collider;

    constructor(game) {
        this.game = game;
        this.gridPos = { x: 0, y: 0 };
        this.moveVel = { x: 0, y: 0 };
    }

    update() {
        let inputMovement = { x: 0, y: 0 };
        let inputJump = false;
        if (keyIsDown(LEFT_ARROW) || keyIsDown(65)) inputMovement.x -= 1;
        if (keyIsDown(RIGHT_ARROW) || keyIsDown(68)) inputMovement.x += 1;
        if (keyIsDown(UP_ARROW) || keyIsDown(32)) inputJump = true;

        this.moveVel.x = Utility.lerp(this.moveVel.x, inputMovement.x * Player.MOVEMENT_SPEED, this.game.deltaTime);
        this.moveVel.y = Utility.lerp(this.moveVel.y, inputMovement.y * Player.MOVEMENT_SPEED, this.game.deltaTime);
        this.gridPos.x += this.moveVel.x;
        this.gridPos.y += this.moveVel.y;
        this.moveVel.x *= Player.MOVEMENT_DRAG;
        this.moveVel.y *= Player.MOVEMENT_DRAG;

        // this.game.world.applyPhysics(this);
    }

    draw() {
        let worldPos = this.game.world.gridToWorld(this.gridPos);
        fill(255);
        rect(worldPos.x, worldPos.y - Player.SIZE.y, Player.SIZE.x, Player.SIZE.y);
    }
}

class Utility {
    static lerp(a, b, t) {
        return a + (b - a) * t;
    }
}

*/
