import React, { useContext, useEffect, useState } from "react";
import assets from "../assets/assets";
import { ChatContext } from "../../context/ChatContext";
import { AuthContext } from "../../context/AuthContext";
import { formatLastSeen } from "../lib/utils";

const RightSidebar = ({ onClose }) => {
  const { selectedUser, messages, users, setShowRightSidebar, exitGroup } = useContext(ChatContext);
  const { authUser, logout, onlineUsers } = useContext(AuthContext);
  const [images, setImages] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    setImages(messages.filter((m) => m.image).map((m) => m.image));
  }, [messages]);

  if (!selectedUser) return null;

  const currentChatUser =
    users.find((u) => u._id === selectedUser._id) || selectedUser;
  const isOnline = !selectedUser.isGroup && onlineUsers.includes(selectedUser._id);

  const adminIdStr = String(selectedUser.admin?._id || selectedUser.admin || "");
  const isGroupCreator = selectedUser.isGroup && authUser && String(authUser._id) === adminIdStr;
  const groupAdminName = selectedUser.isGroup
    ? (selectedUser.admin && typeof selectedUser.admin === "object" && selectedUser.admin.fullName)
      ? selectedUser.admin.fullName
      : isGroupCreator
      ? "you"
      : (selectedUser.members || []).find((m) => String(m._id || m) === adminIdStr)?.fullName || "Admin"
    : "";

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
        <h3 className="font-semibold text-sm text-gray-200">
          {selectedUser.isGroup ? "Group Info" : "Contact Info"}
        </h3>
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
            {selectedUser.isGroup ? (
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center text-white border-2 border-violet-500/40 shadow-lg">
                <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  className="w-20 h-20 rounded-full object-cover border-2 border-violet-500/40 shadow-lg"
                />
                {isOnline && (
                  <span className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-green-500 border-2 border-[#161622] rounded-full" />
                )}
              </>
            )}
          </div>

          <h2 className="mt-3 font-semibold text-base text-center truncate max-w-full px-2">
            {selectedUser.name || selectedUser.fullName}
          </h2>

          <div className="mt-1">
            {selectedUser.isGroup ? (
              <span className="text-xs text-violet-300 font-medium">
                {isGroupCreator ? "Created by you" : `Added by ${groupAdminName}`}
              </span>
            ) : isOnline ? (
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

          {selectedUser.isGroup && (
            <div className="w-full mt-4 pt-3 border-t border-white/10 text-left">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Members ({selectedUser.members?.length || 0})
              </p>
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {(selectedUser.members || []).map((m) => (
                  <div key={m._id || m} className="flex items-center justify-between text-xs py-1">
                    <span className="text-gray-200 truncate">{m.fullName || "Member"}</span>
                    {String(m._id || m) === adminIdStr && (
                      <span className="text-[10px] text-violet-400 bg-violet-500/20 px-1.5 py-0.5 rounded font-medium">
                        Admin
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Exit Group Button under member list */}
              <button
                type="button"
                onClick={() => setShowExitModal(true)}
                className="mt-3 w-full py-2 px-3 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Exit Group
              </button>
            </div>
          )}

          {!selectedUser.isGroup && currentChatUser?.bio && (
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

      {/* FOOTER ACTIONS */}
      <div className="p-4 border-t border-white/10 flex-shrink-0 flex flex-col gap-2">
        {selectedUser.isGroup && (
          <button
            onClick={() => setShowExitModal(true)}
            className="w-full py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-400 hover:text-red-300 text-sm font-semibold transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Exit Group
          </button>
        )}
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

export default RightSidebar;
