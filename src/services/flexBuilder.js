/**
 * LINE Flex Message Builder for Attendance System
 * Generates modern, hospital-branded LINE Flex Messages for Check-in & Check-out actions.
 */

function getLocalNetworkUrl() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return `http://${net.address}:${process.env.PORT || 3004}`;
      }
    }
  }
  return `http://localhost:${process.env.PORT || 3004}`;
}

/**
 * Generates a Smart LINE Flex Message with Time-window Auto Check (05:00-12:00 Check-In, 13:00-20:00 Check-Out).
 */
function buildCheckInCheckOutFlex(params = {}) {
  const baseUrl = params.baseUrl || process.env.SYSTEM_URL || getLocalNetworkUrl();
  const empId = params.empId || '';
  const fullname = params.fullname || 'บุคลากรโรงพยาบาล';

  const autoCheckUrl = `${baseUrl}/api/attendance/quick-record?type=check${empId ? `&empId=${encodeURIComponent(empId)}` : ''}`;
  const checkInUrl = `${baseUrl}/api/attendance/quick-record?type=check-in${empId ? `&empId=${encodeURIComponent(empId)}` : ''}`;
  const checkOutUrl = `${baseUrl}/api/attendance/quick-record?type=check-out${empId ? `&empId=${encodeURIComponent(empId)}` : ''}`;

  return {
    type: 'flex',
    altText: '🏥 บันทึกเวลาปฏิบัติงาน (Smart Attendance System)',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#0077B6',
        paddingTop: '20px',
        paddingBottom: '20px',
        paddingStart: '20px',
        paddingEnd: '20px',
        contents: [
          {
            type: 'text',
            text: 'HOSPITAL ATTENDANCE SYSTEM',
            color: '#CAF0F8',
            size: 'xxs',
            weight: 'bold',
            align: 'center'
          },
          {
            type: 'text',
            text: 'ระบบลงเวลาปฏิบัติงาน',
            color: '#FFFFFF',
            size: 'xl',
            weight: 'bold',
            margin: 'xs',
            align: 'center'
          },
          {
            type: 'text',
            text: 'กดปุ่มเพื่อบันทึกเวลาตามช่วงเวลาอัตโนมัติ',
            color: '#E0F2FE',
            size: 'xs',
            margin: 'xs',
            align: 'center'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '20px',
        contents: [
          // User Info Box
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'md',
            alignItems: 'center',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                width: '46px',
                height: '46px',
                cornerRadius: '23px',
                backgroundColor: '#0077B6',
                alignItems: 'center',
                justifyContent: 'center',
                contents: [
                  {
                    type: 'text',
                    text: '🏥',
                    size: 'lg',
                    align: 'center'
                  }
                ]
              },
              {
                type: 'box',
                layout: 'vertical',
                flex: 1,
                contents: [
                  {
                    type: 'text',
                    text: fullname,
                    weight: 'bold',
                    size: 'md',
                    color: '#0F172A',
                    wrap: true
                  },
                  {
                    type: 'text',
                    text: empId ? `รหัสพนักงาน: ${empId}` : 'ระบบลงเวลาบุคลากรออนไลน์',
                    size: 'xs',
                    color: '#64748B',
                    margin: 'xs'
                  }
                ]
              }
            ]
          },
          {
            type: 'separator',
            margin: 'lg',
            color: '#E2E8F0'
          },
          // Time Schedule Information Box
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            backgroundColor: '#F8FAFC',
            borderColor: '#E2E8F0',
            borderWidth: '1px',
            cornerRadius: '12px',
            paddingAll: '14px',
            contents: [
              {
                type: 'text',
                text: '⏰ เงื่อนไขการลงเวลาอัตโนมัติ:',
                color: '#334155',
                weight: 'bold',
                size: 'xs',
                margin: 'none'
              },
              {
                type: 'box',
                layout: 'horizontal',
                margin: 'sm',
                contents: [
                  { type: 'text', text: '🌅 05:00 - 12:00 น.', size: 'xs', color: '#047857', weight: 'bold', flex: 6 },
                  { type: 'text', text: '🟢 Check-In เข้างาน', size: 'xs', color: '#047857', align: 'end', flex: 6 }
                ]
              },
              {
                type: 'box',
                layout: 'horizontal',
                margin: 'xs',
                contents: [
                  { type: 'text', text: '🌇 13:00 - 20:00 น.', size: 'xs', color: '#BE123C', weight: 'bold', flex: 6 },
                  { type: 'text', text: '🔴 Check-Out ออกงาน', size: 'xs', color: '#BE123C', align: 'end', flex: 6 }
                ]
              }
            ]
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '20px',
        contents: [
          // Primary Smart Auto Button
          {
            type: 'button',
            action: {
              type: 'uri',
              label: '⚡ กดลงเวลาปฏิบัติงาน (Auto Check)',
              uri: autoCheckUrl
            },
            style: 'primary',
            color: '#0077B6',
            height: 'md'
          },
          // Manual Fallback Buttons
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'sm',
            margin: 'sm',
            contents: [
              {
                type: 'button',
                action: {
                  type: 'uri',
                  label: '🟢 เข้างาน',
                  uri: checkInUrl
                },
                style: 'secondary',
                color: '#0D9488',
                height: 'sm',
                flex: 1
              },
              {
                type: 'button',
                action: {
                  type: 'uri',
                  label: '🔴 ออกงาน',
                  uri: checkOutUrl
                },
                style: 'secondary',
                color: '#E11D48',
                height: 'sm',
                flex: 1
              }
            ]
          }
        ]
      }
    }
  };
}

