/* ==============================================
   Revenue Dashboard — script.js
   Load from Firestore, render charts & tables
   ============================================== */

const $ = id => document.getElementById(id);
// db is already declared globally by firebase-config.js

// ── State ──
let allMonthsData = {};   // { '2025-01': { dailySales, dailyTransfers, weeklySales, weeklyTransfers, dateHeaders, weekHeaders }, ... }
let availableMonths = [];
let currentMonth = null;
let currentMachine = '__all__'; // '__all__' or '微信001' etc.

// Chart instances
let dailyChartInst = null;
let thresholdChartInst = null;
let compareChartInst = null;
let trendsMonthlyInst = null;
let trendsStackedInst = null;

const MACHINE_NAMES = ['微信001', '微信002', '微信003', '微信004', '微信005', '微信006'];
const MACHINE_COLORS = ['#0066ff', '#ff8c00', '#00c9a7', '#7c3aed', '#ff1744', '#607d8b'];

// ── Boot ──
document.addEventListener('DOMContentLoaded', () => {
    setupNavigation();
});

// Đợi auth.js xác thực xong mới load dữ liệu
document.addEventListener('authReady', async () => {
    await loadManualRevenue();
    await loadFromFirestore();
});

// ── Navigation ──
function setupNavigation() {
    // Sidebar nav
    document.querySelectorAll('.nav-item[data-section]').forEach(item => {
        item.addEventListener('click', e => {
            e.preventDefault();
            const sec = item.dataset.section;
            document.querySelectorAll('.nav-item[data-section]').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            document.querySelectorAll('.section-block').forEach(s => s.style.display = 'none');
            const target = $('section-' + sec);
            if (target) target.style.display = 'block';

            // Update title
            const titleMap = { overview: 'title_overview', report: 'title_report', compare: 'title_compare', trends: 'title_trends' };
            $('pageTitle').textContent = t(titleMap[sec] || 'title_overview');

            // Render section-specific content
            if (sec === 'report') renderReport();
            if (sec === 'compare') renderCompare();
            if (sec === 'trends') renderTrends();

            window.history.pushState(null, null, '#' + sec);
        });
    });

    window.addEventListener('popstate', () => {
        const hash = window.location.hash.substring(1);
        const validSections = ['overview', 'report', 'compare', 'trends'];
        if (validSections.includes(hash)) {
            const targetNav = document.querySelector(`.nav-item[data-section="${hash}"]`);
            if (targetNav) targetNav.click();
        } else if (!hash) {
            const defaultNav = document.querySelector(`.nav-item[data-section="overview"]`);
            if (defaultNav) defaultNav.click();
        }
    });

    // Sidebar toggle
    $('sidebarToggle')?.addEventListener('click', () => {
        $('sidebar').classList.toggle('collapsed');
    });
    $('mobileToggle')?.addEventListener('click', () => {
        $('sidebar').classList.toggle('open');
    });

    // Month select
    $('monthSelect')?.addEventListener('change', e => {
        currentMonth = e.target.value;
        renderOverview();
    });

    // Machine select
    $('machineSelect')?.addEventListener('change', e => {
        currentMachine = e.target.value;
        renderOverview();
        // Also update compare and trends if they are active
        const activeNav = document.querySelector('.nav-item.active[data-section]');
        if (activeNav) {
            const sec = activeNav.dataset.section;
            if (sec === 'report') renderReport();
            if (sec === 'compare') renderCompare();
            if (sec === 'trends') renderTrends();
        }
    });
}

// ── Load from Firestore ──
async function loadFromFirestore() {
    try {
        const metaDoc = await db.collection('revenue').doc('meta').get();
        if (metaDoc.exists) {
            const meta = metaDoc.data();
            availableMonths = meta.months || [];

            for (const monthKey of availableMonths) {
                const doc = await db.collection('revenue').doc(monthKey).get();
                if (doc.exists) allMonthsData[monthKey] = doc.data();
            }

            if (meta.lastUpdated) {
                const d = meta.lastUpdated.toDate();
                const locale = currentLang === 'zh' ? 'zh-CN' : 'vi-VN';
                $('dataInfoText').textContent = t('updated_at') +
                    d.toLocaleDateString(locale) + ' ' +
                    d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
                $('dataInfoText').removeAttribute('data-i18n');
            }
        }

        // Populate (merges Excel + manual months)
        populateMonthSelects();

        // If we have any months at all (Excel or manual), show the dashboard
        if (availableMonths.length === 0 && Object.keys(manualRevenueData).length === 0) {
            $('splashScreen').style.display = 'none';
            $('noDataScreen').style.display = 'flex';
            return;
        }

        // Default to latest month, or current month if no Excel data
        currentMonth = availableMonths[availableMonths.length - 1];
        if (!currentMonth) {
            const now = new Date();
            currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }
        $('monthSelect').value = currentMonth;

        $('splashScreen').style.display = 'none';
        $('dashboardGrid').style.display = 'block';
        renderOverview();

    } catch (err) {
        console.error('Firestore load error:', err);
        $('splashScreen').style.display = 'none';
        $('noDataScreen').style.display = 'flex';
    }
}

function populateMonthSelects() {
    // Merge months from Excel + manual data
    const allMonthSet = new Set(availableMonths);
    Object.keys(manualRevenueData).forEach(docId => {
        const parts = docId.split('_');
        const monthKey = parts.slice(1).join('_');
        if (monthKey && monthKey.match(/^\d{4}-\d{2}$/)) allMonthSet.add(monthKey);
    });
    // Always include current month
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    allMonthSet.add(currentMonthKey);
    const mergedMonths = [...allMonthSet].sort();

    const selects = [$('monthSelect'), $('compareMonthA'), $('compareMonthB')];
    const monthLabels = {
        '01': 'month_jan', '02': 'month_feb', '03': 'month_mar', '04': 'month_apr',
        '05': 'Tháng 5', '06': 'Tháng 6', '07': 'Tháng 7', '08': 'Tháng 8',
        '09': 'Tháng 9', '10': 'Tháng 10', '11': 'Tháng 11', '12': 'Tháng 12',
    };

    selects.forEach(sel => {
        if (!sel) return;
        sel.innerHTML = '';
        mergedMonths.forEach(key => {
            const mm = key.split('-')[1];
            const opt = document.createElement('option');
            opt.value = key;
            const label = monthLabels[mm];
            opt.textContent = label && label.startsWith('month_') ? t(label) : (currentLang === 'zh' ? (parseInt(mm) + '月') : ('Tháng ' + parseInt(mm)));
            sel.appendChild(opt);
        });
    });

    // Default compare: last 2 months
    if ($('compareMonthA') && mergedMonths.length >= 2) {
        $('compareMonthA').value = mergedMonths[mergedMonths.length - 2];
        $('compareMonthB').value = mergedMonths[mergedMonths.length - 1];
    }

    // Update availableMonths if new months appeared
    if (mergedMonths.length > availableMonths.length) {
        availableMonths = mergedMonths;
    }
}

