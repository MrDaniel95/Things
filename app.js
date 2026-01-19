// ----- State -----
const STORAGE_KEY = "thingsish:v1";

const defaultData = {
  projects: [
    { id: "inbox", name: "Inbox" },
    { id: "proj-a", name: "Project A" },
    { id: "proj-b", name: "Project B" },
  ],
  todos: [
    { id: crypto.randomUUID(), projectId: "inbox", title: "Prepare presentation", due: "2026-01-20", done: false },
    { id: crypto.randomUUID(), projectId: "proj-a", title: "Review quarterly data", due: "", done: false },
  ],
  activeProjectId: "inbox",
};

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(defaultData);
  try { return JSON.parse(raw); } catch { return structuredClone(defaultData); }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

let data = loadData();

// ----- Elements -----
const projectsEl = document.querySelector("#projects");
const todosEl = document.querySelector("#todos");
const listTitleEl = document.querySelector("#listTitle");

const netBadge = document.querySelector("#netBadge");
const offlineHint = document.querySelector("#offlineHint");

const menuBtn = document.querySelector("#menuBtn");
const sidebar = document.querySelector("#sidebar");
const overlay = document.querySelector("#overlay");

const newTodoBtn = document.querySelector("#newTodoBtn");
const todoModal = document.querySelector("#todoModal");
const todoForm = document.querySelector("#todoForm");
const todoTitle = document.querySelector("#todoTitle");
const todoDue = document.querySelector("#todoDue");
const todoProject = document.querySelector("#todoProject");
const closeModal = document.querySelector("#closeModal");
const cancelTodo = document.querySelector("#cancelTodo");

const addProjectBtn = document.querySelector("#addProjectBtn");
const projectModal = document.querySelector("#projectModal");
const projectForm = document.querySelector("#projectForm");
const projectName = document.querySelector("#projectName");
const closeProjectModal = document.querySelector("#closeProjectModal");
const cancelProject = document.querySelector("#cancelProject");

// ----- Offline read-only -----
function isOnline() {
  return navigator.onLine;
}

function applyNetworkUI() {
  const online = isOnline();

  netBadge.textContent = online ? "Online" : "Offline";
  netBadge.style.background = online ? "#ecfdf5" : "#fff7ed";
  netBadge.style.borderColor = online ? "#bbf7d0" : "#fed7aa";
  netBadge.style.color = online ? "#166534" : "#9a3412";

  offlineHint.hidden = online;

  // Read-only when offline: disable all mutations
  newTodoBtn.disabled = !online;
  addProjectBtn.disabled = !online;

  // Disable form fields/buttons if modal is open
  [...todoForm.querySelectorAll("input, select, button")].forEach(el => el.disabled = !online);
  [...projectForm.querySelectorAll("input, button")].forEach(el => el.disabled = !online);
}

window.addEventListener("online", applyNetworkUI);
window.addEventListener("offline", applyNetworkUI);

// ----- Rendering -----
function renderProjects() {
  projectsEl.innerHTML = "";
  data.projects.forEach(p => {
    const btn = document.createElement("button");
    btn.className = "project";
    btn.type = "button";
    btn.setAttribute("aria-current", p.id === data.activeProjectId ? "page" : "false");
    btn.innerHTML = `
      <span>${escapeHtml(p.name)}</span>
      <small>${countTodos(p.id)}</small>
    `;
    btn.addEventListener("click", () => {
      data.activeProjectId = p.id;
      saveData();
      render();
      closeDrawer();
    });
    projectsEl.appendChild(btn);
  });
}

