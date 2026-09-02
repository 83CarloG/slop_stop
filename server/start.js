"use strict";

const path = require("path");
const process = require("process");

const getApplicationConfig = require(path.resolve(process.cwd(), "config", "application.js"));
const createApp = require(path.resolve(process.cwd(), "server", "app.js"));

async function start() {
    const config = getApplicationConfig();
    const app = createApp();

    try {
        const address = await app.listen({
            host: config.appHost,
            port: config.appPort
        });
        process.stdout.write(`Slop Stop is listening at ${address}\n`);
    } catch (error) {
        process.stderr.write("Slop Stop could not start.\n");
        process.exitCode = 1;
    }
}

start();

