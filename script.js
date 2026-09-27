"use strict";

const STORAGE_KEY = "notely_v1";

let state = {
  notes: [],
  filter: "all",
  sort: "recent",
  search: "",
  editingId: null,
  editorType: "note",
  editorColor: "default",
  editorPinned: false,
  dark: true
};

const $ = id => document.getElementById(id);

const notesGrid = $("notesGrid");
const emptyState = $("emptyState");
const emptyTitle = $("emptyTitle");
const emptyText = $("emptyText");
const pageTitle = $("pageTitle");
const dateLabel = $("dateLabel");

function uid(){
  return Date.now().toString(36) + Math.random().toString(36).slice(2,8);
}

function saveState(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    notes: state.notes,
    dark: state.dark
  }));
}

function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      const data = JSON.parse(raw);
      state.notes = Array.isArray(data.notes) ? data.notes : [];
      state.dark = data.dark !== false;
    }
  }catch(e){
    state.notes = [];
  }

  document.body.classList.toggle("light", !state.dark);
}

function escapeHTML(value=""){
  return value
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function formatDate(timestamp){
  const d = new Date(timestamp);
  const now = new Date();

  if(d.toDateString() === now.toDateString()){
    return d.toLocaleTimeString([], {
      hour:"numeric",
      minute:"2-digit"
    });
  }

  return d.toLocaleDateString([], {
    day:"numeric",
    month:"short"
  });
}

function updateDate(){
  dateLabel.textContent = new Date().toLocaleDateString([], {
    weekday:"long",
    day:"numeric",
    month:"long"
  }).toUpperCase();
}

function getFiltered(){
  let result = [...state.notes];

  if(state.filter === "notes"){
    result = result.filter(n => n.type === "note" && !n.archived && !n.trashed);
  }

  if(state.filter === "tasks"){
    result = result.filter(n => n.type === "task" && !n.archived && !n.trashed);
  }

  if(state.filter === "pinned"){
    result = result.filter(n => n.pinned && !n.archived && !n.trashed);
  }

  if(state.filter === "archive"){
    result = result.filter(n => n.archived && !n.trashed);
  }

  if(state.filter === "trash"){
    result = result.filter(n => n.trashed);
  }

  if(state.filter === "all"){
    result = result.filter(n => !n.archived && !n.trashed);
  }

  if(state.search.trim()){
    const q = state.search.toLowerCase();
    result = result.filter(n => {
      const taskText = n.items
        ? n.items.map(x => x.text).join(" ")
        : "";

      return (
        (n.title || "").toLowerCase().includes(q) ||
        (n.body || "").toLowerCase().includes(q) ||
        taskText.toLowerCase().includes(q)
      );
    });
  }

  switch(state.sort){
    case "created":
      result.sort((a,b) => b.createdAt - a.createdAt);
      break;
    case "az":
      result.sort((a,b) => (a.title || "").localeCompare(b.title || ""));
      break;
    case "za":
      result.sort((a,b) => (b.title || "").localeCompare(a.title || ""));
      break;
    default:
      result.sort((a,b) => b.updatedAt - a.updatedAt);
  }

  result.sort((a,b) => {
    if(a.pinned && !b.pinned) return -1;
    if(!a.pinned && b.pinned) return 1;
    return 0;
  });

  return result;
}

function updateHeading(){
  const titles = {
    all:"Everything in one place.",
    notes:"Your notes.",
    tasks:"Your checklists.",
    pinned:"Pinned for later.",
    archive:"Archived quietly.",
    trash:"Recently deleted."
  };

  pageTitle.textContent = titles[state.filter] || titles.all;

  document.querySelectorAll(".tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.filter === state.filter);
  });
}

