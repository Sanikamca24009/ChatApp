import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import assets from "../assets/assets";
import { formatMessageTime, formatLastSeen, formatDateDivider, isDifferentDay } from "../lib/utils";
import { ChatContext } from "../../context/ChatContext";
import { AuthContext } from "../../context/AuthContext";
import { CallContext } from "../../context/CallContext";
import toast from "react-hot-toast";
import AudioMessagePlayer from "./AudioMessagePlayer";

const COMMON_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

const ChatContainer = () => {
  const {
    messages,
    selectedUser,
    setSelectedUser,
    sendMessage,
    getMessages,
    editMessage,
    deleteForEveryone,
    deleteForMe,
    toggleReaction,
    users,
    typingUser,
    showRightSidebar,
    setShowRightSidebar,
    exitGroup,
  } = useContext(ChatContext);

  const { authUser, onlineUsers, socket } = useContext(AuthContext);
  const { startCall, startGroupCall } = useContext(CallContext);

  const currentChatUser =
    users.find((u) => u._id === selectedUser?._id) || selectedUser;
  const isOnline = selectedUser && onlineUsers.includes(selectedUser._id);

  const isGroupCreator = useMemo(() => {
    if (!selectedUser?.isGroup || !authUser) return false;
    const adminId = String(selectedUser.admin?._id || selectedUser.admin || "");
    return String(authUser._id) === adminId;
  }, [selectedUser, authUser]);

  const groupAdminName = useMemo(() => {
    if (!selectedUser?.isGroup) return "";
    if (selectedUser.admin && typeof selectedUser.admin === "object" && selectedUser.admin.fullName) {
      return selectedUser.admin.fullName;
    }
    const adminId = String(selectedUser.admin?._id || selectedUser.admin || "");
    if (authUser && String(authUser._id) === adminId) {
      return "you";
    }
    const member = (selectedUser.members || []).find((m) => String(m._id || m) === adminId);
    if (member && member.fullName) return member.fullName;
    const foundUser = (users || []).find((u) => String(u._id) === adminId);
    if (foundUser && foundUser.fullName) return foundUser.fullName;
    return "Admin";
  }, [selectedUser, authUser, users]);

  const groupMembersText = useMemo(() => {
    if (!selectedUser?.isGroup || !Array.isArray(selectedUser.members)) return "";
    const names = selectedUser.members
      .map((m) => {
        if (!m) return "";
        const mId = String(m._id || m);
        if (authUser && String(authUser._id) === mId) {
          return "You";
        }
        return m.fullName || "";
      })
      .filter(Boolean);

    // Place "You" first if present
    names.sort((a, b) => (a === "You" ? -1 : b === "You" ? 1 : 0));
    return names.join(", ");
  }, [selectedUser, authUser]);

  const scrollEnd = useRef(null);
  const messagesContainerRef = useRef(null);
  const isInitialLoadRef = useRef(true);
  const prevMessagesCountRef = useRef(0);
  const fileInputRef = useRef(null);
  const touchTimerRef = useRef(null);

  const scrollToBottom = (behavior = "auto") => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior,
      });
    }
    if (scrollEnd.current) {
      scrollEnd.current.scrollIntoView({ behavior, block: "end" });
    }
  };

  const isNearBottom = () => {
    if (!messagesContainerRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    return scrollHeight - scrollTop - clientHeight < 150;
  };

  const handleImageLoad = () => {
    if (isInitialLoadRef.current || isNearBottom()) {
      scrollToBottom("auto");
    }
  };

  const [input, setInput] = useState("");
  const [modalImage, setModalImage] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [contextMenu, setContextMenu] = useState(null); // { message, x, y }
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editInput, setEditInput] = useState("");
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // In-conversation message search states
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const searchInputRef = useRef(null);

  // Voice recording states and refs
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [liveWaveBars, setLiveWaveBars] = useState([25, 45, 75, 40, 90, 60, 35, 55]);
  const [isSendingAudio, setIsSendingAudio] = useState(false);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const animationFrameRef = useRef(null);
  const isHoldingRef = useRef(false);
  const holdTimeoutRef = useRef(null);
  const recordingStartTimeRef = useRef(0);
  const isCancellingRef = useRef(false);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const cleanupRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (holdTimeoutRef.current) {
      clearTimeout(holdTimeoutRef.current);
      holdTimeoutRef.current = null;
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      try {
        audioContextRef.current.close();
      } catch (err) {
        // ignore
      }
      audioContextRef.current = null;
    }
    setIsRecording(false);
    setRecordingDuration(0);
    isHoldingRef.current = false;
  };

  const startRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        toast.error("Microphone access is not supported on this browser");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;

      let mimeType = "";
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/webm")) {
        mimeType = "audio/webm";
      } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
        mimeType = "audio/mp4";
      } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
        mimeType = "audio/ogg";
      }

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      isCancellingRef.current = false;
      recordingStartTimeRef.current = Date.now();

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const wasCancelled = isCancellingRef.current;
        const duration = (Date.now() - recordingStartTimeRef.current) / 1000;
        const chunks = [...audioChunksRef.current];

        cleanupRecording();

        if (wasCancelled) {
          return;
        }

        if (duration < 0.6) {
          toast("Voice note too short", { icon: "⚠️" });
          return;
        }

        const blobType = recorder.mimeType || mimeType || "audio/webm";
        const audioBlob = new Blob(chunks, { type: blobType });

        let fileExt = "webm";
        if (blobType.includes("mp4")) fileExt = "mp4";
        else if (blobType.includes("ogg")) fileExt = "ogg";

        const formData = new FormData();
        formData.append("audio", audioBlob, `voice_note_${Date.now()}.${fileExt}`);
        formData.append("messageType", "audio");

        setIsSendingAudio(true);
        const sendingToast = toast.loading("Sending voice message...");

        try {
          await sendMessage(formData);
          toast.dismiss(sendingToast);
        } catch (err) {
          toast.dismiss(sendingToast);
          toast.error("Failed to send voice message");
        } finally {
          setIsSendingAudio(false);
        }
      };

      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          const audioCtx = new AudioCtx();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          source.connect(analyser);
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const updateWave = () => {
            if (!analyserRef.current) return;
            analyserRef.current.getByteFrequencyData(dataArray);
            const step = Math.floor(dataArray.length / 8) || 1;
            const bars = [];
            for (let i = 0; i < 8; i++) {
              const val = dataArray[i * step] || 0;
              const height = Math.min(100, Math.max(20, Math.round((val / 255) * 100)));
              bars.push(height);
            }
            setLiveWaveBars(bars);
            animationFrameRef.current = requestAnimationFrame(updateWave);
          };
          updateWave();
        }
      } catch (audioErr) {
        console.warn("Audio visualizer error:", audioErr);
      }

      recorder.start(100);
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error("Failed to start voice recording:", err);
      cleanupRecording();
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        toast.error("Microphone permission denied. Please allow microphone access.");
      } else {
        toast.error("Failed to access microphone");
      }
    }
  };

  const stopAndSendRecording = () => {
    isCancellingRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    } else {
      cleanupRecording();
    }
  };

  const cancelRecording = () => {
    isCancellingRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    } else {
      cleanupRecording();
    }
    toast("Recording discarded", { icon: "🗑️" });
  };

  const handleMicMouseDown = (e) => {
    e.preventDefault();
    if (isRecording) {
      stopAndSendRecording();
      return;
    }

    isHoldingRef.current = false;
    holdTimeoutRef.current = setTimeout(() => {
      isHoldingRef.current = true;
    }, 350);

    const handleGlobalRelease = () => {
      window.removeEventListener("mouseup", handleGlobalRelease);
      window.removeEventListener("touchend", handleGlobalRelease);

      if (holdTimeoutRef.current) {
        clearTimeout(holdTimeoutRef.current);
        holdTimeoutRef.current = null;
      }

      if (isHoldingRef.current) {
        stopAndSendRecording();
      }
    };

    window.addEventListener("mouseup", handleGlobalRelease);
    window.addEventListener("touchend", handleGlobalRelease);

    startRecording();
  };

  // Filter messages that contain the search query (non-deleted text only)
  const matchingMessageIds = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.trim().toLowerCase();
    const result = [];
    messages.forEach((msg) => {
      if (!msg.isDeleted && msg.text && msg.text.toLowerCase().includes(q)) {
        result.push(msg._id);
      }
    });
    return result;
  }, [messages, searchQuery]);

  // Reset search when active chat changes
  useEffect(() => {
    setIsSearchOpen(false);
    setSearchQuery("");
    setCurrentMatchIndex(0);
  }, [selectedUser?._id]);

  // Reset match index when query changes
  useEffect(() => {
    setCurrentMatchIndex(0);
  }, [searchQuery]);

  // Auto-scroll to current matching message
  useEffect(() => {
    if (!isSearchOpen || matchingMessageIds.length === 0) return;
    const activeMsgId = matchingMessageIds[currentMatchIndex];
    if (activeMsgId) {
      const el = document.getElementById(`msg-${activeMsgId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [currentMatchIndex, matchingMessageIds, isSearchOpen]);

  const handlePrevMatch = () => {
    if (matchingMessageIds.length === 0) return;
    setCurrentMatchIndex((prev) =>
      prev === 0 ? matchingMessageIds.length - 1 : prev - 1
    );
  };

  const handleNextMatch = () => {
    if (matchingMessageIds.length === 0) return;
    setCurrentMatchIndex((prev) =>
      prev === matchingMessageIds.length - 1 ? 0 : prev + 1
    );
  };

  const renderHighlightedText = (text, query, isCurrentMatch) => {
    if (!query || !query.trim() || !text) return text;
    const trimmed = query.trim();
    const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(${escaped})`, "gi");
    const parts = text.split(regex);

    return parts.map((part, i) => {
      if (part.toLowerCase() === trimmed.toLowerCase()) {
        return (
          <mark
            key={i}
            className={`px-0.5 rounded transition-all ${
              isCurrentMatch
                ? "bg-amber-400 text-black font-semibold ring-2 ring-amber-300 shadow-xs"
                : "bg-amber-400/40 text-amber-200"
            }`}
          >
            {part}
          </mark>
        );
      }
      return part;
    });
  };

  const typingTimerRef = useRef(null);
  const lastEmitTimeRef = useRef(0);

  const isWithin15Minutes = (createdAt) => {
    if (!createdAt) return false;
    const diffMs = Date.now() - new Date(createdAt).getTime();
    return diffMs <= 15 * 60 * 1000;
  };

  useEffect(() => {
    const handleCloseMenu = () => setContextMenu(null);
    const handleWindowKey = (e) => {
      if (e.key === "Escape") {
        setContextMenu(null);
        setEditingMessageId(null);
        setIsSearchOpen(false);
        setSearchQuery("");
      }
    };
    window.addEventListener("click", handleCloseMenu);
    window.addEventListener("scroll", handleCloseMenu, true);
    window.addEventListener("keydown", handleWindowKey);
    return () => {
      window.removeEventListener("click", handleCloseMenu);
      window.removeEventListener("scroll", handleCloseMenu, true);
      window.removeEventListener("keydown", handleWindowKey);
    };
  }, []);

  const handleContextMenu = (e, msg, isMe) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 220);
    const y = Math.min(e.clientY, window.innerHeight - 200);
    const isExpired = !isWithin15Minutes(msg.createdAt);
    setContextMenu({ message: msg, isMe, x, y, isExpired });
  };

  const handleTouchStart = (e, msg, isMe) => {
    const touch = e.touches[0];
    const clientX = touch.clientX;
    const clientY = touch.clientY;

    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    touchTimerRef.current = setTimeout(() => {
      const x = Math.min(clientX, window.innerWidth - 220);
      const y = Math.min(clientY, window.innerHeight - 200);
      const isExpired = !isWithin15Minutes(msg.createdAt);
      setContextMenu({ message: msg, isMe, x, y, isExpired });
    }, 500);
  };

  const handleTouchEndOrMove = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  const handleSaveEdit = async (messageId) => {
    if (!editInput.trim()) {
      toast.error("Message text cannot be empty");
      return;
    }
    setIsSubmittingEdit(true);
    const success = await editMessage(messageId, editInput.trim());
    setIsSubmittingEdit(false);
    if (success) {
      setEditingMessageId(null);
      setEditInput("");
    }
  };

  const handleDeleteMessage = async (messageId) => {
    await deleteMessage(messageId);
  };

  const handleRemoveSelectedImage = () => {
    setSelectedImage((prev) => {
      if (prev?.previewUrl) {
        URL.revokeObjectURL(prev.previewUrl);
      }
      return null;
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image size must be less than 10MB");
      return;
    }

    if (selectedImage?.previewUrl) {
      URL.revokeObjectURL(selectedImage.previewUrl);
    }

    const previewUrl = URL.createObjectURL(file);
    setSelectedImage({ file, previewUrl });
    e.target.value = "";
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setModalImage(null);
    };
    if (modalImage) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalImage]);

  useEffect(() => {
    isInitialLoadRef.current = true;
    prevMessagesCountRef.current = 0;
    if (selectedUser) {
      getMessages(selectedUser._id, Boolean(selectedUser.isGroup));
      if (!selectedUser.isGroup && socket && authUser) {
        socket.emit("markRead", {
          senderId: selectedUser._id,
          receiverId: authUser._id,
        });
      }
    }
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      handleRemoveSelectedImage();
      cleanupRecording();
    };
  }, [selectedUser?._id, selectedUser?.isGroup]);

  useEffect(() => {
    return () => {
      cleanupRecording();
    };
  }, []);

  useEffect(() => {
    if (!messages || messages.length === 0) return;

    if (isInitialLoadRef.current) {
      // Instant scroll to bottom on open so user never sees the top / starting chat
      scrollToBottom("auto");

      const t1 = setTimeout(() => scrollToBottom("auto"), 50);
      const t2 = setTimeout(() => scrollToBottom("auto"), 150);
      const t3 = setTimeout(() => {
        scrollToBottom("auto");
        isInitialLoadRef.current = false;
      }, 400);

      prevMessagesCountRef.current = messages.length;
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    } else {
      const isNewMessageAdded = messages.length > prevMessagesCountRef.current;
      prevMessagesCountRef.current = messages.length;

      if (isNewMessageAdded) {
        const lastMsg = messages[messages.length - 1];
        const lastSenderId = String(lastMsg?.senderId?._id || lastMsg?.senderId || "");
        const myIdStr = String(authUser?._id || authUser?.id || "");
        const isMyMsg = Boolean(lastSenderId && myIdStr && lastSenderId === myIdStr);
        if (isMyMsg || isNearBottom()) {
          scrollToBottom("smooth");
        }
      }
    }
  }, [messages]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      if (isInitialLoadRef.current || isNearBottom()) {
        container.scrollTop = container.scrollHeight;
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [selectedUser?._id]);

  if (!selectedUser) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6 bg-[#161622]/40 select-none">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-violet-600/30 to-purple-500/10 border border-violet-500/20 flex items-center justify-center mb-4 shadow-lg shadow-violet-900/10">
          <svg className="w-8 h-8 sm:w-10 sm:h-10 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <h2 className="text-xl sm:text-2xl font-semibold text-white mb-2">
          QuickChat for Web
        </h2>
        <p className="text-sm text-gray-400 max-w-sm mb-6">
          Send and receive messages with real-time delivery status, online presence, and image sharing.
        </p>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-gray-400">
          <svg className="w-3.5 h-3.5 text-violet-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
          End-to-end encrypted messaging
        </div>
      </div>
    );
  }

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInput(value);

    if (!socket || !selectedUser || !authUser) return;

    if (value.trim()) {
      const now = Date.now();
      if (now - lastEmitTimeRef.current > 1500) {
        socket.emit("typing", {
          senderId: authUser._id,
          receiverId: selectedUser._id,
        });
        lastEmitTimeRef.current = now;
      }

      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        socket.emit("stopTyping", {
          senderId: authUser._id,
          receiverId: selectedUser._id,
        });
        lastEmitTimeRef.current = 0;
      }, 2000);
    } else {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      socket.emit("stopTyping", {
        senderId: authUser._id,
        receiverId: selectedUser._id,
      });
      lastEmitTimeRef.current = 0;
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() && !selectedImage) return;

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (socket && selectedUser && authUser) {
      socket.emit("stopTyping", {
        senderId: authUser._id,
        receiverId: selectedUser._id,
      });
      lastEmitTimeRef.current = 0;
    }

    if (selectedImage) {
      const formData = new FormData();
      formData.append("image", selectedImage.file);
      if (input.trim()) {
        formData.append("text", input.trim());
      }

      setUploadingImage(true);
      const loadingToast = toast.loading("Sending image...");

      try {
        await sendMessage(formData);
        setInput("");
        handleRemoveSelectedImage();
        toast.dismiss(loadingToast);
      } catch (err) {
        toast.dismiss(loadingToast);
        toast.error("Failed to send image");
      } finally {
        setUploadingImage(false);
      }
    } else {
      await sendMessage({ text: input.trim() });
      setInput("");
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#12111d]/50 text-white min-w-0">
      {/* HEADER */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-3 sm:px-4 py-3 border-b border-white/10 bg-[#161622]/95 backdrop-blur-md">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
          {/* Back button for mobile */}
          <button
            onClick={() => setSelectedUser(null)}
            className="md:hidden p-1.5 -ml-1 text-gray-300 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer flex-shrink-0"
            aria-label="Back to contacts"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* User info */}
          <div
            className="flex items-center gap-2.5 min-w-0 flex-1"
          >
            <div className="relative flex-shrink-0">
              {selectedUser.isGroup ? (
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center text-white border border-white/20 shadow-sm flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
              ) : (
                <>
                  <img
                    src={selectedUser.profilePic || assets.avatar_icon}
                    alt={selectedUser.fullName}
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border border-white/10"
                  />
                  {isOnline && (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-[#161622] rounded-full" />
                  )}
                </>
              )}
            </div>

            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-white font-medium text-sm sm:text-base truncate group-hover:text-violet-300 transition-colors">
                  {selectedUser.name || selectedUser.fullName}
                </span>
              </div>
              {selectedUser.isGroup ? (
                <span className="text-xs text-gray-400 truncate" title={groupMembersText}>
                  {groupMembersText}
                </span>
              ) : typingUser ? (
                <span className="text-xs text-violet-400 italic font-medium animate-pulse">
                  typing...
                </span>
              ) : isOnline ? (
                <span className="text-xs text-green-400 font-medium">Online</span>
              ) : (
                <span className="text-xs text-gray-400 truncate">
                  {formatLastSeen(currentChatUser?.lastSeen)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* VOICE CALL BUTTON */}
          {((!selectedUser?.isGroup && isOnline) || selectedUser?.isGroup) && (
            <button
              type="button"
              onClick={() =>
                selectedUser?.isGroup
                  ? startGroupCall(selectedUser, "voice")
                  : startCall(selectedUser, "voice")
              }
              className="p-2 rounded-full text-green-400 hover:text-green-300 hover:bg-green-500/15 transition-all cursor-pointer"
              title={
                selectedUser?.isGroup
                  ? `Group voice call in ${selectedUser.name || "group"}`
                  : `Voice call ${selectedUser.fullName || selectedUser.name || "contact"}`
              }
              aria-label="Start voice call"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a11.042 11.042 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
            </button>
          )}

          {/* VIDEO CALL BUTTON */}
          {((!selectedUser?.isGroup && isOnline) || selectedUser?.isGroup) && (
            <button
              type="button"
              onClick={() =>
                selectedUser?.isGroup
                  ? startGroupCall(selectedUser, "video")
                  : startCall(selectedUser, "video")
              }
              className="p-2 rounded-full text-violet-400 hover:text-violet-300 hover:bg-violet-500/15 transition-all cursor-pointer"
              title={
                selectedUser?.isGroup
                  ? `Group video call in ${selectedUser.name || "group"}`
                  : `Video call ${selectedUser.fullName || selectedUser.name || "contact"}`
              }
              aria-label="Start video call"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </button>
          )}

          {/* SEARCH TOGGLE BUTTON */}
          <button
            onClick={() => {
              setIsSearchOpen((prev) => {
                const nextState = !prev;
                if (nextState) {
                  setTimeout(() => searchInputRef.current?.focus(), 100);
                } else {
                  setSearchQuery("");
                }
                return nextState;
              });
            }}
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              isSearchOpen
                ? "text-violet-400 bg-violet-500/20"
                : "text-gray-400 hover:text-white hover:bg-white/10"
            }`}
            title="Search conversation"
            aria-label="Search conversation"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </button>

          {/* EXIT GROUP BUTTON (For groups) */}
          {selectedUser.isGroup && (
            <button
              onClick={() => setShowExitModal(true)}
              className="p-2 rounded-full text-red-400/80 hover:text-red-300 hover:bg-red-500/15 transition-colors cursor-pointer"
              title={`Exit ${selectedUser.name || "group"}`}
              aria-label="Exit group"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          )}

          {/* Right Info / Profile Toggle Button */}
          <button
            onClick={() => setShowRightSidebar((prev) => !prev)}
            className={`p-2 rounded-full transition-colors cursor-pointer ${
              showRightSidebar
                ? "text-violet-400 bg-violet-500/20"
                : "text-gray-400 hover:text-white hover:bg-white/10"
            }`}
            title="Contact Info & Media"
            aria-label="Toggle contact info"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* IN-CONVERSATION SEARCH BAR OVERLAY */}
      {isSearchOpen && (
        <div className="sticky top-[61px] z-20 flex items-center justify-between gap-2 px-3 sm:px-4 py-2 bg-[#1b172c]/95 border-b border-violet-500/30 backdrop-blur-md animate-in slide-in-from-top-2 duration-150 shadow-lg">
          <div className="flex-1 flex items-center gap-2 bg-[#282142]/90 border border-white/10 focus-within:border-violet-500/70 rounded-lg px-3 py-1.5 transition-all">
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (e.shiftKey) handlePrevMatch();
                  else handleNextMatch();
                } else if (e.key === "Escape") {
                  setIsSearchOpen(false);
                  setSearchQuery("");
                }
              }}
              placeholder="Search in conversation..."
              className="flex-1 bg-transparent text-white text-sm outline-none placeholder-gray-400 min-w-0"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-gray-400 hover:text-white p-0.5 rounded cursor-pointer"
                title="Clear search"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Results counter & arrows */}
          <div className="flex items-center gap-1.5 text-xs text-gray-300 select-none flex-shrink-0">
            {searchQuery.trim() ? (
              <span className="text-[11px] font-medium text-gray-300 px-1">
                {matchingMessageIds.length > 0
                  ? `${currentMatchIndex + 1} of ${matchingMessageIds.length}`
                  : "0 results"}
              </span>
            ) : null}

            <button
              type="button"
              disabled={matchingMessageIds.length === 0}
              onClick={handlePrevMatch}
              className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-gray-200 hover:text-white transition-colors cursor-pointer"
              title="Previous match (Shift + Enter)"
              aria-label="Previous match"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 15l7-7 7 7" />
              </svg>
            </button>

            <button
              type="button"
              disabled={matchingMessageIds.length === 0}
              onClick={handleNextMatch}
              className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed text-gray-200 hover:text-white transition-colors cursor-pointer"
              title="Next match (Enter)"
              aria-label="Next match"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsSearchOpen(false);
                setSearchQuery("");
              }}
              className="p-1.5 rounded-md hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer ml-0.5"
              title="Close search (Esc)"
              aria-label="Close search"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* MESSAGES */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3"
      >
        {selectedUser?.isGroup && (
          <div className="flex items-center justify-center my-2 select-none">
            <span className="text-[11px] font-medium text-violet-200/90 bg-[#201a35]/90 border border-violet-500/25 px-3.5 py-1.5 rounded-full shadow-sm backdrop-blur-sm">
              {isGroupCreator
                ? "You created this group"
                : `${groupAdminName} added you to this group`}
            </span>
          </div>
        )}
        {messages.map((msg, index) => {
          const senderIdStr = String(msg.senderId?._id || msg.senderId || "");
          const myIdStr = String(authUser?._id || authUser?.id || "");
          const isMe = Boolean(senderIdStr && myIdStr && senderIdStr === myIdStr);
          const eligibleForMenu = !msg.isDeleted;
          const isEditingThis = editingMessageId === msg._id;
          const isCurrentMatch = isSearchOpen && matchingMessageIds[currentMatchIndex] === msg._id;
          const isAnyMatch = isSearchOpen && matchingMessageIds.includes(msg._id);
          const showDateDivider =
            index === 0 ||
            isDifferentDay(messages[index - 1]?.createdAt, msg.createdAt);

          return (
            <React.Fragment key={msg._id || index}>
              {showDateDivider && msg.createdAt && (
                <div className="flex items-center justify-center my-2.5 select-none">
                  <span className="text-[11px] font-medium text-gray-300 bg-[#201a35]/90 border border-white/10 px-3 py-1 rounded-full shadow-sm backdrop-blur-sm">
                    {formatDateDivider(msg.createdAt)}
                  </span>
                </div>
              )}
              {msg.messageType === "call" ? (
                (() => {
                  const isCallVideo =
                    msg.callDetails?.callType === "video" ||
                    (msg.text && msg.text.includes("🎥"));
                  const isAnswered = msg.callDetails?.status === "answered";
                  return (
                    <div
                      id={`msg-${msg._id}`}
                      className="flex items-center justify-center my-2 select-none scroll-mt-28"
                    >
                      <div
                        className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs shadow-sm backdrop-blur-md transition-all ${
                          isAnswered
                            ? "bg-green-950/40 border-green-500/30 text-green-200"
                            : "bg-red-950/40 border-red-500/30 text-red-200"
                        }`}
                      >
                        {isCallVideo ? (
                          isAnswered ? (
                            <svg className="w-3.5 h-3.5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 3l18 18" />
                            </svg>
                          )
                        ) : (
                          isAnswered ? (
                            <svg className="w-3.5 h-3.5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a11.042 11.042 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                            </svg>
                          ) : (
                            <svg className="w-3.5 h-3.5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M16 8l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M5 3a2 2 0 00-2 2v1c0 8.284 6.716 15 15 15h1a2 2 0 002-2v-3.28a1 1 0 00-.684-.948l-4.493-1.498a1 1 0 00-1.21.502l-1.13 2.257a11.042 11.042 0 01-5.516-5.517l2.257-1.128a1 1 0 00.502-1.21L9.228 3.684A1 1 0 008.279 3H5z" />
                            </svg>
                          )
                        )}
                        <span className="font-medium">{msg.text}</span>
                        {msg.createdAt && (
                          <span className="text-[10px] text-gray-400 ml-1">
                            {formatMessageTime(msg.createdAt)}
                          </span>
                        )}
                        {((!selectedUser?.isGroup && isOnline) || selectedUser?.isGroup) && !isAnswered && (
                          <button
                            type="button"
                            onClick={() =>
                              selectedUser?.isGroup
                                ? startGroupCall(selectedUser, isCallVideo ? "video" : "voice")
                                : startCall(selectedUser, isCallVideo ? "video" : "voice")
                            }
                            className="ml-1 text-[11px] font-semibold text-violet-300 hover:text-white underline cursor-pointer"
                          >
                            {selectedUser?.isGroup ? "Start call" : "Call back"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })()
              ) : (
                <div
                  id={`msg-${msg._id}`}
                  className={`flex flex-col ${isMe ? "items-end" : "items-start"} scroll-mt-28 transition-all`}
                >
                <div className="relative group max-w-[85%] sm:max-w-[75%] md:max-w-[65%]">
                {/* FLOATING QUICK REACTION BAR ON HOVER (DESKTOP) */}
                {!msg.isDeleted && (
                  <div
                    className={`absolute -top-5 ${
                      isMe ? "right-2" : "left-2"
                    } z-20 hidden group-hover:flex items-center gap-1 bg-[#201a35]/95 border border-white/20 shadow-xl rounded-full px-2 py-0.5 backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 select-none`}
                  >
                    {COMMON_EMOJIS.map((emoji) => {
                      const hasReacted = (msg.reactions || []).some(
                        (r) => String(r.userId) === String(authUser?._id) && r.emoji === emoji
                      );
                      return (
                        <button
                          key={emoji}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleReaction(msg._id, emoji);
                          }}
                          className={`text-base sm:text-lg hover:scale-130 transition-transform duration-100 p-0.5 cursor-pointer rounded-full ${
                            hasReacted ? "scale-125 bg-violet-600/40" : "hover:bg-white/10"
                          }`}
                          title={hasReacted ? `Remove ${emoji}` : `React ${emoji}`}
                        >
                          {emoji}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* MESSAGE BUBBLE */}
                {(msg.messageType === "audio" || msg.audio) && !msg.isDeleted ? (
                  <div
                    onContextMenu={(e) => handleContextMenu(e, msg, isMe)}
                    onTouchStart={(e) => handleTouchStart(e, msg, isMe)}
                    onTouchEnd={handleTouchEndOrMove}
                    onTouchMove={handleTouchEndOrMove}
                    className={`transition-all select-none ${
                      isCurrentMatch
                        ? "ring-2 ring-amber-400 shadow-lg shadow-amber-400/25 rounded-2xl"
                        : isAnyMatch
                        ? "ring-1 ring-amber-400/40 rounded-2xl"
                        : ""
                    }`}
                  >
                    {selectedUser?.isGroup && !isMe && (
                      <p className="text-[11px] font-semibold text-violet-300 mb-1 px-1 select-none truncate">
                        {msg.senderId?.fullName || "Member"}
                      </p>
                    )}
                    <AudioMessagePlayer
                      src={msg.audio}
                      isMe={isMe}
                      createdAt={msg.createdAt}
                      status={msg.status}
                    />
                    {msg.text && (
                      <p className="text-xs text-white/90 mt-1 px-1 break-words">
                        {isSearchOpen && searchQuery.trim()
                          ? renderHighlightedText(msg.text, searchQuery, isCurrentMatch)
                          : msg.text}
                      </p>
                    )}
                  </div>
                ) : (
                  <div
                    onContextMenu={(e) => handleContextMenu(e, msg, isMe)}
                    onTouchStart={(e) => handleTouchStart(e, msg, isMe)}
                    onTouchEnd={handleTouchEndOrMove}
                    onTouchMove={handleTouchEndOrMove}
                    title="Right-click or long-press for options & reactions"
                    className={`w-full p-3 rounded-2xl text-sm shadow-sm transition-all select-text cursor-pointer ${
                      isCurrentMatch
                        ? "ring-2 ring-amber-400 shadow-lg shadow-amber-400/25 scale-[1.01]"
                        : isAnyMatch
                        ? "ring-1 ring-amber-400/40"
                        : ""
                    } ${
                      isMe
                        ? "bg-violet-600/70 text-white rounded-br-xs"
                        : "bg-[#282142]/85 border border-white/10 text-white rounded-bl-xs"
                    }`}
                  >
                  {selectedUser?.isGroup && !isMe && !msg.isDeleted && (
                    <p className="text-[11px] font-semibold text-violet-300 mb-1 select-none truncate">
                      {msg.senderId?.fullName || "Member"}
                    </p>
                  )}
                  {msg.isDeleted ? (
                    <div className="flex items-center gap-1.5 text-gray-300/80 italic text-sm py-0.5 select-none">
                      <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                      </svg>
                      <span>This message was deleted</span>
                    </div>
                  ) : isEditingThis ? (
                    <div className="flex flex-col gap-2 min-w-[200px] sm:min-w-[260px]">
                      <span className="text-[11px] text-violet-200 font-medium">Edit message:</span>
                      <input
                        type="text"
                        value={editInput}
                        onChange={(e) => setEditInput(e.target.value)}
                        className="w-full bg-black/40 border border-violet-400/50 rounded-lg p-2 text-white text-sm outline-none focus:border-violet-300"
                        autoFocus
                        disabled={isSubmittingEdit}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveEdit(msg._id);
                          if (e.key === "Escape") setEditingMessageId(null);
                        }}
                      />
                      <div className="flex justify-end items-center gap-2 pt-1 text-xs">
                        <button
                          type="button"
                          onClick={() => setEditingMessageId(null)}
                          disabled={isSubmittingEdit}
                          className="px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/20 text-gray-300 transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(msg._id)}
                          disabled={isSubmittingEdit || !editInput.trim()}
                          className="px-3 py-1 rounded-md bg-violet-600 hover:bg-violet-500 text-white font-medium shadow transition-colors cursor-pointer flex items-center gap-1"
                        >
                          {isSubmittingEdit ? "Saving..." : "Save"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {(msg.messageType === "image" || msg.image) && (
                        <div
                          onClick={() => setModalImage(msg.image)}
                          className="relative group mt-0.5 mb-1.5 cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-black/20"
                        >
                          <img
                            src={msg.image}
                            alt="Shared image"
                            onLoad={handleImageLoad}
                            className="max-h-72 w-auto max-w-full rounded-xl object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-white text-xs bg-black/60 px-2.5 py-1 rounded-md backdrop-blur-sm shadow flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                              </svg>
                              View Full Image
                            </span>
                          </div>
                        </div>
                      )}
                      {msg.text && (
                        <p className={msg.image ? "mt-1 break-words leading-relaxed" : "break-words leading-relaxed"}>
                          {isSearchOpen && searchQuery.trim()
                            ? renderHighlightedText(msg.text, searchQuery, isCurrentMatch)
                            : msg.text}
                        </p>
                      )}
                    </>
                  )}

                  <div className="flex items-center justify-end gap-1 text-[10px] text-gray-300/80 mt-1 select-none">
                    {msg.isEdited && !msg.isDeleted && (
                      <span className="text-[10px] text-violet-200 italic mr-0.5">(edited)</span>
                    )}
                    <span>{formatMessageTime(msg.createdAt)}</span>
                    {isMe && !msg.isDeleted && (
                      <span className="inline-flex items-center ml-0.5">
                        {msg.status === "read" || msg.seen ? (
                          <svg
                            className="w-3.5 h-3.5 text-sky-400"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M18 6L7 17l-5-5" />
                            <path d="M22 10l-7.5 7.5-2-2" />
                          </svg>
                        ) : msg.status === "delivered" ? (
                          <svg
                            className="w-3.5 h-3.5 text-gray-300"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M18 6L7 17l-5-5" />
                            <path d="M22 10l-7.5 7.5-2-2" />
                          </svg>
                        ) : (
                          <svg
                            className="w-3 h-3 text-gray-300"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

              {/* REACTION CHIPS */}
              {!msg.isDeleted && msg.reactions && msg.reactions.length > 0 && (
                <div className={`flex flex-wrap gap-1 mt-1 px-1 ${isMe ? "justify-end" : "justify-start"}`}>
                  {(() => {
                    const grouped = msg.reactions.reduce((acc, curr) => {
                      acc[curr.emoji] = acc[curr.emoji] || { count: 0, users: [] };
                      acc[curr.emoji].count += 1;
                      acc[curr.emoji].users.push(String(curr.userId));
                      return acc;
                    }, {});

                    return Object.entries(grouped).map(([emoji, data]) => {
                      const hasReacted = data.users.includes(String(authUser?._id));
                      return (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => toggleReaction(msg._id, emoji)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all cursor-pointer shadow-sm select-none ${
                            hasReacted
                              ? "bg-violet-600/50 border border-violet-400 text-white font-medium scale-105"
                              : "bg-[#282142]/90 border border-white/10 hover:border-white/25 text-gray-300 hover:bg-[#282142]"
                          }`}
                          title={hasReacted ? "Click to remove reaction" : "Click to react"}
                        >
                          <span className="text-sm">{emoji}</span>
                          {data.count > 1 && (
                            <span className="text-[10px] text-gray-200 font-semibold">{data.count}</span>
                          )}
                        </button>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
            )}
          </React.Fragment>
        );
      })}
        <div ref={scrollEnd} />
      </div>

      {/* INPUT */}
      <form
        onSubmit={handleSendMessage}
        className="sticky bottom-0 z-10 flex flex-col p-2.5 sm:p-3 bg-[#161622]/95 backdrop-blur-md border-t border-white/10"
      >
        {/* PREVIEW CONTAINER WHEN IMAGE IS SELECTED */}
        {selectedImage && (
          <div className="relative mb-2.5 self-start inline-flex items-center">
            <div className="relative rounded-xl overflow-hidden border-2 border-violet-500/60 shadow-xl bg-[#282142] group">
              <img
                src={selectedImage.previewUrl}
                alt="Selected preview"
                className="h-20 sm:h-24 w-auto max-w-[200px] object-cover rounded-lg"
              />
              <button
                type="button"
                onClick={handleRemoveSelectedImage}
                className="absolute top-1 right-1 bg-black/70 hover:bg-red-500 text-white p-1 rounded-full transition-colors cursor-pointer shadow-md"
                title="Remove image"
                aria-label="Remove image"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <span className="text-xs text-violet-300 ml-2.5 font-medium select-none">
              Image selected. Click Send to send.
            </span>
          </div>
        )}

        {isRecording ? (
          <div className="flex items-center gap-2 bg-[#282142] border border-red-500/40 rounded-full px-3 sm:px-4 py-2 animate-in fade-in zoom-in-95 duration-150">
            {/* Pulsing red record indicator & timer */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
              <span className="text-xs sm:text-sm font-mono font-medium text-red-200">
                {formatTimer(recordingDuration)}
              </span>
            </div>

            {/* Live animated wave bars */}
            <div className="flex-1 flex items-center justify-center gap-1 sm:gap-1.5 h-6 px-2 overflow-hidden">
              {liveWaveBars.map((height, i) => (
                <div
                  key={i}
                  style={{ height: `${height}%` }}
                  className="w-1 sm:w-1.5 bg-gradient-to-t from-red-500 to-violet-400 rounded-full transition-all duration-75"
                />
              ))}
            </div>

            {/* Action buttons: Cancel (Trash) & Send */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={cancelRecording}
                className="p-2 text-gray-400 hover:text-red-400 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                title="Cancel recording"
                aria-label="Cancel recording"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>

              <button
                type="button"
                onClick={stopAndSendRecording}
                disabled={isSendingAudio}
                className="p-2 bg-violet-600 hover:bg-violet-500 text-white rounded-full shadow-md shadow-violet-600/30 transition-all cursor-pointer hover:scale-105 active:scale-95 disabled:opacity-50"
                title="Send voice message"
                aria-label="Send voice message"
              >
                {isSendingAudio ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 bg-[#282142]/70 border border-white/10 focus-within:border-violet-500/60 rounded-full px-4 py-2 transition-all">
              <input
                value={input}
                onChange={handleInputChange}
                placeholder={selectedImage ? "Add a caption (optional)..." : "Type a message..."}
                className="flex-1 bg-transparent text-white outline-none text-sm placeholder-gray-400 min-w-0"
              />
              
              <input
                type="file"
                id="image"
                ref={fileInputRef}
                hidden
                accept="image/*"
                onChange={handleImageSelect}
              />
              <label
                htmlFor="image"
                className="cursor-pointer flex-shrink-0 text-gray-400 hover:text-violet-400 transition-colors p-1"
                title="Attach image"
              >
                <img
                  src={assets.gallery_icon}
                  className={`w-5 h-5 transition-all ${
                    selectedImage ? "opacity-100 filter drop-shadow-[0_0_6px_rgba(139,92,246,0.8)]" : "opacity-70 hover:opacity-100"
                  }`}
                  alt="Upload"
                />
              </label>

              {/* Microphone icon button next to gallery icon */}
              <button
                type="button"
                onMouseDown={handleMicMouseDown}
                onTouchStart={handleMicMouseDown}
                className="text-gray-400 hover:text-violet-400 transition-colors p-1 cursor-pointer flex-shrink-0"
                title="Click to record or hold to talk"
                aria-label="Record voice message"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>
            </div>

            <button
              type="submit"
              disabled={(!input.trim() && !selectedImage) || uploadingImage}
              className={`p-2.5 rounded-full flex items-center justify-center transition-all cursor-pointer flex-shrink-0 ${
                (input.trim() || selectedImage) && !uploadingImage
                  ? "bg-violet-600 hover:bg-violet-500 text-white shadow-md shadow-violet-600/30 scale-100"
                  : "opacity-40 cursor-not-allowed text-gray-400"
              }`}
              aria-label="Send message"
            >
              {uploadingImage ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <img src={assets.send_button} className="w-5 h-5" alt="Send" />
              )}
            </button>
          </div>
        )}
      </form>

      {/* FULL-SCREEN IMAGE MODAL */}
      {modalImage && (
        <div
          onClick={() => setModalImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
        >
          <button
            onClick={() => setModalImage(null)}
            className="absolute top-5 right-5 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2.5 rounded-full transition-colors cursor-pointer"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={modalImage}
            alt="Full size view"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl shadow-2xl"
          />
        </div>
      )}

      {/* CONTEXT MENU (EMOJI REACTIONS / EDIT / DELETE FOR EVERYONE / DELETE FOR ME) */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-[#201a35]/95 border border-white/20 rounded-xl shadow-2xl p-2 min-w-[210px] backdrop-blur-xl select-none text-sm text-gray-200 animate-in fade-in zoom-in-95 duration-100"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* QUICK EMOJI BAR (Works for touch/mobile and right-click) */}
          {!contextMenu.message.isDeleted && (
            <>
              <div className="flex items-center justify-between gap-1 px-1.5 py-1 bg-white/5 rounded-lg mb-1.5">
                {COMMON_EMOJIS.map((emoji) => {
                  const hasReacted = (contextMenu.message.reactions || []).some(
                    (r) => String(r.userId) === String(authUser?._id) && r.emoji === emoji
                  );
                  return (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => {
                        toggleReaction(contextMenu.message._id, emoji);
                        setContextMenu(null);
                      }}
                      className={`text-xl hover:scale-125 transition-transform duration-100 p-1 cursor-pointer rounded-full ${
                        hasReacted ? "scale-110 bg-violet-600/40" : "hover:bg-white/10"
                      }`}
                      title={hasReacted ? `Remove ${emoji}` : `React ${emoji}`}
                    >
                      {emoji}
                    </button>
                  );
                })}
              </div>
              <hr className="my-1.5 border-white/10" />
            </>
          )}

          {/* EDIT OPTION (Only for sender's own text messages within 15 mins) */}
          {contextMenu.isMe && contextMenu.message.text && !contextMenu.message.audio && contextMenu.message.messageType !== "audio" && !contextMenu.message.isDeleted && !contextMenu.isExpired && (
            <>
              <button
                onClick={() => {
                  const msg = contextMenu.message;
                  setContextMenu(null);
                  setEditingMessageId(msg._id);
                  setEditInput(msg.text || "");
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left hover:bg-violet-600/30 text-white cursor-pointer transition-colors"
              >
                <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                <span>Edit</span>
              </button>
              <hr className="my-1 border-white/10" />
            </>
          )}

          {/* DELETE FOR EVERYONE (Only for sender's own messages, enabled within 15 mins) */}
          {contextMenu.isMe && !contextMenu.message.isDeleted && (
            <button
              disabled={contextMenu.isExpired}
              onClick={() => {
                if (contextMenu.isExpired) return;
                const msg = contextMenu.message;
                setContextMenu(null);
                deleteForEveryone(msg._id);
              }}
              title={contextMenu.isExpired ? "Can only delete for everyone within 15 minutes of sending" : ""}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                contextMenu.isExpired
                  ? "opacity-40 cursor-not-allowed text-gray-400"
                  : "hover:bg-red-500/20 text-red-400 hover:text-red-300 cursor-pointer"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <span>Delete for everyone</span>
              </div>
              {contextMenu.isExpired && (
                <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-gray-400">
                  &gt;15m
                </span>
              )}
            </button>
          )}

          {contextMenu.isMe && !contextMenu.message.isDeleted && (
            <hr className="my-1 border-white/10" />
          )}

          {/* DELETE FOR ME (Always available for any message at any time!) */}
          <button
            onClick={() => {
              const msg = contextMenu.message;
              setContextMenu(null);
              deleteForMe(msg._id);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left hover:bg-white/10 text-gray-200 hover:text-white cursor-pointer transition-colors"
          >
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>Delete for me</span>
          </button>
        </div>
      )}

      {/* EXIT GROUP CONFIRMATION MODAL */}
      {showExitModal && (
        <div
          onClick={() => !isExiting && setShowExitModal(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-[#1e1b2e] border border-white/15 rounded-2xl p-5 shadow-2xl animate-in zoom-in-95 duration-150 text-white"
          >
            <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </div>
            <h3 className="text-center font-semibold text-base">Exit Group?</h3>
            <p className="text-center text-xs text-gray-400 mt-1.5 leading-relaxed">
              Are you sure you want to leave <span className="text-white font-medium">"{selectedUser.name}"</span>? You will no longer receive messages or calls from this group.
            </p>
            <div className="flex items-center gap-2.5 mt-5">
              <button
                type="button"
                onClick={() => setShowExitModal(false)}
                disabled={isExiting}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-gray-200 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setIsExiting(true);
                  await exitGroup(selectedUser._id);
                  setIsExiting(false);
                  setShowExitModal(false);
                }}
                disabled={isExiting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors cursor-pointer shadow-lg shadow-red-600/30 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isExiting ? "Exiting..." : "Exit Group"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatContainer;
