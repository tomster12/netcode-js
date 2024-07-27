import p5 from "p5";
import io, { Socket } from "socket.io-client";
import { IGameState, GameEvent, Lockstep } from "./networking.mts";
import { copyObject } from "./utils.mts";

type PlayerInput = { dir: number; jump: boolean };
type PlayerPos = { x: number; y: number };
type Color = { r: number; g: number; b: number };
type PlayerData = { pos: PlayerPos; input: PlayerInput; color: Color; vel: PlayerPos; isGrounded: boolean };

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

class Game {
    static GAME_FPS = 60;

    p5: p5;
    socket: Socket;
    state: GameState;
    events: GameEvent[];
    client: Lockstep.Client;

    constructor(p5: p5) {
        this.p5 = p5;
        this.p5.setup = this.setup.bind(this);
        this.p5.draw = this.draw.bind(this);

        this.socket = io();
        this.state = new GameState();
        this.events = [];
        this.client = new Lockstep.Client(this.socket, this.state);
    }

    setup() {
        this.p5.createCanvas(800, 800);
        this.p5.noSmooth();
        this.p5.frameRate(Game.GAME_FPS);
        this.p5.textFont("monospace");
    }

    draw() {
        this.p5.background(0);

        if (this.socket.connected && this.client.connected) {
            this.generateEvents();
            this.state.update(this.events);
            this.client.tickFrame(this.events);
        }

        this.render();
    }

    generateEvents() {
        if (!this.socket.connected || !this.client.connected) return;

        this.events = [];

        if (!this.state.players[this.socket.id!]) {
            this.events.push({ socketID: this.socket.id!, type: "playerConnect", data: { pos: { x: 400, y: 600 }, color: { r: 255, g: 255, b: 255 } } });
        } else {
            let input = { dir: 0, jump: false };
            if (this.p5.keyIsDown(this.p5.LEFT_ARROW) || this.p5.keyIsDown(65)) input.dir -= 1;
            if (this.p5.keyIsDown(this.p5.RIGHT_ARROW) || this.p5.keyIsDown(68)) input.dir += 1;
            if (this.p5.keyIsDown(this.p5.UP_ARROW) || this.p5.keyIsDown(87) || this.p5.keyIsDown(32)) input.jump = true;
            this.events.push({ socketID: this.socket.id!, type: "playerInput", data: { input } });
        }
    }

    render() {
        this.p5.background(0);

        if (!this.socket.connected || !this.client.connected) {
            this.p5.fill(255);
            this.p5.text("Connecting...", 10, 10);
            return;
        }

        this.p5.noStroke();
        for (let id in this.state.players) {
            let player = this.state.players[id];
            this.p5.fill(player.color.r, player.color.g, player.color.b);
            this.p5.ellipse(player.pos.x, player.pos.y, 30);
        }
    }
}

new p5((sketch: p5) => new Game(sketch));
