import Message from "../models/Message.js";
import User from "../models/User.js";
import cloudinary from "../lib/cloudinary.js";
import {io, userSocketMap} from "../server.js";

// get all users except the logged in user, sorted by most recent conversation
export const getUsersForSidebar = async (req, res) => {
    try {
        const userId = req.user._id;
        const filteredUsers = await User.find({ _id: { $ne: userId } }).select("-password");

        const unseenMessages = {};

        const usersWithDetails = await Promise.all(
            filteredUsers.map(async (user) => {
                // Find latest message between logged-in user and this contact
                const lastMsg = await Message.findOne({
                    $or: [
                        { senderId: userId, receiverId: user._id },
                        { senderId: user._id, receiverId: userId }
                    ],
                    deletedFor: { $ne: userId }
                }).sort({ createdAt: -1 });

                // Count unseen messages
                const unseenCount = await Message.countDocuments({
                    senderId: user._id,
                    receiverId: userId,
                    seen: false,
                    deletedFor: { $ne: userId }
                });

                if (unseenCount > 0) {
                    unseenMessages[user._id] = unseenCount;
                }

                const userObj = user.toObject();
                userObj.lastMessage = lastMsg ? {
                    text: lastMsg.text,
                    image: lastMsg.image,
                    audio: lastMsg.audio,
                    messageType: lastMsg.messageType,
                    isDeleted: lastMsg.isDeleted,
                    senderId: lastMsg.senderId,
                    createdAt: lastMsg.createdAt
                } : null;
                userObj.lastMessageTime = lastMsg ? new Date(lastMsg.createdAt).getTime() : 0;

                return userObj;
            })
        );

        // Sort descending by lastMessageTime so most recently active chat is first
        usersWithDetails.sort((a, b) => b.lastMessageTime - a.lastMessageTime);

        res.json({ success: true, users: usersWithDetails, unseenMessages });
    } catch (error) {
        console.error("Error in getUsersForSidebar:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// get all mesage for selected user

export const getMessages = async (req, res) =>{
    try {
        const {id: selectedUserId} = req.params;
        const myId = req.user._id;

        const messages = await Message.find({
            $or: [
                {senderId: myId, receiverId: selectedUserId},
                {senderId: selectedUserId, receiverId: myId}
            ],
            deletedFor: { $ne: myId }
        });
        await Message.updateMany(
            {senderId: selectedUserId, receiverId: myId, status: {$ne: "read"}},
            {seen: true, status: "read"});

        const senderSocketId = userSocketMap[selectedUserId];
        if(senderSocketId){
            io.to(senderSocketId).emit("messagesRead", { readerId: myId });
        }

        res.json({success: true, messages})
    }catch (error) {
         console.log(error.message);
        res.json({success: false, message: error.message})

    }
}

// api to mark messages as seen using message id

export const markMessagesAsSeen = async (req, res) =>{
    try {
        const {id} = req.params;
        const updatedMessage = await Message.findByIdAndUpdate(id, {seen: true, status: "read"}, {new: true});
        if(updatedMessage){
            const senderSocketId = userSocketMap[updatedMessage.senderId];
            if(senderSocketId){
                io.to(senderSocketId).emit("messagesRead", { readerId: updatedMessage.receiverId });
            }
        }
        res.json({success: true})
    }catch (error) {
         console.log(error.message);
        res.json({success: false, message: error.message})     
     }
}

//send message to selected user
export const sendMessage = async (req, res)=>{
    try{
        const { text } = req.body;
        const receiverId = req.params.id;
        const senderId = req.user.id || req.user._id;

        const uploadedFile = req.file || (req.files && req.files[0]);
        let fileUrl = "";
        let isAudio = false;

        // 1. If file uploaded via Multer
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
            // 2. Base64 fallback if sent in JSON body
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

        const receiverIdStr = receiverId.toString();
        const receiverSocketId = userSocketMap[receiverIdStr];
        const status = receiverSocketId ? "delivered" : "sent";
        const messageType = isAudio ? "audio" : fileUrl ? "image" : "text";

        const newMessage = await Message.create({
            senderId,
            receiverId,
            text: text || "",
            image: isAudio ? "" : (fileUrl || ""),
            audio: isAudio ? (fileUrl || "") : "",
            messageType,
            status
        });

        //emit message to receiver if online
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("newMessage", newMessage);
        }

        res.json({success: true, newMessage});

    }catch(error){
        console.log(error.message);
        res.json({success: false, message: error.message})     

    }
}

// edit message within 15 minutes of sending
export const editMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const { text } = req.body;
        const userId = req.user._id;

        if (!text || !text.trim()) {
            return res.status(400).json({ success: false, message: "Message text cannot be empty" });
        }

        const message = await Message.findById(id);
        if (!message) {
            return res.status(404).json({ success: false, message: "Message not found" });
        }

        // Ownership check
        if (message.senderId.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: "You can only edit your own messages" });
        }

        // Cannot edit a deleted message
        if (message.isDeleted) {
            return res.status(400).json({ success: false, message: "Deleted messages cannot be edited" });
        }

        // 15-minute window check
        const diffMinutes = (Date.now() - new Date(message.createdAt).getTime()) / (1000 * 60);
        if (diffMinutes > 15) {
            return res.status(400).json({ success: false, message: "Messages can only be edited within 15 minutes of sending" });
        }

        message.text = text.trim();
        message.isEdited = true;
        await message.save();

        // Emit socket event to receiver
        const receiverIdStr = message.receiverId.toString();
        const receiverSocketId = userSocketMap[receiverIdStr];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("messageEdited", message);
        }
        io.to(receiverIdStr).emit("messageEdited", message);

        res.json({ success: true, message: "Message updated", updatedMessage: message });
    } catch (error) {
        console.error("Error in editMessage:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// delete message for everyone (within 15 minutes of sending)
export const deleteMessageForEveryone = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const message = await Message.findById(id);
        if (!message) {
            return res.status(404).json({ success: false, message: "Message not found" });
        }

        // Ownership check
        if (message.senderId.toString() !== userId.toString()) {
            return res.status(403).json({ success: false, message: "You can only delete your own messages for everyone" });
        }

        // 15-minute window check
        const diffMinutes = (Date.now() - new Date(message.createdAt).getTime()) / (1000 * 60);
        if (diffMinutes > 15) {
            return res.status(400).json({ success: false, message: "Messages can only be deleted for everyone within 15 minutes of sending" });
        }

        message.isDeleted = true;
        message.text = "";
        message.image = "";
        await message.save();

        // Emit socket event to receiver
        const receiverIdStr = message.receiverId.toString();
        const receiverSocketId = userSocketMap[receiverIdStr];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("messageDeleted", message);
        }
        io.to(receiverIdStr).emit("messageDeleted", message);

        res.json({ success: true, message: "Message deleted for everyone", deletedMessage: message });
    } catch (error) {
        console.error("Error in deleteMessageForEveryone:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

export const deleteMessage = deleteMessageForEveryone;

// delete message for me only (anytime, for any message)
export const deleteMessageForMe = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user._id;

        const message = await Message.findById(id);
        if (!message) {
            return res.status(404).json({ success: false, message: "Message not found" });
        }

        if (!message.deletedFor.some(uid => uid.toString() === userId.toString())) {
            message.deletedFor.push(userId);
            await message.save();
        }

        res.json({ success: true, message: "Message deleted for you", messageId: id });
    } catch (error) {
        console.error("Error in deleteMessageForMe:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};

// toggle emoji reaction on a message
export const toggleReaction = async (req, res) => {
    try {
        const { id } = req.params;
        const { emoji } = req.body;
        const userId = req.user._id;

        if (!emoji) {
            return res.status(400).json({ success: false, message: "Emoji is required" });
        }

        const message = await Message.findById(id);
        if (!message) {
            return res.status(404).json({ success: false, message: "Message not found" });
        }

        if (message.isDeleted) {
            return res.status(400).json({ success: false, message: "Cannot react to deleted messages" });
        }

        if (!message.reactions) {
            message.reactions = [];
        }

        const existingReactionIndex = message.reactions.findIndex(
            (r) => r.userId.toString() === userId.toString()
        );

        if (existingReactionIndex > -1) {
            if (message.reactions[existingReactionIndex].emoji === emoji) {
                // Same emoji clicked: remove reaction (toggle off)
                message.reactions.splice(existingReactionIndex, 1);
            } else {
                // Different emoji: update to new emoji
                message.reactions[existingReactionIndex].emoji = emoji;
            }
        } else {
            // New reaction
            message.reactions.push({ userId, emoji });
        }

        await message.save();

        // Notify other chat participant via socket
        const otherUserId = message.senderId.toString() === userId.toString()
            ? message.receiverId
            : message.senderId;
        const otherUserIdStr = otherUserId.toString();

        const otherSocketId = userSocketMap[otherUserIdStr];
        if (otherSocketId) {
            io.to(otherSocketId).emit("messageReaction", {
                messageId: message._id,
                reactions: message.reactions,
            });
        }
        io.to(otherUserIdStr).emit("messageReaction", {
            messageId: message._id,
            reactions: message.reactions,
        });

        res.json({
            success: true,
            message: "Reaction updated",
            messageId: message._id,
            reactions: message.reactions,
        });
    } catch (error) {
        console.error("Error in toggleReaction:", error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};