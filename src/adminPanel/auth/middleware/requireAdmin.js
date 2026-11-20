import Admin from '../models/Admin.js';
import { decodeTokenSubject, verifyAccessToken } from '../utils/crypto.js';

const requireAdmin = async (req, res, next) => {
  const authorization = req.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const verifiedPayload = verifyAccessToken(token);

  if (!verifiedPayload) {
    return res.status(401).json({ success: false, message: 'Valid admin access token required.' });
  }

  const adminId = decodeTokenSubject(token);
  try {
    const admin = await Admin.findOne({ _id: adminId, isActive: true }).select('name email');
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Admin account is unavailable.' });
    }
    req.admin = admin;
    return next();
  } catch (error) {
    return next(error);
  }
};

export default requireAdmin;
