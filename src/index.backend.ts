import express from "express";
import { createServer } from "http";
import { Server as SIOServer } from "socket.io";
import { Lockstep } from "./networking";
import { GameState } from "./game";

const expressApp = express();
const httpServer = createServer(expressApp);
expressApp.use(express.static("public"));

const sioServer = new SIOServer(httpServer);
sioServer.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on("disconnect", () => {
        console.log(`Socket disconnected: ${socket.id}`);
    });
});

new Lockstep.Server(sioServer, new GameState());

httpServer.listen(3000, () => {
    console.log("listening on http://localhost:3000...");
});
