import type { ErrorRequestHandler, RequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { HttpError } from "../lib/http-error.js";

export const notFound: RequestHandler = (_req, _res, next) => {
  next(new HttpError(404, "Endpoint tidak ditemukan"));
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.statusCode).json({ status: false, message: error.message });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      res.status(409).json({ status: false, message: "Data sudah digunakan" });
      return;
    }

    if (error.code === "P2025") {
      res.status(404).json({ status: false, message: "Data tidak ditemukan" });
      return;
    }
  }

  if (
    error instanceof SyntaxError &&
    "status" in error &&
    error.status === 400
  ) {
    res.status(400).json({ status: false, message: "Format JSON tidak valid" });
    return;
  }

  console.error(error);
  res
    .status(500)
    .json({ status: false, message: "Terjadi kesalahan pada server" });
};
