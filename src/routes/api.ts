import { Lane, Prisma, Rarity, Role } from "@prisma/client";
import { Router } from "express";
import type { Request, Response } from "express";
import { HttpError } from "../lib/http-error.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

const roles = Object.values(Role);
const lanes = Object.values(Lane);
const rarities = Object.values(Rarity);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireBody(req: Request): Record<string, unknown> {
  if (!isRecord(req.body)) {
    throw new HttpError(400, "Body request tidak valid");
  }
  return req.body;
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `${label} wajib diisi`);
  }
  return value.trim();
}

function enumValue<T extends string>(
  value: unknown,
  values: readonly T[],
  label: string,
): T {
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new HttpError(400, `${label} tidak valid`);
  }
  return value as T;
}

function positiveInteger(value: unknown, label: string): number {
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new HttpError(400, `${label} harus bilangan bulat lebih dari 0`);
  }
  return parsed;
}

function optionalPrice(value: unknown, label: string): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new HttpError(400, `${label} harus bilangan bulat tidak negatif`);
  }
  return parsed;
}

function queryString(value: unknown, label: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    throw new HttpError(400, `Query ${label} tidak valid`);
  }
  return value;
}

function pagination(req: Request) {
  const pageValue = queryString(req.query.page, "page");
  const limitValue = queryString(req.query.limit, "limit");
  const page = pageValue === undefined ? 1 : positiveInteger(pageValue, "page");
  const limit = limitValue === undefined ? 10 : positiveInteger(limitValue, "limit");

  return { page, limit, skip: (page - 1) * limit };
}

function paginatedResponse(
  res: Response,
  message: string,
  data: unknown,
  page: number,
  limit: number,
  totalItems: number,
) {
  res.json({
    status: true,
    message,
    data,
    metadata: {
      currentPage: page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    },
  });
}

router.get("/heroes", async (req, res) => {
  const { page, limit, skip } = pagination(req);
  const search = queryString(req.query.search, "search");
  const roleQuery = queryString(req.query.role, "role");
  const role = roleQuery ? enumValue(roleQuery, roles, "role") : undefined;
  const where: Prisma.HeroWhereInput = {
    ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    ...(role ? { role } : {}),
  };

  const [data, totalItems] = await Promise.all([
    prisma.hero.findMany({
      where,
      skip,
      take: limit,
      orderBy: { id: "asc" },
    }),
    prisma.hero.count({ where }),
  ]);
  paginatedResponse(res, "Berhasil mengambil data hero", data, page, limit, totalItems);
});

router.get("/heroes/:hero_id", async (req, res) => {
  const id = positiveInteger(req.params.hero_id, "hero_id");
  const hero = await prisma.hero.findUnique({
    where: { id },
    include: { skins: true },
  });
  if (!hero) throw new HttpError(404, "Hero tidak ditemukan");
  res.json({ status: true, message: "Berhasil mengambil detail hero", data: hero });
});

router.post("/heroes", async (req, res) => {
  const body = requireBody(req);
  const name = requiredText(body.name, "name");
  const role = enumValue(body.role, roles, "role");
  const lane = enumValue(body.lane, lanes, "lane");
  const releaseYear = positiveInteger(body.releaseYear, "releaseYear");
  const priceBP = optionalPrice(body.priceBP, "priceBP");
  const priceDiamond = optionalPrice(body.priceDiamond, "priceDiamond");

  if (await prisma.hero.findUnique({ where: { name }, select: { id: true } })) {
    throw new HttpError(409, "Nama hero sudah digunakan");
  }

  const hero = await prisma.hero.create({
    data: { name, role, lane, releaseYear, priceBP, priceDiamond },
  });
  res
    .status(201)
    .json({ status: true, message: "Hero berhasil dibuat", data: hero });
});

router.get("/skins", async (req, res) => {
  const { page, limit, skip } = pagination(req);
  const heroIdValue = queryString(req.query.heroId, "heroId");
  const rarityValue = queryString(req.query.rarity, "rarity");
  const heroId =
    heroIdValue === undefined ? undefined : positiveInteger(heroIdValue, "heroId");
  const rarity = rarityValue
    ? enumValue(rarityValue, rarities, "rarity")
    : undefined;
  const where: Prisma.SkinWhereInput = {
    ...(heroId === undefined ? {} : { heroId }),
    ...(rarity ? { rarity } : {}),
  };

  const [data, totalItems] = await Promise.all([
    prisma.skin.findMany({
      where,
      skip,
      take: limit,
      orderBy: { id: "asc" },
      include: { hero: { select: { name: true } } },
    }),
    prisma.skin.count({ where }),
  ]);
  paginatedResponse(res, "Berhasil mengambil data skin", data, page, limit, totalItems);
});

router.get("/skins/:skin_id", async (req, res) => {
  const id = positiveInteger(req.params.skin_id, "skin_id");
  const skin = await prisma.skin.findUnique({
    where: { id },
    include: { hero: { select: { name: true } } },
  });
  if (!skin) throw new HttpError(404, "Skin tidak ditemukan");
  res.json({ status: true, message: "Berhasil mengambil detail skin", data: skin });
});

export default router;
