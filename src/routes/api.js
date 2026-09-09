const express = require('express');
const router = express.Router();
const db = require('../config/db');
const flexBuilder = require('../services/flexBuilder');
const { initAttendancePersonTable } = require('../services/dbInit');

// --- Mock API endpoints for the Frontend ---

// Login Authentication Endpoint
router.post('/auth/login', async (req, res) => {
    try {
        await initAttendancePersonTable();
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, error: 'กรุณาระบุชื่อและรหัสผ่าน' });
        }

        if (password !== 'user123') {
            return res.status(401).json({ success: false, error: 'รหัสผ่านไม่ถูกต้อง' });
        }

        const query = `
            SELECT fname, lname, role, emp_id, cid 
            FROM Attendance_person 
            WHERE cid = ? OR emp_id = ?
            LIMIT 1
        `;
        const [rows] = await db.query(query, [username, username]);

        if (rows.length === 0) {
            return res.status(401).json({ success: false, error: 'ไม่พบชื่อผู้ใช้งานนี้ในระบบ' });
        }

        const user = rows[0];
        res.json({
            success: true,
            user: {
                name: `${user.fname} ${user.lname}`,
                role: user.role,
                empId: user.emp_id || user.cid
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

        // 1. Total Employees (นับจาก Attendance_person)
        let total = 0;
        try {
            await initAttendancePersonTable();
            const [[resultTotal]] = await db.query(`SELECT COUNT(id) as total FROM Attendance_person WHERE status = 'active'`);
            total = resultTotal.total;
        } catch (e) {
            console.warn('Warning: Could not count Attendance_person', e.message);
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

// Get today's attendance breakdown grouped by department (for dashboard chart)
router.get('/dashboard/department-stats', async (req, res) => {
    try {
        const lateTime = req.query.lateTime || '08:30';
        const lateTimeSql = lateTime + ':00';

        const query = `
            SELECT
                COALESCE(p.department, 'ไม่ระบุแผนก') as department,
                COALESCE(p.emp_id, p.cid) as empId,
                MIN(CASE WHEN h.AttendanceStatus = 'i' THEN h.AccessTime END) as InTime
            FROM Attendance_person p
            LEFT JOIN hikvision h ON (h.EmployeeID = p.emp_id OR h.EmployeeID = p.cid) AND h.AccessDate = CURDATE()
            WHERE p.status = 'active'
            GROUP BY p.department, p.emp_id, p.cid
        `;
        const [rows] = await db.query(query);

        const deptMap = {};
        rows.forEach(row => {
            const dept = row.department;
            if (!deptMap[dept]) {
                deptMap[dept] = { department: dept, onTime: 0, late: 0, notYet: 0, total: 0 };
            }
            deptMap[dept].total++;
            if (row.InTime) {
                if (row.InTime > lateTimeSql) {
                    deptMap[dept].late++;
                } else {
                    deptMap[dept].onTime++;
                }
            } else {
                deptMap[dept].notYet++;
            }
        });

        const result = Object.values(deptMap).sort((a, b) => b.total - a.total);
        res.json(result);
    } catch (error) {
        console.error('Department Stats Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get today's attendance status for all staff (so admin can act on anyone, not just those already scanned)
router.get('/attendance/recent', async (req, res) => {
    try {
        const isAll = req.query.limit === 'all';
        const limitParam = parseInt(req.query.limit, 10);
        const limit = isAll ? 100000 : (isNaN(limitParam) ? 10 : limitParam);

        let rows = [];
        try {
            const query = `
                SELECT
                    COALESCE(p.emp_id, p.cid) as EmployeeID,
                    p.fname as FirstName,
                    p.lname as LastName,
                    p.department as PersonGroup,
                    MIN(CASE WHEN h.AttendanceStatus = 'i' THEN h.AccessTime END) as InTime,
                    MAX(CASE WHEN h.AttendanceStatus = 'o' THEN h.AccessTime END) as OutTime
                FROM Attendance_person p
                LEFT JOIN hikvision h ON (h.EmployeeID = p.emp_id OR h.EmployeeID = p.cid) AND h.AccessDate = CURDATE()
                WHERE p.status = 'active'
                GROUP BY p.emp_id, p.cid, p.fname, p.lname, p.department
                ORDER BY p.fname ASC
                LIMIT ?
            `;
            const [resultRows] = await db.query(query, [limit]);
            rows = resultRows;
        } catch (err) {
            console.warn("Warning: LEFT JOIN Attendance_person failed. Falling back to hikvision only.", err.message);
            const fallbackQuery = `
                SELECT
                    EmployeeID,
                    NULL as FirstName,
                    NULL as LastName,
                    NULL as PersonGroup,
                    MIN(CASE WHEN AttendanceStatus = 'i' THEN AccessTime END) as InTime,
                    MAX(CASE WHEN AttendanceStatus = 'o' THEN AccessTime END) as OutTime
                FROM hikvision
                WHERE AccessDate = CURDATE()
                GROUP BY EmployeeID
                ORDER BY EmployeeID ASC
                LIMIT ?
            `;
            const [fallbackRows] = await db.query(fallbackQuery, [limit]);
            rows = fallbackRows;
        }

        // Format data for frontend
        const formattedData = rows.map(row => {
            let statusBadge = 'status-leave';
            let statusText = 'ยังไม่มาปฏิบัติงาน';

            if (row.InTime) {
                if (row.OutTime) {
                    statusBadge = 'status-leave';
                    statusText = 'ออกงานแล้ว';
                } else if (row.InTime > '08:30:00') {
                    statusBadge = 'status-late';
                    statusText = 'เข้าสาย';
                } else {
                    statusBadge = 'status-in';
                    statusText = 'เข้างานปกติ';
                }
            }

            return {
                empId: row.EmployeeID,
                name: (row.FirstName && row.LastName) ? `${row.FirstName} ${row.LastName}` : (row.EmployeeID || 'ไม่ระบุ'),
                dept: row.PersonGroup || 'ไม่ระบุแผนก',
                in: row.InTime || '-',
                out: row.OutTime || '-',
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

// Get full personnel list (for จัดการบุคลากร page)
router.get('/employees', async (req, res) => {
    try {
        await initAttendancePersonTable();
        const query = `
            SELECT
                emp_id as empId,
                cid,
                fname as firstName,
                lname as lastName,
                role,
                department,
                line_id
            FROM Attendance_person
            WHERE status = 'active'
            ORDER BY fname ASC
        `;
        const [rows] = await db.query(query);

        const formattedData = rows.map(row => ({
            empId: row.empId || row.cid,
            cid: row.cid || '-',
            name: `${row.firstName || ''} ${row.lastName || ''}`.trim() || row.empId || 'ไม่ระบุ',
            department: row.department || 'ไม่ระบุแผนก',
            role: row.role === 'SUPER' ? 'ผู้ดูแลระบบ' : (row.role || 'พนักงาน'),
            isLineBound: !!row.line_id
        }));

        res.json(formattedData);
    } catch (error) {
        console.error('Employees List Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get the most recent check-in/out events (for dashboard "5 คนล่าสุด" widget)
router.get('/attendance/latest', async (req, res) => {
    try {
        const limitParam = parseInt(req.query.limit, 10);
        const limit = isNaN(limitParam) ? 5 : limitParam;

        let rows = [];
        try {
            const query = `
                SELECT
                    h.EmployeeID,
                    h.AccessTime,
                    h.AttendanceStatus,
                    p.fname as FirstName,
                    p.lname as LastName,
                    p.department as PersonGroup
                FROM hikvision h
                LEFT JOIN Attendance_person p ON (h.EmployeeID = p.emp_id OR h.EmployeeID = p.cid)
                WHERE h.AccessDate = CURDATE()
                ORDER BY h.AccessDateandTime DESC
                LIMIT ?
            `;
            const [resultRows] = await db.query(query, [limit]);
            rows = resultRows;
        } catch (err) {
            console.warn('Warning: latest activity join failed, falling back to hikvision only.', err.message);
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

        const formattedData = rows.map(row => ({
            name: (row.FirstName && row.LastName) ? `${row.FirstName} ${row.LastName}` : (row.EmployeeID || 'ไม่ระบุ'),
            dept: row.PersonGroup || 'ไม่ระบุแผนก',
            time: row.AccessTime,
            type: row.AttendanceStatus === 'i' ? 'check-in' : 'check-out'
        }));

        res.json(formattedData);
    } catch (error) {
        console.error('Latest Activity Error:', error);
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

// GET Endpoint to generate LINE Flex Message JSON
router.get('/flex/checkin-card', async (req, res) => {
    try {
        const { empId, fullname } = req.query;
        const flexJson = flexBuilder.buildCheckInCheckOutFlex({ empId, fullname });
        res.json(flexJson);
    } catch (error) {
        console.error('Flex Generator Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET Endpoint for Quick Record via LINE Flex URI click
router.get('/attendance/quick-record', async (req, res) => {
    try {
        const { empId, type } = req.query;
        const targetEmpId = empId || 'UNKNOWN';
        let attendanceType = type;

        // Smart Time Window Auto-Detection (05:00-12:00 Check-In, 13:00-20:00 Check-Out)
        if (!type || type === 'check' || type === 'auto') {
            const now = new Date();
            const currentMinutes = now.getHours() * 60 + now.getMinutes();

            // 05:00 (300 mins) to 12:00 (720 mins) -> Check-In
            if (currentMinutes >= 300 && currentMinutes <= 720) {
                attendanceType = 'check-in';
            } 
            // 13:00 (780 mins) to 20:00 (1200 mins) -> Check-Out
            else if (currentMinutes >= 780 && currentMinutes <= 1200) {
                attendanceType = 'check-out';
            } 
            // Outside windows -> Auto-detect based on last scan today
            else {
                try {
                    const lastScanQuery = `SELECT AttendanceStatus FROM hikvision WHERE EmployeeID = ? AND AccessDate = CURDATE() ORDER BY AccessDateandTime DESC LIMIT 1`;
                    const [lastRows] = await db.query(lastScanQuery, [targetEmpId]);
                    if (lastRows.length > 0 && lastRows[0].AttendanceStatus === 'i') {
                        attendanceType = 'check-out';
                    } else {
                        attendanceType = 'check-in';
                    }
                } catch (e) {
                    attendanceType = 'check-in';
                }
            }
        }

        const attendanceStatus = attendanceType === 'check-out' ? 'o' : 'i';

        let nextCardNumberStr = '18446744073609551962';
        try {
            const cardQuery = `SELECT CardNumber FROM hikvision ORDER BY CAST(CardNumber AS UNSIGNED) DESC LIMIT 1`;
            const [cardRows] = await db.query(cardQuery);
            if (cardRows.length > 0 && cardRows[0].CardNumber) {
                const currentMax = BigInt(cardRows[0].CardNumber);
                nextCardNumberStr = (currentMax + 1n).toString();
            }
        } catch (dbErr) {
            console.warn('Warning: Could not fetch max CardNumber:', dbErr.message);
        }

        const insertQuery = `
            INSERT INTO hikvision (
                EmployeeID, AccessDateandTime, AccessDate, AccessTime, 
                AuthenticationResult, AuthenticationType, DeviceName, DeviceSerialNo, 
                ReaderName, FirstName, LastName, PersonName, PersonGroup, 
                CardNumber, Direction, SkinSurfaceTemperature, TemperatureStatus, 
                AttendanceStatus, is_notified
            ) VALUES (
                ?, DATE_FORMAT(NOW(), '%Y-%m-%dT%T'), CURDATE(), CURTIME(), 
                'Success', 'ACSEventFaceVerifyPass', 'LINE Flex App', 'AX6425372', 
                'LINE Official', NULL, NULL, NULL, NULL, 
                ?, 'in', '', 'Unknown', 
                ?, 0
            )
        `;
        await db.query(insertQuery, [targetEmpId, nextCardNumberStr, attendanceStatus]);

        const actionText = attendanceType === 'check-in' ? 'ลงเวลาเข้างาน (Check-In)' : 'ลงเวลาออกงาน (Check-Out)';
        const themeColor = attendanceType === 'check-in' ? '#0D9488' : '#E11D48';

        // Return beautiful HTML confirmation response for mobile browser
        res.send(`
            <!DOCTYPE html>
            <html lang="th">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>บันทึกเวลาสำเร็จ</title>
                <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@400;600;700&display=swap" rel="stylesheet">
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Prompt', sans-serif; }
                    body { background: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
                    .card { background: white; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); width: 100%; max-width: 400px; text-align: center; overflow: hidden; }
                    .header { background: ${themeColor}; padding: 30px 20px; color: white; }
                    .icon { font-size: 50px; margin-bottom: 10px; }
                    .content { padding: 30px 20px; }
                    .title { font-size: 1.3rem; font-weight: 700; color: #1e293b; margin-bottom: 10px; }
                    .desc { color: #64748b; font-size: 0.95rem; margin-bottom: 20px; }
                    .badge { display: inline-block; padding: 8px 16px; background: #f1f5f9; border-radius: 20px; font-weight: 600; color: #334155; font-size: 0.9rem; }
                    .btn-close { display: block; margin-top: 25px; padding: 12px; background: ${themeColor}; color: white; text-decoration: none; border-radius: 12px; font-weight: 600; }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="header">
                        <div class="icon">✅</div>
                        <h2>บันทึกเวลาสำเร็จ</h2>
                    </div>
                    <div class="content">
                        <div class="title">${actionText}</div>
                        <div class="desc">ระบบได้บันทึกเวลาเข้าสู่ระบบเรียบร้อยแล้ว</div>
                        <div class="badge">⏰ เวลา: ${new Date().toLocaleTimeString('th-TH')} น.</div>
                        <a href="javascript:void(0)" onclick="window.close()" class="btn-close">ปิดหน้าต่างนี้</a>
                    </div>
                </div>
            </body>
            </html>
        `);
    } catch (error) {
        console.error('Quick Record Error:', error);
        res.status(500).send(`<h2>❌ เกิดข้อผิดพลาด: ${error.message}</h2>`);
    }
});

module.exports = router;
