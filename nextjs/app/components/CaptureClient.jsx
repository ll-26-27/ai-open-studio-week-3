"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Preferred camera: the Web Presenter (it names itself "Blackmagic Design"), then OBS Virtual Camera, else the first.
const preferred = /blackmagic|web presenter|obs virtual/i;
const storageKey = "capture-device";

function remember(key, value) { try { localStorage.setItem(key, value); } catch {} }
function recall(key) { try { return localStorage.getItem(key); } catch { return null; } }

// `documents` is for captures whose description is a long Markdown transcription (the /writing page): the recent
// list becomes one row per capture, still on the left, rendered text on the right.
export default function CaptureClient({ stations, initialStation, documents = false }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const busyRef = useRef(false);
  const [station, setStation] = useState(initialStation);
  const [devices, setDevices] = useState([]);
  const [deviceId, setDeviceId] = useState("");
  const [size, setSize] = useState("");
  const [config, setConfig] = useState({ machine: "", nas: false, slack: false });
  const [sendSlack, setSendSlack] = useState(true);
  const [sendNas, setSendNas] = useState(true);
  const [describe, setDescribe] = useState(true);
  const [status, setStatus] = useState({ tone: "muted", text: "Starting the camera…" });
  const [recent, setRecent] = useState([]);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    fetch("/api/capture").then((response) => response.json()).then(setConfig).catch(() => {});
  }, []);

  const start = useCallback(async (id) => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    const video = { width: { ideal: 1920 }, height: { ideal: 1080 } };
    if (id) video.deviceId = { exact: id };
    const stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
    streamRef.current = stream;
    if (videoRef.current) videoRef.current.srcObject = stream;
    const settings = stream.getVideoTracks()[0]?.getSettings() || {};
    if (settings.width) setSize(`${settings.width}×${settings.height}`);
    return settings.deviceId || id || "";
  }, []);

  // Open any camera first so the browser reveals device names, then switch to the preferred one.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus({ tone: "error", text: "This browser can't open a camera here. Use Chrome, and open the app at localhost on this machine." });
        return;
      }
      try {
        let current;
        try { current = await start(recall(storageKey) || ""); } catch (error) {
          // The saved camera is unplugged or renamed: forget it and open any camera.
          if (!recall(storageKey) || error.name === "NotAllowedError") throw error;
          remember(storageKey, "");
          current = await start("");
        }
        const cams = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "videoinput");
        if (cancelled) return;
        setDevices(cams);
        const saved = cams.find((cam) => cam.deviceId === recall(storageKey));
        const pick = saved || cams.find((cam) => preferred.test(cam.label)) || cams.find((cam) => cam.deviceId === current) || cams[0];
        if (pick && pick.deviceId !== current) await start(pick.deviceId);
        setDeviceId(pick?.deviceId || current);
        setStatus({ tone: "muted", text: "Ready. Press Capture (or the space bar) when you like the shot." });
      } catch (error) {
        if (recall(storageKey)) remember(storageKey, "");
        setStatus({ tone: "error", text: error.name === "NotAllowedError" ? "Camera permission was refused. Click the camera icon in the address bar and allow it, then reload." : `Couldn't open a camera: ${error.message}` });
      }
    })();
    return () => { cancelled = true; streamRef.current?.getTracks().forEach((track) => track.stop()); };
  }, [start]);

  async function choose(id) {
    setDeviceId(id);
    remember(storageKey, id);
    try { await start(id); } catch (error) { setStatus({ tone: "error", text: `Couldn't open that camera: ${error.message}` }); }
  }

  // The frame grab is instant; the upload runs on its own, so the next press never waits for NAS or Slack.
  const capture = useCallback(async () => {
    const video = videoRef.current;
    if (busyRef.current || !video || !video.videoWidth) return;
    busyRef.current = true;
    setFlash(true);
    setTimeout(() => setFlash(false), 180);
    let blob;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d").drawImage(video, 0, 0);
      blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    } finally {
      busyRef.current = false;
    }
    if (!blob) { setStatus({ tone: "error", text: "Couldn't grab a frame from the camera." }); return; }

    const id = `${Date.now()}-${Math.random()}`;
    const update = (patch) => setRecent((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
    setRecent((items) => [{ id, thumb: URL.createObjectURL(blob), name: "", note: config.describe && describe ? "saving and describing…" : "saving…", tone: "muted" }, ...items].slice(0, 12));
    setStatus({ tone: "muted", text: "Captured. Saving…" });

    try {
      const form = new FormData();
      form.append("image", blob, "capture.jpg");
      form.append("station", station);
      form.append("slack", config.slack && sendSlack ? "1" : "0");
      form.append("nas", config.nas && sendNas ? "1" : "0");
      form.append("describe", config.describe && describe ? "1" : "0");
      const response = await fetch("/api/capture", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      const parts = ["Saved"];
      if (result.nas) parts.push(result.nas === "saved" ? "NAS ✓" : `NAS ${result.nas}`);
      if (result.slack) parts.push(result.slack === "posted" ? "Slack ✓" : `Slack ${result.slack}`);
      if (result.describe) parts.push(`Description ${result.describe}`);
      const failed = [result.nas, result.slack, result.describe].some((value) => value && value.startsWith("failed"));
      const tone = failed ? "warn" : "ok";
      setStatus({ tone, text: `${parts.join(" · ")} — ${result.filename}` });
      update({ name: result.filename, note: parts.join(" · "), tone, markdown: result.markdown || "", description: result.description || "" });
    } catch (error) {
      setStatus({ tone: "error", text: `Not saved: ${error.message}` });
      update({ note: `not saved: ${error.message}`, tone: "error" });
    }
  }, [station, config, sendSlack, sendNas, describe]);

  async function copy(item) {
    try { await navigator.clipboard.writeText(item.markdown); setStatus({ tone: "ok", text: `Copied Markdown for ${item.name}` }); } catch { setStatus({ tone: "error", text: "Couldn't copy; select the link in Slack instead." }); }
  }

  useEffect(() => {
    function onKey(event) {
      if (event.code !== "Space" || event.target.closest?.("select, input, button, textarea")) return;
      event.preventDefault();
      capture();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [capture]);

  return (
    <div className="capture">
      <div className="capture-bar">
        <div className="capture-stations" role="group" aria-label="Station">
          {Object.entries(stations).map(([key, label]) => (
            <button type="button" key={key} className="capture-chip" aria-pressed={station === key} onClick={() => setStation(key)}>{label}</button>
          ))}
        </div>
        <label className="capture-device">
          <span className="eyebrow">Camera</span>
          <select value={deviceId} onChange={(event) => choose(event.target.value)}>
            {devices.length === 0 && <option value="">—</option>}
            {devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>)}
          </select>
        </label>
      </div>

      <div className={flash ? "capture-frame capture-flash" : "capture-frame"}>
        <video ref={videoRef} autoPlay playsInline muted />
      </div>

      <div className="capture-actions">
        <button type="button" className="capture-button" onClick={capture}>Capture</button>
        <div className="capture-targets">
          <span>This machine{config.machine ? ` (${config.machine})` : ""} → /live</span>
          {config.describe && <label><input type="checkbox" checked={describe} onChange={(event) => setDescribe(event.target.checked)} /> Describe</label>}
          {config.nas && <label><input type="checkbox" checked={sendNas} onChange={(event) => setSendNas(event.target.checked)} /> NAS</label>}
          {config.slack && <label><input type="checkbox" checked={sendSlack} onChange={(event) => setSendSlack(event.target.checked)} /> Slack{config.publicLinks ? " + public link" : ""}</label>}
          {size && <span className="capture-size">{size}</span>}
        </div>
      </div>
      <p className={`capture-status capture-status-${status.tone}`} role="status">{status.text}</p>

      {recent.length > 0 && (
        <ul className={documents ? "capture-recent capture-documents" : "capture-recent"} aria-label="Your recent captures">
          {recent.map((item) => (
            <li key={item.id}>
              <div className="capture-still">
                <img src={item.thumb} alt={item.name || "capture"} />
                <span className={`capture-note capture-status-${item.tone}`}>{item.note}</span>
                {item.markdown && <button type="button" className="capture-copy" onClick={() => copy(item)}>Copy MD</button>}
              </div>
              {item.description && (documents
                ? <div className="capture-transcript prose"><ReactMarkdown remarkPlugins={[remarkGfm]}>{item.description}</ReactMarkdown></div>
                : <p className="capture-description">{item.description}</p>)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
