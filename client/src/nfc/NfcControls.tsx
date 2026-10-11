import { useEffect, useState } from 'react';
import { nfcUnavailableReason, startNfc, useNfc } from './index';

/** "Enable card reader" button, or a short note on how cards work on this phone. */
export function NfcButton({ compact = false }: { compact?: boolean }) {
  const nfc = useNfc();
  if (nfc.active) return <p className="nfc-status on">● Card reader on</p>;
  if (!nfc.supported) return compact ? null : <p className="muted small">{nfcUnavailableReason()}</p>;
  return (
    <>
      <button className={`btn ${compact ? 'small' : ''}`} onClick={() => startNfc()}>
        Enable card reader
      </button>
      {nfc.error && <p className="error small">{nfc.error}</p>}
    </>
  );
}

/** Briefly shows the result of the latest card tap. */
export function TapToast() {
  const { lastTap } = useNfc();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!lastTap) return;
    setVisible(true);
    const id = setTimeout(() => setVisible(false), 2500);
    return () => clearTimeout(id);
  }, [lastTap]);
  if (!lastTap || !visible) return null;
  return (
    <div className={`toast ${lastTap.ok ? 'ok' : 'bad'}`} role="status">
      {lastTap.message}
    </div>
  );
}
