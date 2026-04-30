// /admin/js/analytics.js
// Admin: Upload Excel → Parse → Save to Firestore

let parsedWorkbook = null;
let parsedSheetsData = {}; // { sheetName: { data: [...], headers: [...] } }

const fileInput = document.getElementById('fileInput');
const uploadCard = document.getElementById('uploadCard');
const btnUpload = document.getElementById('btnUpload');
const btnDelete = document.getElementById('btnDelete');
const progressContainer = document.getElementById('progressContainer');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const previewCard = document.getElementById('previewCard');
const sheetTabs = document.getElementById('sheetTabs');
const previewHead = document.getElementById('previewHead');
const previewBody = document.getElementById('previewBody');

// ── Init ──
document.addEventListener('DOMContentLoaded', init);

// ── Upload Card Click ──
uploadCard.addEventListener('click', () => fileInput.click());

// ── Drag & Drop ──
uploadCard.addEventListener('dragover', e => { e.preventDefault(); uploadCard.classList.add('dragover'); });
uploadCard.addEventListener('dragleave', () => uploadCard.classList.remove('dragover'));
uploadCard.addEventListener('drop', e => {
    e.preventDefault();
    uploadCard.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
});

// ── File Input Change ──
fileInput.addEventListener('change', e => {
    if (e.target.files[0]) processFile(e.target.files[0]);
});

// ── Upload Button ──
btnUpload.addEventListener('click', saveToFirestore);

// ── Delete Button ──
btnDelete.addEventListener('click', async () => {
    if (!confirm('Bạn có chắc muốn xoá toàn bộ dữ liệu giao dịch trên hệ thống?')) return;
    try {
        showProgress('Đang xoá dữ liệu...');

        // Delete all sheet documents
        const snapshot = await db.collection('analytics_sheets').get();
        const batch = db.batch();
        snapshot.forEach(doc => batch.delete(doc.ref));
        batch.delete(db.collection('analytics').doc('meta'));
        await batch.commit();

        setProgress(100, 'Đã xoá thành công!');
        hideProgress(1500);
        showToast('Đã xoá toàn bộ dữ liệu!', 'success');
        init();
    } catch (err) {
        console.error(err);
        showToast('Lỗi khi xoá: ' + err.message, 'error');
        hideProgress(0);
    }
});

// ── Initialization & Current Data Loading ──
async function init() {
    try {
        const metaDoc = await db.collection('analytics').doc('meta').get();
        if (metaDoc.exists) {
            const data = metaDoc.data();
            const ts = data.lastUpdated ? data.lastUpdated.toDate() : new Date();
            document.getElementById('statusState').innerHTML = `<span style="color:#00c853;"><i class="fas fa-check-circle"></i> Sẵn sàng</span>`;
            document.getElementById('statusDate').textContent = `${ts.toLocaleDateString('vi-VN')} ${ts.toLocaleTimeString('vi-VN')}`;
            
            // Check if machines exist
            if (data.machines) {
                const count = Object.keys(data.machines).length;
                document.getElementById('statusFile').textContent = count > 0 ? `${count} máy đang hoạt động` : 'Chưa có dữ liệu máy nào';
                let totalSheets = 0;
                Object.values(data.machines).forEach(m => {
                    if (m.sheetNames) totalSheets += m.sheetNames.length;
                });
                document.getElementById('statusSheets').textContent = totalSheets;
            } else {
                // Legacy support
                document.getElementById('statusFile').textContent = data.fileName || 'Đã có dữ liệu file cũ';
                document.getElementById('statusSheets').textContent = data.sheetNames ? data.sheetNames.length : '—';
            }
        } else {
            document.getElementById('statusState').innerHTML = `<span style="color:#ff1744;"><i class="fas fa-times-circle"></i> Trống</span>`;
        }
    } catch (err) {
        console.error("Lỗi khi đọc Firestore:", err);
        document.getElementById('statusState').innerHTML = `<span style="color:#ff1744;"><i class="fas fa-exclamation-triangle"></i> Lỗi kết nối</span>`;
    }
}

