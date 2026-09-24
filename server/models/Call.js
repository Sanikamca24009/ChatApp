import mongoose from "mongoose";

const callSchema = new mongoose.Schema(
  {
    caller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
    },
    isGroup: {
      type: Boolean,
      default: false,
    },
    duration: {
      type: Number,
      default: 0, // in seconds
    },
    status: {
      type: String,
      enum: ["answered", "missed", "rejected", "declined"],
      default: "missed",
    },
    callType: {
      type: String,
      enum: ["voice", "video"],
      default: "voice",
    },
  },
  { timestamps: true }
);

const Call = mongoose.model("Call", callSchema);
export default Call;
