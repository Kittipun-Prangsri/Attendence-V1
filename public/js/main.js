// Set current date in dashboard
document.addEventListener('DOMContentLoaded', () => {
    // RBAC Session Check
    const userStr = localStorage.getItem('user');
    if (!userStr) {
        window.location.href = '/pages/login.html';
        return;
    }
    
    const user = JSON.parse(userStr);
    
    // Update Header Profile
    const profileName = document.getElementById('profile-name');
    const profileRole = document.getElementById('profile-role');
    if (profileName) profileName.textContent = user.name;
    if (profileRole) profileRole.textContent = user.role === 'SUPER' ? 'ผู้ดูแลระบบ (Admin)' : 'พนักงาน (User)';
    
    // Enforce Role Restrictions
    if (user.role !== 'SUPER') {
        // Hide stats cards
        const statsRow = document.querySelector('.stats-row');
        if (statsRow) statsRow.style.display = 'none';
        
        // Hide recent activity table
        const recentActivity = document.querySelector('.recent-activity');
        if (recentActivity) recentActivity.style.display = 'none';

        // Hide latest-activity widget & chart
        const latestChartRow = document.getElementById('latest-chart-row');
        if (latestChartRow) latestChartRow.style.display = 'none';

        // Hide department breakdown chart
        const deptChartCard = document.getElementById('dept-chart-card');
        if (deptChartCard) deptChartCard.style.display = 'none';

        // Hide extra sidebar menus (Keep Dashboard and Logout)
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            const text = item.textContent.trim();
            if (!text.includes('หน้าหลัก') && !text.includes('ออกจากระบบ')) {
                item.style.display = 'none';
            }
        });
    }

    const dateElement = document.getElementById('current-date');
    if (dateElement) {
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const today = new Date();
        // Use Thai locale for formatting
        dateElement.textContent = today.toLocaleDateString('th-TH', options);
    }
    
    // Fetch real data from API only if SUPER
    if (user.role === 'SUPER') {
        fetchDashboardData();
        fetchRecentActivity();
        fetchLatestActivity();
        fetchDepartmentStats();
    }
});

let attendanceChart = null;
let departmentChart = null;

async function fetchDashboardData() {
    try {
        const lateTimeInput = document.getElementById('late-time-input');
        const lateTime = lateTimeInput ? lateTimeInput.value : '08:30';

        const response = await fetch(`/api/dashboard/stats?lateTime=${lateTime}`);
        const data = await response.json();

        // Update DOM elements
        document.getElementById('stat-total').textContent = data.total || 0;
        document.getElementById('stat-present').textContent = data.present || 0;
        document.getElementById('stat-late').textContent = data.late || 0;
        document.getElementById('stat-absent').textContent = data.absent || 0;

        renderAttendanceChart(data);

    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
    }
}

function renderAttendanceChart(data) {
    const canvas = document.getElementById('attendance-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    const total = data.total || 0;
    const present = data.present || 0;
    const late = data.late || 0;
    const absent = data.absent || 0;
    const onTime = Math.max(present - late, 0);
    const notYet = Math.max(total - present - absent, 0);

    const chartData = {
        labels: ['มาตรงเวลา', 'มาสาย', 'ขาด/ลา', 'ยังไม่มาปฏิบัติงาน'],
        datasets: [{
            data: [onTime, late, absent, notYet],
            backgroundColor: ['#2a9d8f', '#e9c46a', '#e63946', '#cbd5e1'],
            borderWidth: 3,
            borderColor: 'rgba(255,255,255,0.6)',
            hoverOffset: 8
        }]
    };

    if (attendanceChart) {
        attendanceChart.data = chartData;
        attendanceChart.update();
        return;
    }

    attendanceChart = new Chart(canvas, {
        type: 'doughnut',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '65%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { font: { family: 'Prompt' }, padding: 16, usePointStyle: true }
                }
            }
        }
    });
}

