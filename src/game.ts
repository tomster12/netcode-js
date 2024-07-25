class GameEventUtil {
    static newPlayerConnectEvent(clientID) {
        const pos = { x: 100, y: 100 };
        const color = { r: Math.floor(Math.random() * 255), g: Math.floor(Math.random() * 255), b: Math.floor(Math.random() * 255) };
        return { clientID, type: "playerConnect", data: { pos, color } };
    }

    static newPlayerInputEvent(clientID, input) {
        return { clientID, type: "playerInput", data: { input } };
    }

    static newPlayerDisconnectEvent(clientID) {
        return { clientID, type: "playerDisconnect" };
    }
}

class GameStateUtil {
    static initState() {
        return { players: {} };
    }

    static updateState(state, events) {
        events = copyObject(events);

        for (const event of events) {
            switch (event.type) {
                case "playerConnect":
                    state.players[event.clientID] = {
                        pos: event.data.pos,
                        input: { dir: 0, jump: false },
                        color: event.data.color,
                        vel: { x: 0, y: 0 },
                        isGrounded: false,
                    };
                    break;

                case "playerInput":
                    let player = state.players[event.clientID];
                    player.input.dir = event.data.input.dir;
                    player.input.jump = event.data.input.jump;
                    break;

                case "playerDisconnect":
                    delete state.players[event.clientID];
                    break;
            }
        }

        const DT = 1 / 60;
        const GROUND_POS = 600;

        for (let clientID in state.players) {
            let player = state.players[clientID];

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
}

// ----------------- Agnostic module export -----------------

if (typeof window !== "undefined") {
    window.GameEventUtil = GameEventUtil;
    window.GameStateUtil = GameStateUtil;
}

export { GameEventUtil, GameStateUtil };
