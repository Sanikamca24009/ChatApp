import Group from "../models/Group.js";
import Message from "../models/Message.js";
import cloudinary from "../lib/cloudinary.js";
import { io, userSocketMap } from "../server.js";

// Create a new group
export const createGroup = async (req, res) => {
  try {
    const { name, members } = req.body;
    const adminId = req.user._id;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Group name is required" });
    }

    let parsedMembers = [];
    if (typeof members === "string") {
      try {
        parsedMembers = JSON.parse(members);
      } catch (e) {
        parsedMembers = members.split(",").map((m) => m.trim());
      }
    } else if (Array.isArray(members)) {
      parsedMembers = members;
    }

    // Ensure member IDs are strings and unique, include admin
    const memberSet = new Set(parsedMembers.map((id) => id.toString()));
    memberSet.add(adminId.toString());
    const finalMembers = Array.from(memberSet);

    if (finalMembers.length < 2) {
      return res.status(400).json({
        success: false,
        message: "A group must have at least 2 members",
      });
    }

    const group = await Group.create({
      name: name.trim(),
      members: finalMembers,
      admin: adminId,
    });

    const populatedGroup = await Group.findById(group._id)
      .populate("members", "fullName profilePic email")
      .populate("admin", "fullName profilePic");

    const groupObj = populatedGroup.toObject();
    groupObj.isGroup = true;
    groupObj.lastMessage = null;
    groupObj.lastMessageTime = new Date(group.createdAt).getTime();

    // Broadcast new group to all online group members
    finalMembers.forEach((memberId) => {
      const sId = userSocketMap[memberId.toString()];
      if (sId) {
        io.to(sId).emit("newGroup", groupObj);
      }
      io.to(memberId.toString()).emit("newGroup", groupObj);
    });

    res.status(201).json({ success: true, group: groupObj });
  } catch (error) {
    console.error("Error in createGroup:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all groups the logged-in user belongs to
export const getGroups = async (req, res) => {
  try {
    const userId = req.user._id;

    const groups = await Group.find({ members: userId })
      .populate("members", "fullName profilePic email")
      .populate("admin", "fullName profilePic")
      .sort({ updatedAt: -1 });

    const groupsWithDetails = await Promise.all(
      groups.map(async (group) => {
        const lastMsg = await Message.findOne({
          groupId: group._id,
          deletedFor: { $ne: userId },
        })
          .sort({ createdAt: -1 })
          .populate("senderId", "fullName");

        const groupObj = group.toObject();
        groupObj.isGroup = true;
        groupObj.lastMessage = lastMsg
          ? {
              text: lastMsg.text,
              image: lastMsg.image,
              audio: lastMsg.audio,
              messageType: lastMsg.messageType,
              isDeleted: lastMsg.isDeleted,
              senderId: lastMsg.senderId,
              createdAt: lastMsg.createdAt,
            }
          : null;
        groupObj.lastMessageTime = lastMsg
          ? new Date(lastMsg.createdAt).getTime()
          : new Date(group.createdAt).getTime();

        return groupObj;
      })
    );

    groupsWithDetails.sort((a, b) => b.lastMessageTime - a.lastMessageTime);

    res.json({ success: true, groups: groupsWithDetails });
  } catch (error) {
    console.error("Error in getGroups:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get messages for a specific group
export const getGroupMessages = async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    const isMember = group.members.some((m) => m.toString() === userId.toString());
    if (!isMember) {
      return res.status(403).json({ success: false, message: "You are not a member of this group" });
    }

    const messages = await Message.find({
      groupId,
      deletedFor: { $ne: userId },
    }).populate("senderId", "fullName profilePic");

    res.json({ success: true, messages });
  } catch (error) {
    console.error("Error in getGroupMessages:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Send message to a group
export const sendGroupMessage = async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const { text } = req.body;
    const senderId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    const isMember = group.members.some((m) => m.toString() === senderId.toString());
    if (!isMember) {
      return res.status(403).json({ success: false, message: "You are not a member of this group" });
    }

    const uploadedFile = req.file || (req.files && req.files[0]);
    let fileUrl = "";
    let isAudio = false;

    // Handle file upload via Multer
    if (uploadedFile) {
      isAudio = Boolean(
        uploadedFile.mimetype?.startsWith("audio/") ||
        uploadedFile.mimetype?.includes("webm") ||
        uploadedFile.mimetype?.includes("ogg") ||
        uploadedFile.fieldname === "audio" ||
        req.body.messageType === "audio"
      );

      const hasCloudinary = Boolean(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET
      );

      if (hasCloudinary) {
        try {
          const uploadOptions = {
            folder: isAudio ? "chat-audio" : "chat-messages",
            resource_type: "auto",
          };
          const uploadResponse = await cloudinary.uploader.upload(uploadedFile.path, uploadOptions);
          fileUrl = uploadResponse.secure_url;
        } catch (cloudErr) {
          console.error("Cloudinary upload failed, using local storage:", cloudErr.message);
          fileUrl = `${req.protocol}://${req.get("host")}/uploads/${uploadedFile.filename}`;
        }
      } else {
        fileUrl = `${req.protocol}://${req.get("host")}/uploads/${uploadedFile.filename}`;
      }
    } else if (req.body.image) {
      // Base64 upload fallback
      try {
        const uploadResponse = await cloudinary.uploader.upload(req.body.image);
        fileUrl = uploadResponse.secure_url;
      } catch (err) {
        console.error("Base64 upload error:", err.message);
      }
    } else if (req.body.audio) {
      fileUrl = req.body.audio;
      isAudio = true;
    }

    const messageType = isAudio ? "audio" : fileUrl ? "image" : "text";

    const newMessage = await Message.create({
      senderId,
      groupId,
      text: text || "",
      image: isAudio ? "" : (fileUrl || ""),
      audio: isAudio ? (fileUrl || "") : "",
      messageType,
      status: "delivered",
    });

    const populatedMessage = await Message.findById(newMessage._id).populate(
      "senderId",
      "fullName profilePic"
    );

    // Update group's updatedAt
    await Group.findByIdAndUpdate(groupId, { updatedAt: new Date() });

    // Broadcast message via Socket to all group members (except sender)
    group.members.forEach((memberId) => {
      const memberIdStr = memberId.toString();
      if (memberIdStr !== senderId.toString()) {
        const sId = userSocketMap[memberIdStr];
        if (sId) {
          io.to(sId).emit("newMessage", populatedMessage);
        }
      }
    });

    res.status(201).json({ success: true, newMessage: populatedMessage });
  } catch (error) {
    console.error("Error in sendGroupMessage:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Exit / Leave a group
export const exitGroup = async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    const isMember = group.members.some((m) => m.toString() === userId.toString());
    if (!isMember) {
      return res.status(403).json({ success: false, message: "You are not a member of this group" });
    }

    // Remove user from group members
    group.members = group.members.filter((m) => m.toString() !== userId.toString());

    // If no members remain, delete group
    if (group.members.length === 0) {
      await Group.findByIdAndDelete(groupId);
      await Message.deleteMany({ groupId });
      io.emit("groupDeleted", { groupId });
      return res.json({ success: true, message: "You left the group and the group was deleted" });
    }

    // If exiting user was the group admin, assign admin to the next member
    if (group.admin.toString() === userId.toString()) {
      group.admin = group.members[0];
    }

    await group.save();

    // Create system notice message
    const systemNotice = await Message.create({
      senderId: userId,
      groupId,
      text: `${req.user.fullName} left the group`,
      messageType: "text",
      status: "delivered",
    });

    const populatedGroup = await Group.findById(groupId)
      .populate("members", "fullName profilePic email")
      .populate("admin", "fullName profilePic");

    const groupObj = populatedGroup.toObject();
    groupObj.isGroup = true;
    groupObj.lastMessage = systemNotice;
    groupObj.lastMessageTime = new Date(systemNotice.createdAt).getTime();

    // Notify remaining group members
    group.members.forEach((memberId) => {
      const sId = userSocketMap[memberId.toString()];
      if (sId) {
        io.to(sId).emit("groupMemberLeft", {
          groupId,
          userId: userId.toString(),
          userName: req.user.fullName,
          group: groupObj,
        });
        io.to(sId).emit("newMessage", systemNotice);
      }
    });

    res.json({ success: true, message: "Left group successfully", group: groupObj });
  } catch (error) {
    console.error("Error in exitGroup:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Add members to an existing group
export const addMembers = async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const { memberIds } = req.body;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    const isAdmin = group.admin.toString() === userId.toString();
    if (!isAdmin) {
      return res.status(403).json({ success: false, message: "Only the group admin can add members" });
    }

    let parsedMembers = [];
    if (typeof memberIds === "string") {
      try {
        parsedMembers = JSON.parse(memberIds);
      } catch (e) {
        parsedMembers = memberIds.split(",").map((m) => m.trim());
      }
    } else if (Array.isArray(memberIds)) {
      parsedMembers = memberIds;
    }

    if (!parsedMembers || parsedMembers.length === 0) {
      return res.status(400).json({ success: false, message: "No members specified to add" });
    }

    const currentMemberIds = new Set(group.members.map((m) => m.toString()));
    const newMemberIds = parsedMembers.filter((mId) => !currentMemberIds.has(mId.toString()));

    if (newMemberIds.length === 0) {
      return res.status(400).json({ success: false, message: "Selected users are already members of this group" });
    }

    newMemberIds.forEach((mId) => group.members.push(mId));
    await group.save();

    const addedUsers = await User.find({ _id: { $in: newMemberIds } }).select("fullName");
    const addedNames = addedUsers.map((u) => u.fullName).join(", ");

    const systemNotice = await Message.create({
      senderId: userId,
      groupId,
      text: `${req.user.fullName} added ${addedNames || "new members"} to the group`,
      messageType: "text",
      status: "delivered",
    });

    const populatedGroup = await Group.findById(groupId)
      .populate("members", "fullName profilePic email lastSeen")
      .populate("admin", "fullName profilePic");

    const groupObj = populatedGroup.toObject();
    groupObj.isGroup = true;
    groupObj.lastMessage = systemNotice;
    groupObj.lastMessageTime = new Date(systemNotice.createdAt).getTime();

    group.members.forEach((memberId) => {
      const mIdStr = memberId.toString();
      const sId = userSocketMap[mIdStr];
      if (sId) {
        io.to(sId).emit("newGroup", groupObj);
        io.to(sId).emit("groupUpdated", groupObj);
        io.to(sId).emit("newMessage", systemNotice);
      }
      io.to(mIdStr).emit("newGroup", groupObj);
      io.to(mIdStr).emit("groupUpdated", groupObj);
      io.to(mIdStr).emit("newMessage", systemNotice);
    });

    res.json({ success: true, group: groupObj, message: "Members added successfully" });
  } catch (error) {
    console.error("Error in addMembers:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Remove a member from a group
export const removeMember = async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const { memberId } = req.body;
    const requesterId = req.user._id;

    if (!memberId) {
      return res.status(400).json({ success: false, message: "Member ID is required" });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ success: false, message: "Group not found" });
    }

    const isAdmin = group.admin.toString() === requesterId.toString();
    const isSelf = memberId.toString() === requesterId.toString();

    if (!isAdmin && !isSelf) {
      return res.status(403).json({ success: false, message: "Only the group admin can remove members" });
    }

    if (memberId.toString() === group.admin.toString() && group.members.length > 1) {
      return res.status(400).json({ success: false, message: "Cannot remove the group admin" });
    }

    const removedUser = await User.findById(memberId).select("fullName");
    const removedUserName = removedUser?.fullName || "A member";

    group.members = group.members.filter((m) => m.toString() !== memberId.toString());

    if (group.members.length === 0) {
      await Group.findByIdAndDelete(groupId);
      await Message.deleteMany({ groupId });
      io.emit("groupDeleted", { groupId });
      return res.json({ success: true, message: "Group was deleted as no members remain" });
    }

    await group.save();

    const systemNotice = await Message.create({
      senderId: requesterId,
      groupId,
      text: isSelf
        ? `${req.user.fullName} left the group`
        : `${removedUserName} was removed from the group by ${req.user.fullName}`,
      messageType: "text",
      status: "delivered",
    });

    const populatedGroup = await Group.findById(groupId)
      .populate("members", "fullName profilePic email lastSeen")
      .populate("admin", "fullName profilePic");

    const groupObj = populatedGroup.toObject();
    groupObj.isGroup = true;
    groupObj.lastMessage = systemNotice;
    groupObj.lastMessageTime = new Date(systemNotice.createdAt).getTime();

    const removedSocketId = userSocketMap[memberId.toString()];
    if (removedSocketId) {
      io.to(removedSocketId).emit("groupMemberLeft", {
        groupId,
        userId: memberId.toString(),
        userName: removedUserName,
        group: null,
      });
    }
    io.to(memberId.toString()).emit("groupMemberLeft", {
      groupId,
      userId: memberId.toString(),
      userName: removedUserName,
      group: null,
    });

    group.members.forEach((mId) => {
      const mIdStr = mId.toString();
      const sId = userSocketMap[mIdStr];
      if (sId) {
        io.to(sId).emit("groupUpdated", groupObj);
        io.to(sId).emit("newMessage", systemNotice);
      }
      io.to(mIdStr).emit("groupUpdated", groupObj);
      io.to(mIdStr).emit("newMessage", systemNotice);
    });

    res.json({ success: true, group: groupObj, message: `${removedUserName} removed from group` });
  } catch (error) {
    console.error("Error in removeMember:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};
