// ---------- DOM SHORTCUTS ----------
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// ---------- GLOBAL STATE ----------
const state = {
  tossWinner: null,
  tossChoice: null,
  battingTeam: null,   // "1" or "2"
  bowlingTeam: null,
  oversLimit: 20,
  teams: {
    team1: { name: "", players: [] },
    team2: { name: "", players: [] }
  },
  innings: {
    total: 0,
    wickets: 0,
    balls: 0,      // total balls bowled
    overs: 0       // computed as x.y
  },
  striker: null,
  nonStriker: null,
  bowler: null
};

// ---------- PLAYER INPUT GENERATION ----------
function generatePlayerInputs(containerId, teamNum) {
  const container = $(containerId);
  container.innerHTML = "";
  const count = parseInt(teamNum === 1 ? $("team1Players").value || 11
                                      : $("team2Players").value || 11);
  for (let i = 1; i <= count; i++) {
    const div = document.createElement("div");
    div.className = "player-input";
    div.innerHTML = `
      <input type="text" id="p-${teamNum}-${i}" placeholder="Player ${i}">
      <input type="file" data-team="${teamNum}" data-index="${i}">
      <img class="player-preview" data-team="${teamNum}" data-index="${i}">
    `;
    container.appendChild(div);

    const fileInput = div.querySelector("input[type=file]");
    const preview = div.querySelector(".player-preview");
    fileInput.addEventListener("change", e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        preview.src = ev.target.result;
        preview.style.display = "block";
      };
      reader.readAsDataURL(file);
    });
  }
}

$("team1Players").addEventListener("input", () => generatePlayerInputs("team1PlayersContainer", 1));
$("team2Players").addEventListener("input", () => generatePlayerInputs("team2PlayersContainer", 2));
generatePlayerInputs("team1PlayersContainer", 1);
generatePlayerInputs("team2PlayersContainer", 2);

// ---------- TOSS ----------
$$(".toss-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    $$(".toss-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    state.tossWinner = btn.dataset.team;
    $("choiceOptions").style.display = "block";
  });
});

$$(".choice-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    $$(".choice-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    state.tossChoice = btn.dataset.choice;
    if (state.tossChoice === "bat") {
      state.battingTeam = state.tossWinner;
      state.bowlingTeam = state.tossWinner === "1" ? "2" : "1";
    } else {
      state.bowlingTeam = state.tossWinner;
      state.battingTeam = state.tossWinner === "1" ? "2" : "1";
    }
    $("nextBtn").style.display = "block";
  });
});

// ---------- NEXT BUTTON: COLLECT TEAMS ----------
$("nextBtn").addEventListener("click", () => {
  state.oversLimit = parseInt($("overs").value) || 20;
  collectTeams();
  showPlayerSelection();
});

function collectTeams() {
  ["team1","team2"].forEach((key, idx) => {
    const num = idx + 1;
    const nPlayers = parseInt($(`team${num}Players`).value) || 11;
    state.teams[key].name = $(`team${num}Name`).value.trim() || `Team ${num}`;
    state.teams[key].players = [];
    for (let i = 1; i <= nPlayers; i++) {
      const nameInput = $(`p-${num}-${i}`);
      const fileInput = document.querySelector(`input[type=file][data-team="${num}"][data-index="${i}"]`);
      state.teams[key].players.push({
        id: `${key}-${i}`,
        name: (nameInput && nameInput.value.trim()) || `Player ${i}`,
        photo: fileInput && fileInput.files[0] ? URL.createObjectURL(fileInput.files[0]) : null,
        runs: 0,
        balls: 0,
        out: false,
        dismissal: "",
        bowlBalls: 0,
        bowlRuns: 0,
        bowlWkts: 0
      });
    }
  });
}

// ---------- PLAYER SELECTION SCREEN ----------
function showPlayerSelection() {
  const batKey = state.battingTeam === "1" ? "team1" : "team2";
  const bowlKey = state.bowlingTeam === "1" ? "team1" : "team2";
  $("playerScreenTitle").textContent =
    `${state.teams[batKey].name} batting vs ${state.teams[bowlKey].name}`;

  buildPlayerSelectList("battingPlayers", batKey, true);
  buildPlayerSelectList("bowlingPlayers", bowlKey, false);

  showScreen("playerScreen");
}