// ── Utility ──
function fmt(num) {
    if (num == null || isNaN(num)) return '0';
    if (Math.abs(num) >= 1e8) return (num / 1e6).toFixed(1) + 'M';
    if (Math.abs(num) >= 1e4) return num.toLocaleString('en', { maximumFractionDigits: 0 });
    return num.toLocaleString('en', { maximumFractionDigits: 2 });
}

function fmtPct(num) {
    return (num * 100).toFixed(1) + '%';
}

function getMonthLabel(key) {
    const monthLabels = { '01': 'month_jan', '02': 'month_feb', '03': 'month_mar', '04': 'month_apr' };
    const mm = key.split('-')[1];
    return t(monthLabels[mm] || ('Tháng ' + parseInt(mm)));
}

function convertDateHeader(h) {
    // Convert Chinese date like "1月5日" to localized
    const match = h.match(/(\d+)月(\d+)日/);
    if (!match) return h;
    const [, m, d] = match;
    if (currentLang === 'vi') return `${d}/${m}`;
    return h;
}

// ══════════════════════════════════════
// SECTION 1: OVERVIEW
// ══════════════════════════════════════
let manualRevenueData = {}; // { machineId: { days: { "1": {card,pc,transfer}, ... } } }
let _revPopupEl = null;

async function loadManualRevenue() {
    try {
        const snap = await db.collection('revenue_daily').get();
        snap.forEach(doc => {
            manualRevenueData[doc.id] = doc.data();
        });
    } catch (e) { console.warn('Manual revenue load:', e); }
}

function getManualDayData(machineId, monthKey, day) {
    const docId = `${machineId}_${monthKey}`;
    return manualRevenueData[docId]?.days?.[String(day)] || null;
}

function renderOverview() {
    const data = allMonthsData[currentMonth];
    const activeMachines = currentMachine === '__all__' ? MACHINE_NAMES : [currentMachine];

    // Parse month/year from currentMonth
    const [yearStr, monthStr] = (currentMonth || '2026-01').split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);

    // Calculate KPIs from Excel data + manual data
    let totalSales = 0, totalTransfer = 0;
    let numDays = 0;

    if (data) {
        const { dailySales, dailyTransfers, dateHeaders } = data;
        numDays = dateHeaders ? dateHeaders.length : 0;
        for (let d = 0; d < numDays; d++) {
            activeMachines.forEach(m => {
                totalSales += (dailySales?.[m]?.[d] || 0);
                totalTransfer += (dailyTransfers?.[m]?.[d] || 0);
            });
        }
    }

    // Also add manual data totals
    const daysInMonth = new Date(year, month, 0).getDate();
    activeMachines.forEach(m => {
        for (let d = 1; d <= daysInMonth; d++) {
            const manual = getManualDayData(m, currentMonth, d);
            if (manual) {
                totalSales += (manual.card || 0) + (manual.pc || 0);
                totalTransfer += (manual.transfer || 0);
                if (!data) numDays++;
            }
        }
    });

    if (numDays === 0) numDays = daysInMonth;
    const avgDaily = numDays > 0 ? totalSales / numDays : 0;

    // Peak days
    let peakCount = 0;
    for (let d = 1; d <= daysInMonth; d++) {
        let dayTotal = 0;
        activeMachines.forEach(m => {
            const manual = getManualDayData(m, currentMonth, d);
            if (manual) dayTotal += (manual.card || 0) + (manual.pc || 0);
        });
        // Also check Excel data
        if (data?.dateHeaders) {
            const idx = d - 1;
            if (idx < data.dateHeaders.length) {
                activeMachines.forEach(m => {
                    dayTotal += (data.dailySales?.[m]?.[idx] || 0);
                });
            }
        }
        if (dayTotal > 10000) peakCount++;
    }

    $('kpiTotalSales').textContent = fmt(totalSales);
    $('kpiTotalTransfer').textContent = fmt(totalTransfer);
    $('kpiAvgDaily').textContent = fmt(avgDaily);
    $('kpiPeakDays').textContent = peakCount + ' / ' + daysInMonth;

    // Render calendar
    renderRevenueCalendar(year, month);
}

