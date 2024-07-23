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

class LockstepClient {
    socket;
    events;
    frame;

    constructor(socket) {
        this.socket = socket;
        this.eventBus = new EventBus();
        this.events = [];
        this.frame = 0;

        this.socket.on("initFrame", (data) => {
            this.frame = data.frame;
            this.eventBus.emit("initFrame", data.clientEventHistory);
        });

        this.socket.on("syncFrame", (data) => {
            this.frame = data.frame;
            this.eventBus.emit("syncFrame", data.clientEvents);
        });
    }

    addEvent(event) {
        this.events.push(event);
    }

    sendEvents() {
        this.socket.emit("syncEvents", { frame: this.frame, events: this.events });
        this.events = [];
    }
}

class LockstepServer {
    socketServer;
    connectedClients;
    currentFrame;
    currentClientEvents;
    clientEventHistory;

    constructor(socketServer) {
        this.socketServer = socketServer;
        this.connectedClients = [];
        this.currentFrame = 0;
        this.currentClientEvents = {};
        this.clientEventHistory = [];

        this.socketServer.on("connection", (socket) => {
            console.log(`Client connected: ${socket.id}`);
            this.connectedClients.push(socket);

            socket.emit("initFrame", {
                frame: this.currentFrame,
                clientEventHistory: this.clientEventHistory,
            });

            socket.on("syncEvents", (data) => {
                if (data.frame != this.currentFrame) console.warn(`Out of sync frame: ${data.frame} != ${this.currentFrame}`);
                if (this.currentClientEvents[socket.id]) console.error(`Already received events for client: ${socket.id}`);
                this.currentClientEvents[socket.id] = data.events;
                this.nextFrame();
            });

            socket.on("disconnect", () => {
                console.log(`Client disconnected: ${socket.id}`);
                this.connectedClients = this.connectedClients.filter((client) => client != socket);
                this.currentClientEvents[socket.id] = [{ type: "playerDisconnect" }];
                this.nextFrame();
            });
        });
    }

    nextFrame() {
        const finished = this.connectedClients.every((client) => this.currentClientEvents[client.id]);
        if (!finished) return;

        this.currentFrame += 1;
        const data = { frame: this.currentFrame, clientEvents: this.currentClientEvents };
        this.connectedClients.forEach((client) => {
            client.emit("syncFrame", data);
        });

        this.clientEventHistory.push(this.currentClientEvents);
        this.currentClientEvents = {};
    }
}

// ----------------- Agnostic module export -----------------

if (typeof window !== "undefined") {
    window.DT = DT;
    window.EventBus = EventBus;
    window.LockstepClient = LockstepClient;
    window.LockstepServer = LockstepServer;
}

export { DT, EventBus, LockstepClient, LockstepServer };
