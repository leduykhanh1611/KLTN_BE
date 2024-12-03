const Invoice = require('../models/Invoice');
const InvoiceDetail = require('../models/InvoiceDetail');
const Appointment = require('../models/Appointment');
const Promotion = require('../models/Promotion');
const PromotionHeader = require('../models/PromotionHeader');
const PromotionLine = require('../models/PromotionLine');
const PromotionDetail = require('../models/PromotionDetail');
const XLSX = require('xlsx');
const StyledXLSX = require('xlsx-style');
const XLSXStyle = require('xlsx-js-style');
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
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
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
            if (index === 0) {
                // Lấy doanh thu tháng trước tháng đầu tiên nếu có
                const previousMonth = new Date(revenueArray[index][0].split('/')[1], revenueArray[index][0].split('/')[0] - 2);
                const previousMonthKey = `${previousMonth.getMonth() + 1}/${previousMonth.getFullYear()}`;
                const previousRevenue = monthlyRevenue[previousMonthKey] || 0;
                const growth = previousRevenue === 0 && revenue === 0 ? 0 : previousRevenue === 0 ? 100 : ((revenue - previousRevenue) / previousRevenue) * 100;
                return { month: revenueArray[index][0], growth: growth.toFixed(2) + '%' };
            }
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
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
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
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
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

