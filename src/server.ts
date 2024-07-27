// Express
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { Lockstep } from "./networking";
import { GameState } from "./game";

const app = express();
const http = createServer(app);
const io = new Server(http);
new Lockstep.Server(io, new GameState());

app.use(express.static("public"));

io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on("disconnect", () => {
        console.log(`Socket disconnected: ${socket.id}`);
    });
});

http.listen(3000, () => {
    console.log("listening on http://localhost:3000...");
});
