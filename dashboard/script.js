/* =============================================
   BÁO CÁO PHÂN TÍCH GIAO DỊCH — USER DASHBOARD
   Đọc dữ liệu từ Firestore (admin upload)
   UX tối ưu cho sếp xem: rõ ràng, dễ hiểu
   ============================================= */

// ── State ──
let allSheetsData = {};
let _realSheetsCache = {}; // Cache dữ liệu thật từ tất cả tháng, dùng cho modal chi tiết KH
let currentSheetData = [];
let dailyHeaders = [];
let sortDirection = {};
let currentMonthKey = '__all__';

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
const highDaysThresholdInput = $('highDaysThreshold');
const lowDaysThresholdInput = $('lowDaysThreshold');
const highValLabel = $('highVal');
const lowValLabel = $('lowVal');
const highDaysValLabel = $('highDaysVal');
const lowDaysValLabel = $('lowDaysVal');
const dashboardGrid = $('dashboardGrid');
const splashScreen = $('splashScreen');
const noDataScreen = $('noDataScreen');
const searchInput = $('searchInput');
const filterCategory = $('filterCategory');
const inactiveDaysInput = $('inactiveDays');
const inactiveDaysVal = $('inactiveDaysVal');
const monthSelectDropdown = $('monthSelectDropdown');

// ── Events ──
sheetSelect.addEventListener('change', () => loadSheetData(sheetSelect.value));
if (monthSelectDropdown) {
    monthSelectDropdown.addEventListener('change', (e) => {
        currentMonthKey = e.target.value;
        loadMonthData(currentMonthKey);
    });
}
highThresholdInput.addEventListener('input', updateThresholds);
lowThresholdInput.addEventListener('input', updateThresholds);
if (highDaysThresholdInput) highDaysThresholdInput.addEventListener('input', updateThresholds);
if (lowDaysThresholdInput) lowDaysThresholdInput.addEventListener('input', updateThresholds);
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
    
    if (machineData && ((machineData.sheetNames && machineData.sheetNames.length > 0) || (machineData.months && Object.keys(machineData.months).length > 0))) {
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

// ── Tự động tạo tháng hiện tại nếu chưa tồn tại ──
function ensureCurrentMonth(machineData) {
    if (!machineData || !machineData.months) return;
    
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    
    // Nếu tháng hiện tại đã có dữ liệu thật → không cần làm gì
    if (machineData.months[currentMonthKey]) return;
    
    // Tìm tháng gần nhất có dữ liệu
    const existingMonths = Object.keys(machineData.months).sort((a, b) => b.localeCompare(a));
    if (existingMonths.length === 0) return;
    
    const latestMonth = existingMonths[0]; // tháng gần nhất
    const latestData = machineData.months[latestMonth];
    
    // Tạo entry ảo cho tháng hiện tại — carry-over KH từ tháng gần nhất
    machineData.months[currentMonthKey] = {
        sheetNames: latestData.sheetNames ? [...latestData.sheetNames] : [],
        headers: [],              // Không có header ngày (chưa có giao dịch)
        uploadedAt: new Date().toISOString(),
        _isVirtual: true,         // Đánh dấu là tháng ảo (client-side only)
        _sourceMonth: latestMonth  // Tháng nguồn để carry-over KH
    };
    
    console.log(`[AUTO-MONTH] Tạo tháng ảo ${currentMonthKey} từ dữ liệu ${latestMonth}`);
}

async function loadMachine(machineId, machineData) {
    // Set giá trị dropdown (nếu có)
    const machineDropdown = $('machineSelectDropdown');
    if (machineDropdown) machineDropdown.value = machineId;

    // Lưu ID máy dùng cho Đổi ngôn ngữ
    window._currentMachineId = machineId;

    // Ẩn grid máy, hiện loading
    if ($('machineSplashGrid')) $('machineSplashGrid').style.display = 'none';
    if ($('machineLoadingSpinner')) $('machineLoadingSpinner').style.display = 'flex';
    
    // Tự động đảm bảo tháng hiện tại luôn tồn tại
    ensureCurrentMonth(machineData);
    
    // Set up month dropdown
    if (monthSelectDropdown) {
        monthSelectDropdown.innerHTML = `<option value="__all__" data-i18n-key="month_all">${t('month_all')}</option>`;
        if (machineData.months) {
            const monthKeys = Object.keys(machineData.months).sort((a, b) => b.localeCompare(a));
            monthKeys.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m;
                const mData = machineData.months[m];
                const isVirtual = mData && mData._isVirtual;
                opt.textContent = isVirtual ? `🆕 ${m} (Tháng mới)` : `📅 ${m}`;
                if (isVirtual) opt.style.color = '#10b981'; // Màu xanh lá cho tháng mới
                monthSelectDropdown.appendChild(opt);
            });
            currentMonthKey = monthKeys.length > 0 ? monthKeys[0] : '__all__';
            monthSelectDropdown.value = currentMonthKey;
            monthSelectDropdown.disabled = false;
        } else {
            currentMonthKey = '__all__';
            monthSelectDropdown.disabled = true;
        }
    }

    // Hiện thời gian cập nhật của máy này (lấy từ máy hoặc tháng mới nhất)
    let uploadDateStr = machineData.uploadedAt;
    if (machineData.months && currentMonthKey !== '__all__') {
        uploadDateStr = machineData.months[currentMonthKey]?.uploadedAt || machineData.uploadedAt;
    } else if (machineData.months) {
        const sorted = Object.keys(machineData.months).sort((a,b) => b.localeCompare(a));
        if (sorted.length > 0) uploadDateStr = machineData.months[sorted[0]].uploadedAt;
    }

    if (uploadDateStr) {
        const d = new Date(uploadDateStr);
        const locale = currentLang === 'zh' ? 'zh-CN' : 'vi-VN';
        $('dataInfoText').removeAttribute('data-i18n'); // Bỏ để tránh đè lúc đổi ngôn ngữ
        $('dataInfoText').textContent = t('updated_at') +
            d.toLocaleDateString(locale) + ' ' +
            d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
        window._uploadedAt = d;
    }

    await loadMonthData(currentMonthKey);

    // Luôn preload cache dữ liệu thật từ tất cả tháng để modal chi tiết KH có dữ liệu lịch sử
    const currentMData = machineData?.months?.[currentMonthKey];
    // LUÔN preload lại cache (reset mỗi lần load sheet)
    console.log('[AUTO-MONTH] Preloading real data cache for detail modal...');
    await _preloadRealDataCache(machineData);
}

// ── Preload dữ liệu thật cho modal chi tiết KH (chạy khi xem tháng ảo) ──
async function _preloadRealDataCache(machineData) {
    if (!machineData?.months) return;
    
    _realSheetsCache = {};
    
    for (const [mKey, mData] of Object.entries(machineData.months)) {
        if (mData._isVirtual) continue; // Bỏ qua tháng ảo
        
        const sheetNames = mData.sheetNames || [];
        for (const sName of sheetNames) {
            const docId = `machine_${window._currentMachineId}_${mKey}_${sName}`;
            try {
                const doc = await db.collection('analytics_sheets').doc(docId).get();
                if (doc.exists) {
                    if (!_realSheetsCache[sName]) _realSheetsCache[sName] = { customers: [] };
                    
                    const existingMap = new Map();
                    _realSheetsCache[sName].customers.forEach(c => {
                        const k = String(c.code || c.id || c.name || '').trim();
                        if (k) existingMap.set(k, c);
                    });
                    
                    const customers = doc.data().customers || [];
                    customers.forEach(c => {
                        const k = String(c.code || c.id || c.name || '').trim();
                        if (!k) return;
                        if (existingMap.has(k)) {
                            const existing = existingMap.get(k);
                            existing.total += (c.total || 0);
                            Object.assign(existing.daily, c.daily || {});
                        } else {
                            existingMap.set(k, { ...c });
                        }
                    });
                    
                    _realSheetsCache[sName].customers = Array.from(existingMap.values());
                }
            } catch (err) {
                console.warn(`[CACHE] Failed to load ${docId}:`, err);
            }
        }
    }
    
    console.log(`[AUTO-MONTH] Cache loaded: ${Object.keys(_realSheetsCache).length} sheets`);
    // Debug: in ra tổng KH trong cache
    for (const [sName, sData] of Object.entries(_realSheetsCache)) {
        const custs = sData.customers || [];
        const withData = custs.filter(c => Object.keys(c.daily || {}).length > 0);
        console.log(`[AUTO-MONTH] Sheet "${sName}": ${custs.length} KH, ${withData.length} có daily data`);
    }
}

