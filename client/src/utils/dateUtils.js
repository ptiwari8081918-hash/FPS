export function getCurrentMonthString() {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${now.getFullYear()}-${m}-01`;
}

export function getCurrentMonthYear() {
  const now = new Date();
  return {
    month: String(now.getMonth() + 1),
    year: String(now.getFullYear()),
  };
}

export function generateMonthOptions(count = 24) {
  const out = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const m = String(d.getMonth() + 1);
    const y = String(d.getFullYear());
    const v = `${y}-${m.padStart(2, '0')}-01`;
    const label = d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const shortLabel = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
    out.push({
      v,
      m,
      y,
      val: `${m}-${y}`,
      l: i === 0 ? `${label} (Current Month)` : label,
      shortLabel: i === 0 ? `${shortLabel} (Current)` : shortLabel,
      fullLabel: i === 0 ? `${label} (Current Month)` : label,
      isCurrent: i === 0,
    });
  }
  return out;
}
