import path from "path";

export default {
    mode: "development",
    watch: true,
    entry: "./src/index.ts",
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: "ts-loader",
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: [".ts", ".js"],
    },
    output: {
        filename: "index.js",
        path: path.resolve("public"),
        libraryTarget: "module",
    },
    experiments: {
        outputModule: true,
    },
};
