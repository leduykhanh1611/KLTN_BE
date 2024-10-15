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
  const { slot_id, vehicle_id, service_ids, appointment_datetime } = req.body;

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
    } else {
      // Cập nhật trạng thái slot thành "booked"
      slot.status = 'booked';
      await slot.save();
    }
    // Tạo lịch hẹn mới
    const appointment = new Appointment({
      customer_id: vehicle.customer_id,
      vehicle_id,
      slot_id,
      appointment_datetime,
      status: 'scheduled',
      is_deleted: false,
    });

    await appointment.save();

    // Thêm các dịch vụ vào lịch hẹn
    for (let service_id of service_ids) {
      // Tìm giá của dịch vụ dựa trên loại xe và dịch vụ được chọn
      const priceLine = await PriceLine.findOne({
        service_id: service_id,
        vehicle_type_id: vehicle.vehicle_type_id,
        is_deleted: false,
      });

      if (!priceLine) {
        return res.status(400).json({ msg: `Không tìm thấy giá cho dịch vụ ${service_id}` });
      }

      const appointmentService = new AppointmentService({
        appointment_id: appointment._id,
        price_line_id: priceLine._id,
        is_deleted: false,
      });

      await appointmentService.save();
    }

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
      .populate('price_line_id').lean();
    if (appointmentServices.length === 0) {
      return res.status(404).json({ msg: 'Không tìm thấy dịch vụ cho lịch hẹn này' });
    }

    // Tính tổng phí và thêm thông tin dịch vụ vào đối tượng lịch hẹn
    let totalCost = 0;
    const services = [];

    for (let appService of appointmentServices) {
      const service = await Service.findById(appService.price_line_id.service_id);
      const price = appService.price_line_id.price;

      // Cộng giá dịch vụ vào tổng phí
      totalCost += price;

      services.push({
        _id: service._id,
        name: service.name,
        description: service.description,
        price: price,
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

    if (appointment.status !== 'completed' && appointment.status !== 'cancelled') {
      return res.status(400).json({ msg: 'Không thể hủy lịch hẹn này' });
    }

    appointment.status = 'cancelled';
    appointment.is_deleted = true;
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
      .populate({
        path: 'price_line_id',
        populate: {
          path: 'service_id',
        }
      })
      .lean();

    const servicesByAppointment = {};
    for (let appService of appointmentServices) {
      if (!servicesByAppointment[appService.appointment_id]) {
        servicesByAppointment[appService.appointment_id] = [];
      }
      servicesByAppointment[appService.appointment_id].push(appService.price_line_id.service_id);
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
    const slot = await Slot.findById(appointment.slot_id);
    slot.status = 'available';
    await slot.save();

    res.json({ msg: 'Khách hàng đã đến và sử dụng dịch vụ thành công', appointment });
  } catch (err) {
    console.error('Lỗi khi xử lý khách hàng đến:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};

// Lọc lịch hẹn theo ngày
exports.filterAppointmentsByDate = async (req, res) => {
  const { date, status } = req.query;

  try {
    // Kiểm tra nếu không có ngày được truyền vào
    if (!date) {
      return res.status(400).json({ msg: 'Vui lòng cung cấp ngày để lọc lịch hẹn' });
    }

    // Tạo thời gian bắt đầu và kết thúc cho ngày cần tìm kiếm
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Tạo query cho trạng thái nếu có
    let statusFilter = {};
    if (status) {
      statusFilter = { status };
    }

    // Tìm các lịch hẹn theo ngày
    const appointments = await Appointment.find({
      appointment_datetime: { $gte: startOfDay, $lte: endOfDay },
      is_deleted: false,
      ...statusFilter,
    })
      .populate('customer_id')
      .populate('vehicle_id')
      .populate('slot_id')
      .lean();

    if (appointments.length === 0) {
      return res.status(404).json({ msg: 'Không tìm thấy lịch hẹn nào trong ngày này' });
    }

    res.json(appointments);
  } catch (err) {
    console.error('Lỗi khi lọc lịch hẹn theo ngày:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};

// lấy lịch hẹn đã hoàn thành
exports.getCompletedAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find({ status: 'completed', is_deleted: false })
      .populate('customer_id')
      .populate('vehicle_id')
      .populate('slot_id')
      .lean();

    if (appointments.length === 0) {
      return res.status(404).json({ msg: 'Không tìm thấy lịch hẹn nào đã hoàn thành' });
    }

    res.json(appointments);
  } catch (err) {
    console.error('Lỗi khi lấy lịch hẹn đã hoàn thành:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};

// Cập nhật lịch hẹn và các dịch vụ liên quan
exports.updateAppointment = async (req, res) => {
  const { appointmentId } = req.params;
  const { slot_id, appointment_datetime, service_ids } = req.body;

  try {
    // Tìm lịch hẹn theo ID
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment || appointment.is_deleted) {
      return res.status(404).json({ msg: 'Không tìm thấy lịch hẹn' });
    }

    // Cập nhật thông tin slot nếu cần
    if (slot_id && slot_id !== appointment.slot_id.toString()) {
      // Kiểm tra xem slot mới có tồn tại và khả dụng không
      const newSlot = await Slot.findById(slot_id);
      if (!newSlot || newSlot.is_deleted || newSlot.status !== 'available') {
        return res.status(404).json({ msg: 'Slot không khả dụng' });
      }

      // Đánh dấu slot cũ là khả dụng
      const oldSlot = await Slot.findById(appointment.slot_id);
      if (oldSlot) {
        oldSlot.status = 'available';
        await oldSlot.save();
      }

      // Cập nhật slot mới thành "booked"
      newSlot.status = 'booked';
      await newSlot.save();

      // Cập nhật slot trong lịch hẹn
      appointment.slot_id = slot_id;
    }

    // Cập nhật thời gian lịch hẹn nếu có
    if (appointment_datetime) {
      appointment.appointment_datetime = appointment_datetime;
    }

    // Cập nhật danh sách dịch vụ nếu có
    if (service_ids && service_ids.length > 0) {
      // Xóa mềm tất cả các dịch vụ hiện tại của lịch hẹn
      await AppointmentService.updateMany({ appointment_id: appointmentId }, { is_deleted: true });

      // Thêm các dịch vụ mới vào lịch hẹn
      for (let service_id of service_ids) {
        // Tìm giá của dịch vụ dựa trên loại xe và dịch vụ được chọn
        const priceLine = await PriceLine.findById(service_id);

        if (!priceLine) {
          return res.status(400).json({ msg: `Không tìm thấy giá cho dịch vụ ${service_id}` });
        }

        const appointmentService = new AppointmentService({
          appointment_id: appointment._id,
          price_line_id: priceLine._id,
          is_deleted: false,
        });

        await appointmentService.save();
      }
    }
    // Lưu lịch hẹn đã cập nhật
    await appointment.save();

    res.status(200).json({ msg: 'Cập nhật lịch hẹn thành công', appointment });
  } catch (err) {
    console.error('Lỗi khi cập nhật lịch hẹn:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};