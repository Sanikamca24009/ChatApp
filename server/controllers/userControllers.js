import { generateToken } from "../lib/utils.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import cloudinary from "../lib/cloudinary.js";
import crypto from "crypto";
import nodemailer from "nodemailer";


// sign up a new user
export const signup = async (req, res) => {
 const {fullName, email, password, bio} = req.body;

 try {
    // check if user already exists
    if (!fullName || !email || !password || !bio){
        return res.json({success: false,message:"Missing Details"})
    }
    const user = await User.findOne({email});
    if (user) {
        return res.json({success: false, message: "Account already exists"})
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
        fullName,
        email,
        password: hashedPassword,
        bio
    });

    const token = generateToken(newUser._id)
    res.json({success: true,userData: newUser, token, message: "Account created successfully"})
}catch (error) {
    console.log(error.message);
    res.json({success: false, message: error.message})
 }
}

// controller for user login
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1️⃣ Check user exists
    const userData = await User.findOne({ email });
    if (!userData) {
      return res.json({
        success: false,
        message: "User not found"
      });
    }

    // 2️⃣ Compare password
    const isPasswordCorrect = await bcrypt.compare(
      password,
      userData.password
    );

    if (!isPasswordCorrect) {
      return res.json({
        success: false,
        message: "Invalid credentials"
      });
    }

    // 3️⃣ Generate token
    const token = generateToken(userData._id);

    res.json({
      success: true,
      userData,
      token,
      message: "Login successful"
    });

  } catch (error) {
    console.log(error.message);
    res.json({
      success: false,
      message: error.message
    });
  }
};


// controller to check if user is authenticated
export const checkAuth = (req, res) => {
    res.json({success: true, user: req.user});
}

//controller to update user profile details
export const updateProfile = async (req, res)=>{
    try {
        const {profilePic, bio, fullName} = req.body;
        const userId = req.user._id;
        let updatedUser;
        
        if (!profilePic){
            updatedUser = await User.findByIdAndUpdate(userId, {bio,fullName}, {new: true});
        } else{
            const upload = await cloudinary.uploader.upload(profilePic);
            updatedUser = await User.findByIdAndUpdate(userId, {profilePic: upload.
                secure_url,
                bio,
                fullName
            }, {new: true});
        }     
        res.json({success: true, user: updatedUser});
    } catch (error) {
        console.log(error.message);
        res.json({success: false, message: error.message})
    }
}

// forgot password - generate token and send email
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: "Please enter your email address" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: "No account found with this email" });
    }

    // Generate short-lived crypto token valid for 15 minutes
    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 mins
    await user.save();

    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    const resetUrl = `${clientUrl}/reset-password/${resetToken}`;

    // Send email if credentials configured
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      try {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        const mailOptions = {
          from: `"QuickChat" <${process.env.EMAIL_USER}>`,
          to: user.email,
          subject: "Password Reset Request - QuickChat",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #1a1a2e; color: #ffffff; border-radius: 10px;">
              <h2 style="color: #a78bfa;">QuickChat Password Reset</h2>
              <p>Hello ${user.fullName || "User"},</p>
              <p>You requested to reset your password. Please click the link below to set a new password. This link is valid for <strong>15 minutes</strong>:</p>
              <div style="margin: 25px 0;">
                <a href="${resetUrl}" style="background: linear-gradient(to right, #a855f7, #7c3aed); color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Reset Password</a>
              </div>
              <p style="color: #9ca3af; font-size: 13px;">If the button above does not work, copy and paste this link into your browser:</p>
              <p style="color: #9ca3af; font-size: 12px; word-break: break-all;"><a href="${resetUrl}" style="color: #c084fc;">${resetUrl}</a></p>
              <hr style="border: 0; border-top: 1px solid #374151; margin: 20px 0;" />
              <p style="color: #6b7280; font-size: 11px;">If you did not request a password reset, please ignore this email.</p>
            </div>
          `,
        };

        await transporter.sendMail(mailOptions);
        console.log(`Password reset email sent to: ${user.email}`);
      } catch (mailError) {
        console.error("Error sending email:", mailError.message);
        console.log(`[DEV FALLBACK] Password Reset URL: ${resetUrl}`);
      }
    } else {
      console.log(`[DEV - NO EMAIL CREDENTIALS] Password Reset Link: ${resetUrl}`);
    }

    res.json({
      success: true,
      message: process.env.EMAIL_USER ? "Reset link sent to your email" : "Reset link generated! Click below to reset your password.",
      resetUrl: !process.env.EMAIL_USER ? resetUrl : undefined
    });
  } catch (error) {
    console.error("forgotPassword error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// reset password - verify token & set new password
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;

    if (!password || !confirmPassword) {
      return res.status(400).json({ success: false, message: "Please fill in all fields" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: "Passwords do not match" });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: "Link expired, please try again" });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.json({ success: true, message: "Password reset successful, please login" });
  } catch (error) {
    console.error("resetPassword error:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

