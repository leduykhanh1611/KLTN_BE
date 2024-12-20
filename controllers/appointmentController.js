const Appointment = require('../models/Appointment');
const AppointmentService = require('../models/AppointmentService');
const Slot = require('../models/Slot');
const Vehicle = require('../models/Vehicle');
const Service = require('../models/Service');
const PriceLine = require('../models/PriceLine');
const PriceHeader = require('../models/PriceHeader');
const Customer = require('../models/Customer');
const Invoice = require('../models/Invoice');
// Đăng ký lịch hẹn với nhiều dịch vụ
exports.registerAppointmentWithServices = async (req, res) => {
  const { slot_id, vehicle_id, service_ids, appointment_datetime, sumTime } = req.body;
  if (!service_ids) {
    return res.status(400).json({ msg: 'Vui lòng cung cấp đầy đủ thông tin dịch vụ' });
  }
  if (!appointment_datetime) {
    return res.status(400).json({ msg: 'Vui lòng cung cấp đầy đủ thời gian lịch hẹn' });
  }
  if (!vehicle_id) {
    return res.status(400).json({ msg: 'Vui lòng cung cấp thông tin về xe' });
  }
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
      slot.duration_minutes = sumTime;
      slot.slot_datetime = appointment_datetime;
      await slot.save();
    }
    // Tạo lịch hẹn mới
    const appointment = new Appointment({
      customer_id: vehicle.customer_id,
      vehicle_id,
      slot_id,
      appointment_datetime,
      status: 'waiting',
      is_deleted: false,
    });

    await appointment.save();

    // Thêm các dịch vụ vào lịch hẹn
    for (let service_id of service_ids) {
      // Tìm giá của dịch vụ dựa trên loại xe và dịch vụ được chọn
      const priceLine = await PriceLine.findById(service_id).populate('service_id');

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
    await slot.save();
    res.status(201).json({ msg: 'Đăng ký lịch hẹn thành công', appointment });
  } catch (err) {
    console.error('Lỗi khi đăng ký lịch hẹn:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};

// đặt lịch hẹn không cần slot 
exports.registerAppointmentWithoutSlot = async (req, res) => {
  const { vehicle_id, service_ids, appointment_datetime } = req.body;
  if (!service_ids) {
    return res.status(400).json({ msg: 'Vui lòng cung cấp đầy đủ thông tin dịch vụ' });
  }
  if (!appointment_datetime) {
    return res.status(400).json({ msg: 'Vui lòng cung cấp đầy đủ thời gian lịch hẹn' });
  }
  if (!vehicle_id) {
    return res.status(400).json({ msg: 'Vui lòng cung cấp thông tin về xe' });
  }
  try {
    // Kiểm tra xem xe có tồn tại không
    const vehicle = await Vehicle.findById(vehicle_id);
    if (!vehicle || vehicle.is_deleted) {
      return res.status(404).json({ msg: 'Không tìm thấy xe' });
    }
    const appointmentW = await Appointment.findOne({ vehicle_id: vehicle_id, status: 'waiting', is_deleted: false });
    if (appointmentW) {
      return res.status(408).json({ msg: 'Xe đã có lịch hẹn chờ' });
    }
    // Tạo lịch hẹn mới
    const appointment = new Appointment({
      customer_id: vehicle.customer_id,
      vehicle_id,
      appointment_datetime,
      status: 'waiting',
      is_deleted: false,
    });

    await appointment.save();

    // Thêm các dịch vụ vào lịch hẹn
    for (let service_id of service_ids) {
      // Tìm giá của dịch vụ dựa trên loại xe và dịch vụ được chọn
      const priceLine = await PriceLine.findById(service_id).populate('service_id');

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
}

// Lấy tất cả lịch hẹn không có slot 
exports.getAllAppointmentsWithoutSlot = async (req, res) => {
  try {
    // Bước 1: Lấy tất cả lịch hẹn không có slot và không bị xóa
    const appointments = await Appointment.find({ slot_id: null, is_deleted: false })
      .populate('customer_id') // Populate thông tin khách hàng
      .populate('vehicle_id') // Populate thông tin phương tiện
      .lean();

    if (appointments.length === 0) {
      return res.json([]); // Nếu không có lịch hẹn nào, trả về mảng rỗng
    }

    // Bước 2: Lấy danh sách _id của các lịch hẹn
    const appointmentIds = appointments.map(appointment => appointment._id);

    // Tìm tất cả hóa đơn liên quan đến các lịch hẹn
    const invoices = await Invoice.find({ 
      appointment_id: { $in: appointmentIds }, // Điều kiện liên quan đến danh sách appointment_id
      status: 'paid', // Chỉ lấy hóa đơn có status là 'paid'
      is_deleted: false // Hóa đơn không bị xóa
    }).lean();

    // Bước 3: Lọc các lịch hẹn có hóa đơn paid
    const paidAppointmentIds = invoices.map(invoice => invoice.appointment_id.toString()); // Lấy danh sách appointment_id từ hóa đơn
    const filteredAppointments = appointments.filter(appointment => 
      paidAppointmentIds.includes(appointment._id.toString()) // Kiểm tra nếu appointment_id nằm trong danh sách
    );

    res.json(filteredAppointments); // Trả về kết quả
  } catch (err) {
    console.error('Lỗi khi lấy lịch hẹn có status paid:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};
// Lấy thông tin lịch hẹn cùng các dịch vụ liên quan và tổng phí
exports.getAppointmentDetailsWithTotalCost = async (req, res) => {
  const { appointmentId } = req.params;

  try {
    // Tìm lịch hẹn
    const appointment = await Appointment.findOne({ _id: appointmentId, is_deleted: false })
      .populate('vehicle_id customer_id')
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
        appServiceId: appService._id,
        name: service.name,
        description: service.description,
        price: price,
        time_required: service.time_required,
        is_done: appService.is_done,
        time_completed: appService.time_completed,
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
    const inVoice = await Invoice.findOne({ appointment_id: appointmentId, is_deleted: false }).lean();
    if (inVoice != null && inVoice.status == 'paid') {
      return res.status(404).json({ msg: 'Lịch hẹn đã thanh toán, không thể xóa' });
    }
    if (!appointment || appointment.is_deleted) {
      return res.status(404).json({ msg: 'Không tìm thấy lịch hẹn' });
    }

    if (appointment.status == 'completed' && appointment.status == 'cancelled') {
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
    if (!appointment || appointment.is_deleted) {
      return res.status(404).json({ msg: 'Không tìm thấy lịch hẹn hợp lệ' });
    }
    // Cập nhật trạng thái lịch hẹn thành "completed"
    appointment.status = 'completed';
    await appointment.save();
    const slot = await Slot.findById(appointment.slot_id);
    if (!slot) {
      return res.status(404).json({ msg: 'Không tìm thấy slot' });
    }
    slot.status = 'available';
    // slot.slot_datetime = null;
    slot.duration_minutes = 0;
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

// Lấy lịch hẹn đã hoàn thành, nếu lịch hẹn nào đã lên hóa đơn thì lấy thêm cả thông tin hóa đơn
exports.getCompletedAppointments = async (req, res) => {
  try {
    // Lấy tất cả các lịch hẹn có trạng thái "completed" và sắp xếp theo appointment_datetime từ ngày gần nhất đến ngày xa nhất
    const appointments = await Appointment.find({ status: 'completed', is_deleted: false })
      .populate('customer_id')
      .populate('vehicle_id')
      .populate('slot_id')
      .sort({ appointment_datetime: -1 })
      .lean();

    if (appointments.length === 0) {
      return res.json(appointments);
    }

    // Tìm hóa đơn liên quan đến các lịch hẹn
    const appointmentIds = appointments.map(appointment => appointment._id);
    const invoices = await Invoice.find({ appointment_id: { $in: appointmentIds }, is_deleted: false }).lean();

    // Tạo map để ánh xạ hóa đơn với lịch hẹn
    const invoiceMap = {};
    invoices.forEach(invoice => {
      invoiceMap[invoice.appointment_id.toString()] = invoice;
    });

    // Thêm thông tin hóa đơn vào đối tượng lịch hẹn (nếu có)
    const appointmentsWithInvoices = appointments.map(appointment => {
      return {
        ...appointment,
        invoice: invoiceMap[appointment._id.toString()] || null, // Nếu không có hóa đơn, đặt giá trị là null
      };
    });

    res.json(appointmentsWithInvoices);
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

// thêm slot cho lịch hẹn chưa có slot
exports.addSlotToAppointment = async (req, res) => {
  const { appointmentId } = req.params;

  try {
    // Tìm lịch hẹn
    const appointment = await Appointment.findById(appointmentId);
    const appointmentService = await AppointmentService.find({ appointment_id: appointmentId }).populate('price_line_id').lean();

    if (!appointment || appointment.is_deleted) {
      return res.status(404).json({ msg: 'Không tìm thấy lịch hẹn' });
    }
    // Kiểm tra xem lịch hẹn đã có slot chưa
    if (appointment.slot_id) {
      return res.status(400).json({ msg: 'Lịch hẹn đã có slot' });
    }
    const slot = await Slot.findOne({ status: 'available', is_deleted: false });
    if (!slot) {
      return res.status(404).json({ msg: 'Không tìm thấy slot khả dụng' });
    }
    // Cập nhật slot cho lịch hẹn
    appointment.slot_id = slot._id;
    await appointment.save();
    slot.status = 'booked';
    slot.slot_datetime = Date.now();
    slot.duration_minutes = 0;
    for (let service of appointmentService) {
      let services = await Service.findById(service.price_line_id.service_id);
      slot.duration_minutes += services.time_required;
    }
    await slot.save();
    res.status(200).json({ msg: 'Thêm slot cho lịch hẹn thành công', apoointment: appointment });
  } catch (err) {
    console.error('Lỗi khi thêm slot cho lịch hẹn:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
}

// Lấy tất cả lịch hẹn của khách hàng
exports.getAppointmentsByCustomer = async (req, res) => {
  const { customerId } = req.params;

  try {
    const appointments = await Appointment.find({ customer_id: customerId, is_deleted: false })
      .populate('vehicle_id')
      .populate('slot_id')
      .populate('customer_id')
      .sort({ appointment_datetime: -1 })
      .lean();

    if (appointments.length === 0) {
      return res.json(appointments);
    }

    // Tìm hóa đơn liên quan đến các lịch hẹn
    const appointmentIds = appointments.map(appointment => appointment._id);
    const invoices = await Invoice.find({ appointment_id: { $in: appointmentIds }, is_deleted: false }).lean();

    // Tạo map để ánh xạ hóa đơn với lịch hẹn
    const invoiceMap = {};
    invoices.forEach(invoice => {
      invoiceMap[invoice.appointment_id.toString()] = invoice;
    });

    // Xử lý từng lịch hẹn để thêm thông tin hóa đơn và dịch vụ
    const appointmentsWithInvoices = await Promise.all(appointments.map(async (appointment) => {
      // Tìm các dịch vụ liên quan đến lịch hẹn này
      const appointmentServices = await AppointmentService.find({ appointment_id: appointment._id, is_deleted: false })
        .populate({
          path: 'price_line_id',
          populate: {
            path: 'service_id',
            model: 'Service',
          },
        })
        .lean();

      // Tạo danh sách dịch vụ cho lịch hẹn này
      const services = appointmentServices.map(appService => ({
        _id: appService.price_line_id.service_id._id,
        name: appService.price_line_id.service_id.name,
        description: appService.price_line_id.service_id.description,
        price: appService.price_line_id.price,
        time_required: appService.price_line_id.service_id.time_required,
        is_done: appService.is_done,
        time_completed: appService.time_completed,
      }));

      return {
        ...appointment,
        invoice: invoiceMap[appointment._id.toString()] || null,
        services: services,
      };
    }));

    res.json(appointmentsWithInvoices);
  } catch (err) {
    console.error('Lỗi khi lấy lịch hẹn của khách hàng:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};


// Lấy tất cả lịch hẹn của khách hàng
exports.getAppointmentsByCustomerWatting = async (req, res) => {
  const { customerId } = req.params;

  try {
    const appointments = await Appointment.find({ customer_id: customerId, is_deleted: false, status: 'waiting' })
      .populate('vehicle_id')
      .populate('slot_id')
      .sort({ appointment_datetime: -1 })
      .lean();

    if (appointments.length === 0) {
      return res.json(appointments);
    }

    // Tìm hóa đơn liên quan đến các lịch hẹn
    const appointmentIds = appointments.map(appointment => appointment._id);
    const invoices = await Invoice.find({ appointment_id: { $in: appointmentIds }, is_deleted: false }).lean();

    // Tạo map để ánh xạ hóa đơn với lịch hẹn
    const invoiceMap = {};
    invoices.forEach(invoice => {
      invoiceMap[invoice.appointment_id.toString()] = invoice;
    });

    // Thêm thông tin hóa đơn và dịch vụ vào đối tượng lịch hẹn (nếu có)
    const appointmentsWithInvoices = [];
    for (let appointment of appointments) {
      // Lấy các dịch vụ liên quan đến lịch hẹn
      const appointmentServices = await AppointmentService.find({ appointment_id: appointment._id, is_deleted: false }).populate('price_line_id').lean();

      // Tính tổng phí và thêm thông tin dịch vụ vào đối tượng lịch hẹn
      let totalCost = 0;
      const services = [];

      for (let appService of appointmentServices) {
        const service = await Service.findById(appService.price_line_id.service_id).lean();
        const price = appService.price_line_id.price;

        // Cộng giá dịch vụ vào tổng phí
        totalCost += price;

        services.push({
          _id: service._id,
          name: service.name,
          description: service.description,
          price: price,
          time_required: service.time_required,
        });
      }

      // Thêm danh sách dịch vụ, tổng phí và thông tin hóa đơn vào đối tượng lịch hẹn
      appointmentsWithInvoices.push({
        ...appointment,
        invoice: invoiceMap[appointment._id.toString()] || null, // Nếu không có hóa đơn, đặt giá trị là null
        services: services,
        total_cost: totalCost,
      });
    }

    res.json(appointmentsWithInvoices);
  } catch (err) {
    console.error('Lỗi khi lấy lịch hẹn của khách hàng:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};

// cập nhật dịch vụ dã hoàn thành của lịch hẹn
exports.updateServiceStatus = async (req, res) => {
  const { appointmentServiceId } = req.params;

  try {
    // Tìm dịch vụ của lịch hẹn
    const appointmentService = await AppointmentService.findById(appointmentServiceId);
    if (!appointmentService || appointmentService.is_deleted) {
      return res.status(404).json({ msg: 'Không tìm thấy dịch vụ' });
    }

    // Cập nhật trạng thái dịch vụ thành "completed"
    appointmentService.is_done = !appointmentService.is_done;
    appointmentService.time_completed = Date.now();
    await appointmentService.save();

    res.json({ msg: 'Cập nhật trạng thái dịch vụ thành công', appointmentService });
  } catch (err) {
    console.error('Lỗi khi cập nhật trạng thái dịch vụ:', err.message);
    res.status(500).send('Lỗi máy chủ');
  }
};