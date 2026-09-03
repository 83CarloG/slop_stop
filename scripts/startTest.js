"use strict";

const path = require("path");
const process = require("process");

process.env.APP_HOST = "127.0.0.1";
process.env.APP_PORT = "3001";
process.env.EVENT_STORE_PATH = path.join(".data", "test", "events.jsonl");

require(path.resolve(process.cwd(), "server", "start.js"));
