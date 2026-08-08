import streamDeck from "@elgato/streamdeck";
import { ConnectionManager } from "./connection/connection-manager.js";
import { MetricDisplayAction } from "./actions/metric-display.js";

const connections = new ConnectionManager();
streamDeck.actions.registerAction(new MetricDisplayAction(connections));
streamDeck.system.onSystemDidWakeUp(() => connections.reconnectAll());
streamDeck.connect();