function buildPlayerSelectList(containerId, teamKey, isBatting) {
  const container = $(containerId);
  container.innerHTML = "";
  state.teams[teamKey].players.forEach((p, idx) => {
    const item = document.createElement("div");
    item.className = "player-item";
    item.dataset.team = teamKey;
    item.dataset.index = idx.toString();
    item.innerHTML = `
      <img src="${p.photo || placeholderAvatar()}" alt="">
      <span>${p.name}</span>
    `;
    item.addEventListener("click", () => {
      if (isBatting) selectOpeningBatsman(item, teamKey, idx);
      else selectOpeningBowler(item, teamKey, idx);
    });
    container.appendChild(item);
  });
}

function placeholderAvatar() {
  return "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDIiIGhlaWdodD0iNDIiIHZpZXdCb3g9IjAgMCA0MiA0MiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMSIgY3k9IjIxIiByPSIyMSIgZmlsbD0iI2UwZTBmOCIvPjx0ZXh0IHg9IjIxIiB5PSIyNiIgtext-anchorPSJtaWRkbGUiIGZvbnQtc2l6ZT0iMTIiIGZpbGw9IiMxMTIxMzMiPk08L3RleHQ+PC9zdmc+";
}

let openingStriker = null;
let openingNonStriker = null;
let openingBowler = null;

function selectOpeningBatsman(item, teamKey, idx) {
  const player = state.teams[teamKey].players[idx];
  const already = item.classList.contains("selected");
  if (already) {
    item.classList.remove("selected");
    if (openingStriker === player) openingStriker = null;
    else if (openingNonStriker === player) openingNonStriker = null;
  } else {
    if (!openingStriker) openingStriker = player;
    else if (!openingNonStriker && player !== openingStriker) openingNonStriker = player;
    item.classList.add("selected");
  }
  updateStartButton();
}

function selectOpeningBowler(item, teamKey, idx) {
  $$("#bowlingPlayers .player-item").forEach(el => el.classList.remove("selected"));
  const player = state.teams[teamKey].players[idx];
  openingBowler = player;
  item.classList.add("selected");
  updateStartButton();
}

function updateStartButton() {
  const ready = openingStriker && openingNonStriker && openingBowler;
  $("startMatchBtn").disabled = !ready;
}

// ---------- SCREEN HELP ----------
function showScreen(name) {
  ["tossScreen","playerScreen","matchScreen"].forEach(id => {
    $(id).classList.toggle("active", id === name);
  });
}

$("backToToss").addEventListener("click", () => showScreen("tossScreen"));

// ---------- START MATCH ----------
$("startMatchBtn").addEventListener("click", () => {
  state.striker = openingStriker;
  state.nonStriker = openingNonStriker;
  state.bowler = openingBowler;
  state.innings = { total:0, wickets:0, balls:0, overs:0 };
  updateMatchUI();
  showScreen("matchScreen");
});

// ---------- MATCH UI ----------
function updateMatchUI() {
  const batKey = state.battingTeam === "1" ? "team1" : "team2";
  const bowlKey = state.bowlingTeam === "1" ? "team1" : "team2";
  $("matchTitle").textContent =
    `${state.teams[batKey].name} vs ${state.teams[bowlKey].name}`;

  // striker
  $("strikerImg").src = state.striker.photo || placeholderAvatar();
  $("strikerName").textContent = state.striker.name;
  $("strikerStats").textContent = `${state.striker.runs} (${state.striker.balls})`;

  // non‑striker
  $("nonStrikerImg").src = state.nonStriker.photo || placeholderAvatar();
  $("nonStrikerName").textContent = state.nonStriker.name;
  $("nonStrikerStats").textContent = `${state.nonStriker.runs} (${state.nonStriker.balls})`;

  // bowler
  const oBalls = state.bowler.bowlBalls;
  const ov = `${Math.floor(oBalls/6)}.${oBalls%6}`;
  $("bowlerImg").src = state.bowler.photo || placeholderAvatar();
  $("bowlerName").textContent = state.bowler.name;
  $("bowlerStats").textContent =
    `${state.bowler.bowlRuns} runs • ${state.bowler.bowlWkts} wkts • ${ov} ov`;

  $("currentTeamTotal").textContent = state.innings.total;
  $("currentTeamWickets").textContent = state.innings.wickets;
  $("currentOvers").textContent =
    `${Math.floor(state.innings.balls/6)}.${state.innings.balls%6}`;
}

// ---------- SCORING ----------
$$(".btn-run").forEach(btn => {
  btn.addEventListener("click", () => {
    const runs = parseInt(btn.dataset.runs,10);
    addRuns(runs,false);
  });
});

