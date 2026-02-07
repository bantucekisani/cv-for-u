const mongoose = require("mongoose");

const PaymentSchema = new mongoose.Schema(
  {
    paymentId: { type: String, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    cvId: { type: mongoose.Schema.Types.ObjectId, ref: "CV" },
    type: {
      type: String,
      enum: ["cv", "cover-letter", "cover"],
      required: true
    },
    amount: { type: Number, required: true },
    status: { type: String, default: "COMPLETE" },
    provider: { type: String, default: "payfast" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", PaymentSchema);
