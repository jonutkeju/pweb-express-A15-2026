import express from "express";
import apiRouter from "./routes/api.js";

export const app = express();

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: true, message: "Server berjalan dengan baik" });
});

app.use("/api", apiRouter);
