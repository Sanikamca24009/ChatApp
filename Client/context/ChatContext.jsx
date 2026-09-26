import { createContext, useContext, useEffect, useState } from "react";
import { AuthContext } from "./AuthContext";
import toast from "react-hot-toast";

export const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [unseenMessages, setUnseenMessages] = useState({});
  const [typingUsers, setTypingUsers] = useState({}); // { [userIdOrGroupId]: boolean }
  const [showRightSidebar, setShowRightSidebar] = useState(false);

  const { socket, axios, authUser } = useContext(AuthContext);

  // ---------------- USERS & GROUPS ----------------
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

  const getGroups = async () => {
    try {
      const { data } = await axios.get("/api/groups");
      if (data.success) {
        setGroups(data.groups);
      }
    } catch (error) {
      console.error("Error fetching groups:", error.message);
    }
  };

  const createGroup = async ({ name, members }) => {
    try {
      const { data } = await axios.post("/api/groups/create", { name, members });
      if (data.success) {
        setGroups((prev) => {
          const exists = prev.some((g) => String(g._id) === String(data.group._id));
          return exists ? prev : [data.group, ...prev];
        });
        toast.success("Group created successfully!");
        return data.group;
      } else {
        toast.error(data.message || "Failed to create group");
        return null;
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
      return null;
    }
  };

  const exitGroup = async (groupId) => {
    try {
      const { data } = await axios.post(`/api/groups/${groupId}/exit`);
      if (data.success) {
        setGroups((prev) => prev.filter((g) => String(g._id) !== String(groupId)));
        if (selectedUser && String(selectedUser._id) === String(groupId)) {
          setSelectedUser(null);
          setShowRightSidebar(false);
        }
        toast.success(data.message || "Exited group successfully");
        return true;
      } else {
        toast.error(data.message || "Failed to exit group");
        return false;
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
      return false;
    }
  };

  const addMembersToGroup = async (groupId, memberIds) => {
    try {
      const { data } = await axios.post(`/api/groups/${groupId}/members/add`, { memberIds });
      if (data.success) {
        setGroups((prev) =>
          prev.map((g) => (String(g._id) === String(groupId) ? data.group : g))
        );
        if (selectedUser && String(selectedUser._id) === String(groupId)) {
          setSelectedUser((prev) => ({ ...prev, ...data.group }));
        }
        toast.success(data.message || "Members added successfully!");
        return data.group;
      } else {
        toast.error(data.message || "Failed to add members");
        return null;
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
      return null;
    }
  };

  const removeMemberFromGroup = async (groupId, memberId) => {
    try {
      const { data } = await axios.post(`/api/groups/${groupId}/members/remove`, { memberId });
      if (data.success) {
        setGroups((prev) =>
          prev.map((g) => (String(g._id) === String(groupId) ? data.group : g))
        );
        if (selectedUser && String(selectedUser._id) === String(groupId)) {
          setSelectedUser((prev) => ({ ...prev, ...data.group }));
        }
        toast.success(data.message || "Member removed successfully");
        return data.group;
      } else {
        toast.error(data.message || "Failed to remove member");
        return null;
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
      return null;
    }
  };

  // ---------------- MESSAGES ----------------
  const getMessages = async (id, isGroup = false) => {
    try {
      const endpoint = isGroup ? `/api/groups/${id}/messages` : `/api/messages/${id}`;
      const { data } = await axios.get(endpoint);
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
      const isGroup = selectedUser?.isGroup;
      const endpoint = isGroup
        ? `/api/groups/${selectedUser._id}/send`
        : `/api/messages/send/${selectedUser._id}`;

      const { data } = await axios.post(endpoint, messageData, config);
      if (data.success) {
        setMessages((prev) => {
          const exists = prev.some((m) => String(m._id) === String(data.newMessage._id));
          return exists ? prev : [...prev, data.newMessage];
        });

        if (isGroup) {
          setGroups((prevGroups) => {
            const targetId = String(selectedUser._id);
            const updated = prevGroups.map((g) => {
              if (String(g._id) === targetId) {
                return {
                  ...g,
                  lastMessage: data.newMessage,
                  lastMessageTime: new Date(data.newMessage.createdAt).getTime(),
                };
              }
              return g;
            });
            return updated.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
          });
        } else {
          // Update selectedUser's lastMessage and sort entire contacts list descending
          setUsers((prevUsers) => {
            const targetId = String(selectedUser._id);
            const updated = prevUsers.map((u) => {
              if (String(u._id) === targetId) {
                return {
                  ...u,
                  lastMessage: data.newMessage,
                  lastMessageTime: new Date(data.newMessage.createdAt).getTime(),
                };
              }
              return u;
            });
            return updated.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
          });
        }

        return data.newMessage;
      } else {
        toast.error(data.message || "Failed to send message");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
    }
  };

  const editMessage = async (messageId, text) => {
    try {
      const { data } = await axios.put(`/api/messages/edit/${messageId}`, { text });
      if (data.success) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === messageId ? data.updatedMessage : msg
          )
        );
        getUsers();
        toast.success("Message edited");
        return true;
      } else {
        toast.error(data.message || "Failed to edit message");
        return false;
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
      return false;
    }
  };

  const deleteForEveryone = async (messageId) => {
    try {
      const { data } = await axios.delete(`/api/messages/delete-everyone/${messageId}`);
      if (data.success) {
        setMessages((prev) =>
          prev.map((msg) =>
            String(msg._id) === String(messageId)
              ? { ...msg, ...data.deletedMessage, isDeleted: true, text: "", image: "" }
              : msg
          )
        );
        getUsers();
        toast.success("Deleted for everyone");
        return true;
      } else {
        toast.error(data.message || "Failed to delete message");
        return false;
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
      return false;
    }
  };

  const deleteForMe = async (messageId) => {
    try {
      const { data } = await axios.delete(`/api/messages/delete-me/${messageId}`);
      if (data.success) {
        setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
        getUsers();
        toast.success("Deleted for you");
        return true;
      } else {
        toast.error(data.message || "Failed to delete message");
        return false;
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.message);
      return false;
    }
  };

  const deleteMessage = deleteForEveryone;

  const toggleReaction = async (messageId, emoji) => {
    try {
      // Optimistic update
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg._id !== messageId) return msg;
          const currentReactions = msg.reactions || [];
          const myId = authUser?._id;
          const existingIdx = currentReactions.findIndex(
            (r) => String(r.userId) === String(myId)
          );

          let updatedReactions;
          if (existingIdx > -1) {
            if (currentReactions[existingIdx].emoji === emoji) {
              updatedReactions = currentReactions.filter(
                (_, idx) => idx !== existingIdx
              );
            } else {
              updatedReactions = currentReactions.map((r, idx) =>
                idx === existingIdx ? { ...r, emoji } : r
              );
            }
          } else {
            updatedReactions = [...currentReactions, { userId: myId, emoji }];
          }

          return { ...msg, reactions: updatedReactions };
        })
      );

      const { data } = await axios.put(`/api/messages/react/${messageId}`, {
        emoji,
      });

      if (data.success) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg._id === messageId ? { ...msg, reactions: data.reactions } : msg
          )
        );
      }
    } catch (error) {
      console.error("Failed to react:", error.message);
    }
  };

  // ---------------- SOCKET LISTENERS ----------------
  useEffect(() => {
    if (!socket) return;

    const typingTimeouts = new Map();
    const handledMsgIds = new Set();

    socket.on("newMessage", (newMessage) => {
      if (!newMessage) return;
      if (newMessage._id) {
        if (handledMsgIds.has(newMessage._id)) return;
        handledMsgIds.add(newMessage._id);
        if (handledMsgIds.size > 200) {
          const firstKey = handledMsgIds.keys().next().value;
          handledMsgIds.delete(firstKey);
        }
      }

      if (newMessage.groupId) {
        const isCurrentGroup =
          selectedUser &&
          selectedUser.isGroup &&
          String(selectedUser._id) === String(newMessage.groupId);

        if (isCurrentGroup) {
          setMessages((prev) => {
            const exists = prev.some((m) => String(m._id) === String(newMessage._id));
            return exists ? prev : [...prev, newMessage];
          });
        } else {
          setUnseenMessages((prev) => ({
            ...prev,
            [newMessage.groupId]: (prev[newMessage.groupId] || 0) + 1,
          }));
        }

        // Update group's last message and sort groups descending
        setGroups((prevGroups) => {
          const groupIdStr = String(newMessage.groupId);
          const updated = prevGroups.map((g) => {
            if (String(g._id) === groupIdStr) {
              return {
                ...g,
                lastMessage: newMessage,
                lastMessageTime: new Date(newMessage.createdAt).getTime(),
              };
            }
            return g;
          });
          return updated.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
        });
      } else {
        // Direct message
        const rawSenderId = String(newMessage.senderId?._id || newMessage.senderId || "");
        const isCurrentChat =
          selectedUser &&
          !selectedUser.isGroup &&
          rawSenderId === String(selectedUser._id);

        if (isCurrentChat) {
          setMessages((prev) => {
            const exists = prev.some((m) => String(m._id) === String(newMessage._id));
            return exists ? prev : [...prev, newMessage];
          });
          setTypingUser(false);
          if (typingTimeout) clearTimeout(typingTimeout);

          // Actively viewing this chat, mark read immediately
          if (authUser) {
            socket.emit("markRead", {
              senderId: selectedUser._id,
              receiverId: authUser._id,
            });
          }
        } else {
          // Increment unseen count for sender
          if (rawSenderId) {
            setUnseenMessages((prev) => ({
              ...prev,
              [rawSenderId]: (prev[rawSenderId] || 0) + 1,
            }));
          }
        }

        // Update sender's lastMessage and sort entire contacts list descending
        setUsers((prevUsers) => {
          const senderIdStr = rawSenderId;
          const updated = prevUsers.map((u) => {
            if (String(u._id) === senderIdStr) {
              return {
                ...u,
                lastMessage: newMessage,
                lastMessageTime: new Date(newMessage.createdAt).getTime(),
              };
            }
            return u;
          });
          return updated.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));
        });
      }
    });

    socket.on("newGroup", (newGroup) => {
      setGroups((prev) => {
        const exists = prev.some((g) => String(g._id) === String(newGroup._id));
        if (exists) return prev;
        return [newGroup, ...prev];
      });
    });

    socket.on("groupMemberLeft", ({ groupId, group: updatedGroup }) => {
      if (updatedGroup) {
        setGroups((prev) =>
          prev.map((g) => (String(g._id) === String(groupId) ? { ...g, ...updatedGroup } : g))
        );
        setSelectedUser((prev) => {
          if (prev && String(prev._id) === String(groupId)) {
            return {
              ...prev,
              ...updatedGroup,
              members: updatedGroup.members,
              admin: updatedGroup.admin,
            };
          }
          return prev;
        });
      }
    });

    socket.on("groupUpdated", (updatedGroup) => {
      if (!updatedGroup) return;
      setGroups((prev) =>
        prev.map((g) => (String(g._id) === String(updatedGroup._id) ? updatedGroup : g))
      );
      setSelectedUser((prev) => {
        if (prev && String(prev._id) === String(updatedGroup._id)) {
          return { ...prev, ...updatedGroup };
        }
        return prev;
      });
    });

    socket.on("groupDeleted", ({ groupId }) => {
      setGroups((prev) => prev.filter((g) => String(g._id) !== String(groupId)));
      setSelectedUser((prev) => (prev && String(prev._id) === String(groupId) ? null : prev));
    });

    socket.on("typing", ({ senderId, groupId }) => {
      const key = groupId ? String(groupId) : String(senderId);
      setTypingUsers((prev) => ({ ...prev, [key]: true }));

      if (typingTimeouts.has(key)) {
        clearTimeout(typingTimeouts.get(key));
      }
      const timer = setTimeout(() => {
        setTypingUsers((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        typingTimeouts.delete(key);
      }, 3500);
      typingTimeouts.set(key, timer);
    });

    socket.on("stopTyping", ({ senderId, groupId }) => {
      const key = groupId ? String(groupId) : String(senderId);
      if (typingTimeouts.has(key)) {
        clearTimeout(typingTimeouts.get(key));
        typingTimeouts.delete(key);
      }
      setTypingUsers((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
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

    socket.on("messageEdited", (updatedMsg) => {
      setMessages((prev) =>
        prev.map((msg) =>
          String(msg._id) === String(updatedMsg._id)
            ? { ...msg, ...updatedMsg }
            : msg
        )
      );
      getUsers();
    });

    socket.on("messageDeleted", (deletedMsg) => {
      setMessages((prev) => {
        const targetId = String(deletedMsg._id);
        const exists = prev.some((msg) => String(msg._id) === targetId);
        if (exists) {
          return prev.map((msg) =>
            String(msg._id) === targetId
              ? { ...msg, ...deletedMsg, isDeleted: true, text: "", image: "" }
              : msg
          );
        } else if (
          selectedUser &&
          (String(deletedMsg.senderId) === String(selectedUser._id) ||
            String(deletedMsg.receiverId) === String(selectedUser._id))
        ) {
          return [...prev, { ...deletedMsg, isDeleted: true, text: "", image: "" }];
        }
        return prev;
      });
      getUsers();
    });

    socket.on("messageReaction", ({ messageId, reactions }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          String(msg._id) === String(messageId) ? { ...msg, reactions } : msg
        )
      );
    });

    return () => {
      typingTimeouts.forEach((timer) => clearTimeout(timer));
      typingTimeouts.clear();
      socket.off("newMessage");
      socket.off("newGroup");
      socket.off("groupUpdated");
      socket.off("groupMemberLeft");
      socket.off("groupDeleted");
      socket.off("typing");
      socket.off("stopTyping");
      socket.off("messagesRead");
      socket.off("messagesDelivered");
      socket.off("userOffline");
      socket.off("messageEdited");
      socket.off("messageDeleted");
      socket.off("messageReaction");
    };
  }, [socket, selectedUser, authUser]);

  const isCurrentChatTyping = selectedUser
    ? Boolean(typingUsers[String(selectedUser._id)])
    : false;

  return (
    <ChatContext.Provider
      value={{
        messages,
        users,
        groups,
        setGroups,
        getGroups,
        createGroup,
        exitGroup,
        addMembersToGroup,
        removeMemberFromGroup,
        selectedUser,
        setSelectedUser,
        getUsers,
        getMessages,
        sendMessage,
        editMessage,
        deleteMessage,
        deleteForEveryone,
        deleteForMe,
        toggleReaction,
        unseenMessages,
        setUnseenMessages,
        typingUser: isCurrentChatTyping,
        typingUsers,
        showRightSidebar,
        setShowRightSidebar,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};
