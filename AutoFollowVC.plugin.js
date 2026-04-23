/**
 * @name AutoFollowVC
 * @version 4.0.0
 * @author Undfe
 * @github https://github.com/undefined-name12
 * @description Sigue a múltiples usuarios y canales. Velocidad configurable.
 */

'use strict';
const manifest = { name: "AutoFollowVC", version: "4.0.0", author: "Undfe", description: "Sigue a múltiples usuarios y canales." };
const Api = new BdApi(manifest.name);
const { DOM, Patcher, UI, Webpack, Data } = Api;
const React = BdApi.React;
const renderReact = (element, container) => {
    try {
        if (BdApi.ReactDOM.createRoot) {
            if (!container._reactRoot) container._reactRoot = BdApi.ReactDOM.createRoot(container);
            container._reactRoot.render(element);
        } else if (BdApi.ReactDOM.render) { BdApi.ReactDOM.render(element, container); }
    } catch (e) { }
};
const unmountReact = (container) => {
    try {
        if (container._reactRoot) { container._reactRoot.unmount(); delete container._reactRoot; }
        else if (BdApi.ReactDOM.unmountComponentAtNode) { BdApi.ReactDOM.unmountComponentAtNode(container); }
    } catch (e) { }
};
function showToast(msg, opts) {
    try {
        if (typeof BdApi.UI?.showToast === "function") return BdApi.UI.showToast(msg, opts);
        if (typeof BdApi.showToast === "function") return BdApi.showToast(msg, opts);
        if (typeof UI?.showToast === "function") return UI.showToast(msg, opts);
    } catch (e) { }
}
const UserStore = Webpack.getStore("UserStore");
const VoiceStateStore = Webpack.getStore("VoiceStateStore");
const ChannelStore = Webpack.getStore("ChannelStore");
const GuildStore = Webpack.getStore("GuildStore");
const PermissionStore = Webpack.getStore("PermissionStore");
const MediaEngineStore = Webpack.getStore("MediaEngineStore");

const CONNECT_PERMISSION = 1048576n;

let _cachedMediaActions = null;
function getMediaActions() {
    if (_cachedMediaActions) return _cachedMediaActions;
    const strats = [
        () => Webpack.getByKeys("toggleSelfMute", "toggleSelfDeaf"),
        () => Webpack.getModule(m => m?.toggleSelfMute && m?.toggleSelfDeaf),
        () => Webpack.getByKeys("setSelfMute", "setSelfDeaf"),
        () => Webpack.getModule(m => m?.setSelfMute && m?.setSelfDeaf),
    ];
    for (const s of strats) { try { const r = s(); if (r) { _cachedMediaActions = r; return r; } } catch (e) { } }
    return null;
}
let _cachedStreamModule = null;
function getStreamModule() {
    if (_cachedStreamModule) return _cachedStreamModule;
    const strats = [
        () => Webpack.getByKeys("startStream", "stopStream"),
        () => Webpack.getModule(m => m?.startStream && m?.stopStream),
    ];
    for (const s of strats) { try { const r = s(); if (r) { _cachedStreamModule = r; return r; } } catch (e) { } }
    return null;
}
let _cachedVideoModule = null;
function getVideoModule() {
    if (_cachedVideoModule) return _cachedVideoModule;
    const strats = [
        () => Webpack.getByKeys("setVideoEnabled"),
        () => Webpack.getModule(m => m?.setVideoEnabled && typeof m.setVideoEnabled === "function"),
    ];
    for (const s of strats) { try { const r = s(); if (r) { _cachedVideoModule = r; return r; } } catch (e) { } }
    return null;
}
function getDesktopSources() {
    return new Promise((resolve) => {
        try {
            const electron = require("electron");
            const dc = electron?.desktopCapturer;
            if (dc?.getSources) {
                dc.getSources({ types: ["screen"], thumbnailSize: { width: 0, height: 0 } })
                    .then(sources => resolve(sources || []))
                    .catch(() => resolve([]));
            } else { resolve([]); }
        } catch (e) { resolve([]); }
    });
}
function doSelfMute() {
    try {
        if (MediaEngineStore?.isSelfMute?.()) return;
        if (Dispatcher) { Dispatcher.dispatch({ type: "AUDIO_TOGGLE_SELF_MUTE", context: "default" }); return; }
        const btn = document.querySelector('button[aria-label="Mute"], button[aria-label="Silenciar"]');
        if (btn) btn.click();
    } catch (e) { }
}
function doSelfDeaf() {
    try {
        if (MediaEngineStore?.isSelfDeaf?.()) return;
        if (Dispatcher) { Dispatcher.dispatch({ type: "AUDIO_TOGGLE_SELF_DEAF", context: "default" }); return; }
        const btn = document.querySelector('button[aria-label="Deafen"], button[aria-label="Ensordecer"]');
        if (btn) btn.click();
    } catch (e) { }
}
function doLeaveCall() {
    try {
        const myId = UserStore?.getCurrentUser()?.id;
        const vs = VoiceStateStore?.getVoiceStateForUser(myId);
        if (!vs?.channelId) return; 
        
        const btn = document.querySelector('button[aria-label="Disconnect"], button[aria-label="Desconectar"]');
        if (btn) { btn.click(); return; }
        
        const va = getVoiceActions();
        if (va?.join) { va.join(null); return; }
        if (Dispatcher) Dispatcher.dispatch({ type: "VOICE_CHANNEL_SELECT", channelId: null, guildId: null });
    } catch (e) { }
}
function doStopScreen() {
    try { 
        const sm = getStreamModule(); if (sm?.stopStream) sm.stopStream(); 
        const btn = document.querySelector('button[aria-label="Stop Streaming"], button[aria-label="Dejar de transmitir"]');
        if (btn) btn.click();
    } catch (e) { }
}
function doStopCamera() {
    try { 
        if (!MediaEngineStore?.isVideoEnabled?.()) return;
        let done = false;
        const btn = document.querySelector('button[aria-label="Turn Off Camera"], button[aria-label="Apagar cámara"], button[aria-label="Desactivar cámara"]');
        if (btn) { btn.click(); done = true; }
        
        const vm = getVideoModule(); 
        if (vm?.setVideoEnabled) { vm.setVideoEnabled(false); done = true; }
        
        if (!done && Dispatcher) { Dispatcher.dispatch({ type: "AUDIO_TOGGLE_LOCAL_VIDEO", context: "default" }); }
    } catch (e) { }
}
function execTriggerAction(action) {
    switch (action) {
        case "mute": doSelfMute(); break;
        case "deafen": doSelfDeaf(); break;
        case "leave": doLeaveCall(); break;
        case "stopscreen": doStopScreen(); break;
        case "stopcamera": doStopCamera(); break;
    }
}
let _cameraRetryTimer = null;
let _screenRetryTimer = null;
function execAutoJoinAction(action) {
    try {
        switch (action) {
            case "camera": {
                
                if (_cameraRetryTimer) { clearInterval(_cameraRetryTimer); _cameraRetryTimer = null; }
                let attempts = 0;
                const maxAttempts = 12;
                const tryEnableCamera = () => {
                    attempts++;
                    try {
                        
                        if (MediaEngineStore?.isVideoEnabled?.()) {
                            if (_cameraRetryTimer) { clearInterval(_cameraRetryTimer); _cameraRetryTimer = null; }
                            return;
                        }
                        
                        const myVs = VoiceStateStore?.getVoiceStateForUser(UserStore?.getCurrentUser()?.id);
                        if (!myVs?.channelId) {
                            if (_cameraRetryTimer) { clearInterval(_cameraRetryTimer); _cameraRetryTimer = null; }
                            return;
                        }
                        
                        const vm = getVideoModule();
                        if (vm?.setVideoEnabled) vm.setVideoEnabled(true);
                        if (Dispatcher) Dispatcher.dispatch({ type: "MEDIA_ENGINE_SET_VIDEO_ENABLED", enabled: true, context: "default" });
                        
                        const btn = document.querySelector('button[aria-label="Turn On Camera"], button[aria-label="Activar cámara"], button[aria-label="Encender cámara"]');
                        if (btn) btn.click();
                    } catch (e) { }
                    if (attempts >= maxAttempts) {
                        if (_cameraRetryTimer) { clearInterval(_cameraRetryTimer); _cameraRetryTimer = null; }
                    }
                };
                
                setTimeout(() => {
                    tryEnableCamera();
                    
                    _cameraRetryTimer = setInterval(tryEnableCamera, 500);
                }, 800);
            } break;
            case "screen": {
                
                if (_screenRetryTimer) { clearTimeout(_screenRetryTimer); _screenRetryTimer = null; }
                let screenAttempts = 0;
                const maxScreenAttempts = 8;
                const tryStartScreen = async () => {
                    screenAttempts++;
                    try {
                        const myVs = VoiceStateStore?.getVoiceStateForUser(UserStore?.getCurrentUser()?.id);
                        if (!myVs?.channelId) return;
                        const ch = ChannelStore?.getChannel(myVs.channelId);
                        if (!ch) return;
                        const sm = getStreamModule();
                        if (!sm?.startStream) {
                            if (screenAttempts < maxScreenAttempts) {
                                _screenRetryTimer = setTimeout(tryStartScreen, 1000);
                            }
                            return;
                        }
                        
                        const sources = await getDesktopSources();
                        const screenSource = sources.length > 0 ? sources[0] : null;
                        if (screenSource) {
                            
                            sm.startStream(ch.guild_id || null, myVs.channelId, {
                                pid: null,
                                sourceId: screenSource.id,
                                sourceName: screenSource.name || "Screen",
                                sound: true,
                                previewDisabled: false
                            });
                        } else {
                            
                            sm.startStream(ch.guild_id || null, myVs.channelId);
                        }
                    } catch (e) {
                        if (screenAttempts < maxScreenAttempts) {
                            _screenRetryTimer = setTimeout(tryStartScreen, 1000);
                        }
                    }
                };
                
                _screenRetryTimer = setTimeout(tryStartScreen, 1500);
            } break;
        }
    } catch (e) { }
}

