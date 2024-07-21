import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const server = createServer(app);
const io = new Server(server);

app.use(express.static("public"));

io.on("connection", (socket) => {
    console.log("a user connected: " + socket.id);

    socket.on("message", (data) => {
        console.log(data);
        io.emit("message", data);
    });

    socket.on("disconnect", () => {
        console.log("user disconnected: " + socket.id);
    });
});

server.listen(3000, () => {
    console.log("listening on http://localhost:3000");
});

// --------------------------------------------------------------------------------

class GameState {
    socket;
    state;

    constructor(socket) {
        this.socket = socket;
        this.state = {};
        this.socket.on("syncState", (data) => {
            this.state = data;
        });
    }
}

class Game {
    gameState;
    player;

    constructor(gameState) {
        this.gameState = gameState;
    }

    update() {}
}