async function fetchDepartmentStats() {
    try {
        const lateTimeInput = document.getElementById('late-time-input');
        const lateTime = lateTimeInput ? lateTimeInput.value : '08:30';

        const response = await fetch(`/api/dashboard/department-stats?lateTime=${encodeURIComponent(lateTime)}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();

        renderDepartmentChart(data);
    } catch (error) {
        console.error('Error fetching department stats:', error);
    }
}

function renderDepartmentChart(data) {
    const canvas = document.getElementById('department-chart');
    if (!canvas || typeof Chart === 'undefined') return;

    const chartData = {
        labels: data.map(d => d.department),
        datasets: [
            { label: 'มาตรงเวลา', data: data.map(d => d.onTime), backgroundColor: '#2a9d8f', stack: 'attendance' },
            { label: 'มาสาย', data: data.map(d => d.late), backgroundColor: '#e9c46a', stack: 'attendance' },
            { label: 'ยังไม่มาปฏิบัติงาน', data: data.map(d => d.notYet), backgroundColor: '#cbd5e1', stack: 'attendance' }
        ]
    };

    if (departmentChart) {
        departmentChart.data = chartData;
        departmentChart.update();
        return;
    }

    departmentChart = new Chart(canvas, {
        type: 'bar',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true, ticks: { font: { family: 'Prompt' } } },
                y: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { font: { family: 'Prompt' }, padding: 16, usePointStyle: true }
                }
            }
        }
    });
}

async function fetchLatestActivity() {
    try {
        const response = await fetch('/api/attendance/latest?limit=5');
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();

        const list = document.getElementById('latest-list');
        if (!list) return;

        list.innerHTML = '';

        if (data.length === 0) {
            const li = document.createElement('li');
            li.style.cssText = 'text-align: center; color: var(--text-gray); padding: 1rem 0;';
            li.textContent = 'ยังไม่มีการลงเวลาวันนี้';
            list.appendChild(li);
            return;
        }

        data.forEach(item => {
            const li = document.createElement('li');
            li.className = 'latest-item';

            const avatar = document.createElement('div');
            avatar.className = `latest-avatar ${item.type === 'check-in' ? 'in' : 'out'}`;
            avatar.innerHTML = item.type === 'check-in'
                ? '<i class="fa-solid fa-right-to-bracket"></i>'
                : '<i class="fa-solid fa-right-from-bracket"></i>';

            const info = document.createElement('div');
            info.className = 'latest-info';

            const name = document.createElement('div');
            name.className = 'latest-name';
            name.textContent = item.name;

            const dept = document.createElement('div');
            dept.className = 'latest-dept';
            dept.textContent = item.dept;

            info.appendChild(name);
            info.appendChild(dept);

            const time = document.createElement('div');
            time.className = 'latest-time';
            time.textContent = item.time || '-';

            li.appendChild(avatar);
            li.appendChild(info);
            li.appendChild(time);
            list.appendChild(li);
        });

    } catch (error) {
        console.error('Error fetching latest activity:', error);
    }
}

async function fetchRecentActivity() {
    try {
        const limitSelect = document.getElementById('limit-select');
        const limit = limitSelect ? limitSelect.value : 10;

        const response = await fetch(`/api/attendance/recent?limit=${encodeURIComponent(limit)}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();

        const tbody = document.getElementById('activity-table');
        if (!tbody) return;

        tbody.innerHTML = ''; // Clear previous rows

        if (data.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 6;
            td.style.cssText = 'text-align: center; padding: 2rem; color: var(--text-gray);';
            td.textContent = 'ไม่พบข้อมูลบุคลากร';
            tr.appendChild(td);
            tbody.appendChild(tr);
            return;
        }

        data.forEach(row => {
            const tr = document.createElement('tr');

            const cell = (text) => {
                const td = document.createElement('td');
                td.textContent = text;
                return td;
            };

            tr.appendChild(cell(row.name));
            tr.appendChild(cell(row.dept));
            tr.appendChild(cell(row.in));
            tr.appendChild(cell(row.out));

            const statusTd = document.createElement('td');
            const badge = document.createElement('span');
            badge.className = `status-badge ${row.status}`;
            badge.textContent = row.statusLabel;
            statusTd.appendChild(badge);
            tr.appendChild(statusTd);

            const actionsTd = document.createElement('td');
            actionsTd.style.cssText = 'display: flex; gap: 6px;';

            const checkInBtn = document.createElement('button');
            checkInBtn.className = 'btn-mini btn-checkin';
            checkInBtn.title = 'Check-in';
            checkInBtn.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i>';
            checkInBtn.disabled = !row.empId;
            checkInBtn.addEventListener('click', () => recordAttendanceFor(row.empId, row.name, 'check-in'));

            const checkOutBtn = document.createElement('button');
            checkOutBtn.className = 'btn-mini btn-checkout';
            checkOutBtn.title = 'Check-out';
            checkOutBtn.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i>';
            checkOutBtn.disabled = !row.empId;
            checkOutBtn.addEventListener('click', () => recordAttendanceFor(row.empId, row.name, 'check-out'));

            actionsTd.appendChild(checkInBtn);
            actionsTd.appendChild(checkOutBtn);
            tr.appendChild(actionsTd);

            tbody.appendChild(tr);
        });

    } catch (error) {
        console.error('Error fetching recent activity:', error);
    }
}

async function submitAttendance(empId, type) {
    const response = await fetch('/api/attendance/record', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ empId, type })
    });

    const data = await response.json();

    if (response.ok) {
        alert(`✅ บันทึกเวลา ${type === 'check-in' ? 'เข้างาน' : 'ออกงาน'} สำเร็จ!`);
        fetchDashboardData();
        fetchRecentActivity();
        fetchLatestActivity();
        fetchDepartmentStats();
    } else {
        alert(`❌ เกิดข้อผิดพลาดจากฐานข้อมูล:\n${data.error}`);
    }
}

// Self check-in via the top Quick Actions buttons
async function recordAttendance(type) {
    try {
        const empId = prompt("กรุณาระบุรหัสพนักงานของคุณ:");
        if (!empId) return;
        await submitAttendance(empId, type);
    } catch (error) {
        console.error('Error recording attendance:', error);
        alert('❌ ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
    }
}

// Admin recording check-in/out on behalf of a staff member from the staff table
async function recordAttendanceFor(empId, name, type) {
    if (!empId) return;
    const actionLabel = type === 'check-in' ? 'เข้างาน' : 'ออกงาน';
    if (!confirm(`ยืนยันบันทึกเวลา${actionLabel}ให้ "${name}" (${empId}) ?`)) return;

    try {
        await submitAttendance(empId, type);
    } catch (error) {
        console.error('Error recording attendance:', error);
        alert('❌ ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
    }
}
