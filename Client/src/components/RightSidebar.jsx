import React, { useContext, useEffect, useState } from "react";
import assets from "../assets/assets";
import { ChatContext } from "../../context/ChatContext";
import { AuthContext } from "../../context/AuthContext";
import { formatLastSeen } from "../lib/utils";

const RightSidebar = ({ onClose }) => {
  const { selectedUser, messages, users, setShowRightSidebar } = useContext(ChatContext);
  const { logout, onlineUsers } = useContext(AuthContext);
  const [images, setImages] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    setImages(messages.filter((m) => m.image).map((m) => m.image));
  }, [messages]);

  if (!selectedUser) return null;

  const currentChatUser =
    users.find((u) => u._id === selectedUser._id) || selectedUser;
  const isOnline = onlineUsers.includes(selectedUser._id);

  const handleClose = () => {
    if (typeof onClose === "function") {
      onClose();
    } else if (typeof setShowRightSidebar === "function") {
      setShowRightSidebar(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#161622] text-white overflow-hidden select-none">
      {/* HEADER */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
        <h3 className="font-semibold text-sm text-gray-200">Contact Info</h3>
        <button
          onClick={handleClose}
          className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors cursor-pointer"
          aria-label="Close details"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* PROFILE SECTION */}
        <div className="flex flex-col items-center py-6 px-4 border-b border-white/10">
          <div className="relative">
            <img
              src={selectedUser.profilePic || assets.avatar_icon}
              alt={selectedUser.fullName}
              className="w-20 h-20 rounded-full object-cover border-2 border-violet-500/40 shadow-lg"
            />
            {isOnline && (
              <span className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-green-500 border-2 border-[#161622] rounded-full" />
            )}
          </div>

          <h2 className="mt-3 font-semibold text-base text-center truncate max-w-full px-2">
            {selectedUser.fullName}
          </h2>

          <div className="mt-1">
            {isOnline ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-green-400 font-medium">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                Online
              </span>
            ) : (
              <span className="text-xs text-gray-400">
                {formatLastSeen(currentChatUser?.lastSeen)}
              </span>
            )}
          </div>

          {currentChatUser?.bio && (
            <p className="mt-3 text-xs text-gray-300 text-center italic px-3 bg-white/5 py-1.5 rounded-lg max-w-full">
              "{currentChatUser.bio}"
            </p>
          )}
        </div>

        {/* MEDIA SECTION */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold tracking-wider text-gray-400 uppercase">
              Shared Media
            </span>
            <span className="text-xs text-gray-500">
              {images.length} {images.length === 1 ? "file" : "files"}
            </span>
          </div>

          {images.length === 0 ? (
            <div className="py-8 text-center text-xs text-gray-500 bg-white/5 rounded-xl border border-white/5">
              No photos shared yet
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {images.map((img, i) => (
                <div
                  key={i}
                  onClick={() => setPreviewImage(img)}
                  className="aspect-square rounded-lg overflow-hidden border border-white/10 cursor-pointer group relative"
                >
                  <img
                    src={img}
                    alt="Shared media"
                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-violet-600/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* LOGOUT */}
      <div className="p-4 border-t border-white/10 flex-shrink-0">
        <button
          onClick={logout}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-red-500/80 to-pink-600/80 hover:from-red-500 hover:to-pink-600 text-white text-sm font-medium transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Logout
        </button>
      </div>

      {/* MODAL IMAGE PREVIEW */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4"
        >
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-5 right-5 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2.5 rounded-full transition-colors cursor-pointer"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={previewImage}
            alt="Preview"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-xl shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};

export default RightSidebar;
