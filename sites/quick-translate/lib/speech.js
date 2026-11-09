export function bindVoiceUpdates(synth, onVoicesChanged) {
  const refresh = () => onVoicesChanged(synth.getVoices());
  if (typeof synth.addEventListener === "function") {
    synth.addEventListener("voiceschanged", refresh);
  } else {
    synth.onvoiceschanged = refresh;
  }
  refresh();
  return () => synth.removeEventListener?.("voiceschanged", refresh);
}

export function speakText({
  synth,
  createUtterance,
  text,
  languageTag,
  selectedVoice,
  voices = [],
  rate = 1,
  pitch = 1,
  volume = 1,
  onState = () => {},
}) {
  if (!text?.trim()) return false;

  const preferredLanguage = typeof languageTag === "string" && languageTag
    ? languageTag
    : "en-US";
  const languagePrefix = preferredLanguage.split("-")[0].toLowerCase();
  const voice = voices.find((item) => item.voiceURI === selectedVoice
      && item.lang.toLowerCase().startsWith(languagePrefix))
    || voices.find((item) => item.lang.toLowerCase().startsWith(languagePrefix));
  const utterance = createUtterance(text);
  utterance.lang = voice?.lang || preferredLanguage;
  if (voice) utterance.voice = voice;
  utterance.rate = Number.isFinite(+rate) && +rate > 0 ? +rate : 1;
  utterance.pitch = Number.isFinite(+pitch) ? Math.max(0, Math.min(2, +pitch)) : 1;
  utterance.volume = Number.isFinite(+volume) ? Math.max(0, Math.min(1, +volume)) : 1;
  utterance.onstart = () => onState("playing");
  utterance.onend = () => onState("finished");
  utterance.onerror = (event) => onState("error", event.error || "unknown");

  synth.cancel();
  if (synth.paused) synth.resume();
  synth.speak(utterance);
  return true;
}
