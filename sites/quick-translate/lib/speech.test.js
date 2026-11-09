import assert from "node:assert/strict";
import test from "node:test";
import { bindVoiceUpdates, speakText } from "./speech.js";

test("voice changes refresh the voice list without passing the browser event as a language", () => {
  const listeners = {};
  const voices = [{ name: "English", lang: "en-US", voiceURI: "en" }];
  const synth = {
    getVoices: () => voices,
    addEventListener: (name, listener) => { listeners[name] = listener; },
    removeEventListener: (name) => { delete listeners[name]; },
  };
  const updates = [];

  const unbind = bindVoiceUpdates(synth, (nextVoices) => updates.push(nextVoices));
  listeners.voiceschanged(new Event("voiceschanged"));

  assert.equal(updates.length, 2);
  assert.deepEqual(updates[1], voices);
  unbind();
  assert.equal(listeners.voiceschanged, undefined);
});

test("speech failures reach the page so the visitor can troubleshoot silent playback", () => {
  const states = [];
  const utterance = {};
  const synth = {
    paused: true,
    cancelCalls: 0,
    resumeCalls: 0,
    spoken: null,
    cancel() { this.cancelCalls += 1; },
    resume() { this.resumeCalls += 1; },
    speak(value) { this.spoken = value; },
  };

  speakText({
    synth,
    createUtterance: () => utterance,
    text: "Hello there.",
    languageTag: "en-US",
    voices: [],
    onState: (state, error) => states.push([state, error]),
  });
  utterance.onerror({ error: "voice-unavailable" });

  assert.equal(synth.cancelCalls, 1);
  assert.equal(synth.resumeCalls, 1);
  assert.equal(synth.spoken, utterance);
  assert.equal(utterance.lang, "en-US");
  assert.equal(states.at(-1)[0], "error");
  assert.equal(states.at(-1)[1], "voice-unavailable");
});
