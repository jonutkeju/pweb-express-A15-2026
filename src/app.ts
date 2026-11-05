import express from "express";
import apiRouter from "./routes/api.js";
import { errorHandler, notFound } from "./middleware/errors.js";

export const app = express();

app.use((req, res, next) => {
  res.on("finish", () => {
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode}`);
  });
  next();
});

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: true, message: "Server berjalan dengan baik" });
});

app.use("/api", apiRouter);
app.use(notFound);
app.use(errorHandler);