async function loadMonthData(monthKey) {
    if ($('machineLoadingSpinner')) $('machineLoadingSpinner').style.display = 'flex';
    
    const machineData = systemMeta?.machines?.[`machine_${window._currentMachineId}`] || systemMeta?.machines?.[window._currentMachineId];
    if (!machineData) return;

    allSheetsData = {};
    let allHeaders = new Set();
    let uniqueSheets = new Set();
    const docsToFetch = [];
    
    if (machineData.months) {
        if (monthKey === '__all__') {
            for (const [mKey, mData] of Object.entries(machineData.months)) {
                // Bỏ qua tháng ảo khi xem tổng hợp (tránh trùng KH)
                if (mData._isVirtual) continue;
                mData.headers?.forEach(h => allHeaders.add(h));
                mData.sheetNames?.forEach(s => {
                    uniqueSheets.add(s);
                    docsToFetch.push({ name: s, month: mKey, id: `machine_${window._currentMachineId}_${mKey}_${s}` });
                });
            }
        } else {
            const mData = machineData.months[monthKey];
            if (mData) {
                if (mData._isVirtual && mData._sourceMonth) {
                    // Tháng ảo: fetch KH từ tháng nguồn, sẽ zero-out sau
                    const sourceData = machineData.months[mData._sourceMonth];
                    if (sourceData) {
                        // Không thêm headers (chưa có giao dịch ngày nào)
                        sourceData.sheetNames?.forEach(s => {
                            uniqueSheets.add(s);
                            docsToFetch.push({ 
                                name: s, 
                                month: mData._sourceMonth, 
                                id: `machine_${window._currentMachineId}_${mData._sourceMonth}_${s}`,
                                _zeroOut: true  // Flag: zero-out tất cả daily & total
                            });
                        });
                    }
                } else {
                    mData.headers?.forEach(h => allHeaders.add(h));
                    mData.sheetNames?.forEach(s => {
                        uniqueSheets.add(s);
                        docsToFetch.push({ name: s, month: monthKey, id: `machine_${window._currentMachineId}_${monthKey}_${s}` });
                    });
                    // Thêm sheet từ các tháng KHÁC (tránh bỏ sót sheet như Sophia)
                    if (machineData.months) {
                        const currentSheetSet = new Set(mData.sheetNames || []);
                        Object.values(machineData.months).forEach(otherM => {
                            if (otherM._isVirtual) return;
                            (otherM.sheetNames || []).forEach(s => {
                                if (!currentSheetSet.has(s)) {
                                    currentSheetSet.add(s);
                                    uniqueSheets.add(s);
                                    docsToFetch.push({ name: s, month: monthKey, id: `machine_${window._currentMachineId}_${monthKey}_${s}` });
                                }
                            });
                        });
                    }
                }
            }
        }
    } else {
        // Legacy
        machineData.headers?.forEach(h => allHeaders.add(h));
        machineData.sheetNames?.forEach(s => {
            uniqueSheets.add(s);
            docsToFetch.push({ name: s, id: `machine_${window._currentMachineId}_${s}` });
        });
    }

    // Filter and sort valid headers
    dailyHeaders = Array.from(allHeaders).filter(h => {
        const s = String(h).trim();
        return /^\d{1,2}月\d{1,2}日?$/.test(s) || (!isNaN(s) && Number(s) > 40000);
    }).sort((a, b) => {
        const parseDate = (headerKey) => {
            const s = String(headerKey).trim();
            if (!isNaN(s) && Number(s) > 40000) {
                const u = new Date(Date.UTC(1899, 11, 30, 12, 0, 0) + Number(s) * 86400000);
                return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate()).getTime();
            }
            const cnMatch = s.match(/^(\d{1,2})月(\d{1,2})日?$/);
            if (cnMatch) return new Date(new Date().getFullYear(), parseInt(cnMatch[1]) - 1, parseInt(cnMatch[2])).getTime();
            return 0;
        };
        return parseDate(a) - parseDate(b);
    });

    try {
        // Fetch and merge
        const sheetCustomerMaps = {}; // name -> Map
        for (const task of docsToFetch) {
            const doc = await db.collection('analytics_sheets').doc(task.id).get();
            if (doc.exists) {
                if (!sheetCustomerMaps[task.name]) sheetCustomerMaps[task.name] = new Map();
                const map = sheetCustomerMaps[task.name];
                
                const customers = doc.data().customers || [];
                customers.forEach(c => {
                    const key = String(c.code || c.id || c.name || '').trim();
                    if (!key) return;
                    
                    if (task._zeroOut) {
                        // Tháng ảo: giữ thông tin KH nhưng reset giao dịch về 0
                        map.set(key, {
                            id: c.id,
                            code: c.code || '',
                            name: c.name,
                            cardType: c.cardType || '',
                            total: 0,
                            daily: {}
                        });
                    } else if (map.has(key)) {
                        const existing = map.get(key);
                        existing.total += (c.total || 0);
                        Object.assign(existing.daily, c.daily || {});
                    } else {
                        map.set(key, c);
                    }
                });
            }
        }
        
        // ── Carry-over: Merge KH từ TẤT CẢ tháng trước nếu đang xem 1 tháng cụ thể ──
        if (monthKey !== '__all__' && machineData.months) {
            // Tìm tất cả tháng trước (không phải virtual), sắp xếp gần nhất trước
            const allMonthKeys = Object.keys(machineData.months)
                .filter(k => k < monthKey && !machineData.months[k]._isVirtual)
                .sort((a, b) => b.localeCompare(a));
            
            for (const prevMonth of allMonthKeys) {
                const prevData = machineData.months[prevMonth];
                const prevSheets = prevData?.sheetNames || [];
                
                for (const sName of prevSheets) {
                    const prevDocId = `machine_${window._currentMachineId}_${prevMonth}_${sName}`;
                    try {
                        const prevDoc = await db.collection('analytics_sheets').doc(prevDocId).get();
                        if (prevDoc.exists) {
                            if (!sheetCustomerMaps[sName]) sheetCustomerMaps[sName] = new Map();
                            const map = sheetCustomerMaps[sName];
                            
                            const prevCustomers = prevDoc.data().customers || [];
                            prevCustomers.forEach(c => {
                                const key = String(c.code || c.id || c.name || '').trim();
                                if (!key) return;
                                const existing = map.get(key);
                                // Thêm nếu chưa có, HOẶC nếu tồn tại nhưng trống & chưa có _lastTxFromPrev
                                if (!existing || (Object.keys(existing.daily || {}).length === 0 && (existing.total || 0) === 0 && !existing._lastTxFromPrev)) {
                                    // Tính ngày GD cuối từ tháng này
                                    let lastTxFromPrev = null;
                                    if (c.daily) {
                                        let latestDate = null;
                                        Object.entries(c.daily).forEach(([h, v]) => {
                                            if ((v || 0) > 0) {
                                                const d = parseHeaderToDate(h);
                                                if (d && (!latestDate || d > latestDate)) {
                                                    latestDate = d;
                                                    lastTxFromPrev = h;
                                                }
                                            }
                                        });
                                    }
                                    const carriedCustomer = {
                                        code: c.code || '',
                                        name: c.name || '',
                                        cardType: c.cardType || '',
                                        total: 0,           // Tháng mới: chưa có GD nào
                                        daily: {},           // Tháng mới: daily trống
                                        _fromPrevMonth: prevMonth,  // Đánh dấu là KH carry-over
                                        _lastTxFromPrev: lastTxFromPrev  // Ngày GD cuối tháng trước
                                    };
                                    if (c.id !== undefined && c.id !== null) carriedCustomer.id = c.id;
                                    map.set(key, carriedCustomer);
                                }
                            });
                            
                            // Đảm bảo sheet name có trong uniqueSheets
                            uniqueSheets.add(sName);
                        }
                    } catch (e) {
                        console.warn(`[CARRY-OVER] Failed to load ${prevDocId}:`, e);
                    }
                }
                
                // Thêm headers từ tháng trước
                const prevHeaders = prevData?.headers || [];
                prevHeaders.forEach(h => allHeaders.add(h));
                
                console.log('[CARRY-OVER] Merged customers from', prevMonth, 'into', monthKey);
            }
        }

        // Rebuild dailyHeaders sau carry-over (có thể có thêm headers từ tháng trước)
        dailyHeaders = Array.from(allHeaders).filter(h => {
            const s = String(h).trim();
            return /^\d{1,2}月\d{1,2}日?$/.test(s) || (!isNaN(s) && Number(s) > 40000);
        }).sort((a, b) => {
            const parseDate = (headerKey) => {
                const s = String(headerKey).trim();
                if (!isNaN(s) && Number(s) > 40000) {
                    const u = new Date(Date.UTC(1899, 11, 30, 12, 0, 0) + Number(s) * 86400000);
                    return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate()).getTime();
                }
                const cnMatch = s.match(/^(\d{1,2})月(\d{1,2})日?$/);
                if (cnMatch) return new Date(new Date().getFullYear(), parseInt(cnMatch[1]) - 1, parseInt(cnMatch[2])).getTime();
                return 0;
            };
            return parseDate(a) - parseDate(b);
        });

        // Convert map back to array
        for (const [sName, map] of Object.entries(sheetCustomerMaps)) {
            allSheetsData[sName] = { customers: Array.from(map.values()) };
        }

        // Lưu cache dữ liệu thật (không phải tháng ảo) để modal chi tiết KH dùng
        const currentMachineMonths = machineData?.months || {};
        const isVirtualMonth = currentMachineMonths[monthKey]?._isVirtual;
        if (!isVirtualMonth && monthKey !== '__all__') {
            // Lưu dữ liệu tháng thật vào cache
            for (const [sName, sData] of Object.entries(allSheetsData)) {
                if (!_realSheetsCache[sName]) _realSheetsCache[sName] = { customers: [] };
                const existingMap = new Map();
                _realSheetsCache[sName].customers.forEach(c => {
                    const k = String(c.code || c.id || c.name || '').trim();
                    if (k) existingMap.set(k, c);
                });
                sData.customers.forEach(c => {
                    const k = String(c.code || c.id || c.name || '').trim();
                    if (!k) return;
                    if (existingMap.has(k)) {
                        const existing = existingMap.get(k);
                        existing.total += (c.total || 0);
                        Object.assign(existing.daily, c.daily || {});
                    } else {
                        existingMap.set(k, { ...c });
                    }
                });
                _realSheetsCache[sName].customers = Array.from(existingMap.values());
            }
        } else if (monthKey === '__all__') {
            // Khi xem tất cả → cache luôn là bản đầy đủ nhất
            _realSheetsCache = {};
            for (const [sName, sData] of Object.entries(allSheetsData)) {
                _realSheetsCache[sName] = { customers: sData.customers.map(c => ({ ...c, daily: { ...c.daily } })) };
            }
        }

        // Setup sheet dropdown
        sheetSelect.innerHTML = '';
        
        let allowedSheets = Array.from(uniqueSheets).sort();
        const role = window.currentUserRole || 'viewer';
        const userStaffName = window.currentUserEmail ? window.currentUserEmail.split('@')[0] : '';
        
        // Tất cả role đều thấy "Tổng hợp" + danh sách nhân viên
        const allOpt = document.createElement('option');
        allOpt.value = '__all__';
        allOpt.textContent = t('select_all');
        allOpt.setAttribute('data-i18n-key', 'select_all');
        sheetSelect.appendChild(allOpt);

        allowedSheets.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = t('select_staff_prefix') + name;
            opt.setAttribute('data-staff-name', name);
            sheetSelect.appendChild(opt);
        });
        
        // Nếu là staff, tự động chọn sheet của mình (nếu tồn tại)
        if (role === 'staff' && allowedSheets.includes(userStaffName)) {
            sheetSelect.value = userStaffName;
        }
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
        if (!sheet) return;
        const customers = sheet.customers || [];

        customers.forEach(item => {
            const key = String(item.code || item.id || item.name || '').trim();
            if (!key) return;

            if (customerMap.has(key)) {
                // Cộng dồn nếu trùng — iterate TẤT CẢ daily keys (không chỉ dailyHeaders)
                const existing = customerMap.get(key);
                if (item.daily) {
                    Object.entries(item.daily).forEach(([h, v]) => {
                        existing.daily[h] = (existing.daily[h] || 0) + (v || 0);
                    });
                }
                // Recalc total từ daily thực tế
                existing.total = Object.values(existing.daily).reduce((s, v) => s + (Number(v) || 0), 0);
                existing._staffList.push(sheetName);
                // Preserve _lastTxFromPrev nếu existing chưa có
                if (!existing._lastTxFromPrev && item._lastTxFromPrev) {
                    existing._lastTxFromPrev = item._lastTxFromPrev;
                }
            } else {
                const daily = { ...(item.daily || {}) };
                customerMap.set(key, {
                    id: item.id,
                    code: item.code || '',
                    name: item.name,
                    cardType: item.cardType || '',
                    total: Object.values(daily).reduce((s, v) => s + (Number(v) || 0), 0),
                    daily,
                    _staffList: [sheetName],
                    _lastTxFromPrev: item._lastTxFromPrev || null
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
        daily: 'daily_title',
        settings: 'title_settings'
    };
    $('pageTitle').textContent = t(titleKeys[section] || 'appName');

    if (section === 'compare') renderCompare();
    if (section === 'trends') renderTrends();
    if (section === 'inactive') renderInactive();
    if (section === 'daily') renderDailyReport();

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
    
    if (highDaysThresholdInput && lowDaysThresholdInput) {
        let highDays = parseInt(highDaysThresholdInput.value);
        let lowDays = parseInt(lowDaysThresholdInput.value);
        if (lowDays > highDays) {
            if (this === highDaysThresholdInput) { lowDaysThresholdInput.value = highDays; lowDays = highDays; }
            else { highDaysThresholdInput.value = lowDays; highDays = lowDays; }
        }
        if (highDaysValLabel) highDaysValLabel.textContent = highDays;
        if (lowDaysValLabel) lowDaysValLabel.textContent = lowDays;
    }

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
    
    // Fallback if elements not found
    const highDaysThresh = highDaysThresholdInput ? parseInt(highDaysThresholdInput.value) : 15;
    const lowDaysThresh = lowDaysThresholdInput ? parseInt(lowDaysThresholdInput.value) : 3;

    let highCount = 0, normalCount = 0, lowCount = 0, totalVolume = 0;
    currentSheetData.sort((a, b) => b.total - a.total);

    const labels = [], totals = [], bgColors = [];

    currentSheetData.forEach(item => {
        totalVolume += item.total;
        
        // Tính số ngày active
        const daily = item.daily || {};
        const activeDays = Object.values(daily).filter(val => val > 0).length;

        if (item.total >= highThresh || activeDays >= highDaysThresh) { 
            highCount++; 
            item._category = 'high'; 
        }
        else if (item.total <= lowThresh && activeDays <= lowDaysThresh) { 
            lowCount++; 
            item._category = 'low'; 
        }
        else { 
            normalCount++; 
            item._category = 'normal'; 
        }

        labels.push((item.name || item.id || item.code || '—').substring(0, 22));
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
    let lastDate = null;
    let lastHeaderKey = null;
    Object.entries(daily).forEach(([h, v]) => {
        if ((v || 0) > 0) {
            const d = parseHeaderToDate(h);
            if (d && (!lastDate || d > lastDate)) {
                lastDate = d;
                lastHeaderKey = h;
            }
        }
    });
    // Fallback: dùng ngày GD cuối từ tháng trước (carry-over)
    if (!lastHeaderKey && item._lastTxFromPrev) {
        return item._lastTxFromPrev;
    }
    return lastHeaderKey;
}

function renderTable() {
    const query = searchInput.value.toLowerCase();
    const filter = filterCategory.value;
    const maxTotal = currentSheetData.length > 0 ? currentSheetData[0].total : 1;
    const tbody = document.querySelector('#dataTable tbody');

    // Đếm số lượng mã khách để tìm trùng lặp
    const codeCounts = {};
    currentSheetData.forEach(item => {
        const code = String(item.code || '').trim();
        if (code) {
            codeCounts[code] = (codeCounts[code] || 0) + 1;
        }
    });

    let filtered = currentSheetData.filter(item => {
        if (filter !== 'all' && item._category !== filter) return false;
        if (query && !(item.code + ' ' + item.name + ' ' + item.cardType + ' ' + item.id).toLowerCase().includes(query)) return false;
        return true;
    });

    // Use DocumentFragment to batch DOM insertions (avoids reflow per row)
    const frag = document.createDocumentFragment();
    filtered.forEach((item, idx) => {
        const pct = maxTotal > 0 ? (item.total / maxTotal * 100) : 0;
        const barColor = item._category === 'high' ? 'var(--green)' : item._category === 'low' ? 'var(--red)' : 'var(--blue)';
        const cardTypeDisplay = item.cardType || '<span style="color:var(--text-secondary)">—</span>';
        const staffDisplay = item._staffList ? item._staffList.join(', ') : $('sheetSelect').value;
        const lastTxHeader = getLastTxDate(item);
        const lastTxDisplay = lastTxHeader ? formatDateLabel(lastTxHeader) : `<span class="tag tag-low">${t('never_tx')}</span>`;
        
        // Cảnh báo trùng mã
        const code = String(item.code || '').trim();
        const isDuplicate = code && codeCounts[code] > 1;
        const codeDisplay = isDuplicate 
            ? `<strong>${item.code || item.id}</strong> <i class="fas fa-exclamation-triangle text-red" title="Trùng mã khách hàng!" style="margin-left:5px; font-size: 14px;"></i>` 
            : `<strong>${item.code || item.id}</strong>`;

        const tr = document.createElement('tr');
        if (isDuplicate) tr.style.backgroundColor = 'rgba(239, 68, 68, 0.05)'; // Highlight nhẹ hàng bị trùng

        tr.innerHTML = `
            <td style="font-weight:600;color:var(--text-secondary)">${idx + 1}</td>
            <td>${codeDisplay}</td>
            <td>${item.name}</td>
            <td>${cardTypeDisplay}</td>
            <td><span class="tag" style="background: var(--bg-hover); color: var(--text-primary);"><i class="fas fa-user-circle"></i> ${staffDisplay}</span></td>
            <td style="font-weight:700;">${fmt(item.total)}</td>
            <td>${lastTxDisplay}</td>
            <td><div class="progress-bar-container"><div class="progress-bar-fill" style="width:${pct}%;background:${barColor};"></div></div></td>`;
        tr.addEventListener('click', () => openCustomerDetail(item));
        frag.appendChild(tr);
    });
    tbody.innerHTML = '';
    tbody.appendChild(frag);
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

    // Tìm ngày cuối cùng có bất kỳ giao dịch nào trên toàn sheet
    let latestActiveIndex = -1;
    for (let i = dailyHeaders.length - 1; i >= 0; i--) {
        const header = dailyHeaders[i];
        for (const item of currentSheetData) {
            if ((item.daily[header] || 0) > 0) {
                latestActiveIndex = i;
                break;
            }
        }
        if (latestActiveIndex !== -1) break;
    }

    // Nếu sheet hoàn toàn trống, fallback về ngày cuối tháng
    if (latestActiveIndex === -1) {
        latestActiveIndex = dailyHeaders.length - 1;
    }

    const startIndex = Math.max(0, latestActiveIndex - nDays + 1);
    const lastNHeaders = dailyHeaders.slice(startIndex, latestActiveIndex + 1);
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

// ── Báo Cáo Ngày (Daily Report) ──
function renderDailyReport() {
    const tbody = document.querySelector('#dailyTable tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    // Khởi tạo data theo từng ngày
    const dailyStats = {};
    dailyHeaders.forEach(h => {
        dailyStats[h] = {
            dateStr: formatDateLabel(h),
            pcVol: 0,
            pcTx: 0,
            cardVol: 0,
            cardTx: 0,
            totalVol: 0
        };
    });

    // Duyệt qua tất cả khách hàng
    currentSheetData.forEach(item => {
        const isPC = item.cardType && item.cardType.toUpperCase().includes('PC');
        const daily = item.daily || {};

        dailyHeaders.forEach(h => {
            const vol = daily[h] || 0;
            if (vol > 0) {
                if (isPC) {
                    dailyStats[h].pcVol += vol;
                    dailyStats[h].pcTx += 1;
                } else {
                    dailyStats[h].cardVol += vol;
                    dailyStats[h].cardTx += 1;
                }
                dailyStats[h].totalVol += vol;
            }
        });
    });

    // Tính tổng
    let sumPcVol = 0, sumPcTx = 0, sumCardVol = 0, sumCardTx = 0, sumTotalAll = 0;
    
    // Sắp xếp ngày từ cũ đến mới để tính tăng trưởng
    const sortedHeaders = [...dailyHeaders].sort((a, b) => {
        const dA = parseHeaderToDate(a);
        const dB = parseHeaderToDate(b);
        if (!dA || !dB) return 0;
        return dA - dB;
    });

    let prevTotal = 0;

    // Lặp ngược lại để hiển thị ngày mới nhất lên đầu bảng
    [...sortedHeaders].reverse().forEach(h => {
        const s = dailyStats[h];
        if (!s || s.totalVol === 0) return; // Bỏ qua ngày không có dữ liệu

        sumPcVol += s.pcVol;
        sumPcTx += s.pcTx;
        sumCardVol += s.cardVol;
        sumCardTx += s.cardTx;
        sumTotalAll += s.totalVol;

        // Tìm prevTotal (tìm ngày liền trước có dữ liệu)
        const currIdx = sortedHeaders.indexOf(h);
        let pastTotal = 0;
        for (let i = currIdx - 1; i >= 0; i--) {
            if (dailyStats[sortedHeaders[i]].totalVol > 0) {
                pastTotal = dailyStats[sortedHeaders[i]].totalVol;
                break;
            }
        }

        let growthHtml = '-';
        if (pastTotal > 0) {
            const pct = Math.round((s.totalVol - pastTotal) / pastTotal * 100);
            if (pct > 0) growthHtml = `<span class="tag tag-high"><i class="fas fa-arrow-up"></i> ${pct}%</span>`;
            else if (pct < 0) growthHtml = `<span class="tag tag-low"><i class="fas fa-arrow-down"></i> ${Math.abs(pct)}%</span>`;
            else growthHtml = `<span style="color:var(--text-secondary)">0%</span>`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-weight:600;">${s.dateStr}</td>
            <td style="color:var(--blue); font-weight:500;">${fmt(s.pcVol)}</td>
            <td>${s.pcTx}</td>
            <td style="color:var(--green); font-weight:500;">${fmt(s.cardVol)}</td>
            <td>${s.cardTx}</td>
            <td style="font-weight:bold;">${fmt(s.totalVol)}</td>
            <td>${growthHtml}</td>
        `;
        tbody.appendChild(tr);
    });

    // Update footer
    if ($('dailyTotalPcVol')) $('dailyTotalPcVol').textContent = fmt(sumPcVol);
    if ($('dailyTotalPcTx')) $('dailyTotalPcTx').textContent = fmt(sumPcTx);
    if ($('dailyTotalCardVol')) $('dailyTotalCardVol').textContent = fmt(sumCardVol);
    if ($('dailyTotalCardTx')) $('dailyTotalCardTx').textContent = fmt(sumCardTx);
    if ($('dailyTotalAll')) $('dailyTotalAll').textContent = fmt(sumTotalAll);
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
    if (!isNaN(val) && Number(val) > 40000) {
        const u = new Date(Date.UTC(1899, 11, 30, 12, 0, 0) + Number(val) * 86400000);
        const date = new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate());
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
    if (!isNaN(s) && Number(s) > 40000) {
        const u = new Date(Date.UTC(1899, 11, 30, 12, 0, 0) + Number(s) * 86400000);
        return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate());
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

// Cache dữ liệu KH đã fetch từ Firestore (tránh fetch lại mỗi lần click)
let _customerDataCache = {};

// Open detail modal
async function openCustomerDetail(item) {
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

    const machineData = systemMeta?.machines?.[`machine_${window._currentMachineId}`] || systemMeta?.machines?.[window._currentMachineId];
    const currentMData = machineData?.months?.[currentMonthKey];
    const isViewingVirtual = currentMData && currentMData._isVirtual;

    let headersToUse = dailyHeaders;
    let dailyToUse = item.daily || {};

    const allRealHeaders = new Set();
    let mergedDaily = {};
    const customerKey = String(item.code || item.id || item.name || '').trim();
    const cacheKey = `${window._currentMachineId}_${customerKey}`;

    // Dùng cache nếu có
    if (_customerDataCache[cacheKey]) {
        const cached = _customerDataCache[cacheKey];
        mergedDaily = { ...cached.daily };
        cached.headers.forEach(h => allRealHeaders.add(h));
    } else {
        // Fetch từ Firestore — chỉ lần đầu
        const itemName = String(item.name || '').trim();
        const itemCode = String(item.code || '').trim();
        const itemId = String(item.id || '').trim();
        const itemNumeric = String(item.code || item.id || '').replace(/\D/g, '').replace(/^0+/, '');
        const norm = s => s.replace(/\s+/g, '').toLowerCase();

        // Thu thập tất cả sheet names và months
        const allSheetNames = new Set();
        const realMonthKeys = [];
        if (machineData?.months) {
            for (const [mKey, mData] of Object.entries(machineData.months)) {
                if (mData._isVirtual) continue;
                realMonthKeys.push(mKey);
                mData.headers?.forEach(h => allRealHeaders.add(h));
                (mData.sheetNames || []).forEach(s => allSheetNames.add(s));
            }
        }

        // Fetch SONG SONG tất cả docs (nhanh hơn nhiều)
        const docRequests = []; // [{id, monthKey}]
        for (const mKey of realMonthKeys) {
            for (const sName of allSheetNames) {
                docRequests.push({
                    id: `machine_${window._currentMachineId}_${mKey}_${sName}`,
                    monthKey: mKey  // VD: "2026-06"
                });
            }
        }

        const docs = await Promise.all(
            docRequests.map(r => db.collection('analytics_sheets').doc(r.id).get().catch(() => null))
        );

        docs.forEach((doc, i) => {
            if (!doc || !doc.exists) return;
            const docMonthKey = docRequests[i].monthKey; // Tháng của document này
            const custs = doc.data().customers || [];
            
            custs.forEach(c => {
                const cKey = String(c.code || c.id || c.name || '').trim();
                const cName = String(c.name || '').trim();
                const cCode = String(c.code || '').trim();
                const cId = String(c.id || '').trim();
                const cNumeric = String(c.code || c.id || '').replace(/\D/g, '').replace(/^0+/, '');
                
                let matched = false;
                if (cKey && cKey === customerKey) matched = true;
                if (!matched && itemName && cName === itemName) matched = true;
                if (!matched && itemName && norm(cName) === norm(itemName)) matched = true;
                if (!matched && itemCode && (cCode === itemCode || cId === itemCode)) matched = true;
                if (!matched && itemId && (cCode === itemId || cId === itemId)) matched = true;
                if (!matched && itemNumeric.length >= 3 && cNumeric === itemNumeric) matched = true;
                
                if (matched && c.daily) {
                    Object.entries(c.daily).forEach(([h, v]) => {
                        if (v > 0) {
                            // Kiểm tra: header date phải thuộc đúng tháng của document
                            const parsedDate = parseHeaderToDate(h);
                            if (parsedDate) {
                                const hMonthKey = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}`;
                                if (hMonthKey !== docMonthKey) return; // Ngày không thuộc tháng này → bỏ qua
                            }
                            mergedDaily[h] = v;
                            allRealHeaders.add(h);
                        }
                    });
                }
            });
        });

        // Lưu vào cache
        _customerDataCache[cacheKey] = {
            daily: { ...mergedDaily },
            headers: [...allRealHeaders]
        };
    }

    // Luôn ưu tiên dùng dữ liệu đã merge từ tất cả các tháng để hiển thị đầy đủ lịch sử
    headersToUse = Array.from(allRealHeaders).filter(h => {
        const s = String(h).trim();
        return /^\d{1,2}月\d{1,2}日?$/.test(s) || (!isNaN(s) && Number(s) > 40000);
    }).sort((a, b) => {
        const parseDate = (headerKey) => {
            const s = String(headerKey).trim();
            if (!isNaN(s) && Number(s) > 40000) {
                const u = new Date(Date.UTC(1899, 11, 30, 12, 0, 0) + Number(s) * 86400000);
                return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate()).getTime();
            }
            const cnMatch = s.match(/^(\d{1,2})月(\d{1,2})日?$/);
            if (cnMatch) return new Date(new Date().getFullYear(), parseInt(cnMatch[1]) - 1, parseInt(cnMatch[2])).getTime();
            return 0;
        };
        return parseDate(a) - parseDate(b);
    });

    if (Object.keys(mergedDaily).length > 0) {
        dailyToUse = mergedDaily;
    }

    // Parse all dates and group by month
    const dateEntries = []; // [{date, headerKey, value}]
    
    headersToUse.forEach(h => {
        const d = parseHeaderToDate(h);
        if (d) {
            dateEntries.push({ date: d, headerKey: h, value: dailyToUse[h] || 0 });
        }
    });

    // Group months
    const months = {};
    dateEntries.forEach(e => {
        const key = `${e.date.getFullYear()}-${String(e.date.getMonth() + 1).padStart(2, '0')}`;
        if (!months[key]) months[key] = [];
        months[key].push(e);
    });

    // Nếu đang xem tháng ảo → thêm tháng hiện tại vào dropdown (dù chưa có giao dịch)
    if (isViewingVirtual) {
        const now = new Date();
        const curMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        if (!months[curMonthKey]) {
            // Tạo entries rỗng cho tất cả ngày trong tháng hiện tại
            const year = now.getFullYear();
            const month = now.getMonth(); // 0-indexed
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            months[curMonthKey] = [];
            for (let d = 1; d <= daysInMonth; d++) {
                months[curMonthKey].push({
                    date: new Date(year, month, d),
                    headerKey: `${month + 1}月${d}日`,
                    value: 0
                });
            }
        }
    }

    const monthKeys = Object.keys(months).sort();

    // Summary stats sẽ được tính trong renderDetailForMonth theo tháng đang chọn

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

    // Default: ưu tiên tháng hiện tại, nếu không có thì tháng gần nhất có giao dịch
    const now = new Date();
    const currentCalMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let defaultMonth = '__all__';
    if (monthKeys.includes(currentCalMonth)) {
        defaultMonth = currentCalMonth;
    } else {
        for (let i = monthKeys.length - 1; i >= 0; i--) {
            const hasAny = months[monthKeys[i]].some(e => e.value > 0);
            if (hasAny) { defaultMonth = monthKeys[i]; break; }
        }
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

    // Cập nhật summary stats theo tháng đang chọn
    const activeDays = entriesToShow.filter(e => e.value > 0).length;
    const totalVal = entriesToShow.reduce((s, e) => s + e.value, 0);
    $('detailTotal').textContent = fmt(totalVal);
    $('detailActiveDays').textContent = activeDays;
    $('detailAvgDaily').textContent = activeDays > 0 ? fmt(Math.round(totalVal / activeDays)) : '0';

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

        // Build lookup: day → {value, headerKey}
        const dayLookup = {};
        entriesToShow.forEach(e => {
            dayLookup[e.date.getDate()] = { value: e.value, headerKey: e.headerKey };
        });

        // Empty cells before first day
        for (let i = 0; i < firstDay; i++) {
            calendar.innerHTML += `<div class="detail-cal-day empty"></div>`;
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const info = dayLookup[d] || { value: 0, headerKey: null };
            const val = info.value;
            let cls = 'detail-cal-day editable';
            if (val > 0) {
                cls += val >= maxVal * 0.5 ? ' has-tx-high' : ' has-tx';
            } else {
                cls += ' no-tx';
            }
            const valDisplay = val > 0 ? `<span class="cal-val">${val}</span>` : '';
            const cell = document.createElement('div');
            cell.className = cls;
            cell.setAttribute('data-day', d);
            cell.innerHTML = `<span class="cal-date">${d}</span>${valDisplay}`;
            cell.addEventListener('click', (e) => {
                e.stopPropagation();
                showDayEditPopup(cell, d, year, month);
            });
            calendar.appendChild(cell);
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
    if (e.key === 'Escape') {
        // Nếu đang edit popup → chỉ đóng popup, không đóng modal
        if (_editPopupEl) { closeDayEditPopup(); return; }
        if ($('detailModal').classList.contains('active')) closeCustomerDetail();
    }
});

