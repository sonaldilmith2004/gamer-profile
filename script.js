// ==========================================
// CONFIGURATION
// Replace this with your own Discord User ID
// Note: You MUST join the Lanyard Discord server 
// for your status to be tracked (https://discord.gg/lanyard)
// ==========================================
// --- VISIT COUNTER LOGIC ---
async function updateVisitCounter() {
    const counterContainer = document.getElementById('view-counter-container');
    const countSpan = document.getElementById('visit-count');
    if (!counterContainer || !countSpan) return;

    const BASE_URL = 'https://api.counterapi.dev/v1/sonaldilmith-gamer/profile_visits';
    const alreadyCounted = localStorage.getItem('hasCountedVisit');

    // --- 1. INSTANT CACHE LOAD ---
    // Show the last known count immediately while we wait for the network
    const cachedCount = localStorage.getItem('profileVisits');
    if (cachedCount) {
        countSpan.textContent = parseInt(cachedCount).toLocaleString();
    }

    try {
        let data;

        if (alreadyCounted) {
            // --- 2a. RETURNING VISITOR: just read the count, don't increment ---
            const response = await fetch(BASE_URL);
            data = await response.json();
        } else {
            // --- 2b. NEW VISITOR: increment the counter ---
            const response = await fetch(`${BASE_URL}/up`);
            data = await response.json();
            // Mark this browser as counted (persists across sessions)
            localStorage.setItem('hasCountedVisit', '1');
        }

        if (data && data.count !== undefined) {
            countSpan.textContent = data.count.toLocaleString();
            localStorage.setItem('profileVisits', data.count.toString());
        }
    } catch (err) {
        console.warn("View Counter Error:", err.message);
        // On network error, stay with the cached value
        if (!cachedCount) countSpan.textContent = "—";
    }
}

// Ensure it runs after DOM is ready
document.addEventListener('DOMContentLoaded', updateVisitCounter);
const DISCORD_USER_ID = "1254805016166924308"; // Default placeholder (Phineas, Lanyard Creator)

// DOM Elements
const avatarEl = document.getElementById('discord-avatar');
const decorationEl = document.getElementById('discord-decoration');
const statusDot = document.getElementById('status-dot');
const nameEl = document.getElementById('discord-name');
const activityContent = document.getElementById('activity-content');

// Improved Lanyard WebSocket Connection with Reconnection Support
let lanyardWebSocket = null;
let heartbeatInterval = null;

async function fetchInitialPresence() {
    try {
        const response = await fetch(`https://api.lanyard.rest/v1/users/${DISCORD_USER_ID}`);
        const data = await response.json();
        if (data.success && data.data) {
            updateProfile(data.data);
            updateActivity(data.data);
        }
    } catch (err) {
        console.error('Error fetching initial presence:', err);
    }
}

function connectLanyard() {
    // If a connection already exists, close it before starting a new one
    if (lanyardWebSocket) {
        lanyardWebSocket.close();
    }

    lanyardWebSocket = new WebSocket('wss://api.lanyard.rest/socket');

    lanyardWebSocket.onopen = () => {
        console.log('Connected to Lanyard WebSocket');
    };

    lanyardWebSocket.onmessage = (event) => {
        const data = JSON.parse(event.data);

        // Initial OP code 1: Hello -> Send OP 2: Initialize
        if (data.op === 1) {
            lanyardWebSocket.send(JSON.stringify({
                op: 2,
                d: {
                    subscribe_to_id: DISCORD_USER_ID
                }
            }));

            // Start heartbeat ping
            if (heartbeatInterval) clearInterval(heartbeatInterval);
            heartbeatInterval = setInterval(() => {
                if (lanyardWebSocket.readyState === WebSocket.OPEN) {
                    lanyardWebSocket.send(JSON.stringify({ op: 3 }));
                }
            }, data.d.heartbeat_interval);
        }

        // OP Code 0: Event dispatched
        if (data.op === 0) {
            if (data.t === "INIT_STATE" || data.t === "PRESENCE_UPDATE") {
                updateProfile(data.d);
                updateActivity(data.d);
            }
        }
    };

    lanyardWebSocket.onclose = () => {
        console.warn('Lanyard connection closed, reconnecting in 5s...');
        // Clear interval and attempt to reconnect
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        setTimeout(connectLanyard, 5000);
    };

    lanyardWebSocket.onerror = (err) => {
        console.error('Lanyard WebSocket Error:', err);
        lanyardWebSocket.close(); // Triggers onclose reconnection
    };
}