function render(){
  updateHeading();

  const result = getFiltered();
  notesGrid.innerHTML = "";

  if(!result.length){
    notesGrid.classList.add("hidden");
    emptyState.classList.remove("hidden");

    if(state.search){
      emptyTitle.textContent = "No matches found";
      emptyText.textContent = "Try a different search phrase.";
      $("emptyCreate").classList.add("hidden");
    }else{
      $("emptyCreate").classList.remove("hidden");

      const emptyMap = {
        all:["Nothing here yet","Create your first note to get started."],
        notes:["No notes yet","Your written notes will appear here."],
        tasks:["No checklists yet","Create a checklist to organize your tasks."],
        pinned:["Nothing pinned","Pin important notes so they stay at the top."],
        archive:["Archive is empty","Archived notes will appear here."],
        trash:["Trash is empty","Deleted notes will appear here."]
      };

      emptyTitle.textContent = emptyMap[state.filter][0];
      emptyText.textContent = emptyMap[state.filter][1];
    }
  }else{
    emptyState.classList.add("hidden");
    notesGrid.classList.remove("hidden");

    result.forEach(note => {
      notesGrid.appendChild(createCard(note));
    });
  }
}

function createCard(note){
  const card = document.createElement("article");
  card.className = `note-card ${note.color || "default"} ${note.pinned ? "pinned" : ""}`;

  if(note.type === "task"){
    const items = note.items || [];
    const completed = items.filter(i => i.done).length;
    const percent = items.length ? Math.round(completed / items.length * 100) : 0;

    const visible = items.slice(0,4).map(item => `
      <div class="task-line ${item.done ? "done" : ""}">
        <span class="task-check ${item.done ? "checked" : ""}"></span>
        <span>${escapeHTML(item.text || "Untitled task")}</span>
      </div>
    `).join("");

    card.innerHTML = `
      ${note.pinned ? `<div class="pin-indicator">●</div>` : ""}
      <div class="card-type">Checklist · ${completed}/${items.length}</div>
      <h3>${escapeHTML(note.title || "Untitled checklist")}</h3>
      <div class="task-preview">${visible || `<div class="card-text">No items yet.</div>`}</div>
      <div class="progress"><span style="width:${percent}%"></span></div>
      <div class="card-footer">
        <span>${formatDate(note.updatedAt)}</span>
        <div class="card-actions">
          <button data-action="edit" title="Edit">↗</button>
          ${note.trashed
            ? `<button data-action="restore" title="Restore">↶</button>
               <button data-action="delete" title="Delete forever">×</button>`
            : `<button data-action="archive" title="Archive">□</button>
               <button data-action="delete" title="Delete">×</button>`}
        </div>
      </div>
    `;
  }else{
    card.innerHTML = `
      ${note.pinned ? `<div class="pin-indicator">●</div>` : ""}
      <div class="card-type">Note</div>
      <h3>${escapeHTML(note.title || "Untitled note")}</h3>
      <div class="card-text">${escapeHTML(note.body || "Empty note")}</div>
      <div class="card-footer">
        <span>${formatDate(note.updatedAt)}</span>
        <div class="card-actions">
          <button data-action="edit" title="Edit">↗</button>
          ${note.trashed
            ? `<button data-action="restore" title="Restore">↶</button>
               <button data-action="delete" title="Delete forever">×</button>`
            : `<button data-action="archive" title="Archive">□</button>
               <button data-action="delete" title="Delete">×</button>`}
        </div>
      </div>
    `;
  }

  card.addEventListener("click", e => {
    const action = e.target.closest("[data-action]")?.dataset.action;

    if(action){
      handleCardAction(action,note.id);
      return;
    }

    if(!note.trashed) openEditor(note.id);
  });

  return card;
}

