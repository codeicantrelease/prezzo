import { deckConfig as prezzoDemo } from "../decks/prezzo-demo/deck.config";
import type { DeckConfig } from "./deck-types";

export const deckConfigs = [prezzoDemo] satisfies DeckConfig[];

export const defaultDeckSlug = "prezzo-demo";

export function findDeck(slug: string | null | undefined): DeckConfig | undefined {
  return deckConfigs.find((deck) => deck.slug === slug);
}

export function getDeckOrDefault(slug: string | null | undefined): DeckConfig {
  return findDeck(slug) ?? findDeck(defaultDeckSlug) ?? deckConfigs[0];
}
