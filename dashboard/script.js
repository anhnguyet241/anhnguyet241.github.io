/* =============================================
   BÁO CÁO PHÂN TÍCH GIAO DỊCH — USER DASHBOARD
   Đọc dữ liệu từ Firestore (admin upload)
   UX tối ưu cho sếp xem: rõ ràng, dễ hiểu
   ============================================= */

// ── State ──
let allSheetsData = {};
let currentSheetData = [];
let dailyHeaders = [];
let sortDirection = {};

// ── Chart Instances ──
let barChartInstance = null;
let pieChartInstance = null;
let radarChartInstance = null;
let polarChartInstance = null;
let trendChartInstance = null;
let compareChartInstance = null;

// ── DOM ──
const $ = id => document.getElementById(id);

// Làm tròn số nguyên khi hiển thị — tránh số lẻ gây nhầm lẫn
const fmt = n => Math.round(n).toLocaleString();
const sheetSelect = $('sheetSelect');
const highThresholdInput = $('highThreshold');
const lowThresholdInput = $('lowThreshold');
const highValLabel = $('highVal');
const lowValLabel = $('lowVal');
const dashboardGrid = $('dashboardGrid');
const splashScreen = $('splashScreen');
const noDataScreen = $('noDataScreen');
const searchInput = $('searchInput');
const filterCategory = $('filterCategory');
const inactiveDaysInput = $('inactiveDays');
const inactiveDaysVal = $('inactiveDaysVal');

// ── Events ──
sheetSelect.addEventListener('change', () => loadSheetData(sheetSelect.value));
highThresholdInput.addEventListener('input', updateThresholds);
lowThresholdInput.addEventListener('input', updateThresholds);
searchInput.addEventListener('input', renderTable);
filterCategory.addEventListener('change', renderTable);
$('btnExport').addEventListener('click', exportReport);
inactiveDaysInput.addEventListener('input', () => {
    inactiveDaysVal.textContent = inactiveDaysInput.value;
    renderInactive();
});

// Sidebar nav
document.querySelectorAll('.nav-item[data-section]').forEach(item => {
    item.addEventListener('click', e => {
        e.preventDefault();
        const sec = item.getAttribute('data-section');
        switchSection(sec);
        window.history.pushState(null, null, '#' + sec);
    });
});

// Xử lý khi back/forward trình duyệt
window.addEventListener('popstate', () => {
    const hash = window.location.hash.substring(1);
    const validSections = ['overview', 'charts', 'table', 'trends', 'compare', 'inactive', 'settings'];
    if (validSections.includes(hash)) {
        switchSection(hash);
    } else if (!hash) {
        switchSection('overview');
    }
});

$('sidebarToggle').addEventListener('click', () => {
    document.querySelector('.sidebar').classList.toggle('collapsed');
});
$('mobileToggle').addEventListener('click', () => {
    document.querySelector('.sidebar').classList.toggle('open');
});

// Sort
document.querySelectorAll('.sort-icon').forEach(icon => {
    icon.addEventListener('click', () => sortData(icon.getAttribute('data-col')));
});

// ── Boot: Dashboard 5 Máy ──
let systemMeta = null;

document.addEventListener('DOMContentLoaded', loadMetaAndCockpit);

async function loadMetaAndCockpit() {
    try {
        const metaDoc = await db.collection('analytics').doc('meta').get();
        if (metaDoc.exists) {
            systemMeta = metaDoc.data();
        }
    } catch (err) {
        console.error('Meta load error', err);
    }
    
    // Bỏ qua Cockpit, tự động tải Máy 001 (hoặc máy đầu tiên có dữ liệu)
    let defaultMachine = '1'; 
    if (systemMeta && systemMeta.machines) {
        const availableIds = Object.keys(systemMeta.machines)
            .filter(k => k.startsWith('machine_') || !isNaN(k) && Number(k) > 0)
            .map(k => k.replace('machine_', ''));
        if (availableIds.length > 0 && availableIds.includes('1')) {
            defaultMachine = '1';
        } else if (availableIds.length > 0) {
            defaultMachine = availableIds[0];
        }
    }
    
    const metaMachineKey = `machine_${defaultMachine}`;
    const machineData = systemMeta?.machines?.[metaMachineKey] || systemMeta?.machines?.[defaultMachine];
    
    // Hiện khung chính
    $('mainDashboardContainer').style.display = 'block';
    
    // Điền dữ liệu cho dropdown thay đổi máy
    const machineDropdown = $('machineSelectDropdown');
    if (machineDropdown) {
         machineDropdown.innerHTML = '';
         for (let i = 1; i <= 6; i++) {
             const mData = systemMeta?.machines?.[`machine_${i}`] || systemMeta?.machines?.[String(i)];
             if (mData) {
                 machineDropdown.innerHTML += `<option value="${i}">${mData.name || `Máy 00${i}`}</option>`;
             } else {
                 machineDropdown.innerHTML += `<option value="${i}">Máy 00${i}</option>`;
             }
         }
         machineDropdown.value = defaultMachine;
    }
    
    if (machineData && machineData.sheetNames && machineData.sheetNames.length > 0) {
        loadMachine(defaultMachine, machineData);
    } else {
        $('splashScreen').style.display = 'none';
        $('noDataScreen').style.display = 'flex';
    }
    
    applyTranslations(); 
}

