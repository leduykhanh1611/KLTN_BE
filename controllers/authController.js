// controllers/authController.js

const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
require('dotenv').config();

// Đăng nhập khách hàng
exports.loginCustomer = async (req, res) => {
    // Kiểm tra lỗi từ express-validator
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
        // Kiểm tra xem user có tồn tại không
        let user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ msg: 'Thông tin đăng nhập không đúng' });
        }

        // Kiểm tra xem user có phải là customer không
        if (user.role !== 'customer') {
            return res.status(403).json({ msg: 'Bạn không phải khách hàng' });
        }

        // So sánh mật khẩu
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Thông tin đăng nhập không đúng' });
        }

        // Tạo payload cho JWT
        const payload = {
            user: {
                id: user._id,
                role: user.role,
            },
        };

        // Ký JWT và trả về token
        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '24h' }, // Token hết hạn sau 1 giờ
            (err, token) => {
                if (err) throw err;
                res.json({ token });
            }
        );
    } catch (err) {
        console.error('Lỗi đăng nhập:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};

// Đăng nhập Ádmin
exports.loginAdmin = async (req, res) => {
    // Kiểm tra lỗi từ express-validator
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
        // Kiểm tra xem user có tồn tại không
        let user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ msg: 'Thông tin đăng nhập không đúng' });
        }

        // Kiểm tra xem user có phải là customer không
        if (user.role !== 'admin') {
            return res.status(403).json({ msg: 'Bạn không phải admin' });
        }

        // So sánh mật khẩu
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Thông tin đăng nhập không đúng' });
        }

        // Tạo payload cho JWT
        const payload = {
            user: {
                id: user._id,
                role: user.role,
            },
        };

        // Ký JWT và trả về token
        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '24h' }, // Token hết hạn sau 1 giờ
            (err, token) => {
                if (err) throw err;
                res.json({ token });
            }
        );
    } catch (err) {
        console.error('Lỗi đăng nhập:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};
// Đăng nhập Cho nhân viên
exports.loginEmployee = async (req, res) => {
    // Kiểm tra lỗi từ express-validator
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    try {
        // Kiểm tra xem user có tồn tại không
        let user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ msg: 'Thông tin đăng nhập không đúng' });
        }

        // Kiểm tra xem user có phải là customer không
        if (user.role !== 'employee') {
            return res.status(403).json({ msg: 'Bạn không phải nhân viên' });
        }

        // So sánh mật khẩu
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Thông tin đăng nhập không đúng' });
        }

        // Tạo payload cho JWT
        const payload = {
            user: {
                id: user._id,
                role: user.role,
            },
        };

        // Ký JWT và trả về token
        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '24h' }, // Token hết hạn sau 1 giờ
            (err, token) => {
                if (err) throw err;
                res.json({ token });
            }
        );
    } catch (err) {
        console.error('Lỗi đăng nhập:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};
