// Types for game specs
import { Card } from "../../games/common/cards";
import { Seat } from "../../games/common/types";

export interface GameSpec {
  scoreOf: (cards: Card[], community?: Card[]) => { score: number; name: string; mult?: number };
  compareCards?: (a: Card[], b: Card[], community?: Card[]) => number;
  canSeeCards?: (seat: Seat, viewer: Seat, phase: string) => boolean;
}
