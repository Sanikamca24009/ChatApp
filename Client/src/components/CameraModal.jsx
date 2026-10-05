import React, { useState, useRef, useEffect, useCallback } from "react";
import toast from "react-hot-toast";

const CameraModal = ({ isOpen, onClose, onSend }) => {
  const [mode, setMode] = useState("photo"); // "photo" | "video"
  const [facingMode, setFacingMode] = useState("user"); // "user" | "environment"
  const [capturedMedia, setCapturedMedia] = useState(null); // { blob, previewUrl, type: "photo" | "video", resolution: string }
  const [caption, setCaption] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [hasCameraError, setHasCameraError] = useState(null);
  const [activeResolution, setActiveResolution] = useState("");

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const timerIntervalRef = useRef(null);
  const fileInputFallbackRef = useRef(null);

  // Stop all camera and audio tracks
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  // Initialize camera with HD constraints
  const startCamera = useCallback(async () => {
    stopStream();
    setHasCameraError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setHasCameraError("Camera access is not supported by your browser.");
      return;
    }

    // High Definition constraints (1080p ideal)
    const hdConstraints = {
      video: {
        facingMode,
        width: { ideal: 1920, min: 1280 },
        height: { ideal: 1080, min: 720 },
      },
      audio: true,
    };

    let stream = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia(hdConstraints);
    } catch (err1) {
      console.warn("HD with audio constraints failed, trying video-only HD...", err1.message);
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
          },
          audio: false,
        });
      } catch (err2) {
        console.warn("HD video-only failed, falling back to standard constraints...", err2.message);
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode },
            audio: true,
          });
        } catch (err3) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });
          } catch (err4) {
            console.error("Camera access completely failed:", err4);
            if (err4.name === "NotAllowedError" || err4.name === "PermissionDeniedError") {
              setHasCameraError("Camera permission denied. Please allow camera access in your browser settings.");
            } else if (err4.name === "NotFoundError" || err4.name === "DevicesNotFoundError") {
              setHasCameraError("No camera found on this device.");
            } else {
              setHasCameraError("Unable to access camera. Please check permissions or close other apps using it.");
            }
            return;
          }
        }
      }
    }

    streamRef.current = stream;

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        const v = videoRef.current;
        if (v) {
          v.play().catch(() => {});
          const w = v.videoWidth || 1280;
          const h = v.videoHeight || 720;
          if (w >= 1920 || h >= 1080) {
            setActiveResolution("Full HD 1080p");
          } else if (w >= 1280 || h >= 720) {
            setActiveResolution("HD 720p");
          } else {
            setActiveResolution(`${w}x${h}`);
          }
        }
      };
    }
  }, [facingMode, stopStream]);

  // Handle open / close lifecycle
  useEffect(() => {
    if (isOpen && !capturedMedia) {
      startCamera();
    } else if (!isOpen) {
      stopStream();
      setCapturedMedia(null);
      setCaption("");
      setIsRecording(false);
      setRecordingSeconds(0);
      setHasCameraError(null);
    }

    return () => {
      stopStream();
    };
  }, [isOpen, capturedMedia, startCamera, stopStream]);

  // Flip camera between front and back
  const handleFlipCamera = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  // Capture HD Photo
  const handleTakePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const width = video.videoWidth || 1920;
    const height = video.videoHeight || 1080;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    // Mirror image if using front camera
    if (facingMode === "user") {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, width, height);

    // Save as high-quality JPEG
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          toast.error("Failed to capture photo");
          return;
        }
        const previewUrl = URL.createObjectURL(blob);
        stopStream();
        setCapturedMedia({
          blob,
          previewUrl,
          type: "photo",
          resolution: activeResolution || `${width}x${height}`,
        });
      },
      "image/jpeg",
      0.95
    );
  };

  // Start recording HD Video
  const handleStartRecording = () => {
    if (!streamRef.current) return;

    let mimeType = "";
    const possibleMimes = [
      "video/webm;codecs=vp9,opus",
      "video/webm;codecs=vp8,opus",
      "video/webm",
      "video/mp4",
    ];

    for (const m of possibleMimes) {
      if (MediaRecorder.isTypeSupported(m)) {
        mimeType = m;
        break;
      }
    }

    try {
      const options = mimeType ? { mimeType, videoBitsPerSecond: 4000000 } : {}; // 4 Mbps for crystal clear HD video
      const recorder = new MediaRecorder(streamRef.current, options);
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const chunks = [...recordedChunksRef.current];
        const finalMime = recorder.mimeType || mimeType || "video/webm";
        const videoBlob = new Blob(chunks, { type: finalMime });
        const previewUrl = URL.createObjectURL(videoBlob);
        stopStream();
        setCapturedMedia({
          blob: videoBlob,
          previewUrl,
          type: "video",
          mimeType: finalMime,
          resolution: activeResolution || "HD Video",
        });
        setIsRecording(false);
        setRecordingSeconds(0);
      };

      recorder.start(1000); // 1-second chunks for reliability
      setIsRecording(true);
      setRecordingSeconds(0);

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Failed to start MediaRecorder:", err);
      toast.error("Could not start video recording: " + err.message);
    }
  };

  // Stop recording HD Video
  const handleStopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  // Retake photo or video
  const handleRetake = () => {
    if (capturedMedia?.previewUrl) {
      URL.revokeObjectURL(capturedMedia.previewUrl);
    }
    setCapturedMedia(null);
    setCaption("");
    startCamera();
  };

  // Send captured photo or video
  const handleSend = async () => {
    if (!capturedMedia) return;
    setIsSending(true);

    try {
      const isVideo = capturedMedia.type === "video";
      const ext = isVideo
        ? capturedMedia.mimeType?.includes("mp4")
          ? "mp4"
          : "webm"
        : "jpg";

      const fileName = isVideo
        ? `HD_Video_${Date.now()}.${ext}`
        : `HD_Photo_${Date.now()}.jpg`;

      const file = new File([capturedMedia.blob], fileName, {
        type: capturedMedia.blob.type || (isVideo ? `video/${ext}` : "image/jpeg"),
      });

      await onSend({
        file,
        text: caption.trim(),
        type: capturedMedia.type,
      });

      // Cleanup and close
      if (capturedMedia.previewUrl) {
        URL.revokeObjectURL(capturedMedia.previewUrl);
      }
      setCapturedMedia(null);
      setCaption("");
      onClose();
    } catch (err) {
      console.error("Failed to send camera media:", err);
      toast.error("Failed to send: " + (err.message || "Unknown error"));
    } finally {
      setIsSending(false);
    }
  };

  // Fallback file picker for uploading existing HD photo/video
  const handleFilePicked = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith("video/");
    const isImage = file.type.startsWith("image/");

    if (!isVideo && !isImage) {
      toast.error("Please select an image or video file");
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      toast.error("File size exceeds 100MB limit");
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    stopStream();
    setCapturedMedia({
      blob: file,
      previewUrl,
      type: isVideo ? "video" : "photo",
      mimeType: file.type,
      resolution: isVideo ? "HD Video File" : "HD Photo File",
    });
    e.target.value = "";
  };

  if (!isOpen) return null;

  const formatTimer = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-2 sm:p-4 select-none animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#161426] border border-white/15 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[96vh]">
        {/* TOP BAR */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#1e1a33]/90 border-b border-white/10 z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-violet-600/30 border border-violet-500/40 flex items-center justify-center text-violet-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <circle cx="12" cy="13" r="3" strokeWidth="2" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white leading-tight">
                {capturedMedia
                  ? capturedMedia.type === "video"
                    ? "Video Preview"
                    : "Photo Preview"
                  : "HD Camera"}
              </h3>
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>{capturedMedia?.resolution || activeResolution || "1080p HD Ready"}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Camera flip (only in live mode) */}
            {!capturedMedia && !isRecording && (
              <button
                type="button"
                onClick={handleFlipCamera}
                title="Switch Camera (Front / Rear)"
                className="p-2 rounded-full text-gray-300 hover:text-white bg-white/5 hover:bg-white/15 transition-colors cursor-pointer"
                aria-label="Switch Camera"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
            )}

            {/* Close Modal button */}
            <button
              type="button"
              onClick={() => {
                if (isRecording) handleStopRecording();
                onClose();
              }}
              title="Close"
              className="p-2 rounded-full text-gray-400 hover:text-white bg-white/5 hover:bg-white/15 transition-colors cursor-pointer"
              aria-label="Close Camera"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* MAIN BODY: VIEWFINDER OR PREVIEW */}
        <div className="relative flex-1 bg-black flex items-center justify-center min-h-[340px] sm:min-h-[440px] overflow-hidden">
          {capturedMedia ? (
            /* PREVIEW SCREEN */
            <div className="relative w-full h-full flex items-center justify-center bg-black/95">
              {capturedMedia.type === "video" ? (
                <video
                  src={capturedMedia.previewUrl}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[50vh] sm:max-h-[60vh] w-auto max-w-full rounded-xl object-contain shadow-2xl"
                />
              ) : (
                <img
                  src={capturedMedia.previewUrl}
                  alt="Captured"
                  className="max-h-[50vh] sm:max-h-[60vh] w-auto max-w-full rounded-xl object-contain shadow-2xl"
                />
              )}

              {/* Quality overlay badge */}
              <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-md border border-white/20 text-emerald-300 text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5 shadow-lg">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>HD • {capturedMedia.resolution}</span>
              </div>
            </div>
          ) : hasCameraError ? (
            /* CAMERA ERROR STATE */
            <div className="flex flex-col items-center justify-center text-center p-6 text-gray-300 max-w-md">
              <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mb-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h4 className="text-base font-semibold text-white mb-1">Camera Unavailable</h4>
              <p className="text-xs text-gray-400 mb-4">{hasCameraError}</p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={startCamera}
                  className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-medium transition-colors cursor-pointer"
                >
                  Retry Camera
                </button>
                <button
                  type="button"
                  onClick={() => fileInputFallbackRef.current?.click()}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-medium transition-colors cursor-pointer"
                >
                  Choose From Files
                </button>
              </div>
            </div>
          ) : (
            /* LIVE VIEWFINDER */
            <div className="relative w-full h-full flex items-center justify-center bg-black">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full max-h-[60vh] object-cover sm:object-contain ${
                  facingMode === "user" ? "scale-x-[-1]" : ""
                }`}
              />

              {/* Recording badge and timer */}
              {isRecording && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600/90 text-white text-xs px-3.5 py-1.5 rounded-full font-mono font-bold flex items-center gap-2 shadow-xl animate-pulse backdrop-blur-md">
                  <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                  <span>REC {formatTimer(recordingSeconds)}</span>
                </div>
              )}

              {/* Resolution badge */}
              <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md border border-white/20 text-emerald-300 text-[11px] px-2.5 py-1 rounded-full font-medium flex items-center gap-1 shadow-md">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>HD {activeResolution || "1080p"}</span>
              </div>
            </div>
          )}
        </div>

        {/* BOTTOM CONTROLS */}
        <div className="p-3 sm:p-4 bg-[#1e1a33]/95 border-t border-white/10 flex flex-col gap-3">
          {capturedMedia ? (
            /* PREVIEW CONTROLS: CAPTION + RETAKE + SEND */
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 bg-[#282142] border border-white/15 rounded-2xl px-3.5 py-2 focus-within:border-violet-400 transition-all">
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Add a caption (optional)..."
                  className="flex-1 bg-transparent text-white text-sm outline-none placeholder-gray-400"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleRetake}
                  disabled={isSending}
                  className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-gray-200 text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  <span>Retake</span>
                </button>

                <button
                  type="button"
                  onClick={handleSend}
                  disabled={isSending}
                  className="flex-1 sm:flex-initial sm:min-w-[150px] px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium text-sm transition-all shadow-lg shadow-violet-600/30 cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                >
                  {isSending ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Sending HD...</span>
                    </>
                  ) : (
                    <>
                      <span>Send {capturedMedia.type === "video" ? "Video" : "Photo"}</span>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* LIVE CAMERA CONTROLS */
            <div className="flex flex-col items-center gap-3">
              {/* PHOTO / VIDEO MODE TOGGLE */}
              <div className="flex items-center bg-black/40 border border-white/10 rounded-full p-1 gap-1">
                <button
                  type="button"
                  disabled={isRecording}
                  onClick={() => setMode("photo")}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase transition-all cursor-pointer ${
                    mode === "photo"
                      ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Photo
                </button>
                <button
                  type="button"
                  disabled={isRecording}
                  onClick={() => setMode("video")}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase transition-all cursor-pointer ${
                    mode === "video"
                      ? "bg-violet-600 text-white shadow-md shadow-violet-600/30"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  Video
                </button>
              </div>

              {/* SHUTTER / ACTION BUTTONS */}
              <div className="flex items-center justify-between w-full max-w-sm px-4">
                {/* Upload from device shortcut */}
                <button
                  type="button"
                  disabled={isRecording}
                  onClick={() => fileInputFallbackRef.current?.click()}
                  title="Upload from device in HD"
                  className="p-3 rounded-full text-gray-400 hover:text-violet-300 bg-white/5 hover:bg-white/15 transition-all cursor-pointer disabled:opacity-40"
                  aria-label="Upload file from device"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </button>

                {/* Hidden input for HD file upload */}
                <input
                  type="file"
                  ref={fileInputFallbackRef}
                  accept="image/*,video/*"
                  hidden
                  onChange={handleFilePicked}
                />

                {/* MAIN SHUTTER BUTTON */}
                {mode === "photo" ? (
                  <button
                    type="button"
                    onClick={handleTakePhoto}
                    className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center bg-white/20 hover:bg-white/40 transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-xl shadow-black/40"
                    title="Take HD Photo"
                    aria-label="Take Photo"
                  >
                    <div className="w-12 h-12 rounded-full bg-white shadow-inner" />
                  </button>
                ) : !isRecording ? (
                  <button
                    type="button"
                    onClick={handleStartRecording}
                    className="w-16 h-16 rounded-full border-4 border-red-500 flex items-center justify-center bg-red-500/20 hover:bg-red-500/40 transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-xl shadow-red-500/30"
                    title="Start HD Video Recording"
                    aria-label="Start Recording"
                  >
                    <div className="w-11 h-11 rounded-full bg-red-500 shadow-md" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStopRecording}
                    className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center bg-red-600 transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-xl shadow-red-600/40 animate-pulse"
                    title="Stop Recording"
                    aria-label="Stop Recording"
                  >
                    <div className="w-6 h-6 rounded-md bg-white shadow-md" />
                  </button>
                )}

                {/* Flip camera shortcut */}
                <button
                  type="button"
                  disabled={isRecording}
                  onClick={handleFlipCamera}
                  title="Switch Camera"
                  className="p-3 rounded-full text-gray-400 hover:text-violet-300 bg-white/5 hover:bg-white/15 transition-all cursor-pointer disabled:opacity-40"
                  aria-label="Switch Camera"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CameraModal;
