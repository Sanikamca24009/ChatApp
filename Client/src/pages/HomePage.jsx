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
        {selectedUser && (
          <div
            className={`h-full border-l border-white/10 overflow-hidden flex-shrink-0 flex-col transition-all duration-300 ${
              showRightSidebar
                ? "absolute inset-0 z-40 bg-[#161622] sm:static sm:z-auto sm:w-[280px] lg:w-[300px] flex"
                : "hidden xl:flex xl:w-[280px] 2xl:w-[300px]"
            }`}
          >
            <RightSidebar onClose={() => setShowRightSidebar(false)} />
          </div>
        )}

      </div>
    </div>
  );
};

export default HomePage;
