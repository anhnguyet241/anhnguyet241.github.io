// Lấy các element
const createUserBtn = document.getElementById('createUserBtn');
const tbody = document.getElementById('userListTbody');

// Hàm Helper để thao tác DOM ngắn gọn
const $ = (id) => document.getElementById(id);

// Khởi tạo Auth State
document.addEventListener('DOMContentLoaded', () => {
    // Chờ hệ thống xác thực từ firebase (được xử lý trong auth.js)
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            window.currentUserEmail = user.email;
            try {
                const emailLower = user.email.toLowerCase();
                const userDoc = await db.collection('users').doc(emailLower).get();
                if (userDoc.exists) {
                    window.currentUserRole = userDoc.data().role || 'viewer';
                    
                    // Nếu không phải admin, đá ra ngoài
                    if (window.currentUserRole !== 'admin') {
                        document.body.innerHTML = '<h2 style="color:white;text-align:center;margin-top:50px;">Access Denied. Admin only.</h2>';
                        return;
                    }

                    // Là Admin thì load list user
                    loadUserList();
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

async function logAudit(action, data) {
    try {
        if (!window.currentUserEmail) return;
        await db.collection('audit_logs').add({
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            userEmail: window.currentUserEmail,
            role: window.currentUserRole || 'unknown',
            action: action,
            ...data
        });
    } catch (e) {
        console.error("Failed to write audit log:", e);
    }
}

async function loadUserList() {
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;"><i class="fas fa-spinner fa-spin"></i> Đang tải...</td></tr>';
    
    try {
        const snapshot = await db.collection('users').get();
        tbody.innerHTML = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            const email = doc.id;
            const displayEmail = email.split('@')[0];
            const role = data.role || 'viewer';
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="color: white; font-weight: 500;">${displayEmail}</td>
                <td>
                    <select class="role-select" data-email="${email}" style="padding: 8px 12px; border-radius: 6px; background: #334155; color: white; border: 1px solid rgba(255,255,255,0.1); font-size: 13px; outline: none;">
                        <option value="staff" ${role === 'staff' ? 'selected' : ''}>Nhân viên (Staff)</option>
                        <option value="viewer" ${role === 'viewer' ? 'selected' : ''}>Chỉ xem (Viewer)</option>
                        <option value="admin" ${role === 'admin' ? 'selected' : ''}>Quản trị (Admin)</option>
                    </select>
                </td>
                <td style="display: flex; gap: 8px; align-items: center;">
                    <button class="btn-update-role" data-email="${email}" style="padding: 8px 16px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; box-shadow: 0 4px 6px -1px rgba(16,185,129,0.2);">
                        <i class="fas fa-check"></i> Cập nhật
                    </button>
                    ${email !== window.currentUserEmail ? `
                    <button class="btn-delete-user" data-email="${email}" style="padding: 8px 16px; background: rgba(244, 63, 94, 0.1); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.2); border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.2s;" onmouseover="this.style.background='rgba(244, 63, 94, 0.2)'" onmouseout="this.style.background='rgba(244, 63, 94, 0.1)'">
                        <i class="fas fa-trash-alt"></i> Xóa
                    </button>
                    ` : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Event listeners for update buttons
        document.querySelectorAll('.btn-update-role').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const target = e.target.closest('button');
                const email = target.getAttribute('data-email');
                const select = document.querySelector(`.role-select[data-email="${email}"]`);
                const newRole = select.value;
                
                target.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                target.disabled = true;
                
                try {
                    await db.collection('users').doc(email).set({ role: newRole }, { merge: true });
                    logAudit('UPDATE_ROLE', { targetEmail: email, newRole: newRole });
                    alert(`Đã cập nhật quyền cho ${email.split('@')[0]} thành ${newRole}`);
                } catch (err) {
                    alert('Lỗi cập nhật: ' + err.message);
                } finally {
                    target.innerHTML = '<i class="fas fa-check"></i> Cập nhật';
                    target.disabled = false;
                }
            });
        });

        // Event listeners for delete buttons
        document.querySelectorAll('.btn-delete-user').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const target = e.target.closest('button');
                const email = target.getAttribute('data-email');
                const displayEmail = email.split('@')[0];
                
                if (confirm(`Bạn có chắc chắn muốn XÓA nhân viên "${displayEmail}"?\n(Lưu ý: Thao tác này sẽ tước bỏ mọi quyền truy cập dữ liệu của nhân viên này)`)) {
                    target.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                    target.disabled = true;
                    
                    try {
                        await db.collection('users').doc(email).delete();
                        logAudit('DELETE_USER', { targetEmail: email });
                        alert(`Đã xóa nhân viên ${displayEmail} thành công!`);
                        loadUserList(); // Refresh
                    } catch (err) {
                        alert('Lỗi khi xóa: ' + err.message);
                        target.innerHTML = '<i class="fas fa-trash-alt"></i> Xóa';
                        target.disabled = false;
                    }
                }
            });
        });

    } catch (e) {
        console.error("Load users error:", e);
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#f43f5e;">Lỗi tải dữ liệu. Bạn có chắc mình là Admin không?</td></tr>';
    }
}

