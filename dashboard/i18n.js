/* ==============================================
   i18n.js — Hệ thống đa ngôn ngữ Tiếng Việt / 中文
   Mặc định: 中文 (zh)
   ============================================== */

const TRANSLATIONS = {
    zh: {
        appName: '报告',
        nav_overview: '总览',
        nav_charts: '图表',
        nav_table: '客户列表',
        nav_trends: '每日趋势',
        nav_compare: '员工对比',
        nav_inactive: '停止交易客户',
        nav_settings: '设置',
        nav_back: '返回',

        nav_grp_customer: '👥 客户分析',
        nav_grp_revenue: '💰 营收分析',
        nav_rev_overview: '营收总览',
        nav_rev_compare: '月份对比',
        nav_rev_trends: '趋势图表',

        switch_machine: '切换设备',
        machine_select_title: '🔥 请选择设备空闲 🔥',
        machine_select_desc: '选择下方的一台设备以查看该设备的详细分析报告。',
        machine_empty: '无数据',

        title_overview: '交易总览',
        title_charts: '数据分析图表',
        title_table: '客户列表',
        title_trends: '每日趋势',
        title_compare: '员工业绩对比',
        title_inactive: '停止交易的客户',
        title_settings: '分类阈值设置',

        loading: '加载中...',
        loading_title: '正在加载报告...',
        loading_sub: '系统正在获取分析数据',

        nodata_title: '暂无数据',
        nodata_sub: '交易数据尚未更新，请联系管理员。',

        label_view: '查看：',
        select_all: '📊 综合 (全部员工)',
        select_staff_prefix: '👤 ',

        kpi_total_customers: '客户总数',
        kpi_high: '高频交易',
        kpi_normal: '普通交易',
        kpi_low: '低频交易',
        kpi_total_volume: '总交易量',

        top5_title: '前5名客户',
        pie_title: '客户分类比例',
        alert_title: '🔔 重点关注',
        analyzing: '正在分析数据...',

        bar_title: '各客户交易量',
        bar_subtitle: '绿色 = 高频，蓝色 = 普通，红色 = 低频',
        radar_title: '前8名客户对比 (雷达图)',
        polar_title: '前6名客户分布 (极坐标)',

        table_title: '全部客户详情',
        search_placeholder: '按姓名或ID搜索...',
        filter_all: '全部',
        filter_high: '高频',
        filter_normal: '普通',
        filter_low: '低频',
        btn_export: '导出CSV',
        col_code: '编号',
        col_id: 'ID / 银行',
        col_name: '客户名',
        col_cardtype: '类型',
        col_total: '总交易量',
        col_category: '分类',
        col_level: '级别',
        table_info: '显示 {filtered} / {total} 位客户',

        trend_title: '每日交易量变动',
        trend_subtitle: '蓝线 = 总交易量，绿线 = 活跃客户数',
        peak_title: '最高交易日',
        low_title: '最低交易日',
        no_data: '暂无数据',
        daily_table_title: '每日数据表',
        col_date: '日期',
        col_daily_total: '总交易量',
        col_active_kh: '活跃客户数',

        compare_title: '各员工业绩对比',
        compare_subtitle: '每个柱子代表一位员工的总交易量',
        compare_rank_title: '员工排行榜',
        col_rank: '排名',
        col_staff: '员工',
        col_total_volume: '总交易量',
        col_customer_count: '客户数',
        col_avg: '平均/客户',

        inactive_title: '停止交易的客户',
        inactive_desc: '查找在最近N天内没有任何交易的客户。拖动滑块更改检查时间范围。',
        inactive_label_pre: '检查最近',
        inactive_label_post: '天',
        slider_1d: '1天',
        slider_15d: '15天',
        slider_30d: '30天',
        inactive_count_label: '非活跃客户',
        active_count_label: '活跃客户',
        inactive_list_title: '停止交易客户列表',
        col_id_bank: 'ID / 银行',
        col_total_all: '总交易量(全期)',
        col_last_tx: '最近交易日',
        col_status: '状态',
        status_inactive: '已停止活动',
        never_tx: '从未交易',
        all_active_msg: '太好了！所有客户在最近{n}天内都有交易 🎉',
        volume: '交易量',

        settings_title: '调整分类阈值',
        settings_desc: '更改阈值将影响整个报告中"高频"/"低频"的分类。',
        high_thresh_label: '高频阈值',
        low_thresh_label: '低频阈值',

        // Alert messages
        alert_low_pct_high: '⚠️ {pct}% 的客户交易低频 — 需要重新关注这一群体。',
        alert_low_pct_mid: '{pct}% 的客户交易低频 — 建议持续关注。',
        alert_top_dominant: '客户 {name} 占总交易量的 {pct}% — 对单一客户依赖过大。',
        alert_high_pct_good: '✅ {pct}% 的客户交易高频 — 业绩良好！',
        alert_inactive_7d: '{count} 位客户在最近7天内没有交易。',
        alert_all_ok: '所有指标正常，暂无需关注的问题。',

        // Chart labels
        chart_total_volume: '总交易量',
        chart_active_kh: '活跃客户数',
        chart_volume: '交易量: ',
        tooltip_kh: '客户: ',

        // Category tags
        tag_high: '高频',
        tag_normal: '普通',
        tag_low: '低频',
        tag_inactive: '已停止',

        // Staff ranking card
        staff_rank_title: '员工排行榜',
        staff_rank_sub: '各员工交易量对比',
        col_staff_rank: '排名',
        col_staff_name: '员工',
        col_staff_vol: '总交易量',
        col_staff_kh: '客户数',
        viewing_all: '综合视图（全部员工）',
        viewing_staff: '员工视图',
        kpi_total_customers_all: '全部客户',
        kpi_high_all: '高频客户',
        kpi_low_all: '低频客户',

        // Month selector
        month_all: '📅 全部月份',
        month_label: '月份：',

        // Updated at
        updated_at: '更新于：',
        data_loaded: '数据已加载',

        // Detail modal
        detail_active_days: '交易天数',
        detail_avg_daily: '日均',
        detail_select_month: '选择月份：',
    },

    vi: {
        appName: 'Báo Cáo',
        nav_overview: 'Tổng Quan',
        nav_charts: 'Biểu Đồ',
        nav_table: 'Danh Sách KH',
        nav_trends: 'Xu Hướng Ngày',
        nav_compare: 'So Sánh NV',
        nav_inactive: 'KH Ngưng GD',
        nav_settings: 'Cài Đặt',
        nav_back: 'Quay Lại',

        nav_grp_customer: '👥 Phân Tích Khách Hàng',
        nav_grp_revenue: '💰 Phân Tích Doanh Số',
        nav_rev_overview: 'Doanh Số Tổng',
        nav_rev_compare: 'So Sánh Tháng',
        nav_rev_trends: 'Biểu Đồ Xu Hướng',

        switch_machine: 'Đổi Máy',
        machine_select_title: '🔥 Vui lòng chọn máy tính rảnh rỗi 🔥',
        machine_select_desc: 'Chọn một máy tính bên dưới để xem báo cáo phân tích chi tiết của máy đó.',
        machine_empty: 'Chưa có dữ liệu',

        title_overview: 'Tổng Quan Giao Dịch',
        title_charts: 'Biểu Đồ Phân Tích',
        title_table: 'Danh Sách Khách Hàng',
        title_trends: 'Xu Hướng Theo Ngày',
        title_compare: 'So Sánh Nhân Viên',
        title_inactive: 'Khách Hàng Ngưng Giao Dịch',
        title_settings: 'Cài Đặt Ngưỡng Phân Loại',

        loading: 'Đang tải...',
        loading_title: 'Đang tải báo cáo...',
        loading_sub: 'Hệ thống đang lấy dữ liệu phân tích',

        nodata_title: 'Chưa có dữ liệu',
        nodata_sub: 'Dữ liệu giao dịch chưa được cập nhật. Vui lòng liên hệ quản trị viên.',

        label_view: 'Xem:',
        select_all: '📊 Tổng hợp (Tất cả NV)',
        select_staff_prefix: '👤 ',

        kpi_total_customers: 'Tổng Khách Hàng',
        kpi_high: 'GD Nhiều',
        kpi_normal: 'GD Bình Thường',
        kpi_low: 'GD Ít',
        kpi_total_volume: 'Tổng Sản Lượng',

        top5_title: 'Top 5 Khách Hàng Lớn Nhất',
        pie_title: 'Tỷ Lệ Phân Loại Khách Hàng',
        alert_title: '🔔 Điểm Cần Lưu Ý',
        analyzing: 'Đang phân tích dữ liệu...',

        bar_title: 'Sản Lượng Giao Dịch Từng Khách Hàng',
        bar_subtitle: 'Thanh xanh = GD nhiều, xanh dương = bình thường, đỏ = GD ít',
        radar_title: 'So Sánh Top 8 KH (Radar)',
        polar_title: 'Phân Bổ Top 6 KH (Polar)',

        table_title: 'Danh Sách Chi Tiết Tất Cả Khách Hàng',
        search_placeholder: 'Tìm theo tên hoặc ID...',
        filter_all: 'Tất cả',
        filter_high: 'GD Nhiều',
        filter_normal: 'Bình Thường',
        filter_low: 'GD Ít',
        btn_export: 'Xuất CSV',
        col_code: 'Mã KH',
        col_id: 'ID / Ngân Hàng',
        col_name: 'Tên KH',
        col_cardtype: 'Loại Hình',
        col_total: 'Tổng GD',
        col_category: 'Phân Loại',
        col_level: 'Mức Độ',
        table_info: 'Đang hiển thị {filtered} / {total} khách hàng',

        trend_title: 'Biến Động Giao Dịch Theo Từng Ngày',
        trend_subtitle: 'Đường xanh = tổng sản lượng, Đường xanh lá = số khách hoạt động',
        peak_title: 'Ngày Đạt Cao Nhất',
        low_title: 'Ngày Thấp Nhất',
        no_data: 'Chưa có dữ liệu',
        daily_table_title: 'Bảng Số Liệu Hàng Ngày',
        col_date: 'Ngày',
        col_daily_total: 'Tổng Sản Lượng',
        col_active_kh: 'Số KH Hoạt Động',

        compare_title: 'So Sánh Hiệu Suất Giữa Các Nhân Viên',
        compare_subtitle: 'Mỗi cột đại diện cho tổng sản lượng giao dịch của 1 nhân viên',
        compare_rank_title: 'Bảng Xếp Hạng Nhân Viên',
        col_rank: 'Hạng',
        col_staff: 'Nhân Viên',
        col_total_volume: 'Tổng Sản Lượng',
        col_customer_count: 'Số KH',
        col_avg: 'TB / KH',

        inactive_title: 'Khách Hàng Ngưng Giao Dịch',
        inactive_desc: 'Tìm những khách hàng không có giao dịch nào trong N ngày gần nhất. Kéo thanh trượt để thay đổi khoảng thời gian kiểm tra.',
        inactive_label_pre: 'Kiểm tra',
        inactive_label_post: 'ngày gần nhất',
        slider_1d: '1 ngày',
        slider_15d: '15 ngày',
        slider_30d: '30 ngày',
        inactive_count_label: 'Không Hoạt Động',
        active_count_label: 'Vẫn Hoạt Động',
        inactive_list_title: 'Danh Sách KH Ngưng Giao Dịch',
        col_id_bank: 'ID / Ngân Hàng',
        col_total_all: 'Tổng GD (Toàn Kỳ)',
        col_last_tx: 'Lần GD Gần Nhất',
        col_status: 'Trạng Thái',
        status_inactive: 'Ngưng hoạt động',
        never_tx: 'Chưa bao giờ GD',
        all_active_msg: 'Tuyệt vời! Tất cả khách hàng đều có giao dịch trong {n} ngày gần nhất 🎉',
        volume: 'Sản lượng',

        settings_title: 'Điều Chỉnh Ngưỡng Phân Loại',
        settings_desc: 'Thay đổi ngưỡng sẽ ảnh hưởng đến phân loại "GD Nhiều" / "GD Ít" trên toàn bộ báo cáo.',
        high_thresh_label: 'Ngưỡng GD Nhiều',
        low_thresh_label: 'Ngưỡng GD Ít',

        // Alert messages
        alert_low_pct_high: '⚠️ {pct}% khách hàng có giao dịch ít — cần xem xét chăm sóc lại nhóm này.',
        alert_low_pct_mid: '{pct}% khách hàng có giao dịch ít — nên theo dõi thêm.',
        alert_top_dominant: 'KH {name} chiếm {pct}% tổng sản lượng — phụ thuộc lớn vào 1 khách hàng.',
        alert_high_pct_good: '✅ {pct}% khách hàng giao dịch nhiều — hiệu suất tốt!',
        alert_inactive_7d: '{count} khách hàng không giao dịch trong 7 ngày gần nhất.',
        alert_all_ok: 'Mọi chỉ số đều ổn định, không có vấn đề cần lưu ý.',

        // Chart labels
        chart_total_volume: 'Tổng Sản Lượng',
        chart_active_kh: 'Số KH Hoạt Động',
        chart_volume: 'Sản lượng: ',
        tooltip_kh: 'KH: ',

        // Category tags
        tag_high: 'GD Nhiều',
        tag_normal: 'Bình Thường',
        tag_low: 'GD Ít',
        tag_inactive: 'Ngưng hoạt động',

        // Staff ranking card
        staff_rank_title: 'Xếp Hạng Nhân Viên',
        staff_rank_sub: 'So sánh sản lượng từng nhân viên',
        col_staff_rank: 'Hạng',
        col_staff_name: 'Nhân Viên',
        col_staff_vol: 'Tổng Sản Lượng',
        col_staff_kh: 'Số KH',
        viewing_all: 'Tổng hợp toàn bộ nhân viên',
        viewing_staff: 'Đang xem nhân viên',
        kpi_total_customers_all: 'Tổng KH',
        kpi_high_all: 'KH GD Nhiều',
        kpi_low_all: 'KH GD Ít',

        // Month selector
        month_all: '📅 Tất cả tháng',
        month_label: 'Tháng:',

        // Updated at
        updated_at: 'Cập nhật: ',
        data_loaded: 'Đã tải dữ liệu',

        // Detail modal
        detail_active_days: 'Số Ngày GD',
        detail_avg_daily: 'TB / Ngày',
        detail_select_month: 'Chọn tháng:',
    }
};