// Xuất thống kê doanh thu ra file Excel
exports.exportRevenueStatisticsToExcel = async (req, res) => {
    const { start_date, end_date } = req.query;
    try {
        if (!start_date || !end_date) {
            return res.status(400).json({ msg: 'Vui lòng cung cấp khoảng thời gian để thống kê doanh thu' });
        }

        const startDate = new Date(start_date);
        const endDate = new Date(end_date);

        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        if (isNaN(startDate) || isNaN(endDate)) {
            return res.status(400).json({ msg: 'Ngày không hợp lệ' });
        }

        // Format dates to dd/MM/yyyy
        const formattedStartDate = startDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const formattedEndDate = endDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

        const invoices = await Invoice.find({
            is_deleted: false,
            status: 'paid',
            created_at: {
                $gte: startDate,
                $lte: endDate,
            },
        }).populate('customer_id employee_id');

        const invoiceData = invoices.map(invoice => ({
            date: new Date(invoice.created_at).toLocaleDateString('vi-VN'),
            employeeCode: String(invoice.employee_id?._id || '').substring(0, 5).toUpperCase(),
            employeeName: invoice.employee_id?.name || '',
            discount: Math.round(invoice.discount_amount),
            revenueBeforeDiscount: Math.round(invoice.total_amount),
            revenueAfterDiscount: Math.round(invoice.final_amount),
        }));

        const borderStyle = { top: { style: 'thin' }, bottom: { style: 'thin' } };
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Doanh Số Bán Hàng Theo Ngày');
        worksheet.properties.tabColor = { argb: 'FF0000FF' }; // ARGB format for blue color
        worksheet.properties.defaultRowHeight = 20; // Default row height
        worksheet.properties.defaultColWidth = 20; // Default column width
        worksheet.views = [{ showGridLines: false }]; // Hide gridlines

        // Header Information
        worksheet.mergeCells('A1:G1');
        worksheet.getCell('A1').value = 'Tên Cửa Hàng: L&K TECH';
        worksheet.getCell('A1').font = { bold: true };
        worksheet.mergeCells('A2:G2');
        worksheet.getCell('A2').value = 'Địa chỉ cửa hàng: 319 C16 Lý Thường Kiệt, Phường 15, Quận 11, Tp.HCM';
        worksheet.getCell('A2').font = { bold: true };
        worksheet.mergeCells('A3:G3');
        worksheet.getCell('A3').value = `Ngày in: ${new Date().toLocaleDateString('vi-VN')}`;
        worksheet.getCell('A3').font = { bold: true };

        // Add title and date range rows
        worksheet.mergeCells('A4:G4');
        worksheet.getCell('A4').value = 'DOANH SỐ BÁN HÀNG THEO NGÀY';
        worksheet.getCell('A4').font = { bold: true, size: 16 };
        worksheet.getCell('A4').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A5:G5');
        worksheet.getCell('A5').value = `Từ ngày: ${formattedStartDate}       Đến ngày: ${formattedEndDate}`;
        worksheet.getCell('A5').alignment = { horizontal: 'centerContinuous' };

        // Header Row
        const headerRow = worksheet.addRow(['STT', 'NVBH', 'Tên NVBH', 'Ngày', 'Chiết khấu', 'Doanh số trước CK', 'Doanh số sau CK']);
        headerRow.eachCell((cell) => {
            cell.border = borderStyle;
            cell.font = { bold: true };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });

        // Add Grand Total Row
        let grandTotalDiscount = 0;
        let grandTotalRevenueBeforeDiscount = 0;
        let grandTotalRevenueAfterDiscount = 0;

        invoiceData.forEach(data => {
            grandTotalDiscount += data.discount;
            grandTotalRevenueBeforeDiscount += data.revenueBeforeDiscount;
            grandTotalRevenueAfterDiscount += data.revenueAfterDiscount;
        });

        const grandTotalRowData = ['Tổng cộng', '', '', '', grandTotalDiscount, grandTotalRevenueBeforeDiscount, grandTotalRevenueAfterDiscount];
        const grandTotalRow = worksheet.addRow(grandTotalRowData);
        grandTotalRow.eachCell((cell, colNumber) => {
            cell.font = { bold: true };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
            cell.border = borderStyle;
            if (colNumber >= 5 && colNumber <= 7) {
                cell.numFmt = '#,##0';
            }
        });

        // Process invoice data
        let currentDate = '';
        let dailyTotalDiscount = 0;
        let dailyTotalRevenueBeforeDiscount = 0;
        let dailyTotalRevenueAfterDiscount = 0;

        invoiceData.forEach((data, index) => {
            if (data.date !== currentDate) {
                if (currentDate !== '') {
                    // Thêm hàng tổng cộng cho ngày trước đó lên trên
                    const combinedRow = worksheet.addRow([
                        '', '', '', 'Tổng cộng theo ngày',
                        dailyTotalDiscount, dailyTotalRevenueBeforeDiscount, dailyTotalRevenueAfterDiscount,
                    ]);
                    combinedRow.eachCell((cell, colNumber) => {
                        cell.font = { italic: true, bold: true };
                        cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'left' : 'center' };
                        cell.border = borderStyle;

                        if (colNumber >= 5 && colNumber <= 7) {
                            cell.numFmt = '#,##0';
                        }
                    });

                    // Reset các biến tổng cho ngày tiếp theo
                    dailyTotalDiscount = 0;
                    dailyTotalRevenueBeforeDiscount = 0;
                    dailyTotalRevenueAfterDiscount = 0;
                }

                // Cập nhật ngày hiện tại và thêm hàng "Ngày"
                currentDate = data.date;
                const dateRow = worksheet.addRow([`Ngày: ${currentDate}`]);
                dateRow.eachCell((cell) => {
                    cell.font = { bold: true };
                    cell.alignment = { vertical: 'middle', horizontal: 'left' };
                    cell.border = borderStyle;
                });
            }

            // Thêm hàng dữ liệu chi tiết
            const transactionRow = worksheet.addRow([
                index + 1, data.employeeCode, data.employeeName, data.date,
                data.discount, data.revenueBeforeDiscount, data.revenueAfterDiscount,
            ]);
            transactionRow.eachCell((cell, colNumber) => {
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = borderStyle;
                if (colNumber >= 5 && colNumber <= 7) {
                    cell.numFmt = '#,##0';
                }
            });

            // Cộng dồn tổng ngày
            dailyTotalDiscount += data.discount;
            dailyTotalRevenueBeforeDiscount += data.revenueBeforeDiscount;
            dailyTotalRevenueAfterDiscount += data.revenueAfterDiscount;
        });

        // Thêm hàng tổng cộng cho ngày cuối cùng
        if (currentDate !== '') {
            const combinedRow = worksheet.addRow([
                '', '', '', 'Tổng cộng theo ngày',
                dailyTotalDiscount, dailyTotalRevenueBeforeDiscount, dailyTotalRevenueAfterDiscount,
            ]);
            combinedRow.eachCell((cell, colNumber) => {
                cell.font = { italic: true, bold: true };
                cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'left' : 'center' };
                cell.border = borderStyle;

                if (colNumber >= 5 && colNumber <= 7) {
                    cell.numFmt = '#,##0';
                }
            });
        }



        const buffer = await workbook.xlsx.writeBuffer();
        const name = `Thong_Ke_Tu_${start_date}_Den_${end_date}.xlsx`;
        res.setHeader('Content-Disposition', 'attachment; filename=' + name);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.status(200).send(buffer);

    } catch (err) {
        console.error('Lỗi khi xuất file Excel:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};
// Lấy thống kê doanh thu
exports.getRevenueStatistics = async (req, res) => {
    const { start_date, end_date } = req.query;
    try {
        if (!start_date || !end_date) {
            return res.status(400).json({ msg: 'Vui lòng cung cấp khoảng thời gian để thống kê doanh thu' });
        }

        const startDate = new Date(start_date);
        const endDate = new Date(end_date);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        if (isNaN(startDate) || isNaN(endDate)) {
            return res.status(400).json({ msg: 'Ngày không hợp lệ' });
        }

        // Format dates to dd/MM/yyyy
        const formattedStartDate = startDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const formattedEndDate = endDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

        const invoices = await Invoice.find({
            is_deleted: false,
            status: 'paid',
            created_at: {
                $gte: startDate,
                $lte: endDate,
            },
        }).populate('customer_id employee_id');

        const invoiceData = invoices.map(invoice => ({
            date: new Date(invoice.created_at).toLocaleDateString('vi-VN'),
            employeeCode: String(invoice.employee_id._id || '').substring(0, 5).toUpperCase(),
            employeeName: invoice.employee_id?.name || '',
            discount: Math.round(invoice.discount_amount),
            revenueBeforeDiscount: Math.round(invoice.total_amount),
            revenueAfterDiscount: Math.round(invoice.final_amount),
        }));

        let currentDate = '';
        let dailyTotalDiscount = 0;
        let dailyTotalRevenueBeforeDiscount = 0;
        let dailyTotalRevenueAfterDiscount = 0;
        let grandTotalDiscount = 0;
        let grandTotalRevenueBeforeDiscount = 0;
        let grandTotalRevenueAfterDiscount = 0;

        const result = [];
        let currentDailyData = null;

        // Loop through invoice data to process each date and employee's transactions
        invoiceData.forEach((data) => {
            if (data.date !== currentDate) {
                // Push daily data to the result if it's not the first date
                if (currentDailyData) {
                    currentDailyData.dailyTotal = {
                        discount: dailyTotalDiscount,
                        revenueBeforeDiscount: dailyTotalRevenueBeforeDiscount,
                        revenueAfterDiscount: dailyTotalRevenueAfterDiscount,
                    };
                    result.push(currentDailyData);
                }

                // Start a new date section
                currentDate = data.date;
                currentDailyData = {
                    date: currentDate,
                    transactions: [],
                };

                dailyTotalDiscount = 0;
                dailyTotalRevenueBeforeDiscount = 0;
                dailyTotalRevenueAfterDiscount = 0;
            }

            // Add transaction data to the current date
            currentDailyData.transactions.push({
                employeeCode: data.employeeCode,
                employeeName: data.employeeName,
                discount: data.discount,
                revenueBeforeDiscount: data.revenueBeforeDiscount,
                revenueAfterDiscount: data.revenueAfterDiscount,
            });

            // Accumulate daily and grand totals
            dailyTotalDiscount += data.discount;
            dailyTotalRevenueBeforeDiscount += data.revenueBeforeDiscount;
            dailyTotalRevenueAfterDiscount += data.revenueAfterDiscount;
            grandTotalDiscount += data.discount;
            grandTotalRevenueBeforeDiscount += data.revenueBeforeDiscount;
            grandTotalRevenueAfterDiscount += data.revenueAfterDiscount;
        });

        // Push the final daily data to the result
        if (currentDailyData) {
            currentDailyData.dailyTotal = {
                discount: dailyTotalDiscount,
                revenueBeforeDiscount: dailyTotalRevenueBeforeDiscount,
                revenueAfterDiscount: dailyTotalRevenueAfterDiscount,
            };
            result.push(currentDailyData);
        }

        // Add grand total to the response
        const grandTotal = {
            discount: grandTotalDiscount,
            revenueBeforeDiscount: grandTotalRevenueBeforeDiscount,
            revenueAfterDiscount: grandTotalRevenueAfterDiscount,
        };

        res.status(200).json({ dateRange: { start: formattedStartDate, end: formattedEndDate }, data: result, grandTotal });
    } catch (err) {
        console.error('Lỗi khi lấy dữ liệu:', err.message);
        res.status(500).send('Lỗi máy chủ');
    }
};
// Thống kê khuyến mãi
exports.getPromotionStatistics = async (req, res) => {
    try {
        const startDate = new Date(req.query.start_date);
        const endDate = new Date(req.query.end_date);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        // Bước 1: Tìm các PromotionLine trong khoảng thời gian
        const promotionLines = await PromotionLine.find({
            is_deleted: false,
            start_date: { $gte: startDate, $lte: endDate },
        }).select('_id promotion_header_id start_date end_date');

        if (promotionLines.length === 0) {
            return res.status(200).json({ message: 'Không có chương trình khuyến mãi nào trong khoảng thời gian này.' });
        }

        // Bước 2: Lấy tất cả các Promotion liên quan
        const promotionLineIds = promotionLines.map(line => line._id);
        const promotions = await Promotion.find({
            promotion_header_id: { $in: promotionLineIds },
            is_deleted: false,
            is_pay: true,
        });

        // Bước 3: Nhóm Promotion theo promotion_line_id
        const promotionMap = new Map();
        promotions.forEach(promotion => {
            const lineId = promotion.promotion_header_id.toString();
            if (!promotionMap.has(lineId)) {
                promotionMap.set(lineId, []);
            }
            promotionMap.get(lineId).push(promotion);
        });

        // Tạo Map cho PromotionHeader để tối ưu truy vấn
        const promotionHeaderIds = promotionLines.map(line => line.promotion_header_id);
        const promotionHeaders = await PromotionHeader.find({ _id: { $in: promotionHeaderIds } }).select('_id name promotion_code start_date end_date');
        const promotionHeaderMap = new Map();
        promotionHeaders.forEach(header => {
            promotionHeaderMap.set(header._id.toString(), {
                name: header.name,
                promotion_code: header.promotion_code,
                start_date: header.start_date,
                end_date: header.end_date,
            });
        });

        // Bước 4: Sử dụng vòng lặp để tính toán và tạo kết quả
        const result = [];

        for (const promotionLine of promotionLines) {
            const lineId = promotionLine._id.toString();
            const promotionsForLine = promotionMap.get(lineId) || [];

            // Tính tổng giá trị khuyến mãi
            const totalValue = promotionsForLine.reduce((sum, promo) => sum + promo.value, 0);

            // Lấy thông tin PromotionHeader từ Map
            const promotionHeaderInfo = promotionHeaderMap.get(promotionLine.promotion_header_id.toString()) || { name: 'Unknown', promotion_code: 'Unknown' };

            // Tạo đối tượng kết quả
            const promotionStatistic = {
                promotion_header_id: promotionLine.promotion_header_id,
                promotion_header_name: promotionHeaderInfo.name,
                promotion_code: promotionHeaderInfo.promotion_code,
                promotion_line_id: promotionLine._id,
                total_value: totalValue,
                start_date: promotionHeaderInfo.start_date,
                end_date: promotionHeaderInfo.end_date,
            };

            result.push(promotionStatistic);
        }

        // Bước 5: Trả về kết quả
        res.status(200).json(result);
    } catch (error) {
        console.error('Lỗi khi thống kê khuyến mãi:', error);
        res.status(500).json({ message: 'Lỗi khi thống kê khuyến mãi', error });
    }
};
// Xuất thống kê khuyến mãi ra file Excel
exports.exportPromotionStatisticsToExcel = async (req, res) => {
    try {
        const startDate = new Date(req.query.start_date);
        const endDate = new Date(req.query.end_date);

        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        // Format dates to dd/MM/yyyy
        const formattedStartDate = startDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const formattedEndDate = endDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        // Fetch promotion statistics (replace with your actual data fetching logic)
        const promotionStatistics = await getPromotionStatistics(startDate, endDate);
        console.log(promotionStatistics);
        if (!promotionStatistics || promotionStatistics.length === 0) {
            return res.status(200).json({ message: 'Không có dữ liệu để xuất báo cáo.' });
        }

        // Calculate total promotion value
        const totalValue = promotionStatistics.reduce((sum, promo) => sum + promo.total_promotion_value, 0);
        const totalValueCell = promotionStatistics.reduce((sum, promo) => sum + promo.total_invoice_value, 0);

        // Create a new workbook and add a worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Báo cáo CTKM');

        // Hide gridlines
        worksheet.properties.defaultGridlines = false;
        worksheet.properties.tabColor = { argb: 'FF0000FF' }; // ARGB format for blue color
        // Add metadata
        worksheet.mergeCells('A1:E1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = 'BÁO CÁO TỔNG KẾT CTKM';
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        titleCell.font = { bold: true, size: 16 };
        worksheet.mergeCells('A2:E2');
        worksheet.getCell('A2').value = `Từ ngày: ${formattedStartDate}       Đến ngày: ${formattedEndDate}`;
        worksheet.getCell('A2').alignment = { horizontal: 'centerContinuous' };
        worksheet.addRow([]);
        worksheet.addRow(['Thời gian xuất báo cáo:', new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })]);
        worksheet.addRow(['User xuất báo cáo:', 'Admin']);
        worksheet.addRow([]);

        // Add header
        const headerRow = worksheet.addRow(['Mã CTKM', 'Tên CTKM', 'Ngày bắt đầu', 'Ngày kết thúc', 'Số tiền chiết khấu', 'Doanh thu']);

        // Apply styles to each cell in the header row
        headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF538DD5' },
            };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' },
            };
        });

        // Add promotion data
        promotionStatistics.forEach((promo) => {
            const row = worksheet.addRow([
                promo.promotion_code,
                promo.promotion_header_name,
                new Date(promo.start_date).toLocaleDateString('vi-VN'),
                new Date(promo.end_date).toLocaleDateString('vi-VN'),
                promo.total_promotion_value,
                promo.total_invoice_value
            ]);

            // Format the 'Số tiền chiết khấu' column as currency
            row.getCell(5).numFmt = '#,##0';
            row.getCell(6).numFmt = '#,##0';
            row.alignment = { vertical: 'middle' };

            // Apply border to data cells
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' },
                };
            });
        });

        // Add total row
        const totalRow = worksheet.addRow(['Tổng CTKM', '', '', '', totalValue, totalValueCell]);
        totalRow.alignment = { horizontal: 'center', vertical: 'middle' };
        totalRow.getCell(5).numFmt = '#,##0';
        totalRow.getCell(6).numFmt = '#,##0';
        // Apply border to total row
        totalRow.eachCell((cell) => {
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' },
            };
            cell.font = { bold: true, color: { argb: 'FFFF0000' } };
        });

        // Adjust column widths
        worksheet.getColumn(1).width = 20; // Mã CTKM
        worksheet.getColumn(2).width = 40; // Tên CTKM
        worksheet.getColumn(3).width = 15; // Ngày bắt đầu
        worksheet.getColumn(4).width = 15; // Ngày kết thúc
        worksheet.getColumn(5).width = 20; // Số tiền chiết khấu
        worksheet.getColumn(6).width = 20; // Số tiền chiết khấu

        worksheet.views = [{ showGridLines: false }];
        // Generate buffer
        const buffer = await workbook.xlsx.writeBuffer();

        // Format file name
        const fileName = `Thong_Ke_Tu_${startDate.toISOString().split('T')[0]}_Den_${endDate.toISOString().split('T')[0]}.xlsx`;

        // Send file to client
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.status(200).send(buffer);
    } catch (error) {
        console.error('Lỗi khi xuất báo cáo:', error);
        res.status(500).json({ message: 'Lỗi khi xuất báo cáo', error });
    }
};

