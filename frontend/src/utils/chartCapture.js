// Utility to convert an SVG element to a Base64 PNG using an offscreen canvas
function svgElementToPngBase64(svgElement, { backgroundColor = 'transparent', pixelRatio = 2 } = {}) {
  if (!svgElement) return undefined;

  try {
    const xml = new XMLSerializer().serializeToString(svgElement);
    const svg64 = window.btoa(unescape(encodeURIComponent(xml)));
    const imageSrc = `data:image/svg+xml;base64,${svg64}`;

    // Create an offscreen canvas to draw the SVG as PNG
    const bbox = svgElement.getBBox?.();
    // Try multiple methods to get dimensions
    let width = bbox?.width || svgElement.clientWidth || svgElement.getAttribute('width') || svgElement.getBoundingClientRect().width || 800;
    let height = bbox?.height || svgElement.clientHeight || svgElement.getAttribute('height') || svgElement.getBoundingClientRect().height || 400;
    
    // Ensure we have valid dimensions
    width = Math.max(1, Math.ceil(Number(width) || 800));
    height = Math.max(1, Math.ceil(Number(height) || 400));
    
    console.log(`📐 SVG dimensions: ${width}x${height}`);

    const canvas = document.createElement('canvas');
    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    if (backgroundColor && backgroundColor !== 'transparent') {
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        ctx.drawImage(img, 0, 0, width, height);
        try {
          const dataUrl = canvas.toDataURL('image/png');
          resolve(dataUrl.replace(/^data:image\/png;base64,/, ''));
        } catch {
          resolve(undefined);
        }
      };
      img.onerror = () => resolve(undefined);
      img.src = imageSrc;
    });
  } catch {
    return undefined;
  }
}

// Try to capture a chart instance/ref to a Base64 PNG depending on library
// - Chart.js: ref.current?.toBase64Image()
// - ECharts: instance.getDataURL({ type: 'png' })
// - Recharts (SVG): query SVG inside container/ref and rasterize
export async function captureChartAsBase64(chartRefOrInstance) {
  if (!chartRefOrInstance) return undefined;

  try {
    const refLike = chartRefOrInstance.current ?? chartRefOrInstance;

    // Chart.js instance or chart object exposing toBase64Image
    if (refLike && typeof refLike.toBase64Image === 'function') {
      try {
        const dataUrl = refLike.toBase64Image();
        if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) {
          return dataUrl.replace(/^data:image\/png;base64,/, '');
        }
      } catch {}
    }

    // ECharts instance
    if (refLike && typeof refLike.getDataURL === 'function') {
      try {
        const dataUrl = refLike.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: 'transparent' });
        if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) {
          return dataUrl.replace(/^data:image\/png;base64,/, '');
        }
      } catch {}
    }

    // Recharts: find descendant SVG and rasterize
    let container = null;
    if (refLike instanceof Element) container = refLike;
    else if (refLike && refLike.container instanceof Element) container = refLike.container;

    if (!container && typeof document !== 'undefined') {
      if (typeof chartRefOrInstance === 'string') {
        console.log(`🔍 Looking for element with selector: "${chartRefOrInstance}"`);
        container = document.querySelector(chartRefOrInstance);
        
        // Simplified fallback for combined chart
        if (!container && chartRefOrInstance.includes('combined')) {
          container = document.querySelector('#comparison-combined-chart') || document.querySelector('#forecast-combined-chart');
        }
        
        // Simplified fallback for individual charts
        if (!container && chartRefOrInstance.includes('data-city')) {
          const cityMatch = chartRefOrInstance.match(/data-city="([^"]+)"/);
          if (cityMatch) {
            container = document.querySelector(`[data-city="${cityMatch[1]}"]`);
          }
        }
        
        // Additional fallback for forecast charts
        if (!container && chartRefOrInstance.includes('forecast')) {
          if (chartRefOrInstance.includes('combined')) {
            container = document.querySelector('#forecast-combined-chart');
          } else {
            // Try to find any forecast chart container
            container = document.querySelector('#forecast-individual-charts');
          }
        }
        
        console.log(`📦 Found container with selector:`, !!container);
      }
    }

    if (container) {
      console.log(`📊 Container found, looking for SVG element...`);
      const svg = container.querySelector('svg');
      console.log(`🎨 SVG element found:`, !!svg);
      if (svg) {
        // Ensure SVG has proper dimensions and viewBox
        if (!svg.getAttribute('viewBox') && (svg.clientWidth > 0 || svg.clientHeight > 0)) {
          const width = svg.clientWidth || svg.getAttribute('width') || 800;
          const height = svg.clientHeight || svg.getAttribute('height') || 400;
          svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
          console.log(`📐 Set viewBox to: 0 0 ${width} ${height}`);
        }
        
        console.log(`🔄 Converting SVG to PNG...`);
        const result = await svgElementToPngBase64(svg);
        console.log(`✅ SVG conversion result:`, !!result);
        return result;
      } else {
        console.log(`❌ No SVG element found in container`);
      }
    } else {
      console.log(`❌ No container found for selector:`, chartRefOrInstance);
    }

    // Fallback: if a raw SVG element was passed
    if (refLike instanceof SVGElement) {
      return await svgElementToPngBase64(refLike);
    }
  } catch {}

  return undefined;
}

