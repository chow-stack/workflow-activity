import type { Level } from "@/engine/types";
import { level as l1 } from "./01-club-rsvp";
import { level as l2 } from "./02-class-reminder";
import { level as l3 } from "./03-personalized-welcome";
import { level as l4 } from "./04-recruiting-inbox";
import { level as l5 } from "./05-review-router";
import { level as l6 } from "./06-resume-screener";
import { level as l7 } from "./07-coffee-restock";
import { level as l8 } from "./08-invoice-chaser";

export const LEVELS: Level[] = [l1, l2, l3, l4, l5, l6, l7, l8];
export const MAX_POINTS = LEVELS.reduce((s, l) => s + l.points, 0);

export const levelById = (id: number) => LEVELS.find((l) => l.id === id);
