'use client';

import { motion } from 'motion/react';

const EXAMPLES = [
  { label: 'Broken flag demo', repo: 'github.com/PeytonLi/readme-verifier-demo' },
  { label: 'Multi-path demo', repo: 'github.com/PeytonLi/readme-verifier-demo-multipath' },
];

function RepoIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 16.5c.8.7 2 .9 3.5.9s2.7-.2 3.5-.9M8 8.5c1.1-.8 2.4-1.2 4-1.2s2.9.4 4 1.2M9 11h.01M15 11h.01" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M5 12h14m-5-5 5 5-5 5" />
    </svg>
  );
}

export function LaunchPad({
  repo,
  running,
  locked = false,
  onChange,
  onRun,
  onReset,
}: {
  repo: string;
  running: boolean;
  locked?: boolean;
  onChange: (value: string) => void;
  onRun: () => void;
  onReset: () => void;
}) {
  return (
    <motion.section
      className="launch"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08, duration: 0.32 }}
    >
      <div className="launch-heading">
        <label className="launch-label" htmlFor="repo-input">
          Launch a verification
        </label>
        <span className="launch-hint">Public GitHub repositories</span>
      </div>
      <div className={`launch-command${running ? ' is-running' : ''}`}>
        <span className="repo-icon" aria-hidden>
          <RepoIcon />
        </span>
        <input
          id="repo-input"
          className="repo-input"
          placeholder="github.com/owner/repository"
          value={repo}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onRun()}
          spellCheck={false}
          autoComplete="off"
          disabled={running || locked}
        />
        <div className="launch-actions">
          <motion.button
            type="button"
            className="btn ghost"
            onClick={onReset}
            disabled={running || locked}
            whileTap={{ scale: 0.97 }}
          >
            Reset
          </motion.button>
          <motion.button
            type="button"
            className="btn primary"
            onClick={onRun}
            disabled={running || locked || !repo.trim()}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
          >
            {locked ? (
              'Review checkpoint'
            ) : running ? (
              <>
                <span className="button-loader" aria-hidden />
                Verifying
              </>
            ) : (
              <>
                Verify README
                <ArrowIcon />
              </>
            )}
          </motion.button>
        </div>
      </div>
      <div className="launch-examples">
        <span className="example-label">Quick starts</span>
        {EXAMPLES.map((ex) => (
          <motion.button
            key={ex.repo}
            type="button"
            className="chip"
            disabled={running || locked}
            onClick={() => onChange(ex.repo)}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.97 }}
          >
            {ex.label}
          </motion.button>
        ))}
      </div>
    </motion.section>
  );
}
