import { IGameState, GameEvent } from "./networking";
import { copyObject } from "./utils";

export type PlayerInput = { dir: number; jump: boolean };
export type PlayerPos = { x: number; y: number };
export type Color = { r: number; g: number; b: number };
export type PlayerData = { pos: PlayerPos; input: PlayerInput; color: Color; vel: PlayerPos; isGrounded: boolean };

export class GameEventUtils {
    static playerConnect(socketID: string, pos: PlayerPos, color: Color): GameEvent {
        return { type: "playerConnect", socketID, data: { pos, color, input: { dir: 0, jump: false }, vel: { x: 0, y: 0 }, isGrounded: false } };
    }

    static playerDisconnect(socketID: string): GameEvent {
        return { type: "playerDisconnect", socketID };
    }

    static playerInput(socketID: string, input: PlayerInput): GameEvent {
        return { type: "playerInput", socketID, data: { input } };
    }
}

export class GameState implements IGameState {
    players: { [socketID: string]: PlayerData };

    constructor() {
        this.players = {};
    }

    reset(): void {
        this.players = {};
    }

    set(state: GameState): void {
        this.players = state.players;
    }

    update(events: GameEvent[]): void {
        events = copyObject(events);

        for (const event of events) {
            switch (event.type) {
                case "playerConnect":
                    this.players[event.socketID] = event.data as PlayerData;
                    break;
                case "playerDisconnect":
                    delete this.players[event.socketID];
                    break;
                case "playerInput":
                    this.players[event.socketID].input = event.data!.input as PlayerInput;
                    break;
            }
        }

        const DT = 1 / 60;
        const GROUND_POS = 600;

        for (let socketID in this.players) {
            let player = this.players[socketID];

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

    serialize(): string {
        return JSON.stringify(this);
    }

    deserialize(data: string): void {
        Object.assign(this, JSON.parse(data));
    }
}