// Initial state fetch & connection
fetchInitialPresence();
connectLanyard();

function updateProfile(data) {
    if (!data || !data.discord_user) {
        nameEl.textContent = "Error: User Not Found";
        activityContent.innerHTML = `<p class="status-text" style="color: #ef4444;">Please join the <a href="https://discord.gg/lanyard" target="_blank" style="color: #60a5fa;">Lanyard Discord</a> so your profile can be captured.</p>`;
        return;
    }

    const user = data.discord_user;

    // Update Avatar (Handle default vs custom avatar)
    let avatarUrl = '';
    if (user.avatar) {
        const ext = user.avatar.startsWith('a_') ? 'gif' : 'png';
        avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}?size=256`;
    } else {
        let avatarId;
        if (user.discriminator === "0" || !user.discriminator) {
            // New discord username system
            avatarId = Number((BigInt(user.id) >> 22n) % 6n);
        } else {
            // Old discriminator system
            avatarId = parseInt(user.discriminator, 10) % 5;
        }
        avatarUrl = `https://cdn.discordapp.com/embed/avatars/${avatarId}.png`;
    }

    // Only update if changed
    if (avatarEl.getAttribute('src') !== avatarUrl) {
        avatarEl.src = avatarUrl;

        // Update the browser tab favicon
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
        }
        link.href = avatarUrl;
    }

    // Update Name
    const newName = user.global_name || user.username;
    if (nameEl.textContent !== newName) {
        nameEl.textContent = newName;
    }

    // Update Avatar Decoration
    let decorationAsset = "";
    if (user.avatar_decoration_data && user.avatar_decoration_data.asset) {
        decorationAsset = `https://cdn.discordapp.com/avatar-decoration-presets/${user.avatar_decoration_data.asset}.png?size=256&passthrough=true`;
    } else if (user.avatar_decoration) {
        decorationAsset = `https://cdn.discordapp.com/avatar-decoration-presets/${user.avatar_decoration}.png?size=256&passthrough=true`;
    }

    if (decorationAsset) {
        if (decorationEl.getAttribute('src') !== decorationAsset) {
            decorationEl.src = decorationAsset;
            decorationEl.style.display = 'block';
        }
    } else {
        if (decorationEl.style.display !== 'none') {
            decorationEl.style.display = 'none';
            decorationEl.src = "";
        }
    }

    // Update Status dot
    const newStatusClass = `status-indicator ${data.discord_status}`;
    if (statusDot.className !== newStatusClass) {
        statusDot.className = newStatusClass;
    }
}

let lastActivityBodyHtml = '';
let lastQuoteHtml = '';

let lastKnownStatusQuote = localStorage.getItem('discordStatusQuote') || '';

