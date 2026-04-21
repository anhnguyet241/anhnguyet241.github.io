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
