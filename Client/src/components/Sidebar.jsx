import React, { useContext, useState, useEffect, useRef } from "react";
import assets from "../assets/assets";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { ChatContext } from "../../context/ChatContext";
import { formatLastSeen } from "../lib/utils";

const Sidebar = () => {
  const {
    getUsers,
    users,
    selectedUser,
    setSelectedUser,
    unseenMessages = {},
    setUnseenMessages,
  } = useContext(ChatContext);

  const { logout, onlineUsers = [] } = useContext(AuthContext);

  const [input, setInput] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  const filteredUsers = input
    ? users.filter((user) =>
        user.fullName?.toLowerCase().includes(input.toLowerCase())
      )
    : users;

  useEffect(() => {
    if (typeof getUsers === "function") {
      getUsers();
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
          
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((prev) => !prev)}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer text-gray-300 hover:text-white"
              aria-label="Options menu"
            >
              <img src={assets.menu_icon} alt="menu" className="w-4 h-4 object-contain" />
            </button>

            {menuOpen && (
              <div className="absolute top-full right-0 z-30 w-36 mt-1 p-2 rounded-xl bg-[#201a35] border border-white/15 text-gray-200 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-100">
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

        {/* Search */}
        <div className="bg-[#282142]/80 border border-white/10 focus-within:border-violet-500/60 rounded-full flex items-center gap-2.5 py-2.5 px-4 mt-4 transition-all">
          <img src={assets.search_icon} alt="Search" className="w-3.5 h-3.5 opacity-60" />
          <input
            onChange={(e) => setInput(e.target.value)}
            value={input}
            type="text"
            className="bg-transparent border-none outline-none text-white text-xs placeholder-gray-400 flex-1 min-w-0"
            placeholder="Search User..."
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

      {/* Users list */}
      <div className="flex-1 overflow-y-auto space-y-1 mt-2 pr-0.5">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-10 text-gray-500 text-xs">
            {input ? "No contacts match your search" : "No users found"}
          </div>
        ) : (
          filteredUsers.map((user) => {
            const isSelected = selectedUser?._id === user._id;
            const isUserOnline = onlineUsers.includes(user._id);
            const unreadCount = unseenMessages?.[user._id] || 0;

            return (
              <div
                key={user._id}
                onClick={() => handleSelectUser(user)}
                className={`relative flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all duration-150 ${
                  isSelected
                    ? "bg-violet-600/30 border border-violet-500/40 text-white"
                    : "hover:bg-white/5 text-gray-200"
                }`}
              >
                {/* Avatar with status indicator */}
                <div className="relative flex-shrink-0">
                  <img
                    src={user?.profilePic || assets.avatar_icon}
                    alt={user.fullName}
                    className="w-10 h-10 aspect-square rounded-full object-cover border border-white/10"
                  />
                  {isUserOnline && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-[#161622] rounded-full" />
                  )}
                </div>

                {/* User info */}
                <div className="flex flex-col min-w-0 flex-1">
                  <p className="font-medium text-sm truncate text-white">
                    {user.fullName}
                  </p>
                  <p className="text-xs truncate">
                    {isUserOnline ? (
                      <span className="text-green-400 font-medium">Online</span>
                    ) : (
                      <span className="text-gray-400">
                        {formatLastSeen(user.lastSeen)}
                      </span>
                    )}
                  </p>
                </div>

                {/* Unread badge */}
                {unreadCount > 0 && (
                  <span className="flex-shrink-0 bg-violet-600 text-white text-[11px] font-bold h-5 min-w-[20px] px-1.5 flex items-center justify-center rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Sidebar;
