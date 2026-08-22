const express = require('express');
const router = express.Router();
const db = require('../config/db');
const flexBuilder = require('../services/flexBuilder');
const lineService = require('../services/lineService');
const { initAttendancePersonTable } = require('../services/dbInit');

/**
 * Helper to resolve Employee Info from Attendance_person table by LINE User ID or Employee ID
 */
async function getEmployeeInfo(lineUserId, fallbackEmpId = '') {
  await initAttendancePersonTable();

  let fullname = 'บุคลากรโรงพยาบาล';
  let matchedEmpId = fallbackEmpId || lineUserId;
  let cid = '';
  let isRegistered = false;

  try {
    // 1. Query Attendance_person by LINE User ID first
    let [rows] = await db.query(
      `SELECT fname, lname, emp_id, cid FROM Attendance_person WHERE line_id = ? AND status = 'active' LIMIT 1`,
      [lineUserId]
    );

    // 2. Fallback to emp_id or cid if provided
    if (rows.length === 0 && fallbackEmpId) {
      [rows] = await db.query(
        `SELECT fname, lname, emp_id, cid FROM Attendance_person WHERE emp_id = ? OR cid = ? LIMIT 1`,
        [fallbackEmpId, fallbackEmpId]
      );
    }

    if (rows.length > 0) {
      const emp = rows[0];
      fullname = `${emp.fname || ''} ${emp.lname || ''}`.trim();
      matchedEmpId = emp.emp_id || emp.cid || matchedEmpId;
      cid = emp.cid || '';
      isRegistered = true;
    }
  } catch (err) {
    console.warn('⚠️ Could not query Attendance_person:', err.message);
  }

  return { fullname, empId: matchedEmpId, cid, isRegistered };
}

/**
 * Handles 13-digit Citizen ID Registration using Attendance_person table
 */
async function registerEmployeeByCid(rawCid, lineUserId) {
  await initAttendancePersonTable();
  const cleanCid = String(rawCid).replace(/[^0-9]/g, '');

  if (cleanCid.length !== 13) {
    return { success: false, message: 'เลขบัตรประชาชนต้องมี 13 หลัก' };
  }

  try {
    // 1. Check Attendance_person first
    let [rows] = await db.query(
      `SELECT id, fname, lname, emp_id, cid FROM Attendance_person WHERE cid = ? LIMIT 1`,
      [cleanCid]
    );

    // 2. Fallback: If not yet in Attendance_person, check hr_person and import to Attendance_person
    if (rows.length === 0) {
      try {
        const [hrRows] = await db.query(
          `SELECT HR_CID, FINGLE_ID, HR_FNAME, HR_LNAME, HR_DEPARTMENT_ID FROM hr_person WHERE HR_CID = ? LIMIT 1`,
          [cleanCid]
        );
        if (hrRows.length > 0) {
          const hr = hrRows[0];
          await db.query(
            `INSERT INTO Attendance_person (cid, emp_id, line_id, fname, lname) VALUES (?, ?, ?, ?, ?)`,
            [cleanCid, hr.FINGLE_ID || cleanCid, lineUserId, hr.HR_FNAME || 'ไม่ระบุ', hr.HR_LNAME || '']
          );
          [rows] = await db.query(
            `SELECT id, fname, lname, emp_id, cid FROM Attendance_person WHERE cid = ? LIMIT 1`,
            [cleanCid]
          );
        }
      } catch (hrErr) {
        console.warn('⚠️ hr_person fallback check error:', hrErr.message);
      }
    }

    if (rows.length === 0) {
      return { success: false, message: `ไม่พบเลขบัตรประชาชน ${cleanCid} ในระบบบุคลากร` };
    }

    const emp = rows[0];
    const fullname = `${emp.fname || ''} ${emp.lname || ''}`.trim();
    const empId = emp.emp_id || cleanCid;

    // 3. Save LINE User ID into Attendance_person table
    await db.query(
      `UPDATE Attendance_person SET line_id = ? WHERE cid = ?`,
      [lineUserId, cleanCid]
    );

    console.log(`✅ Bound LINE User ID ${lineUserId} to Attendance_person CID ${cleanCid} (${fullname})`);

    return {
      success: true,
      fullname,
      empId,
      cid: cleanCid
    };
  } catch (err) {
    console.error('❌ Registration error in Attendance_person:', err);
    return { success: false, message: 'เกิดข้อผิดพลาดจากฐานข้อมูลในการบันทึก' };
  }
}

/**
 * Handle incoming LINE Webhook events
 */