// ─── Current language state ───
let currentLang = localStorage.getItem('appLang') || 'zh';

// ─── Get translation ───
function t(key, vars = {}) {
    let str = TRANSLATIONS[currentLang]?.[key] || TRANSLATIONS['zh'][key] || key;
    Object.entries(vars).forEach(([k, v]) => {
        str = str.replace(`{${k}}`, v);
    });
    return str;
}

// ─── Apply all translations to DOM ───
function applyTranslations() {
    // data-i18n text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });

    // data-i18n-placeholder
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = t(key);
    });

    // Cập nhật dropdown options được tạo động (không có data-i18n)
    const allOpt = document.querySelector('#sheetSelect option[data-i18n-key]');
    if (allOpt) allOpt.textContent = t(allOpt.getAttribute('data-i18n-key'));

    document.querySelectorAll('#sheetSelect option[data-staff-name]').forEach(opt => {
        opt.textContent = t('select_staff_prefix') + opt.getAttribute('data-staff-name');
    });

    // Update html lang attribute
    document.documentElement.lang = currentLang;

    // Update title
    document.title = currentLang === 'zh' ? '交易分析报告' : 'Báo Cáo Phân Tích Giao Dịch';

    // Update language switch button
    const flag = document.getElementById('langFlag');
    const label = document.getElementById('langLabel');
    if (flag && label) {
        if (currentLang === 'zh') {
            flag.textContent = '🇻🇳';
            label.textContent = 'Việt';
        } else {
            flag.textContent = '🇨🇳';
            label.textContent = '中文';
        }
    }
}

