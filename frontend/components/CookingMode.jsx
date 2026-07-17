/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  Timer as TimerIcon,
  ChefHat,
  CheckCircle2,
  Lightbulb,
  ListChecks,
  Mic,
  MicOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// --- Helpers -----------------------------------------------------------

// Pulls a duration (in seconds) out of a free-text instruction/tip, e.g.
// "Bake for 20-25 minutes", "Let rest for 1 hour", "simmer for 45 seconds".
// Picks the upper bound of a range so the timer errs generous.
function parseDurationSeconds(text) {
  if (!text) return null;

  const rangeMin = text.match(
    /(\d+)\s*-\s*(\d+)\s*(minutes|minute|mins|min)\b/i
  );
  if (rangeMin) return parseInt(rangeMin[2], 10) * 60;

  const singleMin = text.match(/(\d+)\s*(minutes|minute|mins|min)\b/i);
  if (singleMin) return parseInt(singleMin[1], 10) * 60;

  const rangeHr = text.match(/(\d+)\s*-\s*(\d+)\s*(hours|hour|hrs|hr)\b/i);
  if (rangeHr) return parseInt(rangeHr[2], 10) * 3600;

  const singleHr = text.match(/(\d+)\s*(hours|hour|hrs|hr)\b/i);
  if (singleHr) return parseInt(singleHr[1], 10) * 3600;

  const singleSec = text.match(/(\d+)\s*(seconds|second|secs|sec)\b/i);
  if (singleSec) return parseInt(singleSec[1], 10);

  return null;
}

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

// Short beep using the Web Audio API so we don't need an audio asset.
function playBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    [0, 0.3, 0.6].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.15, ctx.currentTime + delay);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + 0.25);
    });
  } catch {
    // Web Audio not available — fail silently, toast still shows.
  }
}

// Reads text aloud using the browser's built-in speech synthesis.
// Pass a specific SpeechSynthesisVoice to override the default voice.
function speak(text, voice) {
  try {
    if (!("speechSynthesis" in window) || !text) return;
    window.speechSynthesis.cancel(); // stop anything currently being read
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Speech synthesis not available — fail silently.
  }
}