router.post('/webhook', async (req, res) => {
  const events = req.body.events;
  if (!events || !Array.isArray(events)) {
    return res.status(200).send('OK');
  }

  // Acknowledge LINE Webhook server immediately
  res.status(200).send('OK');

  for (const event of events) {
    try {
      const lineUserId = event.source ? event.source.userId : null;

      if (event.type === 'message' && event.message.type === 'text') {
        const text = (event.message.text || '').trim();
        const cleanText = text.replace(/[^0-9]/g, '');

        // 1. Check if user typed a 13-digit Citizen ID
        if (cleanText.length === 13) {
          const regResult = await registerEmployeeByCid(cleanText, lineUserId);
          if (regResult.success) {
            // Reply with Registration Success Card
            const regFlex = flexBuilder.buildRegistrationSuccessFlex({
              fullname: regResult.fullname,
              empId: regResult.empId,
              cid: regResult.cid
            });
            await lineService.replyMessage(event.replyToken, regFlex);

            // Follow up with Attendance Card
            const attendanceFlex = flexBuilder.buildCheckInCheckOutFlex({
              empId: regResult.empId,
              fullname: regResult.fullname
            });
            await lineService.pushMessage(lineUserId, attendanceFlex);
          } else {
            await lineService.replyMessage(event.replyToken, {
              type: 'text',
              text: `❌ ${regResult.message}\n\nกรุณาตรวจสอบเลขบัตรประชาชน 13 หลักของท่าน และพิมพ์ใหม่อีกครั้งครับ`
            });
          }
          continue;
        }

        // 2. Explicit Registration Prompt
        if (text.includes('ลงทะเบียน') || text.includes('ผูกบัญชี') || text.includes('register')) {
          await lineService.replyMessage(event.replyToken, {
            type: 'text',
            text: '📝 กรุณาพิมพ์ "เลขบัตรประชาชน 13 หลัก" ของท่านส่งมาในแชทนี้ (เช่น 1100100200300) เพื่อผูกบัญชี LINE กับระบบบุคลากรครับ'
          });
          continue;
        }

        // 3. Keywords to trigger Attendance Flex Card
        const lower = text.toLowerCase();
        if (lower.includes('ลงเวลา') || lower.includes('สแกน') || lower.includes('เข้างาน') || lower.includes('ออกงาน') || lower.includes('check') || lower.includes('menu') || lower.includes('เมนู')) {
          const empInfo = await getEmployeeInfo(lineUserId);

          if (!empInfo.isRegistered) {
            await lineService.replyMessage(event.replyToken, {
              type: 'text',
              text: '⚠️ ท่านยังไม่ได้ลงทะเบียนใช้งาน LINE\n\nกรุณาพิมพ์ "เลขบัตรประชาชน 13 หลัก" ของท่านส่งมาในแชทนี้ เพื่อผูกบัญชีผู้ใช้งานก่อนครับ'
            });
          } else {
            const flexMessage = flexBuilder.buildCheckInCheckOutFlex({
              empId: empInfo.empId,
              fullname: empInfo.fullname
            });
            await lineService.replyMessage(event.replyToken, flexMessage);
          }
        }
      } 
      else if (event.type === 'postback') {
        const postbackData = event.postback.data || '';
        const params = new URLSearchParams(postbackData);
        const action = params.get('action') || 'check';
        
        // Resolve Employee Info by LINE User ID from Attendance_person
        const empInfo = await getEmployeeInfo(lineUserId, params.get('empId'));

        let attendanceType = action;
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        // Smart Time Window Auto Detection
        if (action === 'check' || action === 'auto') {
          if (currentMinutes >= 300 && currentMinutes <= 720) {
            // 05:00 - 12:00 -> Check-In
            attendanceType = 'check-in';
          } else if (currentMinutes >= 780 && currentMinutes <= 1200) {
            // 13:00 - 20:00 -> Check-Out
            attendanceType = 'check-out';
          } else {
            // Outside time windows -> Auto-detect based on last scan today
            try {
              const [lastRows] = await db.query(
                `SELECT AttendanceStatus FROM hikvision WHERE EmployeeID = ? AND AccessDate = CURDATE() ORDER BY AccessDateandTime DESC LIMIT 1`,
                [empInfo.empId]
              );
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

        // 1. Get next CardNumber
        let nextCardNumberStr = '18446744073609551962';
        try {
          const [cardRows] = await db.query(`SELECT CardNumber FROM hikvision ORDER BY CAST(CardNumber AS UNSIGNED) DESC LIMIT 1`);
          if (cardRows.length > 0 && cardRows[0].CardNumber) {
            const currentMax = BigInt(cardRows[0].CardNumber);
            nextCardNumberStr = (currentMax + 1n).toString();
          }
        } catch (dbErr) {
          console.warn('Warning: Could not fetch max CardNumber:', dbErr.message);
        }

        // 2. Insert record into database under Employee ID
        const insertQuery = `
          INSERT INTO hikvision (
            EmployeeID, AccessDateandTime, AccessDate, AccessTime, 
            AuthenticationResult, AuthenticationType, DeviceName, DeviceSerialNo, 
            ReaderName, FirstName, LastName, PersonName, PersonGroup, 
            CardNumber, Direction, SkinSurfaceTemperature, TemperatureStatus, 
            AttendanceStatus, is_notified
          ) VALUES (
            ?, DATE_FORMAT(NOW(), '%Y-%m-%dT%T'), CURDATE(), CURTIME(), 
            'Success', 'ACSEventFaceVerifyPass', 'LINE Webhook Bot', 'AX6425372', 
            'LINE Messaging API', NULL, NULL, NULL, NULL, 
            ?, 'in', '', 'Unknown', 
            ?, 0
          )
        `;
        await db.query(insertQuery, [empInfo.empId, nextCardNumberStr, attendanceStatus]);

        // 3. Send Confirmation Flex Card back to LINE Chat
        const successFlex = flexBuilder.buildAttendanceLogFlex({
          fullname: empInfo.fullname,
          empId: empInfo.empId,
          type: attendanceType
        });

        await lineService.replyMessage(event.replyToken, successFlex);
      }
    } catch (err) {
      console.error('❌ LINE Webhook Event Error:', err);
    }
  }
});

module.exports = router;
