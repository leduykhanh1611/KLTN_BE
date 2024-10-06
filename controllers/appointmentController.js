const Appointment = require('../models/Appointment');
const AppointmentService = require('../models/AppointmentService');
const Slot = require('../models/Slot');
const Vehicle = require('../models/Vehicle');
const Service = require('../models/Service');
const PriceLine = require('../models/PriceLine');
const PriceHeader = require('../models/PriceHeader');
const Customer = require('../models/Customer');
// Đăng ký lịch hẹn với nhiều dịch vụ
exports.registerAppointmentWithServices = async (req, res) => {
  const {  slot_id, vehicle_id, service_ids, start_time, end_time } = req.body;

  try {
    // Kiểm tra xem xe có tồn tại không
    const vehicle = await Vehicle.findById(vehicle_id);
    if (!vehicle || vehicle.is_deleted) {
      return res.status(404).json({ msg: 'Không tìm thấy xe' });
    }
    // Kiểm tra xem slot có tồn tại và khả dụng không
    const slot = await Slot.findById(slot_id);
    if (!slot || slot.is_deleted || slot.status !== 'available') {
      return res.status(404).json({ msg: 'Slot không khả dụng' });
    }
    
    // Tạo lịch hẹn mới
    const appointment = new Appointment({
      customer_id: vehicle.customer_id,
      slot_id,
      vehicle_id,
      start_time,
      end_time,
      appointment_datetime: start_time,
      status: 'scheduled',
      is_deleted: false,
    });

    await appointment.save();

    // Thêm các dịch vụ vào lịch hẹn
    for (let service_id of service_ids) {
      const service = await Service.findById(service_id);
      if (!service || service.is_deleted) {
        continue; // Bỏ qua nếu dịch vụ không tồn tại hoặc đã bị xóa
      }

      const appointmentService = new AppointmentService({
        appointment_id: appointment._id,
        service_id,
        is_deleted: false,
      });

      await appointmentService.save();
    }

    // Cập nhật trạng thái slot thành "booked"
    slot.status = 'booked';
    await slot.save();

    res.status(201).json({ msg: 'Đăng ký lịch hẹn thành công', appointment });
  } catch (err) {
    console.error('Lỗi khi đăng ký lịch hẹn:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};

// Lấy thông tin lịch hẹn cùng các dịch vụ liên quan và tổng phí
exports.getAppointmentDetailsWithTotalCost = async (req, res) => {
  const { appointmentId } = req.params;

  try {
    // Tìm lịch hẹn
    const appointment = await Appointment.findOne({ _id: appointmentId, is_deleted: false })
      .populate('vehicle_id')
      .populate('slot_id')
      .lean();

    if (!appointment) {
      return res.status(404).json({ msg: 'Không tìm thấy lịch hẹn' });
    }

    // Lấy danh sách dịch vụ của lịch hẹn
    const appointmentServices = await AppointmentService.find({ appointment_id: appointmentId, is_deleted: false })
      .populate('service_id')
      .lean();

    if (appointmentServices.length === 0) {
      return res.status(404).json({ msg: 'Không tìm thấy dịch vụ cho lịch hẹn này' });
    }

    // Lấy thông tin xe để xác định loại xe
    const vehicle = appointment.vehicle_id;
    if (!vehicle) {
      return res.status(404).json({ msg: 'Không tìm thấy xe cho lịch hẹn này' });
    }

    // Lấy bảng giá chưa bị xóa mềm
    const priceHeader = await PriceHeader.findOne({ is_deleted: false, is_active: true });
    if (!priceHeader) {
      return res.status(404).json({ msg: 'Không tìm thấy bảng giá hợp lệ' });
    }

    // Tính tổng phí và thêm thông tin dịch vụ vào đối tượng lịch hẹn
    let totalCost = 0;
    const services = [];

    for (let appService of appointmentServices) {
      const service = appService.service_id;

      // Tìm giá từ bảng PriceLine dựa trên service_id và vehicle_type_id
      const priceLine = await PriceLine.findOne({
        service_id: service._id,
        vehicle_type_id: vehicle.vehicle_type_id,
        price_header_id: priceHeader._id,
        is_deleted: false,
      });

      if (!priceLine) {
        return res.status(404).json({ msg: `Không tìm thấy giá cho dịch vụ ${service.name}` });
      }

      // Cộng giá dịch vụ vào tổng phí
      totalCost += priceLine.price;

      services.push({
        _id: service._id,
        name: service.name,
        description: service.description,
        price: priceLine.price,
      });
    }

    // Thêm danh sách dịch vụ và tổng phí vào đối tượng lịch hẹn
    appointment.services = services;
    appointment.total_cost = totalCost;

    res.json(appointment);
  } catch (err) {
    console.error('Lỗi khi lấy thông tin lịch hẹn:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};

// Hủy lịch hẹn (xóa mềm)
exports.cancelAppointment = async (req, res) => {
  const { appointmentId } = req.params;

  try {
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment || appointment.is_deleted) {
      return res.status(404).json({ msg: 'Không tìm thấy lịch hẹn' });
    }
    appointment.status = 'cancelled';
    await appointment.save();

    // Cập nhật trạng thái slot thành "available" nếu lịch hẹn bị hủy
    const slot = await Slot.findById(appointment.slot_id);
    if (slot) {
      slot.status = 'available';
      await slot.save();
    }

    res.json({ msg: 'Lịch hẹn đã được hủy', appointment });
  } catch (err) {
    console.error('Lỗi khi hủy lịch hẹn:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};

// Lấy thông tin slot cùng các lịch hẹn và dịch vụ liên quan
exports.getSlotById = async (req, res) => {
  const { slotId } = req.params;

  try {
    const slot = await Slot.findOne({ _id: slotId, is_deleted: false });
    if (!slot) {
      return res.status(404).json({ msg: 'Không tìm thấy slot' });
    }

    // Lấy thông tin xe và dịch vụ liên quan đến slot
    const appointments = await Appointment.find({ slot_id: slotId, is_deleted: false })
      .populate('vehicle_id')
      .lean();

    const appointmentServices = await AppointmentService.find({ appointment_id: { $in: appointments.map(a => a._id) }, is_deleted: false })
      .populate('service_id')
      .lean();

    const servicesByAppointment = {};
    for (let appService of appointmentServices) {
      if (!servicesByAppointment[appService.appointment_id]) {
        servicesByAppointment[appService.appointment_id] = [];
      }
      servicesByAppointment[appService.appointment_id].push(appService.service_id);
    }

    const appointmentsWithServices = appointments.map(appointment => {
      return {
        ...appointment,
        services: servicesByAppointment[appointment._id] || [],
      };
    });

    res.json({ slot, appointments: appointmentsWithServices });
  } catch (err) {
    console.error('Lỗi khi lấy chi tiết slot:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};

// Xử lý khi khách hàng đến sử dụng dịch vụ của trung tâm từ lịch hẹn
exports.processAppointmentArrival = async (req, res) => {
  const { appointmentId } = req.params;

  try {
    // Tìm lịch hẹn
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment || appointment.is_deleted || appointment.status !== 'scheduled') {
      return res.status(404).json({ msg: 'Không tìm thấy lịch hẹn hợp lệ' });
    }

    // Cập nhật trạng thái lịch hẹn thành "completed"
    appointment.status = 'completed';
    await appointment.save();

    res.json({ msg: 'Khách hàng đã đến và sử dụng dịch vụ thành công', appointment });
  } catch (err) {
    console.error('Lỗi khi xử lý khách hàng đến:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};