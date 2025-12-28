import jwt from "jsonwebtoken";

export const generateToken = (userId) => {
  return jwt.sign(
    { userId }, // ✅ MUST match middleware
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};
