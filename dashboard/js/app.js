/* ─── CavaLocal Audit Dashboard — App Logic ─── */
(function () {
  'use strict';

  // ─── State ───
  let events = [];
  let currentPage = 1;
  let totalEvents = 0;
  const PAGE_SIZE = 20;
  let sseSource = null;
  let reconnectDelay = 1000;
  const MAX_RECONNECT_DELAY = 30000;

  // ─── DOM refs ───
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const eventCount = document.getElementById('eventCount');
  const eventsBody = document.getElementById('eventsBody');
  const btnApplyFilters = document.getElementById('btnApplyFilters');
  const btnClearFilters = document.getElementById('btnClearFilters');
  const btnLoadMore = document.getElementById('btnLoadMore');
  const filterEntity = document.getElementById('filterEntity');
  const filterAction = document.getElementById('filterAction');
  const filterUser = document.getElementById('filterUser');
  const modalOverlay = document.getElementById('modalOverlay');
  const modalClose = document.getElementById('modalClose');
  const modalTitle = document.getElementById('modalTitle');
  const modalMeta = document.getElementById('modalMeta');
  const modalJson = document.getElementById('modalJson');

  // ─── SSE Connection ───
  function connectSSE() {
    setStatus('connecting');

    sseSource = new EventSource(CONFIG.AUDIT_SSE_URL);

    sseSource.onopen = function () {
      setStatus('connected');
      reconnectDelay = 1000;
    };

    sseSource.onmessage = function (e) {
      try {
        const event = JSON.parse(e.data);
        addEventToTable(event, true);
        totalEvents++;
        eventCount.textContent = totalEvents;
      } catch (err) {
        console.error('Error parsing SSE event:', err);
      }
    };

    sseSource.onerror = function () {
      setStatus('disconnected');
      sseSource.close();
      sseSource = null;

      setTimeout(function () {
        connectSSE();
      }, reconnectDelay);

      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
    };
  }

  function setStatus(status) {
    statusDot.className = 'status-dot ' + status;
    switch (status) {
      case 'connected':
        statusText.textContent = 'Conectado';
        break;
      case 'disconnected':
        statusText.textContent = 'Desconectado';
        break;
      case 'connecting':
        statusText.textContent = 'Reconectando...';
        break;
    }
  }

  // ─── API Calls ───
  function buildQueryParams() {
    const params = new URLSearchParams();
    if (filterEntity.value) params.set('entity', filterEntity.value);
    if (filterAction.value) params.set('action', filterAction.value);
    if (filterUser.value.trim()) params.set('userId', filterUser.value.trim());
    return params;
  }

  async function fetchEvents(page) {
    try {
      const params = buildQueryParams();
      params.set('page', page);
      params.set('pageSize', PAGE_SIZE);

      const response = await fetch(CONFIG.AUDIT_API_URL + '?' + params.toString());
      if (!response.ok) throw new Error('API error');
      return await response.json();
    } catch (err) {
      console.error('Error fetching events:', err);
      return { items: [], total: 0, page: 1, pageSize: PAGE_SIZE };
    }
  }

  async function loadEvents(page) {
    const data = await fetchEvents(page);
    totalEvents = data.total;
    eventCount.textContent = totalEvents;
    currentPage = data.page;

    if (page === 1) {
      events = data.items;
      renderTable();
    } else {
      data.items.forEach(function (item) {
        addEventToTable(item, false);
      });
      events = events.concat(data.items);
    }

    // Show/hide load more
    if (events.length < totalEvents) {
      btnLoadMore.style.display = 'inline-flex';
    } else {
      btnLoadMore.style.display = 'none';
    }
  }

  // ─── Rendering ───
  function formatTimestamp(ts) {
    try {
      const d = new Date(ts);
      return d.toLocaleString('es-EC', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return ts;
    }
  }

  function getActionBadge(action) {
    const cls = action === 'CREATE' ? 'badge-create' : action === 'DELETE' ? 'badge-delete' : 'badge-update';
    return '<span class="badge ' + cls + '">' + action + '</span>';
  }

  function getSummary(event) {
    if (!event.data) return '—';
    const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    if (data.after && data.after.name) return data.after.name;
    if (data.after && data.after.status) return 'Status: ' + data.after.status;
    if (data.after && data.after.id) return 'ID: ' + data.after.id.substring(0, 8) + '...';
    if (data.before && data.before.name) return data.before.name;
    return '—';
  }

  function createRow(event, isNew) {
    const tr = document.createElement('tr');
    if (isNew) tr.className = 'row-new';
    tr.innerHTML =
      '<td>' + formatTimestamp(event.timestamp || event.createdAt) + '</td>' +
      '<td><span class="entity-tag">' + event.entity + '</span></td>' +
      '<td>' + getActionBadge(event.action) + '</td>' +
      '<td>' + (event.userEmail || event.userId || '—') + '</td>' +
      '<td>' + getSummary(event) + '</td>';

    tr.addEventListener('click', function () {
      showDetail(event);
    });
    return tr;
  }

  function renderTable() {
    eventsBody.innerHTML = '';
    if (events.length === 0) {
      eventsBody.innerHTML = '<tr class="empty-row"><td colspan="5">No hay eventos de auditoría</td></tr>';
      return;
    }
    events.forEach(function (event) {
      eventsBody.appendChild(createRow(event, false));
    });
  }

  function addEventToTable(event, isNew) {
    // Remove empty row
    var emptyRow = eventsBody.querySelector('.empty-row');
    if (emptyRow) emptyRow.remove();

    // Check filters
    if (filterEntity.value && event.entity !== filterEntity.value) return;
    if (filterAction.value && event.action !== filterAction.value) return;
    if (filterUser.value.trim()) {
      var userFilter = filterUser.value.trim().toLowerCase();
      var matchesUser = (event.userId && event.userId.toLowerCase().includes(userFilter)) ||
                        (event.userEmail && event.userEmail.toLowerCase().includes(userFilter));
      if (!matchesUser) return;
    }

    var row = createRow(event, isNew);
    eventsBody.insertBefore(row, eventsBody.firstChild);
  }

  // ─── Modal ───
  function showDetail(event) {
    modalTitle.textContent = event.entity + ' — ' + event.action;
    modalMeta.innerHTML =
      '<div class="meta-item"><div class="meta-label">ID</div><div class="meta-value">' + event.id + '</div></div>' +
      '<div class="meta-item"><div class="meta-label">Entidad</div><div class="meta-value">' + event.entity + '</div></div>' +
      '<div class="meta-item"><div class="meta-label">Acción</div><div class="meta-value">' + event.action + '</div></div>' +
      '<div class="meta-item"><div class="meta-label">Usuario</div><div class="meta-value">' + (event.userEmail || event.userId || '—') + '</div></div>' +
      '<div class="meta-item"><div class="meta-label">Timestamp</div><div class="meta-value">' + formatTimestamp(event.timestamp) + '</div></div>';

    var data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    modalJson.textContent = JSON.stringify(data, null, 2);
    modalOverlay.classList.add('active');
  }

  function closeModal() {
    modalOverlay.classList.remove('active');
  }

  // ─── Event Listeners ───
  btnApplyFilters.addEventListener('click', function () {
    currentPage = 1;
    loadEvents(1);
  });

  btnClearFilters.addEventListener('click', function () {
    filterEntity.value = '';
    filterAction.value = '';
    filterUser.value = '';
    currentPage = 1;
    loadEvents(1);
  });

  btnLoadMore.addEventListener('click', function () {
    loadEvents(currentPage + 1);
  });

  modalClose.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', function (e) {
    if (e.target === modalOverlay) closeModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
  });

  // ─── Init ───
  loadEvents(1);
  connectSSE();
})();
