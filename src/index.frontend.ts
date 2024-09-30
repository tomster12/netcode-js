import p5 from "p5";
import { Game } from "./game";

new p5((sketch: p5) => new Game(sketch));