// ── Process Uploaded File ──
function processFile(file) {
    const reader = new FileReader();
    uploadCard.querySelector('h3').textContent = file.name;
    uploadCard.querySelector('p').textContent = `${(file.size / 1024).toFixed(1)} KB`;

    reader.onload = function (ev) {
        const data = new Uint8Array(ev.target.result);
        parsedWorkbook = XLSX.read(data, { type: 'array' });
        parsedSheetsData = {};

        parsedWorkbook.SheetNames.forEach(name => {
            const ws = parsedWorkbook.Sheets[name];
            const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });
            const headers = [];
            const customers = [];

            // === CẤU TRÚC BẢNG MỚI ===
            // Col 0: 客户bank (TK ngân hàng)
            // Col 1: 偏好 (mã khách hàng / 编号)
            // Col 2: 客户名字 (Tên khách hàng)
            // Col 3: 类型 (Loại hình giao dịch)
            // Col 4+: Ngày tháng (date columns)

            // Extract date headers from row 0 — bắt đầu từ cột 4 trở đi
            if (rawData.length > 0) {
                const headerRow = rawData[0] || [];
                for (let j = 4; j < headerRow.length; j++) {
                    const h = headerRow[j] ? String(headerRow[j]).trim() : '';
                    // Chỉ giữ lại header là ngày tháng tiếng Trung (X月Y日) hoặc số serial Excel
                    const isCnDate = /^\d{1,2}月\d{1,2}日?$/.test(h);
                    const isSerialDate = !isNaN(h) && Number(h) > 40000;
                    if (h && (isCnDate || isSerialDate)) {
                        headers.push(h);
                    }
                }
            }

            // Build mapping: header name → column index trong raw data
            const headerColMap = {};
            if (rawData.length > 0) {
                const headerRow = rawData[0] || [];
                for (let j = 4; j < headerRow.length; j++) {
                    const h = headerRow[j] ? String(headerRow[j]).trim() : '';
                    if (headers.includes(h)) {
                        headerColMap[h] = j;
                    }
                }
            }

            // Parse customer rows (starting from row index 2, skip header + 1 empty row)
            for (let i = 2; i < rawData.length; i++) {
                const row = rawData[i];
                if (!row || row.length === 0) continue;
                const id = row[0] ? String(row[0]).trim() : '';          // 客户bank
                const code = row[1] ? String(row[1]).trim() : '';        // 偏好 / 编号
                const customerName = row[2] ? String(row[2]).trim() : ''; // 客户名字
                const cardType = row[3] ? String(row[3]).trim() : '';    // 类型
                if (!code && !customerName) continue;

                let total = 0;
                const daily = {};
                headers.forEach(h => {
                    const colIdx = headerColMap[h];
                    const val = colIdx !== undefined ? parseFloat(row[colIdx]) : NaN;
                    if (!isNaN(val)) {
                        total += val;
                        daily[h] = val;
                    } else {
                        daily[h] = 0;
                    }
                });
                customers.push({ id, code, name: customerName, cardType, total, daily });
            }

            parsedSheetsData[name] = { customers, headers };
        });

        // Enable upload button
        btnUpload.disabled = false;

        // Show preview
        renderPreview(parsedWorkbook.SheetNames[0]);
        previewCard.classList.add('active');

        // Render sheet tabs
        sheetTabs.innerHTML = '';
        parsedWorkbook.SheetNames.forEach((name, idx) => {
            const btn = document.createElement('button');
            btn.className = 'sheet-tab' + (idx === 0 ? ' active' : '');
            btn.textContent = `${name} (${parsedSheetsData[name].customers.length})`;
            btn.addEventListener('click', () => {
                document.querySelectorAll('.sheet-tab').forEach(t => t.classList.remove('active'));
                btn.classList.add('active');
                renderPreview(name);
            });
            sheetTabs.appendChild(btn);
        });
    };

    reader.readAsArrayBuffer(file);
}

