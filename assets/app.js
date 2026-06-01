/* Briefing Dashboard - Shared JavaScript Utilities */

const DATA_BASE = './data';

// ============================================================
// Data Loading
// ============================================================

/**
 * Load JSON file from data directory
 * @param {string} path - relative path like 'lithium/2026-05-30.json'
 * @returns {Promise<any>}
 */
async function loadJSON(path) {
  const resp = await fetch(`${DATA_BASE}/${path}`);
  if (!resp.ok) throw new Error(`Failed to load ${path}: ${resp.status}`);
  return resp.json();
}

/**
 * List JSON files in a module directory by trying index.json first,
 * then falling back to date-based probing
 */
async function listModuleFiles(module) {
  try {
    const index = await loadJSON(`${module}/index.json`);
    return index.files || [];
  } catch {
    return [];
  }
}

/**
 * Load all data files for a module (newest first)
 * @param {string} module - module name
 * @returns {Promise<Array<{filename: string, data: any}>>}
 */
async function loadModuleData(module) {
  const files = await listModuleFiles(module);
  const results = [];
  for (const f of files) {
    try {
      const data = await loadJSON(`${module}/${f}`);
      results.push({ filename: f, data });
    } catch (e) {
      console.warn(`Skip ${module}/${f}:`, e);
    }
  }
  // Sort by date descending
  results.sort((a, b) => b.filename.localeCompare(a.filename));
  return results;
}

/**
 * Load the latest data for a module
 */
async function loadLatest(module) {
  const all = await loadModuleData(module);
  return all.length > 0 ? all[0].data : null;
}

// ============================================================
// Formatting
// ============================================================

function fmtPct(val, decimals = 1) {
  if (val == null) return '-';
  const s = val.toFixed(decimals);
  return val >= 0 ? `+${s}%` : `${s}%`;
}

function fmtPrice(val, unit = '¥') {
  if (val == null) return '-';
  return `${unit}${val.toLocaleString('zh-CN')}`;
}

function fmtNum(val, decimals = 0) {
  if (val == null) return '-';
  return val.toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' });
}

