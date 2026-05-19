import { useEffect, useRef, useState } from 'react';
import ViewShot from 'react-native-view-shot';
import { RUN_SHARE_FORMATS } from '../components/RunShareCard';

// Captures an offscreen card via react-native-view-shot.
//
//   const { share, HiddenCard } = useShareCard({
//     renderCard: (payload) => <RunShareCard activity={payload.activity} format={payload.format} />,
//     onCapture: (ref, payload) => shareActivityImage(ref, payload.activity, t)
//   });
//
//   // Place once in the screen tree (positioned off-screen by the hook):
//   <HiddenCard />
//
//   // Trigger from a tap; the card mounts, waits one tick, then `onCapture`
//   // runs and pending state is cleared automatically.
//   share({ activity, format: 'story' });
//
// `payload.format` is required and must be a key of RUN_SHARE_FORMATS so the
// hidden ViewShot can be sized correctly before capture.
function useShareCard({ renderCard, onCapture }) {
  const [pending, setPending] = useState(null);
  const cardRef = useRef(null);
  // Keep the latest callback in a ref so we don't have to thread it through
  // effect deps (which would re-arm the timer every render).
  const onCaptureRef = useRef(onCapture);
  useEffect(() => {
    onCaptureRef.current = onCapture;
  }, [onCapture]);

  useEffect(() => {
    if (!pending) {
      return undefined;
    }

    // Give React one tick to mount the offscreen card before ViewShot tries
    // to read its layout.
    const id = setTimeout(() => {
      Promise.resolve(onCaptureRef.current(cardRef, pending)).finally(() => setPending(null));
    }, 60);

    return () => clearTimeout(id);
  }, [pending]);

  function HiddenCard() {
    if (!pending) {
      return null;
    }
    const { width, height } = RUN_SHARE_FORMATS[pending.format];
    return (
      <ViewShot
        ref={cardRef}
        options={{ format: 'png', quality: 1 }}
        style={{ position: 'absolute', left: -10000, top: 0, width, height }}
      >
        {renderCard(pending)}
      </ViewShot>
    );
  }

  return { share: setPending, HiddenCard };
}

export { useShareCard };
