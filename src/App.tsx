import { deckConfigs, findDeck, getDeckOrDefault } from "./deck-registry";
import { PresentationShell } from "./runtime/PresentationShell";

function selectedDeckSlugFromLocation() {
  const params = new URLSearchParams(window.location.search);
  const queryDeck = params.get("deck");
  const pathDeck = window.location.pathname.split("/").filter(Boolean)[0];

  return pathDeck || queryDeck || import.meta.env.VITE_PREZZO_DECK;
}

function DeckIndex() {
  return (
    <main className="deck-index">
      <p className="deck-index__eyebrow">Prezzo decks</p>
      <h1>Choose a presentation</h1>
      <ul>
        {deckConfigs.map((deck) => (
          <li key={deck.slug}>
            <a href={`/${deck.slug}`}>
              <strong>{deck.label}</strong>
              <span>{deck.description ?? deck.slug}</span>
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}

export function App() {
  const selectedSlug = selectedDeckSlugFromLocation();

  if (!selectedSlug || selectedSlug === "decks") {
    return <DeckIndex />;
  }

  const selectedDeck = findDeck(selectedSlug);

  if (!selectedDeck) {
    return <DeckIndex />;
  }

  const DeckComponent = getDeckOrDefault(selectedDeck.slug).component;

  return (
    <PresentationShell deck={selectedDeck}>
      <DeckComponent />
    </PresentationShell>
  );
}
