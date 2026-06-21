import { X } from "lucide-react";
import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import type { RemoteAccessDetails } from "./remote-control";

type RemoteAccessOverlayProps = {
  access: RemoteAccessDetails;
  onClose: () => void;
};

type RemoteAccessCardProps = {
  access: RemoteAccessDetails;
  className?: string;
};

export function RemoteAccessCard({ access, className = "" }: RemoteAccessCardProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState("");

  useEffect(() => {
    let isMounted = true;
    setQrCodeUrl("");

    void QRCode.toDataURL(access.remoteUrl, {
      color: {
        dark: "#101418",
        light: "#f8f3e7",
      },
      errorCorrectionLevel: "M",
      margin: 1,
      width: 320,
    })
      .then((url) => {
        if (isMounted) setQrCodeUrl(url);
      })
      .catch(() => {
        if (isMounted) setQrCodeUrl("error");
      });

    return () => {
      isMounted = false;
    };
  }, [access.remoteUrl]);

  return (
    <div className={`remote-access-card ${className}`.trim()}>
      <div className="remote-access-overlay__copy">
        <span>Remote control</span>
        <h2>Scan to control this deck</h2>
        <p>The QR opens the phone controller and signs in with this session PIN.</p>
      </div>
      <div className="remote-access-overlay__qr">
        {qrCodeUrl === "error" ? (
          <span>Failed to generate QR code</span>
        ) : qrCodeUrl ? (
          <img alt="Remote control QR code" src={qrCodeUrl} />
        ) : (
          <span>Generating QR</span>
        )}
      </div>
      <div className="remote-access-overlay__details">
        <span>PIN {access.pin}</span>
        <strong>{access.remoteUrl}</strong>
      </div>
    </div>
  );
}

export function RemoteAccessOverlay({ access, onClose }: RemoteAccessOverlayProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
        ) ?? [],
      ).filter((element) => element.offsetParent !== null);

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
        return;
      }

      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <section className="remote-access-overlay" role="dialog" aria-modal="true" aria-label="Remote control QR code">
      <div className="remote-access-overlay__panel" ref={panelRef}>
        <button
          className="remote-access-overlay__close"
          onClick={onClose}
          ref={closeButtonRef}
          type="button"
          aria-label="Close remote QR"
        >
          <X size={24} />
        </button>
        <RemoteAccessCard access={access} />
      </div>
    </section>
  );
}
