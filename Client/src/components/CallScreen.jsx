import React, { useContext, useEffect, useRef, useState } from "react";
import { CallContext } from "../../context/CallContext";
import assets from "../assets/assets";

const GroupVideoTile = ({ participant }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      if (videoRef.current.srcObject !== participant.stream) {
        videoRef.current.srcObject = participant.stream;
      }
      if (!participant.isCameraOff) {
        videoRef.current.play().catch((err) => console.warn(err));
      }
    }
  }, [participant.stream, participant.isCameraOff]);

  const name = participant.userInfo?.fullName || "Member";
  const pic = participant.userInfo?.profilePic || assets.avatar_icon;

  return (
    <div className="relative rounded-2xl overflow-hidden bg-black/70 border border-white/15 flex items-center justify-center aspect-video w-full shadow-lg">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`w-full h-full object-cover ${participant.isCameraOff ? "hidden" : "block"}`}
      />
      {participant.isCameraOff && (
        <div className="flex flex-col items-center justify-center p-3 text-center">
          <img src={pic} alt={name} className="w-12 h-12 rounded-full object-cover mb-1 border border-white/20" />
          <span className="text-xs text-gray-400">Camera Off</span>
        </div>
      )}
      <div className="absolute bottom-2 left-2 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-md text-xs text-white flex items-center gap-1.5 shadow">
        <img src={pic} alt={name} className="w-4 h-4 rounded-full object-cover" />
        <span className="truncate max-w-[120px] font-medium">{name}</span>
      </div>
    </div>
  );
};

