const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    cvId: { type: mongoose.Schema.Types.ObjectId, ref: "CV" },
    type: { type: String, enum: ["cv", "cover", "cover-letter"]
, required: true },
    amount: { type: Number, required: true },
    status: { type: String, default: "COMPLETE" },
    provider: { type: String, default: "payfast" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", PaymentSchema);
