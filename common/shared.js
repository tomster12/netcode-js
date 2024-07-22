class Constants {
    static GROUND_POS = 650;
    static PLAYER_SIZE = 50;
}

function initGameState() {
    return {
        worldTimeStart: Date.now(),
        worldTime: 0,
        players: {},
    };
}

function reconcileGameState(localState, serverState) {
    return serverState;
}

function updateGameState(state, events) {
    const newWorldTime = Date.now() - state.worldTimeStart;
    const dt = (newWorldTime - state.worldTime) / 1000;
    state.worldTime = newWorldTime;

    // Consider receiving multiple movement input events from 1 player:
    // - Input, Input, Stop, Stop, Stop
    // This is not handled properly here however needs to be.

    // Process events
    for (let event of events) {
        switch (event.type) {
            case "playerAdd":
                state.players[event.data.id] = {
                    pos: event.data.pos,
                    inputDir: 0,
                    inputJump: false,
                    color: event.data.color,
                    vel: { x: 0, y: 0 },
                    isGrounded: false,
                };
                break;

            case "playerInput":
                if (!state.players[event.data.id]) return;
                let player = state.players[event.data.id];
                player.inputDir = event.data.inputDir;
                player.inputJump = event.data.inputJump;
                break;
        }
    }

    // Update player physics
    for (let id in state.players) {
        let player = state.players[id];

        if (player.inputJump) {
            if (player.isGrounded) player.vel.y = -500;
            player.inputJump = false;
        }

        if (player.inputDir != 0 && Math.abs(player.vel.x) < 350) {
            player.vel.x += dt * 8000 * player.inputDir;
        } else {
            const decel = Math.min(Math.abs(player.vel.x), dt * 8000);
            player.vel.x += -decel * Math.sign(player.vel.x);
            if (Math.abs(player.vel.x) < 10) player.vel.x = 0;
        }

        if (!player.isGrounded) {
            player.vel.y += dt * 2000;
        }

        player.pos.x += player.vel.x * dt;
        player.pos.y += player.vel.y * dt;

        player.isGrounded = player.pos.y == Constants.GROUND_POS;
        if (player.pos.y > Constants.GROUND_POS) {
            player.pos.y = Constants.GROUND_POS;
            player.isGrounded = true;
            player.vel.y = 0;
        }
    }
}

function cleanSocketFromGameState(state, socketID) {
    if (state.players[socketID]) {
        delete state.players[socketID];
    }
}

// ----------------- Agnostic module export -----------------

if (typeof window !== "undefined") {
    window.Constants = Constants;
    window.initGameState = initGameState;
    window.reconcileGameState = reconcileGameState;
    window.updateGameState = updateGameState;
    window.cleanSocketFromGameState = cleanSocketFromGameState;
}

export { Constants, initGameState, reconcileGameState, updateGameState, cleanSocketFromGameState };
