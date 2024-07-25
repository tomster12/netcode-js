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
