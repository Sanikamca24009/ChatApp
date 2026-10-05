import React, { useContext, useState, useEffect, useRef } from "react";
import Sidebar from "../components/Sidebar";
import ChatContainer from "../components/ChatContainer";
import RightSidebar from "../components/RightSidebar";
import { ChatContext } from "../../context/ChatContext";

const DEFAULT_SIDEBAR_WIDTH = 400;
const MIN_SIDEBAR_WIDTH = 380;
const MAX_SIDEBAR_WIDTH = 650;

const HomePage = () => {
  const { selectedUser, showRightSidebar, setShowRightSidebar } = useContext(ChatContext);
  const containerRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  // Check if screen is desktop width (>= 768px for md breakpoint)
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth >= 768 : true
  );

  // Persisted sidebar width
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("chat_sidebar_width");
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= MIN_SIDEBAR_WIDTH && parsed <= MAX_SIDEBAR_WIDTH) {
          return parsed;
        }
      }
    }
    return DEFAULT_SIDEBAR_WIDTH;
  });

  // Track window resize to toggle between desktop custom width and mobile full width
  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 768);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Handle dragging
  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e) => {
      if (!containerRef.current) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = clientX - containerRect.left;

      // Ensure at least 320px remains for the chat area
      const maxAllowed = Math.max(
        MIN_SIDEBAR_WIDTH,
        Math.min(MAX_SIDEBAR_WIDTH, containerRect.width - 320)
      );

      if (newWidth < MIN_SIDEBAR_WIDTH) {
        setSidebarWidth(MIN_SIDEBAR_WIDTH);
      } else if (newWidth > maxAllowed) {
        setSidebarWidth(maxAllowed);
      } else {
        setSidebarWidth(Math.round(newWidth));
      }
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };

    // Apply cursor & select styles globally during dragging
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    window.addEventListener("mousemove", handlePointerMove);
    window.addEventListener("mouseup", handlePointerUp);
    window.addEventListener("touchmove", handlePointerMove, { passive: false });
    window.addEventListener("touchend", handlePointerUp);

    return () => {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerUp);
      window.removeEventListener("touchmove", handlePointerMove);
      window.removeEventListener("touchend", handlePointerUp);
    };
  }, [isDragging]);

  // Save width to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("chat_sidebar_width", sidebarWidth.toString());
    } catch {
      // Ignore storage write issues
    }
  }, [sidebarWidth]);

  return (
    <div className="w-full h-screen bg-[#0d0e15] flex justify-center items-center overflow-hidden p-0 sm:p-3 md:p-5 lg:p-6">
      {/* APP CONTAINER */}
      <div
        ref={containerRef}
        className="w-full h-full max-w-[1600px] border-0 sm:border border-white/10 sm:rounded-2xl overflow-hidden flex bg-[#161622]/90 backdrop-blur-xl shadow-2xl relative"
      >
        {/* LEFT SIDEBAR (CONTACTS & USERS) */}
        <div
          style={isDesktop ? { width: `${sidebarWidth}px` } : undefined}
          className={`h-full overflow-hidden flex-shrink-0 flex-col ${
            isDragging ? "" : "transition-[width] duration-150"
          } ${
            selectedUser
              ? "hidden md:flex"
              : "flex w-full md:w-auto"
          }`}
        >
          <Sidebar />
        </div>

        {/* ADJUSTABLE RESIZER DIVIDER (DESKTOP) */}
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onTouchStart={() => setIsDragging(true)}
          onDoubleClick={() => setSidebarWidth(DEFAULT_SIDEBAR_WIDTH)}
          title="Drag to resize sidebar • Double-click to reset"
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={sidebarWidth}
          aria-valuemin={MIN_SIDEBAR_WIDTH}
          aria-valuemax={MAX_SIDEBAR_WIDTH}
          className={`hidden md:flex relative items-center justify-center w-[4px] cursor-col-resize select-none flex-shrink-0 z-20 group transition-colors duration-150 ${
            isDragging
              ? "bg-violet-500 shadow-[0_0_12px_rgba(139,92,246,0.7)]"
              : "bg-white/10 hover:bg-violet-500/70"
          }`}
        >
          {/* Expanded hit area so it is effortless to grab */}
          <div className="absolute inset-y-0 -left-2 -right-2 cursor-col-resize" />

          {/* Grip pill handle */}
          <div
            className={`w-[2px] rounded-full transition-all duration-150 ${
              isDragging
                ? "h-10 bg-white"
                : "h-8 bg-white/25 group-hover:h-10 group-hover:bg-white"
            }`}
          />
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