// ══════════════════════════════════════════════════
// ══════ INLINE DAY EDITING ═══════════════════════
// ══════════════════════════════════════════════════

let _editPopupEl = null;

// Xác định tên nhân viên quản lý khách hàng hiện tại
function getCustomerStaffName() {
    if (sheetSelect.value !== '__all__') return sheetSelect.value;
    if (_detailCurrentItem && _detailCurrentItem._staffList && _detailCurrentItem._staffList.length > 0) {
        return _detailCurrentItem._staffList[0];
    }
    const key = String(_detailCurrentItem.code || _detailCurrentItem.id || _detailCurrentItem.name || '').trim();
    for (const [sheetName, sheet] of Object.entries(allSheetsData)) {
        if ((sheet.customers || []).some(c => String(c.code || c.id || c.name || '').trim() === key)) {
            return sheetName;
        }
    }
    return null;
}

// Tạo header key cho ngày mới, dựa theo format của dữ liệu đã có
function getHeaderKeyForDate(year, month, day) {
    const existing = dailyHeaders.filter(h => {
        const d = parseHeaderToDate(h);
        return d && d.getMonth() === month - 1 && d.getFullYear() === year;
    });
    if (existing.length > 0) {
        const sample = String(existing[0]).trim();
        if (!isNaN(sample) && Number(sample) > 40000) {
            const target = Date.UTC(year, month - 1, day, 12, 0, 0);
            const epoch = Date.UTC(1899, 11, 30, 12, 0, 0);
            return String(Math.round((target - epoch) / 86400000));
        }
    }
    return `${month}月${day}日`;
}

