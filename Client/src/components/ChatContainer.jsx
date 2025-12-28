import React, { useContext, useEffect, useRef, useState } from "react";
import assets from "../assets/assets";
import { formatMessageTime } from "../lib/utils";
import { ChatContext } from "../../context/ChatContext";
import { AuthContext } from "../../context/AuthContext";
import toast from "react-hot-toast";

const ChatContainer = () => {
  const { messages, selectedUser, sendMessage, getMessages } =
    useContext(ChatContext);

  const { authUser, onlineUsers } = useContext(AuthContext);

  const scrollEnd = useRef(null);
  const [input, setInput] = useState("");

  useEffect(() => {
    if (selectedUser) getMessages(selectedUser._id);
  }, [selectedUser]);

  useEffect(() => {
    scrollEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!selectedUser) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 bg-white/10 max-md:hidden">
        <p>Select a user to start chatting</p>
      </div>
    );
  }

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    await sendMessage({ text: input.trim() });
    setInput("");
  };

  const handleSendImage = async (e) => {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith("image/")) {
      toast.error("Invalid image");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = async () => {
      await sendMessage({ image: reader.result });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col h-full bg-black/40">

      {/* HEADER */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-black/60">
        <img
          src={selectedUser.profilePic || assets.avatar_icon}
          className="w-8 rounded-full"
        />
        <div className="flex flex-col">
          <span className="text-white">{selectedUser.fullName}</span>
          <span className="text-xs text-gray-400">
            {onlineUsers.includes(selectedUser._id) ? "Online" : "Offline"}
          </span>
        </div>
      </div>

      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((msg, index) => {
          const isMe = String(msg.senderId) === String(authUser._id);
          return (
            <div
              key={index}
              className={`flex ${isMe ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[240px] p-2 rounded-lg text-sm ${
                  isMe
                    ? "bg-violet-500/40 text-white"
                    : "bg-gray-700/40 text-white"
                }`}
              >
                {msg.text && <p>{msg.text}</p>}
                {msg.image && (
                  <img src={msg.image} className="mt-2 rounded-lg" />
                )}
                <p className="text-[10px] text-gray-400 text-right mt-1">
                  {formatMessageTime(msg.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={scrollEnd} />
      </div>

      {/* INPUT */}
      <form
        onSubmit={handleSendMessage}
        className="sticky bottom-0 z-10 flex items-center gap-2 px-3 py-3 bg-black/60 border-t border-white/10"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Send a message"
          className="flex-1 bg-transparent text-white outline-none text-sm"
        />
        <input
          type="file"
          id="image"
          hidden
          accept="image/*"
          onChange={handleSendImage}
        />
        <label htmlFor="image">
          <img src={assets.gallery_icon} className="w-5 cursor-pointer" />
        </label>
        <button type="submit">
          <img src={assets.send_button} className="w-6" />
        </button>
      </form>
    </div>
  );
};

export default ChatContainer;
