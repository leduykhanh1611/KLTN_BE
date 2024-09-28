// app.js

const express = require('express');
const connectDB = require('./config/database');
require('dotenv').config();

const app = express();

// Kết nối tới MongoDB
connectDB();

// Middleware
app.use(express.json());

// Routes
app.use('/api/users', require('./routes/users'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/admins', require('./routes/admins'));
app.use('/api/employees', require('./routes/employees'));

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server chạy trên cổng ${PORT}`);
});