let _lastActionTimes = { mute: 0, deafen: 0, stopcamera: 0, leave: 0, stopscreen: 0 };
function checkAndEnforce(action) {
    const now = Date.now();
    if (now - (_lastActionTimes[action] || 0) < 500) return;
    try {
        if (action === "mute" && !(MediaEngineStore?.isSelfMute?.() ?? true)) {
            _lastActionTimes.mute = now;
            doSelfMute();
            setTimeout(doSelfMute, 150); 
        } else if (action === "deafen" && !(MediaEngineStore?.isSelfDeaf?.() ?? true)) {
            _lastActionTimes.deafen = now;
            doSelfDeaf();
            setTimeout(doSelfDeaf, 150);
        } else if (action === "stopcamera" && (MediaEngineStore?.isVideoEnabled?.() ?? false)) {
            _lastActionTimes.stopcamera = now;
            doStopCamera();
        } else if (action === "leave") {
            const myId = UserStore?.getCurrentUser()?.id;
            const vs = VoiceStateStore?.getVoiceStateForUser(myId);
            if (vs && vs.channelId) {
                _lastActionTimes.leave = now;
                doLeaveCall();
            }
        } else if (action === "stopscreen") {
            _lastActionTimes.stopscreen = now;
            doStopScreen();
        }
    } catch (e) {}
}