// Tìm header key đã tồn tại cho 1 ngày cụ thể
function findExistingHeaderKey(dayNum, month, year) {
    for (const h of dailyHeaders) {
        const d = parseHeaderToDate(h);
        if (d && d.getDate() === dayNum && d.getMonth() === month - 1 && d.getFullYear() === year) {
            return h;
        }
    }
    return null;
}

// Hiển thị popup chỉnh sửa tại ô ngày
function showDayEditPopup(cell, dayNum, year, month) {
    if (window.currentUserRole === 'viewer') return;
    
    closeDayEditPopup();

    const selectedMonth = $('detailMonthSelect').value;
    if (selectedMonth === '__all__') {
        alert(t('edit_select_month_first'));
        return;
    }

    const daily = _detailCurrentItem.daily || {};
    const existingKey = findExistingHeaderKey(dayNum, month, year);
    const currentValue = existingKey ? (daily[existingKey] || 0) : 0;

    // Đánh dấu cell đang edit
    document.querySelectorAll('.detail-cal-day.editing').forEach(el => el.classList.remove('editing'));
    cell.classList.add('editing');

    const popup = document.createElement('div');
    popup.className = 'cal-edit-popup';
    popup.innerHTML = `
        <div class="cal-edit-title">
            <i class="fas fa-edit"></i>
            ${t('edit_day_title')} ${String(dayNum).padStart(2,'0')}/${String(month).padStart(2,'0')}
        </div>
        <div class="cal-edit-input-wrap">
            <input type="number" class="cal-edit-input" id="calEditInput"
                   value="${currentValue}" min="0" step="1" placeholder="0" autocomplete="off" />
            <div class="cal-edit-label">${t('edit_input_label')}</div>
        </div>
        <div class="cal-edit-actions">
            <button class="cal-edit-btn cal-edit-cancel" id="calEditCancelBtn">
                <i class="fas fa-times"></i> ${t('edit_cancel')}
            </button>
            <button class="cal-edit-btn cal-edit-save" id="calEditSaveBtn">
                <i class="fas fa-check"></i> ${t('edit_save')}
            </button>
        </div>
    `;

    const calendar = $('detailCalendar');
    calendar.style.position = 'relative';
    calendar.appendChild(popup);

    // Vị trí popup gần ô cell
    const cellRect = cell.getBoundingClientRect();
    const calRect = calendar.getBoundingClientRect();
    let left = cellRect.left - calRect.left + cellRect.width / 2 - 105;
    let top = cellRect.bottom - calRect.top + 8;
    if (left < 0) left = 4;
    if (left + 210 > calRect.width) left = calRect.width - 214;
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';

    _editPopupEl = popup;

    // Focus input
    setTimeout(() => {
        const input = $('calEditInput');
        if (input) { input.focus(); input.select(); }
    }, 60);

    // Cancel
    popup.querySelector('#calEditCancelBtn').addEventListener('click', () => closeDayEditPopup());

    // Save
    popup.querySelector('#calEditSaveBtn').addEventListener('click', () => {
        const val = parseInt($('calEditInput').value) || 0;
        saveDayTransaction(dayNum, year, month, val, cell);
    });

    // Enter = save, Escape = cancel
    popup.querySelector('.cal-edit-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const val = parseInt($('calEditInput').value) || 0;
            saveDayTransaction(dayNum, year, month, val, cell);
        }
        if (e.key === 'Escape') closeDayEditPopup();
    });

    // Click bên ngoài popup → đóng
    setTimeout(() => {
        const outsideHandler = (e) => {
            if (_editPopupEl && !_editPopupEl.contains(e.target) && !cell.contains(e.target)) {
                closeDayEditPopup();
                document.removeEventListener('click', outsideHandler);
            }
        };
        document.addEventListener('click', outsideHandler);
    }, 100);
}