// ── Bỏ qua renderCockpit cũ ──
function renderCockpit() {
    // Đã thay thế
}

// ── Quản lý Dropdown Đổi Máy trong Dashboard ──
$('machineSelectDropdown')?.addEventListener('change', (e) => {
    const val = e.target.value;
    const metaMachineKey = `machine_${val}`;
    const machineData = systemMeta?.machines?.[metaMachineKey] || systemMeta?.machines?.[val];
    loadMachine(val, machineData);
});

async function loadMachine(machineId, machineData) {
    // Set giá trị dropdown (nếu có)
    const machineDropdown = $('machineSelectDropdown');
    if (machineDropdown) machineDropdown.value = machineId;

    // Lưu ID máy dùng cho Đổi ngôn ngữ
    window._currentMachineId = machineId;

    // Ẩn grid máy, hiện loading
    if ($('machineSplashGrid')) $('machineSplashGrid').style.display = 'none';
    if ($('machineLoadingSpinner')) $('machineLoadingSpinner').style.display = 'flex';
    
    const sheetNames = machineData.sheetNames || [];

    // Hiện thời gian cập nhật của máy này
    if (machineData.uploadedAt) {
        const d = new Date(machineData.uploadedAt);
        const locale = currentLang === 'zh' ? 'zh-CN' : 'vi-VN';
        $('dataInfoText').removeAttribute('data-i18n'); // Bỏ để tránh đè lúc đổi ngôn ngữ
        $('dataInfoText').textContent = t('updated_at') +
            d.toLocaleDateString(locale) + ' ' +
            d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
        window._uploadedAt = d;
    }

    try {
        // Load các sheets (nhân viên) của máy này
        allSheetsData = {};
        for (const name of sheetNames) {
            // Thêm prefix machine_X_
            const docId = `machine_${machineId}_${name}`;
            const doc = await db.collection('analytics_sheets').doc(docId).get();
            if (doc.exists) allSheetsData[name] = doc.data();
        }

        // Sheet dropdown — "全部" đầu tiên, rồi từng nhân viên
        sheetSelect.innerHTML = '';

        const allOpt = document.createElement('option');
        allOpt.value = '__all__';
        allOpt.textContent = t('select_all');
        allOpt.setAttribute('data-i18n-key', 'select_all');
        sheetSelect.appendChild(allOpt);

        sheetNames.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = t('select_staff_prefix') + name;
            opt.setAttribute('data-staff-name', name);
            sheetSelect.appendChild(opt);
        });
        sheetSelect.disabled = false;

        // Tắt màn hình Cockpit, chuyển qua main dashboard
        if ($('machineLoadingSpinner')) $('machineLoadingSpinner').style.display = 'none';
        if ($('machineSelectionScreen')) $('machineSelectionScreen').classList.remove('active');
        
        // Phục hồi lại nút grid cho lần vào sau
        if ($('machineSplashGrid')) $('machineSplashGrid').style.display = 'grid';
        
        // Hiện khung chính
        $('mainDashboardContainer').style.display = 'block';
        
        // --- QUAN TRỌNG: Ẩn loading cũ và hiện Dashboard Grid ---
        $('splashScreen').style.display = 'none';
        $('noDataScreen').style.display = 'none';
        $('dashboardGrid').style.display = 'block';

        // Mặc định load tổng hợp của máy này
        loadSheetData('__all__');

    } catch (err) {
        console.error('Firestore load error:', err);
        alert('Lỗi khi tải dữ liệu từ máy này. Vui lòng thử lại sau.');
        $('machineLoadingSpinner').style.display = 'none';
        $('machineSplashGrid').style.display = 'grid';
    }
}

function loadSheetData(sheetName) {
    // Lấy headers chung từ systemMeta của máy hiện tại.
    const metaMachineKey = `machine_${window._currentMachineId}`;
    const machineMeta = systemMeta?.machines?.[metaMachineKey] || systemMeta?.machines?.[window._currentMachineId];
    const rawHeaders = machineMeta?.headers || [];
    dailyHeaders = rawHeaders.filter(h => {
        const s = String(h).trim();
        return /^\d{1,2}月\d{1,2}日?$/.test(s) || (!isNaN(s) && Number(s) > 40000);
    });

    if (sheetName === '__all__') {
        // Gộp tất cả sheets
        const merged = mergeAllSheets();
        currentSheetData = merged.customers;
    } else {
        const sheet = allSheetsData[sheetName];
        if (!sheet) return;
        currentSheetData = sheet.customers || [];
    }
    analyzeAndRender();
}