// ══════════════════════════════════════
// REPORT PAGE (Boss View)
// ══════════════════════════════════════
function renderReport() {
    const data = allMonthsData[currentMonth];
    if (!data) {
        $('rptTotalSales').textContent = '—';
        $('rptTotalTransfer').textContent = '—';
        $('rptAvgDaily').textContent = '—';
        $('rptPeakDays').textContent = '—';
        return;
    }
    const activeMachines = currentMachine === '__all__' ? MACHINE_NAMES : [currentMachine];
    const { dailySales, dailyTransfers, dateHeaders } = data;
    const numDays = dateHeaders ? dateHeaders.length : 0;

    // Parse month/year
    const [yearStr, monthStr] = (currentMonth || '2026-01').split('-');
    const year = parseInt(yearStr);
    const month = parseInt(monthStr);
    const daysInMonth = new Date(year, month, 0).getDate();

    // Calculate totals
    let totalSales = 0, totalTransfer = 0;
    const salesArr = [], transferArr = [];
    for (let d = 0; d < numDays; d++) {
        let ds = 0, dt = 0;
        activeMachines.forEach(m => {
            ds += (dailySales?.[m]?.[d] || 0);
            dt += (dailyTransfers?.[m]?.[d] || 0);
        });
        // Also add manual data
        activeMachines.forEach(m => {
            const dayNum = d + 1;
            const manual = getManualDayData(m, currentMonth, dayNum);
            if (manual) {
                ds += (manual.card || 0) + (manual.pc || 0);
                dt += (manual.transfer || 0);
            }
        });
        totalSales += ds;
        totalTransfer += dt;
        salesArr.push(ds);
        transferArr.push(dt);
    }

    const avgDaily = numDays > 0 ? totalSales / numDays : 0;
    let peakCount = 0;
    salesArr.forEach(s => { if (s > 10000) peakCount++; });

    // Update KPI cards
    $('rptTotalSales').textContent = fmt(totalSales);
    $('rptTotalTransfer').textContent = fmt(totalTransfer);
    $('rptAvgDaily').textContent = fmt(avgDaily);
    $('rptPeakDays').textContent = peakCount + ' / ' + numDays;

    // Render charts & tables
    renderDailyChart(dateHeaders, salesArr, transferArr);
    renderThresholdChart(salesArr);
    renderMachineTable(data, activeMachines);
    renderTop5(dateHeaders, salesArr);
}
function renderDailyChart(dates, sales, transfers) {
    if (dailyChartInst) dailyChartInst.destroy();
    const labels = (dates || []).map(convertDateHeader);

    dailyChartInst = new Chart($('dailyChart'), {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: t('chart_sales'),
                    data: sales,
                    backgroundColor: 'rgba(0, 102, 255, 0.6)',
                    borderColor: '#0066ff',
                    borderWidth: 1,
                    borderRadius: 4,
                    order: 2,
                },
                {
                    label: t('chart_transfer'),
                    data: transfers,
                    type: 'line',
                    borderColor: '#ff8c00',
                    backgroundColor: 'rgba(255, 140, 0, 0.1)',
                    borderWidth: 2,
                    pointRadius: 2,
                    fill: true,
                    tension: 0.3,
                    order: 1,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { font: { size: 12, weight: '600' } } },
                tooltip: {
                    callbacks: {
                        label: ctx => ctx.dataset.label + ': ' + fmt(ctx.raw)
                    }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { maxRotation: 60, font: { size: 10 } } },
                y: { beginAtZero: true, ticks: { callback: v => fmt(v), font: { size: 11 } } }
            }
        }
    });
}

function renderThresholdChart(perMachinePeaks, numDays, activeMachines) {
    if (thresholdChartInst) thresholdChartInst.destroy();
    const info = $('thresholdInfo');

    if (activeMachines.length === 1) {
        // Single machine: donut chart
        const above = perMachinePeaks[activeMachines[0]];
        const below = numDays - above;
        thresholdChartInst = new Chart($('thresholdChart'), {
            type: 'doughnut',
            data: {
                labels: [t('threshold_above'), t('threshold_below')],
                datasets: [{
                    data: [above, below],
                    backgroundColor: ['#00c853', '#ff1744'],
                    borderWidth: 2, borderColor: '#fff',
                }]
            },
            options: {
                responsive: true,
                cutout: '65%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: { label: ctx => ctx.label + ': ' + ctx.raw + ' ' + t('days_label') }
                    }
                }
            }
        });
        info.innerHTML = `
            <div class="th-row"><span class="th-label" style="color:#00c853;">● ${t('threshold_above')}</span><span class="th-val">${above} ${t('days_label')} (${numDays > 0 ? fmtPct(above/numDays) : '0%'})</span></div>
            <div class="th-row"><span class="th-label" style="color:#ff1744;">● ${t('threshold_below')}</span><span class="th-val">${numDays - above} ${t('days_label')} (${numDays > 0 ? fmtPct((numDays - above)/numDays) : '0%'})</span></div>
        `;
    } else {
        // All machines: horizontal bar chart showing each machine's peak count
        const labels = activeMachines.map(m => m.replace('微信', ''));
        const dataVals = activeMachines.map(m => perMachinePeaks[m]);
        const colors = activeMachines.map(m => {
            const idx = MACHINE_NAMES.indexOf(m);
            return MACHINE_COLORS[idx >= 0 ? idx : 0];
        });

        thresholdChartInst = new Chart($('thresholdChart'), {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: t('threshold_above'),
                    data: dataVals,
                    backgroundColor: colors.map(c => c + 'cc'),
                    borderColor: colors,
                    borderWidth: 1,
                    borderRadius: 4,
                }]
            },
            options: {
                responsive: true,
                indexAxis: 'y',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: { label: ctx => ctx.raw + ' / ' + numDays + ' ' + t('days_label') + ' (' + fmtPct(ctx.raw / numDays) + ')' }
                    }
                },
                scales: {
                    x: { beginAtZero: true, max: numDays, grid: { display: false }, ticks: { stepSize: 5 } },
                    y: { grid: { display: false } }
                }
            }
        });

        // Info: summary text
        const totalPk = Object.values(perMachinePeaks).reduce((s, v) => s + v, 0);
        const avgPk = (totalPk / activeMachines.length).toFixed(1);
        info.innerHTML = `
            <div class="th-row"><span class="th-label">⌀ ${currentLang === 'zh' ? '平均' : 'TB'}</span><span class="th-val">${avgPk} / ${numDays} ${t('days_label')}</span></div>
        `;
    }
}
function renderMachineTable(data, activeMachines) {
    const { weeklySales, weeklyTransfers, weekHeaders } = data;
    const numWeeks = weekHeaders ? weekHeaders.length : 0;
    const displayMachines = activeMachines || MACHINE_NAMES;
    const isSingle = displayMachines.length === 1;

    // Header
    let headHTML = '<tr>';
    headHTML += `<th>${isSingle ? t('col_sales') + ' / ' + t('col_transfer') : t('col_machine')}</th>`;
    for (let w = 0; w < numWeeks; w++) {
        headHTML += `<th>${t('col_week', { n: w + 1 })}</th>`;
    }
    headHTML += `<th>${t('col_month_total')}</th>`;
    headHTML += '</tr>';
    $('machineTableHead').innerHTML = headHTML;

    let bodyHTML = '';

    if (isSingle) {
        // Single machine: show Sales row + Transfer row
        const m = displayMachines[0];
        const colorIdx = MACHINE_NAMES.indexOf(m);
        const color = MACHINE_COLORS[colorIdx >= 0 ? colorIdx : 0];

        // Sales row
        const sales = weeklySales?.[m] || [];
        let salesTotal = 0;
        bodyHTML += `<tr><td><strong style="color:${color}"><i class="fas fa-chart-line"></i> ${t('col_sales')}</strong></td>`;
        for (let w = 0; w < numWeeks; w++) {
            const v = sales[w] || 0;
            salesTotal += v;
            bodyHTML += `<td>${fmt(v)}</td>`;
        }
        bodyHTML += `<td><strong>${fmt(salesTotal)}</strong></td></tr>`;

        // Transfer row
        const transfers = weeklyTransfers?.[m] || [];
        let transferTotal = 0;
        bodyHTML += `<tr><td><strong style="color:#ff8c00"><i class="fas fa-money-bill-transfer"></i> ${t('col_transfer')}</strong></td>`;
        for (let w = 0; w < numWeeks; w++) {
            const v = transfers[w] || 0;
            transferTotal += v;
            bodyHTML += `<td>${fmt(v)}</td>`;
        }
        bodyHTML += `<td><strong>${fmt(transferTotal)}</strong></td></tr>`;

    } else {
        // Multiple machines: one row per machine (sales only), with total
        let weekTotals = new Array(numWeeks).fill(0);
        let grandTotal = 0;

        displayMachines.forEach((m, idx) => {
            const colorIdx = MACHINE_NAMES.indexOf(m);
            const sales = weeklySales?.[m] || [];
            let rowTotal = 0;
            bodyHTML += `<tr><td><strong style="color:${MACHINE_COLORS[colorIdx >= 0 ? colorIdx : idx]}">${m}</strong></td>`;
            for (let w = 0; w < numWeeks; w++) {
                const v = sales[w] || 0;
                rowTotal += v;
                weekTotals[w] += v;
                bodyHTML += `<td>${fmt(v)}</td>`;
            }
            grandTotal += rowTotal;
            bodyHTML += `<td><strong>${fmt(rowTotal)}</strong></td></tr>`;
        });

        // Total row
        bodyHTML += `<tr><td><strong>${t('row_total')}</strong></td>`;
        for (let w = 0; w < numWeeks; w++) {
            bodyHTML += `<td><strong>${fmt(weekTotals[w])}</strong></td>`;
        }
        bodyHTML += `<td><strong>${fmt(grandTotal)}</strong></td></tr>`;
    }

    $('machineTableBody').innerHTML = bodyHTML;
}