// ── Render Preview Table ──
function renderPreview(sheetName) {
    const sheet = parsedSheetsData[sheetName];
    if (!sheet) return;

    previewHead.innerHTML = '<th>#</th><th>Mã KH</th><th>Tên</th><th>Loại</th><th>Tổng GD</th>';
    sheet.headers.slice(0, 8).forEach(h => {
        previewHead.innerHTML += `<th>${h}</th>`;
    });
    if (sheet.headers.length > 8) previewHead.innerHTML += `<th>...</th>`;

    previewBody.innerHTML = '';
    sheet.customers.slice(0, 30).forEach((c, i) => {
        let row = `<tr>
            <td>${i + 1}</td>
            <td><strong>${c.code || c.id}</strong></td>
            <td>${c.name}</td>
            <td>${c.cardType || '—'}</td>
            <td style="font-weight:700;">${c.total.toLocaleString()}</td>`;
        sheet.headers.slice(0, 8).forEach(h => {
            const v = c.daily[h] || 0;
            row += `<td>${v > 0 ? v : '<span style="color:#ccc">0</span>'}</td>`;
        });
        if (sheet.headers.length > 8) row += '<td>...</td>';
        row += '</tr>';
        previewBody.innerHTML += row;
    });

    if (sheet.customers.length > 30) {
        previewBody.innerHTML += `<tr><td colspan="99" style="text-align:center;color:#6e7591;">
            ...và ${sheet.customers.length - 30} khách hàng nữa</td></tr>`;
    }
}

// ── Save to Firestore (Multi-Machine) ──
async function saveToFirestore() {
    if (!parsedWorkbook || Object.keys(parsedSheetsData).length === 0) return;

    // Lấy ID máy đang chọn
    const selectedMachine = document.querySelector('input[name="machineSelect"]:checked').value;
    const machineId = `machine_${selectedMachine}`;
    const machineName = `Máy 00${selectedMachine}`;

    const fileName = uploadCard.querySelector('h3').textContent;
    const sheetNames = parsedWorkbook.SheetNames;
    const allHeaders = parsedSheetsData[sheetNames[0]]?.headers || [];

    btnUpload.disabled = true;
    showProgress(`Bắt đầu lưu dữ liệu cho ${machineName}...`);

    try {
        const totalSteps = sheetNames.length + 2;
        let step = 0;

        // 1. Chỉ xoá dữ liệu cũ CỦA MÁY NÀY thôi
        setProgress(5, `Xoá dữ liệu cũ của ${machineName}...`);
        
        // Lấy tất cả doc và lọc ra doc thuộc máy này
        // (Do firestore web không hỗ trợ startsWith query dễ dàng, ta dùng vòng lặp nếu doc không quá nhiều)
        const oldDocs = await db.collection('analytics_sheets').get();
        if (!oldDocs.empty) {
            const deleteBatch = db.batch();
            oldDocs.forEach(doc => {
                if (doc.id.startsWith(`${machineId}_`)) {
                    deleteBatch.delete(doc.ref);
                }
            });
            await deleteBatch.commit();
        }

        // 2. Lưu từng sheet vào collection, với prefix là machine_X_
        for (const name of sheetNames) {
            step++;
            const pct = Math.round((step / totalSteps) * 90) + 5;
            setProgress(pct, `Đang xử lý sheet: ${name}`);
            
            // Xoá header trước khi lưu
            const docData = parsedSheetsData[name];
            const cleanData = { customers: docData.customers };
            
            await db.collection('analytics_sheets').doc(`${machineId}_${name}`).set(cleanData);
        }

        // 3. Đọc meta cũ, update meta mới (cộng dồn máy)
        step++;
        setProgress(95, 'Cập nhật thông tin hệ thống...');
        
        const metaRef = db.collection('analytics').doc('meta');
        const metaDoc = await metaRef.get();
        let metaData = metaDoc.exists ? metaDoc.data() : { machines: {} };
        
        // Đảm bảo cấu trúc mới
        if (!metaData.machines) {
            // Chuyển đổi từ cũ sang mới (nếu cần)
            metaData = { 
                machines: {},
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            };
        }

        // Cập nhật record cho máy này
        metaData.machines[selectedMachine] = {
            id: selectedMachine,
            name: machineName,
            fileName: fileName,
            sheetNames: sheetNames,
            headers: allHeaders, // Lưu header ở meta để file dashboard load nhanh 
            uploadedAt: new Date().toISOString()
        };
        metaData.lastUpdated = firebase.firestore.FieldValue.serverTimestamp();

        // Lưu meta
        await metaRef.set(metaData);

        setProgress(100, 'Hoàn thành!');
        showToast(`Đã lưu thành công dữ liệu cho ${machineName}!`, 'success');
        
        setTimeout(() => {
            init();
            progressContainer.classList.remove('active');
            btnUpload.disabled = false;
        }, 1500);

    } catch (err) {
        console.error(err);
        showToast('Lỗi khi lưu dữ liệu. Vui lòng mở console xem chi tiết.', 'error');
        progressContainer.classList.remove('active');
        btnUpload.disabled = false;
    }
}

