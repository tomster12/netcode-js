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
        this.current = now - this.lastTimestamp;
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

    for (let event of gameState.events) {
        switch (event.type) {
            case "addPlayer":
                gameState.data.players[event.data.id] = {
                    pos: { x: 0, y: 0 },
                    color: event.data.color,
                };
                break;

            case "movePlayer":
                if (!gameState.data.players[event.data.id]) return;
                gameState.data.players[event.data.id].pos = event.data.pos;
                break;
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