/**
 * Builds a Flex Message Notification Card when check-in/out succeeds.
 */
function buildAttendanceLogFlex(params = {}) {
  const {
    fullname = 'ไม่ระบุชื่อ',
    empId = '-',
    type = 'check-in',
    timeStr = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    dateStr = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
  } = params;

  const isCheckIn = type === 'check-in';
  const headerBg = isCheckIn ? '#0D9488' : '#E11D48';
  const headerText = isCheckIn ? 'สแกนเข้างานสำเร็จ (Check-In)' : 'สแกนออกงานสำเร็จ (Check-Out)';
  const statusIcon = isCheckIn ? '✅' : '📤';

  return {
    type: 'flex',
    altText: `บันทึกเวลาสำเร็จ: ${headerText}`,
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: headerBg,
        paddingAll: '20px',
        contents: [
          {
            type: 'text',
            text: 'ATTENDANCE NOTIFICATION',
            color: '#FFFFFF',
            size: 'xxs',
            weight: 'bold',
            align: 'center'
          },
          {
            type: 'text',
            text: headerText,
            color: '#FFFFFF',
            size: 'lg',
            weight: 'bold',
            margin: 'xs',
            align: 'center'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '20px',
        contents: [
          {
            type: 'text',
            text: `${statusIcon} บันทึกข้อมูลลงระบบเรียบร้อยแล้ว`,
            weight: 'bold',
            size: 'sm',
            color: '#0F172A',
            align: 'center'
          },
          {
            type: 'separator',
            margin: 'lg',
            color: '#E2E8F0'
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            spacing: 'sm',
            contents: [
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: '👤 ชื่อ-นามสกุล', size: 'xs', color: '#64748B', flex: 4 },
                  { type: 'text', text: fullname, size: 'xs', color: '#0F172A', weight: 'bold', flex: 6, align: 'end' }
                ]
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: '🆔 รหัสพนักงาน', size: 'xs', color: '#64748B', flex: 4 },
                  { type: 'text', text: String(empId), size: 'xs', color: '#0F172A', weight: 'bold', flex: 6, align: 'end' }
                ]
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: '📅 วันที่', size: 'xs', color: '#64748B', flex: 4 },
                  { type: 'text', text: dateStr, size: 'xs', color: '#0F172A', weight: 'bold', flex: 6, align: 'end' }
                ]
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: '⏰ เวลา', size: 'xs', color: '#64748B', flex: 4 },
                  { type: 'text', text: `${timeStr} น.`, size: 'xs', color: '#0F172A', weight: 'bold', flex: 6, align: 'end' }
                ]
              }
            ]
          }
        ]
      }
    }
  };
}

