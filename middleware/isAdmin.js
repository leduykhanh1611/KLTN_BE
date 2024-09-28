// middleware/isAdmin.js

module.exports = function (req, res, next) {
  // Kiểm tra xem vai trò của user có phải là admin không
  if (req.user.role !== 'admin') {
    return res.status(403).json({ msg: 'Bạn không có quyền thực hiện hành động này' });
  }
  next();
};
