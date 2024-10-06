const cron = require('node-cron');
const mongoose = require('mongoose');
const User = require('../models/User'); // Cần đường dẫn đúng để import model User
require('dotenv').config(); // Load các biến môi trường từ .env

// Kết nối tới MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => {
  console.log('MongoDB Connected for Cron Job');
}).catch((err) => {
  console.error('Error connecting to MongoDB:', err.message);
});

// Tạo cron job để chạy mỗi giờ một lần
cron.schedule('0 * * * *', async () => {
  console.log('Chạy cron job để xóa tài khoản không kích hoạt...');

  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const usersToDelete = await User.find({
      is_active: false,
      otp_expiry: { $lt: oneHourAgo, $ne: null }
    });

    if (usersToDelete.length > 0) {
      for (const user of usersToDelete) {
        await User.deleteOne({ _id: user._id });
        console.log(`Xóa tài khoản không kích hoạt với email: ${user.email}`);
      }
    } else {
      console.log('Không tìm thấy tài khoản không kích hoạt nào cần xóa.');
    }
  } catch (err) {
    console.error('Lỗi khi xóa tài khoản không kích hoạt:', err.message);
  }
});

// Ngắt kết nối MongoDB khi quá trình kết thúc
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('Đóng kết nối MongoDB');
  process.exit(0);
});
