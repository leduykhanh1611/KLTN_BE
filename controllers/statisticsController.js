const Invoice = require('../models/Invoice');
const Appointment = require('../models/Appointment');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const AppointmentService = require('../models/AppointmentService');
//Thống kê Doanh Thu Theo Khoảng Thời Gian
exports.getRevenueByTimePeriod = async (req, res) => {
    const { start_date, end_date } = req.query;

    // Chuyển đổi các chuỗi ngày thành đối tượng Date và đảm bảo rằng cả hai đều hợp lệ
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    // Kiểm tra nếu ngày bắt đầu hoặc ngày kết thúc không hợp lệ
    if (isNaN(startDate) || isNaN(endDate)) {
        return res.status(400).json({ msg: 'Ngày bắt đầu hoặc ngày kết thúc không hợp lệ' });
    }

    try {
        // Tìm tất cả hóa đơn với trạng thái "paid" và nằm trong khoảng thời gian chỉ định
        const invoices = await Invoice.find({
            status: 'paid',
            is_deleted: false,
            created_at: { $gte: startDate, $lte: endDate }
        });

        // Khởi tạo đối tượng lưu doanh thu từng tháng
        const monthlyRevenue = {};
        const startMonth = startDate.getMonth();
        const endMonth = endDate.getMonth();
        const startYear = startDate.getFullYear();
        const endYear = endDate.getFullYear();

        for (let year = startYear; year <= endYear; year++) {
            const start = year === startYear ? startMonth : 0;
            const end = year === endYear ? endMonth : 11;
            for (let month = start; month <= end; month++) {
                const monthYear = `${month + 1}/${year}`;
                monthlyRevenue[monthYear] = 0;
            }
        }

        invoices.forEach(invoice => {
            const month = new Date(invoice.created_at).toLocaleString('default', { month: 'numeric', year: 'numeric' });
            monthlyRevenue[month] += invoice.final_amount;
        });

        // Tính mức tăng trưởng của tháng hiện tại so với tháng trước
        const revenueArray = Object.entries(monthlyRevenue).sort((a, b) => {
            const [monthA, yearA] = a[0].split('/').map(Number);
            const [monthB, yearB] = b[0].split('/').map(Number);
            return new Date(yearA, monthA - 1) - new Date(yearB, monthB - 1);
        });

        const growthRates = revenueArray.map(([, revenue], index) => {
            if (index === 0) return { month: revenueArray[index][0], growth: null };
            const previousRevenue = revenueArray[index - 1][1];
            const growth = previousRevenue === 0 && revenue === 0 ? 0 : previousRevenue === 0 ? 100 : ((revenue - previousRevenue) / previousRevenue) * 100;
            return { month: revenueArray[index][0], growth: growth.toFixed(2) + '%' };
        });

        res.status(200).json({ monthlyRevenue, growthRates });
    } catch (err) {
        console.error('Lỗi khi lấy doanh thu theo khoảng thời gian:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};

//Thống kê Số Lịch Hẹn Theo Khoảng Thời Gian
exports.getAppointmentsByTimePeriod = async (req, res) => {
    const { start_date, end_date } = req.query;

    // Chuyển đổi các chuỗi ngày thành đối tượng Date
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    // Kiểm tra nếu ngày bắt đầu hoặc ngày kết thúc không hợp lệ
    if (isNaN(startDate) || isNaN(endDate)) {
        return res.status(400).json({ msg: 'Ngày bắt đầu hoặc ngày kết thúc không hợp lệ' });
    }

    try {
        // Tìm tất cả các lịch hẹn đã hoàn thành trong khoảng thời gian chỉ định
        const appointments = await Appointment.find({
            status: 'completed',
            is_deleted: false,
            appointment_datetime: { $gte: startDate, $lte: endDate }
        }).populate('customer_id').populate('vehicle_id').populate('slot_id').lean();

        res.status(200).json(appointments);
    } catch (err) {
        console.error('Lỗi khi lấy lịch hẹn theo khoảng thời gian:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};
//Thống kê Tổng Số Lịch Hẹn và Doanh Thu Theo Tháng
exports.getMonthlyStatistics = async (req, res) => {
    const { month, year } = req.query;

    // Kiểm tra nếu tháng và năm không hợp lệ
    if (!month || !year) {
        return res.status(400).json({ msg: 'Tháng và năm là bắt buộc' });
    }

    // Tạo đối tượng Date cho ngày đầu tháng và ngày cuối tháng
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Ngày cuối cùng của tháng

    try {
        // Lấy tổng số lịch hẹn đã hoàn thành
        const appointmentsCount = await Appointment.countDocuments({
            status: 'completed',
            is_deleted: false,
            appointment_datetime: { $gte: startDate, $lte: endDate }
        });

        // Tính tổng doanh thu từ các hóa đơn trong tháng
        const invoices = await Invoice.find({
            status: 'paid',
            is_deleted: false,
            created_at: { $gte: startDate, $lte: endDate }
        });

        const totalRevenue = invoices.reduce((acc, invoice) => acc + invoice.final_amount, 0);

        res.status(200).json({ appointmentsCount, totalRevenue });
    } catch (err) {
        console.error('Lỗi khi lấy thống kê theo tháng:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};

// Xuất thống kê ra file Excel
exports.exportStatisticsToExcel = async (req, res) => {
    const { start_date, end_date } = req.query;

    try {
        // Lấy dữ liệu thống kê, ví dụ lịch hẹn hoặc hóa đơn từ cơ sở dữ liệu
        const appointments = await Appointment.find({
            appointment_datetime: { $gte: new Date(start_date), $lte: new Date(end_date) },
            is_deleted: false
        })
        .populate('customer_id')
        .lean();

        if (appointments.length === 0) {
            return res.status(404).json({ msg: 'Không tìm thấy dữ liệu trong khoảng thời gian này' });
        }

        // Tạo workbook và worksheet cho file Excel
        const wb = XLSX.utils.book_new();
        const wsData = [
            ['Mã lịch hẹn', 'Tên khách hàng', 'Thời gian lịch hẹn', 'Trạng thái']
        ];

        // Thêm dữ liệu từ `appointments` vào `wsData`
        appointments.forEach(app => {
            wsData.push([
                app._id.toString(),
                app.customer_id?.name || 'N/A',
                app.appointment_datetime.toLocaleString(),
                app.status
            ]);
        });

        // Tạo worksheet từ dữ liệu
        const ws = XLSX.utils.aoa_to_sheet(wsData);

        // Thêm worksheet vào workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Statistics');

        // Ghi dữ liệu workbook vào một buffer thay vì ghi ra file
        const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

        const name = `L&KTECH_${start_date}_to_${end_date}.xlsx`;
        // Thiết lập tiêu đề và gửi phản hồi
        res.setHeader('Content-Disposition', 'attachment; filename=' + name);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.status(200).send(buffer);

    } catch (err) {
        console.error('Lỗi khi xuất file Excel:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};

// API xuất thống kê doanh thu theo tháng hoặc năm ra file Excel với biểu đồ và thêm các sheet thống kê khác
exports.exportMonthlyStatisticsToExcel = async (req, res) => {
    const { year, month } = req.query;
    try {
        if (!year) {
            return res.status(400).json({ msg: 'Vui lòng cung cấp năm để thống kê doanh thu' });
        }

        // Tạo bộ lọc thời gian
        let startDate, endDate;
        if (month) {
            startDate = new Date(`${year}-${month}-01`);
            endDate = new Date(startDate);
            endDate.setMonth(endDate.getMonth() + 1);
        } else {
            startDate = new Date(`${year}-01-01`);
            endDate = new Date(`${year}-12-31`);
        }

        // Lấy doanh thu theo từng tháng hoặc tháng cụ thể trong năm
        const monthlyRevenue = new Array(12).fill(0);
        const totalAppointments = new Array(12).fill(0);
        const completedAppointments = new Array(12).fill(0);
        const cancelledAppointments = new Array(12).fill(0);
        const serviceUsage = {};
        const customerSpending = {};

        const invoices = await Invoice.find({
            is_deleted: false,
            status: 'paid',
            created_at: {
                $gte: startDate,
                $lte: endDate,
            },
        }).populate('customer_id');

        invoices.forEach(invoice => {
            const monthIndex = new Date(invoice.created_at).getMonth(); // Lấy tháng từ 0 - 11
            if (!month || monthIndex === parseInt(month) - 1) {
                monthlyRevenue[monthIndex] += invoice.final_amount;
            }
            // Tính tổng tiền khách hàng đã chi
            if (invoice.customer_id) {
                const customerName = invoice.customer_id.name;
                if (customerSpending[customerName]) {
                    customerSpending[customerName] += invoice.final_amount;
                } else {
                    customerSpending[customerName] = invoice.final_amount;
                }
            }
        });

        const appointments = await Appointment.find({
            is_deleted: false,
            appointment_datetime: {
                $gte: startDate,
                $lte: endDate,
            },
        });

        appointments.forEach(appointment => {
            const monthIndex = new Date(appointment.appointment_datetime).getMonth(); // Lấy tháng từ 0 - 11
            if (!month || monthIndex === parseInt(month) - 1) {
                totalAppointments[monthIndex]++;
                if (appointment.status === 'completed') {
                    completedAppointments[monthIndex]++;
                } else if (appointment.status === 'cancelled') {
                    cancelledAppointments[monthIndex]++;
                }
            }
        });

        const appointmentServices = await AppointmentService.find({
            is_deleted: false,
        }).populate({
            path: 'price_line_id',
            populate: {
                path: 'service_id',
                model: 'Service'
            }
        });

        appointmentServices.forEach(appService => {
            const serviceName = appService.price_line_id?.service_id?.name;
            if (serviceName) {
                if (serviceUsage[serviceName]) {
                    serviceUsage[serviceName]++;
                } else {
                    serviceUsage[serviceName] = 1;
                }
            }
        });

        // Tạo workbook và các worksheet
        const workbook = new ExcelJS.Workbook();

        // Sheet Doanh Thu
        const revenueSheet = workbook.addWorksheet('Doanh Thu');
        revenueSheet.columns = [
            { header: 'Tháng', key: 'month', width: 10 },
            { header: 'Doanh Thu (VND)', key: 'revenue', width: 20 },
        ];
        for (let i = 0; i < 12; i++) {
            if (!month || i === parseInt(month) - 1) {
                revenueSheet.addRow({ month: `Tháng ${i + 1}`, revenue: monthlyRevenue[i] });
            }
        }

        // Sheet Lịch Hẹn
        const appointmentSheet = workbook.addWorksheet('Lịch Hẹn');
        appointmentSheet.columns = [
            { header: 'Tháng', key: 'month', width: 10 },
            { header: 'Tổng Số Lịch Hẹn', key: 'total', width: 20 },
            { header: 'Hoàn Thành', key: 'completed', width: 15 },
            { header: 'Hủy', key: 'cancelled', width: 15 },
        ];
        for (let i = 0; i < 12; i++) {
            if (!month || i === parseInt(month) - 1) {
                appointmentSheet.addRow({
                    month: `Tháng ${i + 1}`,
                    total: totalAppointments[i],
                    completed: completedAppointments[i],
                    cancelled: cancelledAppointments[i],
                });
            }
        }

        // Sheet Sử Dụng Dịch Vụ
        const serviceSheet = workbook.addWorksheet('Sử Dụng Dịch Vụ');
        serviceSheet.columns = [
            { header: 'Dịch Vụ', key: 'service', width: 30 },
            { header: 'Số Lần Sử Dụng', key: 'usage', width: 20 },
        ];
        for (let [serviceName, usage] of Object.entries(serviceUsage)) {
            serviceSheet.addRow({ service: serviceName, usage });
        }

        // Sheet Tổng Chi Tiêu Khách Hàng
        const customerSheet = workbook.addWorksheet('Chi Tiêu Khách Hàng');
        customerSheet.columns = [
            { header: 'Khách Hàng', key: 'customer', width: 30 },
            { header: 'Tổng Chi Tiêu (VND)', key: 'spending', width: 20 },
        ];
        for (let [customerName, spending] of Object.entries(customerSpending)) {
            customerSheet.addRow({ customer: customerName, spending });
        }

        // Ghi workbook vào một buffer và gửi file về
        const buffer = await workbook.xlsx.writeBuffer();
        const name = `statistics_${year}${month ? `_${month}` : ''}.xlsx`;
        res.setHeader('Content-Disposition', 'attachment; filename=' + name);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.status(200).send(buffer);

    } catch (err) {
        console.error('Lỗi khi xuất file Excel:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};
