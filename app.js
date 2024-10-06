// app.js

const express = require("express");
const connectDB = require("./config/database");
require("dotenv").config();
const cors = require("cors");
const app = express();

// Kết nối tới MongoDB
connectDB();
app.use(
  cors({
    origin: "*" || "http://localhost:3001",
    credentials: true,
  })
);
// Middleware
app.use(express.json());

// Routes
app.use("/api/users", require("./routes/users"));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/admins", require("./routes/admins"));
app.use("/api/employees", require("./routes/employees"));
app.use("/api/vehicle-types", require("./routes/vehicleTypes"));
app.use("/api/vehicles", require("./routes/vehicles"));
app.use("/api/prices", require("./routes/prices"));
app.use("/api/services", require("./routes/services"));
app.use("/api/promotions", require("./routes/promotions"));
app.use('/api/customers-rank', require('./routes/customers_rank'));
app.use('/api/slots', require('./routes/slotRoutes'));
app.use('/api/appointments', require('./routes/appointmentRoutes'));
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server chạy trên cổng ${PORT}`);
});
