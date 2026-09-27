"use strict";

const STORAGE_KEY = "notely_premium_v2";

let state = {
  notes: [],
  filter: "all",
  sort: "recent",
  search: "",
  editingId: null,
  editorType: "note",
  editorColor: "default",
  editorPinned: false,
  dark: true,
  undoNote: null,
  undoTimer: null
};

const $ = id => document.getElementById(id);

function uid(){
  return Date.now().toString(36) + Math.random().toString(36).slice(2,9);
}

function saveState(){
  localStorage.setItem(STORAGE_KEY,JSON.stringify({
    notes:state.notes,
    dark:state.dark
  }));
}

function loadState(){
  try{
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");

    if(Array.isArray(data.notes)){
      state.notes = data.notes;
    }

    if(typeof data.dark === "boolean"){
      state.dark = data.dark;
    }
  }catch{
    state.notes = [];
  }

  document.body.classList.toggle("light",!state.dark);
}

function escapeHTML(value=""){
  return String(value)
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
    return d.toLocaleTimeString([],{
      hour:"numeric",
      minute:"2-digit"
    });
  }

  return d.toLocaleDateString([],{
    day:"numeric",
    month:"short"
  });
}

function updateDate(){
  $("dateLabel").textContent =
    new Date().toLocaleDateString([],{
      weekday:"long",
      day:"numeric",
      month:"long"
    }).toUpperCase();
}

