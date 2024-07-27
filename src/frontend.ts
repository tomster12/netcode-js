import p5 from "p5";
import io, { Socket } from "socket.io-client";
import { GameState, GameEventUtils } from "./game";
import { GameEvent, Lockstep } from "./networking";

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
            this.events.push(GameEventUtils.playerConnect(this.socket.id!, { x: 400, y: 400 }, { r: 255, g: 255, b: 255 }));
        } else {
            let input = { dir: 0, jump: false };
            if (this.p5.keyIsDown(this.p5.LEFT_ARROW) || this.p5.keyIsDown(65)) input.dir -= 1;
            if (this.p5.keyIsDown(this.p5.RIGHT_ARROW) || this.p5.keyIsDown(68)) input.dir += 1;
            if (this.p5.keyIsDown(this.p5.UP_ARROW) || this.p5.keyIsDown(87) || this.p5.keyIsDown(32)) input.jump = true;
            this.events.push(GameEventUtils.playerInput(this.socket.id!, input));
        }
    }

    render() {
        this.p5.background(0);

        if (!this.socket.connected || !this.client.connected) {
            this.p5.fill(255);
            this.p5.textAlign(this.p5.CENTER, this.p5.CENTER);
            this.p5.text("Connecting...", this.p5.width / 2, this.p5.height / 2);
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