function updateActivity(data) {
    if (!data) return;

    // Check for listening activity first to ensure we catch changes early
    const isListeningSpotify = !!data.listening_to_spotify;
    const activities = data.activities || [];

    // Find different types of activities to be more accurate
    const playingActivity = activities.find(a => a.type === 0);
    const streamingActivity = activities.find(a => a.type === 1);
    const watchingActivity = activities.find(a => a.type === 3);
    const competingActivity = activities.find(a => a.type === 5);

    const mainActivity = playingActivity || streamingActivity || watchingActivity || competingActivity;

    // --- 1. HANDLE CUSTOM STATUS QUOTE ---
    let quoteHtml = '';
    const customStatus = activities.find(a => a.type === 4);
    if (customStatus && customStatus.state) {
        lastKnownStatusQuote = `
            <div class="status-quote animated-gradient-text">
                "${customStatus.emoji ? customStatus.emoji.name + ' ' : ''}${customStatus.state}"
            </div>
        `;
        localStorage.setItem('discordStatusQuote', lastKnownStatusQuote);
    }
    
    if (lastKnownStatusQuote) {
        quoteHtml = lastKnownStatusQuote;
    }

    // --- 2. HANDLE MAIN ACTIVITY BODY ---
    let activityBodyHtml = '';
    if (data.listening_to_spotify) {
        const sp = data.spotify;
        activityBodyHtml = `
            <div class="activity-card">
                <div class="activity-image-wrapper">
                    <img src="${sp.album_art_url}" class="activity-large-image" alt="Album Art" />
                    <img src="https://upload.wikimedia.org/wikipedia/commons/1/19/Spotify_logo_without_text.svg" class="activity-small-image" style="background:#000; padding:2px;" />
                </div>
                <div class="activity-details">
                    <span class="activity-name" style="color: #1ed760;">Listening to Spotify</span>
                    <span class="activity-details-text">${sp.song}</span>
                    <span class="activity-state">by ${sp.artist}</span>
                </div>
            </div>
        `;
    } else if (mainActivity) {
        let activityVisual = '';
        const assets = mainActivity.assets;
        
        if (assets && (assets.large_image || assets.small_image)) {
            const mainAsset = assets.large_image || assets.small_image;
            const largeImg = getAssetUrl(mainActivity.application_id, mainAsset);
            activityVisual = `<img src="${largeImg}" class="activity-large-image" alt="Activity" />`;

            if (assets.large_image && assets.small_image) {
                const smallImg = getAssetUrl(mainActivity.application_id, assets.small_image);
                activityVisual += `<img src="${smallImg}" class="activity-small-image" alt="Icon" />`;
            }
        } else if (mainActivity.application_id) {
            const iconUrl = getAssetUrl(mainActivity.application_id, null);
            activityVisual = `<img src="${iconUrl}" class="activity-large-image" alt="Game Icon" />`;
        } else {
            activityVisual = `
                <div class="activity-large-image" style="background:#1e293b; display:flex; align-items:center; justify-content:center; color:#a855f7; font-size:1.8rem; border-radius:10px;">
                    <i class="fas ${mainActivity.type === 3 ? 'fa-tv' : (mainActivity.type === 1 ? 'fa-broadcast-tower' : 'fa-gamepad')}"></i>
                </div>
            `;
        }

        let actionText = "Playing";
        if (mainActivity.type === 1) actionText = "Streaming";
        if (mainActivity.type === 3) actionText = "Watching";
        if (mainActivity.type === 5) actionText = "Competing in";

        activityBodyHtml = `
            <div class="activity-card">
                <div class="activity-image-wrapper">
                    ${activityVisual}
                </div>
                <div class="activity-details">
                    <span class="activity-name">${actionText} ${mainActivity.name}</span>
                    <span class="activity-details-text">${mainActivity.details || ''}</span>
                    <span class="activity-state">${mainActivity.state || ''}</span>
                </div>
            </div>
        `;
    } else {
        activityBodyHtml = `<p class="status-text">Not doing anything at the moment.</p>`;
    }

    // --- 3. APPLY UPDATES AND SELECTIVE ANIMATION ---
    // Only update and re-animate if something actually changed!
    if (activityBodyHtml !== lastActivityBodyHtml || quoteHtml !== lastQuoteHtml) {
        const hasActivityChanged = activityBodyHtml !== lastActivityBodyHtml;
        
        lastActivityBodyHtml = activityBodyHtml;
        lastQuoteHtml = quoteHtml;

        // Construct HTML: Static Quote + (Possibly Animated) Activity
        let finalHtml = quoteHtml;
        if (hasActivityChanged) {
            finalHtml += `<div class="activity-entrance">${activityBodyHtml}</div>`;
        } else {
            finalHtml += activityBodyHtml;
        }

        activityContent.innerHTML = finalHtml;
    }
}

// Convert Discord internal asset strings to URLs
function getAssetUrl(appId, assetString) {
    if (!assetString) {
        // Fallback: If no asset is provided, use the DSTN proxy to get the app's official logo
        return `https://dcdn.dstn.to/app-icons/${appId}`;
    }
    // Handle external images (like from VALORANT, League of Legends, etc.)
    if (assetString.startsWith('mp:external/')) {
        return assetString.replace('mp:external/', 'https://media.discordapp.net/external/');
    }
    // If it's a direct URL (like from custom rich presence or newer systems)
    if (assetString.startsWith('http://') || assetString.startsWith('https://')) {
        return assetString;
    }
    // Fallback to standard Discord CDN for application-specific assets
    return `https://cdn.discordapp.com/app-assets/${appId}/${assetString}.png`;
}

// Background Video Sound Toggle Handler
const muteToggleBtn = document.getElementById('mute-toggle');
const bgVideo = document.getElementById('bg-video');
const volumeSlider = document.getElementById('volume-slider');

