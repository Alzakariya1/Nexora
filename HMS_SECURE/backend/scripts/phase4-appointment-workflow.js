require('dotenv').config();
const { connectDB, mongoose } = require('../src/config/db');
const { Appointment } = require('../src/models');

const VALID_STATUSES = new Set(['scheduled', 'checked_in', 'in_consultation', 'completed', 'cancelled', 'no_show', 'archived']);
const TERMINAL = new Set(['completed', 'cancelled', 'no_show', 'archived']);

function normalizeStatus(status) {
  const value = String(status || 'scheduled').trim().toLowerCase();
  return VALID_STATUSES.has(value) ? value : 'scheduled';
}

async function main() {
  await connectDB();
  const rows = await Appointment.find({}).sort({ hospital_id: 1, appointment_date: 1, doctor_id: 1, token_sequence: 1, appointment_time: 1, id: 1 });
  let normalizedStatuses = 0;
  let activeConsultationFixes = 0;
  const activeConsultationByDoctorDay = new Map();

  for (const row of rows) {
    const status = normalizeStatus(row.status);
    const update = {};
    if (row.status !== status) {
      update.status = status;
      normalizedStatuses += 1;
    }

    if (!TERMINAL.has(status)) {
      if (status === 'checked_in' && !row.checked_in_at) update.checked_in_at = row.created_at || new Date();
      if (status === 'in_consultation' && !row.consultation_started_at) update.consultation_started_at = row.checked_in_at || row.created_at || new Date();
    }

    if (status === 'in_consultation') {
      const key = `${row.hospital_id || 1}::${row.appointment_date || ''}::${row.doctor_id || ''}`;
      if (activeConsultationByDoctorDay.has(key)) {
        update.status = 'checked_in';
        update.workflow_note = 'Phase 4 repair: duplicate in-consultation row moved back to checked-in queue.';
        activeConsultationFixes += 1;
      } else {
        activeConsultationByDoctorDay.set(key, row.id || String(row._id));
      }
    }

    if (Object.keys(update).length) {
      await Appointment.updateOne({ _id: row._id }, { $set: update });
    }
  }

  console.log(JSON.stringify({ ok: true, normalizedStatuses, activeConsultationFixes }, null, 2));
  await mongoose.connection.close();
}

main().catch(async (err) => {
  console.error('Phase 4 appointment workflow repair failed:', err);
  try { await mongoose.connection.close(); } catch (_) {}
  process.exit(1);
});
