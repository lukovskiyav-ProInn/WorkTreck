// ===================== DATA =====================
const STORAGE_KEY = 'yougile-clone-data-v3';

const defaultData = {
  ccompany: { id: null, name: 'Моя компания' },
  users: [
    { id: 'u1', name: 'Администратор', email: 'admin@company.ru', role: 'owner' },
    { id: 'u2', name: 'Алексей', email: 'alexey@company.ru', role: 'member' },
    { id: 'u3', name: 'Мария', email: 'maria@company.ru', role: 'member' },
    { id: 'u4', name: 'Иван', email: 'ivan@company.ru', role: 'member' },
    { id: 'u5', name: 'Ольга', email: 'olga@company.ru', role: 'member' }
  ],
  currentUserId: 'u1',
  projects: [
    {
      id: 'p1',
      name: 'Разработка продукта',
      boards: [
        {
          id: 'b1',
          name: 'Основная доска',
          columns: [
            {
              id: 'col1',
              title: 'Нужно сделать',
              tasks: [
                {
                  id: 't1',
                  title: 'Спроектировать архитектуру приложения',
                  description: 'Определить стек, структуру БД и основные модули.',
                  assigneeId: 'u2',
                  deadline: '2026-12-05',
                  priority: 'high',
                  subtasks: [
                    { id: 's1', title: 'Выбрать backend', done: true },
                    { id: 's2', title: 'Схема базы данных', done: false },
                    { id: 's3', title: 'API endpoints', done: false }
                  ],
                  attachments: [],
                  messages: [
                    { id: 'm1', authorId: 'u2', text: 'Начинаю с выбора стека', time: '10:15' },
                    { id: 'm2', authorId: 'u1', text: 'Ок, жду предложение', time: '10:22' }
                  ]
                },
                {
                  id: 't2',
                  title: 'Нарисовать макеты основных экранов',
                  description: 'Главная, доска, карточка задачи, сайдбар.',
                  assigneeId: 'u3',
                  deadline: '2026-11-30',
                  priority: 'urgent',
                  subtasks: [],
                  attachments: [],
                  messages: []
                }
              ]
            },
            {
              id: 'col2',
              title: 'В работе',
              tasks: [
                {
                  id: 't3',
                  title: 'Реализовать авторизацию',
                  description: 'Email + пароль, восстановление, роли.',
                  assigneeId: 'u4',
                  deadline: '2026-12-10',
                  priority: 'normal',
                  subtasks: [
                    { id: 's4', title: 'Форма входа', done: true },
                    { id: 's5', title: 'JWT', done: false }
                  ],
                  attachments: [],
                  messages: [
                    { id: 'm3', authorId: 'u4', text: 'Форму сделал, теперь токены', time: '09:40' }
                  ]
                }
              ]
            },
            {
              id: 'col3',
              title: 'Готово',
              tasks: [
                {
                  id: 't4',
                  title: 'Настроить CI/CD',
                  description: '',
                  assigneeId: 'u5',
                  deadline: '',
                  priority: 'normal',
                  subtasks: [
                    { id: 's6', title: 'GitHub Actions', done: true },
                    { id: 's7', title: 'Деплой на Vercel', done: true }
                  ],
                  attachments: [],
                  messages: []
                }
              ]
            }
          ]
        }
      ]
    },
    {
      id: 'p2',
      name: 'Маркетинг',
      boards: [
        {
          id: 'b2',
          name: 'Контент-план',
          columns: [
            { id: 'col4', title: 'Идеи', tasks: [] },
            { id: 'col5', title: 'В работе', tasks: [] },
            { id: 'col6', title: 'Опубликовано', tasks: [] }
          ]
        }
      ]
    }
  ],
  currentProjectId: 'p1',
  currentBoardId: 'b1'
};

let state = (typeof USE_SUPABASE !== 'undefined' && USE_SUPABASE) 
  ? { company: { id: null, name: 'Моя компания' }, users: [], projects: [], currentProjectId: null, currentBoardId: null, currentUserId: null } 
  : loadState();
let searchQuery = '';
let boardFilter = { assigneeId: '', priority: '' };
let currentTaskId = null;
const expandedSubtasks = new Set(); // task ids with open subtask list
let chatReplyToId = null;
let chatEditId = null;
let chatPendingFile = null;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // мягкая валидация: должны быть ключевые поля
      if (parsed && parsed.company && Array.isArray(parsed.projects) && Array.isArray(parsed.users)) {
        return parsed;
      }
      console.warn('[YouGile] localStorage содержит неполные данные, сброс к демо');
    }
  } catch (e) {
    console.warn('[YouGile] loadState error', e);
  }
  return structuredClone(defaultData);
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { console.warn('[YouGile] localStorage write failed', e); }
}

function uid() {
  return crypto.randomUUID();
}

function getUser(id) {
  return state.users.find(u => u.id === id) || { name: 'Неизвестный', email: '' };
}

function getCurrentUser() {
  return getUser(state.currentUserId);
}

function getCurrentProject() {
  if (!state.projects || !state.projects.length) return { id: null, name: '—', boards: [] };
  return state.projects.find(p => p.id === state.currentProjectId) || state.projects[0];
}

function getCurrentBoard() {
  const project = getCurrentProject();
  if (!project || !project.boards || !project.boards.length) return { id: null, name: '—', columns: [] };
  return project.boards.find(b => b.id === state.currentBoardId) || project.boards[0];
}

function findTask(taskId) {
  for (const project of state.projects) {
    for (const board of project.boards) {
      for (const col of board.columns) {
        const task = col.tasks.find(t => t.id === taskId);
        if (task) return { task, column: col, board, project };
      }
    }
  }
  return null;
}

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function fileIcon(name) {
  const ext = (name || '').split('.').pop().toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return '🖼';
  if (['pdf'].includes(ext)) return '📄';
  if (['doc', 'docx'].includes(ext)) return '📝';
  if (['xls', 'xlsx'].includes(ext)) return '📊';
  if (['zip', 'rar', '7z'].includes(ext)) return '📦';
  return '📎';
}

(function () {// ===================== RENDER =====================
function render() {
  try {
    renderProjects();
    renderUsers();
    renderBoards();
    renderFilters();
    renderBoard();
    renderAssigneeSelect();

    const companyName = (state.company && state.company.name) || 'Моя компания';
    const project = getCurrentProject();
    const board = getCurrentBoard();
    const user = getCurrentUser() || { name: 'Пользователь' };

    const elCompany = document.getElementById('currentCompanyName');
    if (elCompany) elCompany.textContent = companyName;

    const elProject = document.getElementById('currentProjectName');
    if (elProject) elProject.textContent = project.name || 'Проект';

    const boardNameEl = document.getElementById('currentBoardName');
    if (boardNameEl) boardNameEl.textContent = board.name || 'Доска';

    const elUserName = document.getElementById('currentUserName');
    if (elUserName) elUserName.textContent = user.name || 'Пользователь';

    const elAvatar = document.getElementById('currentUserAvatar');
    if (elAvatar) elAvatar.textContent = (user.name || 'А')[0].toUpperCase();
  } catch (e) {
    console.error('[YouGile] render error', e);
  }
}

function renderBoards() {
  const sel = document.getElementById('boardSelect');
  if (!sel) return;
  const project = getCurrentProject();
  const boards = project.boards || [];
  sel.innerHTML = boards.map(b =>
    `<option value="${b.id}" ${b.id === state.currentBoardId ? 'selected' : ''}>${escapeHtml(b.name)}</option>`
  ).join('');
}


function renderFilters() {
  const sel = document.getElementById('filterAssignee');
  if (!sel) return;
  const current = boardFilter.assigneeId || '';
  sel.innerHTML = '<option value="">Все исполнители</option>' +
    (state.users || []).map(u =>
      `<option value="${u.id}" ${u.id === current ? 'selected' : ''}>${escapeHtml(u.name)}</option>`
    ).join('');
  const pri = document.getElementById('filterPriority');
  if (pri) pri.value = boardFilter.priority || '';
}

function renderProjects() {
  const list = document.getElementById('projectsList');
  if (!list) return;
  list.innerHTML = (state.projects || []).map(p => `
    <div class="project-item ${p.id === state.currentProjectId ? 'active' : ''}" data-id="${p.id}">
      <span class="proj-name">📁 ${escapeHtml(p.name)}</span>
      <span class="proj-actions">
        <button type="button" class="proj-rename" data-id="${p.id}" title="Переименовать">✎</button>
        <button type="button" class="proj-delete danger" data-id="${p.id}" title="Удалить">×</button>
      </span>
    </div>
  `).join('');
  list.querySelectorAll('.project-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.proj-actions')) return;
      state.currentProjectId = el.dataset.id;
      const project = getCurrentProject();
      state.currentBoardId = project.boards[0]?.id;
      saveState();
      render();
    });
  });
  list.querySelectorAll('.proj-rename').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await renameProject(btn.dataset.id);
    });
  });
  list.querySelectorAll('.proj-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteProject(btn.dataset.id);
    });
  });
}