function renderTop5(dates, dailyTotals, grandTotal) {
    const indexed = dailyTotals.map((v, i) => ({ val: v, date: dates[i], idx: i }));
    indexed.sort((a, b) => b.val - a.val);
    const top = indexed.slice(0, 5);

    const list = $('top5List');
    list.innerHTML = top.map((item, rank) => `
        <div class="top5-item">
            <div class="top5-rank r${rank + 1}">${rank + 1}</div>
            <div class="top5-info">
                <div class="top5-date">${convertDateHeader(item.date)}</div>
                <div class="top5-sub">${grandTotal > 0 ? fmtPct(item.val / grandTotal) : '—'} ${t('pct_label')}</div>
            </div>
            <div class="top5-val">${fmt(item.val)}</div>
        </div>
    `).join('');
}

// ══════════════════════════════════════
// SECTION 2: COMPARE
// ══════════════════════════════════════
function renderCompare() {
    const monthA = $('compareMonthA')?.value;
    const monthB = $('compareMonthB')?.value;
    if (!monthA || !monthB) return;
    const dataA = allMonthsData[monthA];
    const dataB = allMonthsData[monthB];
    if (!dataA || !dataB) return;

    // Determine limit days
    const maxDaysA = dataA.dateHeaders ? dataA.dateHeaders.length : 0;
    const maxDaysB = dataB.dateHeaders ? dataB.dateHeaders.length : 0;
    
    const daysInput = $('compareDaysInput');
    const minAvailable = Math.min(maxDaysA, maxDaysB);
    if (daysInput && !daysInput.value) {
        daysInput.value = minAvailable || 1;
    }
    
    let limitDays = parseInt(daysInput?.value, 10);
    if (isNaN(limitDays) || limitDays < 1) limitDays = 31;

    // Compute totals
    const totA = computeMonthTotals(dataA, null, limitDays);
    const totB = computeMonthTotals(dataB, null, limitDays);

    // KPIs
    renderChangeKPI('compareSalesChange', totA.totalSales, totB.totalSales);
    renderChangeKPI('compareTransferChange', totA.totalTransfer, totB.totalTransfer);

    // Chart
    renderCompareChart(dataA, dataB, monthA, monthB, limitDays);

    // Machine comparison table
    renderCompareMachineTable(dataA, dataB, monthA, monthB, limitDays);
}

// Listen for changes on compare dropdowns
$('compareMonthA')?.addEventListener('change', () => {
    if ($('compareDaysInput')) $('compareDaysInput').value = '';
    renderCompare();
});
$('compareMonthB')?.addEventListener('change', () => {
    if ($('compareDaysInput')) $('compareDaysInput').value = '';
    renderCompare();
});
$('compareDaysInput')?.addEventListener('input', renderCompare);

function computeMonthTotals(data, machineFilter, limitDays = null) {
    const activeMachines = machineFilter || (currentMachine === '__all__' ? MACHINE_NAMES : [currentMachine]);
    let totalSales = 0, totalTransfer = 0;
    const maxDays = data.dateHeaders ? data.dateHeaders.length : 0;
    const numDays = limitDays !== null ? Math.min(limitDays, maxDays) : maxDays;
    
    for (let d = 0; d < numDays; d++) {
        activeMachines.forEach(m => {
            totalSales += (data.dailySales?.[m]?.[d] || 0);
            totalTransfer += (data.dailyTransfers?.[m]?.[d] || 0);
        });
    }

    const machineSales = {};
    activeMachines.forEach(m => {
        let s = 0;
        for (let d = 0; d < numDays; d++) s += (data.dailySales?.[m]?.[d] || 0);
        machineSales[m] = s;
    });

    return { totalSales, totalTransfer, machineSales, numDays };
}

