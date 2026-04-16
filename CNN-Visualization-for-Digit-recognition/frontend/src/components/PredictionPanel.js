import React from 'react';

function PredictionPanel({ prediction, confidence }) {
  const hasPrediction = Number.isInteger(prediction);

  return (
    <section className="card prediction-card">
      <h2>Prediction</h2>
      {hasPrediction ? (
        <>
          <div className="digit-value">{prediction}</div>
          <div className="confidence-value">Confidence: {(confidence * 100).toFixed(2)}%</div>
        </>
      ) : (
        <p className="hint">Draw and click predict to see model output.</p>
      )}
    </section>
  );
}

export default PredictionPanel;
