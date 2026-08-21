const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { hashPassword } = require('../utils/password');
const { authenticateToken, requireRole } = require('../middleware/auth');

router.use(authenticateToken, requireRole('SUPER'));

// List employees with attendance-enrollment status
router.get('/', async (req, res) => {
    try {
        const { search, dept, status } = req.query;
        const conditions = [];
        const params = [];

        if (search) {
            conditions.push('(p.HR_CID LIKE ? OR p.HR_FNAME LIKE ? OR p.HR_LNAME LIKE ?)');
            const like = `%${search}%`;
            params.push(like, like, like);
        }
        if (dept) {
            conditions.push('p.HR_DEPARTMENT_ID = ?');
            params.push(dept);
        }
        if (status === 'enrolled') {
            conditions.push("p.FINGLE_ID IS NOT NULL AND p.FINGLE_ID != ''");
        } else if (status === 'unenrolled') {
            conditions.push("(p.FINGLE_ID IS NULL OR p.FINGLE_ID = '')");
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const query = `
            SELECT p.ID, p.FINGLE_ID, p.HR_CID, p.HR_FNAME, p.HR_LNAME, d.HR_DEPARTMENT_NAME
            FROM hr_person p
            LEFT JOIN hr_department d ON p.HR_DEPARTMENT_ID = d.HR_DEPARTMENT_ID
            ${whereClause}
            ORDER BY p.HR_FNAME, p.HR_LNAME
            LIMIT 500
        `;
        const [rows] = await db.query(query, params);
        res.json(rows);
    } catch (error) {
        console.error('Personnel List Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// List departments (for filter dropdown)
router.get('/departments', async (req, res) => {
    try {
        const [rows] = await db.query(
            `SELECT HR_DEPARTMENT_ID, HR_DEPARTMENT_NAME FROM hr_department WHERE ACTIVE = 'True' ORDER BY HR_DEPARTMENT_NAME`
        );
        res.json(rows);
    } catch (error) {
        console.error('Department List Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Enroll an existing employee into the attendance system (assign FINGLE_ID)
router.put('/:id/enroll', async (req, res) => {
    try {
        const { id } = req.params;
        const { fingleId, initialPassword } = req.body;

        if (!fingleId || !fingleId.trim()) {
            return res.status(400).json({ error: 'กรุณาระบุรหัสเครื่องสแกน (FINGLE_ID)' });
        }

        const [dupRows] = await db.query(
            'SELECT ID FROM hr_person WHERE FINGLE_ID = ? AND ID != ?',
            [fingleId.trim(), id]
        );
        if (dupRows.length > 0) {
            return res.status(409).json({ error: 'รหัสเครื่องสแกนนี้ถูกใช้งานโดยพนักงานคนอื่นแล้ว' });
        }

        if (initialPassword) {
            const hash = await hashPassword(initialPassword);
            await db.query(
                'UPDATE hr_person SET FINGLE_ID = ?, HR_PASSWORD_HASH = ? WHERE ID = ?',
                [fingleId.trim(), hash, id]
            );
        } else {
            await db.query('UPDATE hr_person SET FINGLE_ID = ? WHERE ID = ?', [fingleId.trim(), id]);
        }

        res.json({ success: true, message: 'ลงทะเบียนสแกนนิ้วสำเร็จ' });
    } catch (error) {
        console.error('Enroll Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Unenroll an employee from the attendance system (clear FINGLE_ID) — the "delete" action
router.put('/:id/unenroll', async (req, res) => {
    try {
        const { id } = req.params;
        await db.query('UPDATE hr_person SET FINGLE_ID = NULL WHERE ID = ?', [id]);
        res.json({ success: true, message: 'ยกเลิกการลงทะเบียนสำเร็จ' });
    } catch (error) {
        console.error('Unenroll Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Reset an employee's login password
router.put('/:id/reset-password', async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' });
        }

        const hash = await hashPassword(newPassword);
        await db.query('UPDATE hr_person SET HR_PASSWORD_HASH = ? WHERE ID = ?', [hash, id]);

        res.json({ success: true, message: 'ตั้งรหัสผ่านใหม่สำเร็จ' });
    } catch (error) {
        console.error('Reset Password Error:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
