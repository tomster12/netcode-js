class DT {
    lastTimestamp;
    current;
    last10;

    constructor() {
        this.lastTimestamp = 0;
        this.current = null;
        this.last10 = [];
    }

    update() {
        let now = Date.now();
        this.current = (now - this.lastTimestamp) / 1000;
        this.lastTimestamp = now;
        this.last10.push(this.current);
        if (this.last10.length > 10) this.last10.shift();
    }
}

function initGameState(gameState) {
    gameState.data = {
        worldTime: 0,
        players: {},
    };
    gameState.events = [];
}

function updateGameState(dt, gameState) {
    gameState.data.worldTime += dt;

    // Consider receiving multiple movement input events from 1 player:
    // - Input, Input, Stop, Stop, Stop
    // This is not handled properly here however needs to be.

    for (let event of gameState.events) {
        switch (event.type) {
            case "playerAdd":
                gameState.data.players[event.data.id] = {
                    pos: event.data.pos,
                    inputDir: 0,
                    inputJump: false,
                    color: event.data.color,
                    vel: { x: 0, y: 0 },
                };
                break;

            case "playerInput":
                if (!gameState.data.players[event.data.id]) return;
                let player = gameState.data.players[event.data.id];
                player.inputDir = event.data.inputDir;
                player.inputJump = event.data.inputJump;
                break;
        }
    }

    // Update player physics
    for (let id in gameState.data.players) {
        let player = gameState.data.players[id];

        // Jump player if on ground
        if (player.inputJump) {
            if (player.pos.y >= 650) player.vel.y = -500;
            player.inputJump = false;
        }

        // Accelerate player towards inputDir
        if (player.inputDir != 0 && Math.abs(player.vel.x) < 350) {
            player.vel.x += dt * 8000 * player.inputDir;
        }

        // Decelerate player if not moving or over max speed
        else {
            player.vel.x += dt * 8000 * -Math.sign(player.vel.x);
            if (Math.abs(player.vel.x) < 10) player.vel.x = 0;
        }

        // Apply gravity
        player.vel.y += dt * 2000;

        // Apply velocity to position
        player.pos.x += player.vel.x * dt;
        player.pos.y += player.vel.y * dt;

        // Collision with ground
        if (player.pos.y > 650) {
            player.pos.y = 650;
            player.vel.y = 0;
        }
    }
}

function cleanGameStateFromSocket(gameState, socketID) {
    console.log("Cleaning data for socket: ", socketID);
    if (gameState.data.players[socketID]) {
        delete gameState.data.players[socketID];
    }
}

// ----------------- Agnostic module export -----------------

if (typeof window !== "undefined") {
    window.DT = DT;
    window.initGameState = initGameState;
    window.updateGameState = updateGameState;
    window.cleanGameStateFromSocket = cleanGameStateFromSocket;
}

export { DT, initGameState, updateGameState, cleanGameStateFromSocket };
