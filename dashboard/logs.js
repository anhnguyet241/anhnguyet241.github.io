// dashboard/logs.js

document.addEventListener('DOMContentLoaded', () => {
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            window.currentUserEmail = user.email;
            try {
                const userDoc = await db.collection('users').doc(user.email).get();
                if (userDoc.exists) {
                    window.currentUserRole = userDoc.data().role || 'viewer';
                    
                    if (window.currentUserRole !== 'admin') {
                        alert('Bạn không có quyền truy cập trang này!');
                        window.location.href = 'index.html';
                        return;
                    }

                    // Là Admin thì load logs
                    fetchAndRenderLogs();
                } else {
                    alert('Tài khoản chưa được phân quyền!');
                    window.location.href = 'index.html';
                }
            } catch (err) {
                console.error("Lỗi lấy role:", err);
            }
        } else {
            // Chưa đăng nhập thì cũng đá ra ngoài
            window.location.href = 'index.html';
        }
    });
});

async function fetchAndRenderLogs() {
    const tbody = document.getElementById('logsTbody');
    
    try {
        // Query 100 mới nhất
        const snapshot = await db.collection('audit_logs')
            .orderBy('timestamp', 'desc')
            .limit(100)
            .get();

        if (snapshot.empty) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #64748b; padding: 20px;">Chưa có bản ghi hoạt động nào.</td></tr>`;
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            html += renderLogRow(data);
        });

        tbody.innerHTML = html;

    } catch (err) {
        console.error('Error fetching logs:', err);
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #f43f5e; padding: 20px;">Lỗi tải dữ liệu: ${err.message}</td></tr>`;
    }
}

function renderLogRow(data) {
    // Format Time
    let timeStr = 'N/A';
    if (data.timestamp) {
        const d = data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        timeStr = `<span style="color:#94a3b8; font-size:13px;">${hours}:${mins}</span> <span style="font-weight:500;">${day}/${month}</span>`;
    }

    // Format User
    const email = data.userEmail || 'unknown';
    const username = email.split('@')[0];
    const role = data.role || '';
    const userHtml = `<span style="color:#e2e8f0; font-weight:600;">${username}</span> <span class="role-badge">${role}</span>`;

    // Format Action & Details
    const action = data.action || 'UNKNOWN';
    let actionHtml = '';
    let detailHtml = '';

    switch (action) {
        case 'ADD_CUSTOMER':
            actionHtml = `<span class="tag tag-add"><i class="fas fa-plus"></i> Thêm Khách Hàng</span>`;
            detailHtml = `Thêm khách hàng <strong>${data.customerCode || ''}</strong> (${data.customerName || ''}) vào nhân viên <strong>${data.staff || ''}</strong> (Sheet: ${data.month || ''})`;
            break;
            
        case 'UPDATE_DAILY_VOL':
            actionHtml = `<span class="tag tag-update"><i class="fas fa-edit"></i> Cập Nhật Sản Lượng</span>`;
            detailHtml = `Sửa sản lượng ngày <strong>${data.day}/${data.monthKey}</strong> của khách <strong>${data.customerCode}</strong>: 
                          <span style="color:#94a3b8; text-decoration:line-through;">${data.oldValue}</span> ➡️ <strong style="color:#3b82f6;">${data.newValue}</strong>`;
            break;

        case 'UPDATE_CUSTOMER':
            actionHtml = `<span class="tag tag-update"><i class="fas fa-user-edit"></i> Sửa Thông Tin Khách</span>`;
            detailHtml = `Sửa khách hàng <strong>${data.oldCustomerCode || ''}</strong> thành: Mã <strong style="color:#3b82f6;">${data.newCustomerCode || ''}</strong>, Tên <strong style="color:#3b82f6;">${data.newCustomerName || ''}</strong>, Thẻ <strong style="color:#3b82f6;">${data.newCardType || ''}</strong>`;
            break;

        case 'DELETE_CUSTOMER':
            actionHtml = `<span class="tag tag-delete"><i class="fas fa-trash"></i> Xóa Khách Hàng</span>`;
            detailHtml = `Xóa khách hàng <strong>${data.customerCode || ''}</strong> khỏi máy <strong>${data.machineId || ''}</strong>`;
            break;

        case 'CREATE_USER':
            actionHtml = `<span class="tag tag-add"><i class="fas fa-user-plus"></i> Tạo Tài Khoản</span>`;
            detailHtml = `Tạo tài khoản <strong>${data.targetEmail?.split('@')[0] || ''}</strong> với quyền <strong>${data.targetRole || ''}</strong>`;
            break;
            
        case 'UPDATE_USER_ROLE':
            actionHtml = `<span class="tag tag-role"><i class="fas fa-user-tag"></i> Đổi Quyền</span>`;
            detailHtml = `Đổi quyền tài khoản <strong>${data.targetEmail?.split('@')[0] || ''}</strong> thành <strong>${data.newRole || ''}</strong>`;
            break;

        case 'DELETE_USER':
            actionHtml = `<span class="tag tag-delete"><i class="fas fa-user-minus"></i> Xóa Tài Khoản</span>`;
            detailHtml = `Xóa tài khoản <strong>${data.targetEmail?.split('@')[0] || ''}</strong> (Soft delete)`;
            break;

        case 'RESTORE_USER':
            actionHtml = `<span class="tag tag-add"><i class="fas fa-user-check"></i> Khôi Phục Tài Khoản</span>`;
            detailHtml = `Khôi phục tài khoản <strong>${data.targetEmail?.split('@')[0] || ''}</strong> với quyền <strong>${data.newRole || ''}</strong>`;
            break;

        default:
            actionHtml = `<span class="tag tag-other">${action}</span>`;
            detailHtml = JSON.stringify(data);
    }

    return `
        <tr>
            <td>${timeStr}</td>
            <td>${userHtml}</td>
            <td>${actionHtml}</td>
            <td style="color:#cbd5e1; line-height:1.5;">${detailHtml}</td>
        </tr>
    `;
}
