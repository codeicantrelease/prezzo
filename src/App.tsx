import { deckConfigs, findDeck, getDeckOrDefault } from "./deck-registry";
import { Blackjack } from "./runtime/Blackjack";
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

  // No deck in the path/query => show the home index (list of talks). We do NOT
  // fall back to VITE_PREZZO_DECK here: the root route is the launcher, and decks
  // are opened by explicit /<slug>/ path. (VITE_PREZZO_DECK still drives the
  // server-side remotion/studio defaults.)
  return pathDeck || queryDeck;
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
            <a className="deck-index__start" href={`/${deck.slug}`}>
              <strong>{deck.label}</strong>
              <span>{deck.description ?? deck.slug}</span>
              <small>
                {deck.slideCount ?? 1} slide{(deck.slideCount ?? 1) === 1 ? "" : "s"}
              </small>
            </a>
            <a className="deck-index__control" href={`/${deck.slug}/control`}>
              Remote
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
  const blackjackConfig = selectedDeck.runtime?.hiddenPages?.blackjack;

  if (hiddenPageSlug === "control") {
    return <RemoteControllerPage deck={selectedDeck} />;
  }

  if (hiddenPageSlug === "blackjack" && blackjackConfig?.enabled) {
    return (
      <PresentationShell deck={selectedDeck}>
        <Blackjack deck={selectedDeck} />
      </PresentationShell>
    );
  }

  if (hiddenPageSlug === "dubdubtok" && dubdubtokConfig?.enabled) {
    return (
      <PresentationShell deck={selectedDeck}>
        <DubDubTokChallenge config={dubdubtokConfig} deck={selectedDeck} />
      </PresentationShell>
    );
  }

  // Preview mode (used by the controller's slide-mirror iframe): render the deck
  // read-only at the requested slide/step and DON'T connect the remote bridge, so
  // the embedded copy never registers as a second presenter and fights the real one.
  const previewMode = new URLSearchParams(window.location.search).get("preview") === "1";

  return (
    <PresentationShell deck={selectedDeck}>
      <DeckComponent
        remote={{
          enabled: !previewMode,
          slideCount: selectedDeck.slideCount ?? 1,
          slug: selectedDeck.slug,
        }}
      />
    </PresentationShell>
  );
}