if (createUserBtn) {
    createUserBtn.addEventListener('click', async () => {
        let email = $('newUserId').value.trim();
        const pass = $('newUserPass').value;
        const role = $('newUserRole').value;
        const errEl = $('newUserError');
        
        if (!email || !pass) {
            errEl.textContent = 'Vui lòng nhập đủ tên đăng nhập và mật khẩu!';
            errEl.style.display = 'block';
            return;
        }

        if (!email.includes('@')) {
            email = email + '@gmail.com';
        }

        if (pass.length < 6) {
            errEl.textContent = 'Mật khẩu phải từ 6 ký tự trở lên!';
            errEl.style.display = 'block';
            return;
        }
        
        errEl.style.display = 'none';
        createUserBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang tạo...';
        createUserBtn.disabled = true;
        
        try {
            // Secondary App Trick
            let secondaryApp;
            const existingApp = firebase.apps.find(app => app.name === 'Secondary');
            if (existingApp) {
                secondaryApp = existingApp;
            } else {
                secondaryApp = firebase.initializeApp(firebaseConfig, 'Secondary');
            }
            
            let isRestored = false;
            try {
                await secondaryApp.auth().createUserWithEmailAndPassword(email, pass);
                await secondaryApp.auth().signOut();
            } catch (authErr) {
                if (authErr.code === 'auth/email-already-in-use') {
                    isRestored = true;
                } else {
                    throw authErr;
                }
            } finally {
                try { await secondaryApp.delete(); } catch(err){}
            }
            
            // Save to Firestore using main app
            const emailLower = email.toLowerCase();
            await db.collection('users').doc(emailLower).set({ role: role });
            
            if (isRestored) {
                logAudit('RESTORE_USER', { targetEmail: email, assignedRole: role });
                alert(`Tài khoản ${email.split('@')[0]} đã từng tồn tại và vừa được KHÔI PHỤC quyền!\n\nLưu ý: Mật khẩu sẽ giữ nguyên là mật khẩu cũ của họ (chứ không phải mật khẩu bạn vừa nhập).`);
            } else {
                logAudit('CREATE_USER', { targetEmail: email, assignedRole: role });
                alert(`Đã tạo mới tài khoản ${email.split('@')[0]} thành công!`);
            }
            
            $('newUserId').value = '';
            $('newUserPass').value = '';
            loadUserList(); // Refresh list
        } catch (e) {
            console.error("Create user error:", e);
            errEl.textContent = 'Lỗi: ' + e.message;
            errEl.style.display = 'block';
        } finally {
            createUserBtn.innerHTML = '<i class="fas fa-plus"></i> Tạo Tài Khoản';
            createUserBtn.disabled = false;
        }
    });
}
