(() => {
  const backend = window.devMatchBackend;
  const client = backend?.client;
  const formatNumber = value => Number.isFinite(Number(value))
    ? Number(value).toLocaleString('en-US')
    : '—';
  const setText = (selector, value) => {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  };
  const setVerifiedProfile = profile => {
    const displayName = typeof profile.displayName === 'string' && profile.displayName.trim()
      ? profile.displayName.trim()
      : 'Developer';
    const nameParts = displayName.split(/\s+/).filter(Boolean);
    setText('#welcomeName', nameParts[0] || 'Developer');
    setText('#topUserName', profile.username || displayName);
    setText('#userAvatar', nameParts.slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'DM');
  };
  const cachedProfile = JSON.parse(localStorage.getItem('devmatch-profile-dev') || '{}');
  if (document.documentElement.classList.contains('devmatch-auth-pending-root')) {
    window.DEVMATCH_SKELETON?.text(document.getElementById('welcomeName'),'Loading profile','96px');
  } else {
    setVerifiedProfile(cachedProfile);
  }

  const metricElements = {
    projects: document.getElementById('totalProjects'),
    views: document.getElementById('totalViews'),
    favorites: document.getElementById('totalFavorites'),
    comments: document.getElementById('totalComments')
  };
  const projectList = document.getElementById('projectList');
  const performanceChart = document.getElementById('performanceChart');
  const performanceBars = document.getElementById('performanceBars');
  const performanceYAxis = document.getElementById('performanceYAxis');
  const performanceXAxis = document.getElementById('performanceXAxis');
  const performanceDetail = document.getElementById('performanceDetail');
  const chartState = document.getElementById('dashboardChartState');
  const chartViews = document.getElementById('chartViews');
  const chartTrend = document.getElementById('chartTrend');
  const commentsList = document.querySelector('.comment-list');
  const interactionList = document.querySelector('.interaction-list');
  const periodSelect = document.getElementById('periodSelect');
  const periodTrigger = document.getElementById('periodTrigger');
  const periodOptions = document.getElementById('periodOptions');
  let periodMenuOpen = false;
  let periodMenuCloseTimer = null;
  const periodMenuAnimationDuration = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 0
    : 180;
  const rangeStartInput = document.getElementById('rangeStart');
  const rangeEndInput = document.getElementById('rangeEnd');
  const rangeError = document.getElementById('rangeError');
  const periodRangeHint = document.getElementById('periodRangeHint');
  const periodCancel = document.getElementById('periodCancel');
  const periodApply = document.getElementById('periodApply');
  const periodCalendar = document.getElementById('periodCalendar');
  const stateText = {
    loading: 'Loading your dashboard…',
    emptyProjects: 'No project views in this date range.',
    emptyComments: 'No comments on your projects yet.',
    emptyCommentsInRange: 'No comments in this date range.',
    emptyActivity: 'Recent project activity will appear here.',
    emptyActivityInRange: 'No project activity in this date range.',
    error: 'Unable to load dashboard data. Check your connection and try again.'
  };
  let currentUser = null;
  let currentProjects = [];
  let rangeRequestId = 0;
  let performanceRequestId = 0;
  let metricsRequestId = 0;
  let performanceChannel;
  let performanceRefreshTimer = null;
  let appliedRange = null;
  let draftRange = null;
  let calendarMonth = null;
  let calendarMonthsBack = 12;
  let loadingOlderCalendarMonths = false;
  let dateSelectionField = 'start';

  function toDateKey(date) {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  }

  function fromDateKey(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return toDateKey(date) === value ? date : null;
  }

  function nextDateKey(value) {
    const date = fromDateKey(value);
    if (!date) return value;
    date.setUTCDate(date.getUTCDate() + 1);
    return toDateKey(date);
  }

  function offsetDateKey(value, days) {
    const date = fromDateKey(value);
    if (!date) return value;
    date.setUTCDate(date.getUTCDate() + days);
    return toDateKey(date);
  }

  function firstOfMonth(value) {
    const date = fromDateKey(value) || new Date();
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }

  function createPresetRange(preset) {
    const key = String(preset);
    const todayKey = toDateKey(new Date());
    const today = fromDateKey(todayKey);
    if (key === 'lifetime') {
      return {key, startDate: null, endDate: null, presetKey: key};
    }

    let startDate;
    let endDate = todayKey;
    if (/^\d+$/.test(key)) {
      startDate = offsetDateKey(todayKey, -Number(key) + 1);
    } else if (key === 'this-week' || key === 'last-week') {
      const daysSinceMonday = (today.getUTCDay() + 6) % 7;
      const thisWeekStart = offsetDateKey(todayKey, -daysSinceMonday);
      if (key === 'this-week') {
        startDate = thisWeekStart;
      } else {
        endDate = offsetDateKey(thisWeekStart, -1);
        startDate = offsetDateKey(endDate, -6);
      }
    } else if (key === 'this-month') {
      startDate = toDateKey(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)));
    } else if (key === 'last-month') {
      const lastMonthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
      endDate = toDateKey(lastMonthEnd);
      startDate = toDateKey(new Date(Date.UTC(lastMonthEnd.getUTCFullYear(), lastMonthEnd.getUTCMonth(), 1)));
    } else if (key === '5-years') {
      const fiveYearsAgo = new Date(today);
      fiveYearsAgo.setUTCFullYear(fiveYearsAgo.getUTCFullYear() - 5);
      startDate = toDateKey(fiveYearsAgo);
    } else {
      return null;
    }
    return {key, startDate, endDate, presetKey: key};
  }

  function formatDateKey(value) {
    const date = fromDateKey(value);
    return date
      ? date.toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'})
      : value;
  }

  function formatDateInput(value) {
    const date = fromDateKey(value);
    if (!date) return '';
    return `${String(date.getUTCMonth() + 1).padStart(2, '0')}/${String(date.getUTCDate()).padStart(2, '0')}/${date.getUTCFullYear()}`;
  }

  function parseDateInput(value) {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
    if (!match) return null;
    const [, month, day, year] = match;
    const dateKey = `${year}-${month}-${day}`;
    return fromDateKey(dateKey) ? dateKey : null;
  }

  function formatDateDigits(value) {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    if (digits.length < 2) return digits;
    const month = digits.slice(0, 2);
    if (digits.length === 2) return `${month}/`;
    const day = digits.slice(2, 4);
    if (digits.length < 4) return `${month}/${day}`;
    if (digits.length === 4) return `${month}/${day}/`;
    return `${month}/${day}/${digits.slice(4)}`;
  }

  function updateMaskedDateInput(input, value, digitCountBeforeCaret) {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    const formatted = formatDateDigits(digits);
    input.value = formatted;
    const targetDigitCount = Math.min(digitCountBeforeCaret, digits.length);
    let caret = 0;
    let seenDigits = 0;
    while (caret < formatted.length && seenDigits < targetDigitCount) {
      if (/\d/.test(formatted[caret])) seenDigits += 1;
      caret += 1;
    }
    while (formatted[caret] === '/') caret += 1;
    input.setSelectionRange(caret, caret);
  }

  function handleDateInputKeydown(event) {
    const input = event.currentTarget;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    if (start === end && event.key === 'Backspace' && input.value[start - 1] === '/') {
      event.preventDefault();
      const digits = input.value.replace(/\D/g, '');
      const digitIndex = input.value.slice(0, start).replace(/\D/g, '').length - 1;
      updateMaskedDateInput(input, digits.slice(0, digitIndex) + digits.slice(digitIndex + 1), digitIndex);
      return;
    }
    if (start === end && event.key === 'Delete' && input.value[start] === '/') {
      event.preventDefault();
      const digits = input.value.replace(/\D/g, '');
      const digitIndex = input.value.slice(0, start).replace(/\D/g, '').length;
      updateMaskedDateInput(input, digits.slice(0, digitIndex) + digits.slice(digitIndex + 1), digitIndex);
      return;
    }
    if (event.key.length === 1 && !/\d/.test(event.key)
      && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
    }
  }

  function rangeLabel(range) {
    if (range.label) return range.label;
    const labels = {
      'this-week': 'This week',
      'last-week': 'Last week',
      'this-month': 'This month',
      'last-month': 'Last month',
      7: 'Last 7 days',
      30: 'Last 30 days',
      90: 'Last 90 days',
      180: 'Last 180 days',
      365: 'Last 365 days',
      '5-years': 'Last 5 years',
      lifetime: 'Lifetime'
    };
    if (range.key !== 'custom') return labels[range.key] || 'Custom';
    if (!range.startDate || !range.endDate) return 'Custom';
    return `${formatDateKey(range.startDate)} – ${formatDateKey(range.endDate)}`;
  }

  function setActivePreset(range) {
    const activePreset = range?.presetKey || range?.key;
    document.querySelectorAll('.period-presets [data-preset]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.preset === activePreset));
    });
    document.querySelectorAll('[data-chart-range]').forEach(button => {
      const selected = button.dataset.chartRange === range?.key;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('selected', selected);
    });
  }

  function updateRangeControls(range) {
    const label = rangeLabel(range);
    const periodValue = document.getElementById('periodValue');
    const description = document.getElementById('rangeDescription');
    const welcome = document.querySelector('.dashboard > .welcome');
    welcome?.classList.toggle('is-custom-range', range.key === 'custom');
    if (periodValue) periodValue.textContent = label;
    if (description) {
      description.textContent = range.key === 'lifetime'
        ? 'Your account-wide project metrics and recent activity.'
        : `Metrics and activity for ${label.toLowerCase()}.`;
    }
    const chartViewsLabel = document.getElementById('chartViewsLabel');
    if (chartViewsLabel) chartViewsLabel.textContent = range.key === 'lifetime' ? 'Total views' : 'Views in range';
    document.querySelectorAll('.stat-card .comparison').forEach(element => {
      element.textContent = label;
    });
    setActivePreset(range);
  }

  function filterByRange(query, range) {
    if (!range.startDate || !range.endDate) return query;
    return query
      .gte('created_at', `${range.startDate}T00:00:00.000Z`)
      .lt('created_at', `${nextDateKey(range.endDate)}T00:00:00.000Z`);
  }

  function setPeriodMenuOpen(open) {
    if (!periodSelect || !periodTrigger || !periodOptions) return;
    periodMenuOpen = open;
    if (periodMenuCloseTimer !== null) {
      window.clearTimeout(periodMenuCloseTimer);
      periodMenuCloseTimer = null;
    }
    periodSelect.classList.toggle('open', open);
    document.querySelector('.dashboard')?.classList.toggle('period-picker-open', open);
    periodTrigger.setAttribute('aria-expanded', String(open));
    periodOptions.inert = !open;
    if (open) {
      periodOptions.hidden = false;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (!periodMenuOpen || periodOptions.hidden) return;
          periodOptions.classList.add('is-open');
          if (calendarMonth) scrollCalendarToMonth(calendarMonth);
        });
      });
    } else {
      periodOptions.classList.remove('is-open');
      if (periodMenuAnimationDuration === 0) {
        periodOptions.hidden = true;
      } else {
        periodMenuCloseTimer = window.setTimeout(() => {
          if (!periodMenuOpen) periodOptions.hidden = true;
          periodMenuCloseTimer = null;
        }, periodMenuAnimationDuration);
      }
    }
  }

  function offsetMonth(date, months) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  }

  function monthsBetween(earlier, later) {
    return (later.getUTCFullYear() - earlier.getUTCFullYear()) * 12
      + later.getUTCMonth() - earlier.getUTCMonth();
  }

  function renderMonth(month, range) {
    const section = document.createElement('section');
    section.className = 'period-month';
    section.dataset.month = toDateKey(month).slice(0, 7);
    const heading = document.createElement('h3');
    heading.className = 'period-month-heading';
    heading.textContent = month.toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC'
    }).toUpperCase();
    const days = document.createElement('div');
    days.className = 'period-days';
    const year = month.getUTCFullYear();
    const monthIndex = month.getUTCMonth();
    const firstWeekday = month.getUTCDay();
    const monthLength = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    for (let index = 0; index < firstWeekday; index += 1) {
      const empty = document.createElement('span');
      empty.className = 'period-calendar-empty';
      days.append(empty);
    }
    for (let day = 1; day <= monthLength; day += 1) {
      const dateKey = toDateKey(new Date(Date.UTC(year, monthIndex, day)));
      const button = document.createElement('button');
      const label = document.createElement('span');
      const isStart = dateKey === range.startDate;
      const isEnd = dateKey === range.endDate;
      button.type = 'button';
      button.className = 'period-calendar-day';
      label.textContent = String(day);
      button.dataset.date = dateKey;
      button.setAttribute('aria-label', formatDateKey(dateKey));
      button.setAttribute('aria-pressed', String(isStart || isEnd));
      button.disabled = dateKey > todayKey;
      if (range.startDate && range.endDate && dateKey >= range.startDate && dateKey <= range.endDate) {
        button.classList.add('in-range');
      }
      if (isStart) button.classList.add('selected-start');
      if (isEnd) button.classList.add('selected-end');
      button.append(label);
      days.append(button);
    }
    section.append(heading, days);
    return section;
  }

  function updateRangePreview(hoveredDate) {
    if (!periodCalendar) return;
    periodCalendar.querySelectorAll('.period-range-preview').forEach(line => line.remove());
    if (dateSelectionField !== 'end' || !draftRange?.startDate || draftRange.endDate
      || !hoveredDate || hoveredDate <= draftRange.startDate) return;

    periodCalendar.querySelectorAll('.period-month').forEach(month => {
      const monthDate = fromDateKey(`${month.dataset.month}-01`);
      const days = month.querySelector('.period-days');
      if (!monthDate || !days) return;
      const firstWeekday = monthDate.getUTCDay();
      const rows = new Map();
      days.querySelectorAll('button[data-date]').forEach(button => {
        const dateKey = button.dataset.date;
        if (dateKey < draftRange.startDate || dateKey > hoveredDate) return;
        const day = Number(dateKey.slice(-2));
        const cellIndex = firstWeekday + day - 1;
        const row = Math.floor(cellIndex / 7);
        const column = cellIndex % 7;
        const span = rows.get(row) || {
          firstColumn: column,
          lastColumn: column,
          includesStart: false,
          includesEnd: false
        };
        span.firstColumn = Math.min(span.firstColumn, column);
        span.lastColumn = Math.max(span.lastColumn, column);
        span.includesStart = span.includesStart || dateKey === draftRange.startDate;
        span.includesEnd = span.includesEnd || dateKey === hoveredDate;
        rows.set(row, span);
      });
      rows.forEach((span, row) => {
        const line = document.createElement('span');
        const columnCount = span.lastColumn - span.firstColumn + 1;
        line.className = 'period-range-preview';
        line.style.gridRow = `${row + 1} / ${row + 2}`;
        line.style.gridColumn = `${span.firstColumn + 1} / ${span.lastColumn + 2}`;
        if (span.includesStart) line.style.left = `${50 / columnCount}%`;
        if (span.includesEnd) line.style.right = `${50 / columnCount}%`;
        days.append(line);
      });
    });
  }

  function renderCalendar(preserveScroll = false, preserveViewportOnPrepend = false) {
    if (!periodCalendar || !draftRange) return;
    if (!calendarMonth) {
      calendarMonth = firstOfMonth(draftRange.startDate || draftRange.endDate || toDateKey(new Date()));
    }
    const currentMonth = firstOfMonth(toDateKey(new Date()));
    const previousHeight = periodCalendar.scrollHeight;
    const previousScrollTop = periodCalendar.scrollTop;
    const oldestMonth = offsetMonth(currentMonth, -calendarMonthsBack);
    const months = [];
    for (let month = oldestMonth; month <= currentMonth; month = offsetMonth(month, 1)) {
      months.push(renderMonth(month, draftRange));
    }
    const weekdays = document.createElement('div');
    weekdays.className = 'period-weekdays';
    weekdays.setAttribute('aria-hidden', 'true');
    ['S', 'M', 'T', 'W', 'T', 'F', 'S'].forEach(day => {
      const label = document.createElement('span');
      label.textContent = day;
      weekdays.append(label);
    });
    periodCalendar.replaceChildren(weekdays, ...months);
    if (preserveScroll) {
      periodCalendar.scrollTop = previousScrollTop + (preserveViewportOnPrepend
        ? periodCalendar.scrollHeight - previousHeight
        : 0);
      updateVisibleCalendarMonth();
    } else {
      scrollCalendarToMonth(calendarMonth);
    }
  }

  function updateVisibleCalendarMonth() {
    if (!periodCalendar) return;
    const calendarTop = periodCalendar.getBoundingClientRect().top;
    const stickyBottom = periodCalendar.querySelector('.period-weekdays')?.getBoundingClientRect().bottom
      || calendarTop;
    const visibleMonth = [...periodCalendar.querySelectorAll('.period-month')]
      .find(month => month.getBoundingClientRect().bottom > stickyBottom + 1);
    if (!visibleMonth) return;
    const [year, month] = visibleMonth.dataset.month.split('-').map(Number);
    calendarMonth = new Date(Date.UTC(year, month - 1, 1));
  }

  function scrollCalendarToMonth(month) {
    if (!periodCalendar) return;
    const targetMonth = firstOfMonth(toDateKey(month));
    const currentMonth = firstOfMonth(todayKey);
    if (targetMonth > currentMonth) return;
    const oldestMonth = offsetMonth(currentMonth, -calendarMonthsBack);
    if (targetMonth < oldestMonth) {
      const monthsNeeded = monthsBetween(targetMonth, oldestMonth);
      calendarMonthsBack += Math.ceil(monthsNeeded / 12) * 12;
      renderCalendar(true, true);
    }
    const monthElement = periodCalendar.querySelector(`[data-month="${toDateKey(targetMonth).slice(0, 7)}"]`);
    if (!monthElement) return;
    const stickyWeekdays = periodCalendar.querySelector('.period-weekdays');
    const stickyHeight = stickyWeekdays?.getBoundingClientRect().height || 0;
    const monthHeadingGap = 8;
    periodCalendar.scrollTop += monthElement.getBoundingClientRect().top
      - periodCalendar.getBoundingClientRect().top
      - stickyHeight
      - monthHeadingGap;
    updateVisibleCalendarMonth();
  }

  function loadOlderCalendarMonths() {
    if (!periodCalendar || loadingOlderCalendarMonths || periodCalendar.scrollTop > 24) return;
    loadingOlderCalendarMonths = true;
    calendarMonthsBack += 12;
    renderCalendar(true, true);
    loadingOlderCalendarMonths = false;
  }

  function setDraftRange(range, resetCalendar = true) {
    draftRange = {...range};
    if (rangeStartInput) rangeStartInput.value = formatDateInput(draftRange.startDate);
    if (rangeEndInput) rangeEndInput.value = formatDateInput(draftRange.endDate);
    if (rangeError) rangeError.hidden = true;
    if (periodRangeHint) {
      periodRangeHint.textContent = dateSelectionField === 'end'
        ? 'Choose an end date'
        : 'Choose a start date';
    }
    if (resetCalendar) {
      const currentMonth = firstOfMonth(todayKey);
      const selectedMonth = firstOfMonth(draftRange.startDate || draftRange.endDate || todayKey);
      const monthsSinceSelection = monthsBetween(selectedMonth, currentMonth);
      calendarMonthsBack = Math.max(12, Math.min(monthsSinceSelection, 60));
      calendarMonth = monthsSinceSelection <= calendarMonthsBack ? selectedMonth : currentMonth;
    }
    setActivePreset(draftRange);
    renderCalendar(!resetCalendar);
  }

  function selectCalendarDate(dateKey) {
    const currentStart = draftRange?.startDate;
    let startDate;
    let endDate;
    if (dateSelectionField === 'end' && currentStart) {
      if (dateKey < currentStart) {
        startDate = dateKey;
        endDate = null;
      } else {
        startDate = currentStart;
        endDate = dateKey;
        dateSelectionField = 'start';
      }
    } else {
      startDate = dateKey;
      endDate = null;
      dateSelectionField = 'end';
    }
    calendarMonth = firstOfMonth(dateKey);
    setDraftRange({key: 'custom', presetKey: 'custom', startDate, endDate}, false);
    if (endDate && periodRangeHint) periodRangeHint.textContent = 'Range selected';
  }

  function showMessage(container, message, className = 'dashboard-empty') {
    if (message === stateText.loading && window.DEVMATCH_SKELETON) {
      window.DEVMATCH_SKELETON.rows(container,3);
      return;
    }
    const paragraph = document.createElement('p');
    paragraph.className = className;
    paragraph.textContent = message;
    container.replaceChildren(paragraph);
  }

  function initials(value) {
    return String(value || '').trim().split(/\s+/).slice(0, 2)
      .map(part => part[0] || '').join('').toUpperCase() || '•';
  }

  function timeAgo(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Recently';
    const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }

  function activityCategory(kind) {
    const value = String(kind || '').toLowerCase();
    if (value.includes('comment') || value.includes('reply')) return 'comments';
    if (value.includes('message') || value.includes('conversation')) return 'messages';
    if (value.includes('favorite') || value.includes('favourite') || value.includes('save')) return 'favorites';
    if (value.includes('rating') || value.includes('review')) return 'ratings';
    return 'updates';
  }

  function activityVerb(category) {
    return ({
      comments: 'commented on',
      messages: 'sent a message about',
      favorites: 'saved',
      ratings: 'left a rating for',
      updates: 'updated'
    })[category];
  }

  async function loadMetrics(range, requestId) {
    const metricsId = ++metricsRequestId;
    const { data, error } = await client.rpc('get_dashboard_metrics_for_range', {
      p_role: 'dev',
      p_start_date: range.startDate,
      p_end_date: range.endDate
    });
    if (error) throw error;
    const metrics = typeof data === 'string' ? JSON.parse(data) : data;
    if (!metrics || typeof metrics !== 'object'
      || Object.keys(metricElements).some(key => metrics[key] == null || !Number.isFinite(Number(metrics[key])))) {
      throw new Error('Dashboard metrics are unavailable.');
    }
    if (requestId !== rangeRequestId || metricsId !== metricsRequestId) return;
    Object.entries(metricElements).forEach(([key, element]) => {
      if (element) element.textContent = formatNumber(metrics[key]);
    });
    const status = document.getElementById('dashboardStatus');
    if (status) status.hidden = true;
  }

  function chartLabel(value) {
    return fromDateKey(value)?.toLocaleDateString('en-US', {month: 'short', day: 'numeric', timeZone: 'UTC'}) || '';
  }

  function renderPerformance({views, previous_views: previous, series}) {
    chartViews.textContent = formatNumber(views);
    chartTrend.hidden = !(previous > 0);
    if (!chartTrend.hidden) {
      const change = (views - previous) * 100 / previous;
      const prefix = change > 0 ? '+' : '';
      chartTrend.textContent = `${prefix}${change.toLocaleString('en-US', {maximumFractionDigits: 1})}%`;
      chartTrend.dataset.direction = change < 0 ? 'down' : 'up';
      chartTrend.title = 'Compared with the previous period of the same length';
    }
    const peak = Math.max(0, ...series.flatMap(bucket => [bucket.views, bucket.favorites]));
    performanceChart.hidden = !peak;
    chartState.hidden = Boolean(peak);
    if (!peak) {
      chartState.textContent = 'No views or favorites in this date range.';
      performanceBars.replaceChildren();
      performanceXAxis.replaceChildren();
      performanceYAxis.replaceChildren();
      return;
    }
    const step = 10 ** Math.floor(Math.log10(Math.max(1, peak / 4)));
    const tick = Math.max(1, Math.ceil(peak / (step * 4)) * step);
    const maximum = tick * 4;
    performanceChart.style.setProperty('--bucket-count', series.length);
    performanceYAxis.replaceChildren(...[4, 3, 2, 1, 0].map(level => {
      const label = document.createElement('span');
      label.textContent = formatNumber(tick * level);
      return label;
    }));

    const bars = series.map(bucket => {
      const range = bucket.start_date === bucket.end_date ? chartLabel(bucket.start_date)
        : `${chartLabel(bucket.start_date)} – ${chartLabel(bucket.end_date)}`;
      const detail = `${range} · ${formatNumber(bucket.views)} views · ${formatNumber(bucket.favorites)} favorites`;
      const group = document.createElement('button');
      group.className = 'performance-bin';
      group.type = 'button';
      group.setAttribute('aria-label', detail);
      group.title = detail;
      const describe = () => { performanceDetail.textContent = detail; };
      group.addEventListener('focus', describe);
      group.addEventListener('pointerenter', describe);
      group.addEventListener('click', describe);
      for (const metric of ['views', 'favorites']) {
        const bar = document.createElement('span');
        bar.className = `performance-bar ${metric}`;
        bar.style.setProperty('--bar-height', `${bucket[metric] * 100 / maximum}%`);
        group.append(bar);
      }
      return group;
    });
    performanceBars.replaceChildren(...bars);
    const labelCount = Math.min(5, series.length);
    performanceXAxis.replaceChildren(...Array.from({length: labelCount}, (_, labelIndex) => {
      const last = labelIndex === labelCount - 1 && labelCount > 1;
      const index = Math.round(labelIndex * (series.length - 1) / Math.max(1, labelCount - 1));
      const label = document.createElement('span');
      label.style.gridColumn = String(index + 1);
      label.textContent = chartLabel(last ? series[index].end_date : series[index].start_date);
      return label;
    }));
    performanceDetail.textContent = '';
  }

  function renderViewedProjects(projects) {
    if (!projects.length) {
      showMessage(projectList, stateText.emptyProjects, 'range-empty');
      return;
    }
    const maximumViews = projects[0].views;
    projectList.replaceChildren(...projects.map(project => {
      const row = document.createElement('article');
      row.className = 'project-row';
      const info = document.createElement('div');
      info.className = 'project-info';
      const thumb = document.createElement('span');
      thumb.className = 'project-thumb';
      thumb.setAttribute('aria-hidden', 'true');
      if (typeof project.cover_image === 'string' && /^https:\/\//i.test(project.cover_image)) {
        const image = document.createElement('img');
        image.src = project.cover_image;
        image.alt = '';
        image.loading = 'lazy';
        thumb.append(image);
      } else {
        thumb.textContent = '↗';
      }
      const copy = document.createElement('div');
      const title = document.createElement('h3');
      title.className = 'project-name';
      title.textContent = project.title || 'Untitled project';
      const type = document.createElement('p');
      type.className = 'project-type';
      type.textContent = project.project_type || 'Project';
      copy.append(title, type);
      const views = document.createElement('p');
      views.className = 'project-views';
      views.textContent = formatNumber(project.views);
      const unit = document.createElement('small');
      unit.textContent = 'views';
      views.append(unit);
      info.append(thumb, copy, views);
      const track = document.createElement('div');
      track.className = 'project-bar';
      track.setAttribute('aria-hidden', 'true');
      const bar = document.createElement('i');
      bar.style.width = `${project.views * 100 / maximumViews}%`;
      track.append(bar);
      row.append(info, track);
      return row;
    }));
  }

  async function loadPerformance(range, requestId) {
    const performanceId = ++performanceRequestId;
    try {
      const {data, error} = await client.rpc('get_developer_project_performance', {
        p_start_date: range.startDate,
        p_end_date: range.endDate
      });
      if (error) throw error;
      if (requestId !== rangeRequestId || performanceId !== performanceRequestId) return;
      renderPerformance(data);
      renderViewedProjects(data.ranking);
    } catch (error) {
      if (requestId !== rangeRequestId || performanceId !== performanceRequestId) return;
      console.error('Unable to load project performance.', error);
      performanceChart.hidden = true;
      chartTrend.hidden = true;
      chartViews.textContent = '—';
      chartState.hidden = false;
      chartState.textContent = stateText.error;
      setError(projectList, stateText.error);
    }
  }

  function schedulePerformanceRefresh() {
    if (!currentUser || document.hidden || performanceRefreshTimer !== null) return;
    performanceRefreshTimer = window.setTimeout(() => {
      performanceRefreshTimer = null;
      if (document.hidden) return;
      const requestId = rangeRequestId;
      const range = appliedRange;
      void loadPerformance(range, requestId);
      void loadMetrics(range, requestId).catch(error => console.error('Unable to refresh dashboard metrics.', error));
    }, 250);
  }

  async function subscribePerformance() {
    const {data, error} = await client.auth.getSession();
    if (error || data.session?.user.id !== currentUser.id) return;
    await client.realtime.setAuth(data.session.access_token);
    performanceChannel = client.channel(`devmatch-project-performance:${currentUser.id}`, {config: {private: true}})
      .on('broadcast', {event: 'refresh'}, schedulePerformanceRefresh)
      .subscribe(status => {
        if (status === 'SUBSCRIBED') schedulePerformanceRefresh();
      });
  }

  async function loadProjects(user) {
    const { data, error } = await client.from('projects')
      .select('id,title')
      .eq('owner_id', user.id)
      .eq('project_kind', 'portfolio')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async function loadComments(projects, range, requestId) {
    if (!projects.length) {
      if (requestId === rangeRequestId) {
        showMessage(commentsList, range.startDate ? stateText.emptyCommentsInRange : stateText.emptyComments, 'range-empty');
      }
      return;
    }
    const loadCommentRows = async (includeParentComment, includeWorkspaceRole) => {
      const columns = ['id','project_id','user_id','text','author_name','created_at'];
      if (includeParentComment) columns.push('parent_comment_id');
      if (includeWorkspaceRole) columns.push('workspace_role');
      let query = client.from('comments')
        .select(columns.join(','))
        .in('project_id', projects.map(project => project.id));
      query = filterByRange(query, range);
      return query.order('created_at', { ascending: false }).limit(5);
    };
    let includeParentComment=true;
    let includeWorkspaceRole=true;
    let result=await loadCommentRows(includeParentComment,includeWorkspaceRole);
    for(let attempt=0;result.error&&attempt<2;attempt++){
      const message=result.error.message||'';
      const missingColumnError=['42703','PGRST204'].includes(result.error.code);
      if(!missingColumnError)break;
      if(includeParentComment&&/parent_comment_id/i.test(message)){
        includeParentComment=false;
      }else if(includeWorkspaceRole&&/workspace_role/i.test(message)){
        includeWorkspaceRole=false;
      }else break;
      result=await loadCommentRows(includeParentComment,includeWorkspaceRole);
    }
    const { data, error } = result;
    if (error) throw error;
    if (requestId !== rangeRequestId) return;
    if (!data?.length) {
      showMessage(commentsList, range.startDate ? stateText.emptyCommentsInRange : stateText.emptyComments, 'range-empty');
      return;
    }
    const titles = new Map(projects.map(project => [project.id, project.title || 'Project']));
    const parentIds=[...new Set(data.map(comment=>comment.parent_comment_id).filter(Boolean))];
    let parentComments=[];
    if(parentIds.length){
      let parentResult=await client.from('comments')
        .select('id,user_id,workspace_role,author_name')
        .in('id',parentIds);
      if(parentResult.error&&['42703','PGRST204'].includes(parentResult.error.code)
        &&/workspace_role/i.test(parentResult.error.message||'')){
        parentResult=await client.from('comments')
          .select('id,user_id,author_name')
          .in('id',parentIds);
      }
      if(parentResult.error)throw parentResult.error;
      parentComments=parentResult.data||[];
    }
    let commenterRoles=new Map();
    try {
      commenterRoles=await backend.loadCommentAuthorRoles([...data,...parentComments].map(comment=>({
        userId:comment.user_id,
        name:comment.author_name
      })));
    } catch (profileError) {
      console.error('Unable to load dashboard commenter profiles from Supabase.', profileError);
    }
    const parentsById=new Map(parentComments.map(comment=>[comment.id,comment]));
    commentsList.replaceChildren();
    data.forEach(comment => {
      const item = document.createElement('article');
      item.className = 'comment comment-system-item';
      const avatar = document.createElement('span');
      avatar.className = 'comment-avatar comment-system-avatar';
      avatar.textContent = initials(comment.author_name);
      const profileUrl=backend.publicProfileUrl(comment.user_id,commenterRoles.get(comment.user_id));
      const avatarLink=profileUrl?document.createElement('a'):avatar;
      if(profileUrl){
        avatarLink.className='comment-profile-avatar-link';
        avatarLink.href=profileUrl;
        avatarLink.setAttribute('aria-label',`View ${comment.author_name||'member'} profile`);
        avatarLink.append(avatar);
      }
      const copy = document.createElement('div');
      copy.className='comment-system-body';
      const authorRow=document.createElement('p');
      authorRow.className='comment-system-author';
      const name = document.createElement('b');
      name.textContent = comment.author_name || 'A member';
      const nameLink=profileUrl?document.createElement('a'):name;
      if(profileUrl){
        nameLink.className='comment-profile-name-link';
        nameLink.href=profileUrl;
        nameLink.setAttribute('aria-label',`View ${comment.author_name||'member'} profile`);
        nameLink.append(name);
      }
      const projectTitle = document.createElement('a');
      projectTitle.href=`devmatch-discover-project-detail.html?project=${encodeURIComponent(comment.project_id)}#commentsSection`;
      projectTitle.textContent = titles.get(comment.project_id) || 'Project';
      projectTitle.setAttribute('aria-label',`View comments on ${projectTitle.textContent}`);
      projectTitle.className='comment-project-link';
      const role=comment.workspace_role||commenterRoles.get(comment.user_id);
      const roleBadge=document.createElement('small');
      roleBadge.className='comment-role-badge comment-system-role';
      roleBadge.textContent=role==='dev'?'Developer':role==='client'?'Client':'';
      const body = document.createElement('span');
      body.textContent = comment.text || '';
      authorRow.append(nameLink);
      if(roleBadge.textContent)authorRow.append(roleBadge);
      copy.append(authorRow);
      const project=document.createElement('small');
      project.className='comment-system-project';
      project.append(projectTitle);
      copy.append(project);
      const parent=comment.parent_comment_id?parentsById.get(comment.parent_comment_id):null;
      if(parent){
        const parentRole=parent.workspace_role||commenterRoles.get(parent.user_id);
        const replyTarget=document.createElement('small');
        replyTarget.className='comment-reply-target comment-system-target';
        const arrow=document.createElement('span');
        arrow.className='comment-reply-arrow comment-system-target-arrow';
        arrow.textContent='▸';
        const parentName=document.createElement('span');
        parentName.className='comment-reply-name comment-system-target-name';
        parentName.textContent=parent.author_name||'Member';
        replyTarget.append(arrow,document.createTextNode(' '),parentName);
        if(parentRole==='dev'||parentRole==='client'){
          const parentBadge=document.createElement('small');
          parentBadge.className='comment-role-badge comment-system-role';
          parentBadge.textContent=parentRole==='dev'?'Developer':'Client';
          replyTarget.append(document.createTextNode(' '),parentBadge);
        }
        authorRow.append(replyTarget);
      }
      body.className='comment-system-text';
      copy.append(body);
      const time = document.createElement('time');
      time.className='comment-system-time';
      time.dateTime = comment.created_at;
      time.textContent = timeAgo(comment.created_at);
      const actions=document.createElement('div');
      actions.className='comment-system-actions';
      actions.append(time);
      copy.append(actions);
      item.append(avatarLink, copy);
      commentsList.append(item);
    });
  }

  async function loadActivity(user, projects, range, requestId) {
    let query = client.from('notifications')
      .select('id,actor_id,actor_role,kind,project_id,conversation_id,created_at')
      .eq('recipient_id', user.id).eq('recipient_role', 'dev');
    query = filterByRange(query, range);
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(5);
    if (error) throw error;
    if (requestId !== rangeRequestId) return;
    if (!data?.length) {
      showMessage(interactionList, range.startDate ? stateText.emptyActivityInRange : stateText.emptyActivity, 'range-empty');
      return;
    }
    const actorIds = [...new Set(data.map(item => item.actor_id).filter(Boolean))];
    const projectIds = [...new Set(data.map(item => item.project_id).filter(Boolean))];
    const [actorsResult, projectsResult] = await Promise.all([
      actorIds.length
        ? client.from('directory_people').select('id,username,display_name,account_role').in('id', actorIds)
        : Promise.resolve({ data: [], error: null }),
      projectIds.length
        ? client.from('projects').select('id,title').in('id', projectIds)
        : Promise.resolve({ data: [], error: null })
    ]);
    if (requestId !== rangeRequestId) return;
    if (actorsResult.error) throw actorsResult.error;
    if (projectsResult.error) throw projectsResult.error;
    const names = new Map((actorsResult.data || []).map(actor => [actor.id + ':' + actor.account_role, actor.username || actor.display_name]));
    const titles = new Map(projects.map(project => [project.id, project.title]));
    (projectsResult.data || []).forEach(project => titles.set(project.id, project.title));
    interactionList.replaceChildren();
    data.forEach(entry => {
      const category = activityCategory(entry.kind);
      const item = document.createElement('p');
      const icon = document.createElement('span');
      icon.className = `interaction-icon${category === 'messages' ? ' message' : category === 'favorites' ? '' : ' view'}`;
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = category === 'favorites' ? '♡' : category === 'comments' ? '“' : category === 'messages' ? '✉' : '•';
      const copy = document.createElement('span');
      const actor = document.createElement('b');
      actor.textContent = names.get(entry.actor_id + ':' + entry.actor_role) || 'A member';
      const verb = String(entry.kind || '').toLowerCase().includes('reply')
        ? 'replied to your comment on'
        : activityVerb(category);
      const description = document.createTextNode(` ${verb} `);
      const project = document.createElement('strong');
      project.textContent = titles.get(entry.project_id) || (entry.conversation_id ? 'your conversation' : 'your work');
      const time = document.createElement('small');
      time.textContent = timeAgo(entry.created_at);
      copy.append(actor, description, project, time);
      item.append(icon, copy);
      interactionList.append(item);
    });
  }

  function setError(container, message, className = 'dashboard-empty') {
    if (container) showMessage(container, message, className);
  }

  async function applyRange(range) {
    if (!currentUser) return;
    const requestId = ++rangeRequestId;
    appliedRange = {...range};
    updateRangeControls(range);
    Object.values(metricElements).forEach(element => {
      if (element) window.DEVMATCH_SKELETON?.text(element,'Loading dashboard metric','42px');
    });
    if (chartViews) window.DEVMATCH_SKELETON?.text(chartViews,'Loading dashboard views','42px');
    performanceChart.hidden = true;
    chartTrend.hidden = true;
    chartState.hidden = false;
    chartState.textContent = 'Loading project performance…';
    showMessage(projectList, 'Loading most viewed projects…', 'range-empty');
    showMessage(commentsList, stateText.loading, 'range-empty');
    showMessage(interactionList, stateText.loading, 'range-empty');
    const status = document.getElementById('dashboardStatus');
    if (status) {
      window.DEVMATCH_SKELETON?.status(status,`Loading metrics for ${rangeLabel(range).toLowerCase()}`);
      status.hidden = false;
    }

    await Promise.all([
      loadPerformance(range, requestId),
      loadMetrics(range, requestId).catch(error => {
        if (requestId !== rangeRequestId) return;
        console.error('Unable to load dashboard metrics.', error);
        Object.values(metricElements).forEach(element => { if (element) element.textContent = '—'; });
        if (status) {
          status.textContent = stateText.error;
          status.hidden = false;
        }
      }),
      loadComments(currentProjects, range, requestId).catch(error => {
        if (requestId !== rangeRequestId) return;
        console.error('Unable to load dashboard comments.', error);
        setError(commentsList, stateText.error, 'range-empty');
      }),
      loadActivity(currentUser, currentProjects, range, requestId).catch(error => {
        if (requestId !== rangeRequestId) return;
        console.error('Unable to load dashboard activity.', error);
        setError(interactionList, stateText.error, 'range-empty');
      })
    ]);
  }

  async function start() {
    showMessage(projectList, stateText.loading);
    showMessage(commentsList, stateText.loading, 'range-empty');
    showMessage(interactionList, stateText.loading, 'range-empty');
    Object.values(metricElements).forEach(element => {
      if (element) window.DEVMATCH_SKELETON?.text(element,'Loading dashboard metric','42px');
    });
    if (chartViews) window.DEVMATCH_SKELETON?.text(chartViews,'Loading dashboard views','42px');
    const status = document.getElementById('dashboardStatus');
    if (status) {
      window.DEVMATCH_SKELETON?.status(status,stateText.loading);
      status.hidden = false;
    }
    if (!backend || !client) {
      if (status) {
        status.textContent = stateText.error;
        status.hidden = false;
      }
      Object.values(metricElements).forEach(element => { if (element) element.textContent = '—'; });
      setError(projectList, stateText.error);
      setError(commentsList, stateText.error);
      setError(interactionList, stateText.error);
      return;
    }
    try {
      const user = await backend.ready;
      if (!user) return;
      setVerifiedProfile(JSON.parse(localStorage.getItem('devmatch-profile-dev') || '{}'));
      currentUser = user;
      currentProjects = await loadProjects(user).catch(error => {
        console.error('Unable to load dashboard projects.', error);
        return [];
      });
      await applyRange(createPresetRange('30'));
      void subscribePerformance().catch(error => console.error('Unable to subscribe to project performance.', error));
      const readIds = await backend.loadNotificationReads();
      const { data: notifications, error } = await client.from('notifications')
        .select('id')
        .eq('recipient_id', user.id).eq('recipient_role', 'dev');
      if (error) throw error;
      const unreadCount = (notifications || []).filter(item => !readIds.includes(item.id)).length;
      const badge = document.getElementById('developerNotificationCount');
      badge.textContent = String(unreadCount);
      badge.hidden = unreadCount === 0;
      const dot = document.querySelector('.notification-button i');
      if (dot) dot.hidden = unreadCount === 0;
    } catch (error) {
      console.error('Unable to load dashboard data.', error);
      if (status) {
        status.textContent = stateText.error;
        status.hidden = false;
      }
    }
  }

  const todayKey = toDateKey(new Date());
  const initialRange = createPresetRange('30');
  appliedRange = initialRange;
  updateRangeControls(initialRange);
  document.querySelectorAll('[data-chart-range]').forEach(button => {
    button.addEventListener('click', () => {
      const range = createPresetRange(button.dataset.chartRange);
      if (range) void applyRange(range);
    });
  });
  document.addEventListener('visibilitychange', schedulePerformanceRefresh);
  window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    if (performanceRefreshTimer !== null) window.clearTimeout(performanceRefreshTimer);
    if (performanceChannel) void client.removeChannel(performanceChannel);
  });
  if (rangeStartInput && rangeEndInput) {
    rangeStartInput.value = formatDateInput(initialRange.startDate);
    rangeEndInput.value = formatDateInput(initialRange.endDate);
    [rangeStartInput, rangeEndInput].forEach(input => {
      input.addEventListener('keydown', handleDateInputKeydown);
      input.addEventListener('input', event => {
        const target = event.currentTarget;
        const caret = target.selectionStart ?? target.value.length;
        const digitCountBeforeCaret = target.value.slice(0, caret).replace(/\D/g, '').length;
        updateMaskedDateInput(target, target.value, digitCountBeforeCaret);
      });
    });
    rangeStartInput.addEventListener('focus', () => { dateSelectionField = 'start'; });
    rangeEndInput.addEventListener('focus', () => { dateSelectionField = 'end'; });
    rangeStartInput.addEventListener('change', () => {
      dateSelectionField = 'end';
      syncDraftFromDateInputs();
    });
    rangeEndInput.addEventListener('change', () => {
      dateSelectionField = 'start';
      syncDraftFromDateInputs();
    });
  }

  function syncDraftFromDateInputs() {
    const startInputValue = rangeStartInput.value.trim();
    const endInputValue = rangeEndInput.value.trim();
    const startDate = parseDateInput(startInputValue);
    const endDate = parseDateInput(endInputValue);
    if ((startInputValue && !startDate) || (endInputValue && !endDate)) {
      rangeError.textContent = 'Enter dates in MM/DD/YYYY format.';
      rangeError.hidden = false;
      return;
    }
    if ((startDate && startDate > todayKey) || (endDate && endDate > todayKey)) {
      rangeError.textContent = 'Dates must be today or earlier.';
      rangeError.hidden = false;
      return;
    }
    setDraftRange({key: 'custom', presetKey: 'custom', startDate, endDate});
    if (startDate && endDate && startDate > endDate) {
      rangeError.textContent = 'Start date must be on or before the end date.';
      rangeError.hidden = false;
    } else if (startDate && endDate && periodRangeHint) {
      periodRangeHint.textContent = 'Range selected';
    }
  }

  function cancelPeriodPicker(restoreFocus = true) {
    setDraftRange(appliedRange || initialRange);
    setPeriodMenuOpen(false);
    if (restoreFocus) periodTrigger?.focus();
  }

  function applyDraftRange() {
    if (!draftRange) return;
    if (draftRange.key === 'custom') {
      const startInputValue = rangeStartInput.value.trim();
      const endInputValue = rangeEndInput.value.trim();
      draftRange.startDate = parseDateInput(startInputValue);
      draftRange.endDate = parseDateInput(endInputValue);
      if ((startInputValue && !draftRange.startDate) || (endInputValue && !draftRange.endDate)) {
        rangeError.textContent = 'Enter dates in MM/DD/YYYY format.';
        rangeError.hidden = false;
        return;
      }
      const start = fromDateKey(draftRange.startDate);
      const end = fromDateKey(draftRange.endDate);
      if (!start || !end || draftRange.startDate > draftRange.endDate || draftRange.endDate > todayKey) {
        rangeError.textContent = 'Choose a valid date range that ends today or earlier.';
        rangeError.hidden = false;
        return;
      }
    }
    setPeriodMenuOpen(false);
    periodTrigger?.focus();
    applyRange(draftRange);
  }

  periodTrigger?.addEventListener('click', () => {
    if (!periodMenuOpen) {
      dateSelectionField = 'start';
      setDraftRange(appliedRange || initialRange);
      setPeriodMenuOpen(true);
    } else {
      cancelPeriodPicker();
    }
  });
  periodTrigger?.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      dateSelectionField = 'start';
      setDraftRange(appliedRange || initialRange);
      setPeriodMenuOpen(true);
      const selectedPreset = periodOptions.querySelector('[aria-pressed="true"]');
      selectedPreset?.focus();
    }
  });
  periodOptions?.addEventListener('click', event => {
    const presetButton = event.target.closest?.('button[data-preset]');
    if (presetButton) {
      const presetKey = presetButton.dataset.preset;
      dateSelectionField = 'start';
      if (presetKey === 'custom') {
        const source = appliedRange?.startDate ? appliedRange : createPresetRange('30');
        setDraftRange({...source, key: 'custom', presetKey: 'custom', label: undefined});
      } else {
        const range = createPresetRange(presetKey);
        if (range) setDraftRange(range);
      }
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && periodMenuOpen) {
      event.preventDefault();
      cancelPeriodPicker();
    }
  });
  document.addEventListener('click', event => {
    const clickPath = event.composedPath?.() || [];
    const clickedInside = periodSelect
      && (periodSelect.contains(event.target) || clickPath.includes(periodSelect));
    if (periodSelect && !clickedInside && periodMenuOpen) cancelPeriodPicker(false);
  });
  periodCalendar?.addEventListener('scroll', () => {
    updateVisibleCalendarMonth();
    loadOlderCalendarMonths();
  }, {passive: true});
  periodCalendar?.addEventListener('pointerover', event => {
    const dateButton = event.target.closest?.('button[data-date]');
    updateRangePreview(dateButton && !dateButton.disabled ? dateButton.dataset.date : null);
  });
  periodCalendar?.addEventListener('pointerleave', () => updateRangePreview(null));
  periodCalendar?.addEventListener('click', event => {
    const dateButton = event.target.closest?.('button[data-date]');
    if (dateButton && !dateButton.disabled) selectCalendarDate(dateButton.dataset.date);
  });
  periodCancel?.addEventListener('click', cancelPeriodPicker);
  periodApply?.addEventListener('click', applyDraftRange);
  const search = document.getElementById('searchInput');
  search?.addEventListener('input', () => {
    const query = search.value.trim().toLowerCase();
    document.querySelectorAll('.project-row,.comment').forEach(row => {
      row.hidden = !!query && !row.textContent.toLowerCase().includes(query);
    });
  });
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      search?.focus();
    }
  });
  start();
})();
