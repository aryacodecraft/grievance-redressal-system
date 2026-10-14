// Opt-in local Chromium probe, invoked only by the mock-only pytest harness.
// Native keyboard/permission/CORS checks use server-rendered recorder markup;
// React capture lifecycle is covered separately, not claimed by this probe.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { sourceLoader, frontendRoot } from "./voice-test-loader.mjs";

const base = process.env.VOICE_E2E_URL;
assert.equal(new URL(base).hostname, "127.0.0.1");
const load = sourceLoader();
const { VoiceRecorder } = load("components/grievance/VoiceRecorder.tsx");
const { I18nProvider } = load("lib/i18n/index.tsx");
const { encodeWav, resampleMono } = load("lib/voice/audio.ts");
const samples = Float32Array.from({ length: 4800 }, (_, i) => 0.25 * Math.sin(2 * Math.PI * 1000 * i / 48000));
const wavBase64 = Buffer.from(encodeWav(resampleMono(samples, 48000))).toString("base64");
const markup = renderToStaticMarkup(React.createElement(I18nProvider, null,
  React.createElement(VoiceRecorder, { prepareTranscription: () => "", onTranscript: () => true })));
const cssDir = path.join(frontendRoot, ".next/static/chunks");
const css = fs.existsSync(cssDir) ? fs.readdirSync(cssDir).filter((name) => name.endsWith(".css"))
  .map((name) => fs.readFileSync(path.join(cssDir, name), "utf8")).join("\n") : "";
