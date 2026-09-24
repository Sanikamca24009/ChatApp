import express from "express";
import { protectRoute } from "../middleware/auth.js";
import { upload, uploadChatFile } from "../lib/multer.js";
import {
  getMessages,
  getUsersForSidebar,
  markMessagesAsSeen,
  sendMessage,
  editMessage,
  deleteMessage,
  deleteMessageForEveryone,
  deleteMessageForMe,
  toggleReaction
} from "../controllers/messageControllers.js";

const messageRouter = express.Router();

messageRouter.get("/users", protectRoute, getUsersForSidebar);
messageRouter.get("/:id", protectRoute, getMessages);
messageRouter.put("/mark/:id", protectRoute, markMessagesAsSeen);
messageRouter.post("/send/:id", protectRoute, uploadChatFile, sendMessage);
messageRouter.put("/edit/:id", protectRoute, editMessage);
messageRouter.put("/react/:id", protectRoute, toggleReaction);
messageRouter.delete("/delete/:id", protectRoute, deleteMessage);
messageRouter.delete("/delete-everyone/:id", protectRoute, deleteMessageForEveryone);
messageRouter.delete("/delete-me/:id", protectRoute, deleteMessageForMe);

export default messageRouter;


