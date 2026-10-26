let scoreChart;

const formatPct = value => `${(Number(value) * 100).toFixed(1)}%`;
const cell = (value, tag = "td") => `<${tag}>${value ?? ""}</${tag}>`;
const championKeys = new Set();
const isChampion = player => championKeys.has(String(player).toLowerCase());
const playerLabel = player => isChampion(player)
  ? `<span class="player-label">${player} 🏆</span>`
  : player;
const divisionOrder = [
  "Atlantic", "Central", "Southeast",
  "Northwest", "Pacific", "Southwest"
];

function renderTable(element, columns, rows) {
  element.innerHTML = `<thead><tr>${columns.map(c => cell(c.label, "th")).join("")}</tr></thead><tbody>${
    rows.map(row => `<tr>${columns.map(c => cell(c.format ? c.format(row[c.key], row) : row[c.key])).join("")}</tr>`).join("")
  }</tbody>`;
}

function render(data) {
  const scores = data.playerScores || [];
  (data.priorChampions || []).forEach(player => championKeys.add(String(player).toLowerCase()));
  document.title = data.title;
  document.getElementById("title").textContent = data.title;
  document.getElementById("updated").textContent = `Last updated: ${data.updated}`;
  document.getElementById("week-label").textContent = data.currentWeek || "Season";
  document.getElementById("season-note").textContent = data.gamesPlayed
    ? `${data.gamesPlayed} games recorded so far this season.`
    : "The season hasn't started yet - the leaderboard fills in as games are scraped and picks score points.";

  renderTable(document.getElementById("leaderboard-table"), [
    { key: "Rank", label: "#", format: (_, row) => scores.indexOf(row) + 1 },
    { key: "Player", label: "Player", format: value => playerLabel(value) },
    { key: "Points", label: "Points" },
    { key: "PointsBack", label: "Back" }
  ], scores);

  const playerOfWeek = data.playerOfWeek || {};
  const playersOfWeek = playerOfWeek.players || [];
  document.getElementById("player-of-week").innerHTML = `
    <div class="section-heading"><div><p class="eyebrow">WEEKLY HONOR</p><h2>Player of the week</h2></div><span class="trophy">🏆</span></div>
    <div class="award">
      <strong>${playersOfWeek.length ? playersOfWeek.map(playerLabel).join(" & ") : "No completed games yet"}</strong>
      ${playersOfWeek.length ? `<span>${playerOfWeek.points} points in ${playerOfWeek.week}</span>` : ""}
    </div>`;

  const standings = [...(data.standings || [])].sort((a, b) => {
    const divisionDifference = divisionOrder.indexOf(a.Division) - divisionOrder.indexOf(b.Division);
    if (divisionDifference) return divisionDifference;
    return String(a.Team).localeCompare(String(b.Team));
  });
  renderTable(document.getElementById("standings-table"), [
    { key: "Team", label: "Team" }, { key: "Conference", label: "Conf" }, { key: "Division", label: "Division" },
    { key: "W", label: "W" }, { key: "L", label: "L" }, { key: "PCT", label: "PCT", format: formatPct },
    { key: "PF", label: "PF" }, { key: "PA", label: "PA" }, { key: "STRK", label: "STRK" }
  ], standings);

  renderTable(document.getElementById("draft-table"), [
    { key: "Round", label: "Round" }, { key: "Pick", label: "Pick" }, { key: "Player", label: "Player", format: value => playerLabel(value) },
    { key: "Selection", label: "Selection" }, { key: "Team", label: "Team" }
  ], data.draft || []);

  const pickScores = data.pickScores || [];
  const playerFilter = document.getElementById("player-filter");
  playerFilter.innerHTML = '<option value="">All players</option>';
  [...new Set(pickScores.map(row => row.Player))].sort().forEach(player => {
    playerFilter.insertAdjacentHTML("beforeend", `<option value="${player}">${player}</option>`);
  });
  const renderPickScores = () => renderTable(
    document.getElementById("pick-scores-table"),
    [
      { key: "Player", label: "Player", format: value => playerLabel(value) },
      { key: "Round", label: "Round" }, { key: "Pick", label: "Pick" },
      { key: "Team", label: "Team" }, { key: "Selection", label: "Picked" },
      { key: "Points", label: "Points" }
    ],
    playerFilter.value ? pickScores.filter(row => row.Player === playerFilter.value) : pickScores
  );
  playerFilter.onchange = renderPickScores;
  renderPickScores();

  renderTable(document.getElementById("historical-table"), [
    { key: "Season", label: "Season" },
    { key: "Champion", label: "Champion", format: value => playerLabel(value) },
    { key: "Points", label: "Winning points" }
  ], data.historicalSeasons || []);
  document.getElementById("historical-details").innerHTML = (data.historicalSeasons || []).map(season => `
    <div class="history-season">
      <h3>${season.Season}</h3>
      <ol>${season.Standings.map(row => `<li class="${row.Player === season.Champion ? "history-champion" : ""}"><span>${row.Player}</span><strong>${row.Points}</strong></li>`).join("")}</ol>
    </div>`).join("");

  const teamFilter = document.getElementById("team-filter");
  teamFilter.oninput = () => {
    const query = teamFilter.value.trim().toLowerCase();
    renderTable(document.getElementById("standings-table"), [
      { key: "Team", label: "Team" }, { key: "Conference", label: "Conf" }, { key: "Division", label: "Division" },
      { key: "W", label: "W" }, { key: "L", label: "L" }, { key: "PCT", label: "PCT", format: formatPct },
      { key: "PF", label: "PF" }, { key: "PA", label: "PA" }, { key: "STRK", label: "STRK" }
    ], standings.filter(row => String(row.Team).toLowerCase().includes(query)));
  };

  const weeklyScores = data.weeklyScores || {};
  const weeks = Object.keys(weeklyScores).sort((a, b) => Number(a.split("_")[1]) - Number(b.split("_")[1]));
  const players = [...new Set(scores.map(row => row.Player))];
  const cumulative = {};
  players.forEach(player => { cumulative[player] = 0; });
  const datasets = players.map(player => {
    const values = weeks.map(week => {
      cumulative[player] += weeklyScores[week][player] || 0;
      return cumulative[player];
    });
    return { label: player, data: values, tension: 0.25, fill: false };
  });
  if (scoreChart) scoreChart.destroy();
  scoreChart = new Chart(document.getElementById("score-chart"), {
    type: "line",
    data: { labels: weeks.map(week => week.replace("week_", "Week ")), datasets },
    options: { responsive: true, scales: { y: { beginAtZero: true } } }
  });
}

fetch("dashboard.json", { cache: "no-store" })
  .then(response => response.json())
  .then(render)
  .catch(error => {
    document.getElementById("updated").textContent = "Unable to load dashboard.json";
    console.error(error);
  });