assert.ok(css, "Existing frontend build CSS required for focus visibility check");
const html = `<!doctype html><html lang="en"><head><style>${css}</style></head><body>${markup}
<script>window.activations=0; document.querySelector('button').addEventListener('click',()=>window.activations++);</script></body></html>`;
const pageServer = http.createServer((_request, response) => {
  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); response.end(html);
});
pageServer.listen(0, "127.0.0.1"); await once(pageServer, "listening");
const port = pageServer.address().port;
const origin = `http://localhost:${port}`;
await fetch(`${base}/__voice_test/browser_origin?origin=${encodeURIComponent(origin)}`);
const scenario = async (mode) => assert.ok((await fetch(`${base}/__voice_test/scenario?mode=${mode}`)).ok);
const stats = async () => (await fetch(`${base}/__voice_test/stats`)).json();
const browsers = [
  ["Chrome", "C:/Program Files/Google/Chrome/Application/chrome.exe"],
  ["Edge", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"],
];
try {
  for (const [name, executable] of browsers) {
    assert.ok(fs.existsSync(executable), `${name} unavailable`);
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), "grievai-voice-browser-"));
    const child = spawn(executable, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
      "--no-first-run", "--disable-background-networking", "--disable-component-update", "--disable-sync",
      "--no-proxy-server", "--use-fake-device-for-media-stream",
      "--host-resolver-rules=MAP voice-insecure.test 127.0.0.1", "about:blank"], { windowsHide: true });
    let socket;
    try {
      const endpoint = await new Promise((resolve, reject) => {
        let output = "";
        const timer = setTimeout(() => reject(new Error(`${name} CDP startup timeout`)), 15000);
        child.stderr.on("data", (chunk) => {
          output += chunk; const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
          if (match) { clearTimeout(timer); resolve(match[1]); }
        });
        child.once("error", (error) => { clearTimeout(timer); reject(error); });
      });
      socket = new WebSocket(endpoint); await new Promise((resolve, reject) => {
        socket.onopen = resolve; socket.onerror = reject;
      });
      let sequence = 0, dialogOpened; const pending = new Map();
      socket.onmessage = ({ data }) => {
        const reply = JSON.parse(data);
        if (reply.method === "Page.javascriptDialogOpening") dialogOpened?.();
        if (!reply.id) return;
        const entry = pending.get(reply.id); pending.delete(reply.id);
        clearTimeout(entry.timer);
        if (reply.error) entry.reject(new Error(JSON.stringify(reply.error))); else entry.resolve(reply.result);
      };
      const cdp = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
        const id = ++sequence;
        const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timeout`)); }, 10000);
        pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params, sessionId }));
      });
      const version = await cdp("Browser.getVersion");
      const { targetInfos } = await cdp("Target.getTargets");
      const targetId = targetInfos.find((target) => target.type === "page").targetId;
      const { sessionId } = await cdp("Target.attachToTarget", { targetId, flatten: true });
      await cdp("Runtime.enable", {}, sessionId);
      await cdp("Page.enable", {}, sessionId);
      const evaluate = async (expression) => {
        let result;
        try { result = await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true }, sessionId); }
        catch (error) { throw new Error(`${expression.slice(0, 90)}: ${error.message}`); }
        assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails)); return result.result.value;
      };
      const navigate = async (url) => {
        await cdp("Page.navigate", { url }, sessionId);
        for (let i = 0; i < 60; i++) {
          if (await evaluate(`location.href===${JSON.stringify(url)} && document.readyState==='complete'`)) return;
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        assert.fail("Page did not load");
      };
      await navigate(origin + "/");
      assert.equal(await evaluate("isSecureContext && !!navigator.mediaDevices && !!AudioWorkletNode"), true);
      const key = async (value, code) => {
        const windowsVirtualKeyCode = { Tab: 9, Enter: 13, Space: 32 }[code];
        await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: value, code, windowsVirtualKeyCode,
          text: code === "Space" ? " " : code === "Enter" ? "\r" : "" }, sessionId);
        await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: value, code, windowsVirtualKeyCode }, sessionId);
      };
      await key("Tab", "Tab"); assert.equal(await evaluate("document.activeElement.tagName"), "SELECT");
      await key("Tab", "Tab"); assert.equal(await evaluate("document.activeElement.tagName"), "BUTTON");
      assert.equal(await evaluate("document.activeElement.matches(':focus-visible') && getComputedStyle(document.activeElement).boxShadow!=='none'"), true);
      await key("Enter", "Enter"); assert.equal(await evaluate("activations"), 1);
      await key(" ", "Space");
      assert.equal(await evaluate("activations"), 2);
      const { nodes } = await cdp("Accessibility.getFullAXTree", {}, sessionId);
      assert.ok(nodes.some((node) => node.role?.value === "button" && node.name?.value === "Start recording"));
      assert.ok(nodes.some((node) => node.role?.value === "combobox" && node.name?.value));
      for (const accept of [false, true]) {
        const opened = new Promise((resolve) => { dialogOpened = resolve; });
        const answer = evaluate("confirm('Replace existing description?')");
        await opened; await cdp("Page.handleJavaScriptDialog", { accept }, sessionId);
        assert.equal(await answer, accept);
      }
      await cdp("Browser.setPermission", { permission: { name: "microphone" }, setting: "granted", origin });
      assert.equal(await evaluate("(async()=>{const s=await navigator.mediaDevices.getUserMedia({audio:true});const tracks=s.getTracks();tracks.forEach(t=>t.stop());return tracks.every(t=>t.readyState==='ended')})()"), true);
      await cdp("Browser.setPermission", { permission: { name: "microphone" }, setting: "denied", origin });
      assert.equal(await evaluate("navigator.mediaDevices.getUserMedia({audio:true}).then(()=> 'unexpected',e=>e.name)"), "NotAllowedError");
      // Browser-generated authenticated multipart POST also generates preflight.
      const post = async (auth = true, valid = true) => evaluate(`(async()=>{
        const bytes=Uint8Array.from(atob(${JSON.stringify(wavBase64)}),c=>c.charCodeAt(0));window.voiceWav=bytes;
        const form=new FormData();form.append('file',new Blob([${valid ? "bytes" : "'invalid'"}],{type:'audio/wav'}),'recording.wav');form.append('language_code','en-IN');
        try {const r=await fetch(${JSON.stringify(base + "/transcribe")},{method:'POST',headers:${JSON.stringify(auth ? { Authorization: `Bearer ${process.env.VOICE_E2E_TOKEN}`, "Idempotency-Key": `${name}-${crypto.randomUUID()}` } : {})},body:form});return {status:r.status,body:await r.json()}}catch(e){return {blocked:e.name}}
      })()`);
      await scenario("success"); const preflightBefore = await stats();
      assert.equal((await post()).status, 200);
      assert.ok((await stats()).options > preflightBefore.options, "Browser must send OPTIONS before authenticated multipart");
      const playback = await evaluate(`(async()=>{
        const context=new AudioContext({sampleRate:16000});
        const decoded=await context.decodeAudioData(voiceWav.buffer.slice(0));
        const url=URL.createObjectURL(new Blob([voiceWav],{type:'audio/wav'}));
        const player=document.createElement('audio');player.controls=true;player.setAttribute('aria-label','Recorded complaint playback');
        document.body.append(player);const loaded=new Promise((resolve,reject)=>{player.onloadedmetadata=resolve;player.onerror=reject});
        player.src=url;await loaded;await player.play();const playing=!player.paused;player.pause();
        const result={frames:decoded.length,rate:decoded.sampleRate,nonzero:decoded.getChannelData(0).some(x=>x!==0),duration:player.duration,playing,controls:player.controls};
        player.remove();URL.revokeObjectURL(url);await context.close();return result;
      })()`);
      assert.deepEqual(playback, { frames: 1600, rate: 16000, nonzero: true, duration: 0.1, playing: true, controls: true });
      assert.equal((await post(false)).status, 401);
      assert.equal((await post(true, false)).status, 415);
      await scenario("disabled"); assert.equal((await post()).status, 503);
      await scenario("success"); const before = await stats();
      await navigate(`http://127.0.0.1:${port}/`);
      assert.equal((await post()).blocked, "TypeError");
      const after = await stats(); assert.equal(after.posts, before.posts); assert.equal(after.provider, before.provider);
      assert.equal(after.options, before.options + 1);
      await navigate(`http://voice-insecure.test:${port}/`);
      assert.equal(await evaluate("!isSecureContext && !navigator.mediaDevices"), true);
      console.log(`${name} (${version.product}): PASS CORS success/401/415/503, blocked origin; secure/insecure context; fake mic allowed/denied/track stop; native Tab/Enter/Space/focus ring, AX labels, confirm accept/cancel; generated WAV decode/playback`);
    } finally {
      socket?.close(); child.kill();
      await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, 3000))]);
      // Chrome child processes can briefly retain profile locks on Windows.
      assert.ok(path.resolve(profile).startsWith(path.resolve(os.tmpdir()) + path.sep));
      assert.ok(path.basename(profile).startsWith("grievai-voice-browser-"));
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    }
  }
} finally { pageServer.close(); }
