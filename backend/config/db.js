import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127017.0.0.1:27017/connectsphere');
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    // Use 127.0.0.1 specifically instead of localhost if localhost fails
    try {
      console.log('Attempting connection to 127.0.0.1...');
      const conn = await mongoose.connect('mongodb://127.0.0.1:27017/connectsphere');
      console.log(`MongoDB Connected (fallback): ${conn.connection.host}`);
    } catch (fallbackError) {
      console.error(`Fallback connection also failed: ${fallbackError.message}`);
      process.exit(1);
    }
  }
};

export default connectDB;