function renderChangeKPI(elId, valA, valB) {
    const el = $(elId);
    if (!el) return;
    if (valA === 0) { el.textContent = '—'; return; }
    const change = ((valB - valA) / valA);
    const isUp = change >= 0;
    el.innerHTML = `
        <span class="${isUp ? 'change-up' : 'change-down'}">
            <span class="change-arrow">${isUp ? '▲' : '▼'}</span>
            ${fmtPct(Math.abs(change))}
        </span>
    `;
}

function renderCompareChart(dataA, dataB, monthKeyA, monthKeyB, limitDays = null) {
    if (compareChartInst) compareChartInst.destroy();

    const maxDaysA = dataA.dateHeaders?.length || 0;
    const maxDaysB = dataB.dateHeaders?.length || 0;
    const maxDays = limitDays !== null ? limitDays : Math.max(maxDaysA, maxDaysB);
    const labels = Array.from({ length: maxDays }, (_, i) => i + 1);

    const activeMachines = currentMachine === '__all__' ? MACHINE_NAMES : [currentMachine];
    const salesA = [], salesB = [];
    for (let d = 0; d < maxDays; d++) {
        let sA = 0, sB = 0;
        activeMachines.forEach(m => {
            if (d < maxDaysA) sA += (dataA.dailySales?.[m]?.[d] || 0);
            if (d < maxDaysB) sB += (dataB.dailySales?.[m]?.[d] || 0);
        });
        salesA.push(sA);
        salesB.push(sB);
    }

    compareChartInst = new Chart($('compareChart'), {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: getMonthLabel(monthKeyA),
                    data: salesA,
                    borderColor: '#0066ff', backgroundColor: 'rgba(0,102,255,0.1)',
                    borderWidth: 2, pointRadius: 2, fill: true, tension: 0.3,
                },
                {
                    label: getMonthLabel(monthKeyB),
                    data: salesB,
                    borderColor: '#ff8c00', backgroundColor: 'rgba(255,140,0,0.1)',
                    borderWidth: 2, pointRadius: 2, fill: true, tension: 0.3,
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top' },
                tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + fmt(ctx.raw) } }
            },
            scales: {
                x: { title: { display: true, text: currentLang === 'zh' ? '日' : 'Ngày' }, grid: { display: false } },
                y: { beginAtZero: true, ticks: { callback: v => fmt(v) } }
            }
        }
    });
}

function renderCompareMachineTable(dataA, dataB, monthKeyA, monthKeyB, limitDays = null) {
    const totA = computeMonthTotals(dataA, null, limitDays);
    const totB = computeMonthTotals(dataB, null, limitDays);

    let headHTML = `<tr><th>${t('col_machine')}</th><th>${getMonthLabel(monthKeyA)}</th><th>${getMonthLabel(monthKeyB)}</th><th>${t('col_change')}</th></tr>`;
    $('compareMachineHead').innerHTML = headHTML;

    let bodyHTML = '';
    MACHINE_NAMES.forEach((m, idx) => {
        const vA = totA.machineSales[m] || 0;
        const vB = totB.machineSales[m] || 0;
        const change = vA > 0 ? ((vB - vA) / vA) : 0;
        const isUp = change >= 0;
        bodyHTML += `<tr>
            <td><strong style="color:${MACHINE_COLORS[idx]}">${m}</strong></td>
            <td>${fmt(vA)}</td>
            <td>${fmt(vB)}</td>
            <td class="${isUp ? 'val-positive' : 'val-negative'}">${isUp ? '▲' : '▼'} ${fmtPct(Math.abs(change))}</td>
        </tr>`;
    });

    // Total row
    const totalChange = totA.totalSales > 0 ? ((totB.totalSales - totA.totalSales) / totA.totalSales) : 0;
    const isUpT = totalChange >= 0;
    bodyHTML += `<tr>
        <td><strong>${t('row_total')}</strong></td>
        <td><strong>${fmt(totA.totalSales)}</strong></td>
        <td><strong>${fmt(totB.totalSales)}</strong></td>
        <td class="${isUpT ? 'val-positive' : 'val-negative'}"><strong>${isUpT ? '▲' : '▼'} ${fmtPct(Math.abs(totalChange))}</strong></td>
    </tr>`;

    $('compareMachineBody').innerHTML = bodyHTML;
}

// ══════════════════════════════════════
// SECTION 3: TRENDS
// ══════════════════════════════════════
function renderTrends() {
    renderTrendsMonthly();
    renderTrendsStacked();
}

function renderTrendsMonthly() {
    if (trendsMonthlyInst) trendsMonthlyInst.destroy();

    const labels = availableMonths.map(getMonthLabel);
    const salesData = [], transferData = [];

    availableMonths.forEach(key => {
        const d = allMonthsData[key];
        const tot = computeMonthTotals(d);
        salesData.push(tot.totalSales);
        transferData.push(tot.totalTransfer);
    });

    trendsMonthlyInst = new Chart($('trendsMonthlyChart'), {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: t('chart_sales'),
                    data: salesData,
                    backgroundColor: 'rgba(0,102,255,0.7)',
                    borderColor: '#0066ff', borderWidth: 1, borderRadius: 6,
                },
                {
                    label: t('chart_transfer'),
                    data: transferData,
                    backgroundColor: 'rgba(255,140,0,0.7)',
                    borderColor: '#ff8c00', borderWidth: 1, borderRadius: 6,
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'top' },
                tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + fmt(ctx.raw) } }
            },
            scales: {
                y: { beginAtZero: true, ticks: { callback: v => fmt(v) } }
            }
        }
    });
}

