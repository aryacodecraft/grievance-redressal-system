// Hydrated Next.js /submit UI, real AudioWorklet + fake hardware. API requests
// are fulfilled/blocked by CDP before transport; no backend or provider is used.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { once } from "node:events";

const origin = process.env.VOICE_PAGE_URL ?? "http://127.0.0.1:3000";
assert.ok(["127.0.0.1", "localhost"].includes(new URL(origin).hostname));
const browsers = [
  ["Chrome", "C:/Program Files/Google/Chrome/Application/chrome.exe"],
  ["Edge", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"],
];
for (const [name, executable] of browsers) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "grievai-title-hydrated-"));
  const child = spawn(executable, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`,
    "--no-first-run", "--disable-background-networking", "--disable-component-update", "--disable-sync",
    "--use-fake-device-for-media-stream", "--no-proxy-server", "about:blank"], { windowsHide: true });
  let socket;
  try {
    const endpoint = await new Promise((resolve, reject) => {
      let output = ""; const timer = setTimeout(() => reject(new Error("CDP startup timeout")), 15000);
      child.stderr.on("data", (chunk) => { output += chunk; const match = output.match(/DevTools listening on (ws:\/\/\S+)/);
        if (match) { clearTimeout(timer); resolve(match[1]); } });
      child.once("error", (error) => { clearTimeout(timer); reject(error); });
    });
    socket = new WebSocket(endpoint);
    await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
    let sequence = 0, sessionId, acceptDialog = true, held, interceptionError;
    let transcript = "Hello! Water supply is not working. Please repair it in our neighbourhood.";
    let mode = "success", language = "en-IN", posts = 0, submissions = 0, writes = 0, dialogs = 0, automaticChoice = true;
    const pending = new Map();
    const writePaths = [];
    const consoleErrors = new Set(); let frameworkDebugRequests = 0;
    const cdp = (method, params = {}, targetSession) => new Promise((resolve, reject) => {
      const id = ++sequence; const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timeout`)); }, 30000);
      pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params, sessionId: targetSession }));
    });
    const fulfill = (requestId, status, body) => cdp("Fetch.fulfillRequest", { requestId, responseCode: status,
      responseHeaders: [{ name: "Content-Type", value: "application/json" }, { name: "Access-Control-Allow-Origin", value: origin },
        { name: "Access-Control-Allow-Headers", value: "authorization,idempotency-key,content-type" }, { name: "Access-Control-Allow-Methods", value: "GET,POST,OPTIONS" }],
      body: Buffer.from(JSON.stringify(body)).toString("base64") }, sessionId);
    socket.onmessage = ({ data }) => {
      const reply = JSON.parse(data);
      if (reply.method === "Runtime.consoleAPICalled" && reply.params.type === "error") {
        const first = reply.params.args[0];
        consoleErrors.add(String(first?.value ?? first?.description ?? "console error").split("\n")[0].slice(0, 180));
      }
      if (reply.id) {
        const entry = pending.get(reply.id); if (!entry) return;
        pending.delete(reply.id); clearTimeout(entry.timer);
        if (reply.error) entry.reject(new Error(JSON.stringify(reply.error))); else entry.resolve(reply.result);
        return;
      }
      if (reply.method === "Page.javascriptDialogOpening") {
        dialogs++; void cdp("Page.handleJavaScriptDialog", { accept: acceptDialog }, sessionId).catch((error) => { interceptionError = error; });
      }
      if (reply.method === "Fetch.requestPaused") void (async () => {
        const { request, requestId } = reply.params; const url = new URL(request.url);
        if (request.method === "OPTIONS") return fulfill(requestId, 200, {});
        if (url.pathname === "/transcribe") {
          posts++; assert.equal(request.method, "POST");
          assert.equal(Object.entries(request.headers).find(([key]) => key.toLowerCase() === "authorization")?.[1], "Bearer stage8-mock-token");
          assert.ok(Object.entries(request.headers).some(([key, value]) => key.toLowerCase() === "content-type" && value.startsWith("multipart/form-data;")));
          if (mode === "pending") { held = requestId; return; }
          return fulfill(requestId, mode === "error" ? 503 : 200,
            mode === "error" ? { error: "Mock disabled transcription" } : { transcript, language_code: language });
        }
        if (url.pathname === "/submit-grievance") submissions++;
        if (url.origin === origin && url.pathname.startsWith("/__nextjs_")) {
          frameworkDebugRequests++;
          return cdp("Fetch.failRequest", { requestId, errorReason: "BlockedByClient" }, sessionId);
        }
        if (request.method !== "GET" && request.method !== "HEAD") { writes++; writePaths.push(url.pathname); }
        if (url.pathname === "/auth/me") return fulfill(requestId, 200,
          { id: "stage8-mock-citizen", email: "stage8@example.invalid", full_name: "Stage 8 browser citizen", role: "USER" });
        if (request.method === "GET" && /^\/(?:grievances|notifications)(?:\/|$)/.test(url.pathname)) return fulfill(requestId, 200, []);
        if (url.origin === origin && ["GET", "HEAD"].includes(request.method)) return cdp("Fetch.continueRequest", { requestId }, sessionId);
        // History/notification reads receive empty mocks. All other network is blocked.
        return fulfill(requestId, request.method === "GET" ? 200 : 403, request.method === "GET" ? [] : { error: "Writes forbidden" });
      })().catch((error) => { interceptionError = error; });
    };
    const version = await cdp("Browser.getVersion");
    const { targetInfos } = await cdp("Target.getTargets");
    ({ sessionId } = await cdp("Target.attachToTarget", { targetId: targetInfos.find((target) => target.type === "page").targetId, flatten: true }));
    await cdp("Page.enable", {}, sessionId); await cdp("Runtime.enable", {}, sessionId);
    await cdp("Fetch.enable", { patterns: [{ urlPattern: "*" }] }, sessionId);
    await cdp("Browser.setPermission", { permission: { name: "microphone" }, setting: "granted", origin });
    await cdp("Page.addScriptToEvaluateOnNewDocument", { source: `localStorage.setItem('grievai-access-token','stage8-mock-token');localStorage.setItem('grievai-demo-user',JSON.stringify({id:'stage8-mock-citizen',role:'USER',name:'Stage 8 browser citizen'}));localStorage.setItem('grievai-language','en');
      window.__voiceTracks=[];window.__voiceRevoked=[];window.__dialogShows=0;
      const show=HTMLDialogElement.prototype.showModal;HTMLDialogElement.prototype.showModal=function(){window.__dialogShows++;return show.call(this)};
      const revoke=URL.revokeObjectURL;URL.revokeObjectURL=function(url){window.__voiceRevoked.push(url);return revoke.call(URL,url)};
      const media=navigator.mediaDevices;if(media){const get=media.getUserMedia.bind(media);media.getUserMedia=async function(options){const stream=await get(options);window.__voiceTracks.push(...stream.getTracks());return stream}}` }, sessionId);
    const evaluate = async (expression) => {
      if (interceptionError) throw interceptionError;
      const result = await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true }, sessionId);
      assert.equal(result.exceptionDetails, undefined, JSON.stringify(result.exceptionDetails)); return result.result.value;
    };
    const wait = async (expression) => {
      for (let i = 0; i < 200; i++) {
        if (automaticChoice) await evaluate(`[...document.querySelectorAll('dialog[open] button')].find(b=>b.textContent===${JSON.stringify(acceptDialog ? "Replace" : "Cancel")})?.click()`);
        if (await evaluate(expression)) return;
        await new Promise((resolve) => setTimeout(resolve, 50)); }
      assert.fail(`Wait failed: ${expression}`);
    };
    const click = async (label) => {
      await wait(`[...document.querySelectorAll('form button')].some(b=>b.textContent===${JSON.stringify(label)}&&!b.disabled)`);
      await evaluate(`[...document.querySelectorAll('form button')].find(b=>b.textContent===${JSON.stringify(label)}).click()`);
      await new Promise((resolve) => setTimeout(resolve, 50));
      if (automaticChoice) await evaluate(`[...document.querySelectorAll('dialog[open] button')].find(b=>b.textContent===${JSON.stringify(acceptDialog ? "Replace" : "Cancel")})?.click()`);
    };
    const field = (name) => `document.querySelector('form [name="${name}"]')`;
    const type = async (name, text) => {
      // Trusted CDP typing exercises RHF's actual hydrated event listeners.
      await evaluate(`${field(name)}.focus();${field(name)}.select()`);
      await cdp("Input.insertText", { text }, sessionId);
      assert.equal(await evaluate(`${field(name)}.value`), text);
    };
    const values = () => evaluate(`({title:${field("title")}.value,description:${field("description")}.value})`);
    const fresh = async () => {
      mode = "success"; language = "en-IN"; held = undefined; acceptDialog = true; automaticChoice = true;
      await cdp("Page.navigate", { url: origin + "/submit" }, sessionId);
      await wait(`!!${field("title")} && [...document.querySelectorAll('form button')].some(b=>b.textContent==='Start recording')`);
    };
    const record = async () => {
      await click("Start recording"); await wait(`[...document.querySelectorAll('form button')].some(b=>b.textContent==='Stop recording')`);
      await new Promise((resolve) => setTimeout(resolve, 400)); await click("Stop recording");
      await wait(`!!document.querySelector('form audio') && [...document.querySelectorAll('form button')].some(b=>b.textContent==='Transcribe'&&!b.disabled)`);
    };
    const transcribe = async () => { await click("Transcribe");
      await wait(`[...document.querySelectorAll('form button')].some(b=>b.textContent==='Transcribe'&&!b.disabled)`); };
    let cases = 0;
    for (const [text, title, code] of [
      ["There is a broken street light near my house. Please repair it.", "broken street light near my house", "en-IN"],
      ["Hello! Water supply is not working. Please repair it in our neighbourhood.", "Water supply is not working", "en-IN"],
      ["मैं बताना चाहता हूँ कि पानी की आपूर्ति नहीं हो रही है। कृपया सहायता करें।", "पानी की आपूर्ति नहीं हो रही है", "hi-IN"],
      ["मला सांगायचे आहे की रस्त्यावरील दिवे चालू नाहीत। कृपया मदत करा.", "रस्त्यावरील दिवे चालू नाहीत", "mr-IN"],
    ]) {
      await fresh(); transcript = text; language = code;
      await evaluate(`document.querySelector('form section select').value=${JSON.stringify(code)};document.querySelector('form section select').dispatchEvent(new Event('change',{bubbles:true}))`);
      await record(); await transcribe();
      assert.deepEqual(await values(), { title, description: text }); cases++;
    }
    transcript = "Water supply is not working. Please repair it in our neighbourhood.";
    await fresh(); await type("title", "My manually entered title"); await record(); await transcribe();
    assert.deepEqual(await values(), { title: "My manually entered title", description: transcript }); cases++;
    acceptDialog = false; const beforeDialogs = dialogs; await click("Use suggested title");
    assert.equal((await values()).title, "My manually entered title"); assert.equal(dialogs, beforeDialogs + 1); cases++;
    acceptDialog = true; await click("Use suggested title"); await wait(`${field("title")}.value==='Water supply is not working'`); cases++;
    await type("title", "Edited generated title"); await type("description", "Edited generated description");
    assert.deepEqual(await values(), { title: "Edited generated title", description: "Edited generated description" }); cases++;
    await fresh(); await record(); mode = "pending"; await click("Transcribe");
    for (let i = 0; !held && i < 100; i++) await new Promise((resolve) => setTimeout(resolve, 50));
    assert.ok(held); await type("title", "Typed during transcription");
    await fulfill(held, 200, { transcript, language_code: "en-IN" }); held = undefined;
    await wait(`${field("description")}.value===${JSON.stringify(transcript)}`);
    assert.equal((await values()).title, "Typed during transcription"); cases++;
    await fresh(); await record(); await transcribe(); const previousTitle = (await values()).title;
    transcript = "Garbage collection has stopped in our neighbourhood."; await transcribe();
    assert.deepEqual(await values(), { title: previousTitle, description: transcript }); cases++;
    for (const outcome of ["error", "cancel", "discard"]) {
      await fresh(); await type("title", "Keep original title"); await type("description", "Keep original description"); await record();
      const before = await values(), beforePosts = posts;
      if (outcome === "cancel") { acceptDialog = false; await transcribe(); assert.equal(posts, beforePosts); }
      else if (outcome === "error") { mode = "error"; await transcribe(); await wait(`!!document.querySelector('form [role="alert"]')`); }
      else {
        mode = "pending"; await click("Transcribe");
        for (let i = 0; !held && i < 100; i++) await new Promise((resolve) => setTimeout(resolve, 50));
        assert.ok(held); const stale = held; await click("Discard recording");
        // The aborted request may already be invalidated by Chrome; either way no late insertion.
        await fulfill(stale, 200, { transcript, language_code: "en-IN" }).catch(() => {}); held = undefined;
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      assert.deepEqual(await values(), before); cases++;
    }
    // Stage 9: exercise real HTML dialogs without the legacy auto-choice helper.
    const key = async (code, shift = false) => {
      const codes = { Tab: 9, Enter: 13, Space: 32, Escape: 27 };
      const value = code === "Space" ? " " : code;
      await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: value, code, windowsVirtualKeyCode: codes[code], modifiers: shift ? 8 : 0,
        text: code === "Enter" ? "\r" : code === "Space" ? " " : "" }, sessionId);
      await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: value, code, windowsVirtualKeyCode: codes[code], modifiers: shift ? 8 : 0 }, sessionId);
    };
    await fresh(); automaticChoice = false; transcript = "Water supply is not working. Please repair it.";
    const showsBefore = await evaluate("__dialogShows"); await record(); await transcribe();
    assert.equal(await evaluate("__dialogShows"), showsBefore); cases++;
    for (const action of ["Append", "Replace", "Cancel"]) {
      await fresh(); automaticChoice = false; await type("title", "Manual citizen title"); await type("description", "Existing citizen text"); await record();
      await evaluate(`[...document.querySelectorAll('form button')].find(b=>b.textContent==='Transcribe').focus()`);
      const beforePosts = posts; await key("Enter"); await wait("!!document.querySelector('dialog[open]')");
      assert.deepEqual(await evaluate("[...document.querySelectorAll('dialog button')].map(b=>b.textContent)"), ["Append", "Replace", "Cancel"]);
      assert.equal(await evaluate("document.activeElement.textContent"), "Cancel");
      assert.ok(await evaluate("document.activeElement.matches(':focus-visible')&&getComputedStyle(document.activeElement).boxShadow!=='none'"));
      await key("Tab"); assert.equal(await evaluate("document.activeElement.textContent"), "Append");
      await key("Tab"); assert.equal(await evaluate("document.activeElement.textContent"), "Replace");
      await key("Tab"); assert.equal(await evaluate("document.activeElement.textContent"), "Cancel");
      const { nodes } = await cdp("Accessibility.getFullAXTree", {}, sessionId);
      assert.ok(nodes.some(n=>n.role?.value==='dialog'&&n.name?.value==='Add transcription to your complaint'));
      assert.ok(nodes.some(n=>n.role?.value==='dialog'&&n.description?.value?.includes('Append keeps your description')));
      if (action !== "Cancel") await key("Tab");
      if (action === "Replace") await key("Tab");
      assert.equal(await evaluate("document.activeElement.textContent"), action);
      await key(action === "Append" ? "Space" : "Enter");
      await wait("!document.querySelector('dialog[open]')");
      if (action !== "Cancel") await wait(`${field("description")}.value===${JSON.stringify(action === "Append" ? "Existing citizen text\n\n" + transcript : transcript)}`);
      assert.deepEqual(await values(), { title: "Manual citizen title", description: action === "Cancel" ? "Existing citizen text" : action === "Append" ? "Existing citizen text\n\n" + transcript : transcript });
      assert.equal(posts, beforePosts + (action === "Cancel" ? 0 : 1));
      assert.equal(await evaluate("document.querySelector('form section [role=status]').getAttribute('aria-live')"), "polite");
      if (action !== "Cancel") assert.ok(await evaluate("document.querySelector('form section [role=status]').textContent.includes('Transcription added')"));
      await wait("document.activeElement.textContent==='Transcribe'||document.activeElement.name==='description'"); cases++;
    }
    for (const [locale, labels] of [["en", ["Append","Replace","Cancel"]], ["hi", ["जोड़ें","बदलें","रद्द करें"]], ["mr", ["जोडा","बदला","रद्द करा"]]]) {
      await fresh(); automaticChoice = false; await type("description", "Existing citizen description"); await record();
      await evaluate(`localStorage.setItem('grievai-language',${JSON.stringify(locale)})`);
      // Changing saved locale requires a fresh hydrated mount; restore recording afterward.
      const { identifier } = await cdp("Page.addScriptToEvaluateOnNewDocument", { source: `localStorage.setItem('grievai-language',${JSON.stringify(locale)})` }, sessionId);
      await cdp("Page.navigate", { url: origin + "/submit" }, sessionId);
      await wait(`!!${field("title")}&&document.documentElement.lang===${JSON.stringify(locale)}`);
      await type("description", "Existing citizen description");
      // Use selector-independent positions for localized recorder actions.
      await evaluate("document.querySelector('form section button').click()");
      await wait("!!document.querySelector('form section svg.lucide-square')");
      await new Promise(r=>setTimeout(r,400)); await evaluate("document.querySelector('form section button').click()");
      await wait("!!document.querySelector('form audio')");
      await evaluate("[...document.querySelectorAll('form section button')].at(-1).focus()"); await key("Enter");
      await wait("!!document.querySelector('dialog[open]')");
      assert.deepEqual(await evaluate("[...document.querySelectorAll('dialog button')].map(b=>b.textContent)"), labels);
      const { nodes } = await cdp("Accessibility.getFullAXTree", {}, sessionId);
      assert.ok(nodes.some(n=>n.role?.value==='dialog'&&n.name?.value&&n.description?.value));
      for (const label of labels) assert.ok(nodes.some(n=>n.role?.value==='button'&&n.name?.value===label));
      await key("Escape"); await wait("!document.querySelector('dialog')");
      assert.equal((await values()).description, "Existing citizen description");
      await cdp("Page.removeScriptToEvaluateOnNewDocument", { identifier }, sessionId); cases++;
    }
    await cdp("Page.addScriptToEvaluateOnNewDocument", { source: "localStorage.setItem('grievai-language','en')" }, sessionId);
    for (const action of ["Append", "Replace", "Cancel"]) {
      await fresh(); automaticChoice = false; await type("title", "Protected title"); await record();
      mode = "pending"; await click("Transcribe");
      for(let i=0;!held&&i<100;i++) await new Promise(r=>setTimeout(r,50)); assert.ok(held);
      await type("description", "Latest pending edits"); const beforePosts=posts;
      await fulfill(held,200,{transcript,language_code:'en-IN'}); held=undefined;
      await wait("!!document.querySelector('dialog[open]')");
      assert.ok(await evaluate("document.querySelector('dialog').textContent.includes('Your description changed')"));
      await evaluate(`[...document.querySelectorAll('dialog button')].find(b=>b.textContent===${JSON.stringify(action)}).click()`);
      await wait("!document.querySelector('dialog')");
      assert.deepEqual(await values(),{title:'Protected title',description:action==='Cancel'?'Latest pending edits':action==='Append'?'Latest pending edits\n\n'+transcript:transcript});
      assert.equal(posts,beforePosts); cases++;
    }
    for(const state of ['recording','playback','pending']) {
      await fresh(); automaticChoice=false;
      if(state==='recording'){await click('Start recording');await wait("__voiceTracks.length>0");}
      else {await record();if(state==='playback') await evaluate("window.__voicePlayer=document.querySelector('form audio');window.__voicePlaybackUrl=__voicePlayer.src;__voicePlayer.play()");
        else {mode='pending';await click('Transcribe');for(let i=0;!held&&i<100;i++) await new Promise(r=>setTimeout(r,50));assert.ok(held);}}
      const stale=held;
      await evaluate("document.querySelector('a[href=\"/\"]').click()");
      await wait("location.pathname==='/'&&!document.querySelector('form [name=description]')");
      assert.ok(await evaluate("__voiceTracks.every(t=>t.readyState==='ended')"));
      if(state==='playback') assert.ok(await evaluate("__voicePlayer.paused&&__voiceRevoked.includes(__voicePlaybackUrl)"));
      if(stale) await fulfill(stale,200,{transcript,language_code:'en-IN'}).catch(()=>{});
      held=undefined;assert.equal(await evaluate("!!document.querySelector('dialog')"),false);cases++;
    }
    assert.equal(submissions, 0); assert.equal(writes, 0, JSON.stringify(writePaths)); if (interceptionError) throw interceptionError;
    console.log(`${name} ${version.product}: ${cases} hydrated /submit scenarios passed; ${posts} mocked multipart requests; 0 grievance submissions, 0 other writes. No backend/provider contacted.`);
    console.log(`${name}: ${frameworkDebugRequests} framework debug requests intercepted; console error summaries: ${JSON.stringify([...consoleErrors])}`);
  } finally {
    socket?.close(); child.kill(); await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, 3000))]);
    assert.ok(path.resolve(profile).startsWith(path.resolve(os.tmpdir()) + path.sep));
    assert.ok(path.basename(profile).startsWith("grievai-title-hydrated-"));
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }
}
