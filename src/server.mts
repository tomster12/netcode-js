import { createServer } from "http";
import { Server } from "socket.io";
import { Lockstep } from "./networking.mts";
import { GameState } from "./game.mts";

const http = createServer();
const io = new Server(http);
new Lockstep.Server(io, new GameState());

io.on("connection", (socket) => {
    console.log("a user connected");

    socket.on("disconnect", () => {
        console.log("user disconnected");
    });
});

http.listen(3001, () => {
    console.log("listening on *:3001");
});