function renderTrendsStacked() {
    if (trendsStackedInst) trendsStackedInst.destroy();

    const labels = availableMonths.map(getMonthLabel);
    const activeMachines = currentMachine === '__all__' ? MACHINE_NAMES : [currentMachine];

    if (activeMachines.length === 1) {
        // Single machine: show sales + transfer line/bar chart
        const m = activeMachines[0];
        const colorIdx = MACHINE_NAMES.indexOf(m);
        const salesData = [], transferData = [];
        availableMonths.forEach(key => {
            const d = allMonthsData[key];
            const tot = computeMonthTotals(d, [m]);
            salesData.push(tot.totalSales);
            transferData.push(tot.totalTransfer);
        });

        trendsStackedInst = new Chart($('trendsStackedChart'), {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: t('chart_sales') + ' (' + m + ')',
                        data: salesData,
                        backgroundColor: (MACHINE_COLORS[colorIdx] || '#0066ff') + 'aa',
                        borderColor: MACHINE_COLORS[colorIdx] || '#0066ff',
                        borderWidth: 1, borderRadius: 6,
                    },
                    {
                        label: t('chart_transfer') + ' (' + m + ')',
                        data: transferData,
                        backgroundColor: 'rgba(255,140,0,0.5)',
                        borderColor: '#ff8c00',
                        borderWidth: 1, borderRadius: 6,
                    }
                ]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'top' },
                    tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + fmt(ctx.raw) } }
                },
                scales: {
                    y: { beginAtZero: true, ticks: { callback: v => fmt(v) } }
                }
            }
        });
    } else {
        // All machines: stacked bar
        const datasets = MACHINE_NAMES.map((m, idx) => {
            const data = availableMonths.map(key => {
                const d = allMonthsData[key];
                const tot = computeMonthTotals(d, [m]);
                return tot.totalSales;
            });
            return {
                label: m,
                data,
                backgroundColor: MACHINE_COLORS[idx] + 'cc',
                borderColor: MACHINE_COLORS[idx],
                borderWidth: 1,
            };
        });

        trendsStackedInst = new Chart($('trendsStackedChart'), {
            type: 'bar',
            data: { labels, datasets },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'top' },
                    tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + fmt(ctx.raw) } }
                },
                scales: {
                    x: { stacked: true },
                    y: { stacked: true, beginAtZero: true, ticks: { callback: v => fmt(v) } }
                }
            }
        });
    }
}

// ── Re-render on language change ──
function reRenderAll() {
    populateMonthSelects();
    if (currentMonth) {
        $('monthSelect').value = currentMonth;
        renderOverview();
    }
    const activeNav = document.querySelector('.nav-item.active[data-section]');
    if (activeNav) {
        const sec = activeNav.dataset.section;
        if (sec === 'report') renderReport();
        if (sec === 'compare') renderCompare();
        if (sec === 'trends') renderTrends();
    }
}

// ══════════════════════════════════════
// REVENUE CALENDAR
// ══════════════════════════════════════

let _selectedDay = null;

function renderMiniCalendar(year, month) {
    const el = $('revMiniCal');
    if (!el) return;
    const activeMachines = currentMachine === '__all__' ? MACHINE_NAMES : [currentMachine];
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDay = new Date(year, month - 1, 1).getDay();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;
    const today = new Date();
    const weekdays = t('rev_weekdays') || ['T2','T3','T4','T5','T6','T7','CN'];
    const monthNames = currentLang === 'zh'
        ? ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月']
        : ['Th.1','Th.2','Th.3','Th.4','Th.5','Th.6','Th.7','Th.8','Th.9','Th.10','Th.11','Th.12'];

    let html = `<div class="rev-mini-cal-header">
        <div class="rev-mini-cal-title">${monthNames[month-1]} ${year}</div>
    </div>
    <div class="rev-mini-cal-grid">`;

    weekdays.forEach(wd => { html += `<div class="rev-mini-cal-wd">${wd}</div>`; });
    for (let i = 0; i < startOffset; i++) html += `<div class="rev-mini-cal-d empty"></div>`;

    for (let d = 1; d <= daysInMonth; d++) {
        let cls = 'rev-mini-cal-d';
        // Check has data
        let hasD = false;
        activeMachines.forEach(m => {
            if (getManualDayData(m, currentMonth, d)) hasD = true;
        });
        if (!hasD && allMonthsData[currentMonth]?.dateHeaders) {
            const idx = d - 1;
            if (idx < allMonthsData[currentMonth].dateHeaders.length) {
                activeMachines.forEach(m => {
                    if ((allMonthsData[currentMonth].dailySales?.[m]?.[idx] || 0) > 0) hasD = true;
                });
            }
        }
        if (hasD) cls += ' has-data';
        if (year === today.getFullYear() && month === today.getMonth() + 1 && d === today.getDate()) cls += ' today';
        if (_selectedDay === d) cls += ' selected';
        html += `<div class="${cls}" data-day="${d}">${d}</div>`;
    }
    html += `</div>`;
    el.innerHTML = html;

    // Click on mini cal day
    el.querySelectorAll('.rev-mini-cal-d:not(.empty)').forEach(cel => {
        cel.addEventListener('click', () => {
            const day = parseInt(cel.dataset.day);
            selectDay(day, year, month);
        });
    });
}

function selectDay(day, year, month) {
    _selectedDay = day;
    // Highlight on mini cal
    document.querySelectorAll('.rev-mini-cal-d.selected').forEach(el => el.classList.remove('selected'));
    document.querySelector(`.rev-mini-cal-d[data-day="${day}"]`)?.classList.add('selected');
    // Highlight on big cal
    document.querySelectorAll('.rev-cal-day.selected').forEach(el => el.classList.remove('selected'));
    document.querySelector(`.rev-cal-day[data-day="${day}"]`)?.classList.add('selected');
    // Update detail panel
    updateDayDetail(day, year, month);
}

