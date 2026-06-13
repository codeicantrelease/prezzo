import { deckConfigs, findDeck, getDeckOrDefault } from "./deck-registry";
import { DubDubTokChallenge } from "./runtime/DubDubTokChallenge";
import { PresentationShell } from "./runtime/PresentationShell";
import { RemoteControllerPage } from "./runtime/RemoteControllerPage";

function pathSegmentsFromLocation() {
  return window.location.pathname.split("/").filter(Boolean);
}

function selectedDeckSlugFromLocation() {
  const params = new URLSearchParams(window.location.search);
  const queryDeck = params.get("deck");
  const pathDeck = pathSegmentsFromLocation()[0];

  return pathDeck || queryDeck || import.meta.env.VITE_PREZZO_DECK;
}

function hiddenPageSlugFromLocation() {
  return pathSegmentsFromLocation()[1];
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
  const hiddenPageSlug = hiddenPageSlugFromLocation();
  const dubdubtokConfig = selectedDeck.runtime?.hiddenPages?.dubdubtok;

  if (hiddenPageSlug === "control") {
    return <RemoteControllerPage deck={selectedDeck} />;
  }

  if (hiddenPageSlug === "dubdubtok" && dubdubtokConfig?.enabled) {
    return (
      <PresentationShell deck={selectedDeck}>
        <DubDubTokChallenge config={dubdubtokConfig} deck={selectedDeck} />
      </PresentationShell>
    );
  }

  return (
    <PresentationShell deck={selectedDeck}>
      <DeckComponent
        remote={{
          enabled: true,
          slideCount: selectedDeck.slideCount ?? 1,
          slug: selectedDeck.slug,
        }}
      />
    </PresentationShell>
  );
}