function handleCardAction(action,id){
  const note = state.notes.find(n => n.id === id);
  if(!note) return;

  if(action === "edit"){
    openEditor(id);
    return;
  }

  if(action === "archive"){
    note.archived = !note.archived;
    note.updatedAt = Date.now();
    saveState();
    render();
    toast(note.archived ? "Moved to archive" : "Restored from archive");
    return;
  }

  if(action === "restore"){
    note.trashed = false;
    note.archived = false;
    note.updatedAt = Date.now();
    saveState();
    render();
    toast("Restored");
    return;
  }

  if(action === "delete"){
    if(note.trashed){
      state.notes = state.notes.filter(n => n.id !== id);
      saveState();
      render();
      toast("Deleted permanently");
    }else{
      note.trashed = true;
      note.updatedAt = Date.now();
      saveState();
      render();
      toast("Moved to trash");
    }
  }
}

function resetEditor(){
  state.editingId = null;
  state.editorType = "note";
  state.editorColor = "default";
  state.editorPinned = false;

  $("editorTitle").textContent = "New note";
  $("noteTitle").value = "";
  $("noteBody").value = "";

  $("checklistEditor").classList.add("hidden");
  $("noteBody").classList.remove("hidden");
  $("checkItems").innerHTML = "";

  setColor("default");
  updatePinButton();
}

function openEditor(id=null,type="note"){
  closeCreateMenu();

  if(id){
    const note = state.notes.find(n => n.id === id);
    if(!note) return;

    state.editingId = id;
    state.editorType = note.type;
    state.editorColor = note.color || "default";
    state.editorPinned = !!note.pinned;

    $("editorTitle").textContent = note.type === "task"
      ? "Edit checklist"
      : "Edit note";

    $("noteTitle").value = note.title || "";

    if(note.type === "note"){
      $("noteBody").classList.remove("hidden");
      $("checklistEditor").classList.add("hidden");
      $("noteBody").value = note.body || "";
    }else{
      $("noteBody").classList.add("hidden");
      $("checklistEditor").classList.remove("hidden");
      renderCheckItems(note.items || []);
    }
  }else{
    resetEditor();

    state.editorType = type;

    $("editorTitle").textContent =
      type === "task" ? "New checklist" : "New note";

    if(type === "task"){
      $("noteBody").classList.add("hidden");
      $("checklistEditor").classList.remove("hidden");
      renderCheckItems([{id:uid(),text:"",done:false}]);
    }
  }

  setColor(state.editorColor);
  updatePinButton();

  $("editor").classList.remove("hidden");
  document.body.style.overflow = "hidden";

  setTimeout(() => {
    $("noteTitle").focus();
  },100);
}

function closeEditor(){
  $("editor").classList.add("hidden");
  document.body.style.overflow = "";
  state.editingId = null;
}

function saveNote(){
  const title = $("noteTitle").value.trim();

  if(state.editorType === "note"){
    const body = $("noteBody").value.trim();

    if(!title && !body){
      toast("Write something first");
      return;
    }

    if(state.editingId){
      const note = state.notes.find(n => n.id === state.editingId);
      note.title = title || "Untitled note";
      note.body = body;
      note.color = state.editorColor;
      note.pinned = state.editorPinned;
      note.updatedAt = Date.now();
    }else{
      state.notes.unshift({
        id:uid(),
        type:"note",
        title:title || "Untitled note",
        body,
        color:state.editorColor,
        pinned:state.editorPinned,
        archived:false,
        trashed:false,
        createdAt:Date.now(),
        updatedAt:Date.now()
      });
    }
  }else{
    const items = [...document.querySelectorAll(".check-row")].map(row => ({
      id:row.dataset.id,
      text:row.querySelector("input").value.trim(),
      done:row.querySelector(".check-toggle").classList.contains("checked")
    })).filter(i => i.text);

    if(!title && !items.length){
      toast("Add a task first");
      return;
    }

    if(state.editingId){
      const note = state.notes.find(n => n.id === state.editingId);
      note.title = title || "Untitled checklist";
      note.items = items;
      note.color = state.editorColor;
      note.pinned = state.editorPinned;
      note.updatedAt = Date.now();
    }else{
      state.notes.unshift({
        id:uid(),
        type:"task",
        title:title || "Untitled checklist",
        items,
        color:state.editorColor,
        pinned:state.editorPinned,
        archived:false,
        trashed:false,
        createdAt:Date.now(),
        updatedAt:Date.now()
      });
    }
  }

  saveState();
  closeEditor();
  render();
  toast("Saved");
}

