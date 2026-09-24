import React, { useState } from "react";
import assets from "../assets/assets";
import toast from "react-hot-toast";

const CreateGroupModal = ({ isOpen, onClose, users = [], onCreateGroup }) => {
  const [groupName, setGroupName] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const filteredUsers = users.filter((u) =>
    u.fullName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleUserSelection = (userId) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleRemoveChip = (userId) => {
    setSelectedUserIds((prev) => prev.filter((id) => id !== userId));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) {
      toast.error("Please enter a group name");
      return;
    }
    if (selectedUserIds.length < 1) {
      toast.error("Please select at least 1 contact to create a group");
      return;
    }

    setIsSubmitting(true);
    try {
      const group = await onCreateGroup({
        name: groupName.trim(),
        members: selectedUserIds,
      });
      if (group) {
        setGroupName("");
        setSelectedUserIds([]);
        setSearchQuery("");
        onClose();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-[#1d172e] border border-white/15 rounded-2xl shadow-2xl p-5 text-white flex flex-col gap-4 max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-violet-600/30 border border-violet-500/40 flex items-center justify-center text-violet-300">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-lg text-white">Create New Group</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer text-sm"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Group Name input */}
        <div>
          <label className="text-xs text-gray-300 font-medium block mb-1.5">
            Group Name
          </label>
          <input
            type="text"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="e.g. Friends, Family, Project Team"
            className="w-full bg-[#120d20] border border-white/15 focus:border-violet-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-gray-500 outline-none transition-all"
            autoFocus
          />
        </div>

        {/* Selected Members Chips */}
        {selectedUserIds.length > 0 && (
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-white/5 rounded-xl border border-white/5">
            {selectedUserIds.map((id) => {
              const u = users.find((user) => String(user._id) === String(id));
              if (!u) return null;
              return (
                <span
                  key={id}
                  className="inline-flex items-center gap-1.5 bg-violet-600/40 border border-violet-500/50 text-violet-200 text-xs px-2.5 py-1 rounded-full animate-in fade-in"
                >
                  <img
                    src={u.profilePic || assets.avatar_icon}
                    alt={u.fullName}
                    className="w-3.5 h-3.5 rounded-full object-cover"
                  />
                  <span className="truncate max-w-[100px]">{u.fullName}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveChip(id)}
                    className="hover:text-white cursor-pointer text-[11px]"
                  >
                    ✕
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* Search Contacts */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-xs text-gray-300 font-medium">
              Select Members ({selectedUserIds.length} selected)
            </label>
          </div>
          <div className="bg-[#120d20] border border-white/15 focus-within:border-violet-500 rounded-xl flex items-center gap-2 px-3 py-2 text-xs">
            <img src={assets.search_icon} alt="Search" className="w-3 h-3 opacity-60" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contacts..."
              className="bg-transparent border-none outline-none text-white w-full placeholder-gray-500"
            />
          </div>
        </div>

        {/* Contacts list with checkboxes */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-56 min-h-[120px]">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-6 text-xs text-gray-500">
              No contacts found
            </div>
          ) : (
            filteredUsers.map((user) => {
              const isSelected = selectedUserIds.includes(user._id);
              return (
                <div
                  key={user._id}
                  onClick={() => toggleUserSelection(user._id)}
                  className={`flex items-center justify-between p-2 rounded-xl cursor-pointer transition-colors ${
                    isSelected
                      ? "bg-violet-600/25 border border-violet-500/40"
                      : "hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={user.profilePic || assets.avatar_icon}
                      alt={user.fullName}
                      className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                    />
                    <div className="truncate">
                      <p className="text-xs font-medium text-white truncate">
                        {user.fullName}
                      </p>
                      <p className="text-[10px] text-gray-400 truncate">
                        {user.email || user.bio || ""}
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}} // handled by row click
                    className="accent-violet-600 w-4 h-4 rounded cursor-pointer"
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-gray-300 hover:text-white rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={isSubmitting || !groupName.trim() || selectedUserIds.length < 1}
            className="px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-purple-500 to-violet-600 rounded-xl hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed shadow-md cursor-pointer transition-all"
          >
            {isSubmitting ? "Creating..." : "Create Group"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateGroupModal;