// Wait for charts to be fully rendered
async function waitForChartsToRender(maxWaitTime = 5000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    // Check if we have any SVG elements in the comparison charts
    const individualCharts = document.querySelectorAll('#comparison-individual-charts svg');
    const combinedChart = document.querySelector('#comparison-combined-chart svg');
    
    // Check if charts have reasonable dimensions
    const hasValidCharts = Array.from(individualCharts).some(svg => 
      svg.clientWidth > 0 && svg.clientHeight > 0
    ) || (combinedChart && combinedChart.clientWidth > 0 && combinedChart.clientHeight > 0);
    
    if (hasValidCharts) {
      console.log('✅ Charts are ready for capture');
      return true;
    }
    
    // Wait a bit before checking again
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log('⚠️ Charts may not be fully rendered, proceeding anyway');
  return false;
}

// Collect charts for report depending on mode and refs
// mode: 'comparison' | 'forecast'
// cityRefs: map cityName -> ref/selector/container for individual charts
// combinedRef: ref/selector/container for combined chart
// showConfidence: ensures capture reflects current CI toggle (we assume caller renders correctly before capture)
export async function collectChartsForReport({ mode, cityRefs, combinedRef, showConfidence }) {
  const out = {};
  console.log('🔍 collectChartsForReport called with:', { mode, cityRefs, combinedRef, showConfidence });

  // Wait for charts to be fully rendered before attempting capture
  await waitForChartsToRender();

  // Ensure current visible chart already reflects CI toggle; caller is responsible
  // We only capture what is on-screen now.

  // Combined
  if (combinedRef) {
    console.log('📊 Attempting to capture combined chart with ref:', combinedRef);
    const combined = await captureChartAsBase64(combinedRef);
    if (combined) {
      out.combined = combined;
      console.log('✅ Combined chart captured successfully');
    } else {
      console.log('❌ Failed to capture combined chart');
    }
  }

  // Individuals
  if (cityRefs && typeof cityRefs === 'object') {
    console.log('🏙️ Attempting to capture individual charts for cities:', Object.keys(cityRefs));
    const entries = Object.entries(cityRefs);
    const results = await Promise.all(entries.map(async ([cityName, ref]) => {
      console.log(`📈 Capturing chart for ${cityName} with selector:`, ref);
      const img = await captureChartAsBase64(ref);
      if (img) {
        console.log(`✅ Successfully captured chart for ${cityName}`);
      } else {
        console.log(`❌ Failed to capture chart for ${cityName}`);
      }
      return [cityName, img];
    }));

    results.forEach(([cityName, img]) => {
      if (img) out[cityName] = img;
    });
  }
  
  console.log('🎯 Final captured charts:', Object.keys(out));
  return out;
}