async function renameProject(projectId) {
  const project = state.projects.find(p => p.id === projectId);
  if (!project) return;
  const name = prompt('Название проекта:', project.name);
  if (!name || !name.trim() || name.trim() === project.name) return;
  project.name = name.trim();
  saveState();
  render();
  if (isCloudMode && supabase) {
    try {
      const { error } = await supabase.from('projects').update({ name: project.name }).eq('id', project.id);
      if (error) console.warn('[YouGile] rename project', error);
    } catch (e) { console.warn(e); }
  }
}

async function deleteProject(projectId) {
  if ((state.projects || []).length <= 1) {
    alert('Нельзя удалить единственный проект');
    return;
  }
  const project = state.projects.find(p => p.id === projectId);
  if (!project) return;
  if (!confirm('Удалить проект «' + project.name + '» и все его доски/задачи?')) return;
  state.projects = state.projects.filter(p => p.id !== projectId);
  if (state.currentProjectId === projectId) {
    state.currentProjectId = state.projects[0].id;
    state.currentBoardId = state.projects[0].boards[0]?.id;
  }
  saveState();
  render();
  if (isCloudMode && supabase) {
    try {
      const { error } = await supabase.from('projects').delete().eq('id', projectId);
      if (error) console.warn('[YouGile] delete project', error);
    } catch (e) { console.warn(e); }
  }
}

function isOwner() {
  const me = state.users.find(u => u.id === state.currentUserId);
  return me && me.role === 'owner';
}

function isAdminOrOwner() {
  const me = state.users.find(u => u.id === state.currentUserId);
  return me && (me.role === 'owner' || me.role === 'admin');
}

function roleLabel(role) {
  if (role === 'owner') return 'Владелец';
  if (role === 'admin') return 'Админ';
  return 'Исполнитель';
}

function renderUsers() {
  const list = document.getElementById('usersList');
  if (!list) return;
  const owner = isOwner();
  list.innerHTML = (state.users || []).map(u => {
    const canDelete = owner && u.role !== 'owner' && u.id !== state.currentUserId;
    const canEditRole = owner && u.id !== state.currentUserId && u.role !== 'owner';
    return `
      <div class="user-item" data-id="${u.id}">
        <div class="u-avatar">${(u.name || '?')[0].toUpperCase()}</div>
        <div class="u-info">
          <div class="u-name">${escapeHtml(u.name)}</div>
          <div class="u-email">${escapeHtml(u.email)}</div>
          ${canEditRole ? `
            <select class="role-select" data-id="${u.id}" title="Роль">
              <option value="member" ${u.role === 'member' ? 'selected' : ''}>Исполнитель</option>
              <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Админ</option>
            </select>
          ` : `<div class="u-role">${roleLabel(u.role)}</div>`}
        </div>
        ${canDelete ? `<button class="u-remove" data-id="${u.id}" title="Удалить сотрудника">×</button>` : ''}
      </div>
    `;
  }).join('');

  list.querySelectorAll('.u-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteUser(btn.dataset.id);
    });
  });
  list.querySelectorAll('.role-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      const id = sel.dataset.id;
      const role = sel.value;
      const u = state.users.find(x => x.id === id);
      if (!u) return;
      u.role = role;
      saveState();
      render();
      if (isCloudMode && supabase) {
        const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
        if (error) console.warn('[YouGile] role update', error);
        else console.log('[YouGile] role updated', id, role);
      }
    });
  });
}

async function deleteUser(userId) {
  const user = state.users.find(u => u.id === userId);
  if (!user) return;
  if (user.role === 'owner') { alert('Нельзя удалить владельца компании'); return; }
  if (user.id === state.currentUserId) { alert('Нельзя удалить самого себя'); return; }
  if (!confirm(`Удалить сотрудника «${user.name}» (${user.email})?`)) return;

  // Снимаем с задач
  for (const project of state.projects) {
    for (const board of project.boards) {
      for (const col of board.columns) {
        for (const task of col.tasks) {
          const ids = getTaskAssigneeIds(task);
          if (ids.includes(userId) || task.assigneeId === userId) {
            setTaskAssignees(task, ids.filter(id => id !== userId));
            persistTask(task, col.id);
          }
        }
      }
    }
  }

  // Удаляем из state
  state.users = state.users.filter(u => u.id !== userId);
  saveState();
  render();

  // Удаляем из Supabase
  if (isCloudMode && supabase) {
    try {
      const { error } = await supabase.from('profiles').delete().eq('id', userId);
      if (error) console.warn('[YouGile] delete profile', error);
    } catch (e) {
      console.warn('[YouGile] delete profile', e);
    }
  }
}

function getTaskAssigneeIds(task) {
  if (!task) return [];
  if (Array.isArray(task.assigneeIds) && task.assigneeIds.length) return task.assigneeIds.filter(Boolean);
  if (task.assigneeId) return [task.assigneeId];
  return [];
}

function setTaskAssignees(task, ids) {
  const unique = Array.from(new Set((ids || []).filter(Boolean)));
  task.assigneeIds = unique;
  task.assigneeId = unique[0] || null;
}

function renderAssigneeSelect(selectedIds) {
  const box = document.getElementById('taskAssigneeList');
  if (!box) return;
  const selected = new Set(selectedIds || []);
  box.innerHTML = (state.users || []).map(u => `
    <label class="assignee-option">
      <input type="checkbox" value="${u.id}" ${selected.has(u.id) ? 'checked' : ''} />
      ${avatarHtml(u)}
      <span class="nm">${escapeHtml(u.name)}</span>
      <span class="em">${escapeHtml(roleLabel(u.role))}</span>
    </label>
  `).join('') || '<div style="color:var(--text-muted);font-size:13px;padding:6px">Нет сотрудников</div>';
}

function readSelectedAssigneeIds() {
  const box = document.getElementById('taskAssigneeList');
  if (!box) return [];
  return Array.from(box.querySelectorAll('input[type="checkbox"]:checked')).map(el => el.value);
}

