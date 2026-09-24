import React, { useState, useRef, useEffect, useMemo } from "react";
import { formatMessageTime } from "../lib/utils";

// Predefined waveform heights pattern for realistic voice note visualization
const WAVE_BARS = [
  30, 45, 70, 40, 85, 60, 95, 50, 40, 75, 90, 60, 35, 80, 100, 70, 55, 85, 45,
  65, 90, 50, 35, 60, 80, 45, 30, 55,
];

// Global manager to ensure only one audio plays at a time
let currentPlayingAudio = null;

const AudioMessagePlayer = ({ src, isMe, createdAt, status }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLoaded, setIsLoaded] = useState(false);

  const audioRef = useRef(null);
  const waveContainerRef = useRef(null);

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
        setIsLoaded(true);
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("pause", handlePause);

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("pause", handlePause);
      if (currentPlayingAudio === audio) {
        currentPlayingAudio = null;
      }
    };
  }, [src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      if (currentPlayingAudio && currentPlayingAudio !== audio) {
        currentPlayingAudio.pause();
      }
      currentPlayingAudio = audio;
      audio.playbackRate = playbackRate;
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.warn("Audio playback error:", err);
      });
    }
  };

  const handleSeek = (e) => {
    if (!audioRef.current || !duration || duration === 0) return;
    const rect = waveContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clickX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const seekPercentage = clickX / rect.width;
    const newTime = seekPercentage * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const toggleSpeed = (e) => {
    e.stopPropagation();
    const nextRate = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const formatAudioTime = (seconds) => {
    if (!seconds || isNaN(seconds) || !isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className={`flex flex-col gap-1.5 p-2.5 sm:p-3 rounded-2xl select-none transition-all max-w-[280px] sm:max-w-[320px] ${
        isMe
          ? "bg-violet-600/80 text-white rounded-br-xs shadow-md shadow-violet-600/20"
          : "bg-[#282142]/90 border border-white/10 text-white rounded-bl-xs shadow-md"
      }`}
    >
      <div className="flex items-center gap-3">
        {/* PLAY / PAUSE BUTTON */}
        <button
          type="button"
          onClick={togglePlay}
          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-transform active:scale-95 cursor-pointer shadow-md ${
            isMe
              ? "bg-white text-violet-600 hover:bg-violet-100"
              : "bg-violet-600 hover:bg-violet-500 text-white"
          }`}
          title={isPlaying ? "Pause voice message" : "Play voice message"}
          aria-label={isPlaying ? "Pause voice message" : "Play voice message"}
        >
          {isPlaying ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* WAVEFORM BARS CONTAINER */}
        <div className="flex flex-col flex-1 min-w-0">
          <div
            ref={waveContainerRef}
            onClick={handleSeek}
            className="flex items-center gap-[2.5px] h-7 cursor-pointer py-1 relative"
            title="Click to seek"
          >
            {WAVE_BARS.map((heightPercent, idx) => {
              const barPercent = (idx / (WAVE_BARS.length - 1)) * 100;
              const hasPlayed = barPercent <= progressPercent;

              return (
                <div
                  key={idx}
                  style={{ height: `${heightPercent}%` }}
                  className={`w-1 rounded-full transition-colors duration-75 flex-shrink-0 ${
                    hasPlayed
                      ? isMe
                        ? "bg-white"
                        : "bg-violet-400"
                      : isMe
                      ? "bg-white/35 hover:bg-white/50"
                      : "bg-white/20 hover:bg-white/35"
                  }`}
                />
              );
            })}
          </div>

          {/* DURATION & SPEED CONTROLS */}
          <div className="flex items-center justify-between text-[11px] text-white/80 font-mono mt-0.5">
            <span>
              {isPlaying ? formatAudioTime(currentTime) : formatAudioTime(duration || currentTime)}
            </span>

            <button
              type="button"
              onClick={toggleSpeed}
              className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-semibold tracking-wider transition-colors cursor-pointer ${
                isMe
                  ? "bg-white/20 hover:bg-white/30 text-white"
                  : "bg-violet-500/25 hover:bg-violet-500/40 text-violet-300"
              }`}
              title="Change playback speed"
            >
              {playbackRate}x
            </button>
          </div>
        </div>
      </div>

      {/* FOOTER INFO (TIMESTAMP + STATUS) */}
      <div className="flex items-center justify-end gap-1.5 text-[10px] text-white/60 pt-0.5">
        <div className="flex items-center gap-1">
          <svg className="w-3 h-3 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          <span>Voice</span>
        </div>
        <span>•</span>
        {createdAt && <span>{formatMessageTime(createdAt)}</span>}
        {isMe && status && (
          <span className="ml-0.5">
            {status === "read" ? (
              <span className="text-cyan-300">✓✓</span>
            ) : status === "delivered" ? (
              <span>✓✓</span>
            ) : (
              <span>✓</span>
            )}
          </span>
        )}
      </div>
    </div>
  );
};

export default AudioMessagePlayer;
