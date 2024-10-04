const CustomerRank = require('../models/CustomerRank');
const Customer = require('../models/Customer');

// Thêm hạng khách hàng mới
exports.addCustomerRank = async (req, res) => {
    const { rank_name, discount_rate, min_spending, description } = req.body;

    try {
        // Kiểm tra rank_name đã tồn tại chưa
        let existingRank = await CustomerRank.findOne({ rank_name });
        if (existingRank) {
            return res.status(400).json({ msg: 'Tên hạng khách hàng đã tồn tại' });
        }

        // Tạo mới hạng khách hàng
        const customerRank = new CustomerRank({
            rank_name,
            discount_rate,
            min_spending,
            description,
            is_deleted: false,
        });

        await customerRank.save();
        res.status(201).json({ msg: 'Hạng khách hàng mới đã được thêm', customerRank });
    } catch (err) {
        console.error('Lỗi khi thêm hạng khách hàng:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};

// Cập nhật hạng khách hàng
exports.updateCustomerRank = async (req, res) => {
    const { rank_name, discount_rate, min_spending, description } = req.body;
    const { rankId } = req.params;

    try {
        let customerRank = await CustomerRank.findById(rankId);
        if (!customerRank || customerRank.is_deleted) {
            return res.status(404).json({ msg: 'Không tìm thấy hạng khách hàng' });
        }

        // Cập nhật thông tin nếu có
        if (rank_name) customerRank.rank_name = rank_name;
        if (discount_rate !== undefined) customerRank.discount_rate = discount_rate;
        if (min_spending !== undefined) customerRank.min_spending = min_spending;
        if (description) customerRank.description = description;

        customerRank.updated_at = Date.now();

        await customerRank.save();
        res.json({ msg: 'Cập nhật hạng khách hàng thành công', customerRank });
    } catch (err) {
        console.error('Lỗi khi cập nhật hạng khách hàng:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};

// Xóa mềm hạng khách hàng
exports.softDeleteCustomerRank = async (req, res) => {
    const { rankId } = req.params;

    try {
        let customerRank = await CustomerRank.findById(rankId);
        if (!customerRank || customerRank.is_deleted) {
            return res.status(404).json({ msg: 'Không tìm thấy hạng khách hàng' });
        }

        customerRank.is_deleted = true;
        customerRank.updated_at = Date.now();

        await customerRank.save();
        res.json({ msg: 'Hạng khách hàng đã được xóa mềm', customerRank });
    } catch (err) {
        console.error('Lỗi khi xóa hạng khách hàng:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};

// Lấy tất cả hạng khách hàng (bỏ qua những hạng đã bị xóa mềm)
exports.getAllCustomerRanks = async (req, res) => {
    try {
        const customerRanks = await CustomerRank.find({ is_deleted: false });
        res.json(customerRanks);
    } catch (err) {
        console.error('Lỗi khi lấy danh sách hạng khách hàng:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};

// Lấy chi tiết hạng khách hàng theo ID
exports.getCustomerRankById = async (req, res) => {
    const { rankId } = req.params;

    try {
        const customerRank = await CustomerRank.findOne({ _id: rankId, is_deleted: false });
        if (!customerRank) {
            return res.status(404).json({ msg: 'Không tìm thấy hạng khách hàng' });
        }

        res.json(customerRank);
    } catch (err) {
        console.error('Lỗi khi lấy chi tiết hạng khách hàng:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};
// Lấy tất cả khách hàng theo hạng của họ
exports.getCustomersByRank = async (req, res) => {
    const { rankId } = req.params;

    try {
        // Tìm tất cả khách hàng với `customer_rank_id` phù hợp và chưa bị xóa
        const customers = await Customer.find({ customer_rank_id: rankId, is_deleted: false })
            .populate('customer_rank_id')  // Populate để lấy thông tin hạng khách hàng
            .lean(); // Sử dụng lean() để trả về dữ liệu dưới dạng đối tượng JavaScript thuần

        // Kiểm tra nếu không có khách hàng nào được tìm thấy
        if (customers.length === 0) {
            return res.status(404).json({ msg: 'Không tìm thấy khách hàng với hạng này' });
        }

        // Trả về danh sách khách hàng
        res.json(customers);
    } catch (err) {
        console.error('Lỗi khi lấy danh sách khách hàng theo hạng:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};