function renderCheckItems(items){
  $("checkItems").innerHTML = "";

  items.forEach(item => {
    const row = document.createElement("div");
    row.className = "check-row";
    row.dataset.id = item.id || uid();

    row.innerHTML = `
      <button class="check-toggle ${item.done ? "checked" : ""}" type="button">
        ${item.done ? "✓" : ""}
      </button>
      <input type="text" placeholder="Task..." value="${escapeHTML(item.text || "")}">
      <button class="remove-check" type="button">×</button>
    `;

    row.querySelector(".check-toggle").addEventListener("click", e => {
      const button = e.currentTarget;
      button.classList.toggle("checked");
      button.textContent = button.classList.contains("checked") ? "✓" : "";
    });

    row.querySelector(".remove-check").addEventListener("click", () => {
      row.remove();

      if(!$("checkItems").children.length){
        addCheckItem();
      }
    });

    $("checkItems").appendChild(row);
  });
}

function addCheckItem(){
  const row = document.createElement("div");
  row.className = "check-row";
  row.dataset.id = uid();

  row.innerHTML = `
    <button class="check-toggle" type="button"></button>
    <input type="text" placeholder="Task..." autofocus>
    <button class="remove-check" type="button">×</button>
  `;

  row.querySelector(".check-toggle").addEventListener("click", e => {
    const button = e.currentTarget;
    button.classList.toggle("checked");
    button.textContent = button.classList.contains("checked") ? "✓" : "";
  });

  row.querySelector(".remove-check").addEventListener("click", () => {
    row.remove();
  });

  $("checkItems").appendChild(row);

  row.querySelector("input").focus();
}

function setColor(color){
  state.editorColor = color;

  const colorMap = {
    default:"#343840",
    yellow:"#d9bd52",
    blue:"#4f91cc",
    green:"#68b87b",
    pink:"#d66c94",
    purple:"#9a78d5",
    orange:"#d7894e"
  };

  $("currentColor").style.background = colorMap[color] || colorMap.default;
}

function updatePinButton(){
  const button = $("pinEditor");

  if(state.editorPinned){
    button.style.background = "rgba(216,255,101,.1)";
    button.style.color = "var(--accent)";
  }else{
    button.style.background = "";
    button.style.color = "";
  }
}

function toast(message){
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");

  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => {
    el.classList.remove("show");
  },1800);
}

function closeCreateMenu(){
  $("createMenu").classList.add("hidden");
}

function toggleCreateMenu(){
  $("createMenu").classList.toggle("hidden");
}

function setFilter(filter){
  state.filter = filter;
  state.search = "";
  $("searchInput").value = "";
  render();
}

$("fab").addEventListener("click",toggleCreateMenu);

document.querySelectorAll(".create-option").forEach(button => {
  button.addEventListener("click",() => {
    openEditor(null,button.dataset.create);
  });
});

$("emptyCreate").addEventListener("click",() => {
  openEditor();
});

$("closeEditor").addEventListener("click",closeEditor);
$("saveNote").addEventListener("click",saveNote);

$("pinEditor").addEventListener("click",() => {
  state.editorPinned = !state.editorPinned;
  updatePinButton();
});

$("colorPicker").addEventListener("click",() => {
  $("colorMenu").classList.toggle("hidden");
});

document.querySelectorAll(".color-menu button").forEach(button => {
  button.addEventListener("click",() => {
    setColor(button.dataset.color);
    $("colorMenu").classList.add("hidden");
  });
});

$("addCheck").addEventListener("click",addCheckItem);