function renderTodos() {
  todosEl.innerHTML = "";
  const list = data.todos.filter(t => t.projectId === data.activeProjectId);

  if (list.length === 0) {
    const empty = document.createElement("li");
    empty.className = "todo";
    empty.innerHTML = `<div class="todo-title"><strong>No todos yet</strong><span>Press “New todo” to add</span></div>`;
    todosEl.appendChild(empty);
    return;
  }

  list.forEach(t => {
    const li = document.createElement("li");
    li.className = "todo";

    const dueText = t.due ? formatDate(t.due) : "No due date";

    li.innerHTML = `
      <input type="checkbox" ${t.done ? "checked" : ""} aria-label="Markera klar" />
      <div class="todo-title">
        <strong>${escapeHtml(t.title)}</strong>
        <span>${dueText}</span>
      </div>
      <div class="todo-actions">
        <span class="pill">${projectNameById(t.projectId)}</span>
        <button class="icon-btn" type="button" title="Delete" aria-label="Delete">🗑️</button>
      </div>
    `;

    const checkbox = li.querySelector('input[type="checkbox"]');
    const delBtn = li.querySelector("button.icon-btn");

    // offline = read-only
    checkbox.disabled = !isOnline();
    delBtn.disabled = !isOnline();

    checkbox.addEventListener("change", () => {
      if (!isOnline()) return;
      t.done = checkbox.checked;
      saveData();
    });

    delBtn.addEventListener("click", () => {
      if (!isOnline()) return;
      data.todos = data.todos.filter(x => x.id !== t.id);
      saveData();
      render();
    });

    todosEl.appendChild(li);
  });
}

function renderTitle() {
  const p = data.projects.find(x => x.id === data.activeProjectId);
  listTitleEl.textContent = p ? p.name : "Inbox";
}

function renderTodoProjectSelect() {
  todoProject.innerHTML = "";
  data.projects.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    todoProject.appendChild(opt);
  });
  todoProject.value = data.activeProjectId;
}

function render() {
  renderProjects();
  renderTitle();
  renderTodos();
  renderTodoProjectSelect();
  applyNetworkUI();
}

function countTodos(projectId) {
  return data.todos.filter(t => t.projectId === projectId).length;
}

function projectNameById(id) {
  return (data.projects.find(p => p.id === id)?.name) ?? "Unknown";
}

// ----- Modals -----
function openTodoModal() {
  if (!isOnline()) return;
  renderTodoProjectSelect();
  todoTitle.value = "";
  todoDue.value = "";
  todoModal.showModal();
  todoTitle.focus();
  applyNetworkUI();
}

function closeTodoModal() {
  if (todoModal.open) todoModal.close();
}

newTodoBtn.addEventListener("click", openTodoModal);
closeModal.addEventListener("click", closeTodoModal);
cancelTodo.addEventListener("click", closeTodoModal);

todoForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!isOnline()) return;

  const title = todoTitle.value.trim();
  if (!title) return;

  data.todos.unshift({
    id: crypto.randomUUID(),
    projectId: todoProject.value,
    title,
    due: todoDue.value || "",
    done: false,
  });

  saveData();
  closeTodoModal();
  render();
});

// Project modal
function openProjectModal() {
  if (!isOnline()) return;
  projectName.value = "";
  projectModal.showModal();
  projectName.focus();
  applyNetworkUI();
}
function closeProject() {
  if (projectModal.open) projectModal.close();
}

addProjectBtn.addEventListener("click", openProjectModal);
closeProjectModal.addEventListener("click", closeProject);
cancelProject.addEventListener("click", closeProject);

projectForm.addEventListener("submit", (e) => {
  e.preventDefault();
  if (!isOnline()) return;

  const name = projectName.value.trim();
  if (!name) return;

  const id = "p-" + crypto.randomUUID().slice(0, 8);
  data.projects.push({ id, name });
  data.activeProjectId = id;
  saveData();
  closeProject();
  render();
});

// ----- Mobile drawer -----
function openDrawer() {
  sidebar.classList.add("open");
  overlay.hidden = false;
  menuBtn.setAttribute("aria-expanded", "true");
}
function closeDrawer() {
  sidebar.classList.remove("open");
  overlay.hidden = true;
  menuBtn.setAttribute("aria-expanded", "false");
}

menuBtn.addEventListener("click", () => {
  const open = sidebar.classList.contains("open");
  open ? closeDrawer() : openDrawer();
});
overlay.addEventListener("click", closeDrawer);

// ----- Helpers -----
function formatDate(iso) {
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("sv-SE", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (m) => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[m]));
}

// ----- PWA: register service worker -----
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try { await navigator.serviceWorker.register("./sw.js"); } catch {}
  });
}

// Init
render();