function closeDayEditPopup() {
    if (_editPopupEl) {
        _editPopupEl.remove();
        _editPopupEl = null;
    }
    document.querySelectorAll('.detail-cal-day.editing').forEach(el => el.classList.remove('editing'));
}

// ── Lưu giao dịch ngày vào Firestore ──
async function saveDayTransaction(dayNum, year, month, newValue, cell) {
    // Clear customer detail cache vì data đang thay đổi
    _customerDataCache = {};

    const saveBtn = document.querySelector('#calEditSaveBtn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${t('edit_saving')}`;
    }

    const staffName = getCustomerStaffName();
    if (!staffName) {
        alert(t('edit_no_staff'));
        closeDayEditPopup();
        return;
    }

    const monthKey = `${year}-${String(month).padStart(2, '0')}`;
    const machineId = window._currentMachineId;
    const docId = `machine_${machineId}_${monthKey}_${staffName}`;
    const customerKey = String(_detailCurrentItem.code || _detailCurrentItem.id || _detailCurrentItem.name || '').trim();

    // Xác định header key
    let headerKey = findExistingHeaderKey(dayNum, month, year);
    if (!headerKey) headerKey = getHeaderKeyForDate(year, month, dayNum);

    try {
        const docRef = db.collection('analytics_sheets').doc(docId);
        const doc = await docRef.get();

        let customers = [];
        if (doc.exists) {
            customers = doc.data().customers || [];
        } else {
            // Doc chưa tồn tại — nếu là tháng ảo, carry-over tất cả KH từ tháng nguồn
            const machineMetaKeyCheck = systemMeta?.machines?.[`machine_${machineId}`] ? `machine_${machineId}` : String(machineId);
            const virtualMData = systemMeta?.machines?.[machineMetaKeyCheck]?.months?.[monthKey];
            if (virtualMData && virtualMData._isVirtual && virtualMData._sourceMonth) {
                const sourceDocId = `machine_${machineId}_${virtualMData._sourceMonth}_${staffName}`;
                try {
                    const sourceDoc = await db.collection('analytics_sheets').doc(sourceDocId).get();
                    if (sourceDoc.exists) {
                        customers = (sourceDoc.data().customers || []).map(c => {
                            const cleaned = {
                                code: c.code || '',
                                name: c.name || '',
                                cardType: c.cardType || '',
                                total: 0,
                                daily: {}
                            };
                            if (c.id !== undefined && c.id !== null) cleaned.id = c.id;
                            return cleaned;
                        });
                        console.log(`[SAVE] Carry-over ${customers.length} KH từ ${virtualMData._sourceMonth}`);
                    }
                } catch (e) {
                    console.warn('[SAVE] Failed to carry-over:', e);
                }
            }
        }

        let found = false;
        let oldValLog = 0;
        
        customers.forEach(c => {
            const k = String(c.code || c.id || c.name || '').trim();
            if (k === customerKey) {
                if (!c.daily) c.daily = {};
                oldValLog = c.daily[headerKey] || 0;
                c.daily[headerKey] = newValue;
                c.total = Object.values(c.daily).reduce((sum, v) => sum + (Number(v) || 0), 0);
                found = true;
            }
        });

        if (!found) {
            // Khách hàng chưa tồn tại trong tháng này -> Tạo mới
            const newCustomer = {
                code: _detailCurrentItem.code || '',
                name: _detailCurrentItem.name || '',
                cardType: _detailCurrentItem.cardType || '',
                daily: { [headerKey]: newValue },
                total: Number(newValue) || 0
            };
            // Giữ lại id nếu có (quan trọng để tìm kiếm xuyên sheet)
            if (_detailCurrentItem.id !== undefined && _detailCurrentItem.id !== null) {
                newCustomer.id = _detailCurrentItem.id;
            }
            customers.push(newCustomer);
        }

        // Ghi lại vào Firestore
        if (doc.exists) {
            await docRef.update({ customers });
        } else {
            await docRef.set({ customers });
        }

        // ── Xóa giá trị trùng ở các sheet khác (tránh cộng dồn khi hiển thị) ──
        const machineMetaKeyClean = systemMeta?.machines?.[`machine_${machineId}`] ? `machine_${machineId}` : String(machineId);
        const allMachineMonths = systemMeta?.machines?.[machineMetaKeyClean]?.months || {};
        // Thu thập TẤT CẢ sheet names từ TẤT CẢ tháng (giống modal)
        const allCleanupSheets = new Set();
        Object.values(allMachineMonths).forEach(m => (m.sheetNames || []).forEach(s => allCleanupSheets.add(s)));
        allCleanupSheets.delete(staffName); // Bỏ sheet vừa save
        
        const itemNameClean = String(_detailCurrentItem?.name || '').replace(/\s+/g, '').toLowerCase();
        const itemNumClean = String(_detailCurrentItem?.code || _detailCurrentItem?.id || '').replace(/\D/g, '').replace(/^0+/, '');
        
        for (const otherSheet of allCleanupSheets) {
            const otherDocId = `machine_${machineId}_${monthKey}_${otherSheet}`;
            try {
                const otherDoc = await db.collection('analytics_sheets').doc(otherDocId).get();
                if (!otherDoc.exists) continue;
                const otherCustomers = otherDoc.data().customers || [];
                let changed = false;
                otherCustomers.forEach(c => {
                    // Fuzzy matching (giống modal)
                    const k = String(c.code || c.id || c.name || '').trim();
                    const cName = String(c.name || '').replace(/\s+/g, '').toLowerCase();
                    const cNum = String(c.code || c.id || '').replace(/\D/g, '').replace(/^0+/, '');
                    let match = (k && k === customerKey);
                    if (!match && itemNameClean && cName === itemNameClean) match = true;
                    if (!match && itemNumClean.length >= 3 && cNum === itemNumClean) match = true;
                    
                    if (match && c.daily && c.daily[headerKey] !== undefined) {
                        delete c.daily[headerKey];
                        c.total = Object.values(c.daily).reduce((s, v) => s + (Number(v) || 0), 0);
                        changed = true;
                    }
                });
                if (changed) {
                    await db.collection('analytics_sheets').doc(otherDocId).update({ customers: otherCustomers });
                }
            } catch (e) { /* ignore */ }
        }

        // ── Đảm bảo tháng tồn tại trong Firestore meta (quan trọng cho tháng ảo!) ──
        // Xác định đúng key máy trong systemMeta (có thể là "1" hoặc "machine_1")
        const machineMetaKey = systemMeta?.machines?.[`machine_${machineId}`] ? `machine_${machineId}` : String(machineId);
        let monthMeta = systemMeta?.machines?.[machineMetaKey]?.months?.[monthKey];
        
        if (!monthMeta || monthMeta._isVirtual) {
            // Tháng chưa tồn tại thật trong Firestore → tạo mới
            console.log(`[SAVE] Tạo tháng ${monthKey} thật trong Firestore meta`);
            
            // Lấy sheetNames từ tháng nguồn hoặc tháng ảo
            const sourceMonth = monthMeta?._sourceMonth;
            const sourceData = sourceMonth ? systemMeta?.machines?.[machineMetaKey]?.months?.[sourceMonth] : null;
            const baseSheetNames = sourceData?.sheetNames || [];
            const updatedSheets = [...new Set([...baseSheetNames, staffName])];
            
            const newMonthMeta = {
                sheetNames: updatedSheets,
                headers: [headerKey],
                uploadedAt: new Date().toISOString()
            };
            
            // Cập nhật Firestore meta
            await db.collection('analytics').doc('meta').update({
                [`machines.${machineMetaKey}.months.${monthKey}`]: newMonthMeta
            });
            
            // Cập nhật local state (bỏ đánh dấu ảo)
            if (!systemMeta.machines[machineMetaKey]) {
                systemMeta.machines[machineMetaKey] = { id: machineId, name: `Máy 00${machineId}`, months: {} };
            }
            systemMeta.machines[machineMetaKey].months[monthKey] = newMonthMeta;
            
            // Tạo document Firestore cho các sheet khác (carry-over KH từ tháng nguồn)
            if (sourceMonth) {
                for (const sName of baseSheetNames) {
                    if (sName === staffName) continue; // Đã lưu ở trên rồi
                    const otherDocId = `machine_${machineId}_${monthKey}_${sName}`;
                    const otherDocRef = db.collection('analytics_sheets').doc(otherDocId);
                    const otherDoc = await otherDocRef.get();
                    if (!otherDoc.exists) {
                        // Copy KH từ tháng nguồn, reset daily/total = 0
                        const sourceDocId = `machine_${machineId}_${sourceMonth}_${sName}`;
                        const sourceDoc = await db.collection('analytics_sheets').doc(sourceDocId).get();
                        if (sourceDoc.exists) {
                            const sourceCustomers = sourceDoc.data().customers || [];
                            const zeroedCustomers = sourceCustomers.map(c => {
                                const cleaned = {
                                    code: c.code || '',
                                    name: c.name || '',
                                    cardType: c.cardType || '',
                                    total: 0,
                                    daily: {}
                                };
                                if (c.id !== undefined && c.id !== null) cleaned.id = c.id;
                                return cleaned;
                            });
                            await otherDocRef.set({ customers: zeroedCustomers });
                        }
                    }
                }
            }
        } else {
            // Tháng đã tồn tại → chỉ cập nhật sheetNames nếu cần
            const updatedSheets = [...new Set([...(monthMeta.sheetNames || []), staffName])];
            if (updatedSheets.length !== (monthMeta.sheetNames || []).length) {
                monthMeta.sheetNames = updatedSheets;
                await db.collection('analytics').doc('meta').update({
                    [`machines.${machineMetaKey}.months.${monthKey}.sheetNames`]: updatedSheets
                });
            }
        }

        // Ghi Audit Log
        if (typeof logAudit === 'function') {
            logAudit('UPDATE_DAILY_VOL', {
                machineId: machineId,
                month: monthKey,
                staff: staffName,
                customerCode: customerKey,
                dateKey: headerKey,
                oldValue: oldValLog,
                newValue: newValue
            });
        }

        // Cập nhật header trong meta nếu là ngày mới
        if (!dailyHeaders.includes(headerKey)) {
            dailyHeaders.push(headerKey);
            dailyHeaders.sort((a, b) => {
                const parseD = (hk) => {
                    const s = String(hk).trim();
                    if (!isNaN(s) && Number(s) > 40000) {
                        const u = new Date(Date.UTC(1899, 11, 30, 12, 0, 0) + Number(s) * 86400000);
                        return new Date(u.getUTCFullYear(), u.getUTCMonth(), u.getUTCDate()).getTime();
                    }
                    const m = s.match(/^(\d{1,2})月(\d{1,2})日?$/);
                    if (m) return new Date(new Date().getFullYear(), parseInt(m[1]) - 1, parseInt(m[2])).getTime();
                    return 0;
                };
                return parseD(a) - parseD(b);
            });

            // Cập nhật meta trên Firestore
            try {
                const metaPath = `machines.machine_${machineId}.months.${monthKey}.headers`;
                const monthMeta = systemMeta?.machines?.[`machine_${machineId}`]?.months?.[monthKey];
                if (monthMeta) {
                    const updatedHeaders = [...new Set([...(monthMeta.headers || []), headerKey])];
                    monthMeta.headers = updatedHeaders;
                    await db.collection('analytics').doc('meta').update({
                        [`machines.machine_${machineId}.months.${monthKey}.headers`]: updatedHeaders
                    });
                }
            } catch (metaErr) {
                console.warn('Meta header update failed (non-critical):', metaErr);
            }
        }

        // ── Cập nhật local state ──
        // Update allSheetsData
        const localSheet = allSheetsData[staffName];
        if (localSheet) {
            const localCustomers = localSheet.customers || [];
            localCustomers.forEach(c => {
                const k = String(c.code || c.id || c.name || '').trim();
                if (k === customerKey) {
                    if (!c.daily) c.daily = {};
                    c.daily[headerKey] = newValue;
                    c.total = Object.values(c.daily).reduce((sum, v) => sum + (Number(v) || 0), 0);
                }
            });
        }

        // Update _detailCurrentItem (item đang mở modal)
        if (!_detailCurrentItem.daily) _detailCurrentItem.daily = {};
        _detailCurrentItem.daily[headerKey] = newValue;
        _detailCurrentItem.total = Object.values(_detailCurrentItem.daily)
            .reduce((sum, v) => sum + (Number(v) || 0), 0);

        // Cập nhật currentSheetData
        currentSheetData.forEach(c => {
            const k = String(c.code || c.id || c.name || '').trim();
            if (k === customerKey) {
                if (!c.daily) c.daily = {};
                c.daily[headerKey] = newValue;
                c.total = Object.values(c.daily).reduce((sum, v) => sum + (Number(v) || 0), 0);
            }
        });

        // Đóng popup
        closeDayEditPopup();

        // Flash animation trên cell vừa save
        if (cell) {
            cell.classList.add('just-saved');
            setTimeout(() => cell.classList.remove('just-saved'), 900);
        }

        // Re-render detail modal — re-fetch đầy đủ từ Firestore (bao gồm data từ các sheet khác)
        await openCustomerDetail(_detailCurrentItem);

        // Re-render main dashboard (KPI, charts, etc.)
        analyzeAndRender();

        console.log(`[EDIT] Saved ${headerKey} = ${newValue} for ${customerKey} in ${docId}`);

    } catch (err) {
        console.error('Save error:', err);
        alert('Lỗi khi lưu: ' + err.message);
        closeDayEditPopup();
    }
}

