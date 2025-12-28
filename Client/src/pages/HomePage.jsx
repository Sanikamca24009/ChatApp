import React, { useContext } from "react";
import Sidebar from "../components/Sidebar";
import ChatContainer from "../components/ChatContainer";
import RightSidebar from "../components/RightSidebar";
import { ChatContext } from "../../context/ChatContext";

const HomePage = () => {
  const { selectedUser } = useContext(ChatContext);

  return (
    <div className="w-full h-screen bg-black flex justify-center items-center overflow-hidden">
      
      {/* APP CONTAINER */}
      <div className="w-full h-full sm:w-[90%] sm:h-[90%] border border-gray-700 rounded-2xl overflow-hidden">

        {/* MAIN GRID */}
        <div
          className={`h-full grid ${
            selectedUser
              ? "grid-cols-[300px_1fr_300px]"
              : "grid-cols-[300px_1fr]"
          }`}
        >

          {/* LEFT SIDEBAR */}
          <div className="h-full border-r border-gray-700 overflow-hidden">
            <Sidebar />
          </div>

          {/* CHAT AREA */}
          <div className="h-full overflow-hidden">
            <ChatContainer />
          </div>

          {/* RIGHT SIDEBAR (ONLY WHEN USER SELECTED) */}
          {selectedUser && (
            <div className="h-full border-l border-gray-700 overflow-hidden">
              <RightSidebar />
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default HomePage;
