'use client';

const EXAMPLES = [
  { label: 'Broken flag demo', repo: 'github.com/PeytonLi/readme-verifier-demo' },
  { label: 'Multi-path demo', repo: 'github.com/PeytonLi/readme-verifier-demo-multipath' },
];

export function LaunchPad({
  repo,
  running,
  onChange,
  onRun,
  onReset,
}: {
  repo: string;
  running: boolean;
  onChange: (value: string) => void;
  onRun: () => void;
  onReset: () => void;
}) {
  return (
    <section className="launch">
      <label className="launch-label" htmlFor="repo-input">
        GitHub repository
      </label>
      <div className="launch-row">
        <input
          id="repo-input"
          className="repo-input"
          placeholder="github.com/owner/repo"
          value={repo}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onRun()}
          spellCheck={false}
          autoComplete="off"
          disabled={running}
        />
        <button type="button" className="btn primary" onClick={onRun} disabled={running || !repo.trim()}>
          {running ? 'Verifying…' : 'Verify README'}
        </button>
        <button type="button" className="btn ghost" onClick={onReset} disabled={running}>
          Reset
        </button>
      </div>
      <div className="launch-examples">
        <span className="muted">Try a demo:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex.repo}
            type="button"
            className="chip"
            disabled={running}
            onClick={() => onChange(ex.repo)}
          >
            {ex.label}
          </button>
        ))}
      </div>
    </section>
  );
}
