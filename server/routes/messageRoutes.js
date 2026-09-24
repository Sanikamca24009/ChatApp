import express from "express";
import { protectRoute } from "../middleware/auth.js";
import { upload } from "../lib/multer.js";
import {
  getMessages,
  getUsersForSidebar,
  markMessagesAsSeen,
  sendMessage
} from "../controllers/messageControllers.js";

const messageRouter = express.Router();

messageRouter.get("/users", protectRoute, getUsersForSidebar);
messageRouter.get("/:id", protectRoute, getMessages);
messageRouter.put("/mark/:id", protectRoute, markMessagesAsSeen);
messageRouter.post("/send/:id", protectRoute, upload.single("image"), sendMessage);

export default messageRouter;


