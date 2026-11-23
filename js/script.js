// Look up elements by their ID. Each page only runs the code it needs.
function byId(id) {
  return document.getElementById(id);
}

// Load Peosta weather from Open-Meteo.
async function loadWeather() {
  const weather = byId("weather");
  const button = byId("weather-button");
  weather.textContent = "Loading weather…";
  button.disabled = true;

  try {
    const url = "https://api.open-meteo.com/v1/forecast?latitude=42.45&longitude=-90.85&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=America%2FChicago&forecast_days=1";
    const response = await fetch(url);
    if (!response.ok) throw new Error("Weather request failed");
    const data = await response.json();
    const code = data.current.weather_code;
    let conditions = "Precipitation";
    if (code === 0) conditions = "Clear";
    else if (code < 4) conditions = "Cloudy";
    else if (code < 50) conditions = "Fog";
    else if (code >= 95) conditions = "Thunderstorms";
    weather.textContent = `${data.current.temperature_2m}°F · ${conditions} · High ${data.daily.temperature_2m_max[0]}°F · Low ${data.daily.temperature_2m_min[0]}°F`;
    button.textContent = "Refresh weather";
  } catch {
    weather.textContent = "Weather is unavailable right now.";
    button.textContent = "Retry weather";
  } finally {
    button.disabled = false;
  }
}

if (byId("weather-button")) {
  byId("weather-button").addEventListener("click", loadWeather);
  loadWeather();
}

// Filter the sample activities and load upcoming U.S. holidays.
function searchEvents(event) {
  event.preventDefault();
  const query = byId("event-search").value.trim().toLowerCase();
  const category = byId("event-category").value;
  let count = 0;

  for (const activity of document.querySelectorAll(".event")) {
    const matchesText = activity.textContent.toLowerCase().includes(query);
    const matchesCategory = !category || activity.dataset.category === category;
    activity.hidden = !(matchesText && matchesCategory);
    if (!activity.hidden) count++;
  }
  byId("event-status").textContent = count ? `Events found: ${count}` : "No events found.";
}

async function loadHolidays() {
  const status = byId("holiday-status");
  const retry = byId("holiday-retry");
  const list = byId("holidays");
  retry.hidden = true;
  list.replaceChildren();
  status.textContent = "Loading holidays…";

  try {
    const response = await fetch("https://date.nager.at/api/v3/NextPublicHolidays/US");
    if (!response.ok) throw new Error("Holiday request failed");
    const holidays = await response.json();
    for (const holiday of holidays.slice(0, 3)) {
      const item = document.createElement("li");
      const date = new Date(holiday.date + "T12:00:00Z");
      const label = date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
      item.textContent = `${holiday.localName} · ${label}`;
      list.append(item);
    }
    status.textContent = holidays.length ? "" : "No upcoming holidays found.";
  } catch {
    status.textContent = "Holidays are unavailable right now.";
    retry.hidden = false;
  }
}

if (byId("event-form")) {
  byId("event-form").addEventListener("submit", searchEvents);
  byId("holiday-retry").addEventListener("click", loadHolidays);
  loadHolidays();
}

// Run the timer from a deadline so it keeps time in a background tab.
function setupTimer() {
  const minutes = byId("minutes");
  const start = byId("start");
  const pause = byId("pause");
  const status = byId("timer-status");
  let remaining = 25 * 60 * 1000;
  let deadline = 0;
  let interval;
  let paused = false;

  function showTime() {
    const seconds = Math.ceil(remaining / 1000);
    byId("countdown").textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function stopTimer() {
    clearInterval(interval);
    start.disabled = false;
    pause.disabled = true;
    minutes.disabled = false;
  }

  function updateTimer() {
    remaining = Math.max(0, deadline - Date.now());
    showTime();
    if (remaining === 0) {
      stopTimer();
      status.textContent = "Time is up!";
    }
  }

  start.addEventListener("click", function () {
    if (!minutes.reportValidity() || !minutes.value) {
      status.textContent = "Enter a whole number from 1 to 120.";
      return;
    }
    if (!paused) remaining = Number(minutes.value) * 60 * 1000;
    paused = false;
    deadline = Date.now() + remaining;
    start.disabled = true;
    pause.disabled = false;
    minutes.disabled = true;
    status.textContent = "Timer running.";
    showTime();
    interval = setInterval(updateTimer, 200);
  });

  pause.addEventListener("click", function () {
    updateTimer();
    if (remaining === 0) return;
    paused = true;
    stopTimer();
    status.textContent = "Timer paused.";
  });

  function resetTimer() {
    stopTimer();
    paused = false;
    remaining = (minutes.validity.valid && minutes.value ? Number(minutes.value) : 25) * 60 * 1000;
    showTime();
    status.textContent = "Ready to start.";
  }

  byId("reset").addEventListener("click", resetTimer);
  minutes.addEventListener("change", resetTimer);
}

// Save assignments in this browser and update the completed count.
function setupTasks() {
  const storageKey = "campus-life-tasks";
  const list = byId("tasks");
  const input = byId("task-input");
  const storageStatus = byId("task-storage");
  let tasks = [];

  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (Array.isArray(saved)) {
      tasks = saved.filter(task => task && typeof task.name === "string" && typeof task.done === "boolean");
    }
  } catch {
    storageStatus.textContent = "Saved tasks could not be loaded.";
  }

  function updateCount() {
    const completed = tasks.filter(task => task.done).length;
    byId("task-count").textContent = `${completed} of ${tasks.length} tasks complete`;
  }

  function saveTasks() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(tasks));
      storageStatus.textContent = "";
    } catch {
      storageStatus.textContent = "Tasks could not be saved in this browser.";
    }
    updateCount();
  }

  function showTasks() {
    list.replaceChildren();
    for (const task of tasks) {
      const item = document.createElement("li");
      item.className = "list-group-item";
      const label = document.createElement("label");
      label.className = "d-flex align-items-start gap-2";
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = task.done;
      checkbox.className = "form-check-input flex-shrink-0";
      checkbox.addEventListener("change", function () {
        task.done = checkbox.checked;
        saveTasks();
      });
      const name = document.createElement("span");
      name.className = "task-name";
      name.textContent = task.name;
      label.append(checkbox, name);
      item.append(label);
      list.append(item);
    }
    updateCount();
  }

  byId("task-form").addEventListener("submit", function (event) {
    event.preventDefault();
    const name = input.value.trim();
    if (!name) {
      input.value = "";
      input.reportValidity();
      return;
    }
    tasks.push({ name: name, done: false });
    saveTasks();
    showTasks();
    input.value = "";
    input.focus();
  });

  showTasks();
}

if (byId("task-form")) {
  setupTimer();
  setupTasks();
}
