import express from "express";
import { protectRoute } from "../middleware/auth.js";
import {
  getMessages,
  getUsersForSidebar,
  markMessagesAsSeen,
  sendMessage
} from "../controllers/messageControllers.js"; // ensure filename matches

const messageRouter = express.Router();

messageRouter.get("/users", protectRoute, getUsersForSidebar);
messageRouter.get("/:id", protectRoute, getMessages);      // ✅ FIXED
messageRouter.put("/mark/:id", protectRoute, markMessagesAsSeen);
messageRouter.post("/send/:id", protectRoute, sendMessage); // ✅ FIXED

export default messageRouter;


