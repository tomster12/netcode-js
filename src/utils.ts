export function copyObject(obj: object) {
    return JSON.parse(JSON.stringify(obj));
}

export class DTClock {
    time: number;
    dt: number;
    dtHistory: number[];

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

export class EventBus {
    listeners: { [key: string]: Function[] };

    constructor() {
        this.listeners = {};
    }

    on(event: string, listener: Function) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(listener);
    }

    off(event: string, listener: Function) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter((l) => l != listener);
    }

    emit(event: string, data: any) {
        if (!this.listeners[event]) return;
        for (let listener of this.listeners[event]) {
            listener(data);
        }
    }
}