async function getPromotionStatistics(startDate, endDate) {
    try {
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        // Bước 1: Tìm các PromotionLine trong khoảng thời gian
        const promotionLines = await PromotionLine.find({
            is_deleted: false,
        }).select('_id promotion_header_id start_date end_date');

        if (promotionLines.length === 0) {
            return { message: 'Không có chương trình khuyến mãi nào trong khoảng thời gian này.' };
        }

        // Bước 2: Lấy tất cả các Promotion liên quan
        const promotionLineIds = promotionLines.map(line => line._id);
        const promotions = await Promotion.find({
            promotion_header_id: { $in: promotionLineIds },
            is_deleted: false,
            is_pay: true,
            created_at: { $gte: startDate, $lte: endDate },
        });

        // Bước 3: Nhóm Promotion theo promotion_line_id
        const promotionMap = new Map();
        promotions.forEach(promotion => {
            const lineId = promotion.promotion_header_id.toString();
            if (!promotionMap.has(lineId)) {
                promotionMap.set(lineId, []);
            }
            promotionMap.get(lineId).push(promotion);
        });

        // Tạo Map cho PromotionHeader để tối ưu truy vấn
        const promotionHeaderIds = promotionLines.map(line => line.promotion_header_id);
        const promotionHeaders = await PromotionHeader.find({ _id: { $in: promotionHeaderIds } }).select('_id name promotion_code start_date end_date');
        const promotionHeaderMap = new Map();
        promotionHeaders.forEach(header => {
            promotionHeaderMap.set(header._id.toString(), {
                name: header.name,
                promotion_code: header.promotion_code,
                start_date: header.start_date,
                end_date: header.end_date,
            });
        });

        // Bước 4: Lấy tất cả Invoice liên quan
        const invoiceIds = promotions.map(promo => promo.invoice_id).filter(id => id);
        const invoices = await Invoice.find({
            _id: { $in: invoiceIds },
            is_deleted: false,
        }).select('_id total_amount discount_amount');

        // Tạo Map Invoice để tính tổng giá trị hóa đơn
        const invoiceMap = new Map();
        invoices.forEach(invoice => {
            invoiceMap.set(invoice._id.toString(), invoice.total_amount);
        });

        // Bước 5: Sử dụng vòng lặp để tính toán và tạo kết quả
        const result = [];

        for (const promotionLine of promotionLines) {
            const lineId = promotionLine._id.toString();
            const promotionsForLine = promotionMap.get(lineId) || [];

            // Tính tổng giá trị khuyến mãi từ bảng Promotion
            const totalPromotionValue = promotionsForLine.reduce((sum, promo) => sum + promo.value, 0);

            // Tính tổng giá trị hóa đơn từ bảng Invoice
            const totalInvoiceValue = promotionsForLine.reduce((sum, promo) => {
                const invoiceValue = invoiceMap.get(promo.invoice_id?.toString()) || 0;
                return sum + invoiceValue;
            }, 0);

            // Lấy thông tin PromotionHeader từ Map
            const promotionHeaderInfo = promotionHeaderMap.get(promotionLine.promotion_header_id.toString()) || { name: 'Unknown', promotion_code: 'Unknown' };

            // Tạo đối tượng kết quả
            const promotionStatistic = {
                promotion_header_id: promotionLine.promotion_header_id,
                promotion_header_name: promotionHeaderInfo.name,
                promotion_code: promotionHeaderInfo.promotion_code,
                promotion_line_id: promotionLine._id,
                total_promotion_value: totalPromotionValue, // Tổng giá trị khuyến mãi
                total_invoice_value: totalInvoiceValue, // Tổng giá trị hóa đơn
                start_date: promotionHeaderInfo.start_date,
                end_date: promotionHeaderInfo.end_date,
            };

            result.push(promotionStatistic);
        }

        return result;
    } catch (error) {
        console.error('Lỗi khi thống kê khuyến mãi:', error);
        throw new Error('Đã xảy ra lỗi trong quá trình thống kê.');
    }
}



