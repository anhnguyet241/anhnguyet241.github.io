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
document.addEventListener('DOMContentLoaded', checkCurrentData);

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
        checkCurrentData();
    } catch (err) {
        console.error(err);
        showToast('Lỗi khi xoá: ' + err.message, 'error');
        hideProgress(0);
    }
});

// ── Check Current Data on Firestore ──
async function checkCurrentData() {
    try {
        const metaDoc = await db.collection('analytics').doc('meta').get();
        if (metaDoc.exists) {
            const meta = metaDoc.data();
            document.getElementById('statusState').textContent = '✅ Có dữ liệu';
            document.getElementById('statusState').style.color = '#00c853';
            document.getElementById('statusFile').textContent = meta.fileName || '—';
            document.getElementById('statusSheets').textContent = meta.sheetNames ? meta.sheetNames.length : '—';
            if (meta.uploadedAt) {
                const d = meta.uploadedAt.toDate();
                document.getElementById('statusDate').textContent =
                    d.toLocaleDateString('vi-VN') + ' ' + d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
            }
        } else {
            document.getElementById('statusState').textContent = '⚠️ Chưa có';
            document.getElementById('statusState').style.color = '#ff1744';
            document.getElementById('statusFile').textContent = '—';
            document.getElementById('statusDate').textContent = '—';
            document.getElementById('statusSheets').textContent = '—';
        }
    } catch (err) {
        console.error(err);
        document.getElementById('statusState').textContent = '❌ Lỗi kết nối';
        document.getElementById('statusState').style.color = '#ff1744';
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

            // Extract date headers from row 0 — chỉ lấy cột ngày tháng thực sự
            if (rawData.length > 0) {
                const headerRow = rawData[0] || [];
                for (let j = 3; j < headerRow.length; j++) {
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
                for (let j = 3; j < headerRow.length; j++) {
                    const h = headerRow[j] ? String(headerRow[j]).trim() : '';
                    if (headers.includes(h)) {
                        headerColMap[h] = j;
                    }
                }
            }

            // Parse customer rows (starting from row index 2)
            for (let i = 2; i < rawData.length; i++) {
                const row = rawData[i];
                if (!row || row.length === 0) continue;
                const id = row[0] ? String(row[0]).trim() : '';
                const customerName = row[1] ? String(row[1]).trim() : '';
                if (!id && !customerName) continue;

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
                customers.push({ id, name: customerName, total, daily });
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

    previewHead.innerHTML = '<th>#</th><th>ID</th><th>Tên</th><th>Tổng GD</th>';
    sheet.headers.slice(0, 8).forEach(h => {
        previewHead.innerHTML += `<th>${h}</th>`;
    });
    if (sheet.headers.length > 8) previewHead.innerHTML += `<th>...</th>`;

    previewBody.innerHTML = '';
    sheet.customers.slice(0, 30).forEach((c, i) => {
        let row = `<tr>
            <td>${i + 1}</td>
            <td><strong>${c.id}</strong></td>
            <td>${c.name}</td>
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

// ── Save to Firestore ──
async function saveToFirestore() {
    if (!parsedWorkbook || Object.keys(parsedSheetsData).length === 0) return;

    const fileName = uploadCard.querySelector('h3').textContent;
    const sheetNames = parsedWorkbook.SheetNames;
    const allHeaders = parsedSheetsData[sheetNames[0]]?.headers || [];

    btnUpload.disabled = true;
    showProgress('Bắt đầu lưu dữ liệu...');

    try {
        const totalSteps = sheetNames.length + 1;
        let step = 0;

        // 1. Delete old sheet documents first
        setProgress(5, 'Xoá dữ liệu cũ...');
        const oldDocs = await db.collection('analytics_sheets').get();
        if (!oldDocs.empty) {
            const deleteBatch = db.batch();
            oldDocs.forEach(doc => deleteBatch.delete(doc.ref));
            await deleteBatch.commit();
        }

        // 2. Save each sheet as a document
        for (const name of sheetNames) {
            step++;
            const pct = Math.round((step / totalSteps) * 90) + 5;
            setProgress(pct, `Đang lưu sheet "${name}"... (${step}/${sheetNames.length})`);

            const sheetData = parsedSheetsData[name];

            // Firestore document limit is 1MB. If customers array is huge, we need to chunk.
            // For now, save as single doc (most sheets will be under 1MB).
            await db.collection('analytics_sheets').doc(name).set({
                customers: sheetData.customers,
                headers: sheetData.headers,
                customerCount: sheetData.customers.length
            });
        }

        // 3. Save metadata
        step++;
        setProgress(95, 'Lưu metadata...');
        await db.collection('analytics').doc('meta').set({
            fileName: fileName,
            sheetNames: sheetNames,
            dateHeaders: allHeaders,
            uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
            totalSheets: sheetNames.length
        });

        setProgress(100, 'Hoàn thành!');
        showToast('Đã lưu thành công lên hệ thống! 🎉', 'success');
        hideProgress(2000);
        checkCurrentData();

    } catch (err) {
        console.error('Firestore save error:', err);
        showToast('Lỗi khi lưu: ' + err.message, 'error');
        hideProgress(0);
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
