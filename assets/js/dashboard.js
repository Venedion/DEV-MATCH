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
  const profile = JSON.parse(localStorage.getItem('devmatch-profile-dev') || '{}');
  const displayName = typeof profile.displayName === 'string' && profile.displayName.trim()
    ? profile.displayName.trim()
    : 'Developer';
  const nameParts = displayName.split(/\s+/).filter(Boolean);
  setText('#welcomeName', nameParts[0] || 'Developer');
  setText('#topUserName', displayName);
  setText('#userAvatar', nameParts.slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'DM');

  const metricElements = {
    projects: document.getElementById('totalProjects'),
    views: document.getElementById('totalViews'),
    favorites: document.getElementById('totalFavorites'),
    comments: document.getElementById('totalComments')
  };
  const projectList = document.getElementById('projectList');
  const commentsList = document.querySelector('.comment-list');
  const interactionList = document.querySelector('.interaction-list');
  const periodSelect = document.getElementById('periodSelect');
  const periodTrigger = document.getElementById('periodTrigger');
  const periodOptions = document.getElementById('periodOptions');
  const rangeStartInput = document.getElementById('rangeStart');
  const rangeEndInput = document.getElementById('rangeEnd');
  const rangeError = document.getElementById('rangeError');
  const periodRangeHint = document.getElementById('periodRangeHint');
  const periodCancel = document.getElementById('periodCancel');
  const periodApply = document.getElementById('periodApply');
  const periodCalendar = document.getElementById('periodCalendar');
  const daysThroughTodayInput = document.getElementById('daysThroughToday');
  const daysThroughYesterdayInput = document.getElementById('daysThroughYesterday');
  const stateText = {
    loading: 'Loading your dashboard…',
    emptyProjects: 'No projects yet. Add a project to see it here.',
    emptyComments: 'No comments on your projects yet.',
    emptyCommentsInRange: 'No comments in this date range.',
    emptyActivity: 'Recent project activity will appear here.',
    emptyActivityInRange: 'No project activity in this date range.',
    error: 'Unable to load dashboard data. Check your connection and try again.'
  };
  let currentUser = null;
  let currentProjects = [];
  let rangeRequestId = 0;
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
  }

  function updateRangeControls(range) {
    const label = rangeLabel(range);
    const periodValue = document.getElementById('periodValue');
    const description = document.getElementById('rangeDescription');
    if (periodValue) periodValue.textContent = label;
    if (description) {
      description.textContent = range.key === 'lifetime'
        ? 'Your account-wide project metrics and recent activity.'
        : `Metrics and activity for ${label.toLowerCase()}.`;
    }
    const chartState = document.getElementById('dashboardChartState');
    const chartViewsLabel = document.getElementById('chartViewsLabel');
    if (chartState) {
      chartState.textContent = range.key === 'lifetime'
        ? 'Views are provided as an account-wide total.'
        : `Views within ${label.toLowerCase()}.`;
    }
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
    periodSelect.classList.toggle('open', open);
    document.querySelector('.dashboard')?.classList.toggle('period-picker-open', open);
    periodTrigger.setAttribute('aria-expanded', String(open));
    periodOptions.hidden = !open;
    if (open) {
      requestAnimationFrame(() => {
        if (!periodOptions.hidden && calendarMonth) scrollCalendarToMonth(calendarMonth);
      });
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
    periodCalendar.scrollTop += monthElement.getBoundingClientRect().top
      - periodCalendar.getBoundingClientRect().top
      - stickyHeight;
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
    if (requestId !== rangeRequestId) return;
    Object.entries(metricElements).forEach(([key, element]) => {
      if (element) element.textContent = formatNumber(metrics[key]);
    });
    const chartViews = document.getElementById('chartViews');
    if (chartViews) chartViews.textContent = formatNumber(metrics.views);
    const status = document.getElementById('dashboardStatus');
    if (status) status.hidden = true;
  }

  async function loadProjects(user) {
    const { data, error } = await client.from('projects')
      .select('id,title,project_type,status')
      .eq('owner_id', user.id)
      .eq('project_kind', 'portfolio')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    if (!data?.length) {
      showMessage(projectList, stateText.emptyProjects);
      return [];
    }
    projectList.replaceChildren();
    data.slice(0, 5).forEach(project => {
      const row = document.createElement('article');
      row.className = 'project-row';
      const info = document.createElement('div');
      info.className = 'project-info';
      const thumb = document.createElement('span');
      thumb.className = 'project-thumb';
      thumb.setAttribute('aria-hidden', 'true');
      thumb.textContent = '↗';
      const copy = document.createElement('div');
      const title = document.createElement('h3');
      title.className = 'project-name';
      title.textContent = project.title || 'Untitled project';
      const type = document.createElement('p');
      type.className = 'project-type';
      type.textContent = project.project_type || 'Project';
      copy.append(title, type);
      const status = document.createElement('p');
      status.className = 'project-views';
      status.textContent = project.status === 'published' ? 'Published' : 'Draft';
      info.append(thumb, copy, status);
      row.append(info);
      projectList.append(row);
    });
    return data;
  }

  async function loadComments(projects, range, requestId) {
    if (!projects.length) {
      if (requestId === rangeRequestId) {
        showMessage(commentsList, range.startDate ? stateText.emptyCommentsInRange : stateText.emptyComments, 'range-empty');
      }
      return;
    }
    let query = client.from('comments')
      .select('id,project_id,text,author_name,created_at')
      .in('project_id', projects.map(project => project.id));
    query = filterByRange(query, range);
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(5);
    if (error) throw error;
    if (requestId !== rangeRequestId) return;
    if (!data?.length) {
      showMessage(commentsList, range.startDate ? stateText.emptyCommentsInRange : stateText.emptyComments, 'range-empty');
      return;
    }
    const titles = new Map(projects.map(project => [project.id, project.title || 'Project']));
    commentsList.replaceChildren();
    data.forEach(comment => {
      const item = document.createElement('article');
      item.className = 'comment';
      const avatar = document.createElement('span');
      avatar.className = 'comment-avatar';
      avatar.textContent = initials(comment.author_name);
      const copy = document.createElement('p');
      const name = document.createElement('b');
      name.textContent = comment.author_name || 'A member';
      const projectTitle = document.createElement('strong');
      projectTitle.textContent = titles.get(comment.project_id) || 'Project';
      const body = document.createElement('span');
      body.textContent = comment.text || '';
      copy.append(name, document.createTextNode(' on '), projectTitle, body);
      const time = document.createElement('time');
      time.dateTime = comment.created_at;
      time.textContent = timeAgo(comment.created_at);
      item.append(avatar, copy, time);
      commentsList.append(item);
    });
  }

  async function loadActivity(user, projects, range, requestId) {
    let query = client.from('notifications')
      .select('id,actor_id,kind,project_id,conversation_id,created_at')
      .eq('recipient_id', user.id);
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
        ? client.from('directory_people').select('id,display_name').in('id', actorIds)
        : Promise.resolve({ data: [], error: null }),
      projectIds.length
        ? client.from('projects').select('id,title').in('id', projectIds)
        : Promise.resolve({ data: [], error: null })
    ]);
    if (requestId !== rangeRequestId) return;
    if (actorsResult.error) throw actorsResult.error;
    if (projectsResult.error) throw projectsResult.error;
    const names = new Map((actorsResult.data || []).map(actor => [actor.id, actor.display_name]));
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
      actor.textContent = names.get(entry.actor_id) || 'A member';
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
    Object.values(metricElements).forEach(element => { if (element) element.textContent = '—'; });
    const chartViews = document.getElementById('chartViews');
    if (chartViews) chartViews.textContent = '—';
    showMessage(commentsList, stateText.loading, 'range-empty');
    showMessage(interactionList, stateText.loading, 'range-empty');
    const status = document.getElementById('dashboardStatus');
    if (status) {
      status.textContent = `Loading metrics for ${rangeLabel(range).toLowerCase()}…`;
      status.hidden = false;
    }

    await Promise.all([
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
    const status = document.getElementById('dashboardStatus');
    if (status) {
      status.textContent = stateText.loading;
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
      currentUser = user;
      currentProjects = await loadProjects(user).catch(error => {
        console.error('Unable to load dashboard projects.', error);
        setError(projectList, stateText.error);
        return [];
      });
      await applyRange(createPresetRange('30'));
      const readIds = await backend.loadNotificationReads();
      const { data: notifications, error } = await client.from('notifications')
        .select('id')
        .eq('recipient_id', user.id);
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

  function setRelativeDayRange(input, dayOffset, presetKey, periodName) {
    const days = Number(input.value);
    if (!Number.isSafeInteger(days) || days < 1 || days > 3650) {
      rangeError.textContent = 'Enter a number of days between 1 and 3650.';
      rangeError.hidden = false;
      return;
    }
    const endDate = offsetDateKey(todayKey, -dayOffset);
    const startDate = offsetDateKey(endDate, 1 - days);
    setDraftRange({
      key: 'custom',
      presetKey,
      startDate,
      endDate,
      label: `${days} days up to ${periodName}`
    });
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
    if (periodOptions.hidden) {
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
  periodOptions?.addEventListener('keydown', event => {
    if (event.key === 'Escape') cancelPeriodPicker();
  });
  document.addEventListener('click', event => {
    const clickPath = event.composedPath?.() || [];
    const clickedInside = periodSelect
      && (periodSelect.contains(event.target) || clickPath.includes(periodSelect));
    if (periodSelect && !clickedInside && !periodOptions.hidden) cancelPeriodPicker(false);
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
  daysThroughTodayInput?.addEventListener('change', () => {
    setRelativeDayRange(daysThroughTodayInput, 0, 'custom-today', 'today');
  });
  daysThroughYesterdayInput?.addEventListener('change', () => {
    setRelativeDayRange(daysThroughYesterdayInput, 1, 'custom-yesterday', 'yesterday');
  });

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