// Function to get current time in UTC+7
function getTimeInUTC7() {
    const now = new Date();
    const time = now.getTime();
    const localOffset = now.getTimezoneOffset() * 60000; // in milliseconds
    const utcTime = time + localOffset;
    const utc7Offset = 7 * 60 * 60 * 1000; // UTC+7 offset in milliseconds
    const utc7Time = new Date(utcTime + utc7Offset);
    return utc7Time;
}
// xuất thống kê doanh thu dịch vụ ra file Excel
exports.getServiceRevenueStatistics = async (req, res) => {
    try {
        const startDate = new Date(req.query.start_date);
        const endDate = new Date(req.query.end_date);

        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        // Lấy tất cả hóa đơn trong khoảng thời gian chỉ với 1 truy vấn
        const invoices = await Invoice.find({
            is_deleted: false,
            status: 'back',
            updated_at: { $gte: startDate, $lte: endDate },
        }).populate('promotion_header_ids customer_id').lean();

        if (invoices.length === 0) {
            return res.status(200).json({ message: 'Không có hóa đơn trả nào trong khoảng thời gian này.' });
        }

        // Lấy tất cả chi tiết hóa đơn liên quan
        const invoiceIds = invoices.map(invoice => invoice._id);
        const invoiceDetails = await InvoiceDetail.find({
            is_deleted: false,
            invoice_id: { $in: invoiceIds },
        }).populate('service_id').lean();

        if (invoiceDetails.length === 0) {
            return res.status(200).json({ message: 'Không có dịch vụ nào trong các hóa đơn trả.' });
        }

        // Lấy tất cả chi tiết khuyến mãi một lần duy nhất
        const promotionHeaderIds = invoices.flatMap(inv => inv.promotion_header_ids || []);
        const promotionDetails = await PromotionDetail.find({
            promotion_line_id: { $in: promotionHeaderIds },
        }).lean();

        // Tạo một Map cho chi tiết khuyến mãi để tìm nhanh hơn
        const promotionDetailMap = new Map();
        promotionDetails.forEach(promo => {
            promotionDetailMap.set(promo.promotion_line_id.toString(), promo);
        });

        const serviceStats = [];
        for (const detail of invoiceDetails) {
            const { service_id, price, quantity, invoice_id } = detail;
            let discountedPrice = price; // Giá mặc định chưa chiết khấu

            const relatedInvoice = invoices.find(inv => inv._id.toString() === invoice_id.toString());
            const promotionHeaderIds = relatedInvoice?.promotion_header_ids || [];

            // Tính giá sau chiết khấu
            for (const promotionHeader of promotionHeaderIds) {
                if (promotionHeader) {
                    const promotionDetail = promotionDetailMap.get(promotionHeader._id.toString());
                    if (promotionDetail) {
                        if (promotionHeader.discount_type === 1) {
                            discountedPrice -= (promotionDetail.discount_value / 100) * discountedPrice;
                        } else if (promotionHeader.discount_type === 2) {
                            if (discountedPrice >= promotionHeader.min_order_value) {
                                discountedPrice -= (promotionDetail.discount_value / promotionDetail.min_order_value) * discountedPrice;
                            }
                        }
                    }
                }
            }

            serviceStats.push({
                invoice_id: invoice_id.toString(),
                service_name: service_id.name,
                service_code: service_id.service_code,
                price_before_discount: price,
                price_after_discount: Math.max(discountedPrice, 0),
            });
        }

        const groupedByInvoice = {};
        for (const stat of serviceStats) {
            if (!groupedByInvoice[stat.invoice_id]) {
                const invoice = invoices.find(inv => inv._id.toString() === stat.invoice_id);

                groupedByInvoice[stat.invoice_id] = {
                    invoice_id: stat.invoice_id,
                    purchase_code: invoice._id.toString().slice(6, 11).toUpperCase(),
                    return_code: invoice._id.toString().slice(-5).toUpperCase(),
                    customer_name: invoice.customer_id.name,
                    created_at: invoice.created_at,
                    updated_at: invoice.updated_at,
                    services: [],
                };
            }
            groupedByInvoice[stat.invoice_id].services.push({
                service_name: stat.service_name,
                service_code: stat.service_code,
                price_before_discount: stat.price_before_discount,
                price_after_discount: stat.price_after_discount,
            });
        }

        const result = Object.values(groupedByInvoice);

        res.status(200).json(result);
    } catch (error) {
        console.error('Lỗi khi thống kê doanh thu dịch vụ:', error);
        res.status(500).json({ message: 'Lỗi khi thống kê doanh thu dịch vụ', error });
    }
};