if (muteToggleBtn && bgVideo) {
    const audioContainer = document.querySelector('.audio-control-container');
    let retractionTimer = null;
    
    // Function to handle the auto-retract behavior
    const triggerRetract = (delay = 2000) => {
        if (retractionTimer) clearTimeout(retractionTimer);
        audioContainer.classList.add('expanded');
        
        retractionTimer = setTimeout(() => {
            // Only retract if the user isn't actively hovering anymore
            if (!audioContainer.matches(':hover')) {
                audioContainer.classList.remove('expanded');
            }
            retractionTimer = null;
        }, delay);
    };

    // Hover manual logic - NOW INSTANT RETRACT
    if (audioContainer) {
        audioContainer.addEventListener('mouseenter', () => {
            if (retractionTimer) {
                clearTimeout(retractionTimer);
                retractionTimer = null;
            }
            audioContainer.classList.add('expanded');
        });
        
        audioContainer.addEventListener('mouseleave', () => {
            // INSTANT RETRACT the second cursor leaves
            if (retractionTimer) clearTimeout(retractionTimer);
            retractionTimer = null;
            audioContainer.classList.remove('expanded');
        });
    }

    if (volumeSlider) {
        bgVideo.volume = volumeSlider.value;
    }

    const updateIcon = () => {
        if (bgVideo.muted || bgVideo.paused || bgVideo.volume === 0) {
            muteToggleBtn.innerHTML = '<i class="fas fa-volume-mute"></i>';
        } else if (bgVideo.volume < 0.5) {
            muteToggleBtn.innerHTML = '<i class="fas fa-volume-down"></i>';
        } else {
            muteToggleBtn.innerHTML = '<i class="fas fa-volume-up"></i>';
        }

        if (volumeSlider) {
            if (bgVideo.muted) {
                volumeSlider.value = 0;
            } else {
                volumeSlider.value = bgVideo.volume;
            }

            const volumePct = document.getElementById('volume-percentage');
            if (volumePct) {
                const pctValue = Math.round(volumeSlider.value * 100);
                volumePct.textContent = `${pctValue}%`;
            }
        }
    };

    bgVideo.addEventListener('play', updateIcon);
    bgVideo.addEventListener('pause', updateIcon);
    bgVideo.addEventListener('volumechange', updateIcon);

    updateIcon();

    let preMuteVolume = volumeSlider ? parseFloat(volumeSlider.value) : 0.5;
    if (preMuteVolume === 0) preMuteVolume = 0.5;

    if (volumeSlider) {
        volumeSlider.addEventListener('click', (e) => e.stopPropagation());

        volumeSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            if (val > 0) {
                bgVideo.muted = false;
                preMuteVolume = val;
            }
            bgVideo.volume = val;

            if (bgVideo.paused && val > 0) {
                bgVideo.play().catch(console.error);
            }
            
            // Retract shortly after they stop sliding
            triggerRetract(2500); 
        });
    }

    muteToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();

        if (bgVideo.paused) {
            bgVideo.muted = false;
            bgVideo.volume = preMuteVolume;
            bgVideo.play().catch(console.error);
        } else {
            if (bgVideo.muted || bgVideo.volume === 0) {
                bgVideo.muted = false;
                bgVideo.volume = preMuteVolume;
            } else {
                bgVideo.muted = true;
            }
        }
        
        // Retract after clicking mute
        triggerRetract();
    });


    // Enter Screen Logic - perfectly bypassing autoplay block!
    const enterScreen = document.getElementById('enter-screen');
    const enterBtn = document.getElementById('enter-btn');

    if (enterScreen && enterBtn) {
        enterBtn.addEventListener('click', () => {
            // Force cursor to exit hover state since the button will vanish
            isHovering = false;
            cursorOutline.classList.remove('hovering');
            cursorOutline.classList.remove('clicking');
            cursorDot.classList.remove('clicking');
            cursorDot.style.transform = 'translate(-50%, -50%) scale(1)';

            // --- THE NUCLEAR AUDIO RESET ---
            // 1. First ensure it's unmuted and playing the normal way
            bgVideo.muted = false;
            bgVideo.volume = volumeSlider ? parseFloat(volumeSlider.value) : 0.5;

            // 2. Play first! This ensures the "unmute" intent is recorded by the browser
            bgVideo.play().then(() => {
                console.log("Normal Video Playback Success");
                // 3. ONLY start the complicated audio graph after a short delay
                // to let the hardware "warm up" and prevent hijacking errors.
                setTimeout(() => {
                    initAudioVisualizer(bgVideo);
                }, 200);
            }).catch(err => {
                console.warn("Retrying playback due to block:", err.message);
                // Fallback for strict browsers
                bgVideo.muted = true; // Briefly mute
                bgVideo.play().then(() => {
                    setTimeout(() => {
                        bgVideo.muted = false; // Then unmute after play
                        initAudioVisualizer(bgVideo);
                    }, 200);
                });
            });

            // Fade out the Enter Screen
            enterScreen.style.opacity = '0';
            enterScreen.style.transform = 'scale(1.05)';

            // completely remove from DOM after fade
            setTimeout(() => {
                enterScreen.remove();
            }, 800);
        });
    }
}

