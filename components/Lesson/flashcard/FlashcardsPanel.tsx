'use client';

import { useState, useRef, useEffect } from "react";
import { RotateCcw, ChevronLeft, ChevronRight, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFlashDeck } from "@/hooks/useFlashDeck";

interface FlashcardsPanelProps {
  nodeId: string;
  nodeTitle: string;
  markdownContent: string;
}

interface Flashcard {
  id: string;
  question: string;
  answer: string;
  hint?: string;
  type: string;
  tags: string[];
}

export function FlashcardsPanel({ nodeId, nodeTitle, markdownContent }: FlashcardsPanelProps) {
  const { deck, loading, error, generateDeck } = useFlashDeck(
    nodeId, 
    nodeTitle, 
    markdownContent, 
  );

  const [stackArray, setStackArray] = useState<number[]>([]);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize stack when deck loads
  useEffect(() => {
    if (deck?.cards) {
      setStackArray(Array.from({ length: deck.cards.length }, (_, i) => i));
    }
  }, [deck]);

  // Current card is always the first in the stack array
  const currentCardIndex = stackArray[0];
  const currentCard = deck?.cards?.[currentCardIndex];

  const nextCard = () => {
    if (!deck?.cards || stackArray.length <= 1 || isAnimating) return;

    setIsAnimating(true);
    setIsFlipped(false);
    setShowHint(false);

    // Get the top card element
    const topCardElement = containerRef.current?.querySelector(`[data-card-id="${currentCardIndex}"]`) as HTMLElement;
    if (!topCardElement) return;

    // Animate top card out (pivot on left edge, move right, rotate, scale down)
    topCardElement.style.transformOrigin = "left center";
    topCardElement.style.transform = "translateX(120%) rotateZ(8deg) scale(0.9)";
    topCardElement.style.opacity = "0";
    topCardElement.style.transition = "all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)";

    // Animate remaining cards up (reflow stack)
    stackArray.slice(1).forEach((cardIndex, stackIndex) => {
      const cardElement = containerRef.current?.querySelector(`[data-card-id="${cardIndex}"]`) as HTMLElement;
      if (cardElement) {
        const newTranslateY = stackIndex * 4;
        const newScale = 1 - stackIndex * 0.02;
        const newShadow = `0 ${4 + stackIndex * 2}px ${12 + stackIndex * 4}px rgba(0, 0, 0, ${0.1 + stackIndex * 0.02})`;

        cardElement.style.transform = `translateY(${newTranslateY}px) scale(${newScale})`;
        cardElement.style.boxShadow = newShadow;
        cardElement.style.transition = "all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)";
      }
    });

    // Cleanup after animation
    setTimeout(() => {
      setStackArray((prev) => prev.slice(1)); // Remove top card from stack
      setIsAnimating(false);

      // Reset top card transform for potential reuse
      if (topCardElement) {
        topCardElement.style.transform = "";
        topCardElement.style.opacity = "";
        topCardElement.style.transition = "";
        topCardElement.style.transformOrigin = "";
      }
    }, 500);
  };

  const prevCard = () => {
    if (!deck?.cards || stackArray.length >= deck.cards.length || isAnimating) return;

    setIsAnimating(true);
    setIsFlipped(false);
    setShowHint(false);

    // Find the last dismissed card (the one not in current stack)
    const dismissedCards = Array.from({ length: deck.cards.length }, (_, i) => i).filter((i) => !stackArray.includes(i));

    if (dismissedCards.length === 0) return;

    const returningCardIndex = dismissedCards[dismissedCards.length - 1];
    const returningCardElement = containerRef.current?.querySelector(
      `[data-card-id="${returningCardIndex}"]`,
    ) as HTMLElement;

    if (!returningCardElement) return;

    // Insert returning card at the beginning of stack array
    const newStackArray = [returningCardIndex, ...stackArray];
    setStackArray(newStackArray);

    // Set initial transform for returning card (off-screen right)
    returningCardElement.style.transformOrigin = "left center";
    returningCardElement.style.transform = "translateX(120%) rotateZ(8deg) scale(0.9)";
    returningCardElement.style.opacity = "0";
    returningCardElement.style.transition = "none";

    // Force layout
    void returningCardElement.offsetHeight;

    // Animate returning card in
    setTimeout(() => {
      returningCardElement.style.transform = "translateY(0px) scale(1)";
      returningCardElement.style.opacity = "1";
      returningCardElement.style.transition = "all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)";
      returningCardElement.style.transformOrigin = "center center";
    }, 10);

    // Animate existing cards down (restack)
    stackArray.forEach((cardIndex, stackIndex) => {
      const cardElement = containerRef.current?.querySelector(`[data-card-id="${cardIndex}"]`) as HTMLElement;
      if (cardElement) {
        const newTranslateY = (stackIndex + 1) * 4;
        const newScale = 1 - (stackIndex + 1) * 0.02;
        const newShadow = `0 ${4 + (stackIndex + 1) * 2}px ${12 + (stackIndex + 1) * 4}px rgba(0, 0, 0, ${0.1 + (stackIndex + 1) * 0.02})`;

        cardElement.style.transform = `translateY(${newTranslateY}px) scale(${newScale})`;
        cardElement.style.boxShadow = newShadow;
        cardElement.style.transition = "all 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)";
      }
    });

    // Cleanup after animation
    setTimeout(() => {
      setIsAnimating(false);
    }, 500);
  };

  const flipCard = () => {
    if (isAnimating) return;
    setIsFlipped(!isFlipped);
    setShowHint(false);
  };

  const toggleHint = () => {
    setShowHint(!showHint);
  };

  // Calculate initial transforms for all cards
  const getInitialTransform = (cardIndex: number) => {
    const stackIndex = stackArray.indexOf(cardIndex);
    if (stackIndex === -1) {
      // Card is dismissed, hide it
      return {
        transform: "translateX(120%) rotateZ(8deg) scale(0.9)",
        opacity: "0",
        zIndex: 0,
        boxShadow: "none",
        pointerEvents: "none" as const,
      };
    }

    const translateY = stackIndex * 4;
    const scale = 1 - stackIndex * 0.02;
    const zIndex = (deck?.cards?.length || 0) - stackIndex;
    const shadow = `0 ${4 + stackIndex * 2}px ${12 + stackIndex * 4}px rgba(0, 0, 0, ${0.1 + stackIndex * 0.02})`;

    return {
      transform: `translateY(${translateY}px) scale(${scale})`,
      opacity: "1",
      zIndex,
      boxShadow: shadow,
      pointerEvents: stackIndex === 0 ? ("auto" as const) : ("none" as const),
    };
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <div className="text-lg">Generating flashcards...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <div className="text-red-600 mb-4">{error}</div>
        <Button onClick={generateDeck}>Retry Generation</Button>
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <div className="text-lg mb-4">No flashcards available</div>
        <Button onClick={generateDeck}>Generate Flashcards</Button>
      </div>
    );
  }

  const flashcards = deck.cards;
  const isFirstCard = stackArray.length >= flashcards.length;
  const isLastCard = stackArray.length <= 1;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 py-3 border-b border-slate-200 bg-slate-50 flex-shrink-0">
        <h3 className="text-lg font-semibold text-slate-800">Study Cards</h3>
        <p className="text-xs text-slate-500">
          {flashcards.length - stackArray.length + 1} of {flashcards.length} • {stackArray.length - 1} remaining
        </p>
      </div>

      {/* 3D Card Container */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 overflow-y-auto">
        <div
          ref={containerRef}
          className="relative w-[480px] h-80 mb-8"
          style={{
            perspective: "1000px",
            perspectiveOrigin: "center center",
          }}
        >
          {/* Pre-render ALL cards in DOM */}
          {flashcards.map((card: Flashcard, cardIndex: number) => {
            const initialStyle = getInitialTransform(cardIndex);
            const isTopCard = cardIndex === currentCardIndex;
            const cardType = card.type || "concept";

            return (
              <div
                key={card.id}
                data-card-id={cardIndex}
                className="absolute inset-0 w-full h-full cursor-pointer"
                style={{
                  ...initialStyle,
                  transformStyle: "preserve-3d",
                  willChange: "transform, opacity, box-shadow",
                }}
                onClick={isTopCard ? flipCard : undefined}
              >
                {/* Card Container with 3D flip */}
                <div
                  className={`relative w-full h-full transition-transform duration-400 ease-in-out ${
                    isTopCard && isFlipped ? "flipped" : ""
                  }`}
                  style={{
                    transformStyle: "preserve-3d",
                    transform: isTopCard && isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                  }}
                >
                  {/* Card Front Face */}
                  <div
                    className="absolute inset-0 w-full h-full bg-white rounded-2xl border-2 border-slate-200"
                    style={{
                      backfaceVisibility: "hidden",
                    }}
                  >
                    {/* Card Type Indicator */}
                    <div className="absolute top-4 right-4">
                      {cardType === "quiz" ? (
                        <span className="bg-orange-100 text-orange-700 text-xs px-3 py-1 rounded-full font-medium shadow-sm">
                          Quiz Prep
                        </span>
                      ) : (
                        <span className="bg-indigo-100 text-indigo-700 text-xs px-3 py-1 rounded-full font-medium shadow-sm">
                          Concept
                        </span>
                      )}
                    </div>

                    <div className="p-8 h-full flex flex-col justify-center items-center text-center">
                      {isTopCard && (
                        <>
                          <div className="mb-6">
                            <RotateCcw className="w-6 h-6 text-indigo-500 mx-auto" />
                            <p className="text-xs text-slate-500 mt-2">Click to flip</p>
                          </div>

                          {/* Hint Button */}
                          {card.hint && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleHint();
                              }}
                              className="absolute bottom-4 left-4 text-amber-600 hover:text-amber-700 p-2 rounded-full hover:bg-amber-50 transition-colors duration-300"
                            >
                              <Lightbulb className="w-5 h-5" />
                            </button>
                          )}
                        </>
                      )}

                      <div className="flex-1 flex items-center justify-center px-4">
                        <p
                          className={`text-slate-700 leading-relaxed font-medium transition-all duration-300 ${
                            isTopCard ? "text-xl" : "text-lg opacity-60"
                          }`}
                        >
                          {card.question}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Card Back Face (only for top card) */}
                  {isTopCard && (
                    <div
                      className="absolute inset-0 w-full h-full bg-slate-100 rounded-2xl border-2 border-slate-200"
                      style={{
                        backfaceVisibility: "hidden",
                        transform: "rotateY(180deg)",
                      }}
                    >
                      <div className="absolute top-4 right-4">
                        <span className="bg-emerald-100 text-emerald-700 text-xs px-3 py-1 rounded-full font-medium shadow-sm">
                          Answer
                        </span>
                      </div>

                      <div className="p-8 h-full flex flex-col justify-center items-center text-center">
                        <div className="mb-6">
                          <RotateCcw className="w-6 h-6 text-emerald-500 mx-auto" />
                          <p className="text-xs text-slate-500 mt-2">Click to flip back</p>
                        </div>

                        <div className="flex-1 flex items-center justify-center px-4">
                          <p className="text-slate-700 text-xl leading-relaxed font-medium">{card.answer}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Hint Display */}
        {showHint && currentCard?.hint && (
          <div className="w-[480px] mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 shadow-lg transition-all duration-300">
            <div className="flex items-start space-x-3">
              <Lightbulb className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-amber-700 text-sm leading-relaxed">{currentCard.hint}</p>
            </div>
          </div>
        )}

        {/* Navigation Bar */}
        <div className="flex-shrink-0 px-6 pb-6">
          <div className="bg-white rounded-lg border border-slate-200 shadow-md p-3">
            <div className="flex items-center justify-center space-x-6">
              <Button
                variant="outline"
                size="sm"
                onClick={prevCard}
                disabled={isFirstCard || isAnimating}
                className="border-slate-300 text-slate-600 hover:bg-slate-50 hover:text-slate-600 rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>

              <div className="text-sm font-medium text-slate-600">
                {flashcards.length - stackArray.length + 1} of {flashcards.length}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={nextCard}
                disabled={isLastCard || isAnimating}
                className="bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600 hover:text-white rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:border-slate-300 disabled:text-slate-500"
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 