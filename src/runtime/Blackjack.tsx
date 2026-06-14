import { useCallback, useEffect, useMemo, useState } from "react";
import type { DeckConfig } from "../deck-types";
import "./Blackjack.css";

type BlackjackProps = {
  deck: DeckConfig;
};

type Suit = "♠" | "♥" | "♦" | "♣";
type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";
type Card = { id: string; rank: Rank; suit: Suit };
type Phase = "betting" | "player" | "dealer" | "result";
type Outcome = "win" | "lose" | "push" | "blackjack";

const SUITS: Suit[] = ["♠", "♥", "♦", "♣"];
const RANKS: Rank[] = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const DECK_COUNT = 6;
const RESHUFFLE_AT = 60;
const STARTING_BANKROLL = 500;
const CHIPS = [10, 25, 50, 100];

function buildShoe(): Card[] {
  const cards: Card[] = [];

  for (let deckIndex = 0; deckIndex < DECK_COUNT; deckIndex += 1) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ id: `${suit}${rank}-${deckIndex}`, rank, suit });
      }
    }
  }

  // Fisher-Yates. Math.random is fine in app runtime (only workflow scripts forbid it).
  for (let i = cards.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }

  return cards;
}

function cardValue(rank: Rank) {
  if (rank === "A") return 11;
  if (rank === "K" || rank === "Q" || rank === "J") return 10;
  return Number(rank);
}

function handTotal(cards: Card[]) {
  let total = 0;
  let aces = 0;

  for (const card of cards) {
    total += cardValue(card.rank);
    if (card.rank === "A") aces += 1;
  }

  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }

  return total;
}

function isSoft(cards: Card[]) {
  let total = 0;
  let aces = 0;

  for (const card of cards) {
    total += cardValue(card.rank);
    if (card.rank === "A") aces += 1;
  }

  return aces > 0 && total <= 21;
}

function isNaturalBlackjack(cards: Card[]) {
  return cards.length === 2 && handTotal(cards) === 21;
}

function isFocusOnTerminal() {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return false;
  return Boolean(active.closest("input, textarea, [contenteditable='true'], .quake-terminal"));
}

function PlayingCard({ card, faceDown }: { card?: Card; faceDown?: boolean }) {
  if (faceDown || !card) {
    return <div className="blackjack-card blackjack-card--back" aria-label="Face down card" />;
  }

  const isRed = card.suit === "♥" || card.suit === "♦";

  return (
    <div className={`blackjack-card ${isRed ? "blackjack-card--red" : ""}`} aria-label={`${card.rank} ${card.suit}`}>
      <span className="blackjack-card__corner blackjack-card__corner--tl">
        <span>{card.rank}</span>
        <span>{card.suit}</span>
      </span>
      <span className="blackjack-card__pip">{card.suit}</span>
      <span className="blackjack-card__corner blackjack-card__corner--br">
        <span>{card.rank}</span>
        <span>{card.suit}</span>
      </span>
    </div>
  );
}