/**
 * Builds a Flex Message Card confirming registration success.
 */
function buildRegistrationSuccessFlex(params = {}) {
  const baseUrl = params.baseUrl || process.env.SYSTEM_URL || getLocalNetworkUrl();
  const {
    fullname = 'ไม่ระบุชื่อ',
    empId = '-',
    cid = '-'
  } = params;

  const autoCheckUrl = `${baseUrl}/api/attendance/quick-record?type=check${empId ? `&empId=${encodeURIComponent(empId)}` : ''}`;
  const checkInUrl = `${baseUrl}/api/attendance/quick-record?type=check-in${empId ? `&empId=${encodeURIComponent(empId)}` : ''}`;
  const checkOutUrl = `${baseUrl}/api/attendance/quick-record?type=check-out${empId ? `&empId=${encodeURIComponent(empId)}` : ''}`;

  return {
    type: 'flex',
    altText: '✅ ลงทะเบียนสำเร็จ! กดลงเวลาปฏิบัติงานได้ทันที',
    contents: {
      type: 'bubble',
      size: 'mega',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: '#06C755',
        paddingAll: '20px',
        contents: [
          {
            type: 'text',
            text: 'LINE USER REGISTRATION',
            color: '#FFFFFF',
            size: 'xxs',
            weight: 'bold',
            align: 'center'
          },
          {
            type: 'text',
            text: 'ผูกบัญชี LINE สำเร็จแล้ว!',
            color: '#FFFFFF',
            size: 'lg',
            weight: 'bold',
            margin: 'xs',
            align: 'center'
          }
        ]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '20px',
        contents: [
          {
            type: 'text',
            text: '🎉 ยินดีต้อนรับสู่ระบบลงเวลาบุคลากร',
            weight: 'bold',
            size: 'sm',
            color: '#0F172A',
            align: 'center'
          },
          {
            type: 'separator',
            margin: 'lg',
            color: '#E2E8F0'
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            spacing: 'sm',
            contents: [
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: '👤 ชื่อ-นามสกุล', size: 'xs', color: '#64748B', flex: 4 },
                  { type: 'text', text: fullname, size: 'xs', color: '#0F172A', weight: 'bold', flex: 6, align: 'end' }
                ]
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: '🆔 รหัสพนักงาน', size: 'xs', color: '#64748B', flex: 4 },
                  { type: 'text', text: String(empId), size: 'xs', color: '#0F172A', weight: 'bold', flex: 6, align: 'end' }
                ]
              },
              {
                type: 'box',
                layout: 'horizontal',
                contents: [
                  { type: 'text', text: '🪪 เลขบัตรประชาชน', size: 'xs', color: '#64748B', flex: 4 },
                  { type: 'text', text: `${String(cid).slice(0,3)}-XXXXX-${String(cid).slice(-3)}`, size: 'xs', color: '#0F172A', weight: 'bold', flex: 6, align: 'end' }
                ]
              }
            ]
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '20px',
        contents: [
          {
            type: 'button',
            action: {
              type: 'uri',
              label: '⚡ กดลงเวลาปฏิบัติงาน (Auto Check)',
              uri: autoCheckUrl
            },
            style: 'primary',
            color: '#0077B6',
            height: 'md'
          },
          {
            type: 'box',
            layout: 'horizontal',
            spacing: 'sm',
            margin: 'sm',
            contents: [
              {
                type: 'button',
                action: {
                  type: 'uri',
                  label: '🟢 เข้างาน',
                  uri: checkInUrl
                },
                style: 'secondary',
                color: '#0D9488',
                height: 'sm',
                flex: 1
              },
              {
                type: 'button',
                action: {
                  type: 'uri',
                  label: '🔴 ออกงาน',
                  uri: checkOutUrl
                },
                style: 'secondary',
                color: '#E11D48',
                height: 'sm',
                flex: 1
              }
            ]
          }
        ]
      }
    }
  };
}

module.exports = {
  buildCheckInCheckOutFlex,
  buildAttendanceLogFlex,
  buildRegistrationSuccessFlex
};