// ─── Toggle language ───
function toggleLanguage() {
    currentLang = currentLang === 'zh' ? 'vi' : 'zh';
    localStorage.setItem('appLang', currentLang);
    applyTranslations();

    // Re-render dynamic content if dashboard is loaded
    if (typeof analyzeAndRender === 'function' && typeof currentSheetData !== 'undefined' && currentSheetData.length > 0) {
        analyzeAndRender();
        // Update updated_at text manually since it loses data-i18n
        if (window._uploadedAt) {
            const locale = currentLang === 'zh' ? 'zh-CN' : 'vi-VN';
            document.getElementById('dataInfoText').textContent = t('updated_at') +
                window._uploadedAt.toLocaleDateString(locale) + ' ' +
                window._uploadedAt.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
        }
    }

    // Re-render machine layout and dropdowns (which translates Máy -> 设备)
    if (typeof renderCockpit === 'function') {
        renderCockpit();
        // Giữ lại dropdown được chọn
        if (window._currentMachineId) {
            const dp = document.getElementById('machineSelectDropdown');
            if (dp) dp.value = window._currentMachineId;
        }
    }

    // Re-render section-specific content
    const activeSection = document.querySelector('.section-block[style="display: block;"]') ||
        document.querySelector('.section-block:not([style*="display:none"])');
    if (activeSection) {
        const secId = activeSection.id.replace('section-', '');
        if (secId === 'trends' && typeof renderTrends === 'function') renderTrends();
        if (secId === 'compare' && typeof renderCompare === 'function') renderCompare();
        if (secId === 'inactive' && typeof renderInactive === 'function') renderInactive();
    }
}

// ─── Init on DOM ready ───
document.addEventListener('DOMContentLoaded', () => {
    applyTranslations();

    const btn = document.getElementById('langSwitch');
    if (btn) btn.addEventListener('click', toggleLanguage);
});
