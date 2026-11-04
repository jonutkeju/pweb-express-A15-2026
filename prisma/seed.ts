import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Currency, Lane, PrismaClient, Rarity, Role } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL belum dikonfigurasi");
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString }),
});

interface HeroSeed {
  name: string;
  primaryRole: string;
  primaryLane: string;
  releaseYear: number;
  priceBP: number | null;
  priceDiamond: number | null;
}

interface SkinSeed {
  name: string;
  heroId: number;
  rarity: string;
  priceDiamond: number | null;
}

function enumValue<T extends string>(
  value: string,
  values: readonly T[],
  label: string,
): T {
  if (!values.includes(value as T)) {
    throw new Error(`${label} tidak dikenal: ${value}`);
  }
  return value as T;
}

async function main() {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "PlayerHero", "Player", "Skin", "Hero" RESTART IDENTITY CASCADE;',
  );

  const heroes = JSON.parse(
    await readFile(resolve(process.cwd(), "data/heroes.json"), "utf8"),
  ) as HeroSeed[];
  await prisma.hero.createMany({
    data: heroes.map(
      ({ name, primaryRole, primaryLane, releaseYear, priceBP, priceDiamond }) => ({
        name,
        role: enumValue(primaryRole, Object.values(Role), "Role"),
        lane: enumValue(primaryLane, Object.values(Lane), "Lane"),
        releaseYear,
        priceBP,
        priceDiamond,
      }),
    ),
  });

  const skins = JSON.parse(
    await readFile(resolve(process.cwd(), "data/skins.json"), "utf8"),
  ) as SkinSeed[];
  await prisma.skin.createMany({
    data: skins.map(({ name, heroId, rarity, priceDiamond }) => ({
      name,
      heroId,
      rarity: enumValue(rarity, Object.values(Rarity), "Rarity"),
      priceDiamond,
    })),
  });

  await prisma.player.createMany({
    data: [
      { id: 1, nickname: "ArekITS", bp: 1500, diamond: 75 },
      { id: 2, nickname: "SangPushRank", bp: 13000, diamond: 2892 },
      { id: 3, nickname: "MageSurabaya", bp: 10000, diamond: 0 },
    ],
  });
  await prisma.$queryRaw`
    SELECT setval(
      pg_get_serial_sequence('"Player"', 'id'),
      (SELECT MAX(id) FROM "Player")
    )
  `;
  await prisma.playerHero.createMany({
    data: [
      { playerId: 1, heroId: 18, currency: Currency.BP, pricePaid: 2000 },
      { playerId: 1, heroId: 1, currency: Currency.BP, pricePaid: 10800 },
      { playerId: 2, heroId: 84, currency: Currency.DIAMOND, pricePaid: 599 },
      { playerId: 2, heroId: 56, currency: Currency.BP, pricePaid: 32000 },
    ],
  });

  const [heroCount, skinCount, playerCount] = await Promise.all([
    prisma.hero.count(),
    prisma.skin.count(),
    prisma.player.count(),
  ]);
  console.log(
    `Seed selesai: ${heroCount} hero, ${skinCount} skin, ${playerCount} player`,
  );
}

main()
  .catch((error: unknown) => {
    console.error("Seed gagal:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
