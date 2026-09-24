import express from "express";
import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
   senderId: {type: mongoose.Schema.Types.ObjectId, ref: "User", required: true},
   receiverId: {type: mongoose.Schema.Types.ObjectId, ref: "User"},
   groupId: {type: mongoose.Schema.Types.ObjectId, ref: "Group"},
   text: {type: String, },
   image: {type: String, },
   audio: {type: String, },
   seen: {type: Boolean, default: false},
   status: {type: String, enum: ["sent", "delivered", "read"], default: "sent"},
   messageType: {type: String, enum: ["text", "image", "call", "audio"], default: "text"},
   callDetails: {
      duration: {type: Number, default: 0},
      status: {type: String, enum: ["answered", "missed", "rejected", "declined"], default: "missed"},
      callType: {type: String, enum: ["voice", "video"], default: "voice"}
   },
   isEdited: {type: Boolean, default: false},
   isDeleted: {type: Boolean, default: false},
   deletedFor: [{type: mongoose.Schema.Types.ObjectId, ref: "User", default: []}],
   reactions: [
      {
         userId: {type: mongoose.Schema.Types.ObjectId, ref: "User", required: true},
         emoji: {type: String, required: true}
      }
   ]
},  {timestamps: true});

const Message = mongoose.model("Message", messageSchema);
export default Message;