import express from "express";
import { checkAuth, forgotPassword, login, resetPassword, signup, updateProfile } from "../controllers/userControllers.js";
import { protectRoute } from "../middleware/auth.js";


const userRouter = express.Router();
userRouter.post("/signup", signup);
userRouter.post("/login", login);
userRouter.post("/forgot-password", forgotPassword);
userRouter.post("/reset-password/:token", resetPassword);
userRouter.put("/update-profile", protectRoute, updateProfile);
userRouter.get("/check", protectRoute, checkAuth);

export default userRouter;