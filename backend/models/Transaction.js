const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  cryptoType: { type: String, required: true },
  amount: { type: Number, required: true }, // amount bought
  price: { type: Number, required: true }, // current price at time of purchase
  totalValue: { type: Number, required: true }, // amount * price
  totalValueInr: { type: Number, default: null },
  currency: { type: String, default: "INR" },
  paymentProvider: { type: String, default: "razorpay" },
  paymentStatus: { type: String, default: "created" },
  paymentOrderId: { type: String, default: null, index: true },
  paymentId: { type: String, default: null, index: true },
  paymentSignature: { type: String, default: null },
  paymentMethod: { type: String, default: null },
  paymentEmail: { type: String, default: null },
  paymentContact: { type: String, default: null },
  timestamp: { type: Date, default: Date.now },
  // other details can be added here
});

module.exports = mongoose.model("Transaction", transactionSchema);
