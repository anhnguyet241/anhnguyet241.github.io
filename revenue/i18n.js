/* ==============================================
   i18n.js — Revenue Dashboard
   Đa ngôn ngữ Tiếng Việt / 中文
   Mặc định: 中文 (zh)
   ============================================== */

const TRANSLATIONS = {
    zh: {
        appName: '营收报告',
        nav_overview: '总览',
        nav_charts: '图表',
        nav_table: '客户列表',
        nav_compare: '月份对比', // Both uses share compare so maybe conflict? No, nav_rev_compare is used for revenue now
        nav_inactive: '停止交易客户',
        nav_trends: '趋势图表',
        nav_back: '返回首页',

        nav_grp_customer: '👥 客户分析',
        nav_grp_revenue: '💰 营收分析',
        nav_rev_overview: '营收总览',
        nav_rev_compare: '月份对比',
        nav_rev_trends: '趋势图表',

        title_overview: '营收总览',
        title_compare: '月份对比分析',
        title_trends: '历史趋势图表',

        loading: '加载中...',
        loading_title: '正在加载营收数据...',
        loading_sub: '系统正在获取分析数据',

        nodata_title: '暂无数据',
        nodata_sub: '营收数据尚未上传，请联系管理员。',

        label_month: '选择月份：',
        month_jan: '1月',
        month_feb: '2月',
        month_mar: '3月',
        month_apr: '4月',

        label_machine: '设备：',
        machine_all: '📊 综合所有设备',

        // KPI Cards
        kpi_total_sales: '月总营业额',
        kpi_total_transfer: '月总转账额',
        kpi_avg_daily: '日均营业额',
        kpi_peak_days: '高峰天数',
        kpi_peak_days_desc: '营业额 > 10,000',

        // Per machine table
        machine_table_title: '各设备营收明细',
        col_machine: '设备',
        col_week: '第{n}周',
        col_month_total: '月合计',
        col_sales: '营业额',
        col_transfer: '转账额',
        row_total: '合计',

        // Top 5 days
        top5_title: '营业额最高的5天',
        col_date: '日期',
        col_day_of_week: '星期',
        col_amount: '营业额',
        col_pct_of_total: '占比',

        // Daily chart
        daily_chart_title: '每日营业额走势',
        daily_chart_sub: '蓝色柱 = 营业额，橙色线 = 转账额',
        chart_sales: '营业额',
        chart_transfer: '转账额',

        // Threshold analysis
        threshold_title: '营业额分布',
        threshold_above: '超过 10,000 的天数',
        threshold_below: '低于 10,000 的天数',
        days_label: '天',
        pct_label: '占比',

        // Compare section
        compare_month_a: '月份 A：',
        compare_month_b: '月份 B：',
        compare_sales_change: '营业额变化',
        compare_transfer_change: '转账额变化',
        compare_increase: '增长',
        compare_decrease: '下降',
        compare_chart_title: '月份营业额对比走势',
        compare_machine_title: '各设备对比',
        col_month_a_val: '{month}',
        col_month_b_val: '{month}',
        col_change: '变化',

        // Trends section
        trends_monthly_title: '月度营收趋势',
        trends_monthly_sub: '所有月份的营业额和转账额趋势',
        trends_stacked_title: '各设备月度贡献',
        trends_stacked_sub: '堆叠图展示每台设备对总营收的贡献',
        trends_weekly_title: '周度营收热力图',

        // Misc
        updated_at: '更新于：',
        switch_lang: '切换语言',

        // Weekday names
        weekday_mon: '星期一', weekday_tue: '星期二', weekday_wed: '星期三',
        weekday_thu: '星期四', weekday_fri: '星期五', weekday_sat: '星期六', weekday_sun: '星期日',
    },

    vi: {
        appName: 'Báo Cáo Doanh Thu',
        nav_overview: 'Tổng Quan',
        nav_charts: 'Biểu Đồ',
        nav_table: 'Danh Sách KH',
        nav_compare: 'So Sánh',
        nav_inactive: 'KH Ngưng GD',
        nav_trends: 'Biểu Đồ Xu Hướng',
        nav_back: 'Về Trang Chủ',

        nav_grp_customer: '👥 Phân Tích Khách Hàng',
        nav_grp_revenue: '💰 Phân Tích Doanh Số',
        nav_rev_overview: 'Doanh Số Tổng',
        nav_rev_compare: 'So Sánh Tháng',
        nav_rev_trends: 'Biểu Đồ Xu Hướng',

        title_overview: 'Tổng Quan Doanh Thu',
        title_compare: 'So Sánh Doanh Thu Giữa Các Tháng',
        title_trends: 'Biểu Đồ Xu Hướng Lịch Sử',

        loading: 'Đang tải...',
        loading_title: 'Đang tải dữ liệu doanh thu...',
        loading_sub: 'Hệ thống đang lấy dữ liệu phân tích',

        nodata_title: 'Chưa có dữ liệu',
        nodata_sub: 'Dữ liệu doanh thu chưa được upload. Vui lòng liên hệ quản trị viên.',

        label_month: 'Chọn tháng:',
        month_jan: 'Tháng 1',
        month_feb: 'Tháng 2',
        month_mar: 'Tháng 3',
        month_apr: 'Tháng 4',

        label_machine: 'Máy:',
        machine_all: '📊 Tổng hợp tất cả máy',

        // KPI Cards
        kpi_total_sales: 'Tổng Doanh Số Tháng',
        kpi_total_transfer: 'Tổng Tiền Chuyển Tháng',
        kpi_avg_daily: 'Doanh Số TB/Ngày',
        kpi_peak_days: 'Ngày Cao Điểm',
        kpi_peak_days_desc: 'Doanh số > 10,000',

        // Per machine table
        machine_table_title: 'Chi Tiết Doanh Thu Từng Máy',
        col_machine: 'Máy',
        col_week: 'Tuần {n}',
        col_month_total: 'Tổng Tháng',
        col_sales: 'Doanh Số',
        col_transfer: 'Tiền Chuyển',
        row_total: 'Tổng Cộng',

        // Top 5 days
        top5_title: 'Top 5 Ngày Doanh Số Cao Nhất',
        col_date: 'Ngày',
        col_day_of_week: 'Thứ',
        col_amount: 'Doanh Số',
        col_pct_of_total: 'Tỷ Trọng',

        // Daily chart
        daily_chart_title: 'Biến Động Doanh Số Hàng Ngày',
        daily_chart_sub: 'Cột xanh = Doanh số, Đường cam = Tiền chuyển',
        chart_sales: 'Doanh Số',
        chart_transfer: 'Tiền Chuyển',

        // Threshold analysis
        threshold_title: 'Phân Bổ Doanh Số',
        threshold_above: 'Ngày vượt 10,000',
        threshold_below: 'Ngày dưới 10,000',
        days_label: 'ngày',
        pct_label: 'chiếm',

        // Compare section
        compare_month_a: 'Tháng A:',
        compare_month_b: 'Tháng B:',
        compare_sales_change: 'Biến Động Doanh Số',
        compare_transfer_change: 'Biến Động Tiền Chuyển',
        compare_increase: 'Tăng',
        compare_decrease: 'Giảm',
        compare_chart_title: 'So Sánh Biến Động Doanh Số 2 Tháng',
        compare_machine_title: 'So Sánh Từng Máy',
        col_month_a_val: '{month}',
        col_month_b_val: '{month}',
        col_change: 'Thay Đổi',

        // Trends section
        trends_monthly_title: 'Xu Hướng Doanh Thu Qua Các Tháng',
        trends_monthly_sub: 'Tổng doanh số và tiền chuyển qua tất cả các tháng',
        trends_stacked_title: 'Đóng Góp Doanh Số Từng Máy',
        trends_stacked_sub: 'Biểu đồ chồng thể hiện phần đóng góp của mỗi máy',
        trends_weekly_title: 'Bản Đồ Nhiệt Doanh Số Theo Tuần',

        // Misc
        updated_at: 'Cập nhật: ',
        switch_lang: 'Đổi Ngôn Ngữ',

        // Weekday names
        weekday_mon: 'Thứ 2', weekday_tue: 'Thứ 3', weekday_wed: 'Thứ 4',
        weekday_thu: 'Thứ 5', weekday_fri: 'Thứ 6', weekday_sat: 'Thứ 7', weekday_sun: 'CN',
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
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = t(key);
    });
    document.documentElement.lang = currentLang;
    document.title = currentLang === 'zh' ? '营收分析报告' : 'Báo Cáo Doanh Thu';

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
    if (typeof reRenderAll === 'function') reRenderAll();
}

// ─── Init ───
document.addEventListener('DOMContentLoaded', () => {
    applyTranslations();
    const btn = document.getElementById('langSwitch');
    if (btn) btn.addEventListener('click', toggleLanguage);
});
