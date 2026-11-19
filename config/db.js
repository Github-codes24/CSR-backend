import mongoose from 'mongoose';

/**
 * Connect to MongoDB using Mongoose
 * Reads MONGO_URI from your .env file
 */
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGO_URI || process.env.MONGODB_URI;

    if (!mongoURI) {
      console.warn('⚠️  MONGO_URI is not set in your .env file yet.');
      return;
    }

    const conn = await mongoose.connect(mongoURI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