function updateDayDetail(day, year, month) {
    const title = $('revDetailTitle');
    const body = $('revDetailBody');
    if (!title || !body) return;

    title.innerHTML = `<i class="fas fa-calendar-day"></i> ${String(day).padStart(2,'0')}/${String(month).padStart(2,'0')}/${year}`;

    const activeMachines = currentMachine === '__all__' ? MACHINE_NAMES : [currentMachine];
    let totalCard = 0, totalPc = 0, totalTransfer = 0, excelSales = 0, excelTransfer = 0;

    const excelData = allMonthsData[currentMonth];
    if (excelData?.dateHeaders) {
        excelData.dateHeaders.forEach((hdr, idx) => {
            const match = String(hdr).match(/(\d+)月(\d+)日/);
            const hd = match ? parseInt(match[2]) : (idx + 1);
            if (hd === day) {
                activeMachines.forEach(m => {
                    excelSales += (excelData.dailySales?.[m]?.[idx] || 0);
                    excelTransfer += (excelData.dailyTransfers?.[m]?.[idx] || 0);
                });
            }
        });
    }
    activeMachines.forEach(m => {
        const manual = getManualDayData(m, currentMonth, day);
        if (manual) {
            totalCard += (manual.card || 0);
            totalPc += (manual.pc || 0);
            totalTransfer += (manual.transfer || 0);
        }
    });

    const sales = (totalCard + totalPc) || excelSales;
    const transfer = totalTransfer || excelTransfer;

    if (sales === 0 && transfer === 0) {
        body.innerHTML = `<div class="rev-detail-empty">${t('rev_no_data_day')}</div>`;
        return;
    }

    body.innerHTML = `
        ${totalCard > 0 || totalPc > 0 ? `
        <div class="rev-detail-row">
            <span class="rev-detail-row-label"><i class="fas fa-credit-card" style="color:#2563eb"></i> ${t('rev_card_sales')}</span>
            <span class="rev-detail-row-val">${fmt(totalCard)}</span>
        </div>
        <div class="rev-detail-row">
            <span class="rev-detail-row-label"><i class="fas fa-desktop" style="color:#7c3aed"></i> ${t('rev_pc_sales')}</span>
            <span class="rev-detail-row-val">${fmt(totalPc)}</span>
        </div>` : `
        <div class="rev-detail-row">
            <span class="rev-detail-row-label"><i class="fas fa-chart-line" style="color:#7c3aed"></i> ${t('kpi_total_sales')}</span>
            <span class="rev-detail-row-val">${fmt(excelSales)}</span>
        </div>`}
        <div class="rev-detail-row">
            <span class="rev-detail-row-label"><i class="fas fa-money-bill-transfer" style="color:#d97706"></i> ${t('rev_transfer')}</span>
            <span class="rev-detail-row-val">${fmt(transfer)}</span>
        </div>
        <div class="rev-detail-total">
            <span class="rev-detail-total-label">${t('rev_total')}</span>
            <span class="rev-detail-total-val">${fmt(sales)}</span>
        </div>
    `;
}

function renderRevenueCalendar(year, month) {
    const cal = $('revCalendar');
    if (!cal) return;
    cal.innerHTML = '';
    closeRevPopup();

    const isAllMachines = currentMachine === '__all__';
    const activeMachines = isAllMachines ? MACHINE_NAMES : [currentMachine];
    const info = $('revCalInfo');
    if (info) info.textContent = isAllMachines ? t('rev_select_machine') : currentMachine;

    // Render mini calendar
    renderMiniCalendar(year, month);

    // Weekday headers
    const weekdays = t('rev_weekdays') || ['T2','T3','T4','T5','T6','T7','CN'];
    weekdays.forEach(wd => {
        const el = document.createElement('div');
        el.className = 'rev-cal-weekday';
        el.textContent = wd;
        cal.appendChild(el);
    });

    const firstDay = new Date(year, month - 1, 1).getDay();
    const startOffset = firstDay === 0 ? 6 : firstDay - 1;
    const daysInMonth = new Date(year, month, 0).getDate();
    const today = new Date();

    for (let i = 0; i < startOffset; i++) {
        const empty = document.createElement('div');
        empty.className = 'rev-cal-day empty';
        const numEl = document.createElement('div');
        numEl.className = 'rev-cal-day-num';
        numEl.textContent = '.';
        empty.appendChild(numEl);
        cal.appendChild(empty);
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const cell = document.createElement('div');
        cell.className = 'rev-cal-day';
        cell.setAttribute('data-day', d);

        if (year === today.getFullYear() && month === today.getMonth() + 1 && d === today.getDate()) {
            cell.classList.add('today');
        }
        if (_selectedDay === d) cell.classList.add('selected');

        // Get data
        let totalCard = 0, totalPc = 0, totalTransfer = 0, excelSales = 0, excelTransfer = 0;
        const excelData = allMonthsData[currentMonth];
        if (excelData?.dateHeaders) {
            excelData.dateHeaders.forEach((hdr, idx) => {
                const match = String(hdr).match(/(\d+)月(\d+)日/);
                const headerDay = match ? parseInt(match[2]) : (idx + 1);
                if (headerDay === d) {
                    activeMachines.forEach(m => {
                        excelSales += (excelData.dailySales?.[m]?.[idx] || 0);
                        excelTransfer += (excelData.dailyTransfers?.[m]?.[idx] || 0);
                    });
                }
            });
        }
        activeMachines.forEach(m => {
            const manual = getManualDayData(m, currentMonth, d);
            if (manual) {
                totalCard += (manual.card || 0);
                totalPc += (manual.pc || 0);
                totalTransfer += (manual.transfer || 0);
            }
        });

        const dayTotal = (totalCard + totalPc) || excelSales;
        const dayTransfer = totalTransfer || excelTransfer;
        const hasData = dayTotal > 0 || dayTransfer > 0;
        if (hasData) cell.classList.add('has-data');

        // Day number (large)
        const numEl = document.createElement('div');
        numEl.className = 'rev-cal-day-num';
        numEl.textContent = String(d).padStart(2, '0');
        cell.appendChild(numEl);

        // Detail pills — total + breakdown
        if (hasData) {
            // Total revenue line
            const totalEl = document.createElement('div');
            totalEl.className = 'rev-cal-day-total';
            totalEl.textContent = fmt(dayTotal);
            cell.appendChild(totalEl);

            // Breakdown pills
            const pills = document.createElement('div');
            pills.className = 'rev-cal-day-details';
            if (totalCard > 0 || totalPc > 0) {
                pills.innerHTML = `<span class="detail-card">💳 ${fmt(totalCard)}</span><span class="detail-pc">🖥 ${fmt(totalPc)}</span>`;
            }
            if (dayTransfer > 0) {
                pills.innerHTML += `<span class="detail-transfer">💸 ${fmt(dayTransfer)}</span>`;
            }
            cell.appendChild(pills);
        }

        // Click → select day + open popup if specific machine
        const dayNum = d;
        cell.addEventListener('click', () => {
            selectDay(dayNum, year, month);
            if (!isAllMachines) {
                openRevDayPopup(cell, dayNum, year, month);
            }
        });

        cal.appendChild(cell);
    }
}

