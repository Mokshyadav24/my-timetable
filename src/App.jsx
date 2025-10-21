import React, { useEffect, useState, useRef } from 'react';
import { initGoogleDrive, loadDriveData, saveDriveData } from './drive';

function todayISO(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

export default function App() {
  const [data, setData] = useState(null);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [openTaskId, setOpenTaskId] = useState(null);
  const saveTimer = useRef(null);

  // load from Drive on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await initGoogleDrive();
        const remote = await loadDriveData();
        if (mounted) setData(remote);
      } catch (e) {
        console.error('Drive load error', e);
        if (mounted) setData({ tasks: [], history: {}, lastActiveDate: todayISO() });
      }
    })();
    return () => { mounted = false; };
  }, []);

  // persist (debounced)
  function persist(updated) {
    setData(updated);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveDriveData(updated).catch(err => console.error('save failed', err));
    }, 900);
  }

  if (!data) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center text-slate-600">Loading and signing in to Google Drive... (you may see a consent popup)</div>
    </div>
  );

  function toggleTaskToday(taskId) {
    const date = todayISO();
    const history = { ...(data.history || {}) };
    if (!history[taskId]) history[taskId] = {};
    if (history[taskId][date]) delete history[taskId][date];
    else history[taskId][date] = true;
    const updated = { ...data, history };
    persist(updated);
  }

  function isTaskDoneOn(taskId, isoDate) {
    return !!(data.history && data.history[taskId] && data.history[taskId][isoDate]);
  }

  function addTask() {
    const title = newTaskTitle.trim();
    if (!title) return;
    const id = 't' + Date.now();
    const tasks = [...(data.tasks || []), { id, title }];
    const updated = { ...data, tasks };
    setNewTaskTitle('');
    persist(updated);
  }

  function removeTask(id) {
    const tasks = (data.tasks || []).filter(t => t.id !== id);
    const history = { ...(data.history || {}) };
    delete history[id];
    const updated = { ...data, tasks, history };
    persist(updated);
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  function datesForTaskInRange(taskId, startISO, endISO) {
    const res = [];
    const h = data.history[taskId] || {};
    Object.keys(h).forEach((iso) => {
      if (iso >= startISO && iso <= endISO) res.push(iso);
    });
    res.sort();
    return res;
  }

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

  function countThisMonth(taskId) { return datesInCurrentMonth(taskId).length; }
  function countThisYear(taskId) { return datesInCurrentYear(taskId).length; }

  function buildMonthGrid(taskId) {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const weekdayOfFirst = firstDay.getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const completedSet = new Set(datesInCurrentMonth(taskId));
    const cells = [];
    for (let i = 0; i < weekdayOfFirst; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = new Date(currentYear, currentMonth, d).toISOString().slice(0, 10);
      cells.push({ day: d, iso, done: completedSet.has(iso) });
    }
    return cells;
  }

  function todayProgress() {
    const total = (data.tasks || []).length || 1;
    const done = (data.tasks || []).filter(t => isTaskDoneOn(t.id, todayISO())).length;
    return Math.round((done / total) * 100);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white p-6">
      <div className="max-w-6xl mx-auto bg-white shadow-2xl rounded-3xl p-6">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">Daily Timetable (Drive sync)</h1>
            <p className="text-sm text-slate-500 mt-1">Your data is saved to your Google Drive automatically.</p>
          </div>

          <div className="text-right">
            <div className="text-sm text-slate-400">Today</div>
            <div className="text-xl font-semibold">{now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</div>
            <div className="mt-2 text-xs text-slate-400">Signed in: Google Drive (appData)</div>
          </div>
        </header>

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
          <section className="space-y-4">
            <div className="flex gap-2">
              <input value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} placeholder="Add a new task" className="flex-1 px-4 py-2 border rounded-lg focus:outline-none" />
              <button onClick={addTask} className="px-4 py-2 rounded-lg bg-indigo-600 text-white">Add</button>
            </div>

            <div className="bg-slate-50 border rounded-lg p-3">
              {(data.tasks || []).length === 0 ? (
                <div className="text-sm text-slate-500">No tasks yet — add one above.</div>
              ) : (
                <ul className="space-y-3">
                  {data.tasks.map(task => (
                    <li key={task.id} className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <label className="inline-flex items-center gap-3">
                          <input type="checkbox" checked={isTaskDoneOn(task.id, todayISO())} onChange={() => toggleTaskToday(task.id)} className="w-5 h-5 rounded" />
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
                          <button onClick={() => setOpenTaskId(openTaskId === task.id ? null : task.id)} className="px-3 py-1 rounded bg-white border text-sm">Details</button>
                          <button onClick={() => removeTask(task.id)} className="px-3 py-1 rounded bg-rose-50 text-rose-700 border text-sm">Delete</button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <div className="bg-slate-50 border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm text-slate-500">Calendar — {now.toLocaleString(undefined, { month: 'long' })} {currentYear}</div>
                  <div className="font-medium">Tap a task's Details to highlight its days</div>
                </div>
              </div>

              <div className="text-xs text-slate-500 mb-2">Legend: filled = completed</div>

              <div className="grid grid-cols-7 gap-1">
                {['S','M','T','W','T','F','S'].map(d => <div key={d} className="text-center text-[11px] text-slate-400">{d}</div>)}

                {(() => {
                  const taskForCalendar = openTaskId || null;
                  const cells = buildMonthGrid(taskForCalendar || (data.tasks[0] && data.tasks[0].id) || null);
                  const aggregateSet = new Set();
                  if (!taskForCalendar) {
                    (data.tasks || []).forEach(t => datesInCurrentMonth(t.id).forEach(iso => aggregateSet.add(iso)));
                  }
                  return cells.map((c, idx) => {
                    if (c === null) return <div key={idx} className="h-8" />;
                    const done = taskForCalendar ? c.done : aggregateSet.has(c.iso);
                    const isToday = c.iso === todayISO();
                    return (
                      <div key={idx} className={`h-8 rounded flex items-center justify-center text-sm ${done ? 'bg-indigo-600 text-white' : 'bg-white'} ${isToday ? 'ring-2 ring-indigo-300' : ''}`}>
                        {c.day}
                      </div>
                    );
                  })
                })()}
              </div>
            </div>

            <div className="space-y-3">
              {(data.tasks || []).map(task => {
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
                        {monthDates.length === 0 ? <div className="text-xs text-slate-400">No completions in this month yet.</div> : (
                          <div className="flex gap-2 flex-wrap">
                            {monthDates.map(iso => <div key={iso} className="px-2 py-1 rounded bg-slate-50 text-xs">{new Date(iso + 'T00:00:00').toLocaleDateString()}</div>)}
                          </div>
                        )}

                        <div className="mt-3 text-xs font-medium mb-1">Dates in this year:</div>
                        {yearDates.length === 0 ? <div className="text-xs text-slate-400">No completions in this year yet.</div> : (
                          <div className="flex gap-2 flex-wrap">
                            {yearDates.map(iso => <div key={iso} className="px-2 py-1 rounded bg-slate-50 text-xs">{iso}</div>)}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mt-3 flex gap-2">
                      <button onClick={() => setOpenTaskId(open ? null : task.id)} className="px-3 py-1 rounded bg-indigo-50 text-indigo-700 text-sm">{open ? 'Close' : 'Details'}</button>
                      <button onClick={() => removeTask(task.id)} className="px-3 py-1 rounded bg-rose-50 text-rose-700 text-sm">Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </main>

        <footer className="mt-6 text-xs text-slate-400 text-center">Tip: your Drive file is named <code>timetable_data_v2.json</code> in the Drive appDataFolder.</footer>
      </div>
    </div>
  );
}
