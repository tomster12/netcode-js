class DT {
    constructor() {
        this.time = Date.now();
        this.dt = 0;
        this.dtHistory = [];
    }

    reset() {
        this.time = Date.now();
        this.dt = 0;
        this.dtHistory = [];
    }

    set() {
        const now = Date.now();
        this.dt = now - this.time;
        this.time = now;
        this.dtHistory.push(this.dt);
        if (this.dtHistory.length > 50) this.dtHistory.shift();
    }

    getAverage() {
        if (this.dtHistory.length == 0) return 0;
        return this.dtHistory.reduce((a, b) => a + b, 0) / this.dtHistory.length;
    }

    getLast() {
        return this.dt;
    }
}

class EventBus {
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

class GameEventUtil {
    static newPlayerConnectEvent() {
        const pos = { x: 100, y: 100 };
        const color = { r: Math.floor(Math.random() * 255), g: Math.floor(Math.random() * 255), b: Math.floor(Math.random() * 255) };
        return { type: "playerConnect", data: { pos, color } };
    }

    static newPlayerInputEvent(input) {
        return { type: "playerInput", data: { input } };
    }

    static newPlayerDisconnectEvent() {
        return { type: "playerDisconnect" };
    }
}

class GameStateUtil {
    static initState() {
        return { players: {} };
    }

    static updateState(state, clientEvents) {
        for (const client in clientEvents) {
            for (const event of clientEvents[client]) {
                switch (event.type) {
                    case "playerConnect":
                        state.players[client] = {
                            pos: event.data.pos,
                            input: { dir: 0, jump: false },
                            color: event.data.color,
                            vel: { x: 0, y: 0 },
                            isGrounded: false,
                        };
                        break;

                    case "playerInput":
                        let player = state.players[client];
                        player.input = event.data.input;
                        break;

                    case "playerDisconnect":
                        delete state.players[client];
                        break;
                }
            }
        }

        const DT = 1 / APP_FPS;
        const GROUND_POS = 600;

        for (let id in state.players) {
            let player = state.players[id];

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

class LockstepClient {
    socket;
    game;
    syncDT;
    frame;
    canTick;

    constructor(socket, game) {
        this.socket = socket;
        this.game = game;
        this.syncDT = new DT();
        this.frame = 0;
        this.canTick = false;

        this.socket.on("clientEventHistory", ({ frame, clientEventHistory }) => {
            this.game.resetState();
            for (const clientEvents of clientEventHistory) this.game.updateState(clientEvents);
            this.frame = frame;
            this.canTick = true;
            this.syncDT.reset();
        });

        this.socket.on("clientEvents", ({ frame, clientEvents }) => {
            if (frame != this.frame) console.warn(`Out of sync frame: ${frame} != ${this.frame}`);
            this.game.updateState(clientEvents);
            this.canTick = true;
            this.syncDT.set();
        });
    }

    tickFrame(events) {
        this.frame += 1;
        this.socket.emit("events", { frame: this.frame, events });
        this.canTick = false;
    }
}

class LockstepServer {
    socketServer;
    connectedClients;
    frame;
    clientEvents;
    clientEventHistory;

    constructor(socketServer) {
        this.socketServer = socketServer;
        this.connectedClients = [];
        this.frame = 0;
        this.clientEvents = {};
        this.clientEventHistory = [];

        this.socketServer.on("connection", (socket) => {
            console.log(`Client connected: ${socket.id}`);
            this.connectedClients.push(socket);

            socket.emit("clientEventHistory", {
                frame: this.frame,
                clientEventHistory: this.clientEventHistory,
            });

            socket.on("events", ({ frame, events }) => {
                if (frame != this.frame + 1) console.warn(`Out of sync frame: ${frame} != ${this.frame}`);
                if (this.clientEvents[socket.id]) console.error(`Already received events for client: ${socket.id}`);
                this.clientEvents[socket.id] = events;
                this.tryTick();
            });

            socket.on("disconnect", () => {
                console.log(`Client disconnected: ${socket.id}`);
                this.connectedClients = this.connectedClients.filter((client) => client != socket);
                if (!this.clientEvents[socket.id]) this.clientEvents[socket.id] = [];
                this.clientEvents[socket.id].push(GameEventUtil.newPlayerDisconnectEvent());
                this.tryTick();
            });
        });
    }

    tryTick() {
        if (!this.connectedClients.every((client) => this.clientEvents[client.id])) return;

        this.frame += 1;
        const data = { frame: this.frame, clientEvents: this.clientEvents };
        this.connectedClients.forEach((client) => {
            client.emit("clientEvents", data);
        });

        this.clientEventHistory.push(this.clientEvents);
        this.clientEvents = {};
    }
}

// ----------------- Agnostic module export -----------------

if (typeof window !== "undefined") {
    window.DT = DT;
    window.EventBus = EventBus;
    window.GameEventUtil = GameEventUtil;
    window.GameStateUtil = GameStateUtil;
    window.LockstepClient = LockstepClient;
    window.LockstepServer = LockstepServer;
}

export { DT, EventBus, GameEventUtil, GameStateUtil, LockstepClient, LockstepServer };
