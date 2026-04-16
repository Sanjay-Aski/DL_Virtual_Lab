import React from 'react';

function ProbabilityChart({ probabilities = [], predictedDigit }) {
  return (
    <section className="card chart-card">
      <h2>Class Probabilities (0-9)</h2>
      <div className="probability-list">
        {Array.from({ length: 10 }).map((_, digit) => {
          const probability = probabilities[digit] ?? 0;
          const isActive = predictedDigit === digit;

          return (
            <div className="prob-row" key={digit}>
              <span className="prob-label">{digit}</span>
              <div className="prob-track" role="img" aria-label={`Digit ${digit} probability ${(probability * 100).toFixed(1)} percent`}>
                <div
                  className={`prob-fill ${isActive ? 'active' : ''}`}
                  style={{ width: `${Math.max(probability * 100, 1)}%` }}
                />
              </div>
              <span className="prob-value">{(probability * 100).toFixed(1)}%</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default ProbabilityChart;
