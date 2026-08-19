import { useEffect, useState } from "react";
import { PixelPup } from "@/components/PixelPup";
import {
  SERVER_WAKE_FACT_KEYS,
  SERVER_WAKE_STATUS_KEYS,
  pickRandomIndex,
} from "@/lib/server-wake-content";
import { useTranslation } from "@/i18n";

const STATUS_ROTATE_MS = 3_200;
const FACT_ROTATE_MS = 9_000;
const MOVE_ROTATE_MS = 3_200;

type PupMove = "dance" | "backflip" | "eat" | "play";
const PUP_MOVES: PupMove[] = ["dance", "backflip", "eat", "play"];

function PixelSnack() {
  return (
    <svg
      viewBox="0 0 8 6"
      width={28}
      height={21}
      shapeRendering="crispEdges"
      className="wake-pup-snack"
      aria-hidden
    >
      <rect x="1" y="2" width="6" height="3" fill="#111" />
      <rect x="2" y="1" width="4" height="1" fill="#111" />
      <rect x="2" y="3" width="1" height="1" fill="#f5f5f5" />
      <rect x="5" y="3" width="1" height="1" fill="#f5f5f5" />
    </svg>
  );
}

function PixelBall() {
  return (
    <svg
      viewBox="0 0 6 6"
      width={22}
      height={22}
      shapeRendering="crispEdges"
      className="wake-pup-ball"
      aria-hidden
    >
      <rect x="1" y="0" width="4" height="1" fill="#111" />
      <rect x="0" y="1" width="6" height="4" fill="#111" />
      <rect x="1" y="5" width="4" height="1" fill="#111" />
      <rect x="2" y="2" width="2" height="2" fill="#f5f5f5" />
    </svg>
  );
}

function PlayfulWakePup() {
  const [move, setMove] = useState<PupMove>("dance");

  useEffect(() => {
    const id = window.setInterval(() => {
      setMove((prev) => PUP_MOVES[(PUP_MOVES.indexOf(prev) + 1) % PUP_MOVES.length]);
    }, MOVE_ROTATE_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="wake-pup-stage" data-move={move} aria-hidden>
      <div className="wake-pup-actor">
        <PixelPup slug="dalmatian" size={96} mono />
      </div>
      <PixelSnack />
      <PixelBall />
    </div>
  );
}

/**
 * Content-area only loading panel (sidebar / chrome unchanged).
 * Matches existing Today layout spacing — no extra cards or chrome.
 */
export function ServerWakeScreen() {
  const { t } = useTranslation();
  const [statusIndex, setStatusIndex] = useState(() =>
    pickRandomIndex(SERVER_WAKE_STATUS_KEYS.length),
  );
  const [factIndex, setFactIndex] = useState(() =>
    pickRandomIndex(SERVER_WAKE_FACT_KEYS.length),
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      setStatusIndex((prev) => pickRandomIndex(SERVER_WAKE_STATUS_KEYS.length, prev));
    }, STATUS_ROTATE_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      setFactIndex((prev) => pickRandomIndex(SERVER_WAKE_FACT_KEYS.length, prev));
    }, FACT_ROTATE_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      className="flex min-h-[55vh] w-full flex-col items-center justify-center gap-5"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <PlayfulWakePup />

      <p className="text-center text-base font-black uppercase tracking-tight text-foreground sm:text-lg">
        {t(SERVER_WAKE_STATUS_KEYS[statusIndex])}
      </p>

      <p className="text-center text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {t("serverWake.wakingUp")}
      </p>

      <div className="mt-2 w-full max-w-sm border-t border-foreground/15 pt-6">
        <p className="mb-2 text-center text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
          {t("serverWake.funFact")}
        </p>
        <p className="text-center text-sm font-semibold leading-relaxed text-foreground/80">
          {t(SERVER_WAKE_FACT_KEYS[factIndex])}
        </p>
      </div>

      <style>{`
        .wake-pup-stage {
          position: relative;
          width: 160px;
          height: 140px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .wake-pup-actor {
          position: relative;
          z-index: 2;
          transform-origin: 50% 70%;
          image-rendering: pixelated;
        }
        .wake-pup-snack,
        .wake-pup-ball {
          position: absolute;
          image-rendering: pixelated;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.35s ease;
        }

        .wake-pup-stage[data-move="dance"] .wake-pup-actor {
          animation: wake-pup-dance 1.1s ease-in-out infinite;
        }
        @keyframes wake-pup-dance {
          0%, 100% { transform: translate(0, 0) rotate(-6deg); }
          25%      { transform: translate(8px, -8px) rotate(6deg); }
          50%      { transform: translate(0, 0) rotate(-6deg); }
          75%      { transform: translate(-8px, -8px) rotate(6deg); }
        }

        .wake-pup-stage[data-move="backflip"] .wake-pup-actor {
          animation: wake-pup-backflip 1.4s ease-in-out infinite;
        }
        @keyframes wake-pup-backflip {
          0%   { transform: translateY(0) rotate(0deg); }
          20%  { transform: translateY(-6px) rotate(-30deg); }
          55%  { transform: translateY(-48px) rotate(-360deg); }
          80%  { transform: translateY(-4px) rotate(-360deg); }
          100% { transform: translateY(0) rotate(-360deg); }
        }

        .wake-pup-stage[data-move="eat"] .wake-pup-actor {
          animation: wake-pup-eat 1s ease-in-out infinite;
        }
        .wake-pup-stage[data-move="eat"] .wake-pup-snack {
          left: 50%;
          top: 52%;
          margin-left: -14px;
          z-index: 3;
          opacity: 1;
        }
        @keyframes wake-pup-eat {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50%      { transform: translateY(8px) rotate(4deg); }
        }

        .wake-pup-stage[data-move="play"] .wake-pup-actor {
          animation: wake-pup-play 1.4s ease-in-out infinite;
        }
        .wake-pup-stage[data-move="play"] .wake-pup-ball {
          z-index: 1;
          opacity: 1;
          animation: wake-pup-ball 1.4s ease-in-out infinite;
        }
        @keyframes wake-pup-play {
          0%, 100% { transform: translate(-24px, 0) rotate(-4deg); }
          25%      { transform: translate(-6px, -12px) rotate(3deg); }
          50%      { transform: translate(22px, 0) rotate(5deg); }
          75%      { transform: translate(4px, -10px) rotate(-3deg); }
        }
        @keyframes wake-pup-ball {
          0%, 100% { left: 72%; bottom: 22px; }
          25%      { left: 78%; bottom: 44px; }
          50%      { left: 18%; bottom: 22px; }
          75%      { left: 12%; bottom: 42px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .wake-pup-actor,
          .wake-pup-ball { animation: none !important; }
          .wake-pup-stage[data-move="eat"] .wake-pup-snack,
          .wake-pup-stage[data-move="play"] .wake-pup-ball { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