// ══════════════════════════════════════════════════
// ══════ ADD NEW CUSTOMER ═════════════════════════
// ══════════════════════════════════════════════════

function openAddCustomerModal() {
    if (window.currentUserRole === 'viewer') {
        alert(currentLang === 'zh' ? '您没有编辑权限。' : 'Bạn không có quyền thêm khách hàng.');
        return;
    }
    const modal = $('addCustomerModal');

    // Đảm bảo modal nằm ở body level (tránh bị ảnh hưởng bởi parent transforms)
    if (modal.parentElement !== document.body) {
        document.body.appendChild(modal);
    }

    // Force inline styles để đảm bảo fixed overlay hiện đúng
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(11,20,55,0.55);backdrop-filter:blur(6px);z-index:99999;display:flex;justify-content:center;align-items:center;padding:20px;';

    // Style inner modal box
    const innerModal = modal.querySelector('.add-customer-modal');
    if (innerModal) {
        innerModal.style.cssText = 'background:white;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,0.25);width:100%;max-width:460px;padding:28px 32px 32px;animation:slideUp 0.3s cubic-bezier(0.4,0,0.2,1);';
    }

    // Kiểm tra phải chọn tháng cụ thể
    if (currentMonthKey === '__all__') {
        alert(t('add_cust_err_month'));
        return;
    }

    // --- Populate Machine dropdown ---
    const machineSelect = $('addCustMachine');
    const staffSelect = $('addCustStaff');
    machineSelect.innerHTML = '<option value="">' + (currentLang === 'zh' ? '-- 选择机器 --' : '-- Chọn máy --') + '</option>';
    staffSelect.innerHTML = '<option value="">' + (currentLang === 'zh' ? '-- 先选机器 --' : '-- Chọn máy trước --') + '</option>';
    staffSelect.disabled = true;

    if (systemMeta && systemMeta.machines) {
        const machineIds = Object.keys(systemMeta.machines)
            .map(k => k.replace('machine_', ''))
            .sort((a, b) => Number(a) - Number(b));

        machineIds.forEach(id => {
            const opt = document.createElement('option');
            opt.value = id;
            opt.textContent = (currentLang === 'zh' ? '机器 ' : 'Máy ') + id;
            machineSelect.appendChild(opt);
        });
    }

    // Pre-select current machine
    if (window._currentMachineId) {
        machineSelect.value = window._currentMachineId;
        populateStaffForMachine(window._currentMachineId);
    }

    // Event: when machine changes → update staff dropdown
    machineSelect.onchange = () => {
        const selectedMachine = machineSelect.value;
        if (selectedMachine) {
            populateStaffForMachine(selectedMachine);
        } else {
            staffSelect.innerHTML = '<option value="">' + (currentLang === 'zh' ? '-- 先选机器 --' : '-- Chọn máy trước --') + '</option>';
            staffSelect.disabled = true;
        }
    };

    // Reset form
    $('addCustCode').value = '';
    $('addCustName').value = '';
    $('addCustCardType').value = '';
    $('addCustError').style.display = 'none';

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    setTimeout(() => $('addCustCode').focus(), 100);
}

