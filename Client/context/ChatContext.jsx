import { createContext, useContext, useEffect, useState } from "react";
import { AuthContext } from "./AuthContext";
import toast from "react-hot-toast";

export const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [unseenMessages, setUnseenMessages] = useState({});
  const [typingUser, setTypingUser] = useState(false);
  const [showRightSidebar, setShowRightSidebar] = useState(false);

  const { socket, axios, authUser } = useContext(AuthContext);

  // ---------------- USERS ----------------
  const getUsers = async () => {
    try {
      const { data } = await axios.get("/api/messages/users");
      if (data.success) {
        setUsers(data.users);
        setUnseenMessages(data.unseenMessages);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  // ---------------- MESSAGES ----------------
  const getMessages = async (userId) => {
    try {
      const { data } = await axios.get(`/api/messages/${userId}`);
      if (data.success) {
        setMessages(data.messages);
      }
    } catch (error) {
      toast.error(error.message);
    }
  };

  const sendMessage = async (messageData) => {
    try {
      const config = {};
      if (messageData instanceof FormData) {
        config.headers = { "Content-Type": "multipart/form-data" };
      }
      const { data } = await axios.post(
        `/api/messages/send/${selectedUser._id}`,
        messageData,
        config
      );
      if (data.success) {
        setMessages((prev) => [...prev, data.newMessage]);
        return data.newMessage;
      } else {
        toast.error(data.message || "Failed to send message");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  // ---------------- SOCKET LISTENERS ----------------
  useEffect(() => {
    if (!socket) return;

    let typingTimeout = null;

    socket.on("newMessage", (newMessage) => {
      if (selectedUser && newMessage.senderId === selectedUser._id) {
        setMessages((prev) => [...prev, newMessage]);
        setTypingUser(false);
        if (typingTimeout) clearTimeout(typingTimeout);

        // Actively viewing this chat, mark read immediately
        if (authUser) {
          socket.emit("markRead", {
            senderId: selectedUser._id,
            receiverId: authUser._id,
          });
        }
      }
    });

    socket.on("typing", ({ senderId }) => {
      if (selectedUser && senderId === selectedUser._id) {
        setTypingUser(true);
        if (typingTimeout) clearTimeout(typingTimeout);
        typingTimeout = setTimeout(() => {
          setTypingUser(false);
        }, 2000);
      }
    });

    socket.on("stopTyping", ({ senderId }) => {
      if (selectedUser && senderId === selectedUser._id) {
        setTypingUser(false);
        if (typingTimeout) clearTimeout(typingTimeout);
      }
    });

    socket.on("messagesRead", ({ readerId }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          String(msg.receiverId) === String(readerId)
            ? { ...msg, status: "read", seen: true }
            : msg
        )
      );
    });

    socket.on("messagesDelivered", ({ receiverId }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          String(msg.receiverId) === String(receiverId) && msg.status === "sent"
            ? { ...msg, status: "delivered" }
            : msg
        )
      );
    });

    socket.on("userOffline", ({ userId, lastSeen }) => {
      setUsers((prevUsers) =>
        prevUsers.map((u) => (u._id === userId ? { ...u, lastSeen } : u))
      );
      setSelectedUser((prev) =>
        prev && prev._id === userId ? { ...prev, lastSeen } : prev
      );
    });

    return () => {
      if (typingTimeout) clearTimeout(typingTimeout);
      setTypingUser(false);
      socket.off("newMessage");
      socket.off("typing");
      socket.off("stopTyping");
      socket.off("messagesRead");
      socket.off("messagesDelivered");
      socket.off("userOffline");
    };
  }, [socket, selectedUser, authUser]);

  return (
    <ChatContext.Provider
      value={{
        messages,
        users,
        selectedUser,
        setSelectedUser,
        getUsers,
        getMessages,
        sendMessage,
        unseenMessages,
        setUnseenMessages,
        typingUser,
        showRightSidebar,
        setShowRightSidebar,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
