import { useState, useEffect, useCallback } from 'react';

// ─── STORAGE ─────────────────────────────────────────────────────────────────
// Dev: localStorage. Production (Vercel): Postgres via API.

const LS_KEY = 'farm-tracker-logs';

const local = {
  getAll: () => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
  },
  save: (logs) => localStorage.setItem(LS_KEY, JSON.stringify(logs)),
};

const IS_DEV = !import.meta.env.PROD;

const api = IS_DEV
  ? {
      getAll: () => Promise.resolve(local.getAll()),
      create: (item) => {
        const logs = local.getAll(); logs.push(item); local.save(logs);
        return Promise.resolve(item);
      },
      update: (item) => {
        local.save(local.getAll().map(l => l.id === item.id ? item : l));
        return Promise.resolve(item);
      },
      remove: (id) => {
        local.save(local.getAll().filter(l => l.id !== id));
        return Promise.resolve();
      },
    }
  : {
      getAll: () => fetch('/api/logs').then(r => r.json()),
      create: (item) => fetch('/api/logs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      }).then(r => r.json()),
      update: (item) => fetch(`/api/logs/${item.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      }).then(r => r.json()),
      remove: (id) => fetch(`/api/logs/${id}`, { method: 'DELETE' }),
    };

// ─── DATE HELPERS ────────────────────────────────────────────────────────────

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDay(ymd) {
  const d = new Date(ymd + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatWeekRange(start) {
  const end = addDays(start, 6);
  const s = start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const e = end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${s} – ${e}`;
}

function formatMonthLabel(ym) {
  const [y, m] = ym.split('-');
  return new Date(parseInt(y), parseInt(m) - 1, 1)
    .toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
}

function getWeekDates(weekStart) {
  return Array.from({ length: 7 }, (_, i) => toYMD(addDays(weekStart, i)));
}

function logsForWeek(logs, weekDates) {
  const set = new Set(weekDates);
  return logs.filter(l => set.has(l.date));
}

function summaryByLabourer(subset) {
  const map = {};
  for (const log of subset) {
    if (!map[log.labourerName]) {
      map[log.labourerName] = { name: log.labourerName, hours: 0, earned: 0, advance: 0, paid: 0 };
    }
    if (log.type === 'work') {
      map[log.labourerName].hours += log.hours || 0;
      map[log.labourerName].earned += log.amount || 0;
    } else if (log.type === 'advance') {
      map[log.labourerName].advance += log.amount || 0;
    } else if (log.type === 'payment') {
      map[log.labourerName].paid += log.amount || 0;
    }
  }
  return Object.values(map)
    .map(s => ({ ...s, pending: s.earned - s.advance - s.paid }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ─── THEME ───────────────────────────────────────────────────────────────────

const T = {
  bg:        '#f4f4f5',
  surface:   '#ffffff',
  border:    '#e4e4e7',
  text:      '#111',
  textSub:   '#71717a',
  textMuted: '#a1a1aa',
  green:     '#16a34a',
  greenBg:   '#dcfce7',
  amber:     '#b45309',
  amberBg:   '#fef3c7',
  red:       '#dc2626',
  redBg:     '#fee2e2',
  teal:      '#0d9488',
  tealBg:    '#ccfbf1',
};

const INPUT = {
  width: '100%', padding: '10px 14px', borderRadius: 10,
  border: `1.5px solid ${T.border}`, background: T.surface,
  color: T.text, fontSize: 15, fontFamily: 'inherit', outline: 'none',
};

const LABEL = {
  display: 'block', color: T.textSub, fontSize: 13, marginBottom: 5, fontWeight: 600,
};

const SECTION_LABEL = {
  color: T.textMuted, fontSize: 11, fontWeight: 700,
  letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10,
};

// ─── MODAL ───────────────────────────────────────────────────────────────────

function dateRangeDays(from, to) {
  const days = [];
  const end = new Date(to + 'T00:00:00');
  let cur = new Date(from + 'T00:00:00');
  while (cur <= end) {
    days.push(toYMD(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function Modal({ initial, knownNames, onSave, onClose }) {
  const isEdit = !!initial?.id;
  const [type, setType] = useState(initial?.type || 'work');
  const [labourerName, setLabourerName] = useState(initial?.labourerName || '');
  const [multiDay, setMultiDay] = useState(false);
  const [date, setDate] = useState(initial?.date || toYMD(new Date()));
  const [fromDate, setFromDate] = useState(initial?.date || toYMD(new Date()));
  const [toDate, setToDate] = useState(initial?.date || toYMD(new Date()));
  const [hours, setHours] = useState(initial?.hours != null ? String(initial.hours) : '');
  const [amount, setAmount] = useState(initial?.amount != null ? String(initial.amount) : '');
  const [notes, setNotes] = useState(initial?.notes || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const isKnownName = knownNames.includes(labourerName);

  const selectedDays = multiDay && fromDate && toDate && toDate >= fromDate
    ? dateRangeDays(fromDate, toDate)
    : null;
  const dayCount = selectedDays ? selectedDays.length : 0;

  function handleSubmit(e) {
    e.preventDefault();
    if (saving) return;
    setError('');
    if (!labourerName.trim()) return setError('Labourer name is required.');
    if (type === 'work' && !multiDay && (!hours || isNaN(hours) || Number(hours) <= 0))
      return setError('Enter valid hours worked.');
    if (!amount || isNaN(amount) || Number(amount) < 0)
      return setError('Enter a valid amount.');

    setSaving(true);

    let payload;
    if (multiDay && !isEdit) {
      if (!fromDate) { setSaving(false); return setError('From date is required.'); }
      if (!toDate)   { setSaving(false); return setError('To date is required.'); }
      if (toDate < fromDate) { setSaving(false); return setError('End date must be on or after start date.'); }
      const baseId = Date.now();
      payload = selectedDays.map((d, i) => ({
        id: `${baseId}_${i}`,
        type,
        labourerName: labourerName.trim(),
        date: d,
        hours: type === 'work' ? Number(hours) : 0,
        amount: Number(amount),
        notes: notes.trim(),
        createdAt: new Date().toISOString(),
      }));
    } else {
      if (!date) { setSaving(false); return setError('Date is required.'); }
      payload = {
        ...(initial || {}),
        id: initial?.id || Date.now().toString(),
        type,
        labourerName: labourerName.trim(),
        date,
        hours: type === 'work' ? Number(hours) : 0,
        amount: Number(amount),
        notes: notes.trim(),
        createdAt: initial?.createdAt || new Date().toISOString(),
      };
    }

    Promise.resolve(onSave(payload)).catch(() => {
      setSaving(false);
      setError('Failed to save. Please try again.');
    });
  }

  const accent   = type === 'work' ? T.green : T.amber;
  const accentBg = type === 'work' ? T.greenBg : T.amberBg;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: T.surface, borderRadius: 18, padding: 24,
        width: '100%', maxWidth: 440,
        border: `1px solid ${T.border}`,
        boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <h2 style={{ color: T.text, marginBottom: 20, fontSize: 18, fontWeight: 700 }}>
          {isEdit ? 'Edit Entry' : 'Add Entry'}
        </h2>

        {/* Type toggle */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[
            { key: 'work',    label: '⛏ Work',    bg: T.greenBg, color: T.green },
            { key: 'advance', label: '💰 Advance', bg: T.amberBg, color: T.amber },
            { key: 'payment', label: '💳 Paid',    bg: T.tealBg,  color: T.teal  },
          ].map(({ key, label, bg, color }) => (
            <button
              key={key} type="button" onClick={() => setType(key)}
              style={{
                flex: 1, padding: '9px 0', borderRadius: 10, cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                border: type === key ? `2px solid ${color}` : `1.5px solid ${T.border}`,
                background: type === key ? bg : T.surface,
                color: type === key ? color : T.textMuted,
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Labourer name with chip selection */}
            <div>
              <label style={LABEL}>Labourer Name</label>
              {knownNames.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                  {knownNames.map(name => {
                    const selected = labourerName === name;
                    return (
                      <button
                        key={name} type="button"
                        onClick={() => setLabourerName(selected ? '' : name)}
                        style={{
                          padding: '7px 14px', borderRadius: 20, cursor: 'pointer',
                          fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
                          border: selected ? `2px solid ${T.green}` : `1.5px solid ${T.border}`,
                          background: selected ? T.greenBg : T.surface,
                          color: selected ? T.green : T.textSub,
                          transition: 'all 0.12s',
                        }}
                      >
                        {selected ? '✓ ' : ''}{name}
                      </button>
                    );
                  })}
                </div>
              )}
              <input
                style={INPUT}
                value={isKnownName ? '' : labourerName}
                placeholder={
                  isKnownName ? `Selected: ${labourerName}`
                  : knownNames.length > 0 ? 'Or type a new name...'
                  : 'e.g. Ramu'
                }
                autoFocus={knownNames.length === 0}
                autoComplete="off"
                onChange={e => setLabourerName(e.target.value)}
              />
            </div>

            {/* Date — single or multi-day */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ ...LABEL, marginBottom: 0 }}>Date</label>
                {!isEdit && (
                  <button
                    type="button"
                    onClick={() => setMultiDay(m => !m)}
                    style={{
                      padding: '4px 10px', borderRadius: 8, cursor: 'pointer',
                      fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                      border: multiDay ? `1.5px solid #6366f1` : `1.5px solid ${T.border}`,
                      background: multiDay ? '#eef2ff' : T.surface,
                      color: multiDay ? '#4f46e5' : T.textSub,
                    }}
                  >
                    {multiDay ? '✓ Multiple days' : '+ Multiple days'}
                  </button>
                )}
              </div>

              {multiDay && !isEdit ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: T.textMuted, fontSize: 12, marginBottom: 4, fontWeight: 600 }}>FROM</div>
                      <input type="date" style={INPUT} value={fromDate} onChange={e => setFromDate(e.target.value)} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: T.textMuted, fontSize: 12, marginBottom: 4, fontWeight: 600 }}>TO</div>
                      <input type="date" style={INPUT} value={toDate} min={fromDate} onChange={e => setToDate(e.target.value)} />
                    </div>
                  </div>
                  {dayCount > 0 && (
                    <div style={{
                      background: '#eef2ff', border: '1px solid #c7d2fe',
                      borderRadius: 8, padding: '8px 12px',
                      fontSize: 13, color: '#4f46e5', fontWeight: 600,
                    }}>
                      {dayCount} day{dayCount !== 1 ? 's' : ''} selected
                      {type === 'work' && amount
                        ? ` · Total ₹${(dayCount * Number(amount)).toLocaleString('en-IN')}`
                        : ''}
                    </div>
                  )}
                </div>
              ) : (
                <input type="date" style={INPUT} value={date} onChange={e => setDate(e.target.value)} />
              )}
            </div>

            {type === 'work' && (
              <div>
                <label style={LABEL}>Hours Worked{multiDay && !isEdit ? ' (per day)' : ''}</label>

                <input
                  type="number" min="0" max="24" step="0.5" style={INPUT}
                  value={hours} placeholder="e.g. 8"
                  onChange={e => setHours(e.target.value)}
                />
              </div>
            )}

            <div>
              <label style={LABEL}>
                {type === 'work'
                  ? `Payment Amount (₹)${multiDay && !isEdit ? ' per day' : ''}`
                  : type === 'advance'
                  ? 'Advance Amount (₹)'
                  : 'Amount Paid (₹)'}
              </label>
              <input
                type="number" min="0" style={INPUT}
                value={amount} placeholder="e.g. 500"
                onChange={e => setAmount(e.target.value)}
              />
            </div>

            <div>
              <label style={LABEL}>Notes (optional)</label>
              <input
                style={INPUT} value={notes} placeholder="Any notes..."
                onChange={e => setNotes(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p style={{ color: T.red, fontSize: 13, marginTop: 12, fontWeight: 500 }}>{error}</p>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button
              type="button" onClick={onClose}
              style={{
                flex: 1, padding: '11px 0', borderRadius: 10,
                border: `1.5px solid ${T.border}`, background: 'transparent',
                color: T.textSub, fontFamily: 'inherit', fontSize: 15, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{
                flex: 2, padding: '11px 0', borderRadius: 10, border: 'none',
                background: accentBg, color: accent,
                fontFamily: 'inherit', fontSize: 15, fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
                opacity: saving ? 0.6 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : multiDay && dayCount > 1 ? `Add ${dayCount} Entries` : 'Add Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── LOG CARD ────────────────────────────────────────────────────────────────

function LogCard({ log, onEdit, onDelete }) {
  const isWork    = log.type === 'work';
  const isPayment = log.type === 'payment';
  const color  = isWork ? T.green : isPayment ? T.teal : T.amber;
  const iconBg = isWork ? T.greenBg : isPayment ? T.tealBg : T.amberBg;
  const icon   = isWork ? '⛏' : isPayment ? '💳' : '💰';
  const subtitle = isWork
    ? `${log.hours}h worked`
    : isPayment
    ? 'Payment settled'
    : 'Advance taken';

  return (
    <div className="row" style={{
      background: T.surface, borderRadius: 12, padding: '11px 12px',
      border: `1.5px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: T.text, fontSize: 14 }}>{log.labourerName}</div>
        <div style={{ color: T.textSub, fontSize: 12, marginTop: 1 }}>
          {subtitle}{log.notes ? ` · ${log.notes}` : ''}
        </div>
      </div>
      <div style={{ fontWeight: 700, fontSize: 14, color, flexShrink: 0 }}>
        ₹{log.amount.toLocaleString('en-IN')}
      </div>
      <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
        <button
          onClick={() => onEdit(log)}
          style={{
            padding: '4px 8px', borderRadius: 7, border: `1.5px solid ${T.border}`,
            background: 'transparent', color: T.textSub, cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 12,
          }}
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(log.id)}
          style={{
            padding: '4px 7px', borderRadius: 7, border: `1.5px solid #fecaca`,
            background: 'transparent', color: T.red, cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 12,
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ─── SUMMARY CARD ────────────────────────────────────────────────────────────

function SummaryCard({ s }) {
  const pending = s.pending ?? (s.earned - s.advance);
  const pendingColor = pending <= 0 ? T.green : T.red;
  const pendingBg    = pending <= 0 ? T.greenBg : T.redBg;
  const pendingLabel = pending <= 0 ? 'Settled' : `Due ₹${pending.toLocaleString('en-IN')}`;

  return (
    <div style={{
      background: T.surface, borderRadius: 14, padding: '14px 16px', border: `1px solid ${T.border}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: T.text }}>{s.name}</div>
        <div style={{
          padding: '4px 10px', borderRadius: 8, fontWeight: 700, fontSize: 13,
          background: pendingBg, color: pendingColor,
        }}>
          {pendingLabel}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <StatBox label="HOURS"   value={`${s.hours}h`}                           color={T.text} />
        <StatBox label="EARNED"  value={`₹${s.earned.toLocaleString('en-IN')}`}  color={T.green} />
        <StatBox label="ADVANCE" value={`₹${s.advance.toLocaleString('en-IN')}`} color={T.amber} />
        {s.paid > 0 && (
          <StatBox label="PAID" value={`₹${s.paid.toLocaleString('en-IN')}`} color={T.teal} />
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div style={{ flex: 1, background: T.bg, borderRadius: 10, padding: '10px 12px' }}>
      <div style={{ color: T.textMuted, fontSize: 10, marginBottom: 4, fontWeight: 700, letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ color, fontWeight: 700, fontSize: 16 }}>{value}</div>
    </div>
  );
}

// ─── REPORTS PAGE ────────────────────────────────────────────────────────────

function ReportsPage({ logs }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [expandedMonth, setExpandedMonth] = useState(null);

  const yearLogs = logs.filter(l => l.date.startsWith(String(year)));
  const yearlySummary = summaryByLabourer(yearLogs);

  const months = [...new Set(yearLogs.map(l => l.date.slice(0, 7)))]
    .sort()
    .reverse();

  const minYear = logs.length > 0
    ? Math.min(...logs.map(l => parseInt(l.date.slice(0, 4))))
    : currentYear;

  return (
    <div>
      {/* Year selector */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: T.surface, borderRadius: 12, padding: '10px 14px',
        border: `1px solid ${T.border}`, marginBottom: 20,
      }}>
        <button
          onClick={() => { setYear(y => y - 1); setExpandedMonth(null); }}
          disabled={year <= minYear}
          style={{
            background: 'transparent', border: 'none', fontSize: 20, lineHeight: 1,
            color: year <= minYear ? T.border : T.textSub,
            cursor: year <= minYear ? 'default' : 'pointer', padding: '0 4px',
          }}
        >
          ‹
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: T.text }}>{year}</div>
          <div style={{ color: T.textMuted, fontSize: 12, marginTop: 1 }}>
            {year === currentYear ? 'Current Year' : `${currentYear - year} year${currentYear - year !== 1 ? 's' : ''} ago`}
          </div>
        </div>
        <button
          onClick={() => { setYear(y => y + 1); setExpandedMonth(null); }}
          disabled={year >= currentYear}
          style={{
            background: 'transparent', border: 'none', fontSize: 20, lineHeight: 1,
            color: year >= currentYear ? T.border : T.textSub,
            cursor: year >= currentYear ? 'default' : 'pointer', padding: '0 4px',
          }}
        >
          ›
        </button>
      </div>

      {yearlySummary.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '52px 0',
          border: `1.5px dashed ${T.border}`, borderRadius: 16,
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.textSub }}>No data for {year}</div>
        </div>
      ) : (
        <>
          {/* Yearly totals */}
          <section style={{ marginBottom: 24 }}>
            <div style={SECTION_LABEL}>Yearly Totals — {year}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {yearlySummary.map(s => <SummaryCard key={s.name} s={s} />)}
            </div>
          </section>

          {/* Monthly breakdown */}
          <section>
            <div style={SECTION_LABEL}>Monthly Breakdown</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {months.map(ym => {
                const monthLogs = yearLogs.filter(l => l.date.startsWith(ym));
                const monthSummary = summaryByLabourer(monthLogs);
                const totalHours = monthSummary.reduce((s, l) => s + l.hours, 0);
                const totalEarned = monthSummary.reduce((s, l) => s + l.earned, 0);
                const totalAdvance = monthSummary.reduce((s, l) => s + l.advance, 0);
                const isExpanded = expandedMonth === ym;

                return (
                  <div key={ym}>
                    <button
                      onClick={() => setExpandedMonth(isExpanded ? null : ym)}
                      style={{
                        width: '100%', background: T.surface, cursor: 'pointer',
                        fontFamily: 'inherit', textAlign: 'left',
                        border: `1px solid ${T.border}`,
                        borderRadius: isExpanded ? '12px 12px 0 0' : 12,
                        padding: '14px 16px',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: T.text }}>
                          {formatMonthLabel(ym)}
                        </div>
                        <div style={{ color: T.textSub, fontSize: 13, marginTop: 3 }}>
                          {totalHours}h · ₹{totalEarned.toLocaleString('en-IN')} earned
                          {totalAdvance > 0 ? ` · ₹${totalAdvance.toLocaleString('en-IN')} advance` : ''}
                          {' · '}{monthSummary.length} labourer{monthSummary.length !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <span style={{ color: T.textMuted, fontSize: 16, flexShrink: 0, marginLeft: 8 }}>
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    </button>
                    {isExpanded && (
                      <div style={{
                        border: `1px solid ${T.border}`, borderTop: 'none',
                        borderRadius: '0 0 12px 12px', padding: 12,
                        background: T.bg, display: 'flex', flexDirection: 'column', gap: 8,
                      }}>
                        {monthSummary.map(s => <SummaryCard key={s.name} s={s} />)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

export default function App() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState('tracker'); // 'tracker' | 'reports'
  const [weekOffset, setWeekOffset] = useState(0);
  const [modal, setModal] = useState(null);
  const [editingLog, setEditingLog] = useState(null);
  const [filterLabourer, setFilterLabourer] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const today = toYMD(new Date());
  const weekStart = getMonday(addDays(new Date(), weekOffset * 7));
  const weekDates = getWeekDates(weekStart);
  const weekLogs = logsForWeek(logs, weekDates);
  const summary = summaryByLabourer(weekLogs);

  const filteredLogs = filterLabourer
    ? weekLogs.filter(l => l.labourerName === filterLabourer)
    : weekLogs;

  // Flat list for pagination: sorted by date (Mon→Sun), then labourer name
  const allEntries = weekDates.flatMap(date =>
    filteredLogs
      .filter(l => l.date === date)
      .sort((a, b) => a.labourerName.localeCompare(b.labourerName))
  );
  const visibleEntries = allEntries.slice(0, visibleCount);
  const hasMore = visibleCount < allEntries.length;

  const allLabourers = [...new Set(logs.map(l => l.labourerName))].sort();
  const visibleSummary = filterLabourer ? summary.filter(s => s.name === filterLabourer) : summary;

  useEffect(() => {
    api.getAll().then(data => { setLogs(data); setLoading(false); });
  }, []);

  // Reset pagination when week or filter changes
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [weekOffset, filterLabourer]);

  const handleSave = useCallback(async (entryOrEntries) => {
    const entries = Array.isArray(entryOrEntries) ? entryOrEntries : [entryOrEntries];
    const results = [];
    for (const entry of entries) {
      if (logs.find(l => l.id === entry.id)) {
        const updated = await api.update(entry);
        results.push({ type: 'update', entry: updated });
      } else {
        const created = await api.create(entry);
        results.push({ type: 'create', entry: created });
      }
    }
    setLogs(prev => {
      let next = [...prev];
      for (const { type, entry } of results) {
        if (type === 'update') next = next.map(l => l.id === entry.id ? entry : l);
        else next = [...next, entry];
      }
      return next;
    });
    setModal(null);
    setEditingLog(null);
  }, [logs]);

  const handleDelete = useCallback(async (id) => {
    if (!confirm('Delete this entry?')) return;
    await api.remove(id);
    setLogs(prev => prev.filter(l => l.id !== id));
  }, []);

  const openEdit   = useCallback((log) => { setEditingLog(log); setModal('edit'); }, []);
  const openAdd    = useCallback((type) => { setEditingLog({ type, date: today }); setModal('add'); }, [today]);
  const isCurrentWeek = weekOffset === 0;

  return (
    <div style={{ minHeight: '100vh', background: T.bg, color: T.text }}>
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 16px 80px' }}>

        {/* ── Header ── */}
        <div style={{
          padding: '18px 0 12px', position: 'sticky', top: 0,
          background: T.bg, zIndex: 20,
          borderBottom: `1px solid ${T.border}`, marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: 20, fontWeight: 800, color: T.text, letterSpacing: -0.5, whiteSpace: 'nowrap' }}>
                🌾 Farm Tracker
              </h1>
              <p style={{ color: T.textSub, fontSize: 11, marginTop: 2 }}>Labour & Payment Manager</p>
            </div>
            {activePage === 'tracker' && (
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  onClick={() => openAdd('work')}
                  style={{
                    padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
                    border: `2px solid ${T.green}`, background: T.greenBg, color: T.green,
                    fontWeight: 700, fontFamily: 'inherit', fontSize: 13, whiteSpace: 'nowrap',
                  }}
                >
                  + Work
                </button>
                <button
                  onClick={() => openAdd('advance')}
                  style={{
                    padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
                    border: `2px solid ${T.amber}`, background: T.amberBg, color: T.amber,
                    fontWeight: 700, fontFamily: 'inherit', fontSize: 13, whiteSpace: 'nowrap',
                  }}
                >
                  + Advance
                </button>
                <button
                  onClick={() => openAdd('payment')}
                  style={{
                    padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
                    border: `2px solid ${T.teal}`, background: T.tealBg, color: T.teal,
                    fontWeight: 700, fontFamily: 'inherit', fontSize: 13, whiteSpace: 'nowrap',
                  }}
                >
                  + Paid
                </button>
              </div>
            )}
          </div>

          {/* Page tabs */}
          <div style={{ display: 'flex', gap: 6, background: T.surface, borderRadius: 10, padding: 4, border: `1px solid ${T.border}` }}>
            {[
              { key: 'tracker', label: '📅 Tracker' },
              { key: 'reports', label: '📊 Reports' },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActivePage(key)}
                className="tab"
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
                  background: activePage === key ? T.bg : 'transparent',
                  color: activePage === key ? T.text : T.textMuted,
                  fontWeight: activePage === key ? 700 : 500,
                  fontFamily: 'inherit', fontSize: 14,
                  boxShadow: activePage === key ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Dev banner ── */}
        {IS_DEV && (
          <div style={{
            background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10,
            padding: '8px 14px', marginBottom: 14, fontSize: 13, color: '#92400e',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <span>🧪</span>
            <span>Dev mode — data saved to browser localStorage (not Postgres)</span>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', color: T.textMuted, padding: 60, fontSize: 15 }}>
            Loading...
          </div>
        ) : activePage === 'reports' ? (
          <ReportsPage logs={logs} />
        ) : (
          <>
            {/* ── Week navigator ── */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: T.surface, borderRadius: 12, padding: '10px 14px',
              border: `1px solid ${T.border}`, marginBottom: 14,
            }}>
              <button
                onClick={() => setWeekOffset(w => w - 1)}
                style={{
                  background: 'transparent', border: 'none', color: T.textSub,
                  cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 4px',
                }}
              >
                ‹
              </button>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: T.text }}>
                  {isCurrentWeek ? 'This Week' : weekOffset === -1 ? 'Last Week' : `${Math.abs(weekOffset)} weeks ago`}
                </div>
                <div style={{ color: T.textMuted, fontSize: 12, marginTop: 2 }}>
                  {formatWeekRange(weekStart)}
                </div>
              </div>
              <button
                onClick={() => setWeekOffset(w => w + 1)}
                disabled={isCurrentWeek}
                style={{
                  background: 'transparent', border: 'none',
                  color: isCurrentWeek ? T.border : T.textSub,
                  cursor: isCurrentWeek ? 'default' : 'pointer',
                  fontSize: 20, lineHeight: 1, padding: '0 4px',
                }}
              >
                ›
              </button>
            </div>

            {/* ── Labourer filter chips ── */}
            {allLabourers.length > 1 && (
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, marginBottom: 14 }}>
                <button
                  onClick={() => setFilterLabourer('')} className="tab"
                  style={{
                    padding: '6px 14px', borderRadius: 20, whiteSpace: 'nowrap',
                    border: !filterLabourer ? `1.5px solid ${T.green}` : `1.5px solid ${T.border}`,
                    background: !filterLabourer ? T.greenBg : T.surface,
                    color: !filterLabourer ? T.green : T.textSub,
                    fontSize: 13, fontWeight: 600,
                  }}
                >
                  All
                </button>
                {allLabourers.map(name => (
                  <button
                    key={name}
                    onClick={() => setFilterLabourer(filterLabourer === name ? '' : name)}
                    className="tab"
                    style={{
                      padding: '6px 14px', borderRadius: 20, whiteSpace: 'nowrap',
                      border: filterLabourer === name ? `1.5px solid ${T.green}` : `1.5px solid ${T.border}`,
                      background: filterLabourer === name ? T.greenBg : T.surface,
                      color: filterLabourer === name ? T.green : T.textSub,
                      fontSize: 13, fontWeight: 600,
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}

            {/* ── Weekly summary ── */}
            {visibleSummary.length > 0 && (
              <section style={{ marginBottom: 20 }}>
                <div style={SECTION_LABEL}>Weekly Summary</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {visibleSummary.map(s => <SummaryCard key={s.name} s={s} />)}
                </div>
              </section>
            )}

            {/* ── Daily entries (paginated) ── */}
            <section>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={SECTION_LABEL}>Daily Entries</div>
                {allEntries.length > 0 && (
                  <div style={{ color: T.textMuted, fontSize: 12 }}>
                    {Math.min(visibleCount, allEntries.length)} of {allEntries.length}
                  </div>
                )}
              </div>

              {allEntries.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: '52px 0',
                  border: `1.5px dashed ${T.border}`, borderRadius: 16,
                }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>🌾</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: T.textSub }}>
                    No entries this week
                  </div>
                  <div style={{ fontSize: 13, marginTop: 6, color: T.textMuted }}>
                    Tap + Work or + Advance to add an entry
                  </div>
                </div>
              ) : (
                <>
                  {weekDates.map(date => {
                    const dayLogs = visibleEntries.filter(l => l.date === date);
                    if (dayLogs.length === 0) return null;
                    return (
                      <div key={date} style={{ marginBottom: 18 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <span style={{
                            fontSize: 13, fontWeight: 600,
                            color: date === today ? T.green : T.textSub,
                          }}>
                            {formatDay(date)}
                          </span>
                          {date === today && (
                            <span style={{
                              fontSize: 11, background: T.greenBg, color: T.green,
                              padding: '2px 8px', borderRadius: 6, fontWeight: 700,
                            }}>
                              Today
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {dayLogs.map(log => (
                            <LogCard key={log.id} log={log} onEdit={openEdit} onDelete={handleDelete} />
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {hasMore && (
                    <button
                      onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                      style={{
                        width: '100%', padding: '12px 0', borderRadius: 12,
                        border: `1.5px solid ${T.border}`, background: T.surface,
                        color: T.textSub, fontFamily: 'inherit', fontSize: 14,
                        fontWeight: 600, cursor: 'pointer', marginTop: 4,
                      }}
                    >
                      Load more ({allEntries.length - visibleCount} remaining)
                    </button>
                  )}
                </>
              )}
            </section>
          </>
        )}
      </div>

      {/* ── Modal ── */}
      {(modal === 'add' || modal === 'edit') && (
        <Modal
          initial={editingLog}
          knownNames={allLabourers}
          onSave={handleSave}
          onClose={() => { setModal(null); setEditingLog(null); }}
        />
      )}
    </div>
  );
}
