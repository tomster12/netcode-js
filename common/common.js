function copyObject(obj) {
    return JSON.parse(JSON.stringify(obj));
}

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

class LockstepClient {
    socket;
    game;
    frame;
    canTick;

    constructor(socket, game) {
        this.socket = socket;
        this.game = game;
        this.frame = 0;
        this.canTick = false;

        // Reset local state to match server state
        this.socket.on("clientInitialize", ({ frame, state }) => {
            this.frame = frame;
            this.game.setState(state);
            this.canTick = true;
        });

        // Receive server frame events and update local state
        this.socket.on("serverFrame", ({ frame, events }) => {
            if (frame != this.frame) console.warn(`Out of sync frame: ${frame} != ${this.frame}`);
            this.game.updateState(events);
            this.canTick = true;
        });
    }

    tickFrame(events) {
        // Finish local frame and send events to server
        this.frame += 1;
        this.socket.emit("clientFrame", { frame: this.frame, events });
        this.canTick = false;
    }
}

class LockstepServer {
    socketServer;
    connectedClients;
    frame;
    events;

    constructor(socketServer) {
        this.socketServer = socketServer;
        this.connectedClients = [];
        this.frame = 0;
        this.state = GameStateUtil.initState();
        this.events = {};

        this.socketServer.on("connection", (socket) => {
            this.connectedClients.push(socket);
            this.events[socket.id] = [];

            // Initialize client with current frame and state
            socket.emit("clientInitialize", {
                frame: this.frame,
                state: this.state,
            });

            // Receive client frame events and store them
            socket.on("clientFrame", ({ frame, events }) => {
                const expectedFrame = this.frame + 1 + this.events[socket.id].length;
                if (frame != expectedFrame) console.warn(`Out of sync frame: ${frame} != ${this.frame}`);
                this.events[socket.id].push(events);
                this.tryTick();
            });

            // Add disconnect event to client events
            socket.on("disconnect", () => {
                this.connectedClients = this.connectedClients.filter((client) => client != socket);
                this.events[socket.id].push(GameEventUtil.newPlayerDisconnectEvent(socket.id));
                this.tryTick();
            });
        });
    }

    tryTick() {
        // Find how many frames we have received from each client
        let availableFrames = this.connectedClients.reduce((min, client) => Math.min(min, this.events[client.id].length), Infinity);
        while (availableFrames > 0) {
            // Update server state with events
            let events = this.connectedClients.reduce((events, client) => [...events, ...this.events[client.id].shift()], []);
            GameStateUtil.updateState(this.state, events);

            // Send finalised events to all clients
            this.frame += 1;
            availableFrames -= 1;
            const frameData = { frame: this.frame, events };
            this.connectedClients.forEach((client) => {
                client.emit("serverFrame", frameData);
            });
        }
    }
}

class RollbackClient {
    socket;
    game;
    syncFrame;
    clientFrame;
    serverFrame;
    clientFrameQueue;
    serverFrameQueue;

    constructor(socket, game) {
        this.socket = socket;
        this.game = game;

        // Reset local state to match server state
        this.socket.on("clientInitialize", (frameData) => {
            this.syncFrame = frameData.frame;
            this.clientFrame = frameData.frame;
            this.serverFrame = frameData.frame;
            this.syncFrameData = frameData;
            this.clientFrameQueue = [];
            this.serverFrameQueue = [];
            this.game.setState(copyObject(this.syncFrameData.state));
        });

        // Receive server frame events then perform rollback sync
        this.socket.on("serverFrame", (frameData) => {
            if (frameData.frame != this.serverFrame + 1) console.warn(`Out of sync frame: ${frame} != ${this.serverFrame}`);
            this.serverFrame += 1;
            this.serverFrameQueue.push(frameData);
            this.syncFrames();
        });
    }

