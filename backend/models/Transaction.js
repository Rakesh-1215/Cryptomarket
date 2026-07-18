const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  cryptoType: { type: String, required: true },
  amount: { type: Number, required: true }, // amount bought
  price: { type: Number, required: true }, // current price at time of purchase
  totalValue: { type: Number, required: true }, // amount * price
  timestamp: { type: Date, default: Date.now },
  // other details can be added here
});

module.exports = mongoose.model("Transaction", transactionSchema);
