// ----- State & Config -----
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

let data = loadData();

// ----- UI Elements Cache -----
const elements = {
  projectError: document.querySelector("#projectError"),
  projectsEl: document.querySelector("#projects"),
  todosEl: document.querySelector("#todos"),
  listTitleEl: document.querySelector("#listTitle"),
  netBadge: document.querySelector("#netBadge"),
  offlineHint: document.querySelector("#offlineHint"),
  menuBtn: document.querySelector("#menuBtn"),
  sidebar: document.querySelector("#sidebar"),
  overlay: document.querySelector("#overlay"),
  newTodoBtn: document.querySelector("#newTodoBtn"),
  todoModal: document.querySelector("#todoModal"),
  todoForm: document.querySelector("#todoForm"),
  todoTitle: document.querySelector("#todoTitle"),
  todoDue: document.querySelector("#todoDue"),
  todoProject: document.querySelector("#todoProject"),
  addProjectBtn: document.querySelector("#addProjectBtn"),
  projectModal: document.querySelector("#projectModal"),
  projectForm: document.querySelector("#projectForm"),
  projectName: document.querySelector("#projectName"),
};

// ----- Data Management -----
function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(defaultData);
  try { return JSON.parse(raw); } catch { return structuredClone(defaultData); }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

// ----- Network & Read-Only Logic -----
function isOnline() { return navigator.onLine; }

/**
 * Instantly updates the UI when network status changes
 * Disables all mutation triggers (buttons, checkboxes, trash cans)
 */
function applyNetworkUI() {
  const online = isOnline();
  const { netBadge, offlineHint, newTodoBtn, addProjectBtn, todoForm, projectForm, menuBtn } = elements;

  // 1. Update Global Indicators
  netBadge.textContent = online ? "Online" : "Offline";
  netBadge.className = `badge ${online ? 'online' : 'offline'}`;
  offlineHint.hidden = online;

  // 2. Disable Navigation
  menuBtn.disabled = !online;
  if (!online) closeDrawer();

  // 3. Update Main Action Buttons
  newTodoBtn.disabled = !online;
  addProjectBtn.disabled = !online;

  // 4. Disable form fields if a modal is currently open
  [...todoForm.querySelectorAll("input, select, button")].forEach(el => el.disabled = !online);
  [...projectForm.querySelectorAll("input, button")].forEach(el => el.disabled = !online);
  
  // 5. Toggle all existing trash cans and checkboxes in the DOM
  document.querySelectorAll(".project-del-btn, .del-btn, .todo-checkbox").forEach(el => {
    el.disabled = !online;
  });
}

window.addEventListener("online", applyNetworkUI);
window.addEventListener("offline", applyNetworkUI);

// ----- Rendering Logic -----
function render() {
  renderProjects();
  renderTodos();
  renderTodoProjectSelect();
  
  const p = data.projects.find(x => x.id === data.activeProjectId);
  elements.listTitleEl.textContent = p ? p.name : "Inbox";
  
  applyNetworkUI(); // Sync network states after rendering
}

function renderProjects() {
  const online = isOnline();
  elements.projectsEl.innerHTML = "";
  
  data.projects.forEach(p => {
    const container = document.createElement("div");
    container.className = "project-item";
    
    // Project Selection Button
    const btn = document.createElement("button");
    btn.className = "project";
    btn.setAttribute("aria-current", p.id === data.activeProjectId ? "page" : "false");
    btn.innerHTML = `<span>${escapeHtml(p.name)}</span><small>${countTodos(p.id)}</small>`;
    btn.onclick = () => {
      data.activeProjectId = p.id;
      saveData();
      render();
      closeDrawer();
    };
    container.appendChild(btn);

    // Trash Can Button
    const delBtn = document.createElement("button");
    delBtn.className = "project-del-btn";
    delBtn.innerHTML = "🗑️";
    delBtn.disabled = !online;

    if (p.id === "inbox") {
      // Invisible spacer for Inbox to maintain alignment
      delBtn.style.visibility = "hidden";
      delBtn.style.pointerEvents = "none";
    } else {
      delBtn.title = online ? "Delete list" : "Offline: Cannot delete";
      delBtn.onclick = (e) => {
        e.stopPropagation();
        if (isOnline()) deleteProject(p.id, p.name);
      };
    }
    
    container.appendChild(delBtn);
    elements.projectsEl.appendChild(container);
  });
}

