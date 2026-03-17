// /admin/js/auth.js
(function() {
    if (sessionStorage.getItem('isAdmin') !== 'true') {
        const user = prompt('Nhập Tên tài khoản Admin:');
        const pass = prompt('Nhập Mật khẩu:');
        
        // Base64 hash của chuỗi "admin:12345678" là "YWRtaW46MTIzNDU2Nzg="
        // Hàm btoa() chuyển đổi chuỗi utf-8 thành Base64
        if (user && pass && btoa(user + ':' + pass) === 'YWRtaW46MTIzNDU2Nzg=') {
            sessionStorage.setItem('isAdmin', 'true');
        } else {
            alert('Quyền truy cập bị từ chối!');
            window.location.href = '../index.html'; // Chuyển về trang chủ nếu sai
        }
    }
})();
