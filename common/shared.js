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
    eventBus;
    syncDT;
    frame;
    canUpdate;

    constructor(socket, tickFrame) {
        this.socket = socket;
        this.tickFrame = tickFrame;
        this.eventBus = new EventBus();
        this.syncDT = new DT();
        this.frame = 0;
        this.canUpdate = false;

        this.socket.on("frameEventHistory", (data) => {
            this.frame = data.frame;
            this.syncDT.reset();
            for (const events of data.frameEventHistory) this.tickFrame(events);
            this.canUpdate = true;
        });

        this.socket.on("serverFrameEvents", ({ frame, events }) => {
            this.syncDT.set();
            this.frame = frame;
            this.tickFrame(events);
            this.canUpdate = true;
        });
    }

    finishFrame(events) {
        this.socket.emit("clientFrameEvents", { frame: this.frame, events: events });
        this.canUpdate = false;
    }
}

class LockstepServer {
    socketServer;
    connectedClients;
    frame;
    frameEvents;
    frameEventHistory;

    constructor(socketServer) {
        this.socketServer = socketServer;
        this.connectedClients = [];
        this.frame = 0;
        this.frameEvents = {};
        this.frameEventHistory = [];

        this.socketServer.on("connection", (socket) => {
            console.log(`Client connected: ${socket.id}`);
            this.connectedClients.push(socket);

            socket.emit("frameEventHistory", {
                frame: this.frame,
                frameEventHistory: this.frameEventHistory,
            });

            socket.on("clientFrameEvents", (data) => {
                if (data.frame != this.frame) console.warn(`Out of sync frame: ${data.frame} != ${this.frame}`);
                if (this.frameEvents[socket.id]) console.error(`Already received events for client: ${socket.id}`);
                this.frameEvents[socket.id] = data.events;
                this.tryTick();
            });

            socket.on("disconnect", () => {
                console.log(`Client disconnected: ${socket.id}`);
                this.connectedClients = this.connectedClients.filter((client) => client != socket);
                this.frameEvents[socket.id] = [{ type: "playerDisconnect" }];
                this.tryTick();
            });
        });
    }

    tryTick() {
        if (!this.connectedClients.every((client) => this.frameEvents[client.id])) return;

        this.frame += 1;
        const data = { frame: this.frame, events: this.frameEvents };
        this.connectedClients.forEach((client) => {
            client.emit("serverFrameEvents", data);
        });

        this.frameEventHistory.push(this.frameEvents);
        this.frameEvents = {};
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