const Dispatcher = (() => {
    try { if (UserStore?._dispatcher) return UserStore._dispatcher; } catch (e) { }
    try { const m = Webpack.getByKeys("dispatch", "subscribe"); if (m) return m; } catch (e) { }
    try { const m = Webpack.getModule(m => m?.dispatch && m?.subscribe && m?.unsubscribe); if (m) return m; } catch (e) { }
    return null;
})();
let _cachedVoiceActions = null;
function getVoiceActions() {
    if (_cachedVoiceActions) return _cachedVoiceActions;
    const strats = [
        () => { const m = Webpack.getByKeys("selectVoiceChannel"); if (m?.selectVoiceChannel) return { join: ch => m.selectVoiceChannel(ch) }; },
        () => { const m = Webpack.getModule(m => m?.selectVoiceChannel && typeof m.selectVoiceChannel === "function"); if (m) return { join: ch => m.selectVoiceChannel(ch) }; },
        () => { const m = Webpack.getByKeys("selectChannel"); if (m?.selectChannel) return { join: ch => m.selectChannel(ch) }; },
        () => { const m = Webpack.getByKeys("selectChannel", "disconnect"); if (m?.selectChannel) return { join: ch => m.selectChannel(ch) }; },
        () => { const m = Webpack.getModule(Webpack.Filters.byStrings("selectVoiceChannel", "channelId"), { searchExports: true }); if (typeof m === "function") return { join: ch => m(ch) }; },
        () => { const m = Webpack.getByKeys("handleVoiceConnect"); if (m?.handleVoiceConnect) return { join: ch => m.handleVoiceConnect(ch) }; },
        () => { const m = Webpack.getModule(m => typeof m === "function" && m.toString().includes("VOICE_CHANNEL_SELECT"), { searchExports: true }); if (m) return { join: ch => m(ch) }; }
    ];
    for (const s of strats) { try { const r = s(); if (r) { _cachedVoiceActions = r; return r; } } catch (e) { } }
    return null;
}
const fs = require("fs");
const path = require("path");
const pluginsDir = BdApi.Plugins?.folder || path.join(process.env.APPDATA || "", "BetterDiscord", "plugins");
const configPath = path.join(pluginsDir, "AutoFollowVC.config.json");
const ConfigManager = (() => {
    let _data = { settings: { globalActive: true, trackedUsers: {}, trackedChannels: {}, advancedMode: false, failedChannels: {}, cooldown: 200, pollInterval: 10, hideOnNumpad9: true, userTriggers: [], autoCamera: false, autoScreen: false, triggerCheckInterval: 50 } };
    const _listeners = new Set();
    function _loadFromFile() {
        try {
            if (fs.existsSync(configPath)) {
                const parsed = JSON.parse(fs.readFileSync(configPath, "utf8"));
                if (parsed?.settings) { _data = parsed; return true; }
            }
        } catch (e) { }
        return false;
    }
    function _loadFromBdApi() {
        try {
            const saved = Data.load("settings");
            if (saved && typeof saved === "object") {
                _data.settings = { 
                    globalActive: saved.globalActive ?? true, 
                    trackedUsers: saved.trackedUsers ?? {}, 
                    trackedChannels: saved.trackedChannels ?? {}, 
                    advancedMode: saved.advancedMode ?? false, 
                    failedChannels: saved.failedChannels ?? {}, 
                    cooldown: saved.cooldown ?? 200, 
                    pollInterval: saved.pollInterval ?? 10,
                    theme: saved.theme ?? "light",
                    panelMinimized: saved.panelMinimized ?? false,
                    panelPos: saved.panelPos ?? null,
                    autoOpen: saved.autoOpen ?? false,
                    hideOnNumpad9: saved.hideOnNumpad9 ?? true,
                    userTriggers: saved.userTriggers ?? [],
                    autoCamera: saved.autoCamera ?? false,
                    autoScreen: saved.autoScreen ?? false,
                    triggerCheckInterval: saved.triggerCheckInterval ?? 50
                };
                return true;
            }
        } catch (e) { }
        return false;
    }
    function _save() {
        try { fs.writeFileSync(configPath, JSON.stringify(_data, null, 4), "utf8"); } catch (e) { }
        try { Data.save("settings", _data.settings); } catch (e) { }
    }
    function _notify() { for (const fn of _listeners) { try { fn(); } catch (e) { } } }
    return {
        load() { if (!_loadFromFile()) { _loadFromBdApi(); _save(); } else { try { Data.save("settings", _data.settings); } catch (e) { } } },
        get(key, def) { const v = _data.settings[key]; return v !== undefined ? v : def; },
        set(key, value) { _data.settings[key] = value; _save(); _notify(); },
        subscribe(fn) { _listeners.add(fn); },
        unsubscribe(fn) { _listeners.delete(fn); },
        getConfigPath() { return configPath; }
    };
})();
function useConfig(key, defaultValue) {
    const [value, setValue] = React.useState(() => ConfigManager.get(key, defaultValue));
    React.useEffect(() => {
        const listener = () => setValue(ConfigManager.get(key, defaultValue));
        ConfigManager.subscribe(listener);
        return () => ConfigManager.unsubscribe(listener);
    }, [key]);
    return value;
}
function getUserAvatarURL(user) {
    if (!user) return null;
    if (!user.avatar) {
        const idx = user.discriminator === "0" ? Number(BigInt(user.id) >> 22n) % 6 : parseInt(user.discriminator) % 5;
        return `https://cdn.discordapp.com/embed/avatars/${idx}.png`;
    }
    const ext = user.avatar.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=128`;
}
function getChannelUserCount(channelId) {
    if (!channelId) return 0;
    let count = 0;
    try {
        const allStates = VoiceStateStore?.getAllVoiceStates() || {};
        for (const guildId in allStates) {
            for (const userId in allStates[guildId]) {
                if (allStates[guildId][userId].channelId === channelId) count++;
            }
        }
    } catch (e) {}
    return count;
}
function joinVoiceChannel(channelId, guildId) {
    let success = false;
    const voiceModule = getVoiceActions();
    if (voiceModule && typeof voiceModule.selectVoiceChannel === "function") {
        try { voiceModule.selectVoiceChannel(channelId); success = true; } catch (e) { }
    }
    if (!success && Dispatcher) {
        try {
            Dispatcher.dispatch({ type: "VOICE_CHANNEL_SELECT", channelId, guildId: guildId || null, currentVoiceChannelId: null, video: false, stream: false });
            success = true;
        } catch (e) { }
    }
    if (!success && voiceModule && typeof voiceModule.join === "function") {
        try { voiceModule.join(channelId); success = true; } catch (e) { }
    }
    if (!success) {
        try {
            const r = Webpack.getModule(m => m?.transitionToChannel && typeof m.transitionToChannel === "function");
            if (r?.transitionToChannel) { r.transitionToChannel(channelId); success = true; }
        } catch (e) { }
    }
    if (!success) {
        showToast("Error unirse al canal", { type: "error" });
    }
    return success;
}
const CSS = `
:root {
  --afvc-bg-primary: #f2f3f5;
  --afvc-bg-secondary: #ffffff;
  --afvc-text-main: #060607;
  --afvc-text-muted: #4f5660;
  --afvc-text-light: #80848e;
  --afvc-border: #e3e5e8;
  --afvc-accent: #5865F2;
  --afvc-hover: #4752c4;
}
[data-afvc-theme="dark"] {
  --afvc-bg-primary: #1e1f22;
  --afvc-bg-secondary: #2b2d31;
  --afvc-text-main: #f2f3f5;
  --afvc-text-muted: #b5bac1;
  --afvc-text-light: #949ba4;
  --afvc-border: #3f4147;
  --afvc-accent: #5865F2;
  --afvc-hover: #4752c4;
}
[data-afvc-theme="blue"] {
  --afvc-bg-primary: #0a192f;
  --afvc-bg-secondary: #112240;
  --afvc-text-main: #ccd6f6;
  --afvc-text-muted: #8892b0;
  --afvc-text-light: #64ffda;
  --afvc-border: #233554;
  --afvc-accent: #64ffda;
  --afvc-hover: #52e0c4;
}
[data-afvc-theme="yellow"] {
  --afvc-bg-primary: #fffbeb;
  --afvc-bg-secondary: #fef08a;
  --afvc-text-main: #422006;
  --afvc-text-muted: #713f12;
  --afvc-text-light: #854d0e;
  --afvc-border: #facc15;
  --afvc-accent: #ca8a04;
  --afvc-hover: #a16207;
}

.afvc-panel { padding: 18px; color: var(--afvc-text-main); font-family: var(--font-primary); background: var(--afvc-bg-primary); border-radius: 12px; transition: background 0.3s, color 0.3s; }
.afvc-title { font-size: 22px; font-weight: 800; color: var(--afvc-text-main); margin-bottom: 20px; display: flex; align-items: center; gap: 10px; justify-content: space-between; }
.afvc-input-area { display: flex; gap: 8px; margin-bottom: 20px; }
.afvc-input { flex: 1; padding: 12px 16px; border-radius: 8px; border: 1px solid var(--afvc-border); background: var(--afvc-bg-secondary); color: var(--afvc-text-main); font-size: 14px; outline: none; transition: border-color 0.2s, background 0.3s, color 0.3s; }
.afvc-input:focus { border-color: var(--afvc-accent); }
.afvc-input::placeholder { color: var(--afvc-text-light); }
.afvc-btn-add { padding: 10px 24px; border-radius: 8px; border: none; background: var(--afvc-accent); color: #fff; font-weight: 700; cursor: pointer; transition: 0.2s; }
.afvc-btn-add:hover { background: var(--afvc-hover); }
.afvc-global-toggle { width: 100%; padding: 12px 20px; border-radius: 8px; border: none; font-weight: 700; cursor: pointer; margin-bottom: 16px; transition: 0.2s; }
.afvc-global-toggle.active { background: #ed4245; color: #fff; }
.afvc-global-toggle.inactive { background: #23a559; color: #fff; }

.afvc-accordion-header { display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none; padding: 4px 0 10px 0; }
.afvc-section-title { font-size: 14px; font-weight: 700; color: var(--afvc-text-light); text-transform: uppercase; letter-spacing: 0.5px; margin: 0; }
.afvc-accordion-icon { font-size: 12px; color: var(--afvc-text-light); transition: transform 0.2s; }
.afvc-accordion-icon.open { transform: rotate(180deg); }

.afvc-list-container { max-height: 280px; overflow-y: auto; padding-right: 6px; display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px; }
.afvc-list-container::-webkit-scrollbar { width: 6px; }
.afvc-list-container::-webkit-scrollbar-thumb { background: var(--afvc-text-light); border-radius: 10px; }
.afvc-card { display: flex; align-items: center; gap: 14px; padding: 14px 18px; background: var(--afvc-bg-secondary); border-radius: 10px; border: 1px solid var(--afvc-border); box-shadow: 0 1px 4px rgba(0,0,0,0.02); transition: background 0.3s, border-color 0.3s; }
.afvc-avatar { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; }
.afvc-user-info { flex: 1; min-width: 0; }
.afvc-username { font-weight: 700; font-size: 15px; color: var(--afvc-text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.afvc-status { font-size: 13px; margin-top: 3px; display: flex; align-items: center; gap: 6px; }
.afvc-status-dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.afvc-status-dot.online { background: #23a559; }
.afvc-status-dot.in-call { background: #23a559; animation: afvc-pulse 1.5s infinite; }
.afvc-status-dot.offline { background: #80848e; }
.afvc-status-dot.paused { background: #f0b232; }
.afvc-status-text { color: var(--afvc-text-muted); }
.afvc-status-text.in-call { color: #23a559; font-weight: 600; }
.afvc-btn-icon { width: 34px; height: 34px; border-radius: 8px; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; background: var(--afvc-bg-primary); color: var(--afvc-text-muted); font-size: 16px; transition: 0.2s; }
.afvc-btn-icon:hover { background: var(--afvc-border); }
.afvc-btn-icon.pause { color: #f0b232; }
.afvc-btn-icon.resume { color: #23a559; }
.afvc-btn-icon.remove { color: #ed4245; }

.afvc-advanced-section { margin-top: 16px; padding: 16px; background: var(--afvc-bg-secondary); border-radius: 10px; border: 1px solid var(--afvc-border); transition: background 0.3s, border-color 0.3s; }
.afvc-advanced-title { font-size: 15px; font-weight: 800; margin-bottom: 12px; color: var(--afvc-text-main); }
.afvc-toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; color: var(--afvc-text-main); }
.afvc-timing-group { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
.afvc-timing-row { display: flex; justify-content: space-between; align-items: center; color: var(--afvc-text-main); }
.afvc-timing-input { width: 80px; padding: 6px 10px; border-radius: 6px; border: 1px solid var(--afvc-border); background: var(--afvc-bg-primary); color: var(--afvc-text-main); font-size: 13px; text-align: center; }

.afvc-theme-select { padding: 6px 10px; border-radius: 6px; border: 1px solid var(--afvc-border); background: var(--afvc-bg-primary); color: var(--afvc-text-main); font-size: 13px; outline: none; cursor: pointer; }

.afvc-switch { position: relative; width: 42px; height: 24px; border-radius: 12px; background: #80848e; cursor: pointer; border: none; transition: 0.2s; }
.afvc-switch.on { background: #23a559; }
.afvc-switch-knob { position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 50%; background: #fff; transition: 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
.afvc-switch.on .afvc-switch-knob { transform: translateX(18px); }

.afvc-floating-panel { position: fixed; top: 20px; right: 20px; width: 420px; max-height: calc(100vh - 40px); overflow-y: auto; background: var(--afvc-bg-primary); border: 1px solid var(--afvc-border); border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.1); z-index: 99999; }
.afvc-floating-header { display: flex; justify-content: space-between; padding: 16px; background: var(--afvc-bg-secondary); border-bottom: 1px solid var(--afvc-border); border-radius: 12px 12px 0 0; }
.afvc-floating-header-title { font-weight: 800; font-size: 18px; color: var(--afvc-text-main); }
.afvc-btn-close-float { background: var(--afvc-border); border: none; width: 30px; height: 30px; border-radius: 50%; cursor: pointer; color: var(--afvc-text-muted); font-weight: bold; }
.afvc-floating-body { padding: 0; }
.afvc-channel-users { display: flex; gap: 4px; margin-top: 8px; flex-wrap: wrap; }
.afvc-channel-mini-avatar { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; border: 1px solid var(--afvc-border); }

.afvc-signature { text-align: center; font-size: 12px; font-weight: 800; margin-top: 16px; padding-bottom: 4px; background: linear-gradient(90deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #9400d3); background-size: 200% auto; color: #fff; background-clip: text; -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: afvc-rainbow 3s linear infinite; user-select: none; }

@keyframes afvc-pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }
@keyframes afvc-rainbow { to { background-position: 200% center; } }

.afvc-trigger-row { display: flex; gap: 6px; align-items: center; margin-bottom: 10px; flex-wrap: wrap; }
.afvc-trigger-select { padding: 8px 10px; border-radius: 6px; border: 1px solid var(--afvc-border); background: var(--afvc-bg-secondary); color: var(--afvc-text-main); font-size: 13px; outline: none; cursor: pointer; }
.afvc-trigger-badges { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 4px; }
.afvc-trigger-badge { display: inline-flex; align-items: center; gap: 3px; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; background: var(--afvc-accent); color: #fff; }
.afvc-trigger-badge.mute { background: #f0b232; }
.afvc-trigger-badge.deafen { background: #ed4245; }
.afvc-trigger-badge.leave { background: #a12d2f; }
.afvc-trigger-badge.stopscreen { background: #9b59b6; }
.afvc-trigger-badge.stopcamera { background: #e67e22; }
.afvc-checkbox-row { display: flex; gap: 8px; flex-wrap: wrap; margin: 6px 0; }
.afvc-checkbox-label { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--afvc-text-muted); cursor: pointer; padding: 4px 8px; border-radius: 6px; border: 1px solid var(--afvc-border); background: var(--afvc-bg-secondary); transition: 0.15s; user-select: none; }
.afvc-checkbox-label.checked { border-color: var(--afvc-accent); background: var(--afvc-accent); color: #fff; }
`;
function UserCard({ userId, onRemove, globalActive }) {
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);
    React.useEffect(() => { const i = setInterval(forceUpdate, 1500); return () => clearInterval(i); }, []);
    const user = (() => { try { return UserStore?.getUser(userId); } catch (e) { return null; } })();
    const trackedUsers = ConfigManager.get("trackedUsers", {});
    const isPaused = trackedUsers[userId]?.paused ?? false;
    const voiceState = (() => { try { return VoiceStateStore?.getVoiceStateForUser(userId); } catch (e) { return null; } })();
    const isInVoice = voiceState && voiceState.channelId;
    const channel = isInVoice ? ChannelStore?.getChannel(voiceState.channelId) : null;
    const avatarUrl = getUserAvatarURL(user);
    const username = user ? (user.globalName || user.username) : `ID: ${userId}`;
    let statusDotClass = "offline";
    let statusText = "Sin voz";
    let channelDetails = null;

    if (isPaused) {
        statusDotClass = "paused";
        statusText = "Pausado";
    }
    else if (isInVoice && channel) {
        statusDotClass = "in-call";
        statusText = `Voz: #${channel.name}`;

        let hasPermission = true;
        try { if (channel.guild_id != null && PermissionStore) hasPermission = PermissionStore.can(CONNECT_PERMISSION, channel); } catch (e) { }

        let count = 0;
        const guildVoiceStates = VoiceStateStore?.getAllVoiceStates()[channel.guild_id] || {};
        for (const uid in guildVoiceStates) { if (guildVoiceStates[uid].channelId === channel.id) count++; }

        const limitStr = channel.userLimit > 0 ? `${count}/${channel.userLimit}` : `${count}`;
        const isFull = channel.userLimit > 0 && count >= channel.userLimit;

        if (!hasPermission) channelDetails = `🔒 Bloqueado (${limitStr})`;
        else if (isFull) channelDetails = `🔴 Lleno (${limitStr})`;
        else channelDetails = `🟢 ${limitStr}`;
    }
    else if (user) {
        statusDotClass = "online";
        statusText = "Siguiendo";
    }

    const handleTogglePause = () => {
        const users = ConfigManager.get("trackedUsers", {});
        if (users[userId]) { users[userId].paused = !users[userId].paused; ConfigManager.set("trackedUsers", { ...users }); }
    };
    return React.createElement("div", { className: `afvc-card` },
        avatarUrl ? React.createElement("img", { className: "afvc-avatar", src: avatarUrl }) : React.createElement("div", { className: "afvc-avatar" }),
        React.createElement("div", { className: "afvc-user-info" },
            React.createElement("div", { className: "afvc-username" }, username),
            React.createElement("div", { className: "afvc-status" },
                React.createElement("span", { className: `afvc-status-dot ${statusDotClass}` }),
                React.createElement("span", { className: `afvc-status-text ${isInVoice && !isPaused ? "in-call" : ""}` }, statusText),
                channelDetails && React.createElement("span", { style: { fontSize: "11px", marginLeft: "4px", color: "#80848e" } }, channelDetails)
            )
        ),
        React.createElement("div", { style: { display: "flex", gap: "6px" } },
            React.createElement("button", { className: `afvc-btn-icon ${isPaused ? "resume" : "pause"}`, onClick: handleTogglePause }, isPaused ? "▶" : "⏸"),
            React.createElement("button", { className: "afvc-btn-icon remove", onClick: () => onRemove(userId) }, "✕")
        )
    );
}
function ChannelCard({ channelId, onRemove }) {
    const [, forceUpdate] = React.useReducer(x => x + 1, 0);
    React.useEffect(() => { const i = setInterval(forceUpdate, 1500); return () => clearInterval(i); }, []);
    
    const trackedChannels = ConfigManager.get("trackedChannels", {});
    const isPaused = trackedChannels[channelId]?.paused ?? false;

    const channel = ChannelStore?.getChannel(channelId);
    if (!channel) return React.createElement("div", { className: "afvc-card" }, React.createElement("div", { className: "afvc-user-info" }, "Canal no encontrado"), React.createElement("button", { className: "afvc-btn-icon remove", onClick: () => onRemove(channelId) }, "✕"));
    const allVoiceStates = VoiceStateStore?.getAllVoiceStates() || {};
    const guildVoiceStates = allVoiceStates[channel.guild_id] || {};
    const usersInChannel = [];
    for (const uid in guildVoiceStates) {
        if (guildVoiceStates[uid].channelId === channelId) {
            const u = UserStore?.getUser(uid);
            if (u) usersInChannel.push(u);
        }
    }
    const limit = channel.userLimit || "∞";
    const count = usersInChannel.length;

    let hasPermission = true;
    try { if (channel.guild_id != null && PermissionStore) hasPermission = PermissionStore.can(CONNECT_PERMISSION, channel); } catch (e) { }

    const isFull = channel.userLimit > 0 && count >= channel.userLimit;

    let stateText = `${count} / ${limit} conectados`;
    if (isPaused) {
        stateText = "Pausado";
    } else {
        if (!hasPermission) stateText += " 🔒";
        else if (isFull) stateText += " 🔴";
    }

    const handleTogglePause = () => {
        const channels = ConfigManager.get("trackedChannels", {});
        if (channels[channelId]) { channels[channelId].paused = !channels[channelId].paused; ConfigManager.set("trackedChannels", { ...channels }); }
    };

    return React.createElement("div", { className: "afvc-card" },
        React.createElement("div", { className: "afvc-user-info" },
            React.createElement("div", { className: "afvc-username" }, `🔊 ${channel.name}`),
            React.createElement("div", { className: "afvc-status", style: { color: "#4f5660", fontSize: "12px", fontWeight: "600" } }, stateText),
            React.createElement("div", { className: "afvc-channel-users" },
                usersInChannel.slice(0, 12).map(u => React.createElement("img", { key: u.id, src: getUserAvatarURL(u), className: "afvc-channel-mini-avatar", title: u.username }))
            )
        ),
        React.createElement("div", { style: { display: "flex", gap: "6px" } },
            React.createElement("button", { className: `afvc-btn-icon ${isPaused ? "resume" : "pause"}`, onClick: handleTogglePause }, isPaused ? "▶" : "⏸"),
            React.createElement("button", { className: "afvc-btn-icon remove", onClick: () => onRemove(channelId) }, "✕")
        )
    );
}
const FloatingPanelManager = {
    _root: null, isOpen: false,
    toggle() { if (this.isOpen) this.close(); else this.open(); return this.isOpen; },
    open() {
        if (this.isOpen) return;
        this.isOpen = true;
        if (!this._root) { this._root = document.createElement("div"); this._root.id = "afvc-floating-root"; document.body.appendChild(this._root); }
        renderReact(React.createElement(FloatingPanel, { onClose: () => this.close() }), this._root);
        document.dispatchEvent(new CustomEvent("afvc-float-toggle", { detail: true }));
    },
    close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        if (this._root) { unmountReact(this._root); this._root.remove(); this._root = null; }
        document.dispatchEvent(new CustomEvent("afvc-float-toggle", { detail: false }));
    }
};

const ACTION_LABELS = { mute: "🔇 Mutearse", deafen: "🔕 Ensordecerse", leave: "🚪 Abandonar", stopscreen: "🖥️ Dejar Pantalla", stopcamera: "📷 Apagar Cámara" };
function TriggerCard({ trigger, index, onRemove, onTogglePause }) {
    const user = (() => { try { return UserStore?.getUser(trigger.userId); } catch (e) { return null; } })();
    const avatarUrl = getUserAvatarURL(user);
    const username = user ? (user.globalName || user.username) : `ID: ${trigger.userId}`;
    return React.createElement("div", { className: "afvc-card" },
        avatarUrl ? React.createElement("img", { className: "afvc-avatar", src: avatarUrl }) : React.createElement("div", { className: "afvc-avatar" }),
        React.createElement("div", { className: "afvc-user-info" },
            React.createElement("div", { className: "afvc-username" }, username),
            React.createElement("div", { className: "afvc-trigger-badges" },
                trigger.actions.map(a => React.createElement("span", { key: a, className: `afvc-trigger-badge ${a}` }, ACTION_LABELS[a] || a))
            ),
            React.createElement("div", { className: "afvc-status", style: { fontSize: "11px", marginTop: "4px" } },
                trigger.paused ? React.createElement("span", { style: { color: "#f0b232" } }, "⏸ Pausado") : React.createElement("span", { style: { color: "#23a559" } }, `✓ Intervalo: ${trigger.checkInterval || 50}ms`)
            )
        ),
        React.createElement("div", { style: { display: "flex", gap: "6px" } },
            React.createElement("button", { className: `afvc-btn-icon ${trigger.paused ? "resume" : "pause"}`, onClick: () => onTogglePause(index) }, trigger.paused ? "▶" : "⏸"),
            React.createElement("button", { className: "afvc-btn-icon remove", onClick: () => onRemove(index) }, "✕")
        )
    );
}

function Accordion({ title, children, count, storageKey }) {
    const defaultOpen = storageKey ? (ConfigManager.get("accordion_" + storageKey, count <= 3)) : (count <= 3);
    const [isOpen, setIsOpen] = React.useState(defaultOpen);
    const handleToggle = () => {
        const next = !isOpen;
        setIsOpen(next);
        if (storageKey) ConfigManager.set("accordion_" + storageKey, next);
    };
    return React.createElement("div", { className: "afvc-accordion" },
        React.createElement("div", { className: "afvc-accordion-header", onClick: handleToggle },
            React.createElement("h3", { className: "afvc-section-title" }, `${title} (${count})`),
            React.createElement("span", { className: `afvc-accordion-icon ${isOpen ? "open" : ""}` }, "▼")
        ),
        isOpen && children
    );
}

function FollowPanel({ isFloating, onClose }) {
    const [inputId, setInputId] = React.useState("");
    const [triggerUserId, setTriggerUserId] = React.useState("");
    const [triggerActions, setTriggerActions] = React.useState({ mute: false, deafen: false, leave: false, stopscreen: false, stopcamera: false });
    const [triggerInterval, setTriggerInterval] = React.useState(50);
    const trackedUsers = useConfig("trackedUsers", {});
    const trackedChannels = useConfig("trackedChannels", {});
    const globalActive = useConfig("globalActive", true);
    const advancedMode = useConfig("advancedMode", false);
    const cooldown = useConfig("cooldown", 500);
    const pollInterval = useConfig("pollInterval", 15);
    const theme = useConfig("theme", "light");
    const autoOpen = useConfig("autoOpen", false);
    const userTriggers = useConfig("userTriggers", []);
    const autoCamera = useConfig("autoCamera", false);
    const autoScreen = useConfig("autoScreen", false);
    const triggerCheckInterval = useConfig("triggerCheckInterval", 50);
    const userIds = Object.keys(trackedUsers);
    const channelIds = Object.keys(trackedChannels);
    const handleAddTrigger = () => {
        const uid = triggerUserId.trim();
        if (!uid || !/^\d{17,20}$/.test(uid)) return showToast("ID inválido", { type: "error" });
        const selected = Object.entries(triggerActions).filter(([, v]) => v).map(([k]) => k);
        if (selected.length === 0) return showToast("Selecciona al menos una acción", { type: "error" });
        
        const triggers = ConfigManager.get("userTriggers", []);
        const existingIdx = triggers.findIndex(t => t.userId === uid);
        if (existingIdx !== -1) {
            triggers[existingIdx] = { userId: uid, actions: selected, checkInterval: triggerInterval, paused: false, addedAt: Date.now() };
        } else {
            triggers.push({ userId: uid, actions: selected, checkInterval: triggerInterval, paused: false, addedAt: Date.now() });
        }
        ConfigManager.set("userTriggers", [...triggers]);

        setTriggerUserId(""); setTriggerActions({ mute: false, deafen: false, leave: false, stopscreen: false, stopcamera: false });
        try { const f = Webpack.getModule(m => m?.getUser && typeof m.getUser === "function", { searchExports: true }); if (f?.getUser) f.getUser(uid).catch(() => {}); } catch (e) {}
        showToast("Trigger añadido", { type: "success" });
    };
    const handleRemoveTrigger = (idx) => { const t = ConfigManager.get("userTriggers", []); t.splice(idx, 1); ConfigManager.set("userTriggers", [...t]); };
    const handleToggleTriggerPause = (idx) => { const t = ConfigManager.get("userTriggers", []); if (t[idx]) { t[idx].paused = !t[idx].paused; ConfigManager.set("userTriggers", [...t]); } };
    const handleAdd = () => {
        const id = inputId.trim();
        if (!id || !/^\d{17,20}$/.test(id)) return showToast("ID inválido", { type: "error" });
        const ch = ChannelStore?.getChannel(id);
        if (ch && (ch.type === 2 || ch.type === 13)) {
            const channels = ConfigManager.get("trackedChannels", {});
            if (channels[id]) return showToast("Canal ya existe", { type: "warning" });
            channels[id] = { addedAt: Date.now() };
            ConfigManager.set("trackedChannels", { ...channels });
            setInputId("");
            showToast("Canal añadido", { type: "success" });
        } else {
            const users = ConfigManager.get("trackedUsers", {});
            if (users[id]) return showToast("Usuario ya existe", { type: "warning" });
            users[id] = { addedAt: Date.now(), paused: false };
            ConfigManager.set("trackedUsers", { ...users });
            try { const f = Webpack.getModule(m => m?.getUser && typeof m.getUser === "function", { searchExports: true }); if (f?.getUser) f.getUser(id).catch(() => { }); } catch (e) { }
            setInputId("");
            showToast("Usuario añadido", { type: "success" });
        }
    };
    return React.createElement("div", { className: "afvc-panel", "data-afvc-theme": theme },
        !isFloating && React.createElement("div", { className: "afvc-title" }, "🎯 Auto Follow VC v4.0"),
        React.createElement("div", { className: "afvc-input-area" },
            React.createElement("input", { className: "afvc-input", type: "text", placeholder: "Pega ID de usuario o canal de voz...", value: inputId, onChange: e => setInputId(e.target.value), onKeyPress: e => { if (e.key === "Enter") handleAdd(); } }),
            React.createElement("button", { className: "afvc-btn-add", onClick: handleAdd }, "Añadir")
        ),
        React.createElement("button", { className: `afvc-global-toggle ${globalActive ? "active" : "inactive"}`, onClick: () => ConfigManager.set("globalActive", !globalActive) }, globalActive ? "Detener Todo" : "Activar Todo"),
        userIds.length > 0 && React.createElement(Accordion, { title: "👥 Usuarios Trackeados", count: userIds.length, storageKey: "users" },
            React.createElement("div", { className: "afvc-list-container" }, userIds.map(id => React.createElement(UserCard, { key: id, userId: id, onRemove: uid => { const u = ConfigManager.get("trackedUsers", {}); delete u[uid]; ConfigManager.set("trackedUsers", { ...u }); } })))
        ),
        channelIds.length > 0 && React.createElement(Accordion, { title: "🔊 Canales Observados", count: channelIds.length, storageKey: "channels" },
            React.createElement("div", { className: "afvc-list-container" }, channelIds.map(id => React.createElement(ChannelCard, { key: id, channelId: id, onRemove: cid => { const c = ConfigManager.get("trackedChannels", {}); delete c[cid]; ConfigManager.set("trackedChannels", { ...c }); } })))
        ),
        React.createElement(Accordion, { title: "⚡ Acciones al Entrar", count: userTriggers.length, storageKey: "triggers" },
            React.createElement("div", { className: "afvc-advanced-section", style: { marginBottom: "0", marginTop: "6px" } },
                React.createElement("div", { style: { fontSize: "11px", color: "var(--afvc-text-light)", marginBottom: "6px" } }, "Cuando un usuario entre a TU MISMO canal, ejecuta acciones."),
                React.createElement("div", { className: "afvc-trigger-row" },
                    React.createElement("input", { className: "afvc-input", style: { flex: 1 }, type: "text", placeholder: "ID del usuario...", value: triggerUserId, onChange: e => setTriggerUserId(e.target.value) }),
                    React.createElement("input", { type: "number", min: "0", className: "afvc-timing-input", style: { width: "65px" }, value: triggerInterval, onChange: e => setTriggerInterval(Math.max(0, parseInt(e.target.value) || 0)), title: "Intervalo (ms)" })
                ),
                React.createElement("div", { className: "afvc-checkbox-row" },
                    ...Object.entries(ACTION_LABELS).map(([key, label]) =>
                        React.createElement("label", { key, className: `afvc-checkbox-label ${triggerActions[key] ? "checked" : ""}`, onClick: () => setTriggerActions(prev => ({ ...prev, [key]: !prev[key] })) }, label)
                    )
                ),
                React.createElement("button", { className: "afvc-btn-add", style: { width: "100%", marginTop: "4px", padding: "8px" }, onClick: handleAddTrigger }, "Añadir Trigger"),
                userTriggers.length > 0 && React.createElement("div", { className: "afvc-list-container", style: { marginTop: "8px" } },
                    userTriggers.map((t, i) => React.createElement(TriggerCard, { key: `${t.userId}-${i}`, trigger: t, index: i, onRemove: handleRemoveTrigger, onTogglePause: handleToggleTriggerPause }))
                ),
                React.createElement("div", { className: "afvc-timing-row", style: { marginTop: "6px" } },
                    React.createElement("span", { style: { fontSize: "12px" } }, "Comprobación (ms)"),
                    React.createElement("input", { type: "number", min: "0", className: "afvc-timing-input", value: triggerCheckInterval, onChange: e => ConfigManager.set("triggerCheckInterval", Math.max(0, parseInt(e.target.value) || 0)) })
                )
            )
        ),
        React.createElement(Accordion, { title: "📡 Otras Opciones", count: (autoCamera ? 1 : 0) + (autoScreen ? 1 : 0), storageKey: "other" },
            React.createElement("div", { className: "afvc-advanced-section", style: { marginBottom: "0", marginTop: "6px", padding: "10px 14px" } },
                React.createElement("div", { className: "afvc-toggle-row", style: { padding: "6px 0" } },
                    React.createElement("span", { style: { fontSize: "13px", fontWeight: "600" } }, "📷 Cámara al entrar"),
                    React.createElement("button", { className: `afvc-switch ${autoCamera ? "on" : ""}`, onClick: () => ConfigManager.set("autoCamera", !autoCamera) }, React.createElement("div", { className: "afvc-switch-knob" }))
                ),
                React.createElement("div", { className: "afvc-toggle-row", style: { padding: "6px 0" } },
                    React.createElement("span", { style: { fontSize: "13px", fontWeight: "600" } }, "🖥️ Pantalla al entrar"),
                    React.createElement("button", { className: `afvc-switch ${autoScreen ? "on" : ""}`, onClick: () => ConfigManager.set("autoScreen", !autoScreen) }, React.createElement("div", { className: "afvc-switch-knob" }))
                )
            )
        ),
        React.createElement("div", { className: "afvc-advanced-section" },
            React.createElement("div", { className: "afvc-advanced-title", style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                "⚙️ Configuraciones",
                React.createElement("select", { className: "afvc-theme-select", value: theme, onChange: e => ConfigManager.set("theme", e.target.value) },
                    React.createElement("option", { value: "light" }, "Blanco"),
                    React.createElement("option", { value: "dark" }, "Negro"),
                    React.createElement("option", { value: "blue" }, "Azul"),
                    React.createElement("option", { value: "yellow" }, "Amarillo")
                )
            ),
            React.createElement("div", { className: "afvc-toggle-row" },
                React.createElement("span", { style: { fontSize: "14px", fontWeight: "600" } }, "Ignorar bloqueos (reintentar)"),
                React.createElement("button", { className: `afvc-switch ${advancedMode ? "on" : ""}`, onClick: () => ConfigManager.set("advancedMode", !advancedMode) }, React.createElement("div", { className: "afvc-switch-knob" }))
            ),
            React.createElement("div", { className: "afvc-toggle-row" },
                React.createElement("span", { style: { fontSize: "14px", fontWeight: "600" } }, "Abrir automáticamente siempre el panel"),
                React.createElement("button", { className: `afvc-switch ${autoOpen ? "on" : ""}`, onClick: () => ConfigManager.set("autoOpen", !autoOpen) }, React.createElement("div", { className: "afvc-switch-knob" }))
            ),
            React.createElement("div", { className: "afvc-toggle-row" },
                React.createElement("span", { style: { fontSize: "14px", fontWeight: "600" } }, "Ocultar con Numpad 9 (ambos paneles)"),
                React.createElement("button", { className: `afvc-switch ${useConfig("hideOnNumpad9", true) ? "on" : ""}`, onClick: () => ConfigManager.set("hideOnNumpad9", !ConfigManager.get("hideOnNumpad9", true)) }, React.createElement("div", { className: "afvc-switch-knob" }))
            ),
            React.createElement("div", { className: "afvc-timing-group" },
                React.createElement("div", { className: "afvc-timing-row" },
                    React.createElement("span", { style: { fontSize: "13px" } }, "Enfriamiento Salto (ms)"),
                    React.createElement("input", { type: "number", min: "0", className: "afvc-timing-input", value: cooldown, onChange: e => ConfigManager.set("cooldown", Math.max(0, parseInt(e.target.value) || 0)) })
                ),
                React.createElement("div", { className: "afvc-timing-row" },
                    React.createElement("span", { style: { fontSize: "13px" } }, "Comprobación (ms)"),
                    React.createElement("input", { type: "number", min: "0", className: "afvc-timing-input", value: pollInterval, onChange: e => ConfigManager.set("pollInterval", Math.max(0, parseInt(e.target.value) || 0)) })
                )
            )
        ),
        React.createElement("div", { className: "afvc-signature" }, "made by undfe")
    );
}
function FloatingPanel({ onClose }) {
    const theme = useConfig("theme", "light");
    const isMinimized = useConfig("panelMinimized", false);
    const savedPos = useConfig("panelPos", null);
    const [pos, setPos] = React.useState(savedPos || { right: 20, top: 20 });
    const panelRef = React.useRef(null);
    const isDragging = React.useRef(false);
    const dragOffset = React.useRef({ x: 0, y: 0 });

    const handlePointerDown = (e) => {
        if (e.target.closest('button')) return;
        if (!panelRef.current) return;
        isDragging.current = true;
        const rect = panelRef.current.getBoundingClientRect();
        dragOffset.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        
        const moveHandler = (e2) => {
            if (!isDragging.current) return;
            const newLeft = e2.clientX - dragOffset.current.x;
            const newTop = e2.clientY - dragOffset.current.y;
            const maxLeft = window.innerWidth - panelRef.current.offsetWidth;
            const maxTop = window.innerHeight - panelRef.current.offsetHeight;
            setPos({ left: Math.max(0, Math.min(newLeft, maxLeft)), top: Math.max(0, Math.min(newTop, maxTop)) });
        };
        const upHandler = () => {
            isDragging.current = false;
            window.removeEventListener('pointermove', moveHandler);
            window.removeEventListener('pointerup', upHandler);
            setPos(currentPos => { ConfigManager.set("panelPos", currentPos); return currentPos; });
        };
        window.addEventListener('pointermove', moveHandler);
        window.addEventListener('pointerup', upHandler);
    };

    const toggleMinimize = () => ConfigManager.set("panelMinimized", !isMinimized);

    const inlineStyles = { 
        width: isMinimized ? "280px" : "420px",
        left: pos.left !== undefined ? pos.left + "px" : "auto",
        top: pos.top !== undefined ? pos.top + "px" : "auto",
        right: pos.right !== undefined ? pos.right + "px" : "auto",
        bottom: "auto"
    };

    return React.createElement("div", { ref: panelRef, className: "afvc-floating-panel", "data-afvc-theme": theme, style: inlineStyles },
        React.createElement("div", { className: "afvc-floating-header", onPointerDown: handlePointerDown, style: { cursor: "grab", borderRadius: isMinimized ? "12px" : "12px 12px 0 0", borderBottom: isMinimized ? "none" : undefined } },
            React.createElement("div", { className: "afvc-floating-header-title", style: { pointerEvents: "none" } }, `🎯 Auto Follow VC${isMinimized ? "" : " v4.0"}`),
            React.createElement("div", { style: { display: "flex", gap: "6px" } },
                React.createElement("button", { className: "afvc-btn-close-float", onClick: toggleMinimize }, isMinimized ? "＋" : "－"),
                React.createElement("button", { className: "afvc-btn-close-float", onClick: onClose }, "✕")
            )
        ),
        !isMinimized && React.createElement("div", { className: "afvc-floating-body" }, React.createElement(FollowPanel, { isFloating: true, onClose }))
    );
}
function SettingsPanel() {
    const [showFloat, setShowFloat] = React.useState(FloatingPanelManager.isOpen);
    React.useEffect(() => {
        const handler = e => setShowFloat(e.detail);
        document.addEventListener("afvc-float-toggle", handler);
        return () => document.removeEventListener("afvc-float-toggle", handler);
    }, []);
    return React.createElement("div", { className: "afvc-panel" },
        React.createElement("button", { className: "afvc-list-container afvc-btn-add", style: { width: "100%", textAlign: "center", marginBottom: "20px" }, onClick: () => FloatingPanelManager.toggle() }, showFloat ? "Cerrar Panel" : "Abrir Panel Flotante"),
        React.createElement(FollowPanel, { isFloating: false, onClose: null })
    );
}
class AutoFollowVC {
    _voiceHandler = null;
    _lastJoinAttempt = 0;
    _pendingJoinChannelId = null;
    _pendingJoinTime = 0;
    _waitingSniperNotifications = new Set();
    _triggeredUsers = new Set();
    _lastMyChannelId = null;

    _applyTriggerActions(triggerKey, trigger) {
        if (!this._triggeredUsers.has(triggerKey)) {
            this._triggeredUsers.add(triggerKey);
            
            let finalActions = [...trigger.actions];
            if (finalActions.includes("deafen")) finalActions = finalActions.filter(a => a !== "mute");
            if (finalActions.includes("leave")) {
                finalActions = finalActions.filter(a => a !== "leave");
                finalActions.push("leave");
            }

            let delay = 0;
            for (const action of finalActions) { 
                setTimeout(() => execTriggerAction(action), delay);
                delay += 250;
            }
            showToast(`⚡ Trigger: ${finalActions.map(a => ACTION_LABELS[a] || a).join(", ")}`, { type: "warning" });
        }
    }

    getSettingsPanel() { return React.createElement(SettingsPanel, null); }

    _canJoinChannel(channel, myId) {
        if (!channel) return "UNKNOWN";
        if (channel.type === 1 || channel.type === 3) return "AVAILABLE";
        let hasPermission = true;
        try { if (channel.guild_id != null && PermissionStore) hasPermission = PermissionStore.can(CONNECT_PERMISSION, channel); } catch (e) { }
        if (!hasPermission) return "LOCKED";
        const limit = channel.userLimit;
        if (limit > 0) {
            let count = 0;
            try {
                const guildVoiceStates = VoiceStateStore?.getAllVoiceStates()[channel.guild_id] || {};
                for (const uid in guildVoiceStates) { if (guildVoiceStates[uid].channelId === channel.id) count++; }
            } catch(e) {}
            if (count >= limit) return "FULL";
        }
        return "AVAILABLE";
    }

    _notifySniperWait(channelId, reasonMsg) {
        if (!this._waitingSniperNotifications.has(channelId)) {
            showToast(reasonMsg, { type: "warning" });
            this._waitingSniperNotifications.add(channelId);
        }
    }

    _checkPendingJoin(myId) {
        if (ConfigManager.get("advancedMode", false)) return false;
        if (!this._pendingJoinChannelId) return false;
        const myVoiceState = VoiceStateStore?.getVoiceStateForUser(myId);
        if (myVoiceState?.channelId === this._pendingJoinChannelId) { this._pendingJoinChannelId = null; return false; }
        if (Date.now() - this._pendingJoinTime > 8000) {
            this._pendingJoinChannelId = null;
            return false;
        }
        return true;
    }
    _tryFollowUser(userId, trackedUsers, myId) {
        if (trackedUsers[userId]?.paused || userId === myId) return false;
        if (this._checkPendingJoin(myId)) return false;
        const voiceState = VoiceStateStore?.getVoiceStateForUser(userId);
        if (!voiceState?.channelId) return false;
        const myVoiceState = VoiceStateStore?.getVoiceStateForUser(myId);
        if (myVoiceState?.channelId === voiceState.channelId) return false;
        const now = Date.now();
        if (now - this._lastJoinAttempt < ConfigManager.get("cooldown", 200)) return false;
        const channel = ChannelStore?.getChannel(voiceState.channelId);
        if (!channel) return false;
        this._lastJoinAttempt = now;
        const adv = ConfigManager.get("advancedMode", false);

        const joinStatus = this._canJoinChannel(channel, myId);
        if (joinStatus === "LOCKED") {
            this._notifySniperWait(channel.id, "🔒 Sala Bloqueada - Esperando permisos...");
            return false;
        } else if (joinStatus === "FULL") {
            this._notifySniperWait(channel.id, "🔴 Sala Llena - Esperando hueco...");
            return false;
        }

        this._waitingSniperNotifications.delete(channel.id);

        this._pendingJoinChannelId = voiceState.channelId;
        this._pendingJoinTime = now;
        const success = joinVoiceChannel(voiceState.channelId, channel.guild_id);
        if (success) showToast(`Unido`, { type: "success" });
        return success;
    }

    _tryFollowChannel(channelId, myId) {
        const trackedChannels = ConfigManager.get("trackedChannels", {});
        if (trackedChannels[channelId]?.paused) return false;
        if (this._checkPendingJoin(myId)) return false;
        const channel = ChannelStore?.getChannel(channelId);
        if (!channel) return false;
        const myVoiceState = VoiceStateStore?.getVoiceStateForUser(myId);
        if (myVoiceState?.channelId === channelId) return false;

        const now = Date.now();
        if (now - this._lastJoinAttempt < ConfigManager.get("cooldown", 200)) return false;

        const adv = ConfigManager.get("advancedMode", false);

        const joinStatus = this._canJoinChannel(channel, myId);
        if (joinStatus === "LOCKED") {
            this._notifySniperWait(channel.id, "🔒 Canal Bloqueado - Esperando permisos...");
            return false;
        } else if (joinStatus === "FULL") {
            this._notifySniperWait(channel.id, "🔴 Canal Lleno - Esperando hueco...");
            return false;
        }

        this._waitingSniperNotifications.delete(channel.id);

        this._lastJoinAttempt = now;
        this._pendingJoinChannelId = channelId;
        this._pendingJoinTime = now;
        const success = joinVoiceChannel(channelId, channel.guild_id);
        if (success) showToast(`Unido`, { type: "success" });
        return success;
    }

    _checkTriggers(myId, myChannelId) {
        if (!myChannelId) return;
        const triggers = ConfigManager.get("userTriggers", []);
        if (triggers.length === 0) return;
        const myCh = ChannelStore?.getChannel(myChannelId);
        const myChannelName = myCh?.name || "";

        for (const trigger of triggers) {
            if (trigger.paused) continue;
            const triggerKey = `${trigger.userId}:${myChannelId}`;
            const vs = VoiceStateStore?.getVoiceStateForUser(trigger.userId);
            
            let isMatch = false;
            if (vs?.channelId) {
                const tgtCount = getChannelUserCount(vs.channelId);
                const myCount = getChannelUserCount(myChannelId);
                
                if (vs.channelId === myChannelId && tgtCount === myCount) isMatch = true;
                else {
                    const tgtCh = ChannelStore?.getChannel(vs.channelId);
                    if (tgtCh?.name && tgtCh.name === myChannelName && tgtCount === myCount) isMatch = true;
                }
            }

            if (isMatch) {
                this._applyTriggerActions(triggerKey, trigger);
                let checkActions = [...trigger.actions];
                if (checkActions.includes("deafen")) checkActions = checkActions.filter(a => a !== "mute");
                for (const action of checkActions) { checkAndEnforce(action); }
            } else {
                if (this._triggeredUsers.has(triggerKey)) {
                    this._triggeredUsers.delete(triggerKey);
                }
            }
        }
    }

    _startLoop() {
        this._loopActive = true;
        const tick = () => {
            if (!this._loopActive) return;
            try {
                const myId = UserStore?.getCurrentUser()?.id;
                if (myId) {
                    const myVs = VoiceStateStore?.getVoiceStateForUser(myId);
                    const myChannelId = myVs?.channelId || null;
                    if (myChannelId && myChannelId !== this._lastMyChannelId) {
                        this._lastMyChannelId = myChannelId;
                        this._triggeredUsers.clear();
                        
                        setTimeout(() => {
                            
                            const currentVs = VoiceStateStore?.getVoiceStateForUser(myId);
                            if (currentVs?.channelId === myChannelId) {
                                if (ConfigManager.get("autoCamera", false)) execAutoJoinAction("camera");
                                if (ConfigManager.get("autoScreen", false)) execAutoJoinAction("screen");
                            }
                        }, 300);
                    } else if (!myChannelId) {
                        this._lastMyChannelId = null;
                        this._triggeredUsers.clear();
                    }
                    if (ConfigManager.get("globalActive", true)) {
                        const trackedUsers = ConfigManager.get("trackedUsers", {});
                        for (const userId of Object.keys(trackedUsers)) {
                            if (this._tryFollowUser(userId, trackedUsers, myId)) break;
                        }
                        const trackedChannels = ConfigManager.get("trackedChannels", {});
                        for (const channelId of Object.keys(trackedChannels)) {
                            if (this._tryFollowChannel(channelId, myId)) break;
                        }
                    }
                    this._checkTriggers(myId, myVs?.channelId);
                }
            } catch (e) { }
            setTimeout(tick, ConfigManager.get("triggerCheckInterval", 50));
        };
        tick();
    }
    start() {
        ConfigManager.load();
        ConfigManager.set("failedChannels", {});
        DOM.addStyle(CSS);
        getVoiceActions();
        if (ConfigManager.get("autoOpen", false)) {
            FloatingPanelManager.open();
        }
        this._numpad9Handler = (e) => {
            if ((e.code === "Numpad9" || e.key === "9") && ConfigManager.get("hideOnNumpad9", true)) {
                if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable)) return;
                const root = document.getElementById("afvc-floating-root");
                if (root) {
                    const isHidden = root.style.display === "none";
                    root.style.display = isHidden ? "" : "none";
                }
            }
        };
        document.addEventListener("keydown", this._numpad9Handler);
        if (Dispatcher) {
            this._voiceHandler = (event) => {
                try {
                    if (!event?.voiceStates) return;
                    const myId = UserStore?.getCurrentUser()?.id;
                    if (!myId) return;
                    const myVs = VoiceStateStore?.getVoiceStateForUser(myId);
                    const myChannelId = myVs?.channelId;
                    
                    if (myChannelId) {
                        const triggers = ConfigManager.get("userTriggers", []);
                        const myCh = ChannelStore?.getChannel(myChannelId);
                        const myChannelName = myCh?.name || "";

                        for (const state of event.voiceStates) {
                            if (state.userId === myId) continue;
                            
                            let isMatch = false;
                            if (state.channelId) {
                                const tgtCount = getChannelUserCount(state.channelId);
                                const myCount = getChannelUserCount(myChannelId);
                                
                                if (state.channelId === myChannelId && tgtCount === myCount) isMatch = true;
                                else {
                                    const tgtCh = ChannelStore?.getChannel(state.channelId);
                                    if (tgtCh?.name && tgtCh.name === myChannelName && tgtCount === myCount) isMatch = true;
                                }
                            }

                            for (const trigger of triggers) {
                                if (trigger.paused || trigger.userId !== state.userId) continue;
                                const triggerKey = `${trigger.userId}:${myChannelId}`;
                                if (isMatch) {
                                    this._applyTriggerActions(triggerKey, trigger);
                                } else {
                                    if (this._triggeredUsers.has(triggerKey)) {
                                        this._triggeredUsers.delete(triggerKey);
                                    }
                                }
                            }
                        }
                    }
                    
                    if (!ConfigManager.get("globalActive", true)) return;
                    const trackedUsers = ConfigManager.get("trackedUsers", {});
                    const trackedChannels = ConfigManager.get("trackedChannels", {});
                    for (const state of event.voiceStates) {
                        const isTrackedUser = trackedUsers[state.userId] && !trackedUsers[state.userId].paused && state.userId !== myId;
                        const isTrackedChannel = state.channelId && trackedChannels[state.channelId] && !trackedChannels[state.channelId].paused;
                        if (!isTrackedUser && !isTrackedChannel) continue;
                        if (state.channelId) {
                            
                            if (myChannelId === state.channelId) continue;
                            if (this._checkPendingJoin(myId)) return;
                            const channel = ChannelStore?.getChannel(state.channelId);
                            if (!channel) continue;
                            const adv = ConfigManager.get("advancedMode", false);
                            if (!adv && ConfigManager.get("failedChannels", {})[state.channelId]) continue;
                            const joinStatus = this._canJoinChannel(channel, myId);
                            if (joinStatus === "LOCKED") { this._notifySniperWait(channel.id, "🔒 Sala Bloqueada - Esperando permisos..."); continue; }
                            else if (joinStatus === "FULL") { this._notifySniperWait(channel.id, "🔴 Sala Llena - Esperando hueco..."); continue; }
                            this._waitingSniperNotifications.delete(channel.id);
                            this._pendingJoinChannelId = state.channelId;
                            this._pendingJoinTime = Date.now();
                            queueMicrotask(() => {
                                const success = joinVoiceChannel(state.channelId, channel.guild_id);
                                if (success) showToast(`Unido`, { type: "success" });
                            });
                            return;
                        }
                    }
                } catch (e) { }
            };
            Dispatcher.subscribe("VOICE_STATE_UPDATES", this._voiceHandler);
        }
        this._startLoop();
    }
    stop() {
        this._loopActive = false;
        this._triggeredUsers.clear();
        this._lastMyChannelId = null;
        
        if (_cameraRetryTimer) { clearInterval(_cameraRetryTimer); _cameraRetryTimer = null; }
        if (_screenRetryTimer) { clearTimeout(_screenRetryTimer); _screenRetryTimer = null; }
        if (this._voiceHandler && Dispatcher) { try { Dispatcher.unsubscribe("VOICE_STATE_UPDATES", this._voiceHandler); } catch (e) { } this._voiceHandler = null; }
        if (this._numpad9Handler) { document.removeEventListener("keydown", this._numpad9Handler); this._numpad9Handler = null; }
        FloatingPanelManager.close();
        DOM.removeStyle();
        Patcher.unpatchAll();
    }
}
module.exports = AutoFollowVC;
