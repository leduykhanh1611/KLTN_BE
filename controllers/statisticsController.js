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

// Xuất thống kê doanh thu ra file Excel
exports.exportRevenueStatisticsToExcel = async (req, res) => {
    const { start_date, end_date } = req.query;
    try {
        if (!start_date || !end_date) {
            return res.status(400).json({ msg: 'Vui lòng cung cấp khoảng thời gian để thống kê doanh thu' });
        }

        const startDate = new Date(start_date);
        const endDate = new Date(end_date);

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

        const invoiceData = invoices.map(invoice => {
            return {
                date: new Date(invoice.created_at).toLocaleDateString('vi-VN'),
                employeeCode: String(invoice.employee_id._id || '').substring(0, 5).toUpperCase(),
                employeeName: invoice.employee_id?.name || '',
                discount: Math.round(invoice.discount_amount),
                revenueBeforeDiscount: Math.round(invoice.total_amount),
                revenueAfterDiscount: Math.round(invoice.final_amount),
            };
        });

        const borderStyle = { top: { style: 'thin' }, bottom: { style: 'thin' } };
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Doanh Số Bán Hàng Theo Ngày');
        worksheet.properties.tabColor = { argb: 'FF0000FF' }; // ARGB format for blue color
        worksheet.properties.defaultRowHeight = 20; // Set default row height to 30
        worksheet.properties.defaultColWidth = 20; // Set default column width to 20
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
        worksheet.getCell('A4').font = { bold: true, size: 16 };;
        worksheet.getCell('A4').alignment = { horizontal: 'center' };

        worksheet.mergeCells('A5:G5');
        worksheet.getCell('A5').value = `Từ ngày: ${formattedStartDate}       Đến ngày: ${formattedEndDate}`;
        // worksheet.getCell('A5').font = { bold: true };
        worksheet.getCell('A5').alignment = { horizontal: 'centerContinuous' };

        // Table Headers
        worksheet.addRow([]);
        const headerRow = worksheet.addRow(['STT', 'NVBH', 'Tên NVBH', 'Ngày', 'Chiết khấu', 'Doanh số trước CK', 'Doanh số sau CK']);
        headerRow.eachCell((cell) => {
            cell.border = borderStyle;
            cell.font = { bold: true };
            cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
        worksheet.getRow(6).font = { bold: true };
        worksheet.getRow(6).alignment = { vertical: 'middle', horizontal: 'center' };
        worksheet.views = [{ showGridLines: false }];

        let currentDate = '';
        let rowIndex = 7;
        let dailyTotalDiscount = 0;
        let dailyTotalRevenueBeforeDiscount = 0;
        let dailyTotalRevenueAfterDiscount = 0;
        let grandTotalDiscount = 0;
        let grandTotalRevenueBeforeDiscount = 0;
        let grandTotalRevenueAfterDiscount = 0;
        let employeeCounter = 1;
        let employeeSTT = 1;

        // Loop through invoice data to process each date and employee's transactions
        invoiceData.forEach((data, index) => {
            if (data.date !== currentDate) {
                // Add subtotal row for the previous date if there was a change in date
                if (currentDate !== '') {
                    const subtotalRow = worksheet.addRow(['', '', '', 'Tổng cộng theo ngày', dailyTotalDiscount, dailyTotalRevenueBeforeDiscount, dailyTotalRevenueAfterDiscount]);
                    subtotalRow.font = { italic: true, bold: true }; // Italic and bold for subtotal row
                    subtotalRow.alignment = { vertical: 'middle', horizontal: 'center' };
                    subtotalRow.eachCell((cell) => {
                        cell.border = borderStyle;
                        if (cell._column._key === 'E' || cell._column._key === 'F' || cell._column._key === 'G') {
                            cell.numFmt = '#,##0'; // Format as integer with commas
                        }
                    });
                    rowIndex++;
                    dailyTotalDiscount = 0;
                    dailyTotalRevenueBeforeDiscount = 0;
                    dailyTotalRevenueAfterDiscount = 0;
                }

                // Start a new date section
                currentDate = data.date;
                const dateRow = worksheet.addRow([`Ngày: ${currentDate}`]);
                dateRow.font = { bold: true }; // Bold font for date row
                dateRow.alignment = { vertical: 'middle', horizontal: 'center' };
                dateRow.eachCell((cell) => {
                    cell.border = borderStyle;
                });
                rowIndex++;
                employeeCounter = 1;
                employeeSTT = 1;
            }

            // Add transaction row for the current employee and date
            const transactionRow = worksheet.addRow([employeeSTT, data.employeeCode, data.employeeName, data.date, data.discount, data.revenueBeforeDiscount, data.revenueAfterDiscount]);
            transactionRow.alignment = { vertical: 'middle', horizontal: 'center' };
            transactionRow.eachCell((cell) => {
                if (cell._column._key === 'E' || cell._column._key === 'F' || cell._column._key === 'G') {
                    cell.numFmt = '#,##0';
                }
                cell.border = borderStyle;
            });

            // Accumulate daily and grand totals
            dailyTotalDiscount += data.discount;
            dailyTotalRevenueBeforeDiscount += data.revenueBeforeDiscount;
            dailyTotalRevenueAfterDiscount += data.revenueAfterDiscount;
            grandTotalDiscount += data.discount;
            grandTotalRevenueBeforeDiscount += data.revenueBeforeDiscount;
            grandTotalRevenueAfterDiscount += data.revenueAfterDiscount;

            rowIndex++;
            employeeSTT++;
        });

        // Add the final subtotal row for the last date after looping
        if (currentDate !== '') {
            const finalSubtotalRow = worksheet.addRow(['', '', '', 'Tổng cộng theo ngày', dailyTotalDiscount, dailyTotalRevenueBeforeDiscount, dailyTotalRevenueAfterDiscount]);
            finalSubtotalRow.font = { italic: true, bold: true }; // Italic and bold for final subtotal row
            finalSubtotalRow.alignment = { vertical: 'middle', horizontal: 'center' };
            finalSubtotalRow.eachCell((cell) => {
                cell.border = borderStyle;
                if (cell._column._key === 'E' || cell._column._key === 'F' || cell._column._key === 'G') {
                    cell.numFmt = '#,##0';
                }
            });
            rowIndex++;
        }


        // Add final grand total row with a border, center alignment, and bold font
        const grandTotalRowData = ['Tổng cộng', '', '', '', grandTotalDiscount, grandTotalRevenueBeforeDiscount, grandTotalRevenueAfterDiscount];
        const grandTotalRow = worksheet.addRow(grandTotalRowData);

        // Apply formatting to each cell in the grand total row
        grandTotalRow.eachCell((cell, colNumber) => {
            cell.font = { bold: true }; // Set font to bold
            cell.alignment = { vertical: 'middle', horizontal: 'center' }; // Center alignment
            cell.border = borderStyle; // Apply border style

            // Apply number format only to specific columns
            if (colNumber >= 5 && colNumber <= 7) { // Columns E, F, G for discount and revenue
                cell.numFmt = '#,##0'; // Format as integer with commas
            }
        });

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

        // Fetch promotion statistics (replace with your actual data fetching logic)
        const promotionStatistics = await getPromotionStatistics(startDate, endDate);

        if (!promotionStatistics || promotionStatistics.length === 0) {
            return res.status(200).json({ message: 'Không có dữ liệu để xuất báo cáo.' });
        }

        // Calculate total promotion value
        const totalValue = promotionStatistics.reduce((sum, promo) => sum + promo.total_value, 0);

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

        worksheet.addRow([]);
        worksheet.addRow(['Thời gian xuất báo cáo:', new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })]);
        worksheet.addRow(['User xuất báo cáo:', 'Admin']);
        worksheet.addRow([]);

        // Add header
        const headerRow = worksheet.addRow(['Mã CTKM', 'Tên CTKM', 'Ngày bắt đầu', 'Ngày kết thúc', 'Số tiền chiết khấu']);

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
                promo.total_value,
            ]);

            // Format the 'Số tiền chiết khấu' column as currency
            row.getCell(5).numFmt = '#,##0';
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
        const totalRow = worksheet.addRow(['Tổng CTKM', '', '', '', totalValue]);
        totalRow.alignment = { horizontal: 'center', vertical: 'middle' };
        totalRow.getCell(5).numFmt = '#,##0';

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

