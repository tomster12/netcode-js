class ListenBus {
    constructor() {
        this.listeners = {};
    }

    on(event, listener) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(listener);
    }

    off(event, listener) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter((l) => l != listener);
    }

    emit(event, data) {
        if (!this.listeners[event]) return;
        for (let listener of this.listeners[event]) {
            listener(data);
        }
    }
}

class Constants {
    static GROUND_POS = 650;
    static PLAYER_SIZE = 50;
}

class GameEvents {
    static newPlayerAddEvent(id, pos, color) {
        return {
            type: "playerAdd",
            data: { id, pos, color },
        };
    }
}

class GameState {
    static initState() {
        return {
            stateTime: Date.now(),
            players: {},
        };
    }

    static reconcileState(localState, remoteState) {
        return remoteState;
    }

    static updateState(state, events) {
        const dt = (Date.now() - state.worldTime) / 1000;
        state.worldTime = Date.now();

        // Consider receiving multiple movement input events from 1 player:
        // - Input, Input, Stop, Stop, Stop
        // This is not handled properly here however needs to be.

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

    static cleanSocketFromState(state, socketID) {
        if (state.players[socketID]) {
            delete state.players[socketID];
        }
    }
}

// ----------------- Agnostic module export -----------------

if (typeof window !== "undefined") {
    window.Constants = Constants;
    window.ListenBus = ListenBus;
    window.GameEvents = GameEvents;
    window.GameState = GameState;
}

export { Constants, ListenBus, GameEvents, GameState };
