import jwt from 'jsonwebtoken';
import User from './user.model.js';

/**
 * @desc    Login user & return JWT token
 * @route   POST /api/auth/login
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        registerAs: user.registerAs,
      },
      process.env.JWT_SECRET || 'crs_default_secret_jwt_key_2026',
      { expiresIn: '7d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        registerAs: user.registerAs,
        organizationName: user.organizationName,
        companyName: user.companyName,
        mobileNumber: user.mobileNumber,
        city: user.city,
        state: user.state,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during login.',
      error: error.message,
    });
  }
};

/**
 * @desc    Request Password Reset OTP
 * @route   POST /api/auth/forgot-password
 */
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide your registered email address.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email address.',
      });
    }

    // Generate a 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // OTP valid for 10 minutes
    user.resetPasswordOtp = otp;
    user.resetPasswordOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
    user.isOtpVerified = false;
    await user.save();

    // Log to console for development / testing without SMTP server
    console.log(`\n========================================`);
    console.log(`🔑 PASSWORD RESET OTP for ${user.email}: [ ${otp} ]`);
    console.log(`⏰ Valid for 10 minutes`);
    console.log(`========================================\n`);

    return res.status(200).json({
      success: true,
      message: 'Password reset OTP has been sent successfully.',
      otp, // included for testing and ease of development
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during forgot password request.',
      error: error.message,
    });
  }
};

/**
 * @desc    Verify OTP for password reset
 * @route   POST /api/auth/verify-otp
 */
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and OTP.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    if (!user.resetPasswordOtp || user.resetPasswordOtp !== otp.toString().trim()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP. Please check and try again.',
      });
    }

    if (user.resetPasswordOtpExpires && user.resetPasswordOtpExpires < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.',
      });
    }

    user.isOtpVerified = true;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully. You can now reset your password.',
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during OTP verification.',
      error: error.message,
    });
  }
};

/**
 * @desc    Resend Password Reset OTP
 * @route   POST /api/auth/resend-otp
 */
export const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Please provide your registered email address.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email address.',
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.resetPasswordOtp = otp;
    user.resetPasswordOtpExpires = new Date(Date.now() + 10 * 60 * 1000);
    user.isOtpVerified = false;
    await user.save();

    console.log(`\n========================================`);
    console.log(`🔄 RESENT OTP for ${user.email}: [ ${otp} ]`);
    console.log(`========================================\n`);

    return res.status(200).json({
      success: true,
      message: 'A new OTP has been sent successfully.',
      otp,
    });
  } catch (error) {
    console.error('Resend OTP error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during resend OTP.',
      error: error.message,
    });
  }
};

/**
 * @desc    Reset password after OTP verification
 * @route   POST /api/auth/reset-password
 */
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword, confirmPassword } = req.body;

    if (!email || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email, newPassword, and confirmPassword.',
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Passwords do not match.',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    // Verify OTP if not already marked as verified
    if (!user.isOtpVerified) {
      if (!otp) {
        return res.status(400).json({
          success: false,
          message: 'OTP is required to reset password.',
        });
      }

      if (!user.resetPasswordOtp || user.resetPasswordOtp !== otp.toString().trim()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid OTP.',
        });
      }

      if (user.resetPasswordOtpExpires && user.resetPasswordOtpExpires < new Date()) {
        return res.status(400).json({
          success: false,
          message: 'OTP has expired. Please request a new one.',
        });
      }
    }

    // Set new password (pre-save hook will hash it)
    user.password = newPassword;
    user.resetPasswordOtp = undefined;
    user.resetPasswordOtpExpires = undefined;
    user.isOtpVerified = false;
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now login with your new password.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during password reset.',
      error: error.message,
    });
  }
};