// Gộp data tất cả nhân viên thành 1 danh sách khách hàng
// Nếu cùng KH (cùng ID) xuất hiện ở nhiều NV → cộng dồn
function mergeAllSheets() {
    const sheetNames = Object.keys(allSheetsData);
    if (sheetNames.length === 0) return { customers: [] };

    // Map: id → {id, name, total, daily, _staff: [...]}
    const customerMap = new Map();

    sheetNames.forEach(sheetName => {
        const sheet = allSheetsData[sheetName];
        const customers = sheet.customers || [];

        customers.forEach(item => {
            const key = String(item.code || item.id || item.name || '').trim();
            if (!key) return;

            if (customerMap.has(key)) {
                // Cộng dồn nếu trùng
                const existing = customerMap.get(key);
                existing.total += item.total || 0;
                // Cộng daily
                dailyHeaders.forEach(h => {
                    existing.daily[h] = (existing.daily[h] || 0) + (item.daily?.[h] || 0);
                });
                existing._staffList.push(sheetName);
            } else {
                const daily = {};
                dailyHeaders.forEach(h => { daily[h] = item.daily?.[h] || 0; });
                customerMap.set(key, {
                    id: item.id,
                    code: item.code || '',
                    name: item.name,
                    cardType: item.cardType || '',
                    total: item.total || 0,
                    daily,
                    _staffList: [sheetName]
                });
            }
        });
    });

    return {
        customers: Array.from(customerMap.values())
    };
}

// ── Section Switching ──
function switchSection(section) {
    document.querySelectorAll('.section-block').forEach(el => el.style.display = 'none');
    const target = $('section-' + section);
    if (target) target.style.display = 'block';

    document.querySelectorAll('.nav-item[data-section]').forEach(n => n.classList.remove('active'));
    const activeNav = document.querySelector(`.nav-item[data-section="${section}"]`);
    if (activeNav) activeNav.classList.add('active');

    const titleKeys = {
        overview: 'title_overview',
        charts: 'title_charts',
        table: 'title_table',
        trends: 'title_trends',
        compare: 'title_compare',
        inactive: 'title_inactive',
        settings: 'title_settings'
    };
    $('pageTitle').textContent = t(titleKeys[section] || 'appName');

    if (section === 'compare') renderCompare();
    if (section === 'trends') renderTrends();
    if (section === 'inactive') renderInactive();

    document.querySelector('.sidebar').classList.remove('open');
}

// ── Threshold ──
function updateThresholds() {
    let high = parseInt(highThresholdInput.value);
    let low = parseInt(lowThresholdInput.value);
    if (low > high) {
        if (this === highThresholdInput) { lowThresholdInput.value = high; low = high; }
        else { highThresholdInput.value = low; high = low; }
    }
    highValLabel.textContent = high;
    lowValLabel.textContent = low;
    // Cập nhật label trên thẻ KPI
    const htl = $('highThreshLabel');
    const ltl = $('lowThreshLabel');
    if (htl) htl.textContent = high;
    if (ltl) ltl.textContent = low;
    if (currentSheetData.length > 0) analyzeAndRender();
}

// ── Main Analyze & Render ──
function analyzeAndRender() {
    const highThresh = parseInt(highThresholdInput.value);
    const lowThresh = parseInt(lowThresholdInput.value);

    let highCount = 0, normalCount = 0, lowCount = 0, totalVolume = 0;
    currentSheetData.sort((a, b) => b.total - a.total);

    const labels = [], totals = [], bgColors = [];

    currentSheetData.forEach(item => {
        totalVolume += item.total;
        if (item.total >= highThresh) { highCount++; item._category = 'high'; }
        else if (item.total <= lowThresh) { lowCount++; item._category = 'low'; }
        else { normalCount++; item._category = 'normal'; }

        labels.push((item.name || item.id).substring(0, 22));
        totals.push(item.total);
        bgColors.push(item._category === 'high' ? 'rgba(0,200,83,0.75)' :
            item._category === 'low' ? 'rgba(255,23,68,0.75)' : 'rgba(41,121,255,0.75)');
    });

    const total = currentSheetData.length || 1;
    $('totalCustomers').textContent = currentSheetData.length;
    $('highCount').textContent = highCount;
    $('normalCount').textContent = normalCount;
    $('lowCount').textContent = lowCount;
    $('totalVolume').textContent = fmt(totalVolume);
    $('highPercent').textContent = Math.round(highCount / total * 100) + '%';
    $('normalPercent').textContent = Math.round(normalCount / total * 100) + '%';
    $('lowPercent').textContent = Math.round(lowCount / total * 100) + '%';

    renderLeaderboard();
    renderStaffRanking();
    renderTable();
    renderAlertSummary(highCount, normalCount, lowCount, totalVolume);
    renderBarChart(labels, totals, bgColors);
    renderPieChart(highCount, normalCount, lowCount);
    renderRadarChart();
    renderPolarChart();
    if ($('section-trends').style.display !== 'none') renderTrends();
    if ($('section-inactive').style.display !== 'none') renderInactive();
}

