import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { AuthContext } from "./AuthContext";
import toast from "react-hot-toast";

export const CallContext = createContext();

const RTC_CONFIG = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};

// Web Audio API Ringtone / Dialtone Synthesizer
class SoundSynthesizer {
  constructor() {
    this.audioCtx = null;
    this.intervalId = null;
    this.isPlaying = false;
  }

  init() {
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
  }

  // Ringback tone for caller (ringing...)
  playDialTone() {
    this.stop();
    this.init();
    if (!this.audioCtx) return;
    this.isPlaying = true;

    const playBeep = () => {
      if (!this.isPlaying || !this.audioCtx) return;
      try {
        const osc1 = this.audioCtx.createOscillator();
        const osc2 = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc1.type = "sine";
        osc1.frequency.setValueAtTime(440, this.audioCtx.currentTime); // 440Hz
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(480, this.audioCtx.currentTime); // 480Hz

        gain.gain.setValueAtTime(0.08, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 1.2);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc1.start();
        osc2.start();
        osc1.stop(this.audioCtx.currentTime + 1.2);
        osc2.stop(this.audioCtx.currentTime + 1.2);
      } catch (e) {
        console.error("Dialtone beep error:", e);
      }
    };

    playBeep();
    this.intervalId = setInterval(playBeep, 3000);
  }

  // Incoming ringtone for receiver (chime)
  playRingtone() {
    this.stop();
    this.init();
    if (!this.audioCtx) return;
    this.isPlaying = true;

    const playChime = () => {
      if (!this.isPlaying || !this.audioCtx) return;
      try {
        const notes = [587.33, 739.99, 880.0]; // D5, F#5, A5
        notes.forEach((freq, idx) => {
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          const startTime = this.audioCtx.currentTime + idx * 0.15;

          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, startTime);

          gain.gain.setValueAtTime(0.12, startTime);
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

          osc.connect(gain);
          gain.connect(this.audioCtx.destination);

          osc.start(startTime);
          osc.stop(startTime + 0.4);
        });
      } catch (e) {
        console.error("Ringtone chime error:", e);
      }
    };