// ==========================================
// AUDIO VISUALIZER (BEAT DETECTOR)
// ==========================================
// ==========================================
// AUDIO VISUALIZER (BEAT DETECTOR)
let audioCtx = null;
let audioSource = null;

function initAudioVisualizer(video) {
    const canvas = document.getElementById('audio-visualizer-icon');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // SMOOTH VOLUME TRACKER (Interpolation)
    let smoothVol = video.muted ? 0 : video.volume;

    const isLocalFile = window.location.protocol === 'file:';

    if (isLocalFile) {
        console.warn("Running from local file: Using Simulated Visualizer.");
        startSimulatedVisualizer(canvas, ctx, video);
        return;
    }

    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }

        if (audioSource) {
            if (audioCtx.state === 'suspended') audioCtx.resume();
            return;
        }

        video.crossOrigin = "anonymous";
        audioSource = audioCtx.createMediaElementSource(video);
        const analyser = audioCtx.createAnalyser();
        
        analyser.fftSize = 256; 
        analyser.smoothingTimeConstant = 0.8; 
        
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        audioSource.connect(audioCtx.destination);
        audioSource.connect(analyser);

        if (audioCtx.state === 'suspended') audioCtx.resume();

        function resize() {
            canvas.width = 120;
            canvas.height = 120;
        }
        resize();

        function draw() {
            requestAnimationFrame(draw);
            
            // --- THE LIQUID VOLUME ENGINE ---
            // Gradually chase the target volume (0 if muted, video.volume if unmuted)
            const targetVol = (video.muted || video.volume === 0) ? 0 : video.volume;
            // Lerp speed (0.1 means 10% movement per frame)
            smoothVol += (targetVol - smoothVol) * 0.1;

            // Only analyze if there's visually something to show
            if (smoothVol > 0.001) {
                analyser.getByteFrequencyData(dataArray);
                renderIconVisualizer(canvas, ctx, dataArray, bufferLength, smoothVol);
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
        draw();
    } catch (err) {
        console.error("Audio API Error:", err.message);
        startSimulatedVisualizer(canvas, ctx, video);
    }
}