function fmtDateTime(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function changeClass(val) {
  if (val > 0) return 'up';
  if (val < 0) return 'down';
  return 'neutral';
}

function statusBadge(status) {
  const map = {
    'normal': ['正常', 'badge-green'],
    'high': ['偏高', 'badge-yellow'],
    'very_high': ['极高', 'badge-red'],
    'up_to_date': ['最新', 'badge-green'],
    'needs_update': ['需更新', 'badge-yellow'],
    'strong_bearish': ['强烈偏空', 'badge-red'],
    'bearish': ['偏空', 'badge-yellow'],
    'neutral_bullish': ['中性偏多', 'badge-blue'],
    'bullish': ['偏多', 'badge-green'],
    'strong_bullish': ['强烈偏多', 'badge-green'],
  };
  const [label, cls] = map[status] || [status, 'badge-blue'];
  return `<span class="badge ${cls}">${label}</span>`;
}

// ============================================================
// ECharts Theme
// ============================================================

function getEChartsTheme() {
  return {
    backgroundColor: 'transparent',
    textStyle: { color: '#94a3b8', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' },
    title: { textStyle: { color: '#f1f5f9' } },
    legend: { textStyle: { color: '#94a3b8' } },
    tooltip: {
      backgroundColor: '#1e293b',
      borderColor: '#334155',
      textStyle: { color: '#f1f5f9' }
    },
    xAxis: {
      axisLine: { lineStyle: { color: '#334155' } },
      splitLine: { lineStyle: { color: '#1e293b' } },
      axisLabel: { color: '#64748b' }
    },
    yAxis: {
      axisLine: { lineStyle: { color: '#334155' } },
      splitLine: { lineStyle: { color: '#1e293b' } },
      axisLabel: { color: '#64748b' }
    }
  };
}

function initChart(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return null;
  if (typeof echarts === 'undefined') {
    console.warn(`initChart(${containerId}): echarts not loaded`);
    return null;
  }
  const chart = echarts.init(el);
  window.addEventListener('resize', () => chart.resize());
  // Mobile observer
  if (window.ResizeObserver) {
    new ResizeObserver(() => chart.resize()).observe(el);
  }
  return chart;
}

/**
 * Default dataZoom config for line/bar charts with many data points
 * Provides both inside (scroll/pinch) and slider (drag bar) for mobile
 * @param {number} count - number of data points
 * @returns {Array} ECharts dataZoom option
 */
function defaultDataZoom(count) {
  if (count <= 10) return [];
  return [
    { type: 'inside', start: 0, end: 100 },
    { type: 'slider', start: 0, end: 100, height: 20, bottom: 5, borderColor: '#334155', backgroundColor: '#1e293b', fillerColor: 'rgba(59,130,246,0.15)', handleStyle: { color: '#3b82f6' }, textStyle: { color: '#94a3b8' } }
  ];
}

// ============================================================
// Navigation
// ============================================================

function setActiveNav(page) {
  document.querySelectorAll('.nav-link').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
}

function renderNav(currentPage) {
  const pages = [
    { id: 'index', label: '总览', icon: '📊' },
    { id: 'lithium', label: '碳酸锂', icon: '🔋' },
    { id: 'deviation', label: '偏离度', icon: '📈' },
    { id: 'sanmei', label: '三美估值', icon: '💹' },
    { id: 'aihot', label: 'AIHOT', icon: '🤖' },
    { id: 'news-report', label: '新闻研报', icon: '📰' },
    { id: 'mcp_skills', label: 'MCP/Skills', icon: '🔧' },
    { id: 'weekly-review', label: '周度复盘', icon: '📋' },
    { id: 'xueqiu-digest', label: '雪球动态', icon: '🐦' },
  ];
  const nav = document.createElement('nav');
  nav.className = 'nav';
  nav.innerHTML = `
    <div class="nav-inner">
      <a href="index.html" class="nav-brand">📋 投研简报</a>
      ${pages.map(p => `
        <a href="${p.id}.html" class="nav-link ${p.id === currentPage ? 'active' : ''}" data-page="${p.id}">
          ${p.icon} ${p.label}
        </a>
      `).join('')}
    </div>
  `;
  document.body.prepend(nav);
}

// ============================================================
// Loading & Error States
// ============================================================

function showLoading(el) {
  el.innerHTML = '<div class="loading"><div class="spinner"></div>加载数据中...</div>';
}

function showError(el, msg) {
  el.innerHTML = `<div class="error-box">⚠️ ${msg}</div>`;
}

function showEmpty(el, msg = '暂无数据') {
  el.innerHTML = `
    <div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 12h6m-3-3v6m-7 4h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
      </svg>
      <p>${msg}</p>
    </div>
  `;
}

// ============================================================
// Init Helper
// ============================================================

/**
 * Standard page init: render nav, show loading, call renderFn, handle errors
 */
async function initPage(pageId, renderFn) {
  renderNav(pageId);
  try {
    await renderFn();
    // Update global footer with data freshness
    renderFooter();
  } catch (e) {
    console.error(`Page ${pageId} init failed:`, e);
    const main = document.querySelector('.container') || document.body;
    showError(main, `页面加载失败: ${e.message}`);
  }
}

/**
 * Render a global footer showing data freshness info
 */
function renderFooter() {
  const container = document.querySelector('.container');
  if (!container) return;

  // Check if footer already exists
  if (container.querySelector('.global-footer')) return;

  // Collect all _saved_at timestamps from the page
  const savedTimes = [];
  try {
    // Look for any elements with data-generated-at attribute
    const allData = performance.getEntriesByType('resource')
      .filter(r => r.name.includes('/data/') && r.name.endsWith('.json'))
      .map(r => r.responseEnd);
  } catch (e) { /* ignore */ }

  const footer = document.createElement('div');
  footer.className = 'global-footer';
  footer.innerHTML = `
    <div style="text-align:center;padding:24px 0 8px;color:var(--text-muted);font-size:12px;border-top:1px solid var(--border);margin-top:24px">
      投研简报 · 数据来源于自动化脚本采集
      <span style="margin-left:8px">页面刷新获取最新数据</span>
    </div>
  `;
  container.appendChild(footer);
}