$("ballBtn").addEventListener("click", () => addRuns(0,false));
$("extraRun").addEventListener("change", e => {
  if (e.target.checked) {
    addRuns(1,true); // extra, ball not counted
    e.target.checked = false;
  }
});

$("wicketBtn").addEventListener("click", onWicket);
$("resetBtn").addEventListener("click", () => {
  state.innings = { total:0, wickets:0, balls:0, overs:0 };
  state.teams[state.battingTeam==="1"?"team1":"team2"].players
    .forEach(p => {p.runs=0;p.balls=0;p.out=false;p.dismissal="";});
  state.teams[state.bowlingTeam==="1"?"team1":"team2"].players
    .forEach(p => {p.bowlBalls=0;p.bowlRuns=0;p.bowlWkts=0;});
  updateMatchUI();
});

function addRuns(runs,isExtra){
  // innings over?
  if (state.innings.wickets>=10) return;

  state.innings.total += runs;
  if (!isExtra){
    // legal ball
    state.striker.balls++;
    state.innings.balls++;
    state.bowler.bowlBalls++;
  }
  state.striker.runs += runs;
  state.bowler.bowlRuns += runs;

  // strike rotation for odd runs
  if (!isExtra && runs%2===1){
    const tmp = state.striker;
    state.striker = state.nonStriker;
    state.nonStriker = tmp;
  }

  // over finished?
  if (!isExtra && state.innings.balls % 6 === 0){
    openNextBowlerModal();
  }

  // max overs limit
  const completedOvers = Math.floor(state.innings.balls/6);
  if (completedOvers >= state.oversLimit){
    alert("Overs finished");
  }

  updateMatchUI();
}

// ---------- WICKET / NEXT BATSMAN ----------
function onWicket(){
  if (state.innings.wickets>=10) return;
  const mode = $("dismissalType").value || "out";
  state.striker.out = true;
  state.striker.dismissal = mode;
  state.bowler.bowlWkts++;
  state.innings.wickets++;
  state.innings.balls++;
  state.bowler.bowlBalls++;

  if (state.innings.wickets >= 10){
    alert("All out (10 wickets). Innings over.");
    updateMatchUI();
    return;
  }

  openNextBatsmanModal();
  updateMatchUI();
}

// ---------- MODAL: NEXT BATSMAN ----------
function openNextBatsmanModal(){
  const batKey = state.battingTeam === "1" ? "team1" : "team2";
  const list = $("nextBatsmanList");
  list.innerHTML = "";
  state.teams[batKey].players.forEach((p,idx)=>{
    if (p.out || p===state.striker || p===state.nonStriker) return;
    const item = document.createElement("div");
    item.className="player-item";
    item.innerHTML = `<img src="${p.photo||placeholderAvatar()}"><span>${p.name}</span>`;
    item.addEventListener("click",()=>{
      state.striker = p; // new batsman comes as striker
      $("nextBatsmanModal").style.display="none";
      updateMatchUI();
    });
    list.appendChild(item);
  });
  $("nextBatsmanModal").style.display="flex";
}
$("closeBatsmanModal").addEventListener("click",()=>{
  $("nextBatsmanModal").style.display="none";
});

// ---------- MODAL: NEXT BOWLER ----------
function openNextBowlerModal(){
  const bowlKey = state.bowlingTeam === "1" ? "team1" : "team2";
  const list = $("nextBowlerList");
  list.innerHTML = "";
  state.teams[bowlKey].players.forEach((p,idx)=>{
    const item = document.createElement("div");
    item.className="player-item";
    const ov = `${Math.floor(p.bowlBalls/6)}.${p.bowlBalls%6}`;
    item.innerHTML =
      `<img src="${p.photo||placeholderAvatar()}">
       <span>${p.name} – ${p.bowlRuns} runs, ${p.bowlWkts} wkts, ${ov} ov</span>`;
    item.addEventListener("click",()=>{
      state.bowler = p;
      $("nextBowlerModal").style.display="none";
      updateMatchUI();
    });
    list.appendChild(item);
  });
  $("nextBowlerModal").style.display="flex";
}
$("closeBowlerModal").addEventListener("click",()=>{
  $("nextBowlerModal").style.display="none";
});

// back to player selection
$("backToPlayers").addEventListener("click",()=>showScreen("playerScreen"));

// init
console.log("Cricket Scorecard loaded");
