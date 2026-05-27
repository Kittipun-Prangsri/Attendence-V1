const express = require('express');
const router = express.Router();
const db = require('../config/db');

// --- Mock API endpoints for the Frontend ---

// Login Authentication Endpoint
router.post('/auth/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, error: 'กรุณาระบุชื่อและรหัสผ่าน' });
        }

        if (password !== 'user123') {
            return res.status(401).json({ success: false, error: 'รหัสผ่านไม่ถูกต้อง' });
        }

        const query = `
            SELECT HR_FNAME, HR_LNAME, USER_TYPE, FINGLE_ID 
            FROM hr_person 
            WHERE HR_CID = ?
            LIMIT 1
        `;
        const [rows] = await db.query(query, [username]);

        if (rows.length === 0) {
            return res.status(401).json({ success: false, error: 'ไม่พบชื่อผู้ใช้งานนี้ในระบบ' });
        }

        const user = rows[0];
        res.json({
            success: true,
            user: {
                name: `${user.HR_FNAME} ${user.HR_LNAME}`,
                role: user.USER_TYPE,
                empId: user.FINGLE_ID
            }
        });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ success: false, error: 'ข้อผิดพลาดจากฐานข้อมูล' });
    }
});

// Get Dashboard Stats
router.get('/dashboard/stats', async (req, res) => {
    try {
        const lateTime = req.query.lateTime || '08:30';
        const lateTimeSql = lateTime + ':00'; // e.g., '08:30:00'

        // 1. Total Employees (นับ FINGLE_ID จาก HR_Person)
        let total = 0;
        try {
            const [[resultTotal]] = await db.query(`SELECT COUNT(FINGLE_ID) as total FROM HR_Person`);
            total = resultTotal.total;
        } catch (e) {
            console.warn('Warning: Could not count HR_Person', e.message);
        }
        
        // 2. Present Today (Check-ins today)
        const [[{ present }]] = await db.query(`
            SELECT COUNT(DISTINCT EmployeeID) as present 
            FROM hikvision 
            WHERE AccessDate = CURDATE() AND AttendanceStatus = 'i'
        `);
        
        // 3. Late Today (ใช้เวลาจาก lateTimeSql แทนเวลาตายตัว)
        const [[{ late }]] = await db.query(`
            SELECT COUNT(DISTINCT EmployeeID) as late 
            FROM hikvision 
            WHERE AccessDate = CURDATE() AND AttendanceStatus = 'i' AND AccessTime > ?
        `, [lateTimeSql]);
        
        // 4. Absent/Leave Today (ดึงจาก 3 ตารางใหม่ ตามโครงสร้าง year_and_month และ di1-di31)
        let absent = 0;
        try {
            const today = new Date();
            // สร้าง format เช่น '2026-05'
            const yearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
            // หาวันที่ เพื่อไปแมตช์กับคอลัมน์ di1 ถึง di31
            const day = today.getDate(); 
            const col = `di${day}`;

            // นับคนที่คอลัมน์วันนี้มีคำว่า 'ลา' หรือ 'ขาด'
            const absentQuery = `
                SELECT COUNT(DISTINCT hr_person_id) as absentCount FROM (
                    SELECT hr_person_id FROM service_work_scans_morning 
                    WHERE year_and_month = ? AND (${col} LIKE '%ลา%' OR ${col} LIKE '%ขาด%')
                    UNION
                    SELECT hr_person_id FROM service_work_scans_night 
                    WHERE year_and_month = ? AND (${col} LIKE '%ลา%' OR ${col} LIKE '%ขาด%')
                    UNION
                    SELECT hr_person_id FROM service_work_scans_afternoon 
                    WHERE year_and_month = ? AND (${col} LIKE '%ลา%' OR ${col} LIKE '%ขาด%')
                ) as leaves
            `;
            const [[{ absentCount }]] = await db.query(absentQuery, [yearMonth, yearMonth, yearMonth]);
            absent = absentCount;
        } catch (dbErr) {
            console.warn('Warning: Could not fetch from service_work_scans_*', dbErr.message);
        }
        
        res.json({
            total: total || 0,
            present: present || 0,
            late: late || 0,
            absent: absent
        });
    } catch (error) {
        console.error('Stats Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get recent activity
router.get('/attendance/recent', async (req, res) => {
    try {
        const limitParam = parseInt(req.query.limit, 10);
        const limit = isNaN(limitParam) ? 10 : limitParam;

        let rows = [];
        try {
            const query = `
                SELECT 
                    h.EmployeeID, 
                    h.AccessTime, 
                    h.AttendanceStatus,
                    p.HR_FNAME as FirstName, 
                    p.HR_LNAME as LastName, 
                    d.HR_DEPARTMENT_NAME as PersonGroup
                FROM hikvision h
                LEFT JOIN hr_person p ON h.EmployeeID = p.FINGLE_ID
                LEFT JOIN hr_department d ON p.HR_DEPARTMENT_ID = d.HR_DEPARTMENT_ID
                WHERE h.AccessDate = CURDATE()
                ORDER BY h.AccessDateandTime DESC
                LIMIT ?
            `;
            const [resultRows] = await db.query(query, [limit]);
            rows = resultRows;
        } catch (err) {
            console.warn("Warning: LEFT JOIN HR_Person failed. Falling back to hikvision only.", err.message);
            const fallbackQuery = `
                SELECT 
                    EmployeeID, 
                    AccessTime, 
                    AttendanceStatus,
                    NULL as FirstName, 
                    NULL as LastName, 
                    NULL as PersonGroup
                FROM hikvision
                WHERE AccessDate = CURDATE()
                ORDER BY AccessDateandTime DESC
                LIMIT ?
            `;
            const [fallbackRows] = await db.query(fallbackQuery, [limit]);
            rows = fallbackRows;
        }
        
        // Format data for frontend
        const formattedData = rows.map(row => {
            let statusBadge = 'status-in';
            let statusText = 'เข้างานปกติ';
            
            if (row.AttendanceStatus === 'o') {
                statusBadge = 'status-leave';
                statusText = 'ออกงาน';
            } else if (row.AttendanceStatus === 'i' && row.AccessTime > '08:30:00') {
                statusBadge = 'status-late';
                statusText = 'เข้าสาย';
            }

            return {
                name: (row.FirstName && row.LastName) ? `${row.FirstName} ${row.LastName}` : (row.EmployeeID || 'ไม่ระบุ'),
                dept: row.PersonGroup || 'ไม่ระบุแผนก',
                in: row.AttendanceStatus === 'i' ? row.AccessTime : '-',
                out: row.AttendanceStatus === 'o' ? row.AccessTime : '-',
                status: statusBadge,
                statusLabel: statusText
            };
        });

        res.json(formattedData);
    } catch (error) {
        console.error('Recent Activity Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Record Attendance (Check-in / Check-out)
router.post('/attendance/record', async (req, res) => {
    try {
        const { empId, type } = req.body;
        
        if (!empId || !type) {
            return res.status(400).json({ error: 'กรุณาระบุรหัสพนักงาน' });
        }

        const attendanceStatus = type === 'check-in' ? 'i' : 'o';

        // 1. ตรวจสอบ CardNumber ล่าสุดแล้วบวกเพิ่ม 1
        let nextCardNumberStr = '18446744073609551962';
        try {
            const cardQuery = `SELECT CardNumber FROM hikvision ORDER BY CAST(CardNumber AS UNSIGNED) DESC LIMIT 1`;
            const [cardRows] = await db.query(cardQuery);
            if (cardRows.length > 0 && cardRows[0].CardNumber) {
                // ใช้ BigInt เพราะตัวเลขเกินข้อจำกัดของ Javascript Number ปกติ
                const currentMax = BigInt(cardRows[0].CardNumber);
                nextCardNumberStr = (currentMax + 1n).toString();
            }
        } catch (dbErr) {
            console.warn('Warning: Could not fetch max CardNumber, using default.', dbErr.message);
        }

        // 2. บันทึกข้อมูลลงตาราง hikvision ตามค่าที่กำหนดไว้
        const insertQuery = `
            INSERT INTO hikvision (
                EmployeeID, AccessDateandTime, AccessDate, AccessTime, 
                AuthenticationResult, AuthenticationType, DeviceName, DeviceSerialNo, 
                ReaderName, FirstName, LastName, PersonName, PersonGroup, 
                CardNumber, Direction, SkinSurfaceTemperature, TemperatureStatus, 
                AttendanceStatus, is_notified
            ) VALUES (
                ?, DATE_FORMAT(NOW(), '%Y-%m-%dT%T'), CURDATE(), CURTIME(), 
                'Success', 'ACSEventFaceVerifyPass', 'KHHin1', 'AX6425372', 
                'Cardreader 01', NULL, NULL, NULL, NULL, 
                ?, 'in', '', 'Unknown', 
                ?, 0
            )
        `;
        
        const [result] = await db.query(insertQuery, [
            empId, 
            nextCardNumberStr, 
            attendanceStatus
        ]);

        res.json({ success: true, message: 'บันทึกเวลาสำเร็จ', data: result });
    } catch (error) {
        console.error('Database Insert Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