$("searchBtn").addEventListener("click",() => {
  $("searchPanel").classList.toggle("open");

  if($("searchPanel").classList.contains("open")){
    setTimeout(() => $("searchInput").focus(),100);
  }
});

$("searchInput").addEventListener("input",e => {
  state.search = e.target.value;
  render();
});

$("clearSearch").addEventListener("click",() => {
  $("searchInput").value = "";
  state.search = "";
  render();
});

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click",() => setFilter(tab.dataset.filter));
});

$("sortBtn").addEventListener("click",() => {
  $("sortMenu").classList.toggle("hidden");
});

document.querySelectorAll("[data-sort]").forEach(button => {
  button.addEventListener("click",() => {
    state.sort = button.dataset.sort;
    $("sortMenu").classList.add("hidden");

    const names = {
      recent:"Recent",
      created:"Created",
      az:"A → Z",
      za:"Z → A"
    };

    $("sortBtn span").textContent = names[state.sort];
    render();
  });
});

$("themeBtn").addEventListener("click",() => {
  state.dark = !state.dark;
  document.body.classList.toggle("light",!state.dark);
  saveState();
});

$("menuBtn").addEventListener("click",() => {
  $("sideMenu").classList.remove("hidden");
  $("overlay").classList.remove("hidden");
});

$("closeMenu").addEventListener("click",closeSideMenu);

function closeSideMenu(){
  $("sideMenu").classList.add("hidden");
  $("overlay").classList.add("hidden");
}

$("overlay").addEventListener("click",() => {
  closeSideMenu();
});

document.querySelectorAll("[data-filter-side]").forEach(button => {
  button.addEventListener("click",() => {
    setFilter(button.dataset.filterSide);
    closeSideMenu();
  });
});

$("exportBtn").addEventListener("click",() => {
  const payload = {
    app:"Notely",
    version:1,
    exportedAt:new Date().toISOString(),
    notes:state.notes
  };

  const blob = new Blob(
    [JSON.stringify(payload,null,2)],
    {type:"application/json"}
  );

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = `notely-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();

  URL.revokeObjectURL(url);
  toast("Backup exported");
});

$("importBtn").addEventListener("click",() => {
  $("importFile").click();
});

$("importFile").addEventListener("change",e => {
  const file = e.target.files[0];

  if(!file) return;

  const reader = new FileReader();

  reader.onload = event => {
    try{
      const data = JSON.parse(event.target.result);

      if(!Array.isArray(data.notes)){
        throw new Error();
      }

      state.notes = data.notes;
      saveState();
      render();
      closeSideMenu();
      toast("Backup imported");
    }catch{
      toast("Invalid backup file");
    }

    e.target.value = "";
  };

  reader.readAsText(file);
});

$("clearAllBtn").addEventListener("click",() => {
  const ok = window.confirm(
    "Delete every note and task? This cannot be undone."
  );

  if(!ok) return;

  state.notes = [];
  saveState();
  render();
  closeSideMenu();
  toast("All data cleared");
});

document.addEventListener("keydown",e => {
  if(e.key === "Escape"){
    $("sortMenu").classList.add("hidden");
    $("createMenu").classList.add("hidden");
    $("colorMenu").classList.add("hidden");

    if(!$("editor").classList.contains("hidden")){
      closeEditor();
    }

    closeSideMenu();
  }

  if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s"){
    if(!$("editor").classList.contains("hidden")){
      e.preventDefault();
      saveNote();
    }
  }

  if((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k"){
    e.preventDefault();
    $("searchPanel").classList.add("open");
    $("searchInput").focus();
  }
});

document.addEventListener("click",e => {
  if(
    !$("sortMenu").contains(e.target) &&
    !$("sortBtn").contains(e.target)
  ){
    $("sortMenu").classList.add("hidden");
  }

  if(
    !$("colorMenu").contains(e.target) &&
    !$("colorPicker").contains(e.target)
  ){
    $("colorMenu").classList.add("hidden");
  }
});

loadState();
updateDate();
render();