export function Blackjack({ deck }: BlackjackProps) {
  const [shoe, setShoe] = useState<Card[]>(() => buildShoe());
  const [bankroll, setBankroll] = useState(STARTING_BANKROLL);
  const [bet, setBet] = useState(25);
  const [wager, setWager] = useState(0);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [phase, setPhase] = useState<Phase>("betting");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [message, setMessage] = useState("Place your bet and deal.");

  const playerTotal = handTotal(playerHand);
  const dealerTotal = handTotal(dealerHand);
  const dealerVisibleTotal = dealerHand.length > 0 ? handTotal(dealerHand.slice(0, 1)) : 0;
  const hideHole = phase === "player";
  const canDouble = phase === "player" && playerHand.length === 2 && bankroll >= wager;

  const backToDeck = useCallback(() => {
    const nextUrl = new URL(window.location.href);
    nextUrl.pathname = `/${deck.slug}`;
    nextUrl.search = "";
    window.location.assign(nextUrl);
  }, [deck.slug]);

  const settle = useCallback(
    (finalPlayer: Card[], finalDealer: Card[], activeWager: number, naturalPlayer: boolean) => {
      const player = handTotal(finalPlayer);
      const dealer = handTotal(finalDealer);
      const dealerNatural = isNaturalBlackjack(finalDealer);

      let result: Outcome;
      let payout = 0;
      let note: string;

      if (player > 21) {
        result = "lose";
        note = "Bust. Dealer takes it.";
      } else if (naturalPlayer && !dealerNatural) {
        result = "blackjack";
        payout = activeWager + Math.floor(activeWager * 1.5);
        note = "Blackjack! Paid 3:2.";
      } else if (dealerNatural && !naturalPlayer) {
        result = "lose";
        note = "Dealer blackjack.";
      } else if (dealer > 21) {
        result = "win";
        payout = activeWager * 2;
        note = "Dealer busts. You win!";
      } else if (player > dealer) {
        result = "win";
        payout = activeWager * 2;
        note = "You win!";
      } else if (player < dealer) {
        result = "lose";
        note = "Dealer wins.";
      } else {
        result = "push";
        payout = activeWager;
        note = "Push. Bet returned.";
      }

      if (payout > 0) setBankroll((current) => current + payout);
      setOutcome(result);
      setPhase("result");
      setWager(0);
      setMessage(note);
    },
    [],
  );

  const playDealer = useCallback(
    (currentShoe: Card[], finalPlayer: Card[], dealer: Card[], activeWager: number) => {
      const nextShoe = [...currentShoe];
      const hand = [...dealer];

      // Dealer stands on all 17 (including soft 17).
      while (handTotal(hand) < 17) {
        const card = nextShoe.shift();
        if (!card) break;
        hand.push(card);
      }

      setShoe(nextShoe);
      setDealerHand(hand);
      settle(finalPlayer, hand, activeWager, false);
    },
    [settle],
  );

  const deal = useCallback(() => {
    if (phase === "player" || phase === "dealer") return;
    if (bet <= 0) {
      setMessage("Set a bet first.");
      return;
    }
    if (bet > bankroll) {
      setMessage("Not enough chips for that bet.");
      return;
    }

    const nextShoe = shoe.length < RESHUFFLE_AT ? buildShoe() : [...shoe];
    if (shoe.length < RESHUFFLE_AT) setMessage("Shuffling a fresh shoe...");

    const player = [nextShoe.shift()!, nextShoe.shift()!];
    const dealer = [nextShoe.shift()!, nextShoe.shift()!];

    setBankroll((current) => current - bet);
    setWager(bet);
    setPlayerHand(player);
    setDealerHand(dealer);
    setOutcome(null);

    const playerNatural = isNaturalBlackjack(player);
    const dealerNatural = isNaturalBlackjack(dealer);

    if (playerNatural || dealerNatural) {
      setShoe(nextShoe);
      settle(player, dealer, bet, playerNatural);
      return;
    }

    setShoe(nextShoe);
    setPhase("player");
    setMessage("Hit or stand?");
  }, [bankroll, bet, phase, settle, shoe]);

  const hit = useCallback(() => {
    if (phase !== "player") return;

    const nextShoe = [...shoe];
    const card = nextShoe.shift();
    if (!card) return;

    const hand = [...playerHand, card];
    setShoe(nextShoe);
    setPlayerHand(hand);

    const total = handTotal(hand);
    if (total > 21) {
      settle(hand, dealerHand, wager, false);
    } else if (total === 21) {
      playDealer(nextShoe, hand, dealerHand, wager);
    } else {
      setMessage("Hit or stand?");
    }
  }, [dealerHand, phase, playDealer, playerHand, settle, shoe, wager]);

  const stand = useCallback(() => {
    if (phase !== "player") return;
    setPhase("dealer");
    setMessage("Dealer plays...");
    playDealer(shoe, playerHand, dealerHand, wager);
  }, [dealerHand, phase, playDealer, playerHand, shoe, wager]);

  const doubleDown = useCallback(() => {
    if (!canDouble) return;

    const nextShoe = [...shoe];
    const card = nextShoe.shift();
    if (!card) return;

    const hand = [...playerHand, card];
    const doubledWager = wager * 2;

    setBankroll((current) => current - wager);
    setWager(doubledWager);
    setPlayerHand(hand);
    setShoe(nextShoe);

    if (handTotal(hand) > 21) {
      settle(hand, dealerHand, doubledWager, false);
      return;
    }

    setPhase("dealer");
    setMessage("Doubled. Dealer plays...");
    playDealer(nextShoe, hand, dealerHand, doubledWager);
  }, [canDouble, dealerHand, playDealer, playerHand, settle, shoe, wager]);

  const newHand = useCallback(() => {
    if (phase !== "result") return;
    setPlayerHand([]);
    setDealerHand([]);
    setOutcome(null);
    setPhase("betting");
    setMessage(bankroll <= 0 ? "Out of chips. Press R to rebuy." : "Place your bet and deal.");
  }, [bankroll, phase]);

  const rebuy = useCallback(() => {
    setBankroll(STARTING_BANKROLL);
    setBet(25);
    setMessage("Rebought. Place your bet and deal.");
  }, []);

  const adjustBet = useCallback(
    (delta: number) => {
      if (phase !== "betting") return;
      setBet((current) => {
        const next = current + delta;
        if (next < 5) return 5;
        if (next > bankroll) return Math.max(5, bankroll);
        return next;
      });
    },
    [bankroll, phase],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isFocusOnTerminal()) return;

      const key = event.key.toLowerCase();

      if (key === "escape" || key === "b") {
        event.preventDefault();
        backToDeck();
        return;
      }

      if (phase === "betting") {
        if (key === "enter" || key === "d") {
          event.preventDefault();
          deal();
        } else if (key === "arrowup" || key === "=" || key === "+") {
          event.preventDefault();
          adjustBet(5);
        } else if (key === "arrowdown" || key === "-") {
          event.preventDefault();
          adjustBet(-5);
        } else if (key === "r" && bankroll <= 0) {
          event.preventDefault();
          rebuy();
        }
        return;
      }

      if (phase === "player") {
        if (key === "h") {
          event.preventDefault();
          hit();
        } else if (key === "s") {
          event.preventDefault();
          stand();
        } else if (key === "d") {
          event.preventDefault();
          doubleDown();
        }
        return;
      }

      if (phase === "result" && (key === "enter" || key === "n")) {
        event.preventDefault();
        newHand();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [adjustBet, backToDeck, bankroll, deal, doubleDown, hit, newHand, phase, rebuy, stand]);

  const dealerLabel = useMemo(() => {
    if (dealerHand.length === 0) return "--";
    if (hideHole) return `${dealerVisibleTotal} + ?`;
    return `${dealerTotal}${isSoft(dealerHand) && dealerTotal !== 21 ? " (soft)" : ""}`;
  }, [dealerHand, dealerTotal, dealerVisibleTotal, hideHole]);

  const playerLabel = useMemo(() => {
    if (playerHand.length === 0) return "--";
    return `${playerTotal}${isSoft(playerHand) && playerTotal !== 21 ? " (soft)" : ""}`;
  }, [playerHand, playerTotal]);

  return (
    <main className={`blackjack-page blackjack-page--${outcome ?? "neutral"}`}>
      <header className="blackjack-topbar">
        <button className="blackjack-back" onClick={backToDeck} type="button">
          ← Back to deck
        </button>
        <h1 className="blackjack-title">Blackjack</h1>
        <div className="blackjack-stats">
          <span className="blackjack-stat">
            <small>Bankroll</small>
            <strong>${bankroll}</strong>
          </span>
          <span className="blackjack-stat">
            <small>{wager > 0 ? "On table" : "Bet"}</small>
            <strong>${wager > 0 ? wager : bet}</strong>
          </span>
        </div>
      </header>

      <section className="blackjack-felt">
        <div className="blackjack-hand-area">
          <div className="blackjack-hand-header">
            <span>Dealer</span>
            <span className="blackjack-hand-total">{dealerLabel}</span>
          </div>
          <div className="blackjack-hand">
            {dealerHand.length === 0 ? (
              <div className="blackjack-card blackjack-card--placeholder" />
            ) : (
              dealerHand.map((card, index) => (
                <PlayingCard key={card.id} card={card} faceDown={hideHole && index === 1} />
              ))
            )}
          </div>
        </div>

        <div className={`blackjack-message blackjack-message--${outcome ?? "neutral"}`}>{message}</div>

        <div className="blackjack-hand-area">
          <div className="blackjack-hand-header">
            <span>You</span>
            <span className="blackjack-hand-total">{playerLabel}</span>
          </div>
          <div className="blackjack-hand">
            {playerHand.length === 0 ? (
              <div className="blackjack-card blackjack-card--placeholder" />
            ) : (
              playerHand.map((card) => <PlayingCard key={card.id} card={card} />)
            )}
          </div>
        </div>
      </section>

      <footer className="blackjack-controls">
        {phase === "betting" && (
          <>
            <div className="blackjack-chips">
              {CHIPS.map((chip) => (
                <button
                  className="blackjack-chip"
                  disabled={chip > bankroll}
                  key={chip}
                  onClick={() => setBet(Math.min(chip, bankroll))}
                  type="button"
                >
                  ${chip}
                </button>
              ))}
              <button className="blackjack-chip blackjack-chip--ghost" onClick={() => adjustBet(-5)} type="button">
                −5
              </button>
              <button className="blackjack-chip blackjack-chip--ghost" onClick={() => adjustBet(5)} type="button">
                +5
              </button>
            </div>
            {bankroll <= 0 ? (
              <button className="blackjack-action blackjack-action--primary" onClick={rebuy} type="button">
                Rebuy ${STARTING_BANKROLL} (R)
              </button>
            ) : (
              <button className="blackjack-action blackjack-action--primary" onClick={deal} type="button">
                Deal (Enter)
              </button>
            )}
          </>
        )}

        {phase === "player" && (
          <>
            <button className="blackjack-action blackjack-action--primary" onClick={hit} type="button">
              Hit (H)
            </button>
            <button className="blackjack-action" onClick={stand} type="button">
              Stand (S)
            </button>
            <button className="blackjack-action" disabled={!canDouble} onClick={doubleDown} type="button">
              Double (D)
            </button>
          </>
        )}

        {(phase === "dealer" || phase === "result") && (
          <button
            className="blackjack-action blackjack-action--primary"
            disabled={phase === "dealer"}
            onClick={newHand}
            type="button"
          >
            New hand (Enter)
          </button>
        )}
      </footer>

      <p className="blackjack-hint">H hit · S stand · D double · Enter deal/again · B or Esc back to deck</p>
    </main>
  );
}