// ── Alert Summary — Sếp thấy ngay điều quan trọng ──
function renderAlertSummary(highCount, normalCount, lowCount, totalVolume) {
    const container = $('alertItems');
    if (!container) return;
    const total = currentSheetData.length;
    const alerts = [];

    const lowPct = total > 0 ? Math.round(lowCount / total * 100) : 0;
    if (lowPct >= 40) {
        alerts.push({ type: 'danger', icon: 'exclamation-triangle', text: t('alert_low_pct_high', { pct: `<strong>${lowPct}</strong>` }) });
    } else if (lowPct >= 20) {
        alerts.push({ type: 'warning', icon: 'exclamation-circle', text: t('alert_low_pct_mid', { pct: lowPct }) });
    }

    if (currentSheetData.length > 1 && totalVolume > 0) {
        const topPct = Math.round(currentSheetData[0].total / totalVolume * 100);
        if (topPct >= 30) {
            const topName = currentSheetData[0].name || currentSheetData[0].id;
            alerts.push({ type: 'info', icon: 'info-circle', text: t('alert_top_dominant', { name: `<strong>${topName}</strong>`, pct: `<strong>${topPct}%</strong>` }) });
        }
    }

    const highPct = total > 0 ? Math.round(highCount / total * 100) : 0;
    if (highPct >= 50) {
        alerts.push({ type: 'success', icon: 'check-circle', text: t('alert_high_pct_good', { pct: `<strong>${highPct}</strong>` }) });
    }

    if (dailyHeaders.length >= 7) {
        const last7 = dailyHeaders.slice(-7);
        let inactiveCount = 0;
        currentSheetData.forEach(item => {
            const daily = item.daily || {};
            let active = false;
            for (const h of last7) { if ((daily[h] || 0) > 0) { active = true; break; } }
            if (!active) inactiveCount++;
        });
        if (inactiveCount > 0) {
            alerts.push({ type: 'warning', icon: 'user-clock', text: t('alert_inactive_7d', { count: `<strong>${inactiveCount}</strong>` }) });
        }
    }

    if (alerts.length === 0) {
        container.innerHTML = `<div class="alert-item alert-success"><i class="fas fa-check-circle"></i> ${t('alert_all_ok')}</div>`;
    } else {
        container.innerHTML = alerts.map(a =>
            `<div class="alert-item alert-${a.type}"><i class="fas fa-${a.icon}"></i> ${a.text}</div>`
        ).join('');
    }
}

// ── Staff Ranking (hiển thị trên trang Tổng Quan) ──
function renderStaffRanking() {
    const container = $('staffRankList');
    if (!container) return;
    const sheetNames = Object.keys(allSheetsData);
    if (sheetNames.length === 0) { container.innerHTML = ''; return; }

    const medals = ['🥇', '🥈', '🥉'];
    const stats = sheetNames.map(name => {
        const items = allSheetsData[name].customers || [];
        const totalVol = items.reduce((s, i) => s + (i.total || 0), 0);
        return { name, totalVol, count: items.length };
    }).sort((a, b) => b.totalVol - a.totalVol);

    const maxVol = stats[0]?.totalVol || 1;

    container.innerHTML = stats.map((s, i) => {
        const pct = Math.round(s.totalVol / maxVol * 100);
        const barColor = i === 0 ? 'var(--green)' : i === 1 ? 'var(--blue)' : i === 2 ? 'var(--yellow)' : 'var(--text-secondary)';
        const medal = medals[i] || `<span style="font-weight:700;color:var(--text-secondary)">${i + 1}</span>`;
        return `
        <div class="staff-rank-item" data-sheet="${s.name}">
            <div class="staff-rank-medal">${medal}</div>
            <div class="staff-rank-info">
                <div class="staff-rank-name">${s.name}</div>
                <div class="staff-rank-bar-wrap">
                    <div class="staff-rank-bar" style="width:${pct}%;background:${barColor};"></div>
                </div>
            </div>
            <div class="staff-rank-vol">${fmt(s.totalVol)}</div>
        </div>`;
    }).join('');

    // Click để xem riêng nhân viên đó
    container.querySelectorAll('.staff-rank-item').forEach(el => {
        el.addEventListener('click', () => {
            const sheetName = el.getAttribute('data-sheet');
            sheetSelect.value = sheetName;
            loadSheetData(sheetName);
        });
    });
}

// ── Leaderboard (Top 5 KH) ──
function renderLeaderboard() {
    const lb = $('leaderboard');
    lb.innerHTML = '';
    const medals = ['🥇', '🥈', '🥉'];
    currentSheetData.slice(0, 5).forEach((item, i) => {
        const div = document.createElement('div');
        div.className = 'leader-item';
        const subInfo = [item.code || item.id, item.cardType].filter(Boolean).join(' · ');
        div.innerHTML = `
            <span class="leader-rank rank-${i + 1}">${i < 3 ? medals[i] : (i + 1)}</span>
            <div class="leader-info">
                <div class="leader-name">${item.name || item.code || item.id}</div>
                <div class="leader-sub">${subInfo}</div>
            </div>
            <span class="leader-value">${fmt(item.total)}</span>`;
        lb.appendChild(div);
    });
}

// ── Table ──
// Helper: tìm ngày giao dịch gần nhất của 1 khách hàng
function getLastTxDate(item) {
    const daily = item.daily || {};
    for (let i = dailyHeaders.length - 1; i >= 0; i--) {
        if ((daily[dailyHeaders[i]] || 0) > 0) {
            return dailyHeaders[i];
        }
    }
    return null;
}

