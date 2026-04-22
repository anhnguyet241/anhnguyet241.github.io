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

// Chart instances
let dailyChartInst = null;
let thresholdChartInst = null;
let compareChartInst = null;
let trendsMonthlyInst = null;
let trendsStackedInst = null;

const MACHINE_NAMES = ['微信001', '微信002', '微信003', '微信004', '微信005', '微信006'];
const MACHINE_COLORS = ['#0066ff', '#ff8c00', '#00c9a7', '#7c3aed', '#ff1744', '#607d8b'];

// ── Boot ──
document.addEventListener('DOMContentLoaded', async () => {
    setupNavigation();
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
            const titleMap = { overview: 'title_overview', compare: 'title_compare', trends: 'title_trends' };
            $('pageTitle').textContent = t(titleMap[sec] || 'title_overview');

            // Render section-specific content
            if (sec === 'compare') renderCompare();
            if (sec === 'trends') renderTrends();
        });
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
}

// ── Load from Firestore ──
async function loadFromFirestore() {
    try {
        const metaDoc = await db.collection('revenue').doc('meta').get();
        if (!metaDoc.exists) {
            $('splashScreen').style.display = 'none';
            $('noDataScreen').style.display = 'flex';
            return;
        }

        const meta = metaDoc.data();
        availableMonths = meta.months || [];
        if (availableMonths.length === 0) {
            $('splashScreen').style.display = 'none';
            $('noDataScreen').style.display = 'flex';
            return;
        }

        // Load each month document
        for (const monthKey of availableMonths) {
            const doc = await db.collection('revenue').doc(monthKey).get();
            if (doc.exists) {
                allMonthsData[monthKey] = doc.data();
            }
        }

        // Update timestamp
        if (meta.lastUpdated) {
            const d = meta.lastUpdated.toDate();
            const locale = currentLang === 'zh' ? 'zh-CN' : 'vi-VN';
            $('dataInfoText').textContent = t('updated_at') +
                d.toLocaleDateString(locale) + ' ' +
                d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
            $('dataInfoText').removeAttribute('data-i18n');
        }

        // Populate month selectors
        populateMonthSelects();

        // Set default month (latest)
        currentMonth = availableMonths[availableMonths.length - 1];
        $('monthSelect').value = currentMonth;

        // Render
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
    const selects = [$('monthSelect'), $('compareMonthA'), $('compareMonthB')];
    const monthLabels = { '01': 'month_jan', '02': 'month_feb', '03': 'month_mar', '04': 'month_apr' };

    selects.forEach(sel => {
        if (!sel) return;
        sel.innerHTML = '';
        availableMonths.forEach(key => {
            const mm = key.split('-')[1];
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = t(monthLabels[mm] || ('Tháng ' + parseInt(mm)));
            sel.appendChild(opt);
        });
    });

    // Default compare: last 2 months
    if ($('compareMonthA') && availableMonths.length >= 2) {
        $('compareMonthA').value = availableMonths[availableMonths.length - 2];
        $('compareMonthB').value = availableMonths[availableMonths.length - 1];
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
function renderOverview() {
    const data = allMonthsData[currentMonth];
    if (!data) return;

    const { dailySales, dailyTransfers, weeklySales, weeklyTransfers, dateHeaders, weekHeaders } = data;

    // ── Calculate totals ──
    let totalSales = 0, totalTransfer = 0;
    const dailyTotalSales = [];
    const dailyTotalTransfers = [];

    const numDays = dateHeaders ? dateHeaders.length : 0;

    for (let d = 0; d < numDays; d++) {
        let dayS = 0, dayT = 0;
        MACHINE_NAMES.forEach(m => {
            dayS += (dailySales?.[m]?.[d] || 0);
            dayT += (dailyTransfers?.[m]?.[d] || 0);
        });
        dailyTotalSales.push(dayS);
        dailyTotalTransfers.push(dayT);
        totalSales += dayS;
        totalTransfer += dayT;
    }

    const avgDaily = numDays > 0 ? totalSales / numDays : 0;
    const peakDays = dailyTotalSales.filter(v => v > 10000).length;

    // ── KPI Cards ──
    $('kpiTotalSales').textContent = fmt(totalSales);
    $('kpiTotalTransfer').textContent = fmt(totalTransfer);
    $('kpiAvgDaily').textContent = fmt(avgDaily);
    $('kpiPeakDays').textContent = peakDays + ' / ' + numDays;

    // ── Daily Chart ──
    renderDailyChart(dateHeaders, dailyTotalSales, dailyTotalTransfers);

    // ── Threshold Donut ──
    renderThresholdChart(peakDays, numDays - peakDays, numDays);

    // ── Machine Table ──
    renderMachineTable(data);

    // ── Top 5 Days ──
    renderTop5(dateHeaders, dailyTotalSales, totalSales);
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

function renderThresholdChart(above, below, total) {
    if (thresholdChartInst) thresholdChartInst.destroy();
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

    // Info text
    const info = $('thresholdInfo');
    info.innerHTML = `
        <div class="th-row"><span class="th-label" style="color:#00c853;">● ${t('threshold_above')}</span><span class="th-val">${above} ${t('days_label')} (${total > 0 ? fmtPct(above/total) : '0%'})</span></div>
        <div class="th-row"><span class="th-label" style="color:#ff1744;">● ${t('threshold_below')}</span><span class="th-val">${below} ${t('days_label')} (${total > 0 ? fmtPct(below/total) : '0%'})</span></div>
    `;
}

function renderMachineTable(data) {
    const { weeklySales, weeklyTransfers, weekHeaders } = data;
    const numWeeks = weekHeaders ? weekHeaders.length : 0;

    // Header
    let headHTML = '<tr>';
    headHTML += `<th>${t('col_machine')}</th>`;
    for (let w = 0; w < numWeeks; w++) {
        headHTML += `<th>${t('col_week', { n: w + 1 })}</th>`;
    }
    headHTML += `<th>${t('col_month_total')}</th>`;
    headHTML += '</tr>';
    $('machineTableHead').innerHTML = headHTML;

    // Body
    let bodyHTML = '';
    let weekTotals = new Array(numWeeks).fill(0);
    let grandTotal = 0;

    MACHINE_NAMES.forEach((m, idx) => {
        const sales = weeklySales?.[m] || [];
        let rowTotal = 0;
        bodyHTML += `<tr><td><strong style="color:${MACHINE_COLORS[idx]}">${m}</strong></td>`;
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

    // Compute totals
    const totA = computeMonthTotals(dataA);
    const totB = computeMonthTotals(dataB);

    // KPIs
    renderChangeKPI('compareSalesChange', totA.totalSales, totB.totalSales);
    renderChangeKPI('compareTransferChange', totA.totalTransfer, totB.totalTransfer);

    // Chart
    renderCompareChart(dataA, dataB, monthA, monthB);

    // Machine comparison table
    renderCompareMachineTable(dataA, dataB, monthA, monthB);
}

// Listen for changes on compare dropdowns
$('compareMonthA')?.addEventListener('change', renderCompare);
$('compareMonthB')?.addEventListener('change', renderCompare);

function computeMonthTotals(data) {
    let totalSales = 0, totalTransfer = 0;
    const numDays = data.dateHeaders ? data.dateHeaders.length : 0;
    for (let d = 0; d < numDays; d++) {
        MACHINE_NAMES.forEach(m => {
            totalSales += (data.dailySales?.[m]?.[d] || 0);
            totalTransfer += (data.dailyTransfers?.[m]?.[d] || 0);
        });
    }

    const machineSales = {};
    MACHINE_NAMES.forEach(m => {
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

function renderCompareChart(dataA, dataB, monthKeyA, monthKeyB) {
    if (compareChartInst) compareChartInst.destroy();

    const maxDays = Math.max(
        dataA.dateHeaders?.length || 0,
        dataB.dateHeaders?.length || 0
    );
    const labels = Array.from({ length: maxDays }, (_, i) => i + 1);

    const salesA = [], salesB = [];
    for (let d = 0; d < maxDays; d++) {
        let sA = 0, sB = 0;
        MACHINE_NAMES.forEach(m => {
            sA += (dataA.dailySales?.[m]?.[d] || 0);
            sB += (dataB.dailySales?.[m]?.[d] || 0);
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

function renderCompareMachineTable(dataA, dataB, monthKeyA, monthKeyB) {
    const totA = computeMonthTotals(dataA);
    const totB = computeMonthTotals(dataB);

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
    const datasets = MACHINE_NAMES.map((m, idx) => {
        const data = availableMonths.map(key => {
            const d = allMonthsData[key];
            const tot = computeMonthTotals(d);
            return tot.machineSales[m] || 0;
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

// ── Re-render on language change ──
function reRenderAll() {
    populateMonthSelects();
    if (currentMonth) {
        $('monthSelect').value = currentMonth;
        renderOverview();
    }
    // Re-render active section
    const activeNav = document.querySelector('.nav-item.active[data-section]');
    if (activeNav) {
        const sec = activeNav.dataset.section;
        if (sec === 'compare') renderCompare();
        if (sec === 'trends') renderTrends();
    }
}
