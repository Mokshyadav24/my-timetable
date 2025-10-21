import React, { useEffect, useState } from "react";

// Daily Timetable App — Improved UI/UX
// - Single-file React component
// - Tailwind CSS utility classes used for styling
// - Persists tasks and completion history to localStorage
// - Uses CURRENT date prominently in the header
// - Shows counts as: THIS MONTH and THIS YEAR (not 'past 30/365 days')
// - Adds a simple month-calendar visual and a daily progress bar for stronger UX signals

const STORAGE_KEY = "timetable_data_v2";

function todayISO(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function prettyDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function loadStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error("load error", e);
    return null;
  }
}

function saveStorage(obj) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch (e) {
    console.error("save error", e);
  }
}

export default function TimetableApp() {
  const now = new Date();
  const today = todayISO();
  const [data, setData] = useState(() => {
    const stored = loadStorage();
    if (stored) return stored;

    // default dataset
    const defaultTasks = [
      { id: "t1", title: "Morning Exercise" },
      { id: "t2", title: "Study / Lectures" },
      { id: "t3", title: "Project Work" },
      { id: "t4", title: "Revision" },
      { id: "t5", title: "Read / Leisure" },
    ];

    return {
      tasks: defaultTasks,
      history: {}, // { taskId: { 'YYYY-MM-DD': true, ... } }
      lastActiveDate: today,
    };
  });

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [openTaskId, setOpenTaskId] = useState(null);

  useEffect(() => {
    // Update lastActiveDate to today if older (keeps history intact)
    if (!data.lastActiveDate || data.lastActiveDate !== today) {
      const updated = { ...data, lastActiveDate: today };
      setData(updated);
      saveStorage(updated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleTaskToday(taskId) {
    const date = today;
    const history = { ...(data.history || {}) };
    if (!history[taskId]) history[taskId] = {};
    const currently = !!history[taskId][date];
    if (currently) {
      delete history[taskId][date];
    } else {
      history[taskId][date] = true;
    }
    const updated = { ...data, history };
    setData(updated);
    saveStorage(updated);
  }

  function isTaskDoneOn(taskId, isoDate) {
    return !!(data.history && data.history[taskId] && data.history[taskId][isoDate]);
  }

  function addTask() {
    const title = newTaskTitle.trim();
    if (!title) return;
    const id = "t" + Date.now();
    const tasks = [...data.tasks, { id, title }];
    const updated = { ...data, tasks };
    setData(updated);
    saveStorage(updated);
    setNewTaskTitle("");
  }

  function removeTask(id) {
    const tasks = data.tasks.filter((t) => t.id !== id);
    const history = { ...(data.history || {}) };
    delete history[id];
    const updated = { ...data, tasks, history };
    setData(updated);
    saveStorage(updated);
  }

  function datesForTaskInRange(taskId, startISO, endISO) {
    const res = [];
    const h = data.history[taskId] || {};
    Object.keys(h).forEach((iso) => {
      if (iso >= startISO && iso <= endISO) res.push(iso);
    });
    res.sort();
    return res;
  }

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  function datesInCurrentMonth(taskId) {
    const start = new Date(currentYear, currentMonth, 1).toISOString().slice(0, 10);
    const end = new Date(currentYear, currentMonth + 1, 0).toISOString().slice(0, 10);
    return datesForTaskInRange(taskId, start, end);
  }

  function datesInCurrentYear(taskId) {
    const start = `${currentYear}-01-01`;
    const end = `${currentYear}-12-31`;
    return datesForTaskInRange(taskId, start, end);
  }

  function countThisMonth(taskId) {
    return datesInCurrentMonth(taskId).length;
  }

  function countThisYear(taskId) {
    return datesInCurrentYear(taskId).length;
  }

  // Calendar helpers: builds an array representing the current month layout
  function buildMonthGrid(taskId) {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const weekdayOfFirst = firstDay.getDay(); // 0 (Sun) - 6 (Sat)
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const completedSet = new Set(datesInCurrentMonth(taskId));

    const cells = [];
    // fill blanks before first day
    for (let i = 0; i < weekdayOfFirst; i++) cells.push(null);
    // fill days
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = new Date(currentYear, currentMonth, d).toISOString().slice(0, 10);
      cells.push({ day: d, iso, done: completedSet.has(iso) });
    }
    return cells;
  }

  // Overall progress: percentage of tasks completed today
  function todayProgress() {
    const total = data.tasks.length || 1;
    const done = data.tasks.filter((t) => isTaskDoneOn(t.id, today)).length;
    return Math.round((done / total) * 100);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6">
      <div className="max-w-6xl mx-auto bg-white shadow-2xl rounded-3xl p-6">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Daily Timetable</h1>
            <p className="text-sm text-slate-500 mt-1">A clean daily checklist with monthly & yearly history.</p>
          </div>

          <div className="text-right">
            <div className="text-sm text-slate-400">Today</div>
            <div className="text-xl font-semibold">{now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</div>
            <div className="mt-2 text-xs text-slate-400">Auto-saves in your browser · local only</div>
          </div>
        </header>

        {/* Progress bar */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium">Today's Progress</div>
            <div className="text-sm text-slate-600">{todayProgress()}%</div>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <div className="h-3 rounded-full transition-all duration-300" style={{ width: `${todayProgress()}%`, background: 'linear-gradient(90deg,#7c3aed,#06b6d4)' }} />
          </div>
        </div>

        <main className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Tasks table */}
          <section className="space-y-4">
            <div className="flex gap-2">
              <input
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Add a new task (e.g. 'Practice coding')"
                className="flex-1 px-4 py-2 border rounded-lg focus:outline-none"
              />
              <button onClick={addTask} className="px-4 py-2 rounded-lg bg-indigo-600 text-white">Add</button>
            </div>

            <div className="bg-slate-50 border rounded-lg p-3">
              {data.tasks.length === 0 ? (
                <div className="text-sm text-slate-500">No tasks yet — add one above.</div>
              ) : (
                <ul className="space-y-3">
                  {data.tasks.map((task) => (
                    <li key={task.id} className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <label className="inline-flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={isTaskDoneOn(task.id, today)}
                            onChange={() => toggleTaskToday(task.id)}
                            className="w-5 h-5 rounded"
                          />
                          <div>
                            <div className="font-medium">{task.title}</div>
                            <div className="text-xs text-slate-400">ID: {task.id}</div>
                          </div>
                        </label>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-xs text-slate-500 text-right">
                          <div>This month <span className="font-semibold">{countThisMonth(task.id)}</span></div>
                          <div>This year <span className="font-semibold">{countThisYear(task.id)}</span></div>
                        </div>

                        <div className="flex gap-2">
                          <button
                            onClick={() => setOpenTaskId(openTaskId === task.id ? null : task.id)}
                            className="px-3 py-1 rounded bg-white border text-sm"
                          >
                            Details
                          </button>
                          <button
                            onClick={() => removeTask(task.id)}
                            className="px-3 py-1 rounded bg-rose-50 text-rose-700 border text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* Right: Calendar + Per-task details */}
          <section className="space-y-4">
            <div className="bg-slate-50 border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm text-slate-500">Calendar — {now.toLocaleString(undefined, { month: 'long' })} {currentYear}</div>
                  <div className="font-medium">Tap a task's Details to highlight its days</div>
                </div>
              </div>

              {/* Mini month calendar showing completions for the first open task (or aggregate dots) */}
              <div className="text-xs text-slate-500 mb-2">Legend: filled = completed</div>

              <div className="grid grid-cols-7 gap-1">
                {['S','M','T','W','T','F','S'].map((d) => (
                  <div key={d} className="text-center text-[11px] text-slate-400">{d}</div>
                ))}

                {/* Show aggregate: if openTaskId -> highlight that task, else show days where ANY task was done */}
                {(() => {
                  const taskForCalendar = openTaskId || null;
                  const cells = buildMonthGrid(taskForCalendar || (data.tasks[0] && data.tasks[0].id) || null);
                  // Determine if we are showing a specific task or aggregate
                  const aggregateSet = new Set();
                  if (!taskForCalendar) {
                    // build union of completions for all tasks
                    data.tasks.forEach((t) => {
                      datesInCurrentMonth(t.id).forEach((iso) => aggregateSet.add(iso));
                    });
                  }

                  return cells.map((c, idx) => {
                    if (c === null) return <div key={idx} className="h-8" />;
                    const done = taskForCalendar ? c.done : aggregateSet.has(c.iso);
                    const isToday = c.iso === today;
                    return (
                      <div
                        key={idx}
                        className={`h-8 rounded flex items-center justify-center text-sm ${done ? 'bg-indigo-600 text-white' : 'bg-white'} ${isToday ? 'ring-2 ring-indigo-300' : ''}`}
                      >
                        {c.day}
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Per-task expanded details */}
            <div className="space-y-3">
              {data.tasks.map((task) => {
                const open = openTaskId === task.id;
                const monthDates = datesInCurrentMonth(task.id);
                const yearDates = datesInCurrentYear(task.id);

                return (
                  <div key={task.id} className="border rounded-lg p-3 bg-white">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-medium">{task.title}</div>
                        <div className="text-xs text-slate-400">Task ID: {task.id}</div>
                      </div>

                      <div className="text-right text-sm text-slate-600">
                        <div>This month: <span className="font-semibold">{countThisMonth(task.id)}</span></div>
                        <div>This year: <span className="font-semibold">{countThisYear(task.id)}</span></div>
                      </div>
                    </div>

                    {open && (
                      <div className="mt-3 text-sm">
                        <div className="text-xs font-medium mb-1">Dates in this month:</div>
                        {monthDates.length === 0 ? (
                          <div className="text-xs text-slate-400">No completions in this month yet.</div>
                        ) : (
                          <div className="flex gap-2 flex-wrap">
                            {monthDates.map((iso) => (
                              <div key={iso} className="px-2 py-1 rounded bg-slate-50 text-xs">{prettyDate(iso)}</div>
                            ))}
                          </div>
                        )}

                        <div className="mt-3 text-xs font-medium mb-1">Dates in this year:</div>
                        {yearDates.length === 0 ? (
                          <div className="text-xs text-slate-400">No completions in this year yet.</div>
                        ) : (
                          <div className="flex gap-2 flex-wrap">
                            {yearDates.map((iso) => (
                              <div key={iso} className="px-2 py-1 rounded bg-slate-50 text-xs">{iso}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => setOpenTaskId(open ? null : task.id)}
                        className="px-3 py-1 rounded bg-indigo-50 text-indigo-700 text-sm"
                      >
                        {open ? 'Close' : 'Details'}
                      </button>
                      <button
                        onClick={() => removeTask(task.id)}
                        className="px-3 py-1 rounded bg-rose-50 text-rose-700 text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </main>

        <footer className="mt-6 text-xs text-slate-400 text-center">Tip: Your data is stored locally in <code>{STORAGE_KEY}</code>. Export by copying the JSON if you want a backup.</footer>
      </div>
    </div>
  );
}
