// Set current date in dashboard
document.addEventListener('DOMContentLoaded', () => {
    // RBAC Session Check
    const userStr = localStorage.getItem('user');
    if (!userStr) {
        window.location.href = '/login.html';
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
    }
});

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
        
    } catch (error) {
        console.error('Error fetching dashboard stats:', error);
    }
}

async function fetchRecentActivity() {
    try {
        const limitSelect = document.getElementById('limit-select');
        const limit = limitSelect ? limitSelect.value : 10;
        
        const response = await fetch(`/api/attendance/recent?limit=${limit}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        
        const tbody = document.getElementById('activity-table');
        if (!tbody) return;
        
        tbody.innerHTML = ''; // Clear mock data
        
        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 2rem; color: var(--text-gray);">ยังไม่มีประวัติการสแกนในวันนี้</td></tr>';
            return;
        }

        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${row.name}</td>
                <td>${row.dept}</td>
                <td>${row.in}</td>
                <td>${row.out}</td>
                <td><span class="status-badge ${row.status}">${row.statusLabel}</span></td>
            `;
            tbody.appendChild(tr);
        });
        
    } catch (error) {
        console.error('Error fetching recent activity:', error);
    }
}

async function recordAttendance(type) {
    try {
        const empId = prompt("กรุณาระบุรหัสพนักงานของคุณ:");
        if (!empId) return;

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
            
            // Auto refresh the dashboard data after successful attendance record
            fetchDashboardData();
            fetchRecentActivity();
        } else {
            alert(`❌ เกิดข้อผิดพลาดจากฐานข้อมูล:\n${data.error}`);
        }
    } catch (error) {
        console.error('Error recording attendance:', error);
        alert('❌ ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
    }
}