let _revPopupId = 0;
let _revOutsideHandler = null;

function closeRevPopup() {
    if (_revPopupEl) { _revPopupEl.remove(); _revPopupEl = null; }
    document.querySelectorAll('.rev-cal-day.editing').forEach(el => el.classList.remove('editing'));
    if (_revOutsideHandler) {
        document.removeEventListener('mousedown', _revOutsideHandler, true);
        _revOutsideHandler = null;
    }
}

function openRevDayPopup(cell, day, year, month) {
    closeRevPopup();
    _revPopupId++;
    const thisPopupId = _revPopupId;

    const machineId = currentMachine;
    const monthKey = currentMonth;
    const existing = getManualDayData(machineId, monthKey, day);
    const curCard = existing?.card || 0;
    const curPc = existing?.pc || 0;
    const curTransfer = existing?.transfer || 0;

    cell.classList.add('editing');

    const popup = document.createElement('div');
    popup.className = 'rev-cal-popup';
    popup.innerHTML = `
        <div class="rev-cal-popup-title">
            <i class="fas fa-edit"></i> ${String(day).padStart(2,'0')}/${String(month).padStart(2,'0')} — ${machineId}
        </div>
        <div class="rev-cal-popup-group">
            <div class="rev-cal-popup-label"><i class="fas fa-credit-card" style="color:#3b82f6"></i> ${t('rev_card_sales')}</div>
            <input type="number" class="rev-cal-popup-input" id="revInputCard" value="${curCard}" min="0" step="1" placeholder="0">
        </div>
        <div class="rev-cal-popup-group">
            <div class="rev-cal-popup-label"><i class="fas fa-desktop" style="color:#8b5cf6"></i> ${t('rev_pc_sales')}</div>
            <input type="number" class="rev-cal-popup-input" id="revInputPc" value="${curPc}" min="0" step="1" placeholder="0">
        </div>
        <div class="rev-cal-popup-group">
            <div class="rev-cal-popup-label"><i class="fas fa-money-bill-transfer" style="color:#ff8c00"></i> ${t('rev_transfer')}</div>
            <input type="number" class="rev-cal-popup-input" id="revInputTransfer" value="${curTransfer}" min="0" step="1" placeholder="0">
        </div>
        <div class="rev-cal-popup-total">
            <span>${t('rev_total')}:</span>
            <strong id="revPopupTotal">${fmt(curCard + curPc)}</strong>
        </div>
        <div class="rev-cal-popup-actions">
            <button class="rev-cal-popup-btn cancel" id="revCancelBtn"><i class="fas fa-times"></i> ${t('rev_cancel')}</button>
            <button class="rev-cal-popup-btn save" id="revSaveBtn"><i class="fas fa-check"></i> ${t('rev_save')}</button>
        </div>
    `;

    document.body.appendChild(popup);
    _revPopupEl = popup;

    // Position near cell
    const cellRect = cell.getBoundingClientRect();
    let left = cellRect.left + cellRect.width / 2 - 125;
    let top = cellRect.bottom + 8;
    if (left < 10) left = 10;
    if (left + 250 > window.innerWidth) left = window.innerWidth - 260;
    if (top + 350 > window.innerHeight) top = cellRect.top - 350;
    popup.style.position = 'fixed';
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';

    // Auto-update total
    const updateTotal = () => {
        const c = parseInt($('revInputCard')?.value) || 0;
        const p = parseInt($('revInputPc')?.value) || 0;
        const totalEl = $('revPopupTotal');
        if (totalEl) totalEl.textContent = fmt(c + p);
    };
    popup.querySelectorAll('.rev-cal-popup-input').forEach(inp => {
        inp.addEventListener('input', updateTotal);
        inp.addEventListener('keydown', e => {
            if (e.key === 'Enter') { e.preventDefault(); doSave(); }
            if (e.key === 'Escape') closeRevPopup();
        });
    });

    setTimeout(() => { const i = $('revInputCard'); if (i) { i.focus(); i.select(); } }, 60);

    popup.querySelector('#revCancelBtn').addEventListener('click', () => closeRevPopup());

    const doSave = () => {
        const card = parseInt($('revInputCard').value) || 0;
        const pc = parseInt($('revInputPc').value) || 0;
        const transfer = parseInt($('revInputTransfer').value) || 0;
        saveRevDayData(day, card, pc, transfer, cell);
    };
    popup.querySelector('#revSaveBtn').addEventListener('click', doSave);

    // Click outside — use mousedown + popup ID to prevent stale handlers
    _revOutsideHandler = (e) => {
        if (thisPopupId !== _revPopupId) return; // stale handler
        if (_revPopupEl && !_revPopupEl.contains(e.target) && !cell.contains(e.target)) {
            closeRevPopup();
        }
    };
    // Delay registering to avoid catching the current click
    setTimeout(() => {
        if (thisPopupId === _revPopupId) {
            document.addEventListener('mousedown', _revOutsideHandler, true);
        }
    }, 300);
}

async function saveRevDayData(day, card, pc, transfer, cell) {
    const saveBtn = document.querySelector('#revSaveBtn');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${t('rev_saving')}`;
    }

    const machineId = currentMachine;
    const monthKey = currentMonth;
    const docId = `${machineId}_${monthKey}`;
    const dayStr = String(day);

    try {
        const docRef = db.collection('revenue_daily').doc(docId);
        const doc = await docRef.get();

        let days = {};
        if (doc.exists) days = doc.data().days || {};
        days[dayStr] = { card, pc, transfer };

        await docRef.set({
            days,
            machineId,
            monthKey,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // Update local cache
        if (!manualRevenueData[docId]) manualRevenueData[docId] = { days: {} };
        manualRevenueData[docId].days[dayStr] = { card, pc, transfer };

        closeRevPopup();

        // Flash animation
        if (cell) {
            cell.classList.add('just-saved');
            setTimeout(() => cell.classList.remove('just-saved'), 900);
        }

        // Re-render
        renderOverview();

    } catch (err) {
        console.error('Save revenue error:', err);
        alert('Lỗi: ' + err.message);
        closeRevPopup();
    }
}