function renderTodos() {
  const online = isOnline(); // Ensure variable is defined for the template
  elements.todosEl.innerHTML = "";
  const list = data.todos.filter(t => t.projectId === data.activeProjectId);

  if (list.length === 0) {
    elements.todosEl.innerHTML = `
      <li class="todo">
        <div class="todo-title">
          <strong>No entities</strong>
          <span>Press “New todo” to add todo entities</span>
        </div>
      </li>`;
    return;
  }

  list.forEach(t => {
    const li = document.createElement("li");
    li.className = "todo";
    li.innerHTML = `
      <input type="checkbox" class="todo-checkbox" ${t.done ? "checked" : ""} ${!online ? "disabled" : ""}>
      <div class="todo-title">
        <strong>${escapeHtml(t.title)}</strong>
        <span>${t.due ? formatDate(t.due) : "No due date"}</span>
      </div>
      <div class="todo-actions">
        <span class="pill">${projectNameById(t.projectId)}</span>
        <button class="icon-btn del-btn" ${!online ? "disabled" : ""}>🗑️</button>
      </div>`;

    // Interaction Handlers
    li.querySelector(".todo-checkbox").onchange = (e) => {
      if (!isOnline()) return;
      t.done = e.target.checked;
      saveData();
    };

    li.querySelector(".del-btn").onclick = () => {
      if (!isOnline()) return;
      data.todos = data.todos.filter(x => x.id !== t.id);
      saveData();
      render();
    };

    elements.todosEl.appendChild(li);
  });
}

function renderTodoProjectSelect() {
  elements.todoProject.innerHTML = data.projects.map(p => 
    `<option value="${p.id}">${escapeHtml(p.name)}</option>`
  ).join("");
  elements.todoProject.value = data.activeProjectId;
}

// ----- Project Deletion -----
function deleteProject(id, name) {
  if (!isOnline()) return;
  if (!confirm(`Do you want to remove "${name}" and all its todos?`)) return;

  data.todos = data.todos.filter(t => t.projectId !== id);
  data.projects = data.projects.filter(p => p.id !== id);
  
  if (data.activeProjectId === id) data.activeProjectId = "inbox";

  saveData();
  render();
}

// ----- Modal & Drawer Logic -----
function openTodoModal() {
  if (!isOnline()) return;
  renderTodoProjectSelect();
  elements.todoForm.reset();
  elements.todoModal.showModal();
}

function openProjectModal() {
  if (!isOnline()) return;
  elements.projectForm.reset();
  elements.projectError.hidden = true;
  elements.projectName.style.borderColor = "";
  elements.projectModal.showModal();
}

function closeProject() {
  elements.projectModal.close();
  elements.projectError.hidden = true;
  elements.projectName.style.borderColor = "";
}

function openDrawer() {
  elements.sidebar.classList.add("open");
  elements.overlay.hidden = false;
}

function closeDrawer() {
  elements.sidebar.classList.remove("open");
  elements.overlay.hidden = true;
}

// ----- Event Listeners -----
elements.newTodoBtn.onclick = openTodoModal;
elements.addProjectBtn.onclick = openProjectModal;
document.querySelector("#closeModal").onclick = () => elements.todoModal.close();
document.querySelector("#cancelTodo").onclick = () => elements.todoModal.close();
document.querySelector("#closeProjectModal").onclick = closeProject;
document.querySelector("#cancelProject").onclick = closeProject;

// Form Submit: New Todo
elements.todoForm.onsubmit = (e) => {
  e.preventDefault();
  data.todos.unshift({
    id: crypto.randomUUID(),
    projectId: elements.todoProject.value,
    title: elements.todoTitle.value.trim(),
    due: elements.todoDue.value,
    done: false
  });
  saveData();
  elements.todoModal.close();
  render();
};

// Form Submit: New Project (with duplicate check)
elements.projectForm.onsubmit = (e) => {
  e.preventDefault();
  const name = elements.projectName.value.trim();
  
  const nameExists = data.projects.some(p => p.name.toLowerCase() === name.toLowerCase());
  if (nameExists) {
    elements.projectError.textContent = `Name "${name}" is already used`;
    elements.projectError.hidden = false;
    elements.projectName.style.borderColor = "var(--danger)";
    return;
  }

  const id = "p-" + crypto.randomUUID().slice(0, 8);
  data.projects.push({ id, name });
  data.activeProjectId = id;
  saveData();
  closeProject();
  render();
};

// Clear error state while typing
elements.projectName.oninput = () => {
  elements.projectError.hidden = true;
  elements.projectName.style.borderColor = "";
};

// Mobile Hamburger Menu
elements.menuBtn.onclick = () => {
  if (window.innerWidth <= 860) openDrawer();
};
elements.overlay.onclick = closeDrawer;

// Auto-close drawer on window resize
window.onresize = () => {
  if (window.innerWidth > 860 && elements.sidebar.classList.contains("open")) closeDrawer();
};

// ----- Helpers -----
function countTodos(id) { return data.todos.filter(t => t.projectId === id).length; }
function projectNameById(id) { return data.projects.find(p => p.id === id)?.name || "Unknown"; }
function formatDate(iso) { return new Date(iso + "T00:00:00").toLocaleDateString("sv-SE", { year: "numeric", month: "short", day: "numeric" }); }
function escapeHtml(str) { return str.replace(/[&<>"']/g, m => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[m])); }

// SW Registration
if ("serviceWorker" in navigator) {
  window.onload = () => navigator.serviceWorker.register("./sw.js").catch(() => {});
}

// Initial Render
render();