function getVisibleNotes(){
  let result = [...state.notes];

  if(state.filter === "all"){
    result = result.filter(n => !n.archived && !n.trashed);
  }

  if(state.filter === "notes"){
    result = result.filter(n =>
      n.type === "note" &&
      !n.archived &&
      !n.trashed
    );
  }

  if(state.filter === "tasks"){
    result = result.filter(n =>
      n.type === "task" &&
      !n.archived &&
      !n.trashed
    );
  }

  if(state.filter === "pinned"){
    result = result.filter(n =>
      n.pinned &&
      !n.archived &&
      !n.trashed
    );
  }

  if(state.filter === "archive"){
    result = result.filter(n =>
      n.archived &&
      !n.trashed
    );
  }

  if(state.filter === "trash"){
    result = result.filter(n => n.trashed);
  }

  if(state.search.trim()){
    const q = state.search.toLowerCase();

    result = result.filter(n => {
      const taskText = (n.items || [])
        .map(i => i.text)
        .join(" ");

      return (
        (n.title || "").toLowerCase().includes(q) ||
        (n.body || "").toLowerCase().includes(q) ||
        taskText.toLowerCase().includes(q)
      );
    });
  }

  if(state.sort === "recent"){
    result.sort((a,b) => b.updatedAt - a.updatedAt);
  }

  if(state.sort === "created"){
    result.sort((a,b) => b.createdAt - a.createdAt);
  }

  if(state.sort === "az"){
    result.sort((a,b) =>
      (a.title || "").localeCompare(b.title || "")
    );
  }

  if(state.sort === "za"){
    result.sort((a,b) =>
      (b.title || "").localeCompare(a.title || "")
    );
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

  $("pageTitle").textContent = titles[state.filter];

  document.querySelectorAll(".tab").forEach(tab => {
    tab.classList.toggle(
      "active",
      tab.dataset.filter === state.filter
    );
  });
}

function updateStats(){
  const active = state.notes.filter(n => !n.archived && !n.trashed);
  const notes = active.filter(n => n.type === "note").length;
  const tasks = active.filter(n => n.type === "task").length;
  const pinned = active.filter(n => n.pinned).length;

  $("stats").textContent =
    `${active.length} items · ${notes} notes · ${tasks} checklists · ${pinned} pinned`;
}

function render(){
  updateHeading();
  updateStats();

  const notes = getVisibleNotes();

  $("notesGrid").innerHTML = "";

  if(!notes.length){
    $("notesGrid").classList.add("hidden");
    $("emptyState").classList.remove("hidden");

    if(state.search){
      $("emptyTitle").textContent = "No matches found";
      $("emptyText").textContent =
        "Try another title, task or keyword.";
      $("emptyCreate").classList.add("hidden");
    }else{
      $("emptyCreate").classList.remove("hidden");

      const messages = {
        all:["Nothing here yet","Create your first note to get started."],
        notes:["No notes yet","Your written notes will appear here."],
        tasks:["No checklists yet","Turn your plans into simple tasks."],
        pinned:["Nothing pinned","Pin important items to keep them close."],
        archive:["Archive is empty","Quietly store notes you don't need right now."],
        trash:["Trash is empty","Deleted items will appear here."]
      };

      $("emptyTitle").textContent = messages[state.filter][0];
      $("emptyText").textContent = messages[state.filter][1];
    }

    return;
  }

  $("emptyState").classList.add("hidden");
  $("notesGrid").classList.remove("hidden");

  notes.forEach((note,index) => {
    const card = createCard(note);
    card.style.animationDelay = `${Math.min(index * 35,300)}ms`;
    $("notesGrid").appendChild(card);
  });
}

function createCard(note){
  const card = document.createElement("article");

  card.className =
    `note-card ${note.color || "default"} ${note.pinned ? "pinned" : ""}`;

  if(note.type === "task"){
    const items = note.items || [];
    const completed = items.filter(i => i.done).length;
    const percent = items.length
      ? Math.round(completed / items.length * 100)
      : 0;

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
      <div class="task-preview">
        ${visible || `<div class="card-text">No items yet.</div>`}
      </div>
      <div class="progress">
        <span style="width:${percent}%"></span>
      </div>
      <div class="card-footer">
        <span>${formatDate(note.updatedAt)}</span>
        <div class="card-actions">
          <button data-action="edit">↗</button>
          ${
            note.trashed
            ? `
              <button data-action="restore">↶</button>
              <button data-action="delete">×</button>
            `
            : `
              <button data-action="archive">□</button>
              <button data-action="delete">×</button>
            `
          }
        </div>
      </div>
    `;
  }else{
    card.innerHTML = `
      ${note.pinned ? `<div class="pin-indicator">●</div>` : ""}
      <div class="card-type">Note</div>
      <h3>${escapeHTML(note.title || "Untitled note")}</h3>
      <div class="card-text">
        ${escapeHTML(note.body || "Empty note")}
      </div>
      <div class="card-footer">
        <span>${formatDate(note.updatedAt)}</span>
        <div class="card-actions">
          <button data-action="edit">↗</button>
          ${
            note.trashed
            ? `
              <button data-action="restore">↶</button>
              <button data-action="delete">×</button>
            `
            : `
              <button data-action="archive">□</button>
              <button data-action="delete">×</button>
            `
          }
        </div>
      </div>
    `;
  }

  let startX = 0;
  let moved = false;

  card.addEventListener("touchstart",e => {
    startX = e.changedTouches[0].clientX;
    moved = false;
  },{passive:true});

  card.addEventListener("touchmove",e => {
    if(Math.abs(e.changedTouches[0].clientX - startX) > 12){
      moved = true;
    }
  },{passive:true});

  card.addEventListener("touchend",e => {
    const delta = e.changedTouches[0].clientX - startX;

    if(Math.abs(delta) > 75){
      if(delta > 0 && !note.trashed){
        togglePin(note.id);
      }else if(delta < 0 && !note.trashed){
        archiveNote(note.id);
      }

      return;
    }

    if(moved) return;

    const action =
      e.target.closest("[data-action]")?.dataset.action;

    if(action){
      handleCardAction(action,note.id);
    }else if(!note.trashed){
      openEditor(note.id);
    }
  });

  card.addEventListener("click",e => {
    const action =
      e.target.closest("[data-action]")?.dataset.action;

    if(action){
      handleCardAction(action,note.id);
    }else if(!note.trashed){
      openEditor(note.id);
    }
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
    archiveNote(id);
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
    deleteNote(id);
  }
}

function togglePin(id){
  const note = state.notes.find(n => n.id === id);
  if(!note) return;

  note.pinned = !note.pinned;
  note.updatedAt = Date.now();

  saveState();
  render();

  toast(note.pinned ? "Pinned" : "Unpinned");
}

function archiveNote(id){
  const note = state.notes.find(n => n.id === id);
  if(!note) return;

  note.archived = !note.archived;
  note.updatedAt = Date.now();

  saveState();
  render();

  toast(note.archived ? "Moved to archive" : "Restored from archive");
}

function deleteNote(id){
  const index = state.notes.findIndex(n => n.id === id);

  if(index === -1) return;

  const note = state.notes[index];

  if(note.trashed){
    state.notes.splice(index,1);
    saveState();
    render();
    toast("Deleted permanently");
    return;
  }

  note.trashed = true;
  note.archived = false;
  note.updatedAt = Date.now();

  state.undoNote = {
    note:JSON.parse(JSON.stringify(note)),
    index
  };

  clearTimeout(state.undoTimer);

  state.undoTimer = setTimeout(() => {
    state.undoNote = null;
    $("undoBar").classList.remove("show");
  },5000);

  saveState();
  render();

  $("undoMessage").textContent = "Moved to trash";
  $("undoBar").classList.add("show");
}

function undoDelete(){
  if(!state.undoNote) return;

  const existing = state.notes.find(
    n => n.id === state.undoNote.note.id
  );

  if(existing){
    existing.trashed = false;
    existing.updatedAt = Date.now();
  }else{
    state.notes.splice(
      Math.min(state.undoNote.index,state.notes.length),
      0,
      state.undoNote.note
    );
  }

  saveState();
  render();

  state.undoNote = null;
  clearTimeout(state.undoTimer);
  $("undoBar").classList.remove("show");

  toast("Restored");
}

function resetEditor(){
  state.editingId = null;
  state.editorType = "note";
  state.editorColor = "default";
  state.editorPinned = false;

  $("editorTitle").textContent = "New note";
  $("noteTitle").value = "";
  $("noteBody").value = "";

  $("noteBody").classList.remove("hidden");
  $("checklistEditor").classList.add("hidden");
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

    $("editorTitle").textContent =
      note.type === "task"
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
      type === "task"
      ? "New checklist"
      : "New note";

    if(type === "task"){
      $("noteBody").classList.add("hidden");
      $("checklistEditor").classList.remove("hidden");
      renderCheckItems([
        {
          id:uid(),
          text:"",
          done:false
        }
      ]);
    }
  }

  setColor(state.editorColor);
  updatePinButton();

  $("editor").classList.remove("hidden");
  document.body.style.overflow = "hidden";

  setTimeout(() => $("noteTitle").focus(),100);
}

function closeEditor(){
  $("editor").classList.add("hidden");
  $("colorMenu").classList.add("hidden");
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
    const items = [...document.querySelectorAll(".check-row")]
      .map(row => ({
        id:row.dataset.id,
        text:row.querySelector("input").value.trim(),
        done:row.querySelector(".check-toggle").classList.contains("checked")
      }))
      .filter(item => item.text);

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

  items.forEach(item => addCheckItem(item));
}

function addCheckItem(item=null){
  const row = document.createElement("div");

  row.className = "check-row";
  row.dataset.id = item?.id || uid();

  row.innerHTML = `
    <button class="check-toggle ${item?.done ? "checked" : ""}">
      ${item?.done ? "✓" : ""}
    </button>
    <input
      type="text"
      placeholder="Task..."
      value="${escapeHTML(item?.text || "")}"
    >
    <button class="remove-check">×</button>
  `;

  row.querySelector(".check-toggle").addEventListener("click",e => {
    const btn = e.currentTarget;

    btn.classList.toggle("checked");
    btn.textContent =
      btn.classList.contains("checked")
      ? "✓"
      : "";
  });

  row.querySelector(".remove-check").addEventListener("click",() => {
    row.remove();

    if(!$("checkItems").children.length){
      addCheckItem();
    }
  });

  row.querySelector("input").addEventListener("keydown",e => {
    if(e.key === "Enter"){
      e.preventDefault();
      addCheckItem();
    }
  });

  $("checkItems").appendChild(row);
}

function setColor(color){
  state.editorColor = color;

  const colors = {
    default:"#343840",
    yellow:"#d9bd52",
    blue:"#4f91cc",
    green:"#68b87b",
    pink:"#d66c94",
    purple:"#9a78d5",
    orange:"#d7894e"
  };

  $("currentColor").style.background =
    colors[color] || colors.default;
}

function updatePinButton(){
  const button = $("pinEditor");

  button.style.background =
    state.editorPinned
    ? "rgba(216,255,101,.1)"
    : "";

  button.style.color =
    state.editorPinned
    ? "var(--accent)"
    : "";
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

function setFilter(filter){
  state.filter = filter;
  state.search = "";

  $("searchInput").value = "";

  render();
}

function closeSideMenu(){
  $("sideMenu").classList.add("hidden");
  $("overlay").classList.add("hidden");
}

$("fab").addEventListener("click",() => {
  $("createMenu").classList.toggle("hidden");
});

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

$("addCheck").addEventListener("click",() => addCheckItem());

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
  state.search = "";
  $("searchInput").value = "";
  render();
});

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click",() => {
    setFilter(tab.dataset.filter);
  });
});

$("sortBtn").addEventListener("click",() => {
  $("sortMenu").classList.toggle("hidden");
});

document.querySelectorAll("[data-sort]").forEach(button => {
  button.addEventListener("click",() => {
    state.sort = button.dataset.sort;

    const labels = {
      recent:"Recent",
      created:"Created",
      az:"A → Z",
      za:"Z → A"
    };

    $("sortText").textContent = labels[state.sort];

    $("sortMenu").classList.add("hidden");

    render();
  });
});

$("themeBtn").addEventListener("click",() => {
  state.dark = !state.dark;

  document.body.classList.toggle(
    "light",
    !state.dark
  );

  saveState();

  toast(
    state.dark
    ? "Dark mode"
    : "Light mode"
  );
});

$("menuBtn").addEventListener("click",() => {
  $("sideMenu").classList.remove("hidden");
  $("overlay").classList.remove("hidden");
});

$("closeMenu").addEventListener("click",closeSideMenu);

$("overlay").addEventListener("click",closeSideMenu);

document.querySelectorAll("[data-filter-side]").forEach(button => {
  button.addEventListener("click",() => {
    setFilter(button.dataset.filterSide);
    closeSideMenu();
  });
});

$("undoBtn").addEventListener("click",undoDelete);

$("exportBtn").addEventListener("click",() => {
  const backup = {
    app:"Notely",
    version:2,
    exportedAt:new Date().toISOString(),
    notes:state.notes
  };

  const blob = new Blob(
    [JSON.stringify(backup,null,2)],
    {type:"application/json"}
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download =
    `notely-backup-${new Date().toISOString().slice(0,10)}.json`;

  link.click();

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
        throw new Error("Invalid");
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
  const confirmed = window.confirm(
    "Delete every note and task? This cannot be undone."
  );

  if(!confirmed) return;

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
