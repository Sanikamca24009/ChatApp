import React, { useContext } from "react";
import Sidebar from "../components/Sidebar";
import ChatContainer from "../components/ChatContainer";
import RightSidebar from "../components/RightSidebar";
import { ChatContext } from "../../context/ChatContext";

const HomePage = () => {
  const { selectedUser, showRightSidebar, setShowRightSidebar } = useContext(ChatContext);

  return (
    <div className="w-full h-screen bg-[#0d0e15] flex justify-center items-center overflow-hidden p-0 sm:p-3 md:p-5 lg:p-6">
      {/* APP CONTAINER */}
      <div className="w-full h-full max-w-[1600px] border-0 sm:border border-white/10 sm:rounded-2xl overflow-hidden flex bg-[#161622]/90 backdrop-blur-xl shadow-2xl relative">
        
        {/* LEFT SIDEBAR (CONTACTS) */}
        <div
          className={`h-full border-r border-white/10 overflow-hidden flex-shrink-0 flex-col transition-all duration-200 ${
            selectedUser
              ? "hidden md:flex md:w-[280px] lg:w-[320px]"
              : "flex w-full md:w-[280px] lg:w-[320px]"
          }`}
        >
          <Sidebar />
        </div>

        {/* CHAT AREA */}
        <div
          className={`h-full flex-1 overflow-hidden min-w-0 ${
            selectedUser ? "flex flex-col" : "hidden md:flex flex-col"
          }`}
        >
          <ChatContainer />
        </div>

        {/* RIGHT SIDEBAR (PROFILE & MEDIA) */}
        {selectedUser && showRightSidebar && (
          <>
            {/* Desktop (xl and above) toggleable 3rd column */}
            <div className="hidden xl:flex xl:w-[300px] 2xl:w-[320px] h-full border-l border-white/10 overflow-hidden flex-shrink-0 flex-col animate-in slide-in-from-right duration-200">
              <RightSidebar onClose={() => setShowRightSidebar(false)} />
            </div>

            {/* Mobile / Tablet / Split-screen Drawer (< xl) */}
            <div className="xl:hidden fixed inset-0 z-50 flex justify-end">
              {/* Backdrop */}
              <div
                onClick={() => setShowRightSidebar(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
              />
              {/* Drawer Content */}
              <div className="relative z-10 h-full w-full sm:w-[320px] bg-[#161622] border-l border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
                <RightSidebar onClose={() => setShowRightSidebar(false)} />
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
};

export default HomePage;
