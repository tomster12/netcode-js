import { Socket as IOClientSocketBase } from "socket.io-client";
import { Server as IOServerBase, Socket as IOServerSocketBase } from "socket.io";

export interface IGameState {
    reset(): void;
    set(state: IGameState): void;
    update(events: GameEvent[]): void;
    serialize(): string;
    deserialize(data: string): void;
}

export type GameEvent = {
    socketID: string;
    type: string;
    data?: any;
};

export interface PlayerDisconnectEvent extends GameEvent {
    type: "playerDisconnect";
}

export namespace Lockstep {
    interface ClientToServerEvents {
        clientInitialize: (data: { frame: number; state: string }) => void;
        serverFrame: (data: { frame: number; events: GameEvent[] }) => void;
    }

    interface ServerToClientEvents {
        clientFrame: (data: { frame: number; events: GameEvent[] }) => void;
    }

    type IOClientSocket = IOClientSocketBase<ClientToServerEvents, ServerToClientEvents>;
    type IOServerSocket = IOServerSocketBase<ServerToClientEvents, ClientToServerEvents>;
    type IOServer = IOServerBase<ServerToClientEvents, ClientToServerEvents>;

    export class Client {
        socket: IOClientSocket;
        state: IGameState;
        frame: number;
        canTick: boolean;
        connected: boolean;

        constructor(socket: IOClientSocket, state: IGameState) {
            this.socket = socket;
            this.state = state;
            this.frame = 0;
            this.canTick = false;
            this.connected = false;

            // Reset local state to match server state
            this.socket.on("clientInitialize", ({ frame, state }) => {
                this.state.deserialize(state);
                this.frame = frame;
                this.canTick = true;
                this.connected = true;
            });

            // Receive server frame events and update local state
            this.socket.on("serverFrame", ({ frame, events }) => {
                if (frame != this.frame) console.warn(`Client received out of sync frame: ${frame} != ${this.frame}`);
                this.state.update(events);
                this.frame = frame;
                this.canTick = true;
            });
        }

        tickFrame(events: GameEvent[]) {
            // Finish local frame and send events to server
            this.frame += 1;
            this.socket.emit("clientFrame", { frame: this.frame, events });
            this.canTick = false;
        }
    }

    export class Server {
        server: IOServer;
        clients: IOServerSocket[];
        state: IGameState;
        frame: number;
        events: { [key: string]: GameEvent[][] };

        constructor(server: IOServer, state: IGameState) {
            this.server = server;
            this.clients = [];
            this.frame = 0;
            this.state = state;
            this.events = {};

            this.server.on("connection", (socket) => {
                this.clients.push(socket);
                this.events[socket.id] = [];

                // Initialize client with current frame and state
                socket.emit("clientInitialize", {
                    frame: this.frame,
                    state: this.state.serialize(),
                });

                // Receive client frame events and store them
                socket.on("clientFrame", ({ frame, events }) => {
                    const expectedFrame = this.frame + 1 + this.events[socket.id].length;
                    if (frame != expectedFrame) console.warn(`Server received out of sync frame: ${frame} != ${expectedFrame}`);
                    this.events[socket.id].push(events);
                    this.tryTick();
                });

                // Add disconnect event to client events
                socket.on("disconnect", () => {
                    this.clients = this.clients.filter((client) => client != socket);
                    this.events[socket.id].push([{ socketID: socket.id, type: "playerDisconnect" }]);
                    this.tryTick();
                });
            });
        }

        tryTick() {
            // Find how many frames we have received from each client
            let availableFrames = this.clients.reduce((min, client) => Math.min(min, this.events[client.id].length), Infinity);
            while (availableFrames > 0) {
                // Accumulate all events from clients and server
                let events: GameEvent[] = [];
                for (let client of this.clients) events.push(...this.events[client.id].shift()!);
                this.state.update(events);

                // Send finalised events to all clients
                this.frame += 1;
                availableFrames -= 1;
                const frameData = { frame: this.frame, events };
                this.clients.forEach((client) => {
                    client.emit("serverFrame", frameData);
                });
            }
        }
    }
}

/*
export class RollbackClient {
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

        const playerPosString = Object.values(this.game.getState().players)
            .map((player) => `(${player.pos.x.toFixed(2)}, ${player.pos.y.toFixed(2)})`)
            .join(", ");
        console.log(`Client synced ${this.clientFrame}: ${playerPosString}`);
    }

    tickFrame(state, events) {
        // Serialize client state and events then send events to server
        this.clientFrame += 1;
        const frameData = { frame: this.clientFrame, state: copyObject(state), events };
        this.clientFrameQueue.push(frameData);
        this.socket.emit("clientFrame", frameData);
    }
}

export class RollbackServer {
    server;
    clients;
    frame;
    state;
    events;
    serverEvents;

    constructor(server) {
        this.server = server;
        this.clients = [];
        this.frame = 0;
        this.state = IGameStateUtil.initState();
        this.events = {};
        this.serverEvents = [];

        this.server.on("connection", (socket) => {
            this.clients.push(socket);
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
                this.clients = this.clients.filter((client) => client != socket);
                this.serverEvents.push(GameEventUtil.newPlayerDisconnectEvent(socket.id));
                this.tryTick();
            });
        });
    }

    tryTick() {
        if (this.clients.length == 0) return;

        // Find how many frames we have received from each client
        let availableFrames = this.clients.reduce((min, client) => Math.min(min, this.events[client.id].length), Infinity);
        while (availableFrames > 0) {
            let events = this.clients.reduce((events, client) => [...events, ...this.events[client.id].shift()], []);
            while (this.serverEvents.length > 0) events.push(this.serverEvents.shift());

            // Update server state with events
            IGameStateUtil.updateState(this.state, events);
            const playerPosString = Object.values(this.state.players)
                .map((player) => `(${player.pos.x.toFixed(2)}, ${player.pos.y.toFixed(2)})`)
                .join(", ");
            console.log(`Server update ${this.frame + 1}: ${playerPosString}`);

            // Send finalised events to all clients
            this.frame += 1;
            availableFrames -= 1;
            const frameData = { frame: this.frame, events };
            this.clients.forEach((client) => {
                client.emit("serverFrame", frameData);
            });
        }
    }
}
*/
