self.onmessage = (event) => {
  const { id, type, payload } = event.data || {};
  if (!id || !type) return;

  const respond = (data) => self.postMessage({ id, payload: data });

  switch (type) {
    case 'timeline': {
      const duration = Number(payload?.duration) || 0;
      let start = Number(payload?.start) || 0;
      let end = Number(payload?.end) || duration;
      start = Math.max(0, Math.min(start, duration));
      end = Math.max(start, Math.min(end, duration || end));
      respond({ start, end, duration });
      break;
    }
    case 'filters': {
      respond({
        brightness: Number(payload?.brightness) || 0,
        contrast: Number(payload?.contrast) || 1,
        grayscale: Boolean(payload?.grayscale)
      });
      break;
    }
    case 'text': {
      respond({
        text: String(payload?.text || ''),
        x: Number(payload?.x) || 50,
        y: Number(payload?.y) || 50,
        fontSize: Number(payload?.fontSize) || 28,
        color: payload?.color || 'white',
        start: Number(payload?.start) || 0,
        end: Number(payload?.end) || 0
      });
      break;
    }
    case 'audio': {
      respond({
        start: Number(payload?.start) || 0,
        end: Number(payload?.end) || 0,
        volume: Number(payload?.volume) || 1
      });
      break;
    }
    default:
      respond(payload);
  }
};
