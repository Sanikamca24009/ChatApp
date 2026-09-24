import express from "express";
import { protectRoute } from "../middleware/auth.js";
import { upload, uploadChatFile } from "../lib/multer.js";
import {
  createGroup,
  getGroups,
  getGroupMessages,
  sendGroupMessage,
  exitGroup,
} from "../controllers/groupControllers.js";

const groupRouter = express.Router();

groupRouter.post("/create", protectRoute, createGroup);
groupRouter.get("/", protectRoute, getGroups);
groupRouter.get("/:id/messages", protectRoute, getGroupMessages);
groupRouter.post("/:id/send", protectRoute, uploadChatFile, sendGroupMessage);
groupRouter.post("/:id/exit", protectRoute, exitGroup);
groupRouter.post("/:id/leave", protectRoute, exitGroup);

export default groupRouter;