function renderBoard() {
  const board = getCurrentBoard();
  const container = document.getElementById('board');
  if (!container) return;
  if (!board || !board.columns || !board.columns.length) {
    container.innerHTML = '<div class="empty-board">Нет колонок. Добавьте первую колонку →</div>';
    return;
  }
  const q = searchQuery.toLowerCase().trim();
  container.innerHTML = board.columns.map(col => {
    let tasks = col.tasks || [];
    if (q) {
      tasks = tasks.filter(t =>
        (t.title || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
      );
    }
    if (boardFilter.assigneeId) {
      tasks = tasks.filter(t => getTaskAssigneeIds(t).includes(boardFilter.assigneeId));
    }
    if (boardFilter.priority) {
      tasks = tasks.filter(t => (t.priority || 'normal') === boardFilter.priority);
    }
    return `
      <div class="column" data-col-id="${col.id}">
        <div class="column-header">
          <div class="column-header-left">
            <span class="column-title" data-col-id="${col.id}">${escapeHtml(col.title)}</span>
            <span class="column-count">${tasks.length}</span>
          </div>
          <div class="column-actions">
            <button class="col-btn" data-action="rename" data-col-id="${col.id}" title="Переименовать">✎</button>
            <button class="col-btn danger" data-action="delete" data-col-id="${col.id}" title="Удалить колонку">×</button>
          </div>
        </div>
        <div class="column-cards" data-col-id="${col.id}">
          ${tasks.map(task => renderCard(task)).join('')}
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.col-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const colId = btn.dataset.colId;
      if (btn.dataset.action === 'rename') {
        const col = getCurrentBoard().columns.find(c => c.id === colId);
        if (!col) return;
        const name = prompt('Новое название колонки:', col.title);
        if (name && name.trim()) { col.title = name.trim(); persistColumn(col, getCurrentBoard().id); render(); }
      } else if (btn.dataset.action === 'delete') {
        if (!confirm('Удалить колонку и все задачи в ней?')) return;
        getCurrentBoard().columns = getCurrentBoard().columns.filter(c => c.id !== colId);
        saveState(); render();
      }
    });
  });

  container.querySelectorAll('.column-title').forEach(el => {
    el.addEventListener('dblclick', () => {
      const col = getCurrentBoard().columns.find(c => c.id === el.dataset.colId);
      if (!col) return;
      const name = prompt('Новое название колонки:', col.title);
      if (name && name.trim()) { col.title = name.trim(); persistColumn(col, getCurrentBoard().id); render(); }
    });
  });
  setupDragAndDrop();
}

function renderCard(task) {
  const subs = task.subtasks || [];
  const done = subs.filter(s => s.done).length;
  const total = subs.length;
  const progress = total ? Math.round((done / total) * 100) : 0;
  const assignees = getTaskAssigneeIds(task).map(id => getUser(id)).filter(u => u && u.name);
  const filesCount = (task.attachments || []).length;
  const msgCount = (task.messages || []).length;
  const priorityClass = task.priority === 'urgent' ? 'priority-urgent' : task.priority === 'high' ? 'priority-high' : '';
  const priorityLabel = task.priority === 'urgent' ? '🔥 Срочно' : task.priority === 'high' ? '⚡ Важно' : '';
  const expanded = expandedSubtasks.has(task.id);
  const subList = total ? `
    <div class="card-subtasks ${expanded ? 'open' : ''}" data-subs-for="${task.id}">
      ${subs.map(s => `
        <div class="card-subtask ${s.done ? 'done' : ''}" data-sub-id="${s.id}">
          <input type="checkbox" class="card-sub-check" data-task-id="${task.id}" data-sub-id="${s.id}" ${s.done ? 'checked' : ''} />
          <span class="card-sub-title">${escapeHtml(s.title)}</span>
        </div>
      `).join('')}
    </div>` : '';

  return `
    <div class="card ${expanded ? 'has-open-subs' : ''}" draggable="true" data-task-id="${task.id}">
      <div class="card-main">
        <div class="card-title">${escapeHtml(task.title)}</div>
        <div class="card-meta">
          ${assignees.length ? `<span class="avatar-stack">${assignees.slice(0,4).map(a => avatarHtml(a)).join('')}${assignees.length > 4 ? `<span class="sticker">+${assignees.length-4}</span>` : ''}</span>` : ''}
          ${task.deadline ? `<span class="sticker deadline">📅 ${formatDate(task.deadline)}</span>` : ''}
          ${priorityLabel ? `<span class="sticker ${priorityClass}">${priorityLabel}</span>` : ''}
          ${filesCount ? `<span class="sticker">📎 ${filesCount}</span>` : ''}
          ${msgCount ? `<span class="sticker">💬 ${msgCount}</span>` : ''}
        </div>
        ${total ? `
          <div class="card-sub-bar">
            <button type="button" class="subtasks-toggle" data-toggle-subs="${task.id}" title="Подзадачи">
              <span class="chevron ${expanded ? 'open' : ''}">▶</span>
              <span>${done}/${total} подзадач</span>
            </button>
            <div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div>
          </div>` : ''}
      </div>
      ${subList}
    </div>
  `;
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function avatarColor(seed) {
  const colors = ['#5b8def','#8b5cf6','#34a853','#f9ab00','#ea4335','#00bfa5','#ff6d00','#7c4dff'];
  let h = 0;
  const s = String(seed || '');
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return colors[h % colors.length];
}

function avatarHtml(user, sizeClass) {
  const name = (user && user.name) || '?';
  const letter = name[0].toUpperCase();
  const bg = avatarColor(user && (user.id || user.email || name));
  return `<span class="av ${sizeClass || ''}" style="background:${bg}" title="${escapeHtml(name)}">${letter}</span>`;
}


let draggedTaskId = null;

function setupDragAndDrop() {
  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('dragstart', e => {
      if (e.target.closest('.card-subtasks, .subtasks-toggle, .card-sub-check')) {
        e.preventDefault();
        return;
      }
      draggedTaskId = card.dataset.taskId;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      draggedTaskId = null;
      document.querySelectorAll('.column-cards').forEach(z => z.classList.remove('drag-over'));
    });
    card.addEventListener('click', (e) => {
      if (e.target.closest('.subtasks-toggle')) {
        e.stopPropagation();
        const id = e.target.closest('.subtasks-toggle').dataset.toggleSubs;
        if (expandedSubtasks.has(id)) expandedSubtasks.delete(id);
        else expandedSubtasks.add(id);
        renderBoard();
        return;
      }
      if (e.target.closest('.card-sub-check')) {
        e.stopPropagation();
        const cb = e.target.closest('.card-sub-check');
        const taskId = cb.dataset.taskId;
        const subId = cb.dataset.subId;
        const found = findTask(taskId);
        if (!found) return;
        const sub = (found.task.subtasks || []).find(s => s.id === subId);
        if (!sub) return;
        sub.done = cb.checked;
        saveState();
        renderBoard();
        persistSubtask(sub, taskId);
        return;
      }
      if (e.target.closest('.card-subtasks')) {
        e.stopPropagation();
        return;
      }
      openTask(card.dataset.taskId);
    });
  });
  document.querySelectorAll('.column-cards').forEach(zone => {
    zone.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; zone.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      if (!draggedTaskId) return;
      moveTask(draggedTaskId, zone.dataset.colId);
    });
  });
}

function moveTask(taskId, targetColId) {
  const found = findTask(taskId);
  if (!found) return;
  const { task, column } = found;
  if (column.id === targetColId) return;
  column.tasks = column.tasks.filter(t => t.id !== taskId);
  const targetCol = getCurrentBoard().columns.find(c => c.id === targetColId);
  if (targetCol) targetCol.tasks.push(task);
  saveState(); render(); persistTask(task, targetColId);
}

function openTask(taskId) {
  const found = findTask(taskId);
  if (!found) return;
  currentTaskId = taskId;
  const { task } = found;
  document.getElementById('taskTitle').value = task.title;
  document.getElementById('taskDescription').value = task.description || '';
  renderAssigneeSelect(getTaskAssigneeIds(task));
  document.getElementById('taskDeadline').value = task.deadline || '';
  document.getElementById('taskPriority').value = task.priority || 'normal';
  renderSubtasks(task);
  renderAttachments(task);
  renderChat(task);
  document.getElementById('taskModal').classList.add('open');
  document.getElementById('taskTitle').focus();
}

function closeModal() {
  if (currentTaskId) {
    const found = findTask(currentTaskId);
    if (found) {
      const prevIds = getTaskAssigneeIds(found.task);
      found.task.title = document.getElementById('taskTitle').value.trim() || 'Без названия';
      found.task.description = document.getElementById('taskDescription').value;
      setTaskAssignees(found.task, readSelectedAssigneeIds());
      found.task.deadline = document.getElementById('taskDeadline').value;
      found.task.priority = document.getElementById('taskPriority').value;
      const newIds = getTaskAssigneeIds(found.task).filter(id => !prevIds.includes(id));
      for (const uid of newIds) {
        const user = getUser(uid);
        console.log('[Уведомление] Задача "' + found.task.title + '" назначена на ' + user.name + ' (' + user.email + ')');
        notifyTask({ type: 'assigned', userId: uid, taskTitle: found.task.title });
      }
      saveState(); render(); persistTask(found.task, found.column.id);
    }
  }
  document.getElementById('taskModal').classList.remove('open');
  currentTaskId = null;
}

function deleteCurrentTask() {
  if (!currentTaskId) return;
  if (!confirm('Удалить задачу?')) return;
  const found = findTask(currentTaskId);
  if (found) {
    found.column.tasks = found.column.tasks.filter(t => t.id !== currentTaskId);
    saveState();
    document.getElementById('taskModal').classList.remove('open');
    currentTaskId = null;
    render();
    supabaseDelete('tasks', currentTaskId).catch(e => console.warn('[YouGile] delete task', e));
  }
}

function renderSubtasks(task) {
  if (!task.subtasks) task.subtasks = [];
  const list = document.getElementById('subtasksList');
  const done = task.subtasks.filter(s => s.done).length;
  document.getElementById('subtasksProgress').textContent = task.subtasks.length ? '(' + done + '/' + task.subtasks.length + ')' : '';
  list.innerHTML = task.subtasks.map(s => `
    <div class="subtask-item ${s.done ? 'done' : ''}">
      <input type="checkbox" data-id="${s.id}" ${s.done ? 'checked' : ''} />
      <span>${escapeHtml(s.title)}</span>
    </div>
  `).join('');
  list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const sub = task.subtasks.find(s => s.id === cb.dataset.id);
      if (sub) { sub.done = cb.checked; saveState(); renderSubtasks(task); render(); persistSubtask(sub, task.id); }
    });
  });
}

function renderAttachments(task) {
  if (!task.attachments) task.attachments = [];
  const list = document.getElementById('attachmentsList');
  if (!task.attachments.length) { list.innerHTML = ''; return; }
  list.innerHTML = task.attachments.map(f => `
    <div class="attachment-item" data-id="${f.id}">
      <span class="att-icon">${fileIcon(f.name)}</span>
      <div class="att-info">
        <div class="att-name">${escapeHtml(f.name)}</div>
        <div class="att-size">${formatSize(f.size)}</div>
      </div>
      <button class="att-remove" data-id="${f.id}" title="Удалить">×</button>
    </div>
  `).join('');
  list.querySelectorAll('.att-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      task.attachments = task.attachments.filter(a => a.id !== btn.dataset.id);
      saveState(); renderAttachments(task); render();
      supabaseDelete('attachments', btn.dataset.id).catch(e => console.warn('[YouGile] delete attachment', e));
    });
  });
  list.querySelectorAll('.attachment-item').forEach(item => {
    item.querySelector('.att-info').style.cursor = 'pointer';
    item.querySelector('.att-info').addEventListener('click', async () => {
      const att = task.attachments.find(a => a.id === item.dataset.id);
      if (!att) return;
      if (att.data) {
        const a = document.createElement('a');
        a.href = att.data;
        a.download = att.name;
        a.click();
      } else if (att.storage_path) {
        const { data, error } = await supabase.storage.from('task-files').createSignedUrl(att.storage_path, 60);
        if (error) { console.error('[YouGile] signed url', error); return; }
        window.open(data.signedUrl, '_blank');
      }
    });
  });
}

function findMessage(task, msgId) {
  return (task.messages || []).find(m => m.id === msgId);
}

function renderChat(task) {
  if (!task.messages) task.messages = [];
  const chat = document.getElementById('taskChat');
  if (!chat) return;
  if (!task.messages.length) {
    chat.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:8px 0">Пока нет сообщений. Напишите первое.</div>';
    return;
  }
  chat.innerHTML = task.messages.map(m => {
    const author = getUser(m.authorId);
    const mine = m.authorId === state.currentUserId;
    let replyHtml = '';
    if (m.replyToId) {
      const parent = findMessage(task, m.replyToId);
      const preview = parent ? (parent.text || parent.file?.name || 'сообщение') : (m.replyPreview || 'сообщение');
      replyHtml = `<div class="reply-quote">${escapeHtml(preview)}</div>`;
    }
    let fileHtml = '';
    if (m.file && m.file.name) {
      fileHtml = `<div class="msg-file" data-msg-file="${m.id}">📎 ${escapeHtml(m.file.name)}${m.file.size ? ' (' + formatSize(m.file.size) + ')' : ''}</div>`;
    }
    const actions = `
      <div class="msg-actions">
        <button type="button" data-act="reply" data-id="${m.id}">Ответить</button>
        ${mine ? `<button type="button" data-act="edit" data-id="${m.id}">Изменить</button>` : ''}
      </div>`;
    return `
      <div class="chat-msg ${mine ? 'mine' : ''}" data-msg-id="${m.id}">
        <div class="author" style="display:flex;align-items:center;gap:6px;${!mine ? '' : 'justify-content:flex-end'}">
          ${!mine ? avatarHtml(author) : ''}
          <span>${escapeHtml(author.name)} · ${m.time}${m.edited ? '<span class="edited-mark">(изм.)</span>' : ''}</span>
          ${mine ? avatarHtml(author) : ''}
        </div>
        <div class="bubble">
          ${replyHtml}
          ${m.text ? escapeHtml(m.text) : ''}
          ${fileHtml}
        </div>
        ${actions}
      </div>
    `;
  }).join('');

  chat.querySelectorAll('[data-act="reply"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const msg = findMessage(task, btn.dataset.id);
      if (!msg) return;
      chatReplyToId = msg.id;
      chatEditId = null;
      const bar = document.getElementById('chatReplyBar');
      const label = document.getElementById('chatReplyLabel');
      if (bar) bar.style.display = 'block';
      if (label) label.textContent = 'Ответ: ' + (msg.text || msg.file?.name || 'сообщение').slice(0, 80);
      document.getElementById('chatMessage')?.focus();
    });
  });
  chat.querySelectorAll('[data-act="edit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const msg = findMessage(task, btn.dataset.id);
      if (!msg) return;
      chatEditId = msg.id;
      chatReplyToId = null;
      const input = document.getElementById('chatMessage');
      if (input) input.value = msg.text || '';
      const bar = document.getElementById('chatReplyBar');
      const label = document.getElementById('chatReplyLabel');
      if (bar) bar.style.display = 'block';
      if (label) label.textContent = 'Редактирование сообщения';
      input?.focus();
    });
  });
  chat.querySelectorAll('[data-msg-file]').forEach(el => {
    el.addEventListener('click', () => {
      const msg = findMessage(task, el.getAttribute('data-msg-file'));
      if (msg?.file?.data) {
        const a = document.createElement('a');
        a.href = msg.file.data;
        a.download = msg.file.name || 'file';
        a.click();
      }
    });
  });
  chat.scrollTop = chat.scrollHeight;
}

function clearChatComposer() {
  chatReplyToId = null;
  chatEditId = null;
  chatPendingFile = null;
  const bar = document.getElementById('chatReplyBar');
  if (bar) bar.style.display = 'none';
  const prev = document.getElementById('chatFilePreview');
  if (prev) { prev.style.display = 'none'; prev.textContent = ''; }
  const fin = document.getElementById('chatFileInput');
  if (fin) fin.value = '';
}

function openTaskChatPanel() {
  if (!currentTaskId) return;
  const found = findTask(currentTaskId);
  if (!found) return;
  const titleEl = document.getElementById('chatPanelTaskTitle');
  if (titleEl) titleEl.textContent = found.task.title || 'Задача';
  renderChat(found.task);
  const overlay = document.getElementById('chatPanelOverlay');
  if (overlay) overlay.classList.add('open');
  const input = document.getElementById('chatMessage');
  if (input) setTimeout(() => input.focus(), 50);
}

function closeTaskChatPanel() {
  const overlay = document.getElementById('chatPanelOverlay');
  if (overlay) overlay.classList.remove('open');
}

document.getElementById('fileInput').addEventListener('change', async (e) => {
  if (!currentTaskId) return;
  const found = findTask(currentTaskId);
  if (!found) return;
  if (!found.task.attachments) found.task.attachments = [];
  const files = Array.from(e.target.files);
  for (const file of files) {
    if (file.size > 5 * 1024 * 1024) {
      alert('Файл "' + file.name + '" больше 5 МБ. Пока поддерживаются файлы до 5 МБ.');
      continue;
    }
    if (isCloudMode && supabase) {
      const path = 'task_' + found.task.id + '/' + uid() + '_' + file.name;
      const { error } = await supabase.storage.from('task-files').upload(path, file);
      if (error) { console.error('[YouGile] upload', error); alert('Не удалось загрузить файл: ' + error.message); continue; }
      const att = { id: uid(), name: file.name, size: file.size, type: file.type, storage_path: path };
      found.task.attachments.push(att);
      persistAttachment(att, found.task.id);
    } else {
      const data = await readFileAsDataURL(file);
      found.task.attachments.push({ id: uid(), name: file.name, size: file.size, type: file.type, data });
    }
  }
  e.target.value = '';
  saveState();
  renderAttachments(found.task);
  render();
});

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ===================== CRUD UI =====================
document.getElementById('btnAddProject').addEventListener('click', async () => {
  const name = prompt('Название проекта:');
  if (!name || !name.trim()) return;
  const id = uid();
  const project = { id, name: name.trim(), boards: [{ id: uid(), name: 'Основная доска', columns: [
    { id: uid(), title: 'Нужно сделать', tasks: [] },
    { id: uid(), title: 'В работе', tasks: [] },
    { id: uid(), title: 'Готово', tasks: [] }
  ] }] };
  state.projects.push(project);
  state.currentProjectId = id;
  state.currentBoardId = project.boards[0].id;
  saveState(); render();
  await persistProject(project);
});

document.getElementById('btnAddColumn').addEventListener('click', async () => {
  const title = prompt('Название колонки:');
  if (!title || !title.trim()) return;
  const col = { id: uid(), title: title.trim(), tasks: [] };
  const board = getCurrentBoard();
  board.columns.push(col);
  saveState(); render();
  await persistColumn(col, board.id);
});

document.getElementById('btnAddTask').addEventListener('click', async () => {
  const board = getCurrentBoard();
  if (!board.columns.length) { alert('Сначала создайте колонку'); return; }
  const title = prompt('Название задачи:');
  if (!title || !title.trim()) return;
  const task = { id: uid(), title: title.trim(), description: '', assigneeId: null, deadline: '', priority: 'normal', subtasks: [], attachments: [], messages: [] };
  board.columns[0].tasks.unshift(task);
  saveState(); render(); openTask(task.id);
  await persistTask(task, board.columns[0].id);
});

document.getElementById('btnAddUser').addEventListener('click', () => {
  document.getElementById('inviteName').value = '';
  document.getElementById('inviteEmail').value = '';
  document.getElementById('inviteModal').classList.add('open');
  document.getElementById('inviteName').focus();
});

document.getElementById('closeInviteModal').addEventListener('click', () => {
  document.getElementById('inviteModal').classList.remove('open');
});

document.getElementById('inviteModal').addEventListener('click', e => {
  if (e.target === document.getElementById('inviteModal')) document.getElementById('inviteModal').classList.remove('open');
});

document.getElementById('btnConfirmInvite').addEventListener('click', async () => {
  const name = document.getElementById('inviteName').value.trim();
  const email = document.getElementById('inviteEmail').value.trim();

  if (!name || !email) { alert('Укажите имя и email'); return; }
  if (state.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    alert('Сотрудник с таким email уже есть');
    return;
  }
  if (!state.company.id) {
    alert('Ошибка: компания ещё не создана в базе. Обновите страницу.');
    return;
  }

  console.log('[Приглашение] Отправка приглашения на ' + email);

  let userId = uid();

  if (isCloudMode && supabase) {
    try {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: { email, name, company_id: state.company.id }
      });
      if (error) {
        console.error('[YouGile] invite error:', error);
        alert('Не удалось отправить приглашение: ' + error.message);
        return;
      }
      // Важно: id из auth.users, иначе assignee_id не пройдёт FK в profiles
      const invited = data && (data.user || data);
      if (invited && invited.id) userId = invited.id;
      else if (data && data.user && data.user.id) userId = data.user.id;

      // Привязка профиля к компании (триггер мог создать профиль без company_id)
      try {
        await supabase.from('profiles').upsert({
          id: userId,
          email,
          full_name: name,
          company_id: state.company.id,
          role: 'member'
        }, { onConflict: 'id' });
      } catch (pe) {
        console.warn('[YouGile] profile upsert after invite', pe);
      }

      console.log('Приглашение успешно отправлено, userId=', userId);
      alert('Приглашение отправлено на ' + email);
    } catch (e) {
      console.error('[YouGile] invite exception:', e);
      alert('Сетевая ошибка при отправке приглашения. Проверьте консоль.');
      return;
    }
  } else {
    console.log('[YouGile] Локальный режим: приглашение только в браузере');
  }

  state.users.push({ id: userId, name, email, role: 'member' });
  saveState();
  render();
  document.getElementById('inviteModal').classList.remove('open');
});

document.getElementById('closeModal').addEventListener('click', closeModal);
document.getElementById('btnDeleteTask').addEventListener('click', deleteCurrentTask);
document.getElementById('taskModal').addEventListener('click', e => {
  if (e.target === document.getElementById('taskModal')) closeModal();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (document.getElementById('taskModal').classList.contains('open')) closeModal();
    if (document.getElementById('inviteModal').classList.contains('open')) document.getElementById('inviteModal').classList.remove('open');
    if (document.getElementById('chatPanelOverlay')?.classList.contains('open')) closeTaskChatPanel();
  }
});

document.getElementById('btnAddSubtask').addEventListener('click', async () => {
  if (!currentTaskId) return;
  const input = document.getElementById('newSubtask');
  const title = input.value.trim();
  if (!title) return;
  const found = findTask(currentTaskId);
  if (found) {
    if (!found.task.subtasks) found.task.subtasks = [];
    const sub = { id: uid(), title, done: false };
    found.task.subtasks.push(sub);
    input.value = '';
    saveState(); renderSubtasks(found.task); render();
    await persistSubtask(sub, found.task.id);
  }
});

document.getElementById('newSubtask').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btnAddSubtask').click();
});

document.getElementById('btnSendMessage').addEventListener('click', async () => {
  if (!currentTaskId) return;
  const input = document.getElementById('chatMessage');
  const text = (input?.value || '').trim();
  if (!text && !chatPendingFile) return;
  const found = findTask(currentTaskId);
  if (!found) return;
  if (!found.task.messages) found.task.messages = [];

  // Редактирование
  if (chatEditId) {
    const msg = findMessage(found.task, chatEditId);
    if (msg && msg.authorId === state.currentUserId) {
      msg.text = text;
      msg.edited = true;
      if (chatPendingFile) msg.file = chatPendingFile;
      input.value = '';
      clearChatComposer();
      saveState();
      renderChat(found.task);
      await persistMessage(msg, found.task.id);
    }
    return;
  }

  const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const parent = chatReplyToId ? findMessage(found.task, chatReplyToId) : null;
  const msg = {
    id: uid(),
    authorId: state.currentUserId,
    text,
    time,
    replyToId: chatReplyToId || null,
    replyPreview: parent ? (parent.text || parent.file?.name || '') : null,
    file: chatPendingFile || null
  };
  found.task.messages.push(msg);
  input.value = '';
  clearChatComposer();
  saveState();
  renderChat(found.task);
  await persistMessage(msg, found.task.id);
  for (const id of getTaskAssigneeIds(found.task)) {
    if (id === state.currentUserId) continue;
    const user = getUser(id);
    console.log('[Уведомление] Новый ответ в задаче "' + found.task.title + '" → ' + user.email);
    notifyTask({ type: 'comment', userId: id, taskTitle: found.task.title, message: text || ('Файл: ' + (msg.file?.name || '')) });
  }
});

document.getElementById('chatMessage').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('btnSendMessage').click();
});

document.getElementById('searchInput').addEventListener('input', e => {
  searchQuery = e.target.value;
  renderBoard();
});

document.getElementById('companySelect').addEventListener('click', async () => {
  const name = prompt('Название компании:', state.company.name);
  if (name && name.trim()) { state.company.name = name.trim(); saveState(); render();
    if (isCloudMode && supabase) { await supabase.from('companies').update({ name: state.company.name }).eq('id', state.company.id); } }
});

document.getElementById('btnReset').addEventListener('click', () => {
  if (!confirm('Сбросить все данные и вернуться к демо-проекту?')) return;
  localStorage.removeItem(STORAGE_KEY);
  state = structuredClone(defaultData);
  searchQuery = '';
  document.getElementById('searchInput').value = '';
  render();
});


// ===================== NOTIFICATIONS =====================
async function notifyTask({ type, userId, taskTitle, message }) {
  if (!isCloudMode || !supabase || !userId) return;
  if (userId === state.currentUserId) return;
  const user = getUser(userId);
  if (!user?.email) {
    console.warn('[YouGile] notify: нет email у пользователя', userId);
    return;
  }
  const from = getCurrentUser();
  try {
    const { data, error } = await supabase.functions.invoke('notify-task', {
      body: {
        type,
        to_email: String(user.email || '').trim().toLowerCase(),
        to_name: user.name,
        task_title: taskTitle,
        from_name: from?.name || from?.email || 'Коллега',
        message: message || '',
        company_name: state.company?.name || ''
      }
    });
    if (error) {
      console.warn('[YouGile] notify error', error);
      return;
    }
    if (data && data.error) {
      console.warn('[YouGile] notify failed:', data.error, data.hint || '');
      return;
    }
    console.log('[YouGile] notify sent', type, '→', user.email, data);
  } catch (e) {
    console.warn('[YouGile] notify exception', e);
  }
}

// ===================== PERSIST (Supabase) =====================
async function persistProject(project) {
  if (!isCloudMode || !supabase || !project) return;
  try {
    const { error } = await supabase.from('projects').upsert({ id: project.id, company_id: state.company.id, name: project.name }, { onConflict: 'id' });
    if (error) console.warn('[YouGile] persist project', error);
    for (const board of project.boards) await persistBoard(board, project.id);
  } catch (e) { console.warn('[YouGile] persistProject', e); }
}

async function persistBoard(board, projectId) {
  if (!isCloudMode || !supabase || !board) return;
  try {
    const pid = projectId || getCurrentProject().id;
    const { error } = await supabase.from('boards').upsert({ id: board.id, project_id: pid, name: board.name }, { onConflict: 'id' });
    if (error) console.warn('[YouGile] persist board', error);
    for (const col of board.columns) await persistColumn(col, board.id);
  } catch (e) { console.warn('[YouGile] persistBoard', e); }
}

async function persistColumn(col, boardId) {
  if (!isCloudMode || !supabase || !col) return;
  try {
    const bid = boardId || getCurrentBoard().id;
    const { error } = await supabase.from('columns').upsert({ id: col.id, board_id: bid, title: col.title, position: 0 }, { onConflict: 'id' });
    if (error) console.warn('[YouGile] persist column', error);
    for (const task of col.tasks) await persistTask(task, col.id);
  } catch (e) { console.warn('[YouGile] persistColumn', e); }
}

async function resolveAssigneeId(assigneeId) {
  if (!assigneeId || !isCloudMode || !supabase) return assigneeId || null;
  // Уже есть в локальном списке и похож на UUID из auth
  const local = state.users.find(u => u.id === assigneeId);
  // Проверяем profiles
  try {
    const { data } = await supabase.from('profiles').select('id').eq('id', assigneeId).maybeSingle();
    if (data && data.id) return data.id;
    // Пробуем найти по email локального пользователя
    if (local && local.email) {
      const { data: byEmail } = await supabase.from('profiles').select('id').eq('email', local.email).maybeSingle();
      if (byEmail && byEmail.id) {
        // чиним локальный id
        local.id = byEmail.id;
        saveState();
        return byEmail.id;
      }
    }
  } catch (e) {
    console.warn('[YouGile] resolveAssigneeId', e);
  }
  // Нельзя писать чужой UUID в FK — сохраняем задачу без исполнителя в облаке
  return null;
}

async function persistTaskAssignees(task) {
  if (!isCloudMode || !supabase || !task) return;
  const ids = getTaskAssigneeIds(task);
  const resolved = [];
  for (const id of ids) {
    const rid = await resolveAssigneeId(id);
    if (rid) resolved.push(rid);
  }
  try {
    await supabase.from('task_assignees').delete().eq('task_id', task.id);
    if (resolved.length) {
      const rows = resolved.map(user_id => ({ task_id: task.id, user_id }));
      const { error } = await supabase.from('task_assignees').insert(rows);
      if (error) console.warn('[YouGile] persist assignees', error);
    }
  } catch (e) {
    console.warn('[YouGile] persistTaskAssignees', e);
  }
  return resolved[0] || null;
}

async function persistTask(task, columnId) {
  if (!isCloudMode || !supabase || !task) return;
  try {
    const assignee_id = await persistTaskAssignees(task);
    task.assigneeId = assignee_id;
    const { error } = await supabase.from('tasks').upsert({
      id: task.id,
      column_id: columnId,
      title: task.title,
      description: task.description || '',
      assignee_id,
      deadline: task.deadline || null,
      priority: task.priority || 'normal',
      position: 0
    }, { onConflict: 'id' });
    if (error) console.warn('[YouGile] persist task', error);
    for (const sub of (task.subtasks || [])) await persistSubtask(sub, task.id);
    for (const msg of (task.messages || [])) await persistMessage(msg, task.id);
    for (const att of (task.attachments || [])) await persistAttachment(att, task.id);
  } catch (e) { console.warn('[YouGile] persistTask', e); }
}

async function persistSubtask(sub, taskId) {
  if (!isCloudMode || !supabase || !sub) return;
  try {
    const { error } = await supabase.from('subtasks').upsert({ id: sub.id, task_id: taskId, title: sub.title, done: sub.done, position: 0 }, { onConflict: 'id' });
    if (error) console.warn('[YouGile] persist subtask', error);
  } catch (e) { console.warn('[YouGile] persistSubtask', e); }
}

async function persistMessage(msg, taskId) {
  if (!isCloudMode || !supabase || !msg) return;
  try {
    const row = {
      id: msg.id,
      task_id: taskId,
      author_id: msg.authorId,
      text: msg.text || '',
      reply_to: msg.replyToId || null,
      edited_at: msg.edited ? new Date().toISOString() : null,
      file_name: msg.file?.name || null,
      file_size: msg.file?.size || null,
      file_path: msg.file?.storage_path || null,
      file_data: msg.file?.data || null
    };
    const { error } = await supabase.from('task_messages').upsert(row, { onConflict: 'id' });
    if (error) console.warn('[YouGile] persist message', error);
  } catch (e) { console.warn('[YouGile] persistMessage', e); }
}

async function persistAttachment(att, taskId) {
  if (!isCloudMode || !supabase || !att) return;
  try {
    const { error } = await supabase.from('attachments').upsert({ id: att.id, task_id: taskId, name: att.name, size: att.size, mime_type: att.type, storage_path: att.storage_path || '' }, { onConflict: 'id' });
    if (error) console.warn('[YouGile] persist attachment', error);
  } catch (e) { console.warn('[YouGile] persistAttachment', e); }
}

async function supabaseDelete(table, id) {
  if (!isCloudMode || !supabase || !id) return;
  try { await supabase.from(table).delete().eq('id', id); } catch (e) { console.warn('[YouGile] delete', e); }
}

// ===================== SUPABASE / AUTH LAYER =====================
let isCloudMode = false;
let authMode = 'login';
let cloudUser = null;
let supabase = null;

async function ensureCompany() {
  if (!isCloudMode || !supabase) return;
  
  // 1. Проверяем, есть ли у текущего пользователя привязка к компании
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', state.currentUserId)
    .single();
  
  if (profile && profile.company_id) {
    // Если есть — просто берем её
    state.company.id = profile.company_id;
    return;
  }
  
  // 2. Если нет — создаем новую компанию с настоящим UUID
  const newCompanyId = crypto.randomUUID(); // Генерируем UUID в браузере
  const { data: created, error } = await supabase
    .from('companies')
    .insert({ id: newCompanyId, name: state.company.name || 'Моя компания' })
    .select()
    .single();
  
  if (error) {
    console.warn('[YouGile] Ошибка создания компании:', error);
    return;
  }
  
  state.company.id = created.id;
  
  // 3. Обновляем профиль, привязывая его к новой компании
  await supabase.from('profiles').update({ company_id: created.id }).eq('id', state.currentUserId);
}

async function loadFromCloud() {
  if (!isCloudMode || !supabase) return;
  try {
    const { data: projects } = await supabase.from('projects').select('id, name').eq('company_id', state.company.id).order('created_at');
    if (!projects || !projects.length) return false;
    state.projects = [];
    for (const p of projects) {
      const { data: boards } = await supabase.from('boards').select('id, name').eq('project_id', p.id).order('created_at');
      p.boards = [];
      for (const b of boards || []) {
        const { data: columns } = await supabase.from('columns').select('id, title').eq('board_id', b.id).order('position');
        b.columns = [];
        for (const c of columns || []) {
          const { data: tasks } = await supabase.from('tasks').select('id, title, description, assignee_id, deadline, priority').eq('column_id', c.id).order('position');
          c.tasks = [];
          for (const t of tasks || []) {
            const { data: subtasks } = await supabase.from('subtasks').select('id, title, done').eq('task_id', t.id).order('position');
            const { data: messages } = await supabase.from('task_messages').select('id, author_id, text, created_at, reply_to, edited_at, file_name, file_size, file_path, file_data').eq('task_id', t.id).order('created_at');
            const { data: attachments } = await supabase.from('attachments').select('id, name, size, mime_type, storage_path').eq('task_id', t.id).order('created_at');
            t.subtasks = (subtasks || []).map(s => ({ id: s.id, title: s.title, done: s.done }));
            t.messages = (messages || []).map(m => ({
              id: m.id,
              authorId: m.author_id,
              text: m.text,
              time: new Date(m.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
              replyToId: m.reply_to || null,
              edited: !!m.edited_at,
              file: m.file_name ? { name: m.file_name, size: m.file_size, data: m.file_data, storage_path: m.file_path } : null
            }));
            t.attachments = (attachments || []).map(a => ({ id: a.id, name: a.name, size: a.size, type: a.mime_type, storage_path: a.storage_path }));
            t.assigneeId = t.assignee_id || null;
            try {
              const { data: ta } = await supabase.from('task_assignees').select('user_id').eq('task_id', t.id);
              t.assigneeIds = (ta || []).map(x => x.user_id);
              if (!t.assigneeIds.length && t.assigneeId) t.assigneeIds = [t.assigneeId];
            } catch (_) {
              t.assigneeIds = t.assigneeId ? [t.assigneeId] : [];
            }
            c.tasks.push(t);
          }
          b.columns.push(c);
        }
        p.boards.push(b);
      }
      state.projects.push(p);
    }
    if (state.projects.length) {
      state.currentProjectId = state.projects[0].id;
      if (state.projects[0].boards.length) state.currentBoardId = state.projects[0].boards[0].id;
    }
    return true;
  } catch (e) {
    console.error('[YouGile] loadFromCloud error', e);
    return false;
  }
}

async function loadCompanyUsers() {
  if (!isCloudMode || !supabase || !state.company.id) return;
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('company_id', state.company.id);
    if (error) {
      console.warn('[YouGile] loadCompanyUsers', error);
      return;
    }
    const map = new Map((state.users || []).map(u => [u.id, u]));
    for (const p of profiles || []) {
      map.set(p.id, {
        id: p.id,
        name: p.full_name || p.email || 'Пользователь',
        email: p.email || '',
        role: p.role || 'member'
      });
    }
    // текущий пользователь в списке только как member, если профиля ещё нет
    if (cloudUser && !map.has(cloudUser.id)) {
      map.set(cloudUser.id, {
        id: cloudUser.id,
        name: cloudUser.user_metadata?.full_name || splitEmail(cloudUser.email),
        email: cloudUser.email,
        role: 'member'
      });
    }
    state.users = Array.from(map.values());
  } catch (e) {
    console.warn('[YouGile] loadCompanyUsers', e);
  }
}

async function onCloudReady() {
  if (!cloudUser) return;
  state.currentUserId = cloudUser.id;

  // company_id из invite metadata, если есть
  const metaCompanyId = cloudUser.user_metadata?.company_id || null;
  if (metaCompanyId && !state.company.id) state.company.id = metaCompanyId;

  let { data: profile } = await supabase.from('profiles').select('full_name, role, company_id').eq('id', cloudUser.id).maybeSingle();

  if (profile) {
    if (profile.company_id) state.company.id = profile.company_id;
    // если в профиле нет company, но есть в metadata invite — привязываем
    if (!profile.company_id && metaCompanyId) {
      await supabase.from('profiles').update({ company_id: metaCompanyId, role: profile.role || 'member' }).eq('id', cloudUser.id);
      state.company.id = metaCompanyId;
      profile.company_id = metaCompanyId;
    }
    const name = profile.full_name || cloudUser.email;
    const role = profile.role || 'member';
    const existing = state.users.find(u => u.id === cloudUser.id);
    if (!existing) state.users.push({ id: cloudUser.id, name, email: cloudUser.email, role });
    else { existing.name = name; existing.email = cloudUser.email; existing.role = role; }
  } else {
    // Новый профиль: owner только если у компании ещё нет пользователей, иначе member
    let role = 'member';
    const companyId = state.company.id || metaCompanyId;
    if (companyId) {
      const { count } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('company_id', companyId);
      if (!count || count === 0) role = 'owner';
    } else {
      role = 'owner'; // первый пользователь без компании — создаст компанию
    }
    const { data: created } = await supabase.from('profiles').insert({
      id: cloudUser.id,
      email: cloudUser.email,
      full_name: cloudUser.user_metadata?.full_name || splitEmail(cloudUser.email),
      company_id: companyId,
      role
    }).select().maybeSingle();
    if (created && created.company_id) state.company.id = created.company_id;
    state.users.push({
      id: cloudUser.id,
      name: cloudUser.user_metadata?.full_name || splitEmail(cloudUser.email),
      email: cloudUser.email,
      role
    });
  }

  await ensureCompany();
  // ensureCompany не должен менять роль на owner
  await loadCompanyUsers();
  const loaded = await loadFromCloud();
  if (!loaded && state.projects && state.projects.length) {
    // сидим данные только для owner
    const me = state.users.find(u => u.id === cloudUser.id);
    if (me && me.role === 'owner') await persistProject(state.projects[0]);
  }
  hideAuth();
  render();
}

function splitEmail(email) {
  return (email || '').split('@')[0] || 'Пользователь';
}

async function initApp() {
  console.log('[YouGile] initApp start');
  try {
    supabase = typeof getSupabase === 'function' ? getSupabase() : null;
    isCloudMode = !!(typeof USE_SUPABASE !== 'undefined' && USE_SUPABASE && supabase);
  } catch (e) {
    console.error('[YouGile] init error', e);
    isCloudMode = false;
  }

  console.log('[YouGile] isCloudMode =', isCloudMode);

  if (!isCloudMode) {
    if (typeof USE_SUPABASE !== 'undefined' && USE_SUPABASE) {
      // облако запрошено, но клиент не создался — показываем auth с ошибкой
      showAuth();
      setAuthError('Не удалось подключить Supabase. Проверьте интернет и что открыто через http://localhost (не file://).');
    } else {
      // локальный режим
      hideAuth();
      render();
      console.log('[YouGile] Локальный режим');
    }
    return;
  }

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) console.warn('[YouGile] getSession error', error);

  if (session) {
    cloudUser = session.user;
    await onCloudReady();
  } else {
    showAuth();
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    console.log('[YouGile] auth event', event);
    if (event === 'SIGNED_IN' && session) {
      cloudUser = session.user;
      hideAuth();
      await onCloudReady();
    } else if (event === 'SIGNED_OUT') {
      cloudUser = null;
      showAuth();
    }
  });
}

function showAuth() {
  console.log('[YouGile] showAuth');
  const overlay = document.getElementById('authOverlay');
  const appEl = document.getElementById('app');
  if (overlay) overlay.classList.add('visible');
  if (appEl) appEl.style.display = 'none';
  updateAuthUI();
}

function hideAuth() {
  const overlay = document.getElementById('authOverlay');
  const appEl = document.getElementById('app');
  if (overlay) overlay.classList.remove('visible');
  if (appEl) appEl.style.display = 'flex';
}

function setAuthError(msg) {
  const el = document.getElementById('authError');
  if (!el) return;
  if (msg) {
    el.textContent = msg;
    el.classList.add('visible');
  } else {
    el.classList.remove('visible');
  }
}

function updateAuthUI() {
  const isReg = authMode === 'register';
  const title = document.getElementById('authTitle');
  const sub = document.getElementById('authSub');
  const submit = document.getElementById('authSubmit');
  const switchText = document.getElementById('authSwitchText');
  const switchBtn = document.getElementById('authSwitchBtn');
  const nameField = document.getElementById('authNameField');
  if (title) title.textContent = isReg ? 'Регистрация' : 'Вход';
  if (sub) sub.textContent = isReg ? 'Создайте аккаунт для команды' : 'Войдите, чтобы синхронизировать данные команды';
  if (submit) submit.textContent = isReg ? 'Зарегистрироваться' : 'Войти';
  if (switchText) switchText.textContent = isReg ? 'Уже есть аккаунт?' : 'Нет аккаунта?';
  if (switchBtn) switchBtn.textContent = isReg ? 'Войти' : 'Зарегистрироваться';
  if (nameField) nameField.style.display = isReg ? 'block' : 'none';
  setAuthError(null);
}

function setupAuthHandlers() {
  const switchBtn = document.getElementById('authSwitchBtn');
  const submitBtn = document.getElementById('authSubmit');
  const passInput = document.getElementById('authPassword');
  const overlay = document.getElementById('authOverlay');

  console.log('[YouGile] setupAuthHandlers', {
    switchBtn: !!switchBtn,
    submitBtn: !!submitBtn,
    passInput: !!passInput
  });

  if (switchBtn) {
    switchBtn.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();
      authMode = authMode === 'login' ? 'register' : 'login';
      console.log('[YouGile] switch auth mode ->', authMode);
      updateAuthUI();
    };
  }

  if (submitBtn) {
    submitBtn.onclick = function (e) {
      e.preventDefault();
      handleAuthSubmit();
    };
  }

  if (passInput) {
    passInput.onkeydown = function (e) {
      if (e.key === 'Enter') handleAuthSubmit();
    };
  }

  if (overlay) {
    overlay.addEventListener('click', function (e) {
      const t = e.target;
      if (t && t.id === 'authSwitchBtn') {
        e.preventDefault();
        authMode = authMode === 'login' ? 'register' : 'login';
        console.log('[YouGile] switch (delegation) ->', authMode);
        updateAuthUI();
      }
      if (t && t.id === 'authSubmit') {
        e.preventDefault();
        handleAuthSubmit();
      }
    });
  }
}

async function handleAuthSubmit() {
  console.log('[YouGile] auth submit, mode=', authMode);
  if (!supabase) {
    supabase = typeof getSupabase === 'function' ? getSupabase() : null;
  }
  if (!supabase) {
    setAuthError('Supabase не подключён. Проверьте интернет и консоль.');
    return;
  }
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const name = document.getElementById('authName').value.trim();
  if (!email || !password) { setAuthError('Укажите email и пароль'); return; }
  if (authMode === 'register' && !name) { setAuthError('Укажите имя'); return; }

  try {
    if (authMode === 'register') {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name || splitEmail(email) } } });
      if (error) { setAuthError(error.message || 'Ошибка регистрации'); return; }
      if (data.session) {
        // сразу вошли (email-подтверждение отключено)
        cloudUser = data.user;
        await onCloudReady();
      } else {
        // требуется подтверждение почты — не пытаемся грузить данные
        setAuthError('Проверьте почту — письмо с подтверждением отправлено на ' + email);
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setAuthError(error.message || 'Неверный email или пароль'); return; }
      cloudUser = data.user;
      hideAuth();
      await onCloudReady();
    }
  } catch (e) {
    console.error('[YouGile] auth exception', e);
    setAuthError('Сетевая ошибка. Проверьте соединение и консоль.');
  }
}

window.__authSwitch = function () { authMode = authMode === 'login' ? 'register' : 'login'; updateAuthUI(); };
window.__authSubmit = handleAuthSubmit;


// Board switch / add / rename
const boardSelectEl = document.getElementById('boardSelect');
if (boardSelectEl) {
  boardSelectEl.addEventListener('change', () => {
    state.currentBoardId = boardSelectEl.value;
    saveState();
    render();
  });
}

const btnAddBoard = document.getElementById('btnAddBoard');
if (btnAddBoard) {
  btnAddBoard.addEventListener('click', async () => {
    const name = prompt('Название новой доски:');
    if (!name || !name.trim()) return;
    const project = getCurrentProject();
    if (!project.id) return;
    const board = {
      id: uid(),
      name: name.trim(),
      columns: [
        { id: uid(), title: 'Нужно сделать', tasks: [] },
        { id: uid(), title: 'В работе', tasks: [] },
        { id: uid(), title: 'Готово', tasks: [] }
      ]
    };
    project.boards.push(board);
    state.currentBoardId = board.id;
    saveState();
    render();
    await persistBoard(board, project.id);
  });
}

async function renameCurrentBoard() {
  const board = getCurrentBoard();
  if (!board?.id) return;
  const name = prompt('Название доски:', board.name);
  if (!name || !name.trim()) return;
  board.name = name.trim();
  saveState();
  render();
  await persistBoard(board, getCurrentProject().id);
}

async function deleteCurrentBoard() {
  const project = getCurrentProject();
  const board = getCurrentBoard();
  if (!project || !board?.id) return;
  if ((project.boards || []).length <= 1) {
    alert('Нельзя удалить единственную доску проекта');
    return;
  }
  if (!confirm('Удалить доску «' + board.name + '» и все задачи на ней?')) return;
  project.boards = project.boards.filter(b => b.id !== board.id);
  state.currentBoardId = project.boards[0].id;
  saveState();
  render();
  if (isCloudMode && supabase) {
    try {
      await supabase.from('boards').delete().eq('id', board.id);
    } catch (e) { console.warn(e); }
  }
}

const btnBoardMenu = document.getElementById('btnBoardMenu');
const boardMenu = document.getElementById('boardMenu');
if (btnBoardMenu && boardMenu) {
  btnBoardMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    boardMenu.style.display = boardMenu.style.display === 'none' ? 'block' : 'none';
  });
  document.addEventListener('click', () => { boardMenu.style.display = 'none'; });
  boardMenu.addEventListener('click', (e) => e.stopPropagation());
}
const menuRenameBoard = document.getElementById('menuRenameBoard');
if (menuRenameBoard) menuRenameBoard.addEventListener('click', async () => {
  if (boardMenu) boardMenu.style.display = 'none';
  await renameCurrentBoard();
});
const menuDeleteBoard = document.getElementById('menuDeleteBoard');
if (menuDeleteBoard) menuDeleteBoard.addEventListener('click', async () => {
  if (boardMenu) boardMenu.style.display = 'none';
  await deleteCurrentBoard();
});

// legacy id support
const btnRenameBoard = document.getElementById('btnRenameBoard');
if (btnRenameBoard) btnRenameBoard.addEventListener('click', () => renameCurrentBoard());

const filterAssignee = document.getElementById('filterAssignee');
if (filterAssignee) {
  filterAssignee.addEventListener('change', () => {
    boardFilter.assigneeId = filterAssignee.value || '';
    renderBoard();
  });
}
const filterPriority = document.getElementById('filterPriority');
if (filterPriority) {
  filterPriority.addEventListener('change', () => {
    boardFilter.priority = filterPriority.value || '';
    renderBoard();
  });
}
const btnClearFilters = document.getElementById('btnClearFilters');
if (btnClearFilters) {
  btnClearFilters.addEventListener('click', () => {
    boardFilter = { assigneeId: '', priority: '' };
    searchQuery = '';
    const si = document.getElementById('searchInput');
    if (si) si.value = '';
    renderFilters();
    renderBoard();
  });
}




const chatReplyCancel = document.getElementById('chatReplyCancel');
if (chatReplyCancel) {
  chatReplyCancel.addEventListener('click', () => {
    clearChatComposer();
    const input = document.getElementById('chatMessage');
    if (input) input.value = '';
  });
}
const chatFileInput = document.getElementById('chatFileInput');
if (chatFileInput) {
  chatFileInput.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      alert('Файл в чате до 3 МБ');
      e.target.value = '';
      return;
    }
    const data = await readFileAsDataURL(file);
    chatPendingFile = { name: file.name, size: file.size, type: file.type, data };
    const prev = document.getElementById('chatFilePreview');
    if (prev) {
      prev.style.display = 'block';
      prev.textContent = file.name;
    }
  });
}

const btnOpenTaskChat = document.getElementById('btnOpenTaskChat');
if (btnOpenTaskChat) {
  btnOpenTaskChat.addEventListener('click', (e) => {
    e.preventDefault();
    openTaskChatPanel();
  });
}
const btnCloseChatPanel = document.getElementById('btnCloseChatPanel');
if (btnCloseChatPanel) {
  btnCloseChatPanel.addEventListener('click', closeTaskChatPanel);
}
const chatPanelOverlay = document.getElementById('chatPanelOverlay');
if (chatPanelOverlay) {
  chatPanelOverlay.addEventListener('click', (e) => {
    if (e.target === chatPanelOverlay) closeTaskChatPanel();
  });
}

setupAuthHandlers();
initApp();
})();