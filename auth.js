// /auth.js
window.currentUserRole = 'viewer'; // default
window.currentUserEmail = '';

document.addEventListener('DOMContentLoaded', () => {
    const authOverlay = document.getElementById('authOverlay');
    const authEmail = document.getElementById('authEmail');
    const authPassword = document.getElementById('authPassword');
    const authBtn = document.getElementById('authBtn');
    const authErrorMsg = document.getElementById('authErrorMsg');
    const authRemember = document.getElementById('authRemember');
    const logoutBtn = document.getElementById('logoutBtn');

    if (!authOverlay) return;

    // Đợi Firebase initialize
    if (typeof firebase === 'undefined' || !firebase.auth) {
        console.error('Firebase Auth chưa được tải!');
        return;
    }

    const t = {
        vi: {
            title: '🔒 Yêu Cầu Truy Cập',
            desc: 'Vui lòng đăng nhập để truy cập Hệ thống Phân Tích.',
            placeholderEmail: 'Tên đăng nhập...',
            placeholderPass: 'Nhập mật khẩu...',
            error: 'Sai tài khoản hoặc mật khẩu!',
            btn: 'Đăng Nhập',
            switch: '🇨🇳 中文',
            remember: 'Ghi nhớ đăng nhập'
        },
        zh: {
            title: '🔒 访问限制',
            desc: '请输入邮箱和密码以访问数据分析系统。',
            placeholderEmail: '用户名...',
            placeholderPass: '请输入密码...',
            error: '账号或密码不正确！',
            btn: '登录',
            switch: '🇻🇳 Việt',
            remember: '记住密码'
        }
    };

    let currentAuthLang = localStorage.getItem('appLang') || 'zh';

    function renderAuthLang() {
        const d = t[currentAuthLang];
        document.getElementById('authTitle').textContent = d.title;
        document.getElementById('authDesc').textContent = d.desc;
        if (authEmail) authEmail.placeholder = d.placeholderEmail;
        authPassword.placeholder = d.placeholderPass;
        authErrorMsg.textContent = d.error;
        authBtn.textContent = d.btn;
        const sw = document.getElementById('authLangBtn');
        if (sw) sw.textContent = d.switch;
        const rem = document.getElementById('authRememberLabel');
        if (rem) rem.textContent = d.remember;
    }

    renderAuthLang();

    const langBtn = document.getElementById('authLangBtn');
    if (langBtn) {
        langBtn.addEventListener('click', () => {
            currentAuthLang = currentAuthLang === 'zh' ? 'vi' : 'zh';
            localStorage.setItem('appLang', currentAuthLang);
            renderAuthLang();
        });
    }

    // Monitor Auth State
    firebase.auth().onAuthStateChanged(async (user) => {
        if (user) {
            window.currentUserEmail = user.email;
            try {
                // Fetch user role
                const userDoc = await db.collection('users').doc(user.email).get();
                if (userDoc.exists) {
                    window.currentUserRole = userDoc.data().role || 'viewer';
                } else {
                    window.currentUserRole = 'viewer';
                }
            } catch (e) {
                console.error("Error fetching user role:", e);
                window.currentUserRole = 'viewer';
            }
            
            authOverlay.style.display = 'none';

            // Kích hoạt event cho các script khác (ví dụ script.js) biết đã có Auth
            document.dispatchEvent(new CustomEvent('authReady'));

        } else {
            authOverlay.style.display = 'flex';
        }
    });

    async function handleAuth() {
        let email = authEmail ? authEmail.value.trim() : '';
        const password = authPassword.value;

        if (!email || !password) {
            authErrorMsg.textContent = 'Vui lòng nhập đầy đủ tài khoản và mật khẩu!';
            authErrorMsg.style.display = 'block';
            return;
        }

        if (!email.includes('@')) {
            email = email + '@gmail.com';
        }

        authBtn.disabled = true;
        authBtn.innerHTML = '...';

        try {
            const persistence = (authRemember && authRemember.checked) 
                ? firebase.auth.Auth.Persistence.LOCAL 
                : firebase.auth.Auth.Persistence.SESSION;
            
            await firebase.auth().setPersistence(persistence);
            await firebase.auth().signInWithEmailAndPassword(email, password);
            // onAuthStateChanged sẽ tự ẩn form
        } catch (error) {
            console.error("Auth error:", error);
            authErrorMsg.textContent = t[currentAuthLang].error;
            authErrorMsg.style.display = 'block';
        } finally {
            authBtn.disabled = false;
            authBtn.textContent = t[currentAuthLang].btn;
        }
    }

    authBtn.addEventListener('click', handleAuth);
    authPassword.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAuth();
    });
    if (authEmail) {
        authEmail.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleAuth();
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            firebase.auth().signOut().then(() => {
                location.reload();
            });
        });
    }
});