const CallScreen = () => {
  const {
    callStatus,
    callPartner,
    callType,
    isGroupCall,
    activeGroup,
    groupParticipants,
    callDuration,
    formatTimer,
    isMuted,
    isCameraOff,
    isRemoteCameraOff,
    localStream,
    remoteStream,
    endReason,
    acceptCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleCamera,
  } = useContext(CallContext);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  // Attach local media stream to local video element
  useEffect(() => {
    if (localVideoRef.current) {
      if (localStream && callType === "video") {
        if (localVideoRef.current.srcObject !== localStream) {
          localVideoRef.current.srcObject = localStream;
        }
        if (!isCameraOff) {
          localVideoRef.current.play().catch((err) => {
            console.warn("Local video play error:", err);
          });
        }
      } else {
        localVideoRef.current.srcObject = null;
      }
    }
  }, [localStream, callType, callStatus, isCameraOff]);

  // Attach remote media stream to remote video element (1-on-1 calls)
  useEffect(() => {
    if (remoteVideoRef.current) {
      if (remoteStream && callType === "video" && !isGroupCall) {
        if (remoteVideoRef.current.srcObject !== remoteStream) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
        if (!isRemoteCameraOff) {
          remoteVideoRef.current.play().catch((err) => {
            console.warn("Remote video play error:", err);
          });
        }
      } else {
        remoteVideoRef.current.srcObject = null;
      }
    }
  }, [remoteStream, callType, callStatus, isGroupCall, isRemoteCameraOff]);

  // Draggable position state for 1-on-1 local preview
  const [pipPos, setPipPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ startX: 0, startY: 0, initialPosX: 0, initialPosY: 0 });

  const handlePointerDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialPosX: pipPos.x,
      initialPosY: pipPos.y,
    };
  };

  useEffect(() => {
    const handlePointerMove = (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - dragStartRef.current.startX;
      const deltaY = e.clientY - dragStartRef.current.startY;
      setPipPos({
        x: dragStartRef.current.initialPosX + deltaX,
        y: dragStartRef.current.initialPosY + deltaY,
      });
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
    }
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [isDragging]);

  if (callStatus === "idle") return null;

  const partnerName = callPartner?.fullName || callPartner?.name || (isGroupCall ? "Group" : "Contact");
  const partnerPic = callPartner?.profilePic || assets.avatar_icon;
  const isVideo = callType === "video";

  // =========================================================================
  // 1. ACTIVE GROUP VIDEO CALL SCREEN (MULTI-USER GRID)
  // =========================================================================
  if (isGroupCall && isVideo && callStatus === "connected") {
    return (
      <div className="fixed inset-0 z-50 bg-[#0d0c15] flex flex-col justify-between overflow-hidden select-none animate-in fade-in duration-200">
        {/* TOP BAR */}
        <div className="relative z-10 p-4 sm:p-5 flex items-center justify-between bg-black/40 backdrop-blur-md border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center text-white shadow-md">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <h4 className="text-white font-semibold text-sm truncate max-w-[200px]">
                {partnerName}
              </h4>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping" />
                <span className="text-xs font-mono text-green-300">{formatTimer(callDuration)}</span>
                <span className="text-xs text-gray-400">• {groupParticipants.length + 1} in call</span>
              </div>
            </div>
          </div>

          <span className="px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider uppercase bg-violet-600/80 text-white shadow-md">
            Group Video
          </span>
        </div>

        {/* PARTICIPANTS GRID */}
        <div className="flex-1 p-4 overflow-y-auto flex items-center justify-center">
          <div className="w-full max-w-5xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 auto-rows-fr">
            {/* USER'S OWN TILE */}
            <div className="relative rounded-2xl overflow-hidden bg-black/70 border-2 border-violet-500/60 aspect-video flex items-center justify-center shadow-lg">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover -scale-x-100 ${
                  isCameraOff ? "hidden" : "block"
                }`}
              />
              {isCameraOff && (
                <div className="flex flex-col items-center justify-center p-3 text-center">
                  <svg className="w-8 h-8 text-gray-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3l18 18" />
                  </svg>
                  <span className="text-xs text-gray-400">Camera Off</span>
                </div>
              )}
              <div className="absolute bottom-2 left-2 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-md text-xs text-white">
                You {isMuted ? "• Muted" : ""}
              </div>
            </div>

            {/* OTHER PARTICIPANTS TILES */}
            {groupParticipants.map((p) => (
              <GroupVideoTile key={p.socketId} participant={p} />
            ))}

            {/* WAITING PLACEHOLDER IF ONLY CALLER */}
            {groupParticipants.length === 0 && (
              <div className="sm:col-span-1 md:col-span-2 rounded-2xl border border-dashed border-white/15 bg-white/5 flex flex-col items-center justify-center p-6 text-center aspect-video">
                <div className="w-12 h-12 rounded-full bg-violet-600/20 text-violet-300 flex items-center justify-center mb-2 animate-pulse">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <p className="text-white text-sm font-medium">Waiting for members to join...</p>
                <p className="text-xs text-gray-400 mt-0.5">Online group members received an incoming call alert</p>
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM CONTROLS */}
        <div className="relative z-10 pb-6 flex items-center justify-center">
          <div className="flex items-center gap-4 sm:gap-6 bg-black/75 backdrop-blur-xl border border-white/15 px-6 sm:px-8 py-3.5 rounded-full shadow-2xl">
            <button
              type="button"
              onClick={toggleMute}
              className={`p-3.5 rounded-full transition-all duration-150 cursor-pointer ${
                isMuted
                  ? "bg-amber-500/30 border border-amber-400 text-amber-300 scale-105"
                  : "bg-white/10 hover:bg-white/20 text-white border border-white/10"
              }`}
              title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
            >
              {isMuted ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>

            <button
              type="button"
              onClick={toggleCamera}
              className={`p-3.5 rounded-full transition-all duration-150 cursor-pointer ${
                isCameraOff
                  ? "bg-amber-500/30 border border-amber-400 text-amber-300 scale-105"
                  : "bg-white/10 hover:bg-white/20 text-white border border-white/10"
              }`}
              title={isCameraOff ? "Turn Camera On" : "Turn Camera Off"}
            >
              {isCameraOff ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3l18 18" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>

            <button
              type="button"
              onClick={endCall}
              className="p-3.5 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/40 transition-all duration-150 cursor-pointer hover:scale-110"
              title="Leave / End Call"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.684A1 1 0 008.279 3H5z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. ACTIVE 1-ON-1 VIDEO CALL SCREEN (FULL SCREEN REMOTE + DRAGGABLE PIP)
  // =========================================================================
  if (!isGroupCall && isVideo && callStatus === "connected") {
    return (
      <div className="fixed inset-0 z-50 bg-[#0d0c15] flex flex-col justify-between overflow-hidden select-none animate-in fade-in duration-200">
        {/* FULL SCREEN REMOTE VIDEO */}
        <div className="absolute inset-0 w-full h-full bg-[#12111d] flex items-center justify-center overflow-hidden">
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={`w-full h-full object-cover ${isRemoteCameraOff ? "hidden" : "block"}`}
          />

          {/* Remote camera is turned off overlay */}
          {isRemoteCameraOff && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#1b1730] to-[#0d0c15] text-center p-4">
              <img
                src={partnerPic}
                alt={partnerName}
                className="w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover border-4 border-violet-500/40 shadow-2xl mb-3"
              />
              <p className="text-white font-semibold text-lg">{partnerName}</p>
              <div className="flex items-center gap-1.5 text-gray-400 text-xs mt-2 bg-black/50 px-3.5 py-1 rounded-full border border-white/10">
                <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3l18 18" />
                </svg>
                <span>Camera is turned off</span>
              </div>
            </div>
          )}

          {/* Fallback if remote video is empty / connecting */}
          {!isRemoteCameraOff && (!remoteStream || remoteStream.getVideoTracks().length === 0) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#1b1730] to-[#0d0c15] text-center p-4">
              <img
                src={partnerPic}
                alt={partnerName}
                className="w-32 h-32 rounded-full object-cover border-4 border-violet-500/40 shadow-2xl mb-4 animate-pulse"
              />
              <p className="text-white font-semibold text-lg">{partnerName}</p>
              <p className="text-violet-300/80 text-xs mt-1 animate-pulse">
                Connecting video stream...
              </p>
            </div>
          )}
        </div>

        {/* TOP FLOATING CALL HEADER */}
        <div className="relative z-10 p-4 sm:p-6 flex items-center justify-between pointer-events-none">
          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-black/60 backdrop-blur-md border border-white/10 shadow-lg pointer-events-auto">
            <img
              src={partnerPic}
              alt={partnerName}
              className="w-7 h-7 rounded-full object-cover border border-white/20"
            />
            <span className="text-white text-sm font-semibold truncate max-w-[150px]">
              {partnerName}
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-ping" />
            <span className="text-xs font-mono font-medium text-green-300">
              {formatTimer(callDuration)}
            </span>
          </div>

          <span className="px-3 py-1 rounded-full text-[11px] font-semibold tracking-wider uppercase bg-violet-600/80 text-white shadow-md pointer-events-auto">
            HD Video
          </span>
        </div>

        {/* DRAGGABLE LOCAL PREVIEW (BOTTOM-RIGHT) */}
        <div
          onPointerDown={handlePointerDown}
          style={{
            transform: `translate(${pipPos.x}px, ${pipPos.y}px)`,
            touchAction: "none",
          }}
          className={`absolute bottom-28 right-4 sm:right-6 z-20 w-32 h-44 sm:w-44 sm:h-60 rounded-2xl overflow-hidden shadow-2xl border-2 border-violet-500/70 bg-black/90 cursor-grab active:cursor-grabbing transition-shadow ${
            isDragging ? "shadow-violet-500/40 scale-105" : ""
          }`}
          title="Drag to reposition"
        >
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full object-cover -scale-x-100 ${
              isCameraOff ? "hidden" : "block"
            }`}
          />
          {isCameraOff && (
            <div className="w-full h-full flex flex-col items-center justify-center bg-black/90 p-2 text-center">
              <svg className="w-6 h-6 text-gray-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3l18 18" />
              </svg>
              <span className="text-[10px] text-gray-400 font-medium">Camera Off</span>
            </div>
          )}

          <div className="absolute bottom-1.5 left-1.5 bg-black/70 px-2 py-0.5 rounded-md text-[10px] text-white/90 font-medium pointer-events-none backdrop-blur-xs">
            You {isMuted ? "• Muted" : ""}
          </div>
        </div>

        {/* BOTTOM FLOATING CALL CONTROLS */}
        <div className="relative z-10 pb-6 sm:pb-8 flex items-center justify-center">
          <div className="flex items-center gap-4 sm:gap-6 bg-black/70 backdrop-blur-xl border border-white/15 px-6 sm:px-8 py-3.5 rounded-full shadow-2xl">
            <button
              type="button"
              onClick={toggleMute}
              className={`p-3.5 rounded-full transition-all duration-150 cursor-pointer ${
                isMuted
                  ? "bg-amber-500/30 border border-amber-400 text-amber-300 scale-105"
                  : "bg-white/10 hover:bg-white/20 text-white border border-white/10"
              }`}
              title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
            >
              {isMuted ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>

            <button
              type="button"
              onClick={toggleCamera}
              className={`p-3.5 rounded-full transition-all duration-150 cursor-pointer ${
                isCameraOff
                  ? "bg-amber-500/30 border border-amber-400 text-amber-300 scale-105"
                  : "bg-white/10 hover:bg-white/20 text-white border border-white/10"
              }`}
              title={isCameraOff ? "Turn Camera On" : "Turn Camera Off"}
            >
              {isCameraOff ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3l18 18" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>

            <button
              type="button"
              onClick={endCall}
              className="p-3.5 rounded-full bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/40 transition-all duration-150 cursor-pointer hover:scale-110"
              title="End Call"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.684A1 1 0 008.279 3H5z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 3. MODAL OVERLAY (INCOMING / OUTGOING / CONNECTED VOICE CALL / ENDED)
  // =========================================================================
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm rounded-3xl bg-[#1b1730]/95 border border-violet-500/30 shadow-2xl p-6 sm:p-8 flex flex-col items-center text-center overflow-hidden">
        {/* Ambient background glow */}
        <div className="absolute -top-20 -left-20 w-44 h-44 bg-violet-600/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-44 h-44 bg-fuchsia-600/25 rounded-full blur-3xl pointer-events-none" />

        {/* CALL STATUS BANNER */}
        <span className="text-xs font-semibold uppercase tracking-wider text-violet-300/80 mb-5 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20">
          {callStatus === "ringing"
            ? isGroupCall
              ? `Incoming Group ${isVideo ? "Video" : "Voice"} Call`
              : `Incoming ${isVideo ? "Video" : "Voice"} Call`
            : callStatus === "calling"
            ? isGroupCall
              ? `Group ${isVideo ? "Video" : "Voice"} Call`
              : `Outgoing ${isVideo ? "Video" : "Voice"} Call`
            : callStatus === "connected"
            ? isGroupCall
              ? "Group Voice Call"
              : "Voice Call in Progress"
            : "Call Ended"}
        </span>

        {/* AVATAR WITH ANIMATED PULSE */}
        <div className="relative my-3">
          {(callStatus === "ringing" || callStatus === "calling") && (
            <>
              <div className="absolute inset-0 rounded-full bg-violet-500/30 animate-ping opacity-75" />
              <div className="absolute -inset-3 rounded-full bg-violet-500/20 animate-pulse" />
            </>
          )}

          {callStatus === "connected" && (
            <div className="absolute -inset-2 rounded-full border-2 border-green-500/50 animate-pulse" />
          )}

          {isGroupCall ? (
            <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center text-white border-4 border-violet-500/40 shadow-xl">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          ) : (
            <img
              src={partnerPic}
              alt={partnerName}
              className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover border-4 border-violet-500/40 shadow-xl"
            />
          )}

          {/* Video indicator badge */}
          {isVideo && (
            <span className="absolute bottom-0 right-0 bg-violet-600 text-white p-2 rounded-full border-2 border-[#1b1730] shadow-md">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </span>
          )}
        </div>

        {/* CONTACT OR GROUP NAME */}
        <h3 className="text-xl sm:text-2xl font-bold text-white mt-4 truncate max-w-[250px]">
          {partnerName}
        </h3>

        {/* SUBTITLE */}
        <div className="mt-1 mb-8">
          {callStatus === "connected" ? (
            <div className="flex flex-col items-center gap-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-ping" />
                <span className="text-lg font-mono font-medium text-green-300">
                  {formatTimer(callDuration)}
                </span>
              </div>
              {isGroupCall && (
                <span className="text-xs text-violet-300/80 font-medium">
                  {groupParticipants.length + 1} connected
                </span>
              )}
            </div>
          ) : callStatus === "calling" ? (
            <p className="text-sm text-violet-200/70 animate-pulse">
              {isVideo ? "Calling (Video)..." : "Ringing..."}
            </p>
          ) : callStatus === "ringing" ? (
            <p className="text-sm text-violet-200/70 animate-pulse">
              {isGroupCall
                ? `Started by ${callPartner?.callerName || "a member"}`
                : isVideo
                ? "Incoming video call..."
                : "Incoming voice call..."}
            </p>
          ) : (
            <p className="text-sm text-red-300 font-medium">
              {endReason || "Call ended"}
            </p>
          )}
        </div>

        {/* CONTROLS */}
        <div className="w-full flex items-center justify-center gap-6">
          {/* INCOMING CALL CONTROLS */}
          {callStatus === "ringing" && (
            <>
              {/* DECLINE BUTTON */}
              <button
                type="button"
                onClick={rejectCall}
                className="flex flex-col items-center gap-1.5 group cursor-pointer"
                title="Decline"
              >
                <div className="w-14 h-14 rounded-full bg-red-600/90 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-600/40 transition-all duration-150 group-hover:scale-110">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                      d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.684A1 1 0 008.279 3H5z"
                    />
                  </svg>
                </div>
                <span className="text-xs text-gray-300 font-medium">Decline</span>
              </button>

              {/* ACCEPT BUTTON */}
              <button
                type="button"
                onClick={acceptCall}
                className="flex flex-col items-center gap-1.5 group cursor-pointer"
                title="Accept"
              >
                <div className="w-14 h-14 rounded-full bg-green-600 hover:bg-green-500 text-white flex items-center justify-center shadow-lg shadow-green-600/40 transition-all duration-150 group-hover:scale-110 animate-bounce">
                  {isVideo ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.5"
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2.5"
                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a11.042 11.042 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                      />
                    </svg>
                  )}
                </div>
                <span className="text-xs text-gray-300 font-medium">Join</span>
              </button>
            </>
          )}

          {/* OUTGOING CALL CONTROLS */}
          {callStatus === "calling" && (
            <button
              type="button"
              onClick={endCall}
              className="flex flex-col items-center gap-1.5 group cursor-pointer"
              title="Cancel Call"
            >
              <div className="w-14 h-14 rounded-full bg-red-600/90 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-600/40 transition-all duration-150 group-hover:scale-110">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.684A1 1 0 008.279 3H5z"
                  />
                </svg>
              </div>
              <span className="text-xs text-gray-300 font-medium">Cancel</span>
            </button>
          )}

          {/* CONNECTED VOICE CALL CONTROLS */}
          {callStatus === "connected" && !isVideo && (
            <>
              {/* MUTE / UNMUTE BUTTON */}
              <button
                type="button"
                onClick={toggleMute}
                className="flex flex-col items-center gap-1.5 group cursor-pointer"
                title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
              >
                <div
                  className={`w-14 h-14 rounded-full flex items-center justify-center transition-all duration-150 group-hover:scale-110 border ${
                    isMuted
                      ? "bg-amber-500/25 border-amber-400 text-amber-300 shadow-lg shadow-amber-500/20"
                      : "bg-white/10 hover:bg-white/20 border-white/20 text-white"
                  }`}
                >
                  {isMuted ? (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                      />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                      />
                    </svg>
                  )}
                </div>
                <span className="text-xs text-gray-300 font-medium">
                  {isMuted ? "Unmute" : "Mute"}
                </span>
              </button>

              {/* END / LEAVE CALL BUTTON */}
              <button
                type="button"
                onClick={endCall}
                className="flex flex-col items-center gap-1.5 group cursor-pointer"
                title={isGroupCall ? "Leave Group Call" : "End Call"}
              >
                <div className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 text-white flex items-center justify-center shadow-lg shadow-red-600/40 transition-all duration-150 group-hover:scale-110">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2.5"
                      d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.684A1 1 0 008.279 3H5z"
                    />
                  </svg>
                </div>
                <span className="text-xs text-gray-300 font-medium">
                  {isGroupCall ? "Leave" : "End"}
                </span>
              </button>
            </>
          )}

          {/* CALL ENDED STATE */}
          {callStatus === "ended" && (
            <div className="py-2 text-sm text-gray-400">Closing...</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallScreen;
