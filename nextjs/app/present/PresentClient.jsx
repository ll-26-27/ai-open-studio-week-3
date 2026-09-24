"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// The live transcript comes from short chunks of the take, each sent to Whisper as its own file (a MediaRecorder is
// restarted every CHUNK_MS so each chunk has its own header). A chunk whose loudest moment stays under QUIET is
// not sent: Whisper tends to invent a "Thank you." for silence.
const CHUNK_MS = 5000;
const QUIET = 0.015;

const storage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch {} },
};

function audioType() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return types.find((type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) || "";
}

function clock(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function PresentClient({ roles }) {
  const faceRef = useRef(null);
  const slideVideoRef = useRef(null);
  const slideImageRef = useRef(null);
  const micRef = useRef(null);
  const faceStreamRef = useRef(null);
  const slideStreamRef = useRef(null);
  const recordingRef = useRef(false);
  const fullRecorderRef = useRef(null);
  const fullPartsRef = useRef([]);
  const chunkRecorderRef = useRef(null);
  const chunkMetaRef = useRef({ peak: 0 });
  const chunkIndexRef = useRef(0);
  const timerRef = useRef(null);
  const liveRef = useRef([]);

  const [topic, setTopic] = useState("");
  const [role, setRole] = useState("examiner");
  const [cameras, setCameras] = useState([]);
  const [mics, setMics] = useState([]);
  const [cameraId, setCameraId] = useState("");
  const [micId, setMicId] = useState("");
  const [slideSource, setSlideSource] = useState(null); // "window" | "image" | null
  const [slideImage, setSlideImage] = useState("");
  const [phase, setPhase] = useState("idle"); // idle | recording | finishing | done
  const [elapsed, setElapsed] = useState(0);
  const [level, setLevel] = useState(0);
  const [live, setLive] = useState([]);
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("Starting the camera and microphone…");

  const openCamera = useCallback(async (id) => {
    faceStreamRef.current?.getTracks().forEach((track) => track.stop());
    const stream = await navigator.mediaDevices.getUserMedia({ video: id ? { deviceId: { exact: id }, width: { ideal: 1280 } } : { width: { ideal: 1280 } }, audio: false });
    faceStreamRef.current = stream;
    if (faceRef.current) faceRef.current.srcObject = stream;
    return stream.getVideoTracks()[0]?.getSettings().deviceId || id || "";
  }, []);

  const openMic = useCallback(async (id) => {
    micRef.current?.stream.getTracks().forEach((track) => track.stop());
    micRef.current?.context.close().catch(() => {});
    const stream = await navigator.mediaDevices.getUserMedia({ audio: id ? { deviceId: { exact: id } } : true, video: false });
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    context.createMediaStreamSource(stream).connect(analyser);
    micRef.current = { stream, context, analyser };
    return stream.getAudioTracks()[0]?.getSettings().deviceId || id || "";
  }, []);

  // Ask for camera and mic once so the browser reveals device names, then reopen the remembered ones.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const probe = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        probe.getTracks().forEach((track) => track.stop());
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;
        const cams = devices.filter((device) => device.kind === "videoinput");
        const inputs = devices.filter((device) => device.kind === "audioinput");
        setCameras(cams);
        setMics(inputs);
        const cam = cams.find((device) => device.deviceId === storage.get("present-camera")) || cams[0];
        const mic = inputs.find((device) => device.deviceId === storage.get("present-mic")) || inputs[0];
        setCameraId(await openCamera(cam?.deviceId || ""));
        setMicId(await openMic(mic?.deviceId || ""));
        setStatus("Ready. Share your slide window (or choose an image), then start a take.");
      } catch (error) {
        setStatus(error.name === "NotAllowedError" ? "Camera or microphone permission was refused. Allow both from the address bar, then reload." : `Couldn't open the camera or microphone: ${error.message}`);
      }
    })();
    return () => {
      cancelled = true;
      faceStreamRef.current?.getTracks().forEach((track) => track.stop());
      slideStreamRef.current?.getTracks().forEach((track) => track.stop());
      micRef.current?.stream.getTracks().forEach((track) => track.stop());
      micRef.current?.context.close().catch(() => {});
    };
  }, [openCamera, openMic]);

  // The level meter, and each chunk's loudest moment.
  useEffect(() => {
    let frame;
    const buffer = new Float32Array(1024);
    function tick() {
      const analyser = micRef.current?.analyser;
      if (analyser) {
        analyser.getFloatTimeDomainData(buffer);
        let sum = 0;
        for (const sample of buffer) sum += sample * sample;
        const rms = Math.sqrt(sum / buffer.length);
        chunkMetaRef.current.peak = Math.max(chunkMetaRef.current.peak, rms);
        setLevel(rms);
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  async function chooseCamera(id) {
    storage.set("present-camera", id);
    setCameraId(await openCamera(id).catch(() => id));
  }

  async function chooseMic(id) {
    storage.set("present-mic", id);
    setMicId(await openMic(id).catch(() => id));
  }

  async function shareWindow() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 10 }, audio: false });
      slideStreamRef.current?.getTracks().forEach((track) => track.stop());
      slideStreamRef.current = stream;
      stream.getVideoTracks()[0].addEventListener("ended", () => { if (slideStreamRef.current === stream) { slideStreamRef.current = null; setSlideSource(null); } });
      setSlideSource("window");
      requestAnimationFrame(() => { if (slideVideoRef.current) slideVideoRef.current.srcObject = stream; });
    } catch (error) {
      if (error.name !== "NotAllowedError") setStatus(`Couldn't share a window: ${error.message}`);
    }
  }

  function chooseImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    slideStreamRef.current?.getTracks().forEach((track) => track.stop());
    slideStreamRef.current = null;
    setSlideImage(URL.createObjectURL(file));
    setSlideSource("image");
  }

  // The slide as it is on screen now, as a JPEG no wider than 1600 px.
  async function slideSnapshot() {
    const source = slideSource === "window" ? slideVideoRef.current : slideSource === "image" ? slideImageRef.current : null;
    const width = source?.videoWidth || source?.naturalWidth;
    const height = source?.videoHeight || source?.naturalHeight;
    if (!width || !height) return null;
    const scale = Math.min(1, 1600 / width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    canvas.getContext("2d").drawImage(source, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
  }

  function liveText(segments = liveRef.current) {
    return segments.filter(Boolean).join(" ");
  }

  async function sendChunk(blob, index, peak) {
    if (peak < QUIET || blob.size < 1000) return;
    const form = new FormData();
    form.append("audio", blob, `chunk-${index}.webm`);
    form.append("prompt", [topic && `Topic: ${topic}.`, liveText().slice(-300)].filter(Boolean).join(" "));
    try {
      const response = await fetch("/api/present/transcribe", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      liveRef.current = [...liveRef.current];
      liveRef.current[index] = data.text;
      setLive(liveRef.current);
    } catch (error) {
      setStatus(`A live chunk failed (${error.message}); the full take is still being recorded.`);
    }
  }

  function startChunk(type) {
    const stream = micRef.current?.stream;
    if (!recordingRef.current || !stream) return;
    const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const parts = [];
    const index = chunkIndexRef.current++;
    const meta = { peak: 0 };
    chunkMetaRef.current = meta;
    recorder.ondataavailable = (event) => { if (event.data.size) parts.push(event.data); };
    recorder.onstop = () => sendChunk(new Blob(parts, { type: recorder.mimeType }), index, meta.peak);
    recorder.start();
    chunkRecorderRef.current = recorder;
  }

  function start() {
    const stream = micRef.current?.stream;
    if (!stream) { setStatus("No microphone is open."); return; }
    const type = audioType();
    recordingRef.current = true;
    liveRef.current = [];
    chunkIndexRef.current = 0;
    fullPartsRef.current = [];
    setLive([]);
    setResult(null);
    setElapsed(0);
    const full = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    full.ondataavailable = (event) => { if (event.data.size) fullPartsRef.current.push(event.data); };
    full.start(1000);
    fullRecorderRef.current = full;
    startChunk(type);
    const began = Date.now();
    let lastChunk = began;
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - began) / 1000));
      if (Date.now() - lastChunk >= CHUNK_MS) {
        lastChunk = Date.now();
        chunkRecorderRef.current?.stop();
        startChunk(type);
      }
    }, 250);
    setPhase("recording");
    setStatus("Recording. Talk to the room; the transcript fills in a few seconds behind you.");
  }

  async function stop() {
    recordingRef.current = false;
    clearInterval(timerRef.current);
    chunkRecorderRef.current?.stop();
    setPhase("finishing");
    setStatus("Transcribing the whole take and asking for follow-ups…");
    const full = fullRecorderRef.current;
    const audio = await new Promise((resolve) => {
      full.onstop = () => resolve(new Blob(fullPartsRef.current, { type: full.mimeType }));
      full.stop();
    });
    const form = new FormData();
    form.append("audio", audio, "take.webm");
    const slide = await slideSnapshot();
    if (slide) form.append("slide", slide, "slide.jpg");
    form.append("topic", topic);
    form.append("role", role);
    form.append("live", liveText());
    try {
      const response = await fetch("/api/present/finish", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setResult(data);
      const problems = [data.transcribeError && `transcript: ${data.transcribeError}`, data.followupsError && `follow-ups: ${data.followupsError}`, data.saveError && `save: ${data.saveError}`].filter(Boolean);
      setStatus(problems.length ? `Done, with problems (${problems.join("; ")}).` : `Done. Saved to _media/${data.saved}/.`);
    } catch (error) {
      setStatus(`Couldn't finish the take: ${error.message}`);
    }
    setPhase("done");
  }

  const recording = phase === "recording";
  const busy = phase === "finishing";
  const transcript = result?.transcript || liveText(live);

  return (
    <div className="present">
      <div className="present-controls">
        <label className="present-field present-topic">
          <span className="eyebrow">Topic or assignment</span>
          <input value={topic} onChange={(event) => setTopic(event.target.value)} placeholder="e.g. Explain the main finding of your paper in two minutes" disabled={recording || busy} />
        </label>
        <label className="present-field">
          <span className="eyebrow">Follow-ups from</span>
          <select value={role} onChange={(event) => setRole(event.target.value)} disabled={recording || busy}>
            {Object.entries(roles).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
          </select>
        </label>
        <label className="present-field">
          <span className="eyebrow">Camera</span>
          <select value={cameraId} onChange={(event) => chooseCamera(event.target.value)}>
            {cameras.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>)}
          </select>
        </label>
        <label className="present-field">
          <span className="eyebrow">Microphone</span>
          <select value={micId} onChange={(event) => chooseMic(event.target.value)} disabled={recording || busy}>
            {mics.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Microphone ${index + 1}`}</option>)}
          </select>
        </label>
      </div>

      <div className="present-stage">
        {slideSource === "window" && <video ref={slideVideoRef} className="present-slide" autoPlay playsInline muted />}
        {slideSource === "image" && <img ref={slideImageRef} className="present-slide" src={slideImage} alt="Your slide" />}
        {!slideSource && (
          <div className="present-empty">
            <p>Your slide goes here.</p>
            <div className="present-slide-buttons">
              <button type="button" className="capture-chip" onClick={shareWindow}>Share the slide window</button>
              <label className="capture-chip">Choose an image<input type="file" accept="image/*" onChange={chooseImage} hidden /></label>
            </div>
          </div>
        )}
        <video ref={faceRef} className="present-face" autoPlay playsInline muted />
        {slideSource && !recording && !busy && <button type="button" className="present-change capture-chip" onClick={() => { slideStreamRef.current?.getTracks().forEach((track) => track.stop()); slideStreamRef.current = null; setSlideSource(null); }}>Change slide</button>}
      </div>

      <div className="capture-actions">
        {recording
          ? <button type="button" className="capture-button present-stop" onClick={stop}>Stop take</button>
          : <button type="button" className="capture-button" onClick={start} disabled={busy}>{phase === "done" ? "New take" : "Start take"}</button>}
        <span className="present-clock" aria-label="Elapsed">{clock(elapsed)}</span>
        <span className="present-meter" aria-hidden="true"><span style={{ width: `${Math.min(100, level * 400)}%` }} /></span>
      </div>
      <p className="capture-status capture-status-muted" role="status">{status}</p>

      <div className="present-results">
        <section>
          <h2 className="eyebrow">{result?.transcript ? "Transcript (whole take)" : "Live transcript"}</h2>
          <p className="present-transcript">{transcript || (recording ? "Listening…" : "Nothing yet.")}</p>
        </section>
        <section>
          <h2 className="eyebrow">Follow-ups</h2>
          {busy && <p className="present-transcript">Thinking of questions…</p>}
          {result?.followups
            ? <div className="prose present-followups"><ReactMarkdown remarkPlugins={[remarkGfm]}>{result.followups}</ReactMarkdown></div>
            : !busy && <p className="present-transcript">They appear when you stop the take.</p>}
        </section>
      </div>
    </div>
  );
}
