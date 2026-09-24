"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { RATE, Take, tapMicrophone } from "../../lib/client/audio.mjs";

// Two passes over the talk. Live: the take is cut into chunks at pauses (3–12 s) and each chunk goes to Whisper,
// which returns timestamped segments: the grey draft. Slow: about every REVISE_SECONDS, at a chunk boundary, the
// stretch since the last revision goes to GPT Transcribe, and a text model reconciles the two transcripts into the
// passage's final text, which replaces the draft. Passages are revised one after another, so each gets the
// revised text before it as context.
const REVISE_SECONDS = 30;

const storage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch {} },
};

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
  const takeRef = useRef(null);
  const chunksRef = useRef([]);
  const passagesRef = useRef([]);
  const liveStartRef = useRef(0);
  const reviseStartRef = useRef(0);
  const lastPassageRef = useRef(Promise.resolve());
  const timerRef = useRef(null);
  const topicRef = useRef("");

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
  const [, setVersion] = useState(0);
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
    await tapMicrophone(context, stream, (samples) => { if (recordingRef.current) takeRef.current?.add(samples); });
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

  // The level meter.
  useEffect(() => {
    let frame;
    const buffer = new Float32Array(1024);
    function tick() {
      const analyser = micRef.current?.analyser;
      if (analyser) {
        analyser.getFloatTimeDomainData(buffer);
        let sum = 0;
        for (const sample of buffer) sum += sample * sample;
        setLevel(Math.sqrt(sum / buffer.length));
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

  const bump = () => setVersion((version) => version + 1);

  function draftOf(chunks) {
    return chunks.map((chunk) => chunk.text).filter(Boolean).join(" ");
  }

  function chunksIn(passage) {
    return chunksRef.current.filter((chunk) => chunk.start >= passage.start && chunk.end <= passage.end);
  }

  // The best text so far: revised passages, then the draft for everything not yet revised.
  function bestText() {
    const revisedTo = passagesRef.current.filter((passage) => passage.status === "revised").at(-1)?.end ?? 0;
    const revised = passagesRef.current.filter((passage) => passage.status === "revised").map((passage) => passage.text);
    return [...revised, draftOf(chunksRef.current.filter((chunk) => chunk.start >= revisedTo))].filter(Boolean).join(" ");
  }

  function cutChunk(start, end) {
    const take = takeRef.current;
    const chunk = { id: chunksRef.current.length, start, end, status: "transcribing", text: "", segments: [] };
    chunksRef.current.push(chunk);
    if (!take.hasSpeech(start, end)) {
      chunk.status = "quiet";
      chunk.done = Promise.resolve();
      return;
    }
    const form = new FormData();
    form.append("audio", take.wav(start, end), `chunk-${chunk.id}.wav`);
    form.append("prompt", [topicRef.current && `Topic: ${topicRef.current}.`, bestText().slice(-300)].filter(Boolean).join(" "));
    const offset = start / RATE;
    chunk.done = fetch("/api/present/transcribe", { method: "POST", body: form })
      .then((response) => response.json().then((data) => { if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`); return data; }))
      .then((data) => {
        chunk.text = data.text;
        chunk.segments = data.segments.map((segment) => ({ ...segment, start: offset + segment.start, end: offset + segment.end }));
        chunk.status = "done";
      })
      .catch((error) => { chunk.status = "failed"; chunk.error = error.message; })
      .finally(bump);
    bump();
  }

  // Queue a passage for revision behind the one before it.
  function queuePassage(start, end) {
    const take = takeRef.current;
    const passage = { id: passagesRef.current.length, start, end, status: "waiting", text: "" };
    passagesRef.current.push(passage);
    const previous = lastPassageRef.current;
    const done = previous.then(async () => {
      const chunks = chunksIn(passage);
      await Promise.all(chunks.map((chunk) => chunk.done));
      if (!take.hasSpeech(start, end)) { passage.status = "revised"; bump(); return; }
      passage.status = "revising";
      bump();
      const context = passagesRef.current.slice(0, passage.id).map((before) => (before.status === "revised" ? before.text : draftOf(chunksIn(before)))).filter(Boolean).join(" ");
      const form = new FormData();
      form.append("audio", take.wav(start, end), `passage-${passage.id}.wav`);
      form.append("draft", JSON.stringify(chunks.flatMap((chunk) => chunk.segments)));
      form.append("context", context.slice(-1200));
      form.append("topic", topicRef.current);
      try {
        const response = await fetch("/api/present/revise", { method: "POST", body: form });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
        Object.assign(passage, { status: "revised", text: data.text, careful: data.careful, model: data.model });
      } catch (error) {
        Object.assign(passage, { status: "failed", error: error.message });
      }
      bump();
    });
    lastPassageRef.current = done;
    bump();
  }

  function tick() {
    const take = takeRef.current;
    const cut = take.cutPoint(liveStartRef.current);
    if (cut == null || cut <= liveStartRef.current) return;
    cutChunk(liveStartRef.current, cut);
    liveStartRef.current = cut;
    if ((cut - reviseStartRef.current) / RATE >= REVISE_SECONDS) {
      queuePassage(reviseStartRef.current, cut);
      reviseStartRef.current = cut;
    }
  }

  async function start() {
    const mic = micRef.current;
    if (!mic) { setStatus("No microphone is open."); return; }
    await mic.context.resume();
    takeRef.current = new Take(mic.context.sampleRate);
    chunksRef.current = [];
    passagesRef.current = [];
    liveStartRef.current = 0;
    reviseStartRef.current = 0;
    lastPassageRef.current = Promise.resolve();
    topicRef.current = topic;
    recordingRef.current = true;
    setResult(null);
    setElapsed(0);
    const began = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - began) / 1000));
      tick();
    }, 100);
    setPhase("recording");
    setStatus("Recording. The grey draft fills in at each pause; every half minute or so it is revised and turns white.");
    bump();
  }

  async function stop() {
    recordingRef.current = false;
    clearInterval(timerRef.current);
    const take = takeRef.current;
    const end = take.length;
    if (end - liveStartRef.current > RATE * 0.3) cutChunk(liveStartRef.current, end);
    if (end - reviseStartRef.current > RATE * 0.5) queuePassage(reviseStartRef.current, end);
    setPhase("finishing");
    const waiting = passagesRef.current.filter((passage) => passage.status !== "revised" && passage.status !== "failed").length;
    setStatus(`Revising the transcript (${waiting} passage${waiting === 1 ? "" : "s"} to go), then asking for follow-ups. This part is slow on purpose.`);
    await lastPassageRef.current;

    const transcript = passagesRef.current.map((passage) => (passage.status === "revised" ? passage.text : draftOf(chunksIn(passage)))).filter(Boolean).join(" ");
    const record = {
      topic,
      role,
      seconds: take.seconds(),
      chunks: chunksRef.current.map(({ id, start, end, status, text, segments, error }) => ({ id, start: start / RATE, end: end / RATE, status, text, segments, error })),
      passages: passagesRef.current.map(({ id, start, end, status, text, careful, model, error }) => ({ id, start: start / RATE, end: end / RATE, status, text, careful, model, error })),
    };
    const form = new FormData();
    form.append("audio", take.wav(), "take.wav");
    const slide = await slideSnapshot();
    if (slide) form.append("slide", slide, "slide.jpg");
    form.append("topic", topic);
    form.append("role", role);
    form.append("transcript", transcript);
    form.append("record", JSON.stringify(record, null, 2));
    setStatus("Asking for follow-ups…");
    try {
      const response = await fetch("/api/present/finish", { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      setResult({ ...data, transcript });
      const failed = passagesRef.current.filter((passage) => passage.status === "failed").length;
      const problems = [failed && `${failed} passage${failed === 1 ? "" : "s"} kept the draft`, data.followupsError && `follow-ups: ${data.followupsError}`, data.saveError && `save: ${data.saveError}`].filter(Boolean);
      setStatus(problems.length ? `Done, with problems (${problems.join("; ")}).` : `Done. Saved to _media/${data.saved}/.`);
    } catch (error) {
      setStatus(`Couldn't finish the take: ${error.message}`);
    }
    setPhase("done");
  }

  const recording = phase === "recording";
  const busy = phase === "finishing";
  // Revised passages in full ink; everything still in draft in grey.
  const revisedTo = passagesRef.current.filter((passage) => passage.status === "revised" || passage.status === "failed").at(-1)?.end ?? 0;
  const pieces = [
    ...passagesRef.current.map((passage) => (passage.status === "revised"
      ? { key: `p${passage.id}`, text: passage.text, revised: true }
      : { key: `p${passage.id}`, text: draftOf(chunksIn(passage)), revising: passage.status === "revising" || passage.status === "waiting" })),
    ...chunksRef.current.filter((chunk) => chunk.start >= Math.max(revisedTo, passagesRef.current.at(-1)?.end ?? 0)).map((chunk) => ({ key: `c${chunk.id}`, text: chunk.status === "transcribing" ? "…" : chunk.text })),
  ].filter((piece) => piece.text);
  const revisedCount = passagesRef.current.filter((passage) => passage.status === "revised").length;

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
          <h2 className="eyebrow">Transcript{passagesRef.current.length ? ` · ${revisedCount} of ${passagesRef.current.length} passage${passagesRef.current.length === 1 ? "" : "s"} revised` : ""}</h2>
          <p className="present-transcript">
            {pieces.length
              ? pieces.map((piece) => <span key={piece.key} className={piece.revised ? "present-revised" : piece.revising ? "present-draft present-revising" : "present-draft"}>{piece.text} </span>)
              : recording ? "Listening…" : "Nothing yet."}
          </p>
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