function renderTable() {
    const query = searchInput.value.toLowerCase();
    const filter = filterCategory.value;
    const maxTotal = currentSheetData.length > 0 ? currentSheetData[0].total : 1;
    const tbody = document.querySelector('#dataTable tbody');
    tbody.innerHTML = '';

    let filtered = currentSheetData.filter(item => {
        if (filter !== 'all' && item._category !== filter) return false;
        if (query && !(item.code + ' ' + item.name + ' ' + item.cardType + ' ' + item.id).toLowerCase().includes(query)) return false;
        return true;
    });

    filtered.forEach((item, idx) => {
        const pct = maxTotal > 0 ? (item.total / maxTotal * 100) : 0;
        const barColor = item._category === 'high' ? 'var(--green)' : item._category === 'low' ? 'var(--red)' : 'var(--blue)';
        const cardTypeDisplay = item.cardType || '<span style="color:var(--text-secondary)">—</span>';
        const lastTxHeader = getLastTxDate(item);
        const lastTxDisplay = lastTxHeader ? formatDateLabel(lastTxHeader) : `<span class="tag tag-low">${t('never_tx')}</span>`;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:600;color:var(--text-secondary)">${idx + 1}</td>
            <td><strong>${item.code || item.id}</strong></td>
            <td>${item.name}</td>
            <td>${cardTypeDisplay}</td>
            <td style="font-weight:700;">${fmt(item.total)}</td>
            <td>${lastTxDisplay}</td>
            <td><div class="progress-bar-container"><div class="progress-bar-fill" style="width:${pct}%;background:${barColor};"></div></div></td>`;
        tr.addEventListener('click', () => openCustomerDetail(item));
        tbody.appendChild(tr);
    });
    $('tableInfo').textContent = t('table_info', { filtered: filtered.length, total: currentSheetData.length });
}

function sortData(col) {
    const dir = sortDirection[col] === 'asc' ? 'desc' : 'asc';
    sortDirection[col] = dir;
    currentSheetData.sort((a, b) => {
        let va = a[col], vb = b[col];
        if (typeof va === 'string') { va = va.toLowerCase(); vb = (vb || '').toLowerCase(); }
        return dir === 'asc' ? (va < vb ? -1 : 1) : (va > vb ? -1 : 1);
    });
    renderTable();
}

// ── Charts ──
function renderBarChart(labels, totals, bgColors) {
    if (barChartInstance) barChartInstance.destroy();
    barChartInstance = new Chart($('barChart').getContext('2d'), {
        type: 'bar',
        data: { labels, datasets: [{ label: t('volume'), data: totals, backgroundColor: bgColors, borderRadius: 6, borderSkipped: false }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${t('chart_volume')}${ctx.parsed.y.toLocaleString()}` } } },
            scales: { x: { ticks: { maxRotation: 50, minRotation: 30, font: { size: 11 } }, grid: { display: false } }, y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { callback: v => v.toLocaleString() } } }
        }
    });
}

function renderPieChart(high, normal, low) {
    if (pieChartInstance) pieChartInstance.destroy();
    pieChartInstance = new Chart($('pieChart').getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: [t('tag_high'), t('tag_normal'), t('tag_low')],
            datasets: [{ data: [high, normal, low], backgroundColor: ['#00c853', '#2979ff', '#ff1744'], borderWidth: 0, hoverOffset: 8 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, cutout: '65%',
            plugins: {
                legend: { position: 'bottom', labels: { padding: 16, font: { size: 13, weight: 600 } } },
                tooltip: { callbacks: { label: ctx => { const t = high + normal + low; return `${ctx.label}: ${ctx.parsed} KH (${Math.round(ctx.parsed / t * 100)}%)`; } } }
            }
        }
    });
}