// ── Progress Helpers ──
function showProgress(text) {
    progressContainer.classList.add('active');
    progressBar.style.width = '0%';
    progressText.textContent = text;
}

function setProgress(pct, text) {
    progressBar.style.width = pct + '%';
    if (text) progressText.textContent = text;
}

function hideProgress(delay) {
    setTimeout(() => {
        progressContainer.classList.remove('active');
        btnUpload.disabled = false;
    }, delay);
}

// ── Toast ──
function showToast(msg, type) {
    const toast = document.getElementById('toast');
    toast.className = `toast toast-${type} show`;
    toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${msg}`;
    setTimeout(() => toast.classList.remove('show'), 3500);
}

// ══════════════════════════════════════════════════
// ══════  REVENUE UPLOAD MODULE  ══════════════════
// ══════════════════════════════════════════════════

const revenueUploadCard = document.getElementById('revenueUploadCard');
const revenueFileInput = document.getElementById('revenueFileInput');
const btnRevenueUpload = document.getElementById('btnRevenueUpload');
const btnRevenueDelete = document.getElementById('btnRevenueDelete');
const revenueProgressContainer = document.getElementById('revenueProgressContainer');
const revenueProgressBar = document.getElementById('revenueProgressBar');
const revenueProgressText = document.getElementById('revenueProgressText');

let parsedRevenueData = null; // { months: { '2025-01': {...}, ... } }

// ── Init Revenue Status ──
async function initRevenueStatus() {
    try {
        const metaDoc = await db.collection('revenue').doc('meta').get();
        if (metaDoc.exists) {
            const data = metaDoc.data();
            const months = data.months || [];
            document.getElementById('revenueStatusState').innerHTML = `<span style="color:#00c853;"><i class="fas fa-check-circle"></i> Sẵn sàng</span>`;
            document.getElementById('revenueStatusMonths').textContent = months.length + ' tháng';
            if (data.lastUpdated) {
                const ts = data.lastUpdated.toDate();
                document.getElementById('revenueStatusDate').textContent = ts.toLocaleDateString('vi-VN') + ' ' + ts.toLocaleTimeString('vi-VN');
            }
        } else {
            document.getElementById('revenueStatusState').innerHTML = `<span style="color:#ff1744;"><i class="fas fa-times-circle"></i> Trống</span>`;
        }
    } catch(err) {
        console.error('Revenue status error:', err);
    }
}
document.addEventListener('DOMContentLoaded', initRevenueStatus);

// ── Revenue Upload Card Events ──
if (revenueUploadCard) {
    revenueUploadCard.addEventListener('click', () => revenueFileInput.click());
    revenueUploadCard.addEventListener('dragover', e => { e.preventDefault(); revenueUploadCard.classList.add('dragover'); });
    revenueUploadCard.addEventListener('dragleave', () => revenueUploadCard.classList.remove('dragover'));
    revenueUploadCard.addEventListener('drop', e => {
        e.preventDefault(); revenueUploadCard.classList.remove('dragover');
        if (e.dataTransfer.files[0]) parseRevenueFile(e.dataTransfer.files[0]);
    });
}
if (revenueFileInput) {
    revenueFileInput.addEventListener('change', e => {
        if (e.target.files[0]) parseRevenueFile(e.target.files[0]);
    });
}
if (btnRevenueUpload) btnRevenueUpload.addEventListener('click', saveRevenueToFirestore);
if (btnRevenueDelete) btnRevenueDelete.addEventListener('click', deleteRevenueData);

// ── Parse Revenue Excel ──
function parseRevenueFile(file) {
    revenueUploadCard.querySelector('h3').textContent = file.name;
    revenueUploadCard.querySelector('p').textContent = `${(file.size / 1024).toFixed(1)} KB`;

    const reader = new FileReader();
    reader.onload = function(ev) {
        const data = new Uint8Array(ev.target.result);
        const wb = XLSX.read(data, { type: 'array' });

        // Find the main sheet (每个月刀数和N明细表)
        const sheetName = wb.SheetNames.find(n => n.includes('明细表')) || wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(ws, { header: 1 });

        // Parse months from the sheet
        parsedRevenueData = parseRevenueSheet(rawData);
        
        if (parsedRevenueData && Object.keys(parsedRevenueData).length > 0) {
            btnRevenueUpload.disabled = false;
            showToast(`Đã đọc ${Object.keys(parsedRevenueData).length} tháng dữ liệu doanh số!`, 'success');
        } else {
            showToast('Không tìm thấy dữ liệu doanh số hợp lệ trong file.', 'error');
        }
    };
    reader.readAsArrayBuffer(file);
}

// ── Parse Revenue Sheet Structure ──
function parseRevenueSheet(rawData) {
    const result = {};
    
    // Find month boundaries by looking for "每周交易汇报图表 -X月份" markers
    const monthBoundaries = [];
    rawData.forEach((row, idx) => {
        const cell = row[0] ? String(row[0]).trim() : '';
        if (cell.includes('每周交易汇报图表') && cell.includes('月份')) {
            // Extract month number
            const match = cell.match(/(\d+)月份/);
            if (match) {
                monthBoundaries.push({ row: idx, month: parseInt(match[1]) });
            }
        }
    });

    // Each month has this structure (relative to boundary):
    // Row 0: Title (每周交易汇报图表 -X月份)
    // Row 1: Subtitle (刀数)
    // Row 2: Date headers (日期, X月1日, X月2日, ...)
    // Row 3: Weekday row (星期X, ...)
    // Row 4-9: Machine data (微信001-006)
    // Row 10: Total (总数)
    // ... gap ...
    // Then: 付N总数 section (same structure)
    // ... gap ...
    // Then: 每周交易图刀数表汇报 (weekly sales)
    // Then: 每周交易图付N表汇报 (weekly transfers)

    for (const boundary of monthBoundaries) {
        const r = boundary.row;
        const monthNum = String(boundary.month).padStart(2, '0');
        const monthKey = `2025-${monthNum}`;

        // ── Parse daily sales (刀数) ──
        const dateHeaderRow = rawData[r + 2] || [];
        const dateHeaders = [];
        for (let c = 1; c < dateHeaderRow.length; c++) {
            const h = dateHeaderRow[c] ? String(dateHeaderRow[c]).trim() : '';
            if (h && /^\d+月\d+日/.test(h)) dateHeaders.push(h);
        }
        const numDays = dateHeaders.length;

        const dailySales = {};
        const machines = ['微信001', '微信002', '微信003', '微信004', '微信005', '微信006'];
        
        for (let i = 0; i < 6; i++) {
            const row = rawData[r + 4 + i] || [];
            const machineName = row[0] ? String(row[0]).trim() : machines[i];
            const values = [];
            for (let c = 1; c <= numDays; c++) {
                values.push(parseFloat(row[c]) || 0);
            }
            dailySales[machineName] = values;
        }

        // ── Find 付N总数 section ──
        let transferStartRow = -1;
        for (let scan = r + 10; scan < r + 25; scan++) {
            const cell = rawData[scan]?.[0] ? String(rawData[scan][0]).trim() : '';
            if (cell === '付N总数') {
                transferStartRow = scan;
                break;
            }
        }

        const dailyTransfers = {};
        if (transferStartRow >= 0) {
            // Date header is at transferStartRow + 1, weekday at +2, machines at +3 to +8
            for (let i = 0; i < 6; i++) {
                const row = rawData[transferStartRow + 3 + i] || [];
                const machineName = row[0] ? String(row[0]).trim() : machines[i];
                const values = [];
                for (let c = 1; c <= numDays; c++) {
                    values.push(parseFloat(row[c]) || 0);
                }
                dailyTransfers[machineName] = values;
            }
        }

        // ── Find weekly sales (每周交易图刀数表汇报) ──
        let weeklySalesRow = -1;
        for (let scan = r + 15; scan < r + 35; scan++) {
            const cell = rawData[scan]?.[0] ? String(rawData[scan][0]).trim() : '';
            if (cell === '每周交易图刀数表汇报') {
                weeklySalesRow = scan;
                break;
            }
        }

        const weeklySales = {};
        const weekHeaders = [];
        if (weeklySalesRow >= 0) {
            const whRow = rawData[weeklySalesRow + 1] || [];
            for (let c = 1; c < whRow.length; c++) {
                const h = whRow[c] ? String(whRow[c]).trim() : '';
                if (h && h.includes('周')) weekHeaders.push(h);
            }
            for (let i = 0; i < 6; i++) {
                const row = rawData[weeklySalesRow + 2 + i] || [];
                const machineName = row[0] ? String(row[0]).trim() : machines[i];
                const values = [];
                for (let c = 1; c <= weekHeaders.length; c++) {
                    values.push(parseFloat(row[c]) || 0);
                }
                weeklySales[machineName] = values;
            }
        }

        // ── Find weekly transfers (每周交易图付N表汇报) ──
        let weeklyTransfersRow = -1;
        for (let scan = (weeklySalesRow > 0 ? weeklySalesRow + 8 : r + 30); scan < r + 50; scan++) {
            const cell = rawData[scan]?.[0] ? String(rawData[scan][0]).trim() : '';
            if (cell === '每周交易图付N表汇报') {
                weeklyTransfersRow = scan;
                break;
            }
        }

        const weeklyTransfers = {};
        if (weeklyTransfersRow >= 0) {
            for (let i = 0; i < 6; i++) {
                const row = rawData[weeklyTransfersRow + 1 + i] || [];
                const machineName = row[0] ? String(row[0]).trim() : machines[i];
                const values = [];
                for (let c = 1; c <= weekHeaders.length; c++) {
                    values.push(parseFloat(row[c]) || 0);
                }
                weeklyTransfers[machineName] = values;
            }
        }

        // Check if this month has real data (not all zeros)
        const totalSales = Object.values(dailySales).reduce((sum, arr) => sum + arr.reduce((s, v) => s + v, 0), 0);
        if (totalSales > 0) {
            result[monthKey] = {
                dateHeaders,
                weekHeaders,
                dailySales,
                dailyTransfers,
                weeklySales,
                weeklyTransfers,
            };
        }
    }

    return result;
}

// ── Save Revenue to Firestore ──
async function saveRevenueToFirestore() {
    if (!parsedRevenueData || Object.keys(parsedRevenueData).length === 0) {
        showToast('Chưa có dữ liệu để lưu!', 'error');
        return;
    }

    try {
        revenueProgressContainer.classList.add('active');
        revenueProgressBar.style.width = '0%';
        revenueProgressText.textContent = 'Đang lưu dữ liệu doanh số...';
        btnRevenueUpload.disabled = true;

        const monthKeys = Object.keys(parsedRevenueData).sort();
        const total = monthKeys.length + 1;
        let done = 0;

        // Save each month as a separate document
        for (const key of monthKeys) {
            await db.collection('revenue').doc(key).set(parsedRevenueData[key]);
            done++;
            revenueProgressBar.style.width = ((done / total) * 100) + '%';
            revenueProgressText.textContent = `Đã lưu ${done}/${monthKeys.length} tháng...`;
        }

        // Save meta document
        await db.collection('revenue').doc('meta').set({
            months: monthKeys,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
            fileName: revenueUploadCard.querySelector('h3').textContent,
        });
        done++;
        revenueProgressBar.style.width = '100%';
        revenueProgressText.textContent = 'Hoàn tất! ✅';

        showToast(`Đã lưu ${monthKeys.length} tháng doanh số thành công!`, 'success');
        setTimeout(() => {
            revenueProgressContainer.classList.remove('active');
            btnRevenueUpload.disabled = false;
            initRevenueStatus();
        }, 1500);

    } catch (err) {
        console.error('Revenue save error:', err);
        showToast('Lỗi khi lưu doanh số: ' + err.message, 'error');
        revenueProgressContainer.classList.remove('active');
        btnRevenueUpload.disabled = false;
    }
}

// ── Delete Revenue Data ──
async function deleteRevenueData() {
    if (!confirm('Bạn có chắc muốn xoá toàn bộ dữ liệu doanh số tổng?')) return;
    try {
        revenueProgressContainer.classList.add('active');
        revenueProgressText.textContent = 'Đang xoá dữ liệu doanh số...';

        const snapshot = await db.collection('revenue').get();
        const batch = db.batch();
        snapshot.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        revenueProgressBar.style.width = '100%';
        revenueProgressText.textContent = 'Đã xoá thành công!';
        showToast('Đã xoá toàn bộ dữ liệu doanh số!', 'success');

        setTimeout(() => {
            revenueProgressContainer.classList.remove('active');
            initRevenueStatus();
        }, 1500);
    } catch (err) {
        console.error(err);
        showToast('Lỗi khi xoá: ' + err.message, 'error');
        revenueProgressContainer.classList.remove('active');
    }
}
