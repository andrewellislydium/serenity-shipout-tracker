const f = document.getElementById('f'), err = document.getElementById('err'), go = document.getElementById('go'), pc = document.getElementById('pc');
f.addEventListener('submit', async e => {
  e.preventDefault();
  err.textContent = '';
  if (!pc.value) { err.textContent = 'Enter the passcode.'; return; }
  go.disabled = true;
  try {
    const r = await fetch('/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passcode: pc.value }) });
    if (r.ok) { location.href = '/' + location.hash; return; }
    const d = await r.json().catch(() => ({}));
    err.textContent = d.error || 'Sign in failed.';
    pc.select();
  } catch {
    err.textContent = 'Could not reach the server. Check your connection and try again.';
  } finally {
    go.disabled = false;
  }
});
