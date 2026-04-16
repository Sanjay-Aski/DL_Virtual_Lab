import React, { useMemo } from 'react';
import { getChannelMaps, matrixToDataUrl } from '../utils/imageTransforms';

function FeatureMapGrid({ layerName, featureTensor, maxMaps = 8 }) {
  const maps = useMemo(() => getChannelMaps(featureTensor, maxMaps), [featureTensor, maxMaps]);

  return (
    <section className="card feature-card">
      <div className="feature-header">
        <h3>{layerName}</h3>
        <span className="feature-help" title="Feature maps show what visual patterns each convolution filter responds to.">
          ?
        </span>
      </div>
      {maps.length === 0 ? (
        <p className="hint">No feature maps available.</p>
      ) : (
        <div className="feature-grid">
          {maps.map((map2D, index) => {
            const imageUrl = matrixToDataUrl(map2D, 96);
            return (
              <div className="feature-tile" key={`${layerName}-${index}`} title={`${layerName} map ${index + 1}`}>
                <img src={imageUrl} alt={`${layerName} feature map ${index + 1}`} />
                <span>{index + 1}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default FeatureMapGrid;