// Helper: populate staff dropdown based on selected machine
function populateStaffForMachine(machineId) {
    const staffSelect = $('addCustStaff');
    staffSelect.innerHTML = '';

    const machineMeta = systemMeta?.machines?.[`machine_${machineId}`] || systemMeta?.machines?.[machineId];
    if (!machineMeta) {
        staffSelect.innerHTML = '<option value="">' + (currentLang === 'zh' ? '无员工数据' : 'Không có dữ liệu') + '</option>';
        staffSelect.disabled = true;
        return;
    }

    // Collect all staff from all months of this machine
    const staffNamesMap = new Map();
    
    function addName(s) {
        const name = (s || '').trim();
        if (name) {
            // Create a normalized key: lowercase, remove zero-width chars, collapse multiple spaces
            const key = name.toLowerCase()
                            .replace(/[\u200B-\u200D\uFEFF]/g, '')
                            .replace(/\s+/g, ' ');
            if (!staffNamesMap.has(key)) {
                staffNamesMap.set(key, name); // Keep the first original casing we find
            }
        }
    }

    if (machineMeta.months) {
        for (const [mKey, mData] of Object.entries(machineMeta.months)) {
            (mData.sheetNames || []).forEach(addName);
        }
    }
    // Legacy
    if (machineMeta.sheetNames) {
        machineMeta.sheetNames.forEach(addName);
    }

    const sorted = Array.from(staffNamesMap.values()).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    if (sorted.length === 0) {
        staffSelect.innerHTML = '<option value="">' + (currentLang === 'zh' ? '该机器无员工' : 'Máy này chưa có NV') + '</option>';
        staffSelect.disabled = true;
        return;
    }

    sorted.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        staffSelect.appendChild(opt);
    });
    staffSelect.disabled = false;
}

function closeAddCustomerModal() {
    const modal = $('addCustomerModal');
    modal.classList.remove('active');
    modal.style.cssText = 'display:none;';
    document.body.style.overflow = '';
}

async function saveNewCustomer() {
    const code = $('addCustCode').value.trim();
    const name = $('addCustName').value.trim();
    const cardType = $('addCustCardType').value.trim();
    const staffName = $('addCustStaff').value;
    const selectedMachine = $('addCustMachine').value;
    const errEl = $('addCustError');

    // Validate
    if (!code) { errEl.textContent = t('add_cust_err_code'); errEl.style.display = 'block'; return; }
    if (!name) { errEl.textContent = t('add_cust_err_name'); errEl.style.display = 'block'; return; }
    if (!selectedMachine) { errEl.textContent = currentLang === 'zh' ? '请选择机器' : 'Vui lòng chọn máy'; errEl.style.display = 'block'; return; }
    if (!staffName) { errEl.textContent = t('add_cust_err_staff'); errEl.style.display = 'block'; return; }

    // Check trùng mã
    const existingSheet = allSheetsData[staffName];
    if (existingSheet) {
        const dup = (existingSheet.customers || []).some(c =>
            String(c.code || '').trim().toLowerCase() === code.toLowerCase()
        );
        if (dup) { errEl.textContent = t('add_cust_err_dup'); errEl.style.display = 'block'; return; }
    }

    errEl.style.display = 'none';

    // Disable button
    const saveBtn = $('addCustSaveBtn');
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${t('add_cust_saving')}`;

    const machineId = selectedMachine;
    const monthKey = currentMonthKey;
    const docId = `machine_${machineId}_${monthKey}_${staffName}`;

    const newCustomer = {
        code: code,
        name: name,
        cardType: cardType,
        total: 0,
        daily: {}
    };

    try {
        const docRef = db.collection('analytics_sheets').doc(docId);
        const doc = await docRef.get();

        if (doc.exists) {
            // Thêm vào mảng customers hiện tại
            const data = doc.data();
            const customers = data.customers || [];
            customers.push(newCustomer);
            await docRef.update({ customers });
        } else {
            // Tạo document mới
            await docRef.set({ customers: [newCustomer] });

            // Cập nhật meta: thêm sheetName nếu chưa có
            try {
                const monthMeta = systemMeta?.machines?.[`machine_${machineId}`]?.months?.[monthKey];
                if (monthMeta) {
                    const updatedSheets = [...new Set([...(monthMeta.sheetNames || []), staffName])];
                    monthMeta.sheetNames = updatedSheets;
                    await db.collection('analytics').doc('meta').update({
                        [`machines.machine_${machineId}.months.${monthKey}.sheetNames`]: updatedSheets
                    });
                }
            } catch (metaErr) {
                console.warn('Meta sheetNames update failed:', metaErr);
            }
        }

        // ── Cập nhật local state ──
        if (!allSheetsData[staffName]) {
            allSheetsData[staffName] = { customers: [] };
        }
        allSheetsData[staffName].customers.push({ ...newCustomer });

        // Reload current view
        loadSheetData(sheetSelect.value);

        // Đóng modal
        closeAddCustomerModal();

        // Ghi Audit Log
        if (typeof logAudit === 'function') {
            logAudit('ADD_CUSTOMER', {
                machineId: machineId,
                month: monthKey,
                staff: staffName,
                customerCode: code,
                customerName: name
            });
        }

        // Hiện thông báo thành công
        alert(t('add_cust_success'));

        console.log(`[ADD] New customer ${code} - ${name} added to ${docId}`);

    } catch (err) {
        console.error('Add customer error:', err);
        errEl.textContent = 'Lỗi: ' + err.message;
        errEl.style.display = 'block';
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = `<i class="fas fa-check"></i> ${t('add_cust_save')}`;
    }
}

// ── Event listeners cho Add Customer ──
$('btnAddCustomer').addEventListener('click', openAddCustomerModal);
$('addCustomerClose').addEventListener('click', closeAddCustomerModal);
$('addCustCancelBtn').addEventListener('click', closeAddCustomerModal);
$('addCustSaveBtn').addEventListener('click', saveNewCustomer);
$('addCustomerModal').addEventListener('click', e => {
    if (e.target === $('addCustomerModal')) closeAddCustomerModal();
});

// Enter trong form = save
['addCustCode', 'addCustName', 'addCustCardType'].forEach(id => {
    $(id).addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); saveNewCustomer(); }
    });
});

// ══════════════════════════════════════════════════
// ══════ EDIT CUSTOMER INFO ═══════════════════════
// ══════════════════════════════════════════════════

let _isEditingCustomerInfo = false;

function enterEditCustomerMode() {
    if (!_detailCurrentItem || _isEditingCustomerInfo) return;
    _isEditingCustomerInfo = true;

    const item = _detailCurrentItem;
    const nameEl = $('detailName');
    const codeEl = $('detailCode');
    const cardEl = $('detailCardType');
    const editBtn = $('detailEditBtn');

    // Lưu lại giá trị gốc
    const origName = nameEl.textContent;
    const origCode = codeEl.textContent;
    const origCard = cardEl.textContent;

    // Thay thế text bằng input
    nameEl.innerHTML = `<input type="text" class="detail-edit-input edit-name" id="editCustName" value="${origName.replace(/"/g, '&quot;')}" />`;
    codeEl.innerHTML = `<input type="text" class="detail-edit-input edit-code" id="editCustCode" value="${origCode.replace(/"/g, '&quot;')}" />`;
    
    // Đảm bảo hiển thị ô thẻ kể cả khi khách chưa có thẻ
    cardEl.style.display = 'inline-block';
    cardEl.innerHTML = `<input type="text" class="detail-edit-input edit-cardtype" id="editCustCardType" value="${origCard.replace(/"/g, '&quot;')}" placeholder="Loại thẻ..." />`;

    // Đổi nút Edit thành Save/Cancel
    editBtn.outerHTML = `
        <div class="detail-edit-actions" id="editCustActions">
            <button class="cal-edit-btn cal-edit-cancel" id="editCustCancelBtn" style="padding:8px 14px;font-size:12px;">
                <i class="fas fa-times"></i> ${t('edit_cancel')}
            </button>
            <button class="cal-edit-btn cal-edit-save" id="editCustSaveBtn" style="padding:8px 14px;font-size:12px;">
                <i class="fas fa-check"></i> ${t('edit_save')}
            </button>
        </div>
    `;

    // Focus vào name input
    setTimeout(() => $('editCustName')?.focus(), 50);

    // Cancel handler
    $('editCustCancelBtn').addEventListener('click', () => {
        exitEditCustomerMode(origName, origCode, origCard);
    });

    // Save handler
    $('editCustSaveBtn').addEventListener('click', () => {
        saveCustomerInfo(origCode);
    });

    // Enter to save
    ['editCustName', 'editCustCode', 'editCustCardType'].forEach(id => {
        const el = $(id);
        if (el) el.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); saveCustomerInfo(origCode); }
            if (e.key === 'Escape') exitEditCustomerMode(origName, origCode, origCard);
        });
    });
}

