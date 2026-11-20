import Admin from '../models/Admin.js';
import {
  createAccessToken,
  createOtp,
  hashPassword,
  hashValue,
  verifyPassword,
} from '../utils/crypto.js';

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validPassword = (password) => typeof password === 'string' && password.length >= 8 && password.length <= 128;
const publicAdmin = (admin) => ({ id: admin.id, name: admin.name, email: admin.email });

const handleError = (res, error) => {
  if (error?.message === 'ADMIN_AUTH_SECRET must be configured') {
    return res.status(500).json({ success: false, message: 'Admin auth is not configured on the server.' });
  }
  console.error('Admin auth error:', error);
  return res.status(500).json({ success: false, message: 'Something went wrong.' });
};

export const login = async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = req.body?.password;
  if (!emailPattern.test(email) || typeof password !== 'string' || !password) {
    return res.status(400).json({ success: false, message: 'Valid email and password are required.' });
  }

  try {
    const admin = await Admin.findOne({ email, isActive: true }).select('+passwordHash');
    const matches = admin ? await verifyPassword(password, admin.passwordHash) : false;
    if (!matches) return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    const token = createAccessToken(admin.id);
    return res.json({ success: true, message: 'Login successful.', data: { token, tokenType: 'Bearer', expiresIn: 28800, admin: publicAdmin(admin) } });
  } catch (error) {
    return handleError(res, error);
  }
};

export const forgotPassword = async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!emailPattern.test(email)) return res.status(400).json({ success: false, message: 'A valid email is required.' });

  try {
    const admin = await Admin.findOne({ email, isActive: true });
    const response = { success: true, message: 'If an active admin account exists, an OTP has been issued.' };
    if (!admin) return res.json(response);

    const otp = createOtp();
    admin.passwordReset = {
      otpHash: hashValue(otp),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      attempts: 0,
      verifiedAt: null,
    };
    await admin.save();

    // No mail provider is configured in this starter project. Expose the OTP only for local development.
    if (process.env.NODE_ENV !== 'production') response.devOtp = otp;
    return res.json(response);
  } catch (error) {
    return handleError(res, error);
  }
};

export const verifyOtp = async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const otp = typeof req.body?.otp === 'string' ? req.body.otp.trim() : '';
  if (!emailPattern.test(email) || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ success: false, message: 'Valid email and six digit OTP are required.' });
  }

  try {
    const admin = await Admin.findOne({ email, isActive: true }).select('+passwordReset.otpHash');
    if (!admin || !admin.passwordReset?.otpHash || !admin.passwordReset.expiresAt || admin.passwordReset.expiresAt <= new Date()) {
      return res.status(400).json({ success: false, message: 'OTP is invalid or expired. Request a new OTP.' });
    }
    if (admin.passwordReset.attempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({ success: false, message: 'Too many OTP attempts. Request a new OTP.' });
    }

    if (hashValue(otp) !== admin.passwordReset.otpHash) {
      admin.passwordReset.attempts += 1;
      await admin.save();
      return res.status(400).json({ success: false, message: 'OTP is invalid or expired.' });
    }

    admin.passwordReset.verifiedAt = new Date();
    await admin.save();
    return res.json({ success: true, message: 'OTP verified. You can reset your password.' });
  } catch (error) {
    return handleError(res, error);
  }
};

export const resetPassword = async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const otp = typeof req.body?.otp === 'string' ? req.body.otp.trim() : '';
  const newPassword = req.body?.newPassword;
  if (!emailPattern.test(email) || !/^\d{6}$/.test(otp) || !validPassword(newPassword)) {
    return res.status(400).json({ success: false, message: 'Valid email, OTP, and a password of 8 to 128 characters are required.' });
  }

  try {
    const admin = await Admin.findOne({ email, isActive: true }).select('+passwordReset.otpHash +passwordHash');
    const reset = admin?.passwordReset;
    if (!admin || !reset?.otpHash || !reset.verifiedAt || !reset.expiresAt || reset.expiresAt <= new Date() || reset.attempts >= MAX_OTP_ATTEMPTS || hashValue(otp) !== reset.otpHash) {
      return res.status(400).json({ success: false, message: 'OTP verification is required or has expired.' });
    }
    if (await verifyPassword(newPassword, admin.passwordHash)) {
      return res.status(400).json({ success: false, message: 'New password must be different from the current password.' });
    }

    admin.passwordHash = await hashPassword(newPassword);
    admin.passwordReset = { otpHash: undefined, expiresAt: null, attempts: 0, verifiedAt: null };
    await admin.save();
    return res.json({ success: true, message: 'Password reset successful.' });
  } catch (error) {
    return handleError(res, error);
  }
};

export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || !validPassword(newPassword)) {
    return res.status(400).json({ success: false, message: 'Current password and a new password of 8 to 128 characters are required.' });
  }

  try {
    const admin = await Admin.findById(req.admin.id).select('+passwordHash');
    if (!admin || !(await verifyPassword(currentPassword, admin.passwordHash))) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }
    if (await verifyPassword(newPassword, admin.passwordHash)) {
      return res.status(400).json({ success: false, message: 'New password must be different from the current password.' });
    }
    admin.passwordHash = await hashPassword(newPassword);
    await admin.save();
    return res.json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    return handleError(res, error);
  }
};

export const getMe = (req, res) => res.json({ success: true, data: { admin: publicAdmin(req.admin) } });
