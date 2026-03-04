const mongoose = require('mongoose');
const { mongoUri } = require('./env');

const connectDb = async () => {
  if (!mongoUri) throw new Error('MONGO_URI is not set');
  await mongoose.connect(mongoUri);
  console.log('MongoDB connected');
};

module.exports = connectDb;
