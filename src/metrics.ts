import express from "express";
import { Gauge, collectDefaultMetrics, register } from "prom-client";

collectDefaultMetrics({ register });

const startTime = new Date().getTime();
const _uptimeMs = new Gauge({
  name: "uptime_ms",
  help: "Number of milliseconds passed since server start",
  collect() {
    const curTime = new Date().getTime();
    this.set(curTime - startTime);
  },
});

export const metricsServer = express();

metricsServer.get("/metrics", async (req, res) => {
  try {
    res.set("Content-Type", register.contentType);
    res.end(await register.metrics());
  } catch (ex) {
    res.status(500).end(ex);
  }
});
