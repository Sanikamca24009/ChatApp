import multer from "multer";
import path from "path";
import fs from "fs";

// Ensure uploads folder exists
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    let ext = path.extname(file.originalname).toLowerCase();
    if (!ext) {
      if (file.mimetype.startsWith("video/")) {
        ext = file.mimetype.includes("mp4") ? ".mp4" : ".webm";
      } else if (file.mimetype.startsWith("audio/")) {
        ext = file.mimetype.includes("ogg") ? ".ogg" : file.mimetype.includes("mp4") ? ".mp4" : ".webm";
      } else if (file.mimetype.startsWith("image/")) {
        ext = ".jpg";
      } else {
        ext = ".webm";
      }
    }
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype.startsWith("image/") ||
    file.mimetype.startsWith("audio/") ||
    file.mimetype.startsWith("video/") ||
    file.mimetype.includes("webm") ||
    file.mimetype.includes("ogg") ||
    file.mimetype.includes("wav") ||
    file.mimetype.includes("mp3") ||
    file.mimetype.includes("mp4") ||
    file.mimetype.includes("quicktime")
  ) {
    cb(null, true);
  } else {
    cb(new Error("Only image, audio and video files are allowed"), false);
  }
};

export const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB for HD video & audio
  fileFilter,
});

// Middleware supporting single 'image', 'audio', or 'file' field
export const uploadChatFile = upload.any();