function exitEditCustomerMode(name, code, card) {
    _isEditingCustomerInfo = false;
    $('detailName').textContent = name;
    $('detailCode').textContent = code;
    
    const cardEl = $('detailCardType');
    if (card) {
        cardEl.style.display = 'inline-block';
        cardEl.textContent = card;
    } else {
        cardEl.style.display = 'none';
        cardEl.textContent = '';
    }

    // Khôi phục nút Edit
    const actionsEl = $('editCustActions');
    if (actionsEl) {
        actionsEl.outerHTML = `<button class="detail-edit-btn" id="detailEditBtn" title="Edit"><i class="fas fa-pen"></i> <span data-i18n="edit_cust_btn">${t('edit_cust_btn')}</span></button>`;
        $('detailEditBtn').addEventListener('click', enterEditCustomerMode);
    }
}

async function saveCustomerInfo(origCode) {
    const newName = ($('editCustName')?.value || '').trim();
    const newCode = ($('editCustCode')?.value || '').trim();
    const newCard = ($('editCustCardType')?.value || '').trim();

    if (!newName || !newCode) {
        alert(t('add_cust_err_name'));
        return;
    }

    const saveBtn = $('editCustSaveBtn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${t('edit_saving')}`;
    }

    const customerKey = String(_detailCurrentItem.code || _detailCurrentItem.id || _detailCurrentItem.name || '').trim();
    const machineId = window._currentMachineId;

    try {
        // Cập nhật tất cả Firestore docs chứa khách hàng này
        const staffName = getCustomerStaffName();
        const docsToUpdate = [];

        // Tìm tất cả docs có thể chứa KH này
        if (currentMonthKey === '__all__') {
            const machineMeta = systemMeta?.machines?.[`machine_${machineId}`];
            if (machineMeta?.months) {
                for (const [mKey, mData] of Object.entries(machineMeta.months)) {
                    (mData.sheetNames || []).forEach(s => {
                        docsToUpdate.push(`machine_${machineId}_${mKey}_${s}`);
                    });
                }
            }
        } else {
            // Chỉ tháng hiện tại
            const sheetNames = Object.keys(allSheetsData);
            sheetNames.forEach(s => {
                docsToUpdate.push(`machine_${machineId}_${currentMonthKey}_${s}`);
            });
        }

        // Update từng doc
        let updatedCount = 0;
        for (const docId of docsToUpdate) {
            try {
                const docRef = db.collection('analytics_sheets').doc(docId);
                const doc = await docRef.get();
                if (!doc.exists) continue;

                const data = doc.data();
                const customers = data.customers || [];
                let changed = false;

                customers.forEach(c => {
                    const k = String(c.code || c.id || c.name || '').trim();
                    if (k === customerKey) {
                        c.code = newCode;
                        c.name = newName;
                        c.cardType = newCard;
                        changed = true;
                    }
                });

                if (changed) {
                    await docRef.update({ customers });
                    updatedCount++;
                }
            } catch (docErr) {
                console.warn(`Failed to update ${docId}:`, docErr);
            }
        }

        // ── Cập nhật local state ──
        // allSheetsData
        for (const [sheetName, sheet] of Object.entries(allSheetsData)) {
            (sheet.customers || []).forEach(c => {
                const k = String(c.code || c.id || c.name || '').trim();
                if (k === customerKey) {
                    c.code = newCode;
                    c.name = newName;
                    c.cardType = newCard;
                }
            });
        }

        // currentSheetData
        currentSheetData.forEach(c => {
            const k = String(c.code || c.id || c.name || '').trim();
            if (k === customerKey) {
                c.code = newCode;
                c.name = newName;
                c.cardType = newCard;
            }
        });

        // _detailCurrentItem
        _detailCurrentItem.code = newCode;
        _detailCurrentItem.name = newName;
        _detailCurrentItem.cardType = newCard;

        // Thoát edit mode với giá trị mới
        exitEditCustomerMode(newName, newCode, newCard);

        // Cập nhật avatar
        const avatarEl = $('detailAvatar');
        if (avatarEl) {
            const firstChar = (newName || 'KH').charAt(0).toUpperCase();
            avatarEl.textContent = firstChar;
        }

        // Re-render bảng
        analyzeAndRender();

        alert(t('edit_cust_success'));
        console.log(`[EDIT-INFO] Updated ${customerKey} → code=${newCode}, name=${newName}, card=${newCard} (${updatedCount} docs)`);

        // Ghi Audit Log
        if (typeof logAudit === 'function') {
            logAudit('UPDATE_CUSTOMER', {
                machineId: machineId,
                oldCustomerCode: customerKey,
                newCustomerCode: newCode,
                newCustomerName: newName,
                newCardType: newCard
            });
        }

    } catch (err) {
        console.error('Edit customer info error:', err);
        alert('Lỗi: ' + err.message);
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `<i class="fas fa-check"></i> ${t('edit_save')}`;
        }
    }
}

// Event listener cho Edit button
$('detailEditBtn').addEventListener('click', enterEditCustomerMode);

// ══════════════════════════════════════════════════
// ══════ DELETE CUSTOMER ══════════════════════════
// ══════════════════════════════════════════════════

async function deleteCustomer() {
    const customerKey = String(_detailCurrentItem.code || _detailCurrentItem.id || _detailCurrentItem.name || '').trim();
    if (!customerKey) return;

    if (!confirm(t('delete_cust_confirm'))) {
        return;
    }

    const deleteBtn = $('detailDeleteBtn');
    if (deleteBtn) {
        deleteBtn.disabled = true;
        deleteBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i>`;
    }

    const machineId = window._currentMachineId;

    try {
        const docsToUpdate = [];

        // Tìm tất cả docs có thể chứa KH này
        if (currentMonthKey === '__all__') {
            const machineMeta = systemMeta?.machines?.[`machine_${machineId}`];
            if (machineMeta?.months) {
                for (const [mKey, mData] of Object.entries(machineMeta.months)) {
                    (mData.sheetNames || []).forEach(s => {
                        docsToUpdate.push(`machine_${machineId}_${mKey}_${s}`);
                    });
                }
            }
        } else {
            // Chỉ tháng hiện tại
            const sheetNames = Object.keys(allSheetsData);
            sheetNames.forEach(s => {
                docsToUpdate.push(`machine_${machineId}_${currentMonthKey}_${s}`);
            });
        }

        // Update từng doc
        let updatedCount = 0;
        for (const docId of docsToUpdate) {
            try {
                const docRef = db.collection('analytics_sheets').doc(docId);
                const doc = await docRef.get();
                if (!doc.exists) continue;

                const data = doc.data();
                const customers = data.customers || [];
                const initialLength = customers.length;
                
                // Lọc bỏ khách hàng này
                const newCustomers = customers.filter(c => String(c.code || c.id || c.name || '').trim() !== customerKey);

                if (newCustomers.length !== initialLength) {
                    await docRef.update({ customers: newCustomers });
                    updatedCount++;
                }
            } catch (docErr) {
                console.warn(`Failed to update ${docId}:`, docErr);
            }
        }

        // ── Cập nhật local state ──
        // allSheetsData
        for (const [sheetName, sheet] of Object.entries(allSheetsData)) {
            if (sheet.customers) {
                sheet.customers = sheet.customers.filter(c => String(c.code || c.id || c.name || '').trim() !== customerKey);
            }
        }

        // currentSheetData
        currentSheetData = currentSheetData.filter(c => String(c.code || c.id || c.name || '').trim() !== customerKey);

        // Đóng modal
        closeCustomerDetail();

        // Ghi Audit Log
        if (typeof logAudit === 'function') {
            logAudit('DELETE_CUSTOMER', {
                machineId: window._currentMachineId,
                customerCode: customerKey
            });
        }

        // Re-render bảng
        analyzeAndRender();

        alert(t('delete_cust_success'));
        console.log(`[DELETE] Removed ${customerKey} (${updatedCount} docs)`);

    } catch (err) {
        console.error('Delete customer error:', err);
        alert('Lỗi: ' + err.message);
    } finally {
        if (deleteBtn) {
            deleteBtn.disabled = false;
            deleteBtn.innerHTML = `<i class="fas fa-trash"></i> <span data-i18n="delete_cust_btn">${t('delete_cust_btn')}</span>`;
        }
    }
}

// Event listener cho Delete button
$('detailDeleteBtn')?.addEventListener('click', deleteCustomer);

// =============================================
// RBAC / UI PERMISSIONS & AUDIT LOGS
// =============================================
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        // Wait briefly for auth.js to set window.currentUserRole
        setTimeout(applyPermissions, 500);
    }
});

function applyPermissions() {
    const role = window.currentUserRole || 'viewer';
    const btnAdd = $('btnAddCustomer');
    const btnEdit = $('detailEditBtn');
    const btnDelete = $('detailDeleteBtn');
    const btnManage = $('userManageBtn');
    const btnLogs = $('auditLogsBtn');
    
    if (role === 'viewer') {
        if (btnAdd) btnAdd.style.display = 'none';
        if (btnEdit) btnEdit.style.display = 'none';
        if (btnDelete) btnDelete.style.display = 'none';
        if (btnManage) btnManage.style.display = 'none';
        if (btnLogs) btnLogs.style.display = 'none';
    } else if (role === 'staff') {
        if (btnAdd) btnAdd.style.display = 'inline-flex';
        if (btnEdit) btnEdit.style.display = 'inline-flex';
        if (btnDelete) btnDelete.style.display = 'none';
        if (btnManage) btnManage.style.display = 'none';
        if (btnLogs) btnLogs.style.display = 'none';
    } else if (role === 'admin') {
        if (btnAdd) btnAdd.style.display = 'inline-flex';
        if (btnEdit) btnEdit.style.display = 'inline-flex';
        if (btnDelete) btnDelete.style.display = 'inline-flex';
        if (btnManage) btnManage.style.display = 'inline-block';
        if (btnLogs) btnLogs.style.display = 'inline-block';
    }
}

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

// =============================================
// USER MANAGEMENT (ADMIN ONLY)
// =============================================
const userManageBtn = $('userManageBtn');

if (userManageBtn) {
    userManageBtn.addEventListener('click', () => {
        window.location.href = 'users.html';
    });
}

const auditLogsBtn = $('auditLogsBtn');
if (auditLogsBtn) {
    auditLogsBtn.addEventListener('click', () => {
        window.location.href = 'logs.html';
    });
}
