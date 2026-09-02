"use strict";

const recordButton = document.getElementById("recordButton");
const recordingControls = document.getElementById("recordingControls");
const pauseButton = document.getElementById("pauseButton");
const stopButton = document.getElementById("stopButton");
const previewSection = document.getElementById("previewSection");
const previewVideo = document.getElementById("previewVideo");
const downloadButton = document.getElementById("downloadButton");
const newRecordingButton = document.getElementById("newRecordingButton");
const status = document.querySelector(".status");
const statusText = document.getElementById("statusText");
const durationText = document.getElementById("durationText");

let displayStream = null;
let mediaRecorder = null;
let recordedChunks = [];
let recordedBlob = null;
let recordedUrl = null;
let recordingStartedAt = null;
let recordingDuration = 0;
let stopping = false;

function setStatus(message, state = "") {
  statusText.textContent = message;
  status.className = "status";
  if (state) status.classList.add(state);
}

function supportsScreenRecording() {
  return Boolean(
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getDisplayMedia === "function" &&
    typeof window.MediaRecorder === "function"
  );
}

function chooseMimeType() {
  const candidates = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm"
  ];

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(total / 60);
  const remainingSeconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function clearPreviewUrl() {
  if (recordedUrl) {
    URL.revokeObjectURL(recordedUrl);
    recordedUrl = null;
  }
}

function resetPreview() {
  clearPreviewUrl();
  recordedBlob = null;
  previewVideo.removeAttribute("src");
  previewVideo.load();
  durationText.textContent = "";
  previewSection.hidden = true;
}

function stopDisplayTracks() {
  if (!displayStream) return;
  displayStream.getTracks().forEach((track) => track.stop());
  displayStream = null;
}

function finishRecording() {
  if (!mediaRecorder || mediaRecorder.state === "inactive") {
    stopDisplayTracks();
    return;
  }

  stopping = true;
  setStatus("Finishing recording…");
  mediaRecorder.stop();
}

function showPreview() {
  recordedBlob = new Blob(recordedChunks, {
    type: mediaRecorder?.mimeType || "video/webm"
  });

  if (!recordedBlob.size) {
    setStatus("No video was recorded. Please try again.");
    return;
  }

  clearPreviewUrl();
  recordedUrl = URL.createObjectURL(recordedBlob);
  previewVideo.src = recordedUrl;
  previewSection.hidden = false;
  durationText.textContent = formatDuration(recordingDuration);
  setStatus("Recording ready", "ready");
  downloadButton.focus({ preventScroll: true });
}

async function startRecording() {
  if (!supportsScreenRecording()) {
    setStatus("This browser does not support screen recording.");
    return;
  }

  resetPreview();
  recordedChunks = [];
  recordingDuration = 0;
  stopping = false;

  recordButton.disabled = true;
  setStatus("Choose what you want to record…");

  try {
    displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false
    });

    const mimeType = chooseMimeType();
    mediaRecorder = mimeType
      ? new MediaRecorder(displayStream, { mimeType })
      : new MediaRecorder(displayStream);

    displayStream.getVideoTracks()[0].addEventListener("ended", () => {
      // The browser's native "Stop sharing" control ends the video track.
      // Treat that exactly like clicking STOP.
      if (!stopping && mediaRecorder && mediaRecorder.state !== "inactive") {
        finishRecording();
      }
    });

    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    });

    mediaRecorder.addEventListener("start", () => {
      recordingStartedAt = performance.now();
      setStatus("Recording", "recording");
      recordingControls.hidden = false;
      pauseButton.disabled = false;
      stopButton.disabled = false;
    });

    mediaRecorder.addEventListener("pause", () => {
      if (recordingStartedAt !== null) {
        recordingDuration += (performance.now() - recordingStartedAt) / 1000;
        recordingStartedAt = null;
      }
      pauseButton.textContent = "RESUME";
      setStatus("Paused", "paused");
    });

    mediaRecorder.addEventListener("resume", () => {
      recordingStartedAt = performance.now();
      pauseButton.textContent = "PAUSE";
      setStatus("Recording", "recording");
    });

    mediaRecorder.addEventListener("stop", () => {
      if (recordingStartedAt !== null) {
        recordingDuration += (performance.now() - recordingStartedAt) / 1000;
        recordingStartedAt = null;
      }

      recordingControls.hidden = true;
      pauseButton.disabled = true;
      stopButton.disabled = true;
      pauseButton.textContent = "PAUSE";
      recordButton.disabled = false;

      stopDisplayTracks();
      showPreview();
      mediaRecorder = null;
      stopping = false;
    });

    mediaRecorder.addEventListener("error", () => {
      setStatus("The recording could not be completed. Please try again.");
      recordingControls.hidden = true;
      pauseButton.disabled = true;
      stopButton.disabled = true;
      recordButton.disabled = false;
      stopDisplayTracks();
      mediaRecorder = null;
      stopping = false;
    });

    mediaRecorder.start(1000);
  } catch (error) {
    stopDisplayTracks();
    mediaRecorder = null;
    recordButton.disabled = false;

    if (error?.name === "NotAllowedError" || error?.name === "AbortError") {
      setStatus("Screen selection was cancelled.");
    } else {
      console.error("Screen recording error:", error);
      setStatus("Unable to start screen recording. Please try again.");
    }
  }
}

function togglePause() {
  if (!mediaRecorder) return;

  if (mediaRecorder.state === "recording") {
    mediaRecorder.pause();
  } else if (mediaRecorder.state === "paused") {
    mediaRecorder.resume();
  }
}

function downloadRecording() {
  if (!recordedBlob || !recordedUrl) return;

  const anchor = document.createElement("a");
  anchor.href = recordedUrl;
  anchor.download = `easy-screen-capture-video-${new Date().toISOString().slice(0, 10)}.webm`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function prepareNewRecording() {
  resetPreview();
  recordedChunks = [];
  recordingDuration = 0;
  setStatus("Ready to record", "ready");
  recordButton.focus({ preventScroll: true });
}

recordButton.addEventListener("click", startRecording);
pauseButton.addEventListener("click", togglePause);
stopButton.addEventListener("click", finishRecording);
downloadButton.addEventListener("click", downloadRecording);
newRecordingButton.addEventListener("click", prepareNewRecording);

window.addEventListener("beforeunload", () => {
  stopDisplayTracks();
  clearPreviewUrl();
});

if (!supportsScreenRecording()) {
  recordButton.disabled = true;
  setStatus("Screen recording is not supported in this browser.");
}
