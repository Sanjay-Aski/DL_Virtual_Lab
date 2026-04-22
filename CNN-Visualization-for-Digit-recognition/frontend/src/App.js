import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import './App.css';
import CanvasComponent from './components/CanvasComponent';
import PredictionPanel from './components/PredictionPanel';
import ProbabilityChart from './components/ProbabilityChart';
import FeatureMapGrid from './components/FeatureMapGrid';
import HeatmapViewer from './components/HeatmapViewer';
import CNNFlowViewer from './components/CNNFlowViewer';
import { dataUrlToBlob } from './utils/imageTransforms';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000';

function App() {
  const canvasRef = useRef(null);
  const [view, setView] = useState('dashboard');
  const [isPredicting, setIsPredicting] = useState(false);
  const [isTraining, setIsTraining] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [modelMessage, setModelMessage] = useState('');
  const [originalImageUrl, setOriginalImageUrl] = useState('');
  const [activeModel, setActiveModel] = useState('');
  const [models, setModels] = useState([]);
  const [trainingResult, setTrainingResult] = useState(null);
  const [trainConfig, setTrainConfig] = useState({
    modelName: 'mnist_custom_model',
    convFilterList: [32],
    denseNeuronList: [128],
    optimizer: 'adam',
    learningRate: 0.001,
    epochs: 3,
    batchSize: 128,
    validationSplit: 0.1,
  });
  const [result, setResult] = useState({
    prediction: null,
    probabilities: [],
    heatmap: [],
    featureMaps: {},
  });

  const confidence = useMemo(() => {
    if (!result.probabilities.length) {
      return 0;
    }
    return Math.max(...result.probabilities);
  }, [result.probabilities]);

  const featureLayerNames = useMemo(() => {
    return Object.keys(result.featureMaps || {});
  }, [result.featureMaps]);

  const convLayerValues = useMemo(
    () => trainConfig.convFilterList.map((value) => Math.max(8, Math.min(256, Number(value) || 32))),
    [trainConfig.convFilterList],
  );
  const denseLayerValues = useMemo(
    () => trainConfig.denseNeuronList.map((value) => Math.max(4, Math.min(1024, Number(value) || 64))),
    [trainConfig.denseNeuronList],
  );
  const hiddenLayerCount = denseLayerValues.length;
  const convolutionLayerCount = convLayerValues.length;

  const refreshModels = async () => {
    try {
      const response = await axios.get(`${API_BASE}/models`);
      setModels(response.data.models || []);
      setActiveModel(response.data.active_model || '');
    } catch {
      setModelMessage('Could not fetch model list. Ensure backend is running.');
    }
  };

  useEffect(() => {
    refreshModels();
  }, []);

  const handleClear = () => {
    canvasRef.current?.clear();
    setErrorMessage('');
    setOriginalImageUrl('');
    setResult({
      prediction: null,
      probabilities: [],
      heatmap: [],
      featureMaps: {},
    });
  };

  const handlePredict = async () => {
    try {
      const saveData = canvasRef.current?.getSaveData();
      const parsed = saveData ? JSON.parse(saveData) : { lines: [] };
      if (!parsed.lines || parsed.lines.length === 0) {
        setErrorMessage('Please draw a digit before predicting.');
        return;
      }

      setIsPredicting(true);
      setErrorMessage('');

      const dataUrl = canvasRef.current.getDataURL('png');
      setOriginalImageUrl(dataUrl);
      const imageBlob = dataUrlToBlob(dataUrl);
      const formData = new FormData();
      formData.append('file', imageBlob, 'digit.png');

      const response = await axios.post(`${API_BASE}/predict`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const payload = response.data;
      const prediction = Number.isInteger(payload.prediction)
        ? payload.prediction
        : payload.predicted_digit;
      const probabilities = payload.probabilities || [];
      const heatmap = payload.heatmap || payload.gradcam?.heatmap || [];
      const featureMaps = payload.feature_maps || {};
      if (payload.active_model) {
        setActiveModel(payload.active_model);
      }

      setResult({ prediction, probabilities, heatmap, featureMaps });
    } catch (error) {
      const detail = error?.response?.data?.detail;
      setErrorMessage(detail || 'Prediction failed. Ensure backend is running on localhost:8000.');
    } finally {
      setIsPredicting(false);
    }
  };

  const handleTrainConfigChange = (event) => {
    const { name, value } = event.target;
    setTrainConfig((prev) => ({ ...prev, [name]: value }));
  };

  const handleTrainingStep = (field, direction) => {
    setTrainConfig((prev) => {
      if (field === 'epochs') {
        const value = Math.max(1, Math.min(50, Number(prev.epochs) + direction * 1));
        return { ...prev, epochs: value };
      }
      if (field === 'batchSize') {
        const value = Math.max(16, Math.min(512, Number(prev.batchSize) + direction * 16));
        return { ...prev, batchSize: value };
      }
      if (field === 'learningRate') {
        const raw = Number(prev.learningRate) + direction * 0.0005;
        const value = Math.max(0.0001, Math.min(0.1, raw));
        return { ...prev, learningRate: Number(value.toFixed(4)) };
      }
      if (field === 'validationSplit') {
        const raw = Number(prev.validationSplit) + direction * 0.05;
        const value = Math.max(0.05, Math.min(0.4, raw));
        return { ...prev, validationSplit: Number(value.toFixed(2)) };
      }
      return prev;
    });
  };

  const handleAddHiddenLayer = () => {
    setTrainConfig((prev) => ({
      ...prev,
      denseNeuronList: [...prev.denseNeuronList, 64],
    }));
  };

  const handleRemoveHiddenLayer = () => {
    setTrainConfig((prev) => {
      if (prev.denseNeuronList.length <= 1) {
        return prev;
      }
      return {
        ...prev,
        denseNeuronList: prev.denseNeuronList.slice(0, -1),
      };
    });
  };

  const handleHiddenNeuronChange = (layerIndex, value) => {
    const next = Number.parseInt(value, 10);
    if (!Number.isInteger(next)) {
      return;
    }
    const clamped = Math.max(4, Math.min(1024, next));
    setTrainConfig((prev) => ({
      ...prev,
      denseNeuronList: prev.denseNeuronList.map((neuronValue, index) => (
        index === layerIndex ? clamped : neuronValue
      )),
    }));
  };

  const handleHiddenNeuronStep = (layerIndex, direction) => {
    setTrainConfig((prev) => ({
      ...prev,
      denseNeuronList: prev.denseNeuronList.map((neuronValue, index) => {
        if (index !== layerIndex) {
          return neuronValue;
        }
        const stepped = Number(neuronValue) + direction * 16;
        return Math.max(4, Math.min(1024, stepped));
      }),
    }));
  };

  const handleAddConvLayer = () => {
    setTrainConfig((prev) => ({
      ...prev,
      convFilterList: [...prev.convFilterList, 32],
    }));
  };

  const handleRemoveConvLayer = () => {
    setTrainConfig((prev) => {
      if (prev.convFilterList.length <= 1) {
        return prev;
      }
      return {
        ...prev,
        convFilterList: prev.convFilterList.slice(0, -1),
      };
    });
  };

  const handleConvFilterChange = (layerIndex, value) => {
    const next = Number.parseInt(value, 10);
    if (!Number.isInteger(next)) {
      return;
    }
    const clamped = Math.max(8, Math.min(256, next));
    setTrainConfig((prev) => ({
      ...prev,
      convFilterList: prev.convFilterList.map((filterValue, index) => (
        index === layerIndex ? clamped : filterValue
      )),
    }));
  };

  const handleConvFilterStep = (layerIndex, direction) => {
    setTrainConfig((prev) => ({
      ...prev,
      convFilterList: prev.convFilterList.map((filterValue, index) => {
        if (index !== layerIndex) {
          return filterValue;
        }
        const stepped = Number(filterValue) + direction * 8;
        return Math.max(8, Math.min(256, stepped));
      }),
    }));
  };

  const handleTrainModel = async () => {
    const convFilters = convLayerValues;
    const denseNeurons = denseLayerValues;

    if (!convFilters || !denseNeurons?.length) {
      setModelMessage('Conv filters and hidden layer neurons must be positive values.');
      return;
    }

    try {
      setIsTraining(true);
      setModelMessage('');
      const payload = {
        model_name: trainConfig.modelName,
        conv_filters: convFilters,
        dense_neurons: denseNeurons,
        optimizer: trainConfig.optimizer,
        learning_rate: Number(trainConfig.learningRate),
        epochs: Number(trainConfig.epochs),
        batch_size: Number(trainConfig.batchSize),
        validation_split: Number(trainConfig.validationSplit),
      };

      const response = await axios.post(`${API_BASE}/train`, payload);
      setTrainingResult(response.data);
      setModelMessage(`Training complete. Active model: ${response.data.active_model}`);
      setActiveModel(response.data.active_model || '');
      await refreshModels();
    } catch (error) {
      const detail = error?.response?.data?.detail;
      setModelMessage(detail || 'Training failed. Check backend logs.');
    } finally {
      setIsTraining(false);
    }
  };

  const handleSelectModel = async (modelName) => {
    try {
      const response = await axios.post(`${API_BASE}/models/select`, { model_name: modelName });
      setActiveModel(response.data.active_model || modelName);
      setModelMessage(`Selected model: ${response.data.active_model || modelName}`);
      await refreshModels();
    } catch (error) {
      const detail = error?.response?.data?.detail;
      setModelMessage(detail || 'Failed to select model.');
    }
  };

  const renderDashboard = () => (
    <>
      <section className="card dashboard-card">
        <h1>Deep Learning Virtual Lab Dashboard</h1>
        <div className="dashboard-header">
          <img
            src={`${process.env.PUBLIC_URL}/assets/ves_logo.png`}
            alt="Vivekanand Education Society logo"
            className="ves-logo"
          />
          <p className="team-line">
            <strong>Team:</strong>{' '}
            <strong>Sanjay Aski, Nathan Cherian, Rahul Guhagarkar, Vivan Tulsi, Vaibhav Thadwani</strong>
          </p>
        </div>
        <p className="overview-prose">
          This unified dashboard merges both of your virtual lab projects into one learning system.
          The CNN Digit Recognition Lab lets you train custom models on MNIST, load saved models,
          and inspect predictions with feature maps and Grad-CAM. The CAE Explainer Lab remains
          unchanged and is embedded directly here so everything runs under one frontend experience.
        </p>

        <div className="dashboard-grid two-col">
          <article className="project-tile">
            <h3>CNN Digit Recognition Lab</h3>
            <p>
              Integrated workflow in one page: configure architecture, optimizer and neurons,
              train on MNIST, load saved models, then test digit predictions visually.
            </p>
            <button className="btn primary" onClick={() => setView('cnn-lab')}>Open CNN Lab</button>
          </article>

          <article className="project-tile">
            <h3>CAE Explainer Lab</h3>
            <p>
              Your existing CAE explainer is preserved as-is. Open it inside this dashboard to keep
              both labs in a single merged platform.
            </p>
            <button className="btn primary" onClick={() => setView('cae-lab')}>Open CAE Explainer</button>
          </article>
        </div>
      </section>

      <section className="card">
        <h3>Current CNN Model Status</h3>
        <p>Active model: {activeModel || 'No model selected yet.'}</p>
        <p>
          Dataset: MNIST via KaggleHub (with fallback to Keras MNIST if dataset download is unavailable).
        </p>
      </section>
    </>
  );

  const renderNeuronSketch = () => {
    const layerDefs = [
      { key: 'input', label: 'Input', nodes: 1, tone: 'neutral' },
      ...convLayerValues.map((value, index) => ({
        key: `conv-${index + 1}`,
        label: `Conv ${index + 1}`,
        nodes: Math.max(2, Math.min(7, Math.round(value / 16))),
        tone: index % 2 === 0 ? 'blue' : 'orange',
      })),
      ...denseLayerValues.map((value, index) => ({
        key: `dense-${index + 1}`,
        label: `Dense ${index + 1}`,
        nodes: Math.max(2, Math.min(8, Math.round(value / 16))),
        tone: index % 2 === 0 ? 'orange' : 'blue',
      })),
      { key: 'output', label: 'Output', nodes: 4, tone: 'neutral' },
    ];

    return (
      <div className="network-sketch-wrap">
        <div className="network-sketch">
          {layerDefs.map((layer) => (
            <div key={layer.key} className="sketch-layer">
              <p className="sketch-layer-title">{layer.label}</p>
              <div className="sketch-nodes">
                {Array.from({ length: layer.nodes }).map((_, nodeIndex) => (
                  <span key={`${layer.key}-${nodeIndex}`} className={`sketch-node ${layer.tone}`} />
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="sketch-note">
          Visual architecture preview generated from your convolution filter and dense neuron settings.
        </p>
      </div>
    );
  };

  const renderCNNLab = () => (
    <>
      <section className="toolbar-row">
        <button className="btn secondary" onClick={() => setView('dashboard')}>Back to Dashboard</button>
        <button className="btn secondary" onClick={() => setView('cae-lab')}>Go to CAE Explainer</button>
        <span className="model-pill">Active model: {activeModel || 'not selected'}</span>
      </section>

      <h1>CNN Digit Recognition Lab</h1>
      <section className="playground-toolbar card">
        <button className="run-button" onClick={handleTrainModel} disabled={isTraining}>
          {isTraining ? '...' : 'Train'}
        </button>
        <div className="toolbar-field">
          <span>Epoch</span>
          <strong>{trainConfig.epochs}</strong>
          <div className="stepper-row">
            <button className="tiny-btn" onClick={() => handleTrainingStep('epochs', -1)}>-</button>
            <button className="tiny-btn" onClick={() => handleTrainingStep('epochs', 1)}>+</button>
          </div>
        </div>
        <div className="toolbar-field">
          <label htmlFor="toolbarLearningRate">Learning rate</label>
          <input id="toolbarLearningRate" className="input slim" type="number" step="0.0001" name="learningRate" value={trainConfig.learningRate} onChange={handleTrainConfigChange} />
          <div className="stepper-row">
            <button className="tiny-btn" onClick={() => handleTrainingStep('learningRate', -1)}>-</button>
            <button className="tiny-btn" onClick={() => handleTrainingStep('learningRate', 1)}>+</button>
          </div>
        </div>
        <div className="toolbar-field">
          <label htmlFor="toolbarOptimizer">Optimizer</label>
          <select id="toolbarOptimizer" className="input slim" name="optimizer" value={trainConfig.optimizer} onChange={handleTrainConfigChange}>
            <option value="adam">Adam</option>
            <option value="sgd">SGD</option>
            <option value="rmsprop">RMSprop</option>
          </select>
        </div>
        <div className="toolbar-field">
          <span>Conv layers</span>
          <strong>{convolutionLayerCount}</strong>
        </div>
        <div className="toolbar-field">
          <span>Hidden layers</span>
          <strong>{hiddenLayerCount}</strong>
        </div>
        <div className="toolbar-field grow">
          <label htmlFor="activeModelSelect">Load model</label>
          <select
            id="activeModelSelect"
            className="input slim"
            value={models.some((entry) => entry.name === activeModel) ? activeModel : ''}
            onChange={(event) => {
              if (event.target.value) {
                handleSelectModel(event.target.value);
              }
            }}
          >
            <option value="" disabled>Select saved model</option>
            {models.map((entry) => (
              <option key={entry.name} value={entry.name}>{entry.name}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="playground-layout">
        <aside className="card panel-card">
          <h3>Data and Training</h3>
          <p className="hint">Dataset: MNIST via KaggleHub (fallback: Keras MNIST)</p>

          <div className="form-grid compact">
            <label htmlFor="modelName">Unique model name</label>
            <input id="modelName" className="input" name="modelName" value={trainConfig.modelName} onChange={handleTrainConfigChange} />

            <label htmlFor="epochs">Epochs</label>
            <div className="inline-control-row">
              <button className="tiny-btn" onClick={() => handleTrainingStep('epochs', -1)}>-</button>
              <input id="epochs" className="input" type="number" min="1" max="50" name="epochs" value={trainConfig.epochs} onChange={handleTrainConfigChange} />
              <button className="tiny-btn" onClick={() => handleTrainingStep('epochs', 1)}>+</button>
            </div>

            <label htmlFor="batchSize">Batch size</label>
            <div className="inline-control-row">
              <button className="tiny-btn" onClick={() => handleTrainingStep('batchSize', -1)}>-</button>
              <input id="batchSize" className="input" type="number" min="16" max="512" step="16" name="batchSize" value={trainConfig.batchSize} onChange={handleTrainConfigChange} />
              <button className="tiny-btn" onClick={() => handleTrainingStep('batchSize', 1)}>+</button>
            </div>

            <label htmlFor="validationSplit">Validation split</label>
            <div className="inline-control-row">
              <button className="tiny-btn" onClick={() => handleTrainingStep('validationSplit', -1)}>-</button>
              <input id="validationSplit" className="input" type="number" min="0.05" max="0.4" step="0.05" name="validationSplit" value={trainConfig.validationSplit} onChange={handleTrainConfigChange} />
              <button className="tiny-btn" onClick={() => handleTrainingStep('validationSplit', 1)}>+</button>
            </div>

            <button className="btn primary" onClick={handleTrainModel} disabled={isTraining}>
              {isTraining ? 'Training...' : 'Train and Save Model'}
            </button>
            <button className="btn secondary" onClick={refreshModels}>Refresh Models</button>
          </div>

          {modelMessage && <div className="loading-wrap">{modelMessage}</div>}
        </aside>

        <section className="card panel-card center-panel">
          <h3>Features and Neuron Playground</h3>
          <div className="form-grid compact">
            <div className="hidden-layer-header-row">
              <label>Convolution Layers ({convolutionLayerCount})</label>
              <div className="stepper-row">
                <button className="tiny-btn" onClick={handleRemoveConvLayer}>-</button>
                <button className="tiny-btn" onClick={handleAddConvLayer}>+</button>
              </div>
            </div>

            <div className="hidden-layer-list">
              {convLayerValues.map((filterValue, index) => (
                <div key={`conv-layer-${index}`} className="hidden-layer-item">
                  <span>Conv {index + 1}</span>
                  <div className="inline-control-row small">
                    <button className="tiny-btn" onClick={() => handleConvFilterStep(index, -1)}>-</button>
                    <input
                      className="input"
                      type="number"
                      min="8"
                      max="256"
                      step="8"
                      value={filterValue}
                      onChange={(event) => handleConvFilterChange(index, event.target.value)}
                    />
                    <button className="tiny-btn" onClick={() => handleConvFilterStep(index, 1)}>+</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden-layer-header-row">
              <label>Hidden Layers ({hiddenLayerCount})</label>
              <div className="stepper-row">
                <button className="tiny-btn" onClick={handleRemoveHiddenLayer}>-</button>
                <button className="tiny-btn" onClick={handleAddHiddenLayer}>+</button>
              </div>
            </div>

            <div className="hidden-layer-list">
              {denseLayerValues.map((neuronValue, index) => (
                <div key={`hidden-layer-${index}`} className="hidden-layer-item">
                  <span>Layer {index + 1}</span>
                  <div className="inline-control-row small">
                    <button className="tiny-btn" onClick={() => handleHiddenNeuronStep(index, -1)}>-</button>
                    <input
                      className="input"
                      type="number"
                      min="4"
                      max="1024"
                      value={neuronValue}
                      onChange={(event) => handleHiddenNeuronChange(index, event.target.value)}
                    />
                    <button className="tiny-btn" onClick={() => handleHiddenNeuronStep(index, 1)}>+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {renderNeuronSketch()}

          <section className="top-grid inline-draw-grid">
            <CanvasComponent
              canvasRef={canvasRef}
              onPredict={handlePredict}
              onClear={handleClear}
              isLoading={isPredicting}
            />
            <PredictionPanel prediction={result.prediction} confidence={confidence} />
          </section>

          {isPredicting && (
            <div className="loading-wrap">
              <span className="spinner" />
              <span>Running CNN inference...</span>
            </div>
          )}

          {errorMessage && <div className="error-banner">{errorMessage}</div>}
        </section>

        <aside className="card panel-card output-panel">
          <h3>Output and Models</h3>
          <p>Active model: {activeModel || 'not selected'}</p>

          {trainingResult?.history && (
            <section className="mini-summary">
              <h3>Last Training Summary</h3>
              <p>Dataset source: {trainingResult?.saved_model?.dataset_source || 'unknown'}</p>
              <p>
                Final validation accuracy:{' '}
                {trainingResult?.history?.val_accuracy?.length
                  ? `${(trainingResult.history.val_accuracy.at(-1) * 100).toFixed(2)}%`
                  : 'n/a'}
              </p>
            </section>
          )}

          <h3>Saved Models</h3>
          <div className="model-list">
            {models.map((entry) => (
              <div key={entry.name} className="model-item">
                <div>
                  <strong>{entry.name}</strong>
                  <p>
                    Optimizer: {entry.optimizer || 'n/a'} | Test Acc:{' '}
                    {entry.test_accuracy ? `${(entry.test_accuracy * 100).toFixed(2)}%` : 'n/a'}
                  </p>
                </div>
                <button className="btn secondary" onClick={() => handleSelectModel(entry.name)}>Load</button>
              </div>
            ))}
            {!models.length && <p>No saved models found yet.</p>}
          </div>
        </aside>
      </section>

      <ProbabilityChart probabilities={result.probabilities} predictedDigit={result.prediction} />

      <section className="layer-section">
        <h2>Feature Maps</h2>
        <div className="feature-layers-grid">
          {featureLayerNames.map((layerName) => (
            <FeatureMapGrid key={layerName} layerName={layerName} featureTensor={result.featureMaps?.[layerName]} />
          ))}
        </div>
      </section>

      <CNNFlowViewer
        originalImageUrl={originalImageUrl}
        featureMaps={result.featureMaps}
        probabilities={result.probabilities}
      />

      <HeatmapViewer originalImageUrl={originalImageUrl} heatmap={result.heatmap} />
    </>
  );

  const renderCAELab = () => (
    <>
      <section className="toolbar-row">
        <button className="btn secondary" onClick={() => setView('dashboard')}>Back to Dashboard</button>
        <button className="btn secondary" onClick={() => setView('cnn-lab')}>Go to CNN Lab</button>
      </section>

      <h1>CAE Explainer Lab</h1>
      <section className="card cae-frame-wrap">
        <iframe
          title="CAE Explainer"
          className="cae-frame"
          src="/cae-explainer.html"
        />
      </section>
    </>
  );

  return (
    <div className="app-shell">
      <main className="container">
        {view === 'dashboard' && renderDashboard()}
        {view === 'cnn-lab' && renderCNNLab()}
        {view === 'cae-lab' && renderCAELab()}
      </main>
    </div>
  );
}

export default App;