function renderRadarChart() {
    if (radarChartInstance) radarChartInstance.destroy();
    const top8 = currentSheetData.slice(0, 8);
    radarChartInstance = new Chart($('radarChart').getContext('2d'), {
        type: 'radar',
        data: { labels: top8.map(i => (i.name || i.id).substring(0, 12)), datasets: [{ label: t('volume'), data: top8.map(i => i.total), backgroundColor: 'rgba(0,102,255,0.15)', borderColor: 'rgba(0,102,255,0.7)', borderWidth: 2, pointBackgroundColor: '#0066ff' }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { r: { beginAtZero: true, ticks: { display: false }, grid: { color: 'rgba(0,0,0,0.06)' } } } }
    });
}

function renderPolarChart() {
    if (polarChartInstance) polarChartInstance.destroy();
    const top6 = currentSheetData.slice(0, 6);
    const colors = ['#0066ff', '#00c853', '#ff1744', '#ffab00', '#7c4dff', '#00bcd4'];
    polarChartInstance = new Chart($('polarChart').getContext('2d'), {
        type: 'polarArea',
        data: { labels: top6.map(i => (i.name || i.id).substring(0, 15)), datasets: [{ data: top6.map(i => i.total), backgroundColor: colors.map(c => c + '88'), borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { padding: 12, font: { size: 11 } } } } }
    });
}

// ── Trends ──
function renderTrends() {
    if (dailyHeaders.length === 0) return;
    const dailyTotals = {}, dailyActive = {};
    dailyHeaders.forEach(h => { dailyTotals[h] = 0; dailyActive[h] = 0; });

    currentSheetData.forEach(item => {
        const daily = item.daily || {};
        dailyHeaders.forEach(h => {
            const val = daily[h] || 0;
            dailyTotals[h] += val;
            if (val > 0) dailyActive[h]++;
        });
    });

    const labels = dailyHeaders;
    const displayLabels = labels.map(l => formatDateLabel(l));
    const values = labels.map(l => dailyTotals[l]);
    let peakIdx = 0, lowIdx = 0;
    values.forEach((v, i) => { if (v > values[peakIdx]) peakIdx = i; if (v < values[lowIdx]) lowIdx = i; });

    $('peakDay').innerHTML = `<i class="fas fa-arrow-up"></i><span>${displayLabels[peakIdx]} — <strong>${values[peakIdx].toLocaleString()}</strong> sản lượng</span>`;
    $('lowDay').innerHTML = `<i class="fas fa-arrow-down"></i><span>${displayLabels[lowIdx]} — <strong>${values[lowIdx].toLocaleString()}</strong> sản lượng</span>`;

    if (trendChartInstance) trendChartInstance.destroy();
    trendChartInstance = new Chart($('trendChart').getContext('2d'), {
        type: 'line',
        data: {
            labels: displayLabels,
            datasets: [
                { label: t('chart_total_volume'), data: values, fill: true, backgroundColor: 'rgba(0,102,255,0.08)', borderColor: '#0066ff', borderWidth: 3, tension: 0.4, pointBackgroundColor: '#0066ff', pointRadius: 5, pointHoverRadius: 8 },
                { label: t('chart_active_kh'), data: labels.map(l => dailyActive[l]), fill: false, borderColor: '#00c853', borderWidth: 2, borderDash: [6, 3], tension: 0.4, pointBackgroundColor: '#00c853', pointRadius: 4, yAxisID: 'y1' }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
            plugins: { legend: { position: 'top' }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()}` } } },
            scales: {
                x: { grid: { display: false } },
                y: { beginAtZero: true, position: 'left', grid: { color: 'rgba(0,0,0,0.04)' }, title: { display: true, text: t('chart_total_volume') }, ticks: { callback: v => v.toLocaleString() } },
                y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: t('chart_active_kh') } }
            }
        }
    });

    const dtbody = document.querySelector('#dailyTable tbody');
    dtbody.innerHTML = '';
    labels.forEach((l, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td style="font-weight:600;">${displayLabels[i]}</td><td style="font-weight:700;">${fmt(dailyTotals[l])}</td><td>${dailyActive[l]}</td>`;
        dtbody.appendChild(tr);
    });
}

// ── Compare ──
function renderCompare() {
    const sheetNames = Object.keys(allSheetsData);
    const sheetStats = sheetNames.map(name => {
        const items = allSheetsData[name].customers || [];
        const totalVol = items.reduce((s, i) => s + i.total, 0);
        const count = items.length;
        return { name, totalVol, count, avg: count > 0 ? Math.round(totalVol / count) : 0 };
    }).sort((a, b) => b.totalVol - a.totalVol);

    if (compareChartInstance) compareChartInstance.destroy();
    const colors = ['#0066ff', '#00c853', '#ff1744', '#ffab00', '#7c4dff', '#00bcd4', '#ff6d00', '#c51162'];
    compareChartInstance = new Chart($('compareChart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: sheetStats.map(s => s.name),
            datasets: [{ label: t('chart_total_volume'), data: sheetStats.map(s => s.totalVol), backgroundColor: sheetStats.map((_, i) => colors[i % colors.length] + 'cc'), borderRadius: 8, borderSkipped: false }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `Sản lượng: ${ctx.parsed.y.toLocaleString()}` } } },
            scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { callback: v => v.toLocaleString() } } }
        }
    });

    const tbody = document.querySelector('#compareTable tbody');
    tbody.innerHTML = '';
    const medals = ['🥇', '🥈', '🥉'];
    sheetStats.forEach((s, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td style="font-size:18px;text-align:center;">${i < 3 ? medals[i] : (i + 1)}</td>
            <td style="font-weight:700;">${s.name}</td>
            <td style="font-weight:700;color:var(--primary);">${fmt(s.totalVol)}</td>
            <td>${s.count}</td><td>${fmt(s.avg)}</td>`;
        tbody.appendChild(tr);
    });
}

// ── Inactive ──
function renderInactive() {
    const nDays = parseInt(inactiveDaysInput.value);
    console.log('[INACTIVE DEBUG] dailyHeaders.length=', dailyHeaders.length, 'currentSheetData.length=', currentSheetData.length, 'nDays=', nDays);
    if (dailyHeaders.length > 0) console.log('[INACTIVE DEBUG] first3=', dailyHeaders.slice(0,3), 'last3=', dailyHeaders.slice(-3));
    if (dailyHeaders.length === 0 || currentSheetData.length === 0) return;

    const lastNHeaders = dailyHeaders.slice(-nDays);
    const inactiveList = [];
    const activeList = [];

    currentSheetData.forEach(item => {
        const daily = item.daily || {};
        let hasActivity = false;
        let lastActiveDay = null;

        for (const h of lastNHeaders) {
            if ((daily[h] || 0) > 0) { hasActivity = true; break; }
        }

        for (let i = dailyHeaders.length - 1; i >= 0; i--) {
            if ((daily[dailyHeaders[i]] || 0) > 0) { lastActiveDay = dailyHeaders[i]; break; }
        }

        if (hasActivity) activeList.push(item);
        else inactiveList.push({ ...item, lastActiveDay });
    });

    $('inactiveCount').textContent = inactiveList.length;
    $('activeCount').textContent = activeList.length;

    const tbody = document.querySelector('#inactiveTable tbody');
    tbody.innerHTML = '';

    if (inactiveList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-secondary);padding:30px;">
            <i class="fas fa-check-circle text-green" style="font-size:28px;"></i><br><br>
            ${t('all_active_msg', { n: nDays })}
        </td></tr>`;
        return;
    }

    inactiveList.forEach((item, idx) => {
        const tr = document.createElement('tr');
        const lastDay = item.lastActiveDay ? formatDateLabel(item.lastActiveDay) : `<span class="tag tag-low">${t('never_tx')}</span>`;
        const cardTypeDisplay = item.cardType || '<span style="color:var(--text-secondary)">—</span>';
        tr.innerHTML = `
            <td style="font-weight:600;">${idx + 1}</td>
            <td><strong>${item.code || item.id}</strong></td>
            <td>${item.name}</td>
            <td>${cardTypeDisplay}</td>
            <td style="font-weight:700;">${fmt(item.total)}</td>
            <td>${lastDay}</td>
            <td><span class="tag tag-inactive"><i class="fas fa-clock"></i> ${t('status_inactive')}</span></td>`;
        tbody.appendChild(tr);
    });
}

