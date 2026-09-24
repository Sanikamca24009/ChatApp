import React, { useContext, useEffect, useRef, useState } from "react";
import assets from "../assets/assets";
import { formatMessageTime, formatLastSeen } from "../lib/utils";
import { ChatContext } from "../../context/ChatContext";
import { AuthContext } from "../../context/AuthContext";
import toast from "react-hot-toast";

const ChatContainer = () => {
  const {
    messages,
    selectedUser,
    setSelectedUser,
    sendMessage,
    getMessages,
    users,
    typingUser,
    showRightSidebar,
    setShowRightSidebar,
  } = useContext(ChatContext);

  const { authUser, onlineUsers, socket } = useContext(AuthContext);

  const currentChatUser =
    users.find((u) => u._id === selectedUser?._id) || selectedUser;
  const isOnline = selectedUser && onlineUsers.includes(selectedUser._id);

  const scrollEnd = useRef(null);
  const [input, setInput] = useState("");
  const [modalImage, setModalImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const typingTimerRef = useRef(null);
  const lastEmitTimeRef = useRef(0);

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
    if (selectedUser) {
      getMessages(selectedUser._id);
      if (socket && authUser) {
        socket.emit("markRead", {
          senderId: selectedUser._id,
          receiverId: authUser._id,
        });
      }
    }
    return () => {
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    };
  }, [selectedUser]);

  useEffect(() => {
    scrollEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    if (!input.trim()) return;

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    if (socket && selectedUser && authUser) {
      socket.emit("stopTyping", {
        senderId: authUser._id,
        receiverId: selectedUser._id,
      });
      lastEmitTimeRef.current = 0;
    }

    await sendMessage({ text: input.trim() });
    setInput("");
  };

  const handleSendImage = async (e) => {
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

    const formData = new FormData();
    formData.append("image", file);
    if (input.trim()) {
      formData.append("text", input.trim());
    }

    setUploadingImage(true);
    const loadingToast = toast.loading("Uploading image...");

    try {
      await sendMessage(formData);
      setInput("");
      toast.dismiss(loadingToast);
    } catch (err) {
      toast.dismiss(loadingToast);
      toast.error("Failed to upload image");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
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

          {/* User info (clickable to toggle profile) */}
          <div
            onClick={() => setShowRightSidebar((prev) => !prev)}
            className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer group"
          >
            <div className="relative flex-shrink-0">
              <img
                src={selectedUser.profilePic || assets.avatar_icon}
                alt={selectedUser.fullName}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover border border-white/10"
              />
              {isOnline && (
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-[#161622] rounded-full" />
              )}
            </div>

            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-white font-medium text-sm sm:text-base truncate group-hover:text-violet-300 transition-colors">
                {selectedUser.fullName}
              </span>
              {typingUser ? (
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

        {/* Right Info / Profile Toggle Button */}
        <button
          onClick={() => setShowRightSidebar((prev) => !prev)}
          className={`p-2 rounded-full transition-colors cursor-pointer flex-shrink-0 ${
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

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
        {messages.map((msg, index) => {
          const isMe = String(msg.senderId) === String(authUser._id);
          return (
            <div
              key={index}
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[75%] md:max-w-[65%] p-3 rounded-2xl text-sm shadow-sm transition-all ${
                  isMe
                    ? "bg-violet-600/70 text-white rounded-br-xs"
                    : "bg-[#282142]/85 border border-white/10 text-white rounded-bl-xs"
                }`}
              >
                {(msg.messageType === "image" || msg.image) && (
                  <div
                    onClick={() => setModalImage(msg.image)}
                    className="relative group mt-0.5 mb-1.5 cursor-pointer overflow-hidden rounded-xl border border-white/10"
                  >
                    <img
                      src={msg.image}
                      alt="Shared image"
                      className="max-h-72 w-auto max-w-full rounded-xl object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                      loading="lazy"
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
                    {msg.text}
                  </p>
                )}
                <div className="flex items-center justify-end gap-1 text-[10px] text-gray-300/80 mt-1 select-none">
                  <span>{formatMessageTime(msg.createdAt)}</span>
                  {isMe && (
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
            </div>
          );
        })}
        <div ref={scrollEnd} />
      </div>

      {/* INPUT */}
      <form
        onSubmit={handleSendMessage}
        className="sticky bottom-0 z-10 flex items-center gap-2 p-2.5 sm:p-3 bg-[#161622]/95 backdrop-blur-md border-t border-white/10"
      >
        <div className="flex-1 flex items-center gap-2 bg-[#282142]/70 border border-white/10 focus-within:border-violet-500/60 rounded-full px-4 py-2 transition-all">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Type a message..."
            className="flex-1 bg-transparent text-white outline-none text-sm placeholder-gray-400 min-w-0"
          />
          
          <input
            type="file"
            id="image"
            hidden
            accept="image/*"
            onChange={handleSendImage}
          />
          <label htmlFor="image" className="cursor-pointer flex-shrink-0 text-gray-400 hover:text-violet-400 transition-colors">
            {uploadingImage ? (
              <div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin cursor-wait" />
            ) : (
              <img src={assets.gallery_icon} className="w-5 h-5 opacity-70 hover:opacity-100 transition-opacity" alt="Upload" />
            )}
          </label>
        </div>

        <button
          type="submit"
          disabled={!input.trim() && !uploadingImage}
          className={`p-2.5 rounded-full flex items-center justify-center transition-all cursor-pointer flex-shrink-0 ${
            input.trim()
              ? "bg-violet-600 hover:bg-violet-500 text-white shadow-md shadow-violet-600/30 scale-100"
              : "opacity-40 cursor-not-allowed text-gray-400"
          }`}
          aria-label="Send message"
        >
          <img src={assets.send_button} className="w-5 h-5" alt="Send" />
        </button>
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
    </div>
  );
};

export default ChatContainer;