// Loads the browser's available speech-synthesis voices. Voice lists load
// asynchronously in most browsers, so this listens for the
// `voiceschanged` event rather than assuming they're ready immediately.
function useAvailableVoices() {
  const [voices, setVoices] = useState([]);

  useEffect(() => {
    if (!("speechSynthesis" in window)) return;

    const loadVoices = () => {
      const all = window.speechSynthesis.getVoices();
      // English voices are most useful for step narration; fall back to
      // the full list if none are found (e.g. non-English OS locale).
      const english = all.filter((v) => v.lang?.startsWith("en"));
      setVoices(english.length ? english : all);
    };

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () =>
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  return voices;
}

// --- Voice control (Web Speech API) --------------------------------------
// Listens continuously for simple hands-free cooking commands. Falls back
// gracefully (button disabled) on browsers without SpeechRecognition
// support (e.g. Firefox).
function useVoiceControl({ enabled, onNext, onPrev, onRepeat, onExit }) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef(null);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    if (!enabled) {
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => setListening(true);
    recognition.onend = () => {
      setListening(false);
      // Auto-restart if still enabled — browsers stop recognition
      // after periods of silence.
      if (enabledRef.current) {
        try {
          recognition.start();
        } catch {
          // already started / stopping — ignore
        }
      }
    };
    recognition.onerror = () => setListening(false);

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((r) => r[0].transcript)
        .join(" ")
        .toLowerCase()
        .trim();

      if (/\b(next|continue|forward)\b/.test(transcript)) {
        onNext();
      } else if (/\b(back|previous|go back)\b/.test(transcript)) {
        onPrev();
      } else if (/\b(repeat|say again|what)\b/.test(transcript)) {
        onRepeat();
      } else if (
        /\b(exit|stop cooking|close|done cooking)\b/.test(transcript)
      ) {
        onExit();
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      // ignore double-start errors
    }

    return () => {
      recognitionRef.current = null;
      try {
        recognition.stop();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { listening, supported };
}

// --- Per-step timer ------------------------------------------------------

function StepTimer({ seconds, onComplete }) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    setRemaining(seconds);
    setRunning(false);
  }, [seconds]);

  useEffect(() => {
    if (running && remaining > 0) {
      intervalRef.current = setInterval(() => {
        setRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(intervalRef.current);
            setRunning(false);
            playBeep();
            if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
            toast.success("Timer done! ⏰");
            onComplete?.();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const reset = () => {
    clearInterval(intervalRef.current);
    setRemaining(seconds);
    setRunning(false);
  };

  const pct = seconds > 0 ? ((seconds - remaining) / seconds) * 100 : 0;

  return (
    <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4 sm:p-5 flex items-center gap-4">
      <div className="relative w-16 h-16 flex-shrink-0">
        <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke="#fed7aa"
            strokeWidth="6"
          />
          <circle
            cx="32"
            cy="32"
            r="28"
            fill="none"
            stroke="#ea580c"
            strokeWidth="6"
            strokeDasharray={2 * Math.PI * 28}
            strokeDashoffset={2 * Math.PI * 28 * (1 - pct / 100)}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-linear"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <TimerIcon className="w-5 h-5 text-orange-600" />
        </div>
      </div>

      <div className="flex-1">
        <div className="text-2xl font-bold text-stone-900 tabular-nums">
          {formatTime(remaining)}
        </div>
        <div className="text-xs text-stone-500 font-medium uppercase tracking-wide">
          {remaining === 0 ? "Time's up!" : running ? "Running" : "Timer"}
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          size="icon"
          onClick={() => setRunning((r) => !r)}
          disabled={remaining === 0}
          className="bg-orange-600 hover:bg-orange-700 text-white"
        >
          {running ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4" />
          )}
        </Button>
        <Button
          size="icon"
          variant="outline"
          onClick={reset}
          className="border-2 border-stone-300"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// --- Cooking Mode ----------------------------------------------------------

export default function CookingMode({ recipe, onClose }) {
  const steps = recipe.instructions || [];
  const [currentStep, setCurrentStep] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState("");
  const wakeLockRef = useRef(null);
  const availableVoices = useAvailableVoices();

  const selectedVoice =
    availableVoices.find((v) => v.voiceURI === selectedVoiceURI) || null;

  const isFirst = currentStep === 0;
  const isLast = currentStep === steps.length - 1;
  const step = steps[currentStep];

  const timerSeconds = useMemo(() => {
    if (!step) return null;
    return (
      parseDurationSeconds(step.instruction) ||
      parseDurationSeconds(step.tip)
    );
  }, [step]);

  // Default to the first available voice once the list loads
  useEffect(() => {
    if (!selectedVoiceURI && availableVoices.length > 0) {
      setSelectedVoiceURI(availableVoices[0].voiceURI);
    }
  }, [availableVoices, selectedVoiceURI]);

  const goNext = useCallback(() => {
    setCurrentStep((s) => Math.min(s + 1, steps.length - 1));
  }, [steps.length]);

  const goPrev = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 0));
  }, []);

  // Voice control — "next", "back", "repeat", "exit"
  const repeatStep = useCallback(() => {
    if (step)
      speak(
        `Step ${step.step ?? currentStep + 1}. ${step.title}. ${step.instruction}`,
        selectedVoice
      );
  }, [step, currentStep, selectedVoice]);

  const { listening, supported: voiceSupported } = useVoiceControl({
    enabled: voiceEnabled,
    onNext: goNext,
    onPrev: goPrev,
    onRepeat: repeatStep,
    onExit: onClose,
  });

  // Read each step aloud automatically when hands-free mode is on
  useEffect(() => {
    if (voiceEnabled && step) {
      repeatStep();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, voiceEnabled]);

  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [goNext, goPrev, onClose]);

  // Screen Wake Lock — keep the screen on while cooking
  useEffect(() => {
    let released = false;

    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
        }
      } catch (err) {
        console.warn("Wake Lock not available:", err.message);
      }
    };

    requestWakeLock();

    const handleVisibilityChange = () => {
      if (
        !released &&
        document.visibilityState === "visible" &&
        wakeLockRef.current === null
      ) {
        requestWakeLock();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      released = true;
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, []);

  // Prevent background scroll while in cooking mode
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  if (!step) return null;

  const progressPct = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="fixed inset-0 z-[100] bg-stone-50 flex flex-col">
      {/* Top bar */}
      <div className="flex-shrink-0 bg-white border-b-2 border-stone-200 px-4 sm:px-8 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-stone-900 font-bold">
            <ChefHat className="w-5 h-5 text-orange-600" />
            <span className="truncate max-w-[50vw] sm:max-w-none">
              {recipe.title}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!voiceSupported) {
                  toast.error("Voice control isn't supported in this browser.");
                  return;
                }
                setVoiceEnabled((v) => !v);
              }}
              disabled={!voiceSupported}
              title={
                voiceSupported
                  ? "Toggle hands-free voice control"
                  : "Voice control not supported in this browser"
              }
              className={`gap-1.5 border-2 ${
                voiceEnabled
                  ? "bg-orange-600 hover:bg-orange-700 text-white border-orange-600"
                  : "border-stone-300"
              }`}
            >
              {voiceEnabled ? (
                <Mic
                  className={`w-4 h-4 ${listening ? "animate-pulse" : ""}`}
                />
              ) : (
                <MicOff className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">
                {voiceEnabled
                  ? listening
                    ? "Listening…"
                    : "Hands-free on"
                  : "Hands-free"}
              </span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowIngredients((v) => !v)}
              className="border-2 border-stone-300 gap-1.5 hidden sm:flex"
            >
              <ListChecks className="w-4 h-4" />
              Ingredients
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={onClose}
              className="border-2 border-stone-300"
              aria-label="Exit cooking mode"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {voiceEnabled && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-1">
            <p className="text-xs text-stone-500">
              Say <strong>&quot;next&quot;</strong>,{" "}
              <strong>&quot;back&quot;</strong>,{" "}
              <strong>&quot;repeat&quot;</strong>, or{" "}
              <strong>&quot;exit&quot;</strong>
            </p>

            {availableVoices.length > 0 && (
              <label className="flex items-center gap-1.5 text-xs text-stone-500">
                Voice:
                <select
                  value={selectedVoiceURI}
                  onChange={(e) => {
                    setSelectedVoiceURI(e.target.value);
                    // Preview the new voice immediately
                    const preview = availableVoices.find(
                      (v) => v.voiceURI === e.target.value
                    );
                    speak("Voice updated.", preview);
                  }}
                  className="border border-stone-300 rounded px-1.5 py-0.5 text-xs text-stone-700 bg-white"
                >
                  {availableVoices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}

        {/* Progress */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-stone-500 whitespace-nowrap">
            Step {currentStep + 1} of {steps.length}
          </span>
          <div className="flex-1 h-2 bg-stone-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-600 rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Mobile ingredients toggle */}
        <button
          onClick={() => setShowIngredients((v) => !v)}
          className="sm:hidden mt-3 flex items-center gap-1.5 text-sm font-medium text-orange-700"
        >
          <ListChecks className="w-4 h-4" />
          {showIngredients ? "Hide" : "Show"} ingredients
        </button>
      </div>

      {/* Ingredients slide-down */}
      {showIngredients && (
        <div className="flex-shrink-0 bg-orange-50 border-b-2 border-orange-200 px-4 sm:px-8 py-4 max-h-48 overflow-y-auto">
          <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-1.5">
            {recipe.ingredients?.map((ing, i) => (
              <li
                key={i}
                className="flex justify-between text-sm text-stone-700 border-b border-orange-100 py-1"
              >
                <span>{ing.item}</span>
                <span className="font-semibold text-orange-700">
                  {ing.amount}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Main step content */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-8 sm:py-12">
        <div className="max-w-2xl mx-auto">
          <div className="w-14 h-14 rounded-full bg-orange-600 text-white flex items-center justify-center text-xl font-bold mb-6 border-4 border-orange-200">
            {step.step ?? currentStep + 1}
          </div>

          <h2 className="text-2xl sm:text-4xl font-bold text-stone-900 mb-4 tracking-tight">
            {step.title}
          </h2>

          <p className="text-lg sm:text-xl text-stone-700 font-light leading-relaxed mb-6">
            {step.instruction}
          </p>

          {timerSeconds && (
            <StepTimer
              seconds={timerSeconds}
              onComplete={() => {
                if (voiceEnabled && !isLast) {
                  speak("Time's up. Moving to the next step.", selectedVoice);
                  setTimeout(goNext, 3500);
                }
              }}
            />
          )}

          {step.tip && (
            <div className="mt-6 bg-amber-50 border-l-4 border-orange-600 p-4 rounded-r-lg">
              <p className="text-sm sm:text-base text-orange-900 flex items-start gap-2">
                <Lightbulb className="w-5 h-5 mt-0.5 flex-shrink-0 fill-orange-600" />
                <span>
                  <strong className="font-bold">Pro Tip:</strong> {step.tip}
                </span>
              </p>
            </div>
          )}

          {isLast && (
            <div className="mt-8 p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-green-900 mb-1">
                    That&apos;s the last step!
                  </h3>
                  <p className="text-sm text-green-800 font-light">
                    Finish up and enjoy your {recipe.title}. 🎉
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom navigation */}
      <div className="flex-shrink-0 bg-white border-t-2 border-stone-200 px-4 sm:px-8 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Button
            variant="outline"
            onClick={goPrev}
            disabled={isFirst}
            className="flex-1 h-12 border-2 border-stone-300 gap-1.5"
          >
            <ChevronLeft className="w-5 h-5" />
            Previous
          </Button>

          {isLast ? (
            <Button
              onClick={onClose}
              className="flex-1 h-12 bg-green-600 hover:bg-green-700 text-white gap-1.5"
            >
              <CheckCircle2 className="w-5 h-5" />
              Finish
            </Button>
          ) : (
            <Button
              onClick={goNext}
              className="flex-1 h-12 bg-orange-600 hover:bg-orange-700 text-white gap-1.5"
            >
              Next
              <ChevronRight className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
