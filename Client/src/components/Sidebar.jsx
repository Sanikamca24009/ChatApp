import React, { useContext, useState, useEffect, useRef, useMemo } from "react";
import assets from "../assets/assets";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { ChatContext } from "../../context/ChatContext";
import { formatLastSeen, formatSidebarTime } from "../lib/utils";
import CreateGroupModal from "./CreateGroupModal";

const Sidebar = () => {
  const {
    getUsers,
    users,
    groups = [],
    getGroups,
    createGroup,
    selectedUser,
    setSelectedUser,
    unseenMessages = {},
    setUnseenMessages,
  } = useContext(ChatContext);

  const { logout, onlineUsers = [] } = useContext(AuthContext);

  const [input, setInput] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  const allConversations = useMemo(() => {
    const formattedGroups = (groups || []).map((g) => ({
      ...g,
      isGroup: true,
      fullName: g.name,
    }));

    const combined = [...users, ...formattedGroups];

    const filtered = input
      ? combined.filter((c) =>
          c.fullName?.toLowerCase().includes(input.toLowerCase())
        )
      : combined;

    return filtered.sort(
      (a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0)
    );
  }, [users, groups, input]);

  useEffect(() => {
    if (typeof getUsers === "function") {
      getUsers();
    }
    if (typeof getGroups === "function") {
      getGroups();
    }
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    if (typeof setUnseenMessages === "function") {
      setUnseenMessages((prev) => ({ ...prev, [user._id]: 0 }));
    }
  };

  return (
    <div className="flex flex-col h-full w-full p-4 sm:p-5 text-white bg-[#8185B2]/5 overflow-hidden select-none">
      {/* Header */}
      <div className="flex-shrink-0 pb-3">
        <div className="flex justify-between items-center">
          <img src={assets.logo} alt="QuickChat" className="max-w-36 h-auto" />
          
          <div className="flex items-center gap-1.5">
            {/* New Group Button */}
            <button
              onClick={() => setIsGroupModalOpen(true)}
              className="p-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/40 border border-violet-500/30 text-violet-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1 text-xs"
              title="Create New Group"
              aria-label="Create New Group"
            >
              <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline font-medium">New Group</span>
            </button>

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((prev) => !prev)}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer text-gray-300 hover:text-white"
                aria-label="Options menu"
              >
                <img src={assets.menu_icon} alt="menu" className="w-4 h-4 object-contain" />
              </button>

              {menuOpen && (
                <div className="absolute top-full right-0 z-30 w-40 mt-1 p-2 rounded-xl bg-[#201a35] border border-white/15 text-gray-200 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      setIsGroupModalOpen(true);
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-violet-600/30 text-sm transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    New Group
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      navigate("/profile");
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-violet-600/30 text-sm transition-colors cursor-pointer"
                  >
                    Edit Profile
                  </button>
                  <hr className="my-1 border-t border-white/10" />
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                    }}
                    className="w-full text-left px-3 py-2 rounded-lg hover:bg-red-500/20 text-sm text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-[#282142]/80 border border-white/10 focus-within:border-violet-500/60 rounded-full flex items-center gap-2.5 py-2.5 px-4 mt-4 transition-all">
          <img src={assets.search_icon} alt="Search" className="w-3.5 h-3.5 opacity-60" />
          <input
            onChange={(e) => setInput(e.target.value)}
            value={input}
            type="text"
            className="bg-transparent border-none outline-none text-white text-xs placeholder-gray-400 flex-1 min-w-0"
            placeholder="Search conversations..."
          />
          {input && (
            <button
              onClick={() => setInput("")}
              className="text-gray-400 hover:text-white text-xs px-1 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Conversations list (Direct & Groups) */}
      <div className="flex-1 overflow-y-auto space-y-1 mt-2 pr-0.5">
        {allConversations.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-xs">
            {input ? "No conversations match your search" : "No chats or groups yet"}
          </div>
        ) : (
          allConversations.map((item) => {
            const isSelected = selectedUser?._id === item._id;
            const isUserOnline = !item.isGroup && onlineUsers.includes(item._id);
            const unreadCount = unseenMessages?.[item._id] || 0;

            return (
              <div
                key={item._id}
                onClick={() => handleSelectUser(item)}
                className={`relative flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all duration-150 ${
                  isSelected
                    ? "bg-violet-600/30 border border-violet-500/40 text-white"
                    : "hover:bg-white/5 text-gray-200"
                }`}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  {item.isGroup ? (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center text-white border border-white/20 shadow-sm">
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
                        src={item?.profilePic || assets.avatar_icon}
                        alt={item.fullName}
                        className="w-10 h-10 aspect-square rounded-full object-cover border border-white/10"
                      />
                      {isUserOnline && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#161622] rounded-full" />
                      )}
                    </>
                  )}
                </div>

                {/* Conversation info */}
                <div className="flex flex-col min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <p className="font-medium text-sm truncate text-white">
                        {item.fullName}
                      </p>
                    </div>
                    {item.lastMessage?.createdAt && (
                      <span className="text-[10px] text-gray-400 flex-shrink-0">
                        {formatSidebarTime(item.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs truncate">
                    {item.lastMessage ? (
                      <span className="text-gray-400 truncate">
                        {item.lastMessage.isDeleted
                          ? "🚫 This message was deleted"
                          : item.lastMessage.messageType === "audio" || item.lastMessage.audio
                          ? "🎤 Voice message"
                          : item.lastMessage.image
                          ? "📷 Photo"
                          : `${item.isGroup && item.lastMessage.senderId?.fullName ? `${item.lastMessage.senderId.fullName}: ` : ""}${item.lastMessage.text}`}
                      </span>
                    ) : item.isGroup ? (
                      <span className="text-gray-400">
                        {item.members?.length >= 4 ? `${item.members.length}+ members` : "Group"}
                      </span>
                    ) : isUserOnline ? (
                      <span className="text-green-400 font-medium">Online</span>
                    ) : (
                      <span className="text-gray-400">
                        {formatLastSeen(item.lastSeen)}
                      </span>
                    )}
                  </p>
                </div>

                {/* Unread badge */}
                {unreadCount > 0 && (
                  <span
                    title={`${unreadCount} new messages`}
                    className="flex-shrink-0 bg-violet-600 text-white text-[11px] font-bold h-5 min-w-[20px] px-1.5 flex items-center justify-center rounded-full"
                  >
                    {unreadCount}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal */}
      <CreateGroupModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        users={users}
        onCreateGroup={createGroup}
      />
    </div>
  );
};

export default Sidebar;
