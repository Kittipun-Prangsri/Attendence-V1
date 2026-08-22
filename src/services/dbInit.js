/**
 * Database Initializer for Attendance System
 * Manages the dedicated Attendance_person table without altering hr_person.
 */
const db = require('../config/db');

let isInitialized = false;

async function initAttendancePersonTable() {
  if (isInitialized) return;

  try {
    // 1. Create Attendance_person table if it does not exist
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS Attendance_person (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cid VARCHAR(13) NOT NULL UNIQUE COMMENT 'เลขบัตรประชาชน 13 หลัก',
        emp_id VARCHAR(50) NULL COMMENT 'รหัสพนักงาน / FINGLE_ID',
        line_id VARCHAR(100) NULL COMMENT 'LINE User ID (Uxxxxxxxxxxxxxx)',
        fname VARCHAR(100) NOT NULL COMMENT 'ชื่อจริง',
        lname VARCHAR(100) NOT NULL COMMENT 'นามสกุล',
        department VARCHAR(100) NULL COMMENT 'แผนก / ปฏิบัติงาน',
        role VARCHAR(50) DEFAULT 'user' COMMENT 'สิทธิ์ / ตำแหน่ง',
        status ENUM('active', 'inactive') DEFAULT 'active' COMMENT 'สถานะใช้งาน',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_cid (cid),
        INDEX idx_emp_id (emp_id),
        INDEX idx_line_id (line_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;
    await db.query(createTableQuery);

    // 2. Sync initial employee list from hr_person into Attendance_person (Insert IGNORE - preserves hr_person)
    try {
      const syncQuery = `
        INSERT IGNORE INTO Attendance_person (cid, emp_id, fname, lname, department)
        SELECT 
          p.HR_CID as cid, 
          p.FINGLE_ID as emp_id, 
          COALESCE(p.HR_FNAME, 'ไม่ระบุ') as fname, 
          COALESCE(p.HR_LNAME, '') as lname, 
          d.HR_DEPARTMENT_NAME as department
        FROM hr_person p
        LEFT JOIN hr_department d ON p.HR_DEPARTMENT_ID = d.HR_DEPARTMENT_ID
        WHERE p.HR_CID IS NOT NULL AND CHAR_LENGTH(TRIM(p.HR_CID)) = 13;
      `;
      await db.query(syncQuery);
    } catch (syncErr) {
      console.warn('⚠️ Note during Attendance_person initial sync:', syncErr.message);
    }

    isInitialized = true;
    console.log('✅ Attendance_person table initialized successfully!');
  } catch (error) {
    console.error('❌ Error initializing Attendance_person table:', error.message);
  }
}

module.exports = {
  initAttendancePersonTable
};