    syncFrames() {
        if (this.serverFrameQueue.length != this.serverFrame - this.syncFrame) {
            console.error(`Server frame queue out of sync: ${this.serverFrameQueue.length} != ${this.serverFrame} - ${this.syncFrame}`);
        }

        if (this.clientFrameQueue.length != this.clientFrame - this.syncFrame) {
            console.error(`Client frame queue out of sync: ${this.clientFrameQueue.length} != ${this.clientFrame} - ${this.syncFrame}`);
        }

        // Rollback to sync frame, replay server frames
        this.game.setState(copyObject(this.syncFrameData.state));

        for (let i = this.syncFrame + 1; i <= this.serverFrame; i++) {
            this.clientFrameQueue.shift();
            let frameData = this.serverFrameQueue.shift();
            this.game.updateState(frameData.events);
        }

        this.syncFrame = this.serverFrame;
        this.syncFrameData = { frame: this.syncFrame, state: copyObject(this.game.getState()) };

        // Reapply predicted client frames if required
        for (let i = 0; i < this.clientFrame - this.syncFrame; i++) {
            let frameData = this.clientFrameQueue[i];
            this.game.updateState(frameData.events);
        }
    }

    tickFrame(state, events) {
        // Serialize client state and events then send events to server
        this.clientFrame += 1;
        const frameData = { frame: this.clientFrame, state: copyObject(state), events };
        this.clientFrameQueue.push(frameData);
        this.socket.emit("clientFrame", frameData);
    }
}

class RollbackServer {
    socketServer;
    connectedClients;
    frame;
    state;
    events;
    serverEvents;

    constructor(socketServer) {
        this.socketServer = socketServer;
        this.connectedClients = [];
        this.frame = 0;
        this.state = GameStateUtil.initState();
        this.events = {};
        this.serverEvents = [];

        this.socketServer.on("connection", (socket) => {
            this.connectedClients.push(socket);
            this.events[socket.id] = [];

            // Initialize client with current frame and state
            socket.emit("clientInitialize", {
                frame: this.frame,
                state: this.state,
            });

            socket.on("clientFrame", ({ frame, events }) => {
                // Receive client frame events and store them
                const expectedFrame = this.frame + 1 + this.events[socket.id].length;
                if (frame != expectedFrame) console.warn(`Out of sync frame: ${frame} != ${expectedFrame}`);
                this.events[socket.id].push(events);
                this.tryTick();
            });

            socket.on("disconnect", () => {
                // Add disconnect event to client events
                this.connectedClients = this.connectedClients.filter((client) => client != socket);
                this.serverEvents.push(GameEventUtil.newPlayerDisconnectEvent(socket.id));
                this.tryTick();
            });
        });
    }

    tryTick() {
        if (this.connectedClients.length == 0) return;

        // Find how many frames we have received from each client
        let availableFrames = this.connectedClients.reduce((min, client) => Math.min(min, this.events[client.id].length), Infinity);
        while (availableFrames > 0) {
            let events = this.connectedClients.reduce((events, client) => [...events, ...this.events[client.id].shift()], []);
            while (this.serverEvents.length > 0) events.push(this.serverEvents.shift());

            // Update server state with events
            GameStateUtil.updateState(this.state, events);

            // Send finalised events to all clients
            this.frame += 1;
            availableFrames -= 1;
            const frameData = { frame: this.frame, events };
            this.connectedClients.forEach((client) => {
                client.emit("serverFrame", frameData);
            });
        }
    }
}

// ----------------- Agnostic module export -----------------

if (typeof window !== "undefined") {
    window.copyObject = copyObject;
    window.DT = DT;
    window.EventBus = EventBus;
    window.GameEventUtil = GameEventUtil;
    window.GameStateUtil = GameStateUtil;
    window.RollbackClient = RollbackClient;
    window.RollbackServer = RollbackServer;
    window.LockstepClient = LockstepClient;
    window.LockstepServer = LockstepServer;
}

export { copyObject, DT, EventBus, GameEventUtil, GameStateUtil, LockstepClient, LockstepServer, RollbackClient, RollbackServer };