    playChime();
    this.intervalId = setInterval(playChime, 2000);
  }

  stop() {
    this.isPlaying = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

const soundSynth = new SoundSynthesizer();

export const CallProvider = ({ children }) => {
  const { authUser, socket } = useContext(AuthContext);

  // Call status: "idle" | "calling" | "ringing" | "connected" | "ended"
  const [callStatus, setCallStatus] = useState("idle");
  const [callPartner, setCallPartner] = useState(null);
  const [callType, setCallType] = useState("voice"); // "voice" | "video"
  const [isGroupCall, setIsGroupCall] = useState(false);
  const [activeGroup, setActiveGroup] = useState(null);
  const [groupParticipants, setGroupParticipants] = useState([]); // [{ socketId, userId, userInfo, stream }]
  const [isCaller, setIsCaller] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isRemoteCameraOff, setIsRemoteCameraOff] = useState(false);
  const [endReason, setEndReason] = useState("");

  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  const peerConnectionRef = useRef(null);
  const groupPeersRef = useRef(new Map()); // socketId -> { pc, userInfo, audioEl }
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(new Audio());
  const incomingOfferRef = useRef(null);
  const incomingGroupOfferRef = useRef(null);
  const callTimerRef = useRef(null);
  const timeoutTimerRef = useRef(null);
  const callDurationRef = useRef(0);
  const callPartnerRef = useRef(null);
  const isCallerRef = useRef(false);
  const callTypeRef = useRef("voice");
  const isGroupCallRef = useRef(false);
  const activeGroupRef = useRef(null);
  const hasAnyMemberJoinedRef = useRef(false);

  // Sync refs with state
  useEffect(() => {
    callPartnerRef.current = callPartner;
  }, [callPartner]);

  useEffect(() => {
    isCallerRef.current = isCaller;
  }, [isCaller]);

  useEffect(() => {
    callDurationRef.current = callDuration;
  }, [callDuration]);

  useEffect(() => {
    callTypeRef.current = callType;
  }, [callType]);

  useEffect(() => {
    isGroupCallRef.current = isGroupCall;
  }, [isGroupCall]);

  useEffect(() => {
    activeGroupRef.current = activeGroup;
  }, [activeGroup]);

  // Clean up audio element
  useEffect(() => {
    const audioEl = remoteAudioRef.current;
    audioEl.autoplay = true;
    return () => {
      audioEl.pause();
      audioEl.srcObject = null;
    };
  }, []);

  // Stop media tracks and close all peer connections
  const cleanupMediaAndPeer = useCallback(() => {
    soundSynth.stop();

    if (timeoutTimerRef.current) {
      clearTimeout(timeoutTimerRef.current);
      timeoutTimerRef.current = null;
    }

    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);

    // Close 1-on-1 PC
    if (peerConnectionRef.current) {
      peerConnectionRef.current.onicecandidate = null;
      peerConnectionRef.current.ontrack = null;
      peerConnectionRef.current.onconnectionstatechange = null;
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Close all Group PCs
    groupPeersRef.current.forEach(({ pc, audioEl }) => {
      if (pc) {
        pc.onicecandidate = null;
        pc.ontrack = null;
        pc.close();
      }
      if (audioEl) {
        audioEl.pause();
        audioEl.srcObject = null;
      }
    });
    groupPeersRef.current.clear();
    setGroupParticipants([]);

    if (remoteAudioRef.current) {
      remoteAudioRef.current.pause();
      remoteAudioRef.current.srcObject = null;
    }

    incomingOfferRef.current = null;
    incomingGroupOfferRef.current = null;
    hasAnyMemberJoinedRef.current = false;
    setIsMuted(false);
    setIsCameraOff(false);
    setIsRemoteCameraOff(false);
  }, []);

  // Reset to idle state after brief notice
  const finishCall = useCallback(
    (reason = "") => {
      cleanupMediaAndPeer();
      setEndReason(reason);
      setCallStatus("ended");

      setTimeout(() => {
        setCallStatus("idle");
        setCallPartner(null);
        setIsCaller(false);
        setIsGroupCall(false);
        setActiveGroup(null);
        setCallDuration(0);
        setEndReason("");
        setCallType("voice");
      }, 2000);
    },
    [cleanupMediaAndPeer]
  );

  // Initialize 1-on-1 RTCPeerConnection
  const createPeerConnection = useCallback(
    (partnerId) => {
      const pc = new RTCPeerConnection(RTC_CONFIG);

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit("call:ice-candidate", {
            targetUserId: partnerId,
            candidate: event.candidate,
          });
        }
      };

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          const stream = event.streams[0];
          setRemoteStream(stream);
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = stream;
            remoteAudioRef.current
              .play()
              .catch((err) => console.log("Auto-play error:", err));
          }
        }
      };

      pc.onconnectionstatechange = () => {
        if (
          pc.connectionState === "disconnected" ||
          pc.connectionState === "failed" ||
          pc.connectionState === "closed"
        ) {
          if (callStatus === "connected") {
            finishCall("Call disconnected");
          }
        }
      };

      peerConnectionRef.current = pc;
      return pc;
    },
    [socket, callStatus, finishCall]
  );

  // Initialize Group Mesh RTCPeerConnection for a specific peer
  const createGroupPeerConnection = useCallback(
    (targetSocketId, userInfo) => {
      if (groupPeersRef.current.has(targetSocketId)) {
        return groupPeersRef.current.get(targetSocketId).pc;
      }

      const pc = new RTCPeerConnection(RTC_CONFIG);
      const audioEl = new Audio();
      audioEl.autoplay = true;

      // Add local tracks to this peer
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current);
        });
      }

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit("call:group-signal", {
            targetSocketId,
            fromSocketId: socket.id,
            fromUserId: authUser?._id,
            fromUserInfo: authUser,
            signal: { candidate: event.candidate },
          });
        }
      };

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          const stream = event.streams[0];
          audioEl.srcObject = stream;
          audioEl.play().catch(() => {});

          setGroupParticipants((prev) => {
            const exists = prev.some((p) => p.socketId === targetSocketId);
            if (exists) {
              return prev.map((p) =>
                p.socketId === targetSocketId ? { ...p, stream } : p
              );
            }
            return [
              ...prev,
              {
                socketId: targetSocketId,
                userId: userInfo?._id || targetSocketId,
                userInfo,
                stream,
              },
            ];
          });
        }
      };

      groupPeersRef.current.set(targetSocketId, { pc, userInfo, audioEl });
      return pc;
    },
    [socket, authUser]
  );

  // ---------------- 1-ON-1 CALL ACTIONS ----------------

  const startCall = async (contact, type = "voice") => {
    if (!contact || !contact._id || !authUser || !socket) return;
    if (callStatus !== "idle") {
      toast.error("You are already in a call");
      return;
    }

    try {
      setCallType(type);
      callTypeRef.current = type;
      setIsGroupCall(false);
      setActiveGroup(null);
      setIsCameraOff(false);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === "video",
      });
      localStreamRef.current = stream;
      setLocalStream(stream);

      setCallPartner(contact);
      setIsCaller(true);
      setCallStatus("calling");
      setCallDuration(0);

      soundSynth.playDialTone();

      const pc = createPeerConnection(contact._id);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit("call:offer", {
        callerId: authUser._id,
        receiverId: contact._id,
        callerInfo: {
          _id: authUser._id,
          fullName: authUser.fullName,
          profilePic: authUser.profilePic,
        },
        callType: type,
        offer,
      });

      timeoutTimerRef.current = setTimeout(() => {
        if (socket) {
          socket.emit("call:timeout", {
            callerId: authUser._id,
            receiverId: contact._id,
            callType: type,
          });
        }
        finishCall("No answer");
      }, 30000);
    } catch (err) {
      console.error("Error starting call:", err);
      toast.error(
        err.name === "NotAllowedError"
          ? `${type === "video" ? "Camera/Microphone" : "Microphone"} access was denied.`
          : `Could not access ${type === "video" ? "camera/microphone" : "microphone"}.`
      );
      cleanupMediaAndPeer();
      setCallStatus("idle");
    }
  };

  const acceptCall = async () => {
    if (isGroupCall) {
      return acceptGroupCall();
    }

    if (callStatus !== "ringing" || !incomingOfferRef.current || !socket || !authUser)
      return;

    soundSynth.stop();
    const { callerId, callerInfo, offer, callType: incomingType = "voice" } =
      incomingOfferRef.current;

    try {
      setCallType(incomingType);
      callTypeRef.current = incomingType;
      setIsCameraOff(false);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: incomingType === "video",
      });
      localStreamRef.current = stream;
      setLocalStream(stream);

      const pc = createPeerConnection(callerId);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit("call:answer", {
        callerId,
        receiverId: authUser._id,
        answer,
      });

      setCallStatus("connected");
      setCallDuration(0);

      callTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Error accepting call:", err);
      toast.error("Failed to connect call media");
      rejectCall();
    }
  };

  const rejectCall = () => {
    soundSynth.stop();
    if (isGroupCall) {
      cleanupMediaAndPeer();
      setCallStatus("idle");
      setCallPartner(null);
      return;
    }

    if (incomingOfferRef.current && socket && authUser) {
      const { callerId, callType: incomingType = "voice" } = incomingOfferRef.current;
      socket.emit("call:reject", {
        callerId,
        receiverId: authUser._id,
        reason: "declined",
        callType: incomingType,
      });
    }
    cleanupMediaAndPeer();
    setCallStatus("idle");
    setCallPartner(null);
  };

  // ---------------- GROUP CALL ACTIONS ----------------

  const startGroupCall = async (group, type = "voice") => {
    if (!group || !group._id || !authUser || !socket) return;
    if (callStatus !== "idle") {
      toast.error("You are already in a call");
      return;
    }

    try {
      setCallType(type);
      callTypeRef.current = type;
      setIsGroupCall(true);
      setActiveGroup(group);
      setCallPartner({
        _id: group._id,
        fullName: group.name,
        profilePic: null,
        isGroup: true,
      });
      setIsCaller(true);
      setIsCameraOff(false);
      hasAnyMemberJoinedRef.current = false;

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === "video",
      });
      localStreamRef.current = stream;
      setLocalStream(stream);

      setCallStatus("connected");
      setCallDuration(0);

      callTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);

      socket.emit("call:group-offer", {
        groupId: group._id,
        groupName: group.name,
        callerInfo: {
          _id: authUser._id,
          fullName: authUser.fullName,
          profilePic: authUser.profilePic,
        },
        callType: type,
      });
    } catch (err) {
      console.error("Error starting group call:", err);
      toast.error(
        err.name === "NotAllowedError"
          ? `${type === "video" ? "Camera/Microphone" : "Microphone"} access was denied.`
          : `Could not access ${type === "video" ? "camera/microphone" : "microphone"}.`
      );
      cleanupMediaAndPeer();
      setCallStatus("idle");
    }
  };

  const acceptGroupCall = async () => {
    if (!incomingGroupOfferRef.current || !socket || !authUser) return;

    soundSynth.stop();
    const { groupId, groupName, callerInfo, callType: incomingType } =
      incomingGroupOfferRef.current;

    try {
      setCallType(incomingType);
      callTypeRef.current = incomingType;
      setIsGroupCall(true);
      setActiveGroup({ _id: groupId, name: groupName });
      setIsCameraOff(false);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: incomingType === "video",
      });
      localStreamRef.current = stream;
      setLocalStream(stream);

      setCallStatus("connected");
      setCallDuration(0);

      callTimerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);

      socket.emit("call:group-join", {
        groupId,
        userId: authUser._id,
        userInfo: {
          _id: authUser._id,
          fullName: authUser.fullName,
          profilePic: authUser.profilePic,
        },
      });
    } catch (err) {
      console.error("Error accepting group call:", err);
      toast.error("Failed to connect group media");
      finishCall();
    }
  };

  // ---------------- GENERAL CONTROLS ----------------

  const endCall = () => {
    const isGrp = isGroupCallRef.current;
    const grp = activeGroupRef.current;
    const partner = callPartnerRef.current;
    const duration = callDurationRef.current;
    const wasCaller = isCallerRef.current;
    const currentType = callTypeRef.current;

    if (isGrp && grp && socket && authUser) {
      if (wasCaller) {
        socket.emit("call:group-end", {
          groupId: grp._id,
          callerId: authUser._id,
          duration,
          callType: currentType,
          status: "answered",
        });
      } else {
        socket.emit("call:group-leave", {
          groupId: grp._id,
          userId: authUser._id,
          duration,
        });
      }
      finishCall("Group call ended");
      return;
    }

    if (socket && authUser && partner) {
      const callerId = wasCaller ? authUser._id : partner._id;
      const receiverId = wasCaller ? partner._id : authUser._id;
      const status = callStatus === "connected" ? "answered" : "declined";

      socket.emit("call:end", {
        callerId,
        receiverId,
        duration,
        status,
        callType: currentType,
      });
    }

    finishCall(callStatus === "connected" ? "Call ended" : "Call cancelled");
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        const nextEnabled = !videoTrack.enabled;
        videoTrack.enabled = nextEnabled;
        const nextCameraOff = !nextEnabled;
        setIsCameraOff(nextCameraOff);

        // Notify remote peer / group members
        if (socket) {
          if (isGroupCallRef.current && activeGroupRef.current) {
            socket.emit("call:group-camera-toggle", {
              groupId: activeGroupRef.current._id,
              userId: authUser?._id,
              isCameraOff: nextCameraOff,
            });
          } else if (callPartnerRef.current) {
            socket.emit("call:camera-toggle", {
              targetUserId: callPartnerRef.current._id,
              fromUserId: authUser?._id,
              isCameraOff: nextCameraOff,
            });
          }
        }
      }
    }
  };

  // ---------------- SOCKET LISTENERS ----------------
  useEffect(() => {
    if (!socket) return;

    // 1-on-1 Incoming
    const handleIncomingCall = ({ callerId, receiverId, callerInfo, callType: incomingType = "voice", offer }) => {
      if (callStatus !== "idle") {
        socket.emit("call:reject", {
          callerId,
          receiverId,
          reason: "busy",
          callType: incomingType,
        });
        return;
      }

      setIsGroupCall(false);
      setActiveGroup(null);
      setCallType(incomingType);
      callTypeRef.current = incomingType;
      incomingOfferRef.current = { callerId, callerInfo, offer, callType: incomingType };
      setCallPartner(callerInfo);
      setIsCaller(false);
      setCallStatus("ringing");
      setCallDuration(0);

      soundSynth.playRingtone();
    };

    // 1-on-1 Answered
    const handleCallAnswered = async ({ answer }) => {
      soundSynth.stop();
      if (timeoutTimerRef.current) {
        clearTimeout(timeoutTimerRef.current);
        timeoutTimerRef.current = null;
      }

      if (peerConnectionRef.current) {
        try {
          await peerConnectionRef.current.setRemoteDescription(
            new RTCSessionDescription(answer)
          );
          setCallStatus("connected");
          setCallDuration(0);

          callTimerRef.current = setInterval(() => {
            setCallDuration((prev) => prev + 1);
          }, 1000);
        } catch (err) {
          console.error("Error setting remote description from answer:", err);
        }
      }
    };

    // 1-on-1 ICE
    const handleIceCandidate = async ({ candidate }) => {
      if (peerConnectionRef.current && candidate) {
        try {
          await peerConnectionRef.current.addIceCandidate(
            new RTCIceCandidate(candidate)
          );
        } catch (err) {
          console.error("Error adding received ICE candidate:", err);
        }
      }
    };

    const handleCallRejected = ({ reason }) => {
      const msg = reason === "busy" ? "User is busy" : "Call declined";
      finishCall(msg);
    };

    const handleCallTimeout = () => {
      finishCall("No answer");
    };

    const handleCallEnded = () => {
      finishCall("Call ended");
    };

    const handleCallFailed = ({ reason }) => {
      finishCall(reason || "Call failed");
    };

    // ---------------- GROUP SOCKET EVENTS ----------------

    // Group Incoming Call Announcement
    const handleGroupIncoming = ({ groupId, groupName, callerInfo, callType: incomingType = "voice" }) => {
      if (callStatus !== "idle") return; // Busy in another call

      setIsGroupCall(true);
      setActiveGroup({ _id: groupId, name: groupName });
      setCallType(incomingType);
      callTypeRef.current = incomingType;
      incomingGroupOfferRef.current = { groupId, groupName, callerInfo, callType: incomingType };
      setCallPartner({
        _id: groupId,
        fullName: groupName,
        profilePic: callerInfo?.profilePic,
        callerName: callerInfo?.fullName,
        isGroup: true,
      });
      setIsCaller(false);
      setCallStatus("ringing");
      setCallDuration(0);

      soundSynth.playRingtone();
    };

    // Group: Joining user receives list of existing users in the call
    const handleGroupExistingUsers = async ({ users, callType: grpType }) => {
      if (!users || !Array.isArray(users)) return;
      if (users.length > 0) {
        hasAnyMemberJoinedRef.current = true;
      }

      for (const participant of users) {
        try {
          const pc = createGroupPeerConnection(participant.socketId, participant.userInfo);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);

          socket.emit("call:group-signal", {
            targetSocketId: participant.socketId,
            fromSocketId: socket.id,
            fromUserId: authUser?._id,
            fromUserInfo: authUser,
            signal: offer,
          });
        } catch (err) {
          console.error("Error creating group offer to existing user:", err);
        }
      }
    };

    // Group: Existing participant notified that a new user joined
    const handleGroupUserJoined = ({ socketId, userId, userInfo }) => {
      hasAnyMemberJoinedRef.current = true;
      createGroupPeerConnection(socketId, userInfo);
    };

    // Group: Mesh signaling (Offer, Answer, ICE)
    const handleGroupSignal = async ({ fromSocketId, fromUserId, fromUserInfo, signal }) => {
      try {
        let peerData = groupPeersRef.current.get(fromSocketId);
        let pc = peerData?.pc;

        if (!pc) {
          pc = createGroupPeerConnection(fromSocketId, fromUserInfo);
        }

        if (signal.type === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          socket.emit("call:group-signal", {
            targetSocketId: fromSocketId,
            fromSocketId: socket.id,
            fromUserId: authUser?._id,
            fromUserInfo: authUser,
            signal: answer,
          });
        } else if (signal.type === "answer") {
          await pc.setRemoteDescription(new RTCSessionDescription(signal));
        } else if (signal.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
        }
      } catch (err) {
        console.error("Error handling group signal:", err);
      }
    };

    // Group: Participant left
    const handleGroupUserLeft = ({ socketId }) => {
      if (groupPeersRef.current.has(socketId)) {
        const { pc, audioEl } = groupPeersRef.current.get(socketId);
        if (pc) pc.close();
        if (audioEl) audioEl.pause();
        groupPeersRef.current.delete(socketId);
      }
      setGroupParticipants((prev) => {
        const remaining = prev.filter((p) => p.socketId !== socketId);
        if (remaining.length === 0) {
          setTimeout(() => {
            finishCall("All other participants left the call");
          }, 300);
        }
        return remaining;
      });
    };

    // Group: Entire call ended by host or server
    const handleGroupEnded = (data) => {
      finishCall(data?.reason || "Group call ended");
    };

    socket.on("call:incoming", handleIncomingCall);
    socket.on("call:answered", handleCallAnswered);
    socket.on("call:ice-candidate", handleIceCandidate);
    socket.on("call:rejected", handleCallRejected);
    socket.on("call:timeout", handleCallTimeout);
    socket.on("call:ended", handleCallEnded);
    socket.on("call:failed", handleCallFailed);

    socket.on("call:group-incoming", handleGroupIncoming);
    socket.on("call:group-existing-users", handleGroupExistingUsers);
    socket.on("call:group-user-joined", handleGroupUserJoined);
    socket.on("call:group-signal", handleGroupSignal);
    socket.on("call:group-user-left", handleGroupUserLeft);
    socket.on("call:group-ended", handleGroupEnded);

    const handleCameraToggle = ({ isCameraOff: remoteOff }) => {
      setIsRemoteCameraOff(Boolean(remoteOff));
    };

    const handleGroupCameraToggle = ({ userId: targetUId, isCameraOff: remoteOff }) => {
      setGroupParticipants((prev) =>
        prev.map((p) =>
          String(p.userId) === String(targetUId)
            ? { ...p, isCameraOff: Boolean(remoteOff) }
            : p
        )
      );
    };

    socket.on("call:camera-toggle", handleCameraToggle);
    socket.on("call:group-camera-toggle", handleGroupCameraToggle);

    return () => {
      socket.off("call:incoming", handleIncomingCall);
      socket.off("call:answered", handleCallAnswered);
      socket.off("call:ice-candidate", handleIceCandidate);
      socket.off("call:rejected", handleCallRejected);
      socket.off("call:timeout", handleCallTimeout);
      socket.off("call:ended", handleCallEnded);
      socket.off("call:failed", handleCallFailed);

      socket.off("call:group-incoming", handleGroupIncoming);
      socket.off("call:group-existing-users", handleGroupExistingUsers);
      socket.off("call:group-user-joined", handleGroupUserJoined);
      socket.off("call:group-signal", handleGroupSignal);
      socket.off("call:group-user-left", handleGroupUserLeft);
      socket.off("call:group-ended", handleGroupEnded);

      socket.off("call:camera-toggle", handleCameraToggle);
      socket.off("call:group-camera-toggle", handleGroupCameraToggle);
    };
  }, [socket, callStatus, authUser, finishCall, createPeerConnection, createGroupPeerConnection]);

  // Auto-cut group call when only 1 person remains in the call
  useEffect(() => {
    if (!isGroupCall || callStatus !== "connected") return;

    // Caller waiting alone: timeout after 30 seconds if nobody joined
    if (callDuration >= 30 && groupParticipants.length === 0 && !hasAnyMemberJoinedRef.current) {
      finishCall("No one joined the call");
      if (socket && activeGroupRef.current && isCallerRef.current) {
        socket.emit("call:group-end", {
          groupId: activeGroupRef.current._id,
          callerId: authUser?._id,
          duration: 0,
          status: "missed",
          callType: callTypeRef.current,
        });
      }
    }
  }, [isGroupCall, callStatus, callDuration, groupParticipants.length, finishCall, socket, authUser]);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <CallContext.Provider
      value={{
        callStatus,
        callPartner,
        callType,
        isGroupCall,
        activeGroup,
        groupParticipants,
        isCaller,
        callDuration,
        formatTimer,
        isMuted,
        isCameraOff,
        isRemoteCameraOff,
        localStream,
        remoteStream,
        endReason,
        startCall,
        startGroupCall,
        acceptCall,
        acceptGroupCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleCamera,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};
