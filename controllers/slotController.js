const Slot = require('../models/Slot');
const AppointmentService = require('../models/AppointmentService');
const Appointment = require('../models/Appointment');
const Vehicle = require('../models/Vehicle');
const Service = require('../models/Service');
// Thêm slot
exports.addSlot = async (req, res) => {
  const { slot_datetime, duration_minutes, status, capacity } = req.body;

  try {
    const slot = new Slot({
      slot_datetime,
      duration_minutes,
      status: status || 'available',
      capacity,
      is_deleted: false,
    });

    await slot.save();

    res.status(201).json({ msg: 'Slot mới đã được tạo', slot });
  } catch (err) {
    console.error('Lỗi khi thêm slot:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};
// cập nhật slot
exports.updateSlot = async (req, res) => {
  const { slotId } = req.params;
  const { slot_datetime, duration_minutes, status, capacity } = req.body;

  try {
    const slot = await Slot.findById(slotId);
    if (!slot || slot.is_deleted) {
      return res.status(404).json({ msg: 'Không tìm thấy slot' });
    }

    if (slot_datetime) slot.slot_datetime = slot_datetime;
    if (duration_minutes !== undefined) slot.duration_minutes = duration_minutes;
    if (status) slot.status = status;
    if (capacity !== undefined) slot.capacity = capacity;

    await slot.save();

    res.json({ msg: 'Cập nhật slot thành công', slot });
  } catch (err) {
    console.error('Lỗi khi cập nhật slot:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};
// xóa mềm slot
exports.softDeleteSlot = async (req, res) => {
  const { slotId } = req.params;

  try {
    const slot = await Slot.findById(slotId);
    if (!slot || slot.is_deleted) {
      return res.status(404).json({ msg: 'Không tìm thấy slot' });
    }

    slot.is_deleted = true;
    await slot.save();

    res.json({ msg: 'Slot đã được xóa mềm', slot });
  } catch (err) {
    console.error('Lỗi khi xóa slot:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};
// lấy tất cả slot
exports.getAllSlots = async (req, res) => {
  try {
    const slots = await Slot.find({ is_deleted: false });
    res.json(slots);
  } catch (err) {
    console.error('Lỗi khi lấy danh sách slot:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};
// lấy thông tin slot theo ID 
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
// Lấy thông tin slot cùng lịch hẹn gần nhất hoặc lịch hẹn hoàn thành gần nhất
exports.getSlotWithNearestOrCompletedAppointment = async (req, res) => {
    const { slotId } = req.params;
  
    try {
      const slot = await Slot.findOne({ _id: slotId, is_deleted: false });
      if (!slot) {
        return res.status(404).json({ msg: 'Không tìm thấy slot' });
      }
  
      // Tìm lịch hẹn gần nhất với trạng thái "scheduled" hoặc "completed"
      const appointment = await Appointment.findOne({
        slot_id: slotId,
        is_deleted: false,
        status: { $in: ['scheduled', 'completed'] },
      })
        .sort({ appointment_datetime: 1 }) // Sắp xếp theo thời gian gần nhất
        .populate('vehicle_id')
        .lean();
  
      if (!appointment) {
        return res.status(404).json({ msg: 'Không tìm thấy lịch hẹn phù hợp' });
      }
  
      res.json({ slot, appointment });
    } catch (err) {
      console.error('Lỗi khi lấy thông tin slot:', err.message);
      res.status(500).send('Lỗi máy chủ');
    }
  };