// lấy dữ liệu thống kê hóa đơn trả
async function getServiceRevenueStatistics(startDate, endDate) {
    try {
        // Set time boundaries for the query
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        // Query invoices within the given time range
        const invoices = await Invoice.find({
            is_deleted: false,
            status: 'back',
            updated_at: { $gte: startDate, $lte: endDate },
        }).populate('promotion_header_ids customer_id')
        .sort({ created_at : 1 }) // Sort by creation date
        .lean();

        if (invoices.length === 0) {
            return { message: 'Không có hóa đơn trả nào trong khoảng thời gian này.', data: [] };
        }

        const invoiceIds = invoices.map(invoice => invoice._id);

        // Query invoice details related to the fetched invoices
        const invoiceDetails = await InvoiceDetail.find({
            is_deleted: false,
            invoice_id: { $in: invoiceIds },
        }).populate('service_id').lean();

        if (invoiceDetails.length === 0) {
            return { message: 'Không có dịch vụ nào trong các hóa đơn trả.', data: [] };
        }

        // Fetch all promotion details in one query
        const promotionHeaderIds = invoices.flatMap(inv => inv.promotion_header_ids || []);
        const promotionDetails = await PromotionDetail.find({
            promotion_line_id: { $in: promotionHeaderIds },
        }).lean();

        // Create a map for promotion details for quick access
        const promotionDetailMap = new Map();
        promotionDetails.forEach(promo => {
            promotionDetailMap.set(promo.promotion_line_id.toString(), promo);
        });

        // Create a map for invoices for quick access
        const invoiceMap = new Map();
        invoices.forEach(invoice => {
            invoiceMap.set(invoice._id.toString(), invoice);
        });

        const serviceStats = [];
        for (const detail of invoiceDetails) {
            const { service_id, price, quantity, invoice_id } = detail;
            let discountedPrice = price; // Default price before discounts

            // Find the related invoice
            const relatedInvoice = invoiceMap.get(invoice_id.toString());
            const promotionHeaderIds = relatedInvoice?.promotion_header_ids || [];

            // Apply discounts if available
            for (const promotionHeader of promotionHeaderIds) {
                if (promotionHeader) {
                    const promotionDetail = promotionDetailMap.get(promotionHeader._id.toString());
                    if (promotionDetail) {
                        if (promotionHeader.discount_type === 1) {
                            discountedPrice -= (promotionDetail.discount_value / 100) * discountedPrice;
                        } else if (promotionHeader.discount_type === 2) {
                            if (discountedPrice >= promotionHeader.min_order_value) {
                                discountedPrice -= (promotionDetail.discount_value / promotionDetail.min_order_value) * discountedPrice;
                            }
                        }
                    }
                }
            }

            serviceStats.push({
                invoice_id: invoice_id.toString(),
                service_name: service_id.name,
                service_code: service_id.service_code, // Fetch service code
                price_before_discount: price,
                price_after_discount: Math.max(discountedPrice, 0), // Prevent negative prices
            });
        }

        // Group the results by invoice
        const groupedByInvoice = {};
        for (const stat of serviceStats) {
            if (!groupedByInvoice[stat.invoice_id]) {
                const invoice = invoiceMap.get(stat.invoice_id);

                groupedByInvoice[stat.invoice_id] = {
                    invoice_id: stat.invoice_id,
                    purchase_code: invoice._id.toString().slice(6, 11).toUpperCase(),
                    return_code: invoice._id.toString().slice(-5).toUpperCase(), // Last 5 characters of _id
                    customer_name: invoice.customer_id.name, // Customer name
                    created_at: invoice.created_at, // Invoice creation date
                    updated_at: invoice.updated_at, // Invoice return date
                    services: [],
                };
            }
            groupedByInvoice[stat.invoice_id].services.push({
                service_name: stat.service_name,
                service_code: stat.service_code, // Service code
                price_before_discount: stat.price_before_discount,
                price_after_discount: stat.price_after_discount,
            });
        }

        const result = Object.values(groupedByInvoice);

        return { message: 'Thành công', data: result };
    } catch (error) {
        console.error('Lỗi khi thống kê doanh thu dịch vụ:', error);
        return { message: 'Lỗi khi thống kê doanh thu dịch vụ', error };
    }
}
// Xuất báo cáo thống kê hóa đơn trả ra file Excel
exports.exportReturnInvoiceStatistics = async (req, res) => {
    try {
        const startDate = new Date(req.query.start_date);
        const endDate = new Date(req.query.end_date);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        // Format dates to dd/MM/yyyy
        const formattedStartDate = startDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const formattedEndDate = endDate.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        // Fetch returned invoice statistics
        const { message, data: returnInvoices } = await getServiceRevenueStatistics(startDate, endDate);

        if (!returnInvoices || returnInvoices.length === 0) {
            return res.status(200).json({ message });
        }

        // Create a new workbook and add a worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Báo cáo hóa đơn trả');

        // Hide gridlines
        worksheet.properties.defaultGridlines = false;
        worksheet.properties.tabColor = { argb: 'FF0000FF' }; // Blue tab color

        // Add metadata
        worksheet.mergeCells('A1:H1');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = 'BÁO CÁO HÓA ĐƠN TRẢ';
        titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
        titleCell.font = { bold: true, size: 16 };
        worksheet.mergeCells('A3:H3');
        worksheet.getCell('A3').value = `Từ ngày: ${formattedStartDate}       Đến ngày: ${formattedEndDate}`;
        worksheet.getCell('A3').alignment = { horizontal: 'centerContinuous' };
        worksheet.addRow([]);
        worksheet.addRow(['Thời gian xuất báo cáo:', new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })]);
        worksheet.addRow(['User xuất báo cáo:', 'Admin']);
        worksheet.addRow([]);

        // Add header
        const headerRow = worksheet.addRow([
            'STT',
            'Hóa Đơn Bán',
            'Ngày Đơn Hàng Bán',
            'Hóa Đơn Trả',
            'Ngày Đơn Hàng Trả',
            'Tên Khách Hàng',
            'Mã Sản Phẩm',
            'Tên Sản Phẩm',
            'Số Lượng',
            'Giá Trước Chiết Khấu',
            'Giá Sau Chiết Khấu',
        ]);

        // Style the header row
        headerRow.eachCell({ includeEmpty: false }, (cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF538DD5' },
            };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' },
            };
        });

        // Populate rows with data
        let index = 1; // Biến đếm cho STT
        returnInvoices.forEach((invoice) => {
            const startRow = worksheet.rowCount + 1; // Hàng bắt đầu của hóa đơn này

            invoice.services.forEach((service, serviceIndex) => {
                const row = worksheet.addRow([
                    index, // STT chỉ hiển thị ở hàng đầu tiên của hóa đơn
                    serviceIndex === 0 ? invoice.purchase_code : null, // Merge purchase_code
                    serviceIndex === 0 ? new Date(invoice.created_at).toLocaleDateString('vi-VN') : null, // Merge ngày đơn hàng bán
                    serviceIndex === 0 ? invoice.return_code : null, // Merge return_code
                    serviceIndex === 0 ? new Date(invoice.updated_at).toLocaleDateString('vi-VN') : null, // Merge ngày đơn hàng trả
                    serviceIndex === 0 ? invoice.customer_name : null, // Merge tên khách hàng
                    service.service_code, // Mã sản phẩm
                    service.service_name, // Tên sản phẩm
                    1, // Giả định số lượng là 1
                    service.price_before_discount, // Giá trước chiết khấu
                    service.price_after_discount, // Giá sau chiết khấu
                ]);

                // Apply formatting for numeric cells
                row.getCell(10).numFmt = '#,##0'; // Giá Trước Chiết Khấu
                row.getCell(11).numFmt = '#,##0'; // Giá Sau Chiết Khấu

                // Apply alignment and border to each cell
                row.eachCell((cell) => {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' }; // Căn giữa
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' },
                    };
                });
            });

            const endRow = worksheet.rowCount; // Hàng kết thúc của hóa đơn này

            // Merge cells for the shared fields
            worksheet.mergeCells(`A${startRow}:A${endRow}`); // Merge STT
            worksheet.mergeCells(`B${startRow}:B${endRow}`); // Merge purchase_code
            worksheet.mergeCells(`C${startRow}:C${endRow}`); // Merge ngày đơn hàng bán
            worksheet.mergeCells(`D${startRow}:D${endRow}`); // Merge return_code
            worksheet.mergeCells(`E${startRow}:E${endRow}`); // Merge ngày đơn hàng trả
            worksheet.mergeCells(`F${startRow}:F${endRow}`); // Merge tên khách hàng

            // Apply alignment for merged cells
            ['A', 'B', 'C', 'D', 'E', 'F'].forEach((col) => {
                const cell = worksheet.getCell(`${col}${startRow}`);
                cell.alignment = { horizontal: 'center', vertical: 'middle' }; // Căn giữa
            });

            index++; // Tăng số thứ tự cho hóa đơn tiếp theo
        });

        // Adjust column widths
        worksheet.getColumn(1).width = 25; // STT
        worksheet.getColumn(2).width = 20; // Hóa Đơn Mua
        worksheet.getColumn(3).width = 20; // Ngày Đơn Hàng Mua
        worksheet.getColumn(4).width = 20; // Hóa Đơn Trả
        worksheet.getColumn(5).width = 20; // Ngày Đơn Hàng Trả
        worksheet.getColumn(6).width = 30; // Tên Khách Hàng
        worksheet.getColumn(7).width = 15; // Mã Sản Phẩm
        worksheet.getColumn(8).width = 40; // Tên Sản Phẩm
        worksheet.getColumn(9).width = 10; // Số Lượng
        worksheet.getColumn(10).width = 20; // Giá Trước Chiết Khấu
        worksheet.getColumn(11).width = 20; // Giá Sau Chiết Khấu

        // Disable gridlines
        worksheet.views = [{ showGridLines: false }];

        // Generate buffer
        const buffer = await workbook.xlsx.writeBuffer();

        // Format file name
        const fileName = `BaoCao_HoaDonTra_Tu_${startDate.toISOString().split('T')[0]}_Den_${endDate.toISOString().split('T')[0]}.xlsx`;

        // Send file to client
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.status(200).send(buffer);
    } catch (error) {
        console.error('Lỗi khi xuất báo cáo hóa đơn trả:', error);
        res.status(500).json({ message: 'Lỗi khi xuất báo cáo hóa đơn trả', error });
    }
};
