import Message from "../models/Message.js";
import User from "../models/User.js";
import cloudinary from "../lib/cloudinary.js";
import {io, userSocketMap} from "../server.js";

// get all users except the logged in user
export const getUsersForSidebar = async (req, res)=>{
    try {
        const userId = req.user._id;
        const filteredUsers = await User.find({_id: {$ne: userId}}).select(
            "-password"
        );

        // count number of message not seen
        const unseenMessages = {}
        const promises = filteredUsers.map(async (user)=>{
            const messages = await Message.find({senderId: user._id, receiverId: 
            userId, seen: false})
            if(messages.length > 0){
                unseenMessages[user._id] = messages.length;
            }
        
        })
          await Promise.all(promises);
          res.json({success: true, users: filteredUsers, unseenMessages})                    
    }catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message})

    }
}

// get all mesage for selected user

export const getMessages = async (req, res) =>{
    try {
        const {id: selectedUserId} = req.params;
        const myId = req.user._id;

        const messages = await Message.find({
            $or: [
                {senderId: myId, receiverId: selectedUserId},
                {senderId: selectedUserId, receiverId: myId}
            ]
        })
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

        let imageUrl;

        // 1. If file uploaded via Multer
        if (req.file) {
            const hasCloudinary = Boolean(
                process.env.CLOUDINARY_CLOUD_NAME &&
                process.env.CLOUDINARY_API_KEY &&
                process.env.CLOUDINARY_API_SECRET
            );

            if (hasCloudinary) {
                try {
                    const uploadResponse = await cloudinary.uploader.upload(req.file.path, {
                        folder: "chat-messages",
                    });
                    imageUrl = uploadResponse.secure_url;
                } catch (cloudErr) {
                    console.error("Cloudinary upload failed, using local storage:", cloudErr.message);
                    imageUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
                }
            } else {
                imageUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;
            }
        } else if (req.body.image) {
            // 2. Base64 fallback if sent in JSON body
            try {
                const uploadResponse = await cloudinary.uploader.upload(req.body.image);
                imageUrl = uploadResponse.secure_url;
            } catch (err) {
                console.error("Base64 upload error:", err.message);
            }
        }

        const receiverSocketId = userSocketMap[receiverId];
        const status = receiverSocketId ? "delivered" : "sent";
        const messageType = imageUrl ? "image" : "text";

        const newMessage = await Message.create({
            senderId,
            receiverId,
            text: text || "",
            image: imageUrl || "",
            messageType,
            status
        });

        //emit message to receiver if online
        if(receiverSocketId){
            io.to(receiverSocketId).emit("newMessage", newMessage);
        }

        res.json({success: true, newMessage});

    }catch(error){
        console.log(error.message);
        res.json({success: false, message: error.message})     

    }
}