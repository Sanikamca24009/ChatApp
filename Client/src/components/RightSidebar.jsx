import React, { useContext, useEffect, useState } from "react";
import assets from "../assets/assets";
import { ChatContext } from "../../context/ChatContext";
import { AuthContext } from "../../context/AuthContext";

const RightSidebar = () => {
  const { selectedUser, messages } = useContext(ChatContext);
  const { logout, onlineUsers } = useContext(AuthContext);
  const [images, setImages] = useState([]);

  useEffect(() => {
    setImages(messages.filter(m => m.image).map(m => m.image));
  }, [messages]);

  if (!selectedUser) return null;

  return (
    <div className="flex flex-col h-full bg-black/40 text-white max-md:hidden">

      {/* PROFILE */}
      <div className="flex flex-col items-center py-6 border-b border-white/10">
        <img
          src={selectedUser.profilePic || assets.avatar_icon}
          className="w-20 rounded-full"
        />
        <h2 className="mt-2 flex items-center gap-2">
          {onlineUsers.includes(selectedUser._id) && (
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
          )}
          {selectedUser.fullName}
        </h2>
      </div>

      {/* MEDIA */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <p className="text-xs mb-2">Media</p>
        {images.length === 0 && (
          <p className="text-xs text-gray-500">No media shared</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          {images.map((img, i) => (
            <img
              key={i}
              src={img}
              onClick={() => window.open(img)}
              className="rounded cursor-pointer"
            />
          ))}
        </div>
      </div>

      {/* LOGOUT */}
      <div className="p-4 border-t border-white/10">
        <button
          onClick={logout}
          className="w-full py-2 rounded-full bg-gradient-to-r from-purple-400 to-violet-600"
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default RightSidebar;
