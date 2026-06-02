// Bilingual dictionary for check-data.html
const LANG = {
    vi: {
        title: '🔍 Kiểm Tra & Khôi Phục Dữ Liệu',
        info1: '💡 Công cụ này giúp bạn kiểm tra tất cả dữ liệu trong Firestore.',
        info2: 'Nếu dữ liệu đã bị mất thì cần upload lại hoặc restore từ file backup.',
        btnScan: '🔍 Quét Dữ Liệu',
        btnMeta: '📋 Xem Meta',
        btnAudit: '📜 Audit Logs',
        btnBackup: '💾 Backup (JSON)',
        btnRestore: '📦 Restore',
        btnStaff: '👤 Thêm NV',
        btnGuide: '📖 Hướng dẫn',
        switchLang: '🇨🇳 中文',
        outputDefault: 'Nhấn nút "Quét Dữ Liệu" để bắt đầu...',
        // Staff panel
        staffTitle: '👤 Thêm Nhân Viên Mới (Không mất data cũ)',
        staffDesc: 'Chọn máy + tháng, nhập tên nhân viên → hệ thống sẽ thêm vào danh sách mà <strong style="color:#fbbf24;">KHÔNG ảnh hưởng</strong> data hiện tại.',
        staffMachine: 'Máy:',
        staffMonth: 'Tháng:',
        staffName: 'Tên NV mới:',
        staffPlaceholder: 'Ví dụ: JACK',
        staffAdd: '➕ Thêm',
        staffClose: '✕ Đóng',
        staffLoading: 'Đang tải...',
        staffPickMachine: 'Chọn máy trước',
        staffSelectMachine: '-- Chọn máy --',
        staffNoMachine: 'Không có máy nào!',
        staffNoMonth: 'Chưa có tháng nào',
        staffAllMonths: '📌 Tất cả các tháng',
        staffCurrentAll: '📋 NV hiện tại (tất cả tháng): ',
        staffCurrentMonth: '📋 NV tháng ',
        // Scan messages
        scanning: '🔍 Đang quét collection analytics_sheets...',
        emptyCollection: '❌ Collection TRỐNG HOÀN TOÀN!',
        emptyHint: '→ Dữ liệu đã bị xóa hoặc chưa upload.',
        found: '✅ Tìm thấy',
        documents: 'documents',
        totalSummary: '📊 Tổng cộng:',
        customers: 'khách hàng trên',
        machines: 'máy',
        thDocId: 'Document ID', thCount: 'Số KH', thVolume: 'Tổng SL', thSample: 'Mẫu KH', thStatus: 'Trạng thái',
        // Meta
        readingMeta: '📋 Đang đọc meta...',
        metaNotExist: '❌ Document meta KHÔNG TỒN TẠI!',
        metaOk: '✅ Meta document tồn tại',
        month: 'Tháng', sheets: 'Sheets', headers: 'cột', upload: 'Upload',
        noMonths: '⚠️ Không có dữ liệu months',
        noMachines: '❌ Không có trường machines!',
        rawJson: '📦 Raw JSON:',
        // Audit
        readingAudit: '📜 Đang đọc audit logs gần nhất...',
        noAudit: 'Chưa có audit log nào.',
        thTime: 'Thời gian', thAction: 'Hành động', thUser: 'Người thực hiện', thDetail: 'Chi tiết',
        // Backup
        backingUp: '💾 Đang backup toàn bộ dữ liệu...',
        backedUp: '✅ Đã backup:',
        downloaded: '📥 File backup đã được tải xuống!',
        backupWarn: '⚠️ Lưu file này cẩn thận - nó chứa TOÀN BỘ dữ liệu.',
        // Restore
        readingFile: '📦 Đang đọc file backup: ',
        invalidJson: '❌ File JSON không hợp lệ!',
        backupDate: '📅 Ngày backup: ',
        sheetCount: '📄 Số sheets: ',
        metaLabel: '📋 Meta: ',
        yes: 'Có', no: 'Không có',
        totalKH: '👥 Tổng KH: ',
        backupDetail: '📊 Chi tiết backup:',
        confirmRestore: 'Restore dữ liệu?\n\nOK = GHI ĐÈ data cũ\nCancel = HỦY',
        confirmFinal: '⚠️ XÁC NHẬN LẦN CUỐI\n\nToàn bộ dữ liệu sẽ bị GHI ĐÈ.\nChắc chắn?',
        cancelled: '❌ Đã hủy.',
        startRestore: '🚀 Bắt đầu restore...',
        deletingOld: '🗑️ Xóa dữ liệu cũ...',
        deletedOld: '✅ Đã xóa',
        oldDocs: 'documents cũ',
        noOldData: 'ℹ️ Không có data cũ',
        writingData: '📤 Đang ghi dữ liệu từ backup...',
        written: '✅ Đã ghi',
        restoringMeta: '📋 Khôi phục Meta...',
        metaRestored: '✅ Meta đã khôi phục',
        restoreDone: '🎉 RESTORE HOÀN TẤT!',
        sheetsRestored: 'sheets đã khôi phục',
        refreshHint: '💡 Hãy F5 lại Dashboard để kiểm tra.',
        restoreError: '❌ Lỗi restore: ',
        restoreRetry: '⚠️ Nếu lỗi giữa chừng, chạy lại restore.',
        // Add staff
        alertMachine: 'Vui lòng chọn máy!',
        alertMonth: 'Vui lòng chọn tháng!',
        alertName: 'Vui lòng nhập tên nhân viên!',
        alertInvalid: 'Tên chỉ chứa chữ cái và số (không dấu).',
        noMeta: '❌ Không tìm thấy meta!',
        noMachineFound: '❌ Không tìm thấy máy!',
        noMonthToUpdate: '❌ Không có tháng nào để cập nhật!',
        staffExists: 'đã tồn tại, bỏ qua.',
        staffCreated: 'Đã tạo sheet',
        metaUpdated: '✅ Đã cập nhật Meta cho',
        monthsText: 'tháng',
        staffSuccess: '🎉 Thêm nhân viên thành công!',
        staffRefresh: '💡 F5 lại Dashboard để thấy NV mới.',
        staffAlreadyAll: 'đã có sẵn trong tất cả tháng.',
        error: '❌ Lỗi: ',
        // Guide
        guideTitle: '📖 HƯỚNG DẪN SỬ DỤNG',
        guideBackupTitle: '━━━ 💾 CÁCH BACKUP DỮ LIỆU ━━━',
        guideBackup: [
            'Bước 1: Nhấn nút "💾 Backup (JSON)" màu xanh lá',
            'Bước 2: Hệ thống tự động tải file JSON về máy tính',
            'Bước 3: Lưu file này ở nơi an toàn (USB, Google Drive...)',
            '⚠️ NÊN backup TRƯỚC KHI upload Excel mới!',
        ],
        guideRestoreTitle: '━━━ 📦 CÁCH RESTORE DỮ LIỆU ━━━',
        guideRestore: [
            'Bước 1: Nhấn nút "📦 Restore" màu vàng cam',
            'Bước 2: Chọn file JSON đã backup trước đó',
            'Bước 3: Xác nhận 2 lần → hệ thống tự khôi phục',
            'Bước 4: F5 lại Dashboard để kiểm tra dữ liệu',
        ],
        guideStaffTitle: '━━━ 👤 CÁCH THÊM NHÂN VIÊN MỚI ━━━',
        guideStaff: [
            'Bước 1: Nhấn nút "👤 Thêm NV" màu tím',
            'Bước 2: Chọn Máy → Chọn Tháng (hoặc "Tất cả")',
            'Bước 3: Nhập tên nhân viên (VD: JACK) → Nhấn "Thêm"',
            'Bước 4: F5 lại Dashboard → thấy tên mới trong dropdown',
            '✅ KHÔNG ảnh hưởng dữ liệu cũ!',
        ],
    },
    zh: {
        title: '🔍 数据检查 & 恢复工具',
        info1: '💡 此工具用于检查 Firestore 中的所有数据。',
        info2: '如果数据丢失，请重新上传或从备份文件恢复。',
        btnScan: '🔍 扫描数据',
        btnMeta: '📋 查看Meta',
        btnAudit: '📜 审计日志',
        btnBackup: '💾 备份 (JSON)',
        btnRestore: '📦 恢复',
        btnStaff: '👤 添加员工',
        btnGuide: '📖 使用指南',
        switchLang: '🇻🇳 Tiếng Việt',
        outputDefault: '点击"扫描数据"按钮开始...',
        staffTitle: '👤 添加新员工（不会丢失旧数据）',
        staffDesc: '选择机器 + 月份，输入员工姓名 → 系统会将其添加到列表中，<strong style="color:#fbbf24;">不会影响</strong>现有数据。',
        staffMachine: '机器：',
        staffMonth: '月份：',
        staffName: '新员工姓名：',
        staffPlaceholder: '例如：JACK',
        staffAdd: '➕ 添加',
        staffClose: '✕ 关闭',
        staffLoading: '加载中...',
        staffPickMachine: '请先选择机器',
        staffSelectMachine: '-- 选择机器 --',
        staffNoMachine: '没有机器！',
        staffNoMonth: '还没有月份数据',
        staffAllMonths: '📌 所有月份',
        staffCurrentAll: '📋 当前员工（所有月份）：',
        staffCurrentMonth: '📋 员工（月份 ',
        scanning: '🔍 正在扫描 analytics_sheets...',
        emptyCollection: '❌ 数据集完全为空！',
        emptyHint: '→ 数据已被删除或尚未上传。',
        found: '✅ 找到',
        documents: '个文档',
        totalSummary: '📊 总计：',
        customers: '个客户，',
        machines: '台机器',
        thDocId: '文档ID', thCount: '客户数', thVolume: '总产量', thSample: '客户样本', thStatus: '状态',
        readingMeta: '📋 正在读取 meta...',
        metaNotExist: '❌ Meta 文档不存在！',
        metaOk: '✅ Meta 文档存在',
        month: '月份', sheets: '工作表', headers: '列', upload: '上传时间',
        noMonths: '⚠️ 没有月份数据',
        noMachines: '❌ 没有 machines 字段！',
        rawJson: '📦 原始 JSON：',
        readingAudit: '📜 正在读取最近的审计日志...',
        noAudit: '还没有审计日志。',
        thTime: '时间', thAction: '操作', thUser: '操作人', thDetail: '详情',
        backingUp: '💾 正在备份所有数据...',
        backedUp: '✅ 已备份：',
        downloaded: '📥 备份文件已下载！',
        backupWarn: '⚠️ 请妥善保管此文件 - 它包含所有数据。',
        readingFile: '📦 正在读取备份文件：',
        invalidJson: '❌ JSON 文件无效！',
        backupDate: '📅 备份日期：',
        sheetCount: '📄 工作表数：',
        metaLabel: '📋 Meta：',
        yes: '有', no: '没有',
        totalKH: '👥 总客户数：',
        backupDetail: '📊 备份详情：',
        confirmRestore: '恢复数据？\n\nOK = 覆盖旧数据\nCancel = 取消',
        confirmFinal: '⚠️ 最后确认\n\n所有现有数据将被覆盖。\n确定继续？',
        cancelled: '❌ 已取消。',
        startRestore: '🚀 开始恢复...',
        deletingOld: '🗑️ 删除旧数据...',
        deletedOld: '✅ 已删除',
        oldDocs: '个旧文档',
        noOldData: 'ℹ️ 没有旧数据',
        writingData: '📤 正在写入备份数据...',
        written: '✅ 已写入',
        restoringMeta: '📋 恢复 Meta...',
        metaRestored: '✅ Meta 已恢复',
        restoreDone: '🎉 恢复完成！',
        sheetsRestored: '个工作表已恢复',
        refreshHint: '💡 请刷新 Dashboard 页面查看数据。',
        restoreError: '❌ 恢复错误：',
        restoreRetry: '⚠️ 如果中途出错，请重新运行恢复。',
        alertMachine: '请选择机器！',
        alertMonth: '请选择月份！',
        alertName: '请输入员工姓名！',
        alertInvalid: '姓名只能包含字母和数字。',
        noMeta: '❌ 找不到 meta！',
        noMachineFound: '❌ 找不到机器！',
        noMonthToUpdate: '❌ 没有月份可更新！',
        staffExists: '已存在，跳过。',
        staffCreated: '已创建工作表',
        staffSuccess: '🎉 添加员工成功！',
        staffRefresh: '💡 刷新 Dashboard 查看新员工。',
        staffAlreadyAll: '已存在于所有选定月份。',
        metaUpdated: '✅ 已更新 Meta，共',
        monthsText: '个月',
        error: '❌ 错误：',
        guideTitle: '📖 使用指南',
        guideBackupTitle: '━━━ 💾 如何备份数据 ━━━',
        guideBackup: [
            '第1步：点击绿色按钮 "💾 备份 (JSON)"',
            '第2步：系统自动下载 JSON 文件到电脑',
            '第3步：将文件保存到安全位置（U盘、网盘等）',
            '⚠️ 建议在上传新 Excel 之前先备份！',
        ],
        guideRestoreTitle: '━━━ 📦 如何恢复数据 ━━━',
        guideRestore: [
            '第1步：点击橙色按钮 "📦 恢复"',
            '第2步：选择之前备份的 JSON 文件',
            '第3步：确认两次 → 系统自动恢复',
            '第4步：刷新 Dashboard 页面检查数据',
        ],
        guideStaffTitle: '━━━ 👤 如何添加新员工 ━━━',
        guideStaff: [
            '第1步：点击紫色按钮 "👤 添加员工"',
            '第2步：选择机器 → 选择月份（或"所有月份"）',
            '第3步：输入员工姓名（如：JACK）→ 点击"添加"',
            '第4步：刷新 Dashboard → 在下拉菜单中看到新名字',
            '✅ 不会影响旧数据！',
        ],
    }
};

let currentLang = 'vi';

function t(key) { return LANG[currentLang][key] || key; }

function switchLanguage() {
    currentLang = currentLang === 'vi' ? 'zh' : 'vi';
    applyLanguage();
}

function applyLanguage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (key && LANG[currentLang][key]) {
            if (el.tagName === 'INPUT') el.placeholder = LANG[currentLang][key];
            else el.innerHTML = LANG[currentLang][key];
        }
    });
    document.getElementById('langBtn').textContent = t('switchLang');
}

function showGuide() {
    const output = document.getElementById('output');
    output.innerHTML = '';
    const log = (text, cls) => { const s = document.createElement('span'); s.className = cls||''; s.textContent = text+'\n'; output.appendChild(s); };

    log(t('guideTitle'), 'highlight');
    log('');
    log(t('guideBackupTitle'), 'success');
    t('guideBackup').forEach((s,i) => log('  ' + s));
    log('');
    log(t('guideRestoreTitle'), 'success');
    t('guideRestore').forEach((s,i) => log('  ' + s));
    log('');
    log(t('guideStaffTitle'), 'success');
    t('guideStaff').forEach((s,i) => log('  ' + s));
}