// function for getPromotionStatistics
async function getPromotionStatistics(startDate, endDate) {
    try {
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

        return result;
    } catch (error) {
        console.error('Lỗi khi thống kê khuyến mãi:', error);
        
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

exports.getServiceRevenueStatistics = async (req, res) => {
    try {
        const startDate = new Date(req.query.start_date);
        const endDate = new Date(req.query.end_date);

        // Truy vấn và tính toán giữ nguyên
        const invoices = await Invoice.find({
            is_deleted: false,
            status: 'back',
            updated_at: { $gte: startDate, $lte: endDate },
        }).populate('promotion_header_ids customer_id').lean();

        if (invoices.length === 0) {
            return res.status(200).json({ message: 'Không có hóa đơn trả nào trong khoảng thời gian này.' });
        }

        const invoiceIds = invoices.map(invoice => invoice._id);
        const invoiceDetails = await InvoiceDetail.find({
            is_deleted: false,
            invoice_id: { $in: invoiceIds },
        }).populate('service_id').lean();

        if (invoiceDetails.length === 0) {
            return res.status(200).json({ message: 'Không có dịch vụ nào trong các hóa đơn trả.' });
        }

        const serviceStats = [];
        for (const detail of invoiceDetails) {
            const { service_id, price, quantity, invoice_id } = detail;
            let discountedPrice = price; // Giá mặc định chưa chiết khấu

            const relatedInvoice = invoices.find(inv => inv._id.toString() === invoice_id.toString());
            const promotionHeaderIds = relatedInvoice?.promotion_header_ids || [];

            for (const promotionHeader of promotionHeaderIds) {
                if (promotionHeader) {
                    const promotionDetail = await PromotionDetail.findOne({ promotion_line_id: promotionHeader._id });
                    if (promotionHeader.discount_type === 1) {
                        discountedPrice -= (promotionDetail.discount_value / 100) * discountedPrice;
                    } else if (promotionHeader.discount_type === 2) {
                        if (discountedPrice >= promotionHeader.min_order_value) {
                            discountedPrice -= (promotionDetail.discount_value / promotionDetail.min_order_value) * discountedPrice;
                        }
                    }
                }
            }

            serviceStats.push({
                invoice_id: invoice_id.toString(),
                service_name: service_id.name,
                service_code: service_id.service_code, // Lấy mã dịch vụ từ service_code
                price_before_discount: price,
                price_after_discount: Math.max(discountedPrice, 0), // Không cho phép giá âm
            });
        }

        const groupedByInvoice = {};
        for (const stat of serviceStats) {
            if (!groupedByInvoice[stat.invoice_id]) {
                const invoice = invoices.find(inv => inv._id.toString() === stat.invoice_id);

                groupedByInvoice[stat.invoice_id] = {
                    invoice_id: stat.invoice_id,
                    purchase_code: invoice._id.toString().substring(0, 5), // 5 ký tự đầu từ _id
                    return_code: invoice._id.toString().slice(-5), // 5 ký tự cuối từ _id
                    customer_name: invoice.customer_id.name, // Tên khách hàng từ customer_id
                    created_at: invoice.created_at, // Ngày lập hóa đơn
                    updated_at: invoice.updated_at, // Ngày trả hóa đơn
                    services: [],
                };
            }
            groupedByInvoice[stat.invoice_id].services.push({
                service_name: stat.service_name,
                service_code: stat.service_code, // Mã dịch vụ
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