// Chuyển đổi ngày tiếng Trung (3月2日) hoặc Excel serial thành ngày/tháng bình thường
function formatDateLabel(val) {
    const s = String(val).trim();
    // Trường hợp 1: Tiếng Trung — "3月2日" → "02/03"
    const cnMatch = s.match(/^(\d{1,2})月(\d{1,2})日?$/);
    if (cnMatch) {
        const month = cnMatch[1].padStart(2, '0');
        const day = cnMatch[2].padStart(2, '0');
        return `${day}/${month}`;
    }
    // Trường hợp 2: Excel serial date (số > 40000)
    if (!isNaN(val) && Number(val) > 40000) {
        const excelEpoch = new Date(1899, 11, 30);
        const date = new Date(excelEpoch.getTime() + Number(val) * 86400000);
        return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    }
    return s;
}

// ── Export ──
function exportReport() {
    const sheetName = sheetSelect.value || 'BaoCao';
    let csv = `Báo Cáo Phân Tích Giao Dịch - ${sheetName}\n`;
    csv += `Ngưỡng GD Nhiều: ${highThresholdInput.value}, Ngưỡng GD Ít: ${lowThresholdInput.value}\n\n`;
    csv += `Mã KH (编号),Tên KH,Loại Hình (类型),Tổng Sản Lượng,Phân Loại\n`;
    currentSheetData.forEach(item => {
        const cat = item._category === 'high' ? 'GD Nhiều' : item._category === 'low' ? 'GD Ít' : 'Bình Thường';
        csv += `"${item.code || item.id}","${item.name}","${item.cardType || ''}",${item.total},"${cat}"\n`;
    });
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `bao_cao_${sheetName}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
}

// ══════════════════════════════════════════════════
// ══════ CUSTOMER DETAIL MODAL ═══════════════════
// ══════════════════════════════════════════════════

let _detailCurrentItem = null;

// Parse header key → {year, month, day} Date object
function parseHeaderToDate(headerKey) {
    const s = String(headerKey).trim();
    // Excel serial date
    if (!isNaN(s) && Number(s) > 40000) {
        const excelEpoch = new Date(1899, 11, 30);
        return new Date(excelEpoch.getTime() + Number(s) * 86400000);
    }
    // Chinese date: X月Y日
    const cnMatch = s.match(/^(\d{1,2})月(\d{1,2})日?$/);
    if (cnMatch) {
        const month = parseInt(cnMatch[1]);
        const day = parseInt(cnMatch[2]);
        const year = new Date().getFullYear();
        return new Date(year, month - 1, day);
    }
    return null;
}

// Open detail modal
function openCustomerDetail(item) {
    _detailCurrentItem = item;
    const modal = $('detailModal');

    // Fill header info
    const nameStr = item.name || item.code || item.id || '—';
    $('detailName').textContent = nameStr;
    $('detailAvatar').textContent = nameStr.substring(0, 2).toUpperCase();
    $('detailCode').textContent = item.code || item.id || '—';
    
    const ct = $('detailCardType');
    if (item.cardType) {
        ct.textContent = item.cardType;
        ct.style.display = 'inline-block';
    } else {
        ct.style.display = 'none';
    }

    // Parse all dates and group by month
    const daily = item.daily || {};
    const dateEntries = []; // [{date, headerKey, value}]
    
    dailyHeaders.forEach(h => {
        const d = parseHeaderToDate(h);
        if (d) {
            dateEntries.push({ date: d, headerKey: h, value: daily[h] || 0 });
        }
    });

    // Group months
    const months = {};
    dateEntries.forEach(e => {
        const key = `${e.date.getFullYear()}-${String(e.date.getMonth() + 1).padStart(2, '0')}`;
        if (!months[key]) months[key] = [];
        months[key].push(e);
    });

    const monthKeys = Object.keys(months).sort();

    // Summary stats
    const activeDays = dateEntries.filter(e => e.value > 0).length;
    const totalVal = dateEntries.reduce((s, e) => s + e.value, 0);
    $('detailTotal').textContent = fmt(totalVal);
    $('detailActiveDays').textContent = activeDays;
    $('detailAvgDaily').textContent = activeDays > 0 ? fmt(Math.round(totalVal / activeDays)) : '0';

    // Populate month selector
    const monthSelect = $('detailMonthSelect');
    monthSelect.innerHTML = '';
    
    // "All months" option
    const allOpt = document.createElement('option');
    allOpt.value = '__all__';
    allOpt.textContent = currentLang === 'zh' ? '📅 全部月份' : '📅 Tất cả tháng';
    monthSelect.appendChild(allOpt);
    
    monthKeys.forEach(mk => {
        const [y, m] = mk.split('-');
        const opt = document.createElement('option');
        opt.value = mk;
        opt.textContent = currentLang === 'zh' ? `${y}年${parseInt(m)}月` : `Tháng ${parseInt(m)}/${y}`;
        monthSelect.appendChild(opt);
    });

    // Default to the latest month with actual transactions
    let defaultMonth = '__all__';
    for (let i = monthKeys.length - 1; i >= 0; i--) {
        const hasAny = months[monthKeys[i]].some(e => e.value > 0);
        if (hasAny) { defaultMonth = monthKeys[i]; break; }
    }
    monthSelect.value = defaultMonth;

    monthSelect.onchange = () => renderDetailForMonth(months, monthKeys);
    
    renderDetailForMonth(months, monthKeys);

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function renderDetailForMonth(months, monthKeys) {
    const selectedMonth = $('detailMonthSelect').value;
    const calendar = $('detailCalendar');
    const tbody = document.querySelector('#detailDailyTable tbody');

    let entriesToShow = [];
    if (selectedMonth === '__all__') {
        monthKeys.forEach(mk => entriesToShow = entriesToShow.concat(months[mk]));
    } else {
        entriesToShow = months[selectedMonth] || [];
    }

    // Find max value for color coding
    const maxVal = Math.max(1, ...entriesToShow.map(e => e.value));

    // ── Calendar Grid ──
    calendar.innerHTML = '';

    if (selectedMonth !== '__all__' && entriesToShow.length > 0) {
        // Show calendar view for single month
        const [year, month] = selectedMonth.split('-').map(Number);
        const weekDays = currentLang === 'zh' 
            ? ['日', '一', '二', '三', '四', '五', '六'] 
            : ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
        
        weekDays.forEach(d => {
            calendar.innerHTML += `<div class="detail-cal-header">${d}</div>`;
        });

        const firstDay = new Date(year, month - 1, 1).getDay();
        const daysInMonth = new Date(year, month, 0).getDate();

        // Build lookup: day → value
        const dayLookup = {};
        entriesToShow.forEach(e => {
            dayLookup[e.date.getDate()] = e.value;
        });

        // Empty cells before first day
        for (let i = 0; i < firstDay; i++) {
            calendar.innerHTML += `<div class="detail-cal-day empty"></div>`;
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const val = dayLookup[d] || 0;
            let cls = 'detail-cal-day';
            if (val > 0) {
                cls += val >= maxVal * 0.5 ? ' has-tx-high' : ' has-tx';
            } else {
                cls += ' no-tx';
            }
            const valDisplay = val > 0 ? `<span class="cal-val">${val}</span>` : '';
            calendar.innerHTML += `<div class="${cls}"><span class="cal-date">${d}</span>${valDisplay}</div>`;
        }
    } else {
        // All months: no calendar, only table
        calendar.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:16px; color:var(--text-secondary); font-size:13px;">
            <i class="fas fa-calendar-alt"></i> ${currentLang === 'zh' ? '请选择单个月份以查看日历视图' : 'Chọn 1 tháng để xem lịch'}
        </div>`;
    }

    // ── Daily Table (chỉ hiện ngày có giao dịch) ──
    tbody.innerHTML = '';
    const txDays = entriesToShow.filter(e => e.value > 0).sort((a, b) => a.date - b.date);

    if (txDays.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" style="text-align:center;padding:24px;color:var(--text-secondary);">
            <i class="fas fa-inbox" style="font-size:24px;margin-bottom:8px;display:block;"></i>
            ${currentLang === 'zh' ? '该月无交易记录' : 'Không có giao dịch trong tháng này'}
        </td></tr>`;
    } else {
        txDays.forEach(e => {
            const dateLabel = e.date.toLocaleDateString(currentLang === 'zh' ? 'zh-CN' : 'vi-VN', 
                { weekday: 'short', month: '2-digit', day: '2-digit' });
            const pct = (e.value / maxVal * 100);
            const barColor = pct >= 50 ? 'var(--green)' : 'var(--blue)';
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight:600;">${dateLabel}</td>
                <td>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <div style="flex:1;height:6px;background:#eee;border-radius:3px;overflow:hidden;min-width:60px;">
                            <div style="width:${pct}%;height:100%;background:${barColor};border-radius:3px;transition:width 0.4s;"></div>
                        </div>
                        <strong style="min-width:50px;text-align:right;">${fmt(e.value)}</strong>
                    </div>
                </td>`;
            tbody.appendChild(tr);
        });
    }
}

// Close modal
function closeCustomerDetail() {
    $('detailModal').classList.remove('active');
    document.body.style.overflow = '';
    _detailCurrentItem = null;
}

$('detailClose').addEventListener('click', closeCustomerDetail);
$('detailModal').addEventListener('click', e => {
    if (e.target === $('detailModal')) closeCustomerDetail();
});
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('detailModal').classList.contains('active')) closeCustomerDetail();
});
