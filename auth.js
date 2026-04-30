// Xác thực mật khẩu SHA-256
const targetHash = 'c167895c2cf9ec84a04501b1d45e247109809140cf23ed6fb231a37a783dcb67';

async function verifyAuth(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex === targetHash;
}

document.addEventListener('DOMContentLoaded', () => {
    const authOverlay = document.getElementById('authOverlay');
    const authPassword = document.getElementById('authPassword');
    const authBtn = document.getElementById('authBtn');
    const authErrorMsg = document.getElementById('authErrorMsg');
    const authRemember = document.getElementById('authRemember');

    if (!authOverlay) return;

    // Check session or local storage
    const isSessionAuth = sessionStorage.getItem('dashboard_auth');
    const isLocalAuth = localStorage.getItem('dashboard_auth');
    if (isSessionAuth === 'true' || isLocalAuth === 'true') {
        authOverlay.style.display = 'none';
        return;
    }

    const t = {
        vi: {
            title: '🔒 Yêu Cầu Truy Cập',
            desc: 'Vui lòng nhập mật khẩu để truy cập Hệ thống Phân Tích.',
            placeholder: 'Nhập mật khẩu...',
            error: 'Mật khẩu không chính xác!',
            btn: 'Đăng Nhập',
            switch: '🇨🇳 中文',
            remember: 'Ghi nhớ mật khẩu'
        },
        zh: {
            title: '🔒 访问限制',
            desc: '请输入密码以访问数据分析系统。',
            placeholder: '请输入密码...',
            error: '密码不正确！',
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
        authPassword.placeholder = d.placeholder;
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

    async function handleAuth() {
        const password = authPassword.value;
        const isValid = await verifyAuth(password);
        if (isValid) {
            if (authRemember && authRemember.checked) {
                localStorage.setItem('dashboard_auth', 'true');
            } else {
                sessionStorage.setItem('dashboard_auth', 'true');
            }
            // Check if page needs reload to adopt potentially changed language
            if (localStorage.getItem('appLang') !== currentAuthLang) {
                location.reload(); 
            } else {
                authOverlay.style.display = 'none';
            }
        } else {
            authErrorMsg.style.display = 'block';
            authPassword.value = '';
        }
    }

    authBtn.addEventListener('click', handleAuth);
    authPassword.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleAuth();
    });
});