function renderIconVisualizer(canvas, ctx, dataArray, bufferLength, currentVol) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Safety check for absolute silence
    if (currentVol < 0.001) return;

    // --- THE MAGIC FADE ---
    // Gradually Fade Opacity in addition to size
    // Using a steeper curve (currentVol * 1.5) so it becomes solid faster
    ctx.globalAlpha = Math.min(1, currentVol * 1.5);

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const innerRadius = 25; 

    let bass = 0;
    for(let j=0; j<4; j++) bass += dataArray[j];
    const avgB = bass / (4 * 255);

    const totalBars = 60;
    const angleStep = (Math.PI * 2) / totalBars;
    
    // Volume-responsive Spike Engine
    const spikeMul = 1 + (Math.pow(avgB, 2) * 1.5 * currentVol);

    for (let i = 0; i < totalBars; i++) {
        const dataIdx = Math.floor((i / totalBars) * (bufferLength / 2));
        const val = dataArray[dataIdx];
        
        // Use smooth volume for length
        const barLength = ((val / 255) * 25 * spikeMul * currentVol) + 1;
        const angle = i * angleStep;
        
        const xStart = centerX + Math.cos(angle) * innerRadius;
        const yStart = centerY + Math.sin(angle) * innerRadius;
        const xEnd = centerX + Math.cos(angle) * (innerRadius + barLength);
        const yEnd = centerY + Math.sin(angle) * (innerRadius + barLength);
        
        const ratio = i / totalBars;
        let r, g, b;
        if (ratio < 0.5) {
            const sub = ratio * 2;
            r = 236 + sub * (168 - 236); g = 72 + sub * (85 - 72); b = 153 + sub * (247 - 153);
        } else {
            const sub = (ratio - 0.5) * 2;
            r = 168 + sub * (6 - 168); g = 85 + sub * (182 - 85); b = 247 + sub * (212 - 247);
        }

        ctx.strokeStyle = `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        
        ctx.beginPath();
        ctx.moveTo(xStart, yStart);
        ctx.lineTo(xEnd, yEnd);
        ctx.stroke();
    }

    const container = document.querySelector('.audio-control-container');
    if (container) {
        container.style.transform = `scale(${1 + (avgB * 0.03 * currentVol)})`;
    }
}

function startSimulatedVisualizer(canvas, ctx, video) {
    canvas.width = 120;
    canvas.height = 120;
    const simData = new Uint8Array(64);
    let smoothVol = video.muted ? 0 : video.volume;

    function drawSim() {
        requestAnimationFrame(drawSim);
        const targetVol = (video.muted || video.volume === 0) ? 0 : video.volume;
        smoothVol += (targetVol - smoothVol) * 0.1;
        
        if (smoothVol > 0.001) {
            const time = Date.now() * 0.005;
            for (let i = 0; i < simData.length; i++) {
                const noise = Math.sin(time + i * 0.3) * 30 + Math.random() * 20;
                simData[i] = Math.max(0, 50 + noise);
            }
            renderIconVisualizer(canvas, ctx, simData, simData.length, smoothVol);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }
    drawSim();
}

// Enhanced Cursor Effect
const cursorDot = document.createElement('div');
cursorDot.className = 'cursor-dot';
document.body.appendChild(cursorDot);

const cursorOutline = document.createElement('div');
cursorOutline.className = 'cursor-outline';
document.body.appendChild(cursorOutline);

let mouseX = window.innerWidth / 2;
let mouseY = window.innerHeight / 2;
let outlineX = mouseX;
let outlineY = mouseY;
let isMoving = false;
let isHovering = false; // state for hover effect

let lastSpawnTime = 0;
const colors = ['#a855f7', '#ec4899', '#3b82f6', '#8b5cf6', '#06b6d4'];

document.addEventListener('mousemove', (e) => {
    const vx = e.clientX - mouseX;
    const vy = e.clientY - mouseY;
    mouseX = e.clientX;
    mouseY = e.clientY;

    if (!isMoving) {
        cursorDot.style.opacity = '1';
        cursorOutline.style.opacity = '1';
        isMoving = true;
    }

    // Instant dot movement
    cursorDot.style.left = `${mouseX}px`;
    cursorDot.style.top = `${mouseY}px`;

    // Create trail constantly when moving for the tessellation effect
    const now = Date.now();
    const dist = Math.sqrt(vx * vx + vy * vy);

    // Spawn if moved a bit and enough time passed
    if (dist > 1 && now - lastSpawnTime > 20) {
        createTrail(mouseX, mouseY, vx, vy);
        lastSpawnTime = now;

        // Spawn extra particles for very fast movement to fill gaps
        if (dist > 25) {
            createTrail(mouseX, mouseY, vx + (Math.random() - 0.5) * 15, vy + (Math.random() - 0.5) * 15);
            createTrail(mouseX, mouseY, vx + (Math.random() - 0.5) * 30, vy + (Math.random() - 0.5) * 30);
        }
    }
});

function animateCursor() {
    // Smooth outline trailing
    const dx = mouseX - outlineX;
    const dy = mouseY - outlineY;

    const distance = Math.sqrt(dx * dx + dy * dy);

    outlineX += dx * 0.15;
    outlineY += dy * 0.15;

    let scaleX = 1;
    let scaleY = 1;
    let angle = 0;

    // Apply stretch effect based on velocity
    if (!isHovering && distance > 0.5) {
        angle = Math.atan2(dy, dx) * (180 / Math.PI);
        // Map distance to a stretch value (max stretch 2.0x)
        const stretch = Math.min(1 + (distance * 0.015), 2.0);
        scaleX = stretch;
        // Compress Y-axis slightly to preserve area
        scaleY = Math.max(0.6, 1 / stretch);
    }

    cursorOutline.style.left = `${outlineX}px`;
    cursorOutline.style.top = `${outlineY}px`;
    cursorOutline.style.transform = `translate(-50%, -50%) rotate(${angle}deg) scale(${scaleX}, ${scaleY})`;

    requestAnimationFrame(animateCursor);
}
animateCursor();

function createTrail(x, y, vx, vy) {
    const trail = document.createElement('div');
    trail.className = 'cursor-trail';

    const shapes = ['50%', '15%', '0%']; // Circle, rounded poly, sharp poly (tessellation shapes)
    const size = Math.random() * 8 + 4; // 4 to 12px

    trail.style.width = `${size}px`;
    trail.style.height = `${size}px`;
    trail.style.borderRadius = shapes[Math.floor(Math.random() * shapes.length)];
    trail.style.background = colors[Math.floor(Math.random() * colors.length)];

    // Spread sideways based on movement
    const len = Math.sqrt(vx * vx + vy * vy) || 1;
    const perpX = -vy / len;
    const perpY = vx / len;
    const spread = (Math.random() - 0.5) * 20; // Side spread size

    trail.style.left = `${x + (perpX * spread)}px`;
    trail.style.top = `${y + (perpY * spread)}px`;

    // Dynamic physics based on cursor speed
    const tx = (vx * 0.6) + (Math.random() - 0.5) * 30;
    const ty = (vy * 0.6) + (Math.random() - 0.5) * 30;

    const rotStart = Math.random() * 360;
    const rotEnd = rotStart + (Math.random() > 0.5 ? 270 : -270);

    trail.style.setProperty('--tx', `${tx}px`);
    trail.style.setProperty('--ty', `${ty}px`);
    trail.style.setProperty('--rot-start', `${rotStart}deg`);
    trail.style.setProperty('--rot-end', `${rotEnd}deg`);

    document.body.appendChild(trail);

    setTimeout(() => {
        trail.remove();
    }, 800);
}

// Interactive element hover effect
const interactives = document.querySelectorAll('a, button, .social-btn, .mute-toggle-btn, .enter-button, input[type="range"], .avatar-container');
interactives.forEach(el => {
    el.addEventListener('mouseenter', () => {
        isHovering = true;
        cursorOutline.classList.add('hovering');
        // Instantly reset any rotation/stretch from movement when hitting a button
        cursorOutline.style.transform = `translate(-50%, -50%) rotate(0deg) scale(1, 1)`;
        cursorDot.style.transform = 'translate(-50%, -50%) scale(0.5)';
    });
    el.addEventListener('mouseleave', () => {
        isHovering = false;
        cursorOutline.classList.remove('hovering');
        cursorDot.style.transform = 'translate(-50%, -50%) scale(1)';
    });
});

// Click Animation Logic
document.addEventListener('mousedown', () => {
    cursorOutline.classList.add('clicking');
    cursorDot.classList.add('clicking');

    // Spawn an explosion of click particles
    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const velocity = 50 + Math.random() * 40; // Explosive push
        const vx = Math.cos(angle) * velocity;
        const vy = Math.sin(angle) * velocity;
        createClickParticle(mouseX, mouseY, vx, vy);
    }
});

// Ensure cursor state resets even if mouseup happens outside window or during drag
const clearClickingState = () => {
    cursorOutline.classList.remove('clicking');
    cursorDot.classList.remove('clicking');
};

window.addEventListener('mouseup', clearClickingState);
window.addEventListener('dragend', clearClickingState);

// Reset all states if window loses focus (e.g., Alt-Tab)
window.addEventListener('blur', () => {
    clearClickingState();
    isHovering = false;
    cursorOutline.classList.remove('hovering');
    cursorDot.style.transform = 'translate(-50%, -50%) scale(1)';
});

function createClickParticle(x, y, vx, vy) {
    const particle = document.createElement('div');
    particle.className = 'click-particle';
    particle.style.left = `${x}px`;
    particle.style.top = `${y}px`;
    particle.style.background = colors[Math.floor(Math.random() * colors.length)];

    particle.style.setProperty('--vx', `${vx}px`);
    particle.style.setProperty('--vy', `${vy}px`);

    document.body.appendChild(particle);

    setTimeout(() => {
        particle.remove();
    }, 600);
}

// Avatar Hover Shooting Particles
const avatarContainer = document.querySelector('.avatar-container');
let avatarParticleInterval = null;

if (avatarContainer) {
    avatarContainer.addEventListener('mouseenter', () => {
        if (!avatarParticleInterval) {
            avatarParticleInterval = setInterval(() => {
                // Shoot 5 extra visible particles every 50ms
                for (let i = 0; i < 5; i++) {
                    createAvatarParticle(avatarContainer);
                }
            }, 50);
        }
    });

    avatarContainer.addEventListener('mouseleave', () => {
        if (avatarParticleInterval) {
            clearInterval(avatarParticleInterval);
            avatarParticleInterval = null;
        }
    });
}

function createAvatarParticle(container) {
    const particle = document.createElement('div');
    particle.className = 'avatar-particle';

    // Position at the center of the container
    particle.style.left = '50%';
    particle.style.top = '50%';

    const color = colors[Math.floor(Math.random() * colors.length)];
    particle.style.background = color;

    // Make them glow
    particle.style.boxShadow = `0 0 15px ${color}`;

    // Variable size for better visibility
    const size = 6 + Math.random() * 8; // 6px to 14px
    particle.style.width = `${size}px`;
    particle.style.height = `${size}px`;

    const angle = Math.random() * Math.PI * 2;
    // Velocity controls how far it shoots - shoot much further so it escapes from behind the picture easily
    const velocity = 80 + Math.random() * 100;
    const vx = Math.cos(angle) * velocity;
    const vy = Math.sin(angle) * velocity;

    particle.style.setProperty('--vx', `${vx}px`);
    particle.style.setProperty('--vy', `${vy}px`);

    container.appendChild(particle);

    setTimeout(() => {
        particle.remove();
    }, 1200);
}

// --- Fireflakes Animation ---
const fireCanvas = document.getElementById('fireflakes-canvas');
const fireCtx = fireCanvas.getContext('2d');
let fireflakesArray = [];

if (fireCanvas) {
    fireCanvas.width = window.innerWidth;
    fireCanvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
        fireCanvas.width = window.innerWidth;
        fireCanvas.height = window.innerHeight;
    });

    class Fireflake {
        constructor() {
            this.x = Math.random() * fireCanvas.width;
            this.y = Math.random() * fireCanvas.height - fireCanvas.height;
            this.size = Math.random() * 3 + 1;
            this.speedX = (Math.random() * 2 - 1) * 0.2;
            this.speedY = Math.random() * 0.8 + 0.3;
            const themeColors = ['#a855f7', '#ec4899', '#3b82f6', '#8b5cf6', '#06b6d4'];
            this.baseColor = themeColors[Math.floor(Math.random() * themeColors.length)];
            this.alpha = Math.random() * 0.8 + 0.2;
        }

        update() {
            this.x += this.speedX + Math.sin(this.y * 0.05) * 0.5;
            this.y += this.speedY;
            if (this.y > fireCanvas.height) {
                this.y = 0 - this.size;
                this.x = Math.random() * fireCanvas.width;
            }
        }

        draw() {
            fireCtx.save();
            fireCtx.globalAlpha = this.alpha;
            fireCtx.beginPath();
            fireCtx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            fireCtx.fillStyle = this.baseColor;
            fireCtx.shadowBlur = 10;
            fireCtx.shadowColor = this.baseColor;
            fireCtx.fill();
            fireCtx.closePath();
            fireCtx.restore();
        }
    }

    function initFireflakes() {
        fireflakesArray = [];
        const numberOfParticles = Math.min(30, Math.floor(window.innerWidth * window.innerHeight / 25000));
        for (let i = 0; i < numberOfParticles; i++) {
            fireflakesArray.push(new Fireflake());
        }
    }

    function animateFireflakes() {
        fireCtx.clearRect(0, 0, fireCanvas.width, fireCanvas.height);
        for (let i = 0; i < fireflakesArray.length; i++) {
            fireflakesArray[i].update();
            fireflakesArray[i].draw();
        }
        requestAnimationFrame(animateFireflakes);
    }

    initFireflakes();
    animateFireflakes();
}

// Glass Card Tilt effect was removed along with the card styling



