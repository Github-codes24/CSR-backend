import mongoose from 'mongoose';

const adminSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    isActive: { type: Boolean, default: true, index: true },
    passwordReset: {
      otpHash: { type: String, select: false },
      expiresAt: { type: Date, default: null },
      attempts: { type: Number, default: 0 },
      verifiedAt: { type: Date, default: null },
    },
  },
  { timestamps: true, versionKey: false },
);

const Admin = mongoose.models.Admin || mongoose.model('Admin', adminSchema);

export default Admin;
