import { createClient } from '@supabase/supabase-js';
import './style.css';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const configured = !!(url && key && !url.includes('YOUR-PROJECT') && !key.includes('YOUR_SUPABASE'));
const supabase = configured ? createClient(url, key) : null;
const $ = s => document.querySelector(s);
let user = null, profile = null, cooldown = {claim_until:null, command_until:null}, channels = [], dropHistory = [], historyAvailable = false, realtime = null, tickHandle, previousTimerState = {claim:0, command:0};
const html = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time = v => v ? new Date(v).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : 'Not recorded';
const msleft = v => Math.max(0, new Date(v || 0).getTime() - Date.now());
const fmt = (ms, hours=false) => { let n=Math.ceil(ms/1000), h=Math.floor(n/3600), m=Math.floor(n%3600/60), s=n%60; return hours ? [h,m,s].map(x=>String(x).padStart(2,'0')).join(':') : [Math.floor(n/60),s].map(x=>String(x).padStart(2,'0')).join(':'); };
function authErrorMessage(error, mode='login') {
 const code = String(error?.code || error?.name || '').toLowerCase();
 const msg = String(error?.message || '').toLowerCase();
 if (code.includes('email_not_confirmed') || msg.includes('email not confirmed')) return 'Email verification required. Open the verification link sent to your inbox, then sign in again.';
 if (code.includes('invalid_credentials') || msg.includes('invalid login credentials')) return 'Email or password is incorrect. Check both and try again.';
 if (code.includes('user_already_exists') || msg.includes('already registered')) return 'An account with this email already exists. Switch to Log in instead.';
 if (code.includes('weak_password') || msg.includes('password should be')) return 'Choose a stronger password that meets the password requirements.';
 if (code.includes('over_request_rate_limit') || code.includes('too_many_requests') || msg.includes('rate limit')) return 'Too many attempts in a short time. Please wait a little and try again.';
 if (msg.includes('network') || msg.includes('fetch')) return 'Connection problem. Check your internet and try again.';
 return error?.message || (mode === 'signup' ? 'Account creation failed. Please try again.' : 'Sign-in failed. Please try again.');
}

function shell(){ $('#app').innerHTML = `
<header class="site-top"><a class="brand-mark" href="#" aria-label="TCG Nexus home"><span class="brand-symbol">▱</span><span>TCG <b>NEXUS</b></span></a><nav class="top-nav top-nav-menus"><a href="#home" data-home>Home</a><details class="nav-dropdown"><summary>Workspace <span>▾</span></summary><div class="nav-dropdown-menu"><button type="button" data-jump="personal">My cooldowns</button><button type="button" data-jump="shared">Shared radar</button><button type="button" data-jump="update">Update a channel</button></div></details><details class="nav-dropdown"><summary>Account <span>▾</span></summary><div class="nav-dropdown-menu"><button type="button" id="navProfileSettings">Profile & settings</button><button type="button" id="navSignOut">Sign out</button></div></details><details class="nav-dropdown"><summary>Help <span>▾</span></summary><div class="nav-dropdown-menu"><a href="#about" data-info="about">About Nexus</a><a href="#help" data-info="help">Help center</a></div></details></nav><div class="userbox" id="userbox"></div></header>
<div id="notice" aria-live="polite"></div>
<section id="auth" class="entry-layout">
  <div class="entry-story">
    <div class="story-kicker"><span class="status-dot"></span> PLAY <i>•</i> TRACK <i>•</i> CONNECT <i>•</i> GROW</div>
    <div class="hero-title">TCG <span>NEXUS</span></div>
    <h2>Your TCG companion.</h2>
    <p class="hero-copy">Track cooldowns, share updates with friends, and keep your TCG community in sync — all in one place.</p>
    <div class="feature-strip">
      <div class="feature"><span class="feature-icon">◷</span><b>Shared<br>cooldowns</b></div>
      <div class="feature"><span class="feature-icon">♧</span><b>Community<br>access</b></div>
      <div class="feature"><span class="feature-icon">⌁</span><b>Real-time<br>sync</b></div>
      <div class="feature"><span class="feature-icon">◇</span><b>Built for<br>your team</b></div>
    </div>
    <div class="quote-card"><span class="quote-mark">“</span><p>A better place to track, share, and play together.</p></div>
    <div class="art-orbit orbit-one"></div><div class="art-orbit orbit-two"></div><div class="card-art card-art-a"><span>TCG</span><b>✦</b></div><div class="card-art card-art-b"><span>NEXUS</span><b>◇</b></div><div class="card-art card-art-c"><span>COLLECT</span><b>✧</b></div>
  </div>
  <div class="auth-side"><div class="auth-card">
    <div class="auth-tabs" role="tablist" aria-label="Account access"><button type="button" id="tabSignIn" class="auth-tab active" role="tab" aria-selected="true">↪ &nbsp; Log in</button><button type="button" id="tabSignUp" class="auth-tab" role="tab" aria-selected="false">＋ &nbsp; Create account</button></div>
    <div class="auth-heading"><span class="auth-kicker">WELCOME TO YOUR SPACE</span><h2 id="authTitle">Welcome back</h2><p id="authSubtitle">Log in to continue to TCG Nexus.</p></div>
    <form id="authForm" class="auth-form">
      <div class="field"><label for="email">Email address</label><div class="input-wrap"><span class="input-icon">✉</span><input id="email" type="email" autocomplete="email" required placeholder="you@example.com"></div></div>
      <div class="field"><div class="label-line"><label for="password">Password</label><button type="button" class="text-button" id="forgotPassword">Forgot password?</button></div><div class="input-wrap"><span class="input-icon">▣</span><input id="password" type="password" autocomplete="current-password" minlength="8" required placeholder="Enter your password"><button type="button" class="reveal-button" id="togglePassword" aria-label="Show password">◉</button></div></div>
      <div id="confirmPasswordField" class="field" hidden><label for="confirmPassword">Confirm password</label><div class="input-wrap"><span class="input-icon">▣</span><input id="confirmPassword" type="password" autocomplete="new-password" minlength="8" placeholder="Enter password again"></div></div>
      <div class="auth-options"><label class="check-label"><input id="rememberMe" type="checkbox" checked><span class="custom-check"></span> Keep me signed in</label><span class="secure-note"><span>●</span> Secure access</span></div>
      <button type="submit" class="submit-button" id="authSubmit"><span id="authSubmitText">Log in to Nexus</span><span class="submit-arrow">→</span></button>
    </form>
    <div class="auth-divider"><span></span><small>YOUR COMMUNITY, IN SYNC</small><span></span></div>
    <p class="auth-switch-copy" id="authSwitchCopy">New to TCG Nexus? <button type="button" id="switchSignUp">Create an account</button></p>
    <p class="auth-legal">By continuing, you agree to use TCG Nexus respectfully. Your personal cooldowns stay tied to your account.</p>
  </div><div class="auth-footnote"><span class="tiny-shield">◇</span> Your account. Your cooldowns. Your community.</div></div>
</section>
<footer class="site-footer" id="siteFooter"><div class="footer-brand"><a class="brand-mark" href="#"><span class="brand-symbol">▱</span><span>TCG <b>NEXUS</b></span></a><p>A companion for TCG players to track, share, and grow together.</p><small>Made for the community</small></div><div class="footer-column"><b>Explore</b><a href="#home" data-info="home">Home</a><a href="#about" data-info="about">About Nexus</a><a href="#features" data-info="features">Features</a></div><div class="footer-column"><b>Support</b><a href="#help" data-info="help">Help center</a></div><div class="footer-column"><b>Information</b><a href="#privacy" data-info="privacy">Privacy overview</a><a href="#terms" data-info="terms">Terms of use</a><a href="#community" data-info="community">Community guidelines</a></div></footer>
<div id="infoModal" class="modal-backdrop" hidden><section class="info-modal" role="dialog" aria-modal="true" aria-labelledby="infoTitle"><button type="button" id="closeInfo" class="modal-close" aria-label="Close">×</button><span class="auth-kicker">TCG NEXUS</span><h2 id="infoTitle">About Nexus</h2><div id="infoBody" class="info-body"></div><button type="button" class="submit-button modal-done" id="infoDone">Got it <span class="submit-arrow">→</span></button></section></div>
<div id="dashboard" hidden class="dashboard-shell">
<div class="dashboard-welcome"><div class="dashboard-welcome-copy"><span class="dash-eyebrow"><span class="status-dot"></span> YOUR WORKSPACE</span><h1 id="welcomeHeading">Your TCG world, <span>in sync.</span></h1><p>Personal cooldowns, shared drop intelligence, and your community — all organized in one place.</p><div class="welcome-actions"><button type="button" class="primary" data-jump="personal">Start with my cooldowns <span aria-hidden="true">→</span></button><button type="button" class="secondary" data-jump="shared">Explore shared radar</button></div></div><div class="dashboard-date"><span class="dash-date-icon">◷</span><div><small>LIVE WORKSPACE</small><b>Synced in real time</b></div><span class="pill live">● LIVE</span></div></div>
<div class="dashboard-quicknav" id="homeQuicknav"><div class="quicknav-label"><span class="dash-eyebrow">QUICK ACTIONS</span><small>Jump straight into what you need</small></div><button type="button" data-jump="personal"><span>◷</span> My cooldowns <b>→</b></button><button type="button" data-jump="shared"><span>⌁</span> Shared radar <b>→</b></button><button type="button" data-jump="update"><span>＋</span> Record a drop <b>→</b></button><button type="button" id="openProfileSettings"><span>⚙</span> Settings <b>→</b></button></div><div class="cooldown-tabs" id="cooldownTabs" role="tablist" aria-label="Cooldown workspace"><button type="button" class="cooldown-tab active" id="personalTab" role="tab" aria-selected="true">◷ Personal</button><button type="button" class="cooldown-tab" id="sharedTab" role="tab" aria-selected="false">⌁ Shared community</button></div>
<section id="profileSettings" class="panel dashboard-panel profile-settings" hidden><div class="panel-heading"><div><span class="dash-eyebrow">YOUR ACCOUNT</span><h2>Profile & settings</h2></div><button class="secondary" id="backToDashboard" type="button">← Back to dashboard</button></div><div class="profile-summary"><div id="profileAvatar" class="profile-avatar">TN</div><div class="profile-summary-copy"><h3 id="profileDisplayName">TCG Nexus member</h3><p id="profileEmail" class="muted"></p><div class="profile-badges"><span id="emailStatusBadge" class="pill">Email status</span><span id="approvalStatusBadge" class="pill">Account status</span></div></div></div><div class="settings-grid"><form id="profileForm" class="settings-card"><h3>Profile details</h3><div class="field"><label for="displayNameInput">Display name</label><input id="displayNameInput" maxlength="40" required placeholder="Your display name"></div><button class="primary full" type="submit">Save display name →</button><p class="muted tiny">Your avatar initials update automatically.</p></form><form id="passwordForm" class="settings-card"><h3>Password & security</h3><div class="field"><label for="newPassword">New password</label><input id="newPassword" type="password" minlength="8" autocomplete="new-password" placeholder="At least 8 characters" required></div><div class="field"><label for="confirmNewPassword">Confirm new password</label><input id="confirmNewPassword" type="password" minlength="8" autocomplete="new-password" placeholder="Repeat new password" required></div><button class="primary full" type="submit">Update password →</button><button class="secondary full" id="sendResetEmail" type="button">Email me a reset link</button></form><section class="settings-card"><h3>Appearance</h3><p class="muted tiny">Choose how TCG Nexus looks on this device.</p><label class="setting-row"><span><b>Light theme</b><small>Use a brighter interface</small></span><input id="themeToggle" type="checkbox" aria-label="Enable light theme"></label></section><section class="settings-card"><h3>Notifications</h3><p class="muted tiny">These preferences are saved on this device; they do not send push notifications.</p><label class="setting-row"><span><b>In-app status messages</b><small>Show success and warning notices</small></span><input id="noticeToggle" type="checkbox" checked></label><label class="setting-row"><span><b>Timer alerts</b><small>Allow optional browser alerts when timers finish</small></span><input id="timerAlertToggle" type="checkbox"></label></section></div><div class="settings-footer"><p class="muted tiny">Signed in securely through Supabase.</p><button class="danger" id="settingsSignOut" type="button">Sign out of TCG Nexus</button></div></section>
<section id="adminPanel" class="panel admin-panel" hidden><div class="between"><div><span class="auth-kicker">OWNER CONTROL</span><h2>🛡️ Account approvals</h2><p class="muted tiny">Only your admin account can approve new members.</p></div><button class="secondary" id="refreshApprovals" type="button">Refresh list</button></div><div id="pendingUsers" class="pending-list"><p class="muted">Loading requests…</p></div></section>
<div class="dashboard-section-heading"><div><span class="dash-eyebrow">AT A GLANCE</span><h2>Your activity overview</h2></div><span class="dash-subtitle">Personal reminders + shared community data</span></div>
<div class="stats"><div class="stat stat-channels"><span class="stat-icon">⌁</span><small>SHARED CHANNELS</small><strong id="channelCount">0</strong><small class="stat-foot">Across your community</small></div><div class="stat"><span class="stat-icon">◷</span><small>CLAIM COOLDOWN</small><strong id="claimStatValue">10:00</strong><small class="stat-foot">Personal timer</small></div><div class="stat"><span class="stat-icon">⌘</span><small>/TCG DROP</small><strong id="cmdStatValue">02:00:00</strong><small class="stat-foot">Personal timer</small></div><div class="stat"><span class="stat-icon">◉</span><small>WINDOWS OPEN</small><strong id="windowCount">0</strong><small class="stat-foot">Earliest window, not a guarantee</small></div></div>
<div class="grid"><div class="dashboard-column">
<section id="personalCooldowns" class="panel dashboard-panel"><div class="panel-heading"><div><span class="dash-eyebrow">JUST FOR YOU</span><h2>Personal cooldowns</h2></div><span class="panel-heading-icon">◷</span></div><div class="coolcard"><div class="between"><b>🃏 Card claim</b><span class="pill" id="claimStatus">READY</span></div><div class="timer" id="claimTimer">00:00</div><p class="muted" id="claimUntil">No active cooldown</p><button class="primary full" id="claimBtn">I claimed a card · start 10m <span aria-hidden="true">→</span></button></div><div class="coolcard"><div class="between"><b>⌨️ /tcg drop command</b><span class="pill" id="cmdStatus">READY</span></div><div class="timer" id="cmdTimer">00:00:00</div><p class="muted" id="cmdUntil">No active cooldown</p><button class="primary full" id="cmdBtn">I used /tcg drop · start 2h <span aria-hidden="true">→</span></button></div><p class="muted tiny">These timers belong only to your account. They do not execute or verify commands in Kaisuki.</p></section>
<section id="updateChannel" class="panel dashboard-panel"><div class="panel-heading"><div><span class="dash-eyebrow">CONTRIBUTE TO THE CREW</span><h2>Update a server channel</h2></div><span class="panel-heading-icon">＋</span></div><form id="dropForm"><div class="field"><label>Server</label><input id="server" required maxlength="60" placeholder="Blue Lock / One Piece / DBZ / Nika / TCG Main"></div><div class="field"><label>Specific channel</label><input id="channel" required maxlength="80" placeholder="#tcg-drops"></div><div class="field"><label>Last actual drop date & time</label><input id="lastDrop" type="datetime-local" required></div><div class="field"><label>Notes (optional)</label><input id="notes" maxlength="120" placeholder="Useful context for the team"></div><button class="primary full">Publish update to everyone <span aria-hidden="true">→</span></button></form><p class="hint">Drop may happen after 61+ minutes; activity-based timing is variable. This is an earliest-window reminder, not a prediction.</p></section>
</div><div class="dashboard-column"><section id="sharedRadar" class="panel dashboard-panel"><div class="panel-heading"><div><span class="dash-eyebrow">COMMUNITY ACTIVITY</span><h2>Shared server radar</h2></div><span class="pill live">● LIVE SYNC</span></div><div id="radarSummary" class="radar-summary" aria-live="polite"></div><div class="radar-toolbar"><label class="radar-search"><span aria-hidden="true">⌕</span><input id="radarSearch" type="search" placeholder="Search servers or channels…" aria-label="Search servers and channels"></label><select id="radarFilter" aria-label="Filter radar channels"><option value="all">All channels</option><option value="trained">Has drop history</option><option value="ready">Estimate window passed</option><option value="learning">Still learning</option></select><button id="clearRadarFilters" class="secondary" type="button">Reset</button></div><p class="radar-footnote"><span>ⓘ</span> Estimates learn from recorded drops. Discord chat/card activity is not directly monitored unless a bot or integration is connected.</p><div id="channels" class="channelList"></div></section><section class="panel dashboard-panel access-panel"><div class="panel-heading"><div><span class="dash-eyebrow">ACCOUNT & SYNC</span><h2>Access status</h2></div><span class="panel-heading-icon">✓</span></div><p id="accessStatus" class="muted"></p><div class="access-note"><span>↗</span><p class="muted tiny">Signed-in users share server/channel records. Your claim and command cooldowns remain private to your login.</p></div></section></div></div>
<div class="dashboard-bottom-note"><span>◇</span> Built for your crew. Powered by real-time sync.</div>
</div>`;
}
function notice(msg,kind='info'){ const box=$('#notice'); if(localStorage.getItem('tcg-notices')==='off'){box.innerHTML='';return;} box.innerHTML=`<div class="notice ${kind}">${html(msg)}</div>`; }
function setAuthMode(mode){
 const signup=mode==='signup';
 $('#tabSignIn').classList.toggle('active',!signup);$('#tabSignUp').classList.toggle('active',signup);
 $('#tabSignIn').setAttribute('aria-selected',String(!signup));$('#tabSignUp').setAttribute('aria-selected',String(signup));
 $('#authTitle').textContent=signup?'Create your account':'Welcome back';
 $('#authSubtitle').textContent=signup?'Join your TCG community and keep everything in sync.':'Log in to continue to TCG Nexus.';
 $('#authSubmitText').textContent=signup?'Create account':'Log in to Nexus';
 $('#confirmPasswordField').hidden=!signup;$('#confirmPassword').required=signup;
 $('#password').autocomplete=signup?'new-password':'current-password';
 $('#authSwitchCopy').innerHTML=signup?'Already have an account? <button type="button" id="switchSignIn">Log in instead</button>':'New to TCG Nexus? <button type="button" id="switchSignUp">Create an account</button>';
 const switchButton=$('#switchSignUp')||$('#switchSignIn');if(switchButton)switchButton.onclick=()=>setAuthMode(signup?'signin':'signup');
}
const infoContent={
 home:['Welcome to TCG Nexus','Your shared TCG companion for tracking cooldowns and keeping server updates in sync.'],
 about:['About TCG Nexus','TCG Nexus helps your group keep track of shared server/channel drop timing and personal cooldown reminders in one place.'],
 features:['Features','• Shared server and channel records\n• Live updates across signed-in users\n• Personal claim and /tcg drop cooldowns\n• Mobile-friendly access'],
 help:['Help center','Having trouble signing in? Check that your email and password are correct. If you cannot access the workspace, contact the person who shared the TCG Nexus link with you.'],
 contact:['Contact & access','For account access or workspace help, contact the person who invited you to use this TCG Nexus workspace. No support email or social account has been configured in this version.'],
 issue:['Report an issue','If something is not working, note what you clicked, what you expected, and any error message. Share those details with the workspace owner.'],
 privacy:['Privacy overview','Your account uses Supabase authentication. Shared server/channel records are visible to signed-in users; personal cooldowns are associated with your account. Avoid entering sensitive personal information.'],
 terms:['Terms of use','Use TCG Nexus respectfully and keep shared drop information accurate. Cooldown windows are reminders, not guarantees that a drop will occur.'],
 community:['Community guidelines','Be respectful, avoid posting private information, and keep shared records useful and accurate.']
};
function openInfo(key){const item=infoContent[key]||infoContent.about;$('#infoTitle').textContent=item[0];$('#infoBody').textContent=item[1];$('#infoModal').hidden=false;}
async function init(){
 shell();
 const homeViewSelectors=['.dashboard-welcome','#homeQuicknav','#adminPanel','.dashboard-section-heading','.stats','.grid','.dashboard-bottom-note'];
 function showDashboardView(view){const settings=view==='settings';homeViewSelectors.forEach(sel=>{const el=$(sel);if(el)el.hidden=settings;});$('#cooldownTabs').hidden=settings;$('#profileSettings').hidden=!settings;window.scrollTo({top:0,behavior:'smooth'});}
 $('#openProfileSettings').onclick=()=>showDashboardView('settings');
 if($('#navProfileSettings'))$('#navProfileSettings').onclick=()=>{document.querySelectorAll('.nav-dropdown[open]').forEach(x=>x.open=false);showDashboardView('settings');};
 if($('#navSignOut'))$('#navSignOut').onclick=async()=>{const {error}=await supabase.auth.signOut();if(error)notice('Sign out failed: '+error.message,'warn');};
 function setCooldownTab(which){const personal=which==='personal';$('#personalCooldowns').hidden=!personal;$('#sharedRadar').hidden=personal;$('.access-panel').hidden=personal;$('.grid').classList.add('single-focus');$('#personalTab').classList.toggle('active',personal);$('#sharedTab').classList.toggle('active',!personal);$('#personalTab').setAttribute('aria-selected',String(personal));$('#sharedTab').setAttribute('aria-selected',String(!personal));}
 $('#personalTab').onclick=()=>setCooldownTab('personal');$('#sharedTab').onclick=()=>setCooldownTab('shared');
 document.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>{const key=b.dataset.jump;document.querySelectorAll('.nav-dropdown[open]').forEach(x=>x.open=false);showDashboardView('home');if(key==='personal')setCooldownTab('personal');if(key==='shared')setCooldownTab('shared');const target=key==='personal'?$('#personalCooldowns'):key==='shared'?$('#sharedRadar'):$('#updateChannel');target?.scrollIntoView({behavior:'smooth',block:'start'});});
 $('#backToDashboard').onclick=()=>showDashboardView('home');
 document.querySelectorAll('[data-home-link]').forEach(a=>a.addEventListener('click',()=>showDashboardView('home')));
 document.querySelectorAll('[data-home]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();showDashboardView('home');setCooldownTab('personal');window.scrollTo({top:0,behavior:'smooth'});}));
 document.querySelectorAll('[data-info]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();openInfo(a.dataset.info)}));
 $('#closeInfo').onclick=$('#infoDone').onclick=()=>$('#infoModal').hidden=true;
 $('#infoModal').addEventListener('click',e=>{if(e.target===$('#infoModal'))$('#infoModal').hidden=true});
 $('#tabSignIn').onclick=()=>setAuthMode('signin');$('#tabSignUp').onclick=()=>setAuthMode('signup');setAuthMode('signin');
 $('#togglePassword').onclick=()=>{const field=$('#password'),show=field.type==='password';field.type=show?'text':'password';$('#togglePassword').textContent=show?'◎':'◉';$('#togglePassword').setAttribute('aria-label',show?'Hide password':'Show password')};
 $('#forgotPassword').onclick=async()=>{const email=$('#email').value.trim();if(!email)return notice('Enter your email address first, then choose Forgot password.','warn');if(!configured)return notice('Connect Supabase before resetting a password.','warn');const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:location.origin});if(error)notice(error.message,'warn');else notice('If an account exists for this email, a password-reset link will be sent.','ok')};
 if(!configured){notice('Setup required: add your Supabase project URL and publishable/anon key to Vercel Environment Variables, then deploy.','warn');$('#authSubmit').disabled=true;return;}
 const {data:{session}}=await supabase.auth.getSession();
 supabase.auth.onAuthStateChange((_event,s)=>{if(s?.user)loadUser(s.user);else{user=null;profile=null;$('#dashboard').hidden=true;$('#auth').hidden=false;$('#userbox').innerHTML='';}});
 if(session?.user)await loadUser(session.user);
 $('#authForm').onsubmit=async e=>{e.preventDefault();const email=$('#email').value.trim(),password=$('#password').value,signup=!$('#confirmPasswordField').hidden;
   if(signup){if(password.length<8)return notice('Use a password of at least 8 characters.','warn');if(password!==$('#confirmPassword').value)return notice('The passwords do not match.','warn');const {data,error}=await supabase.auth.signUp({email,password,options:{data:{display_name:email.split('@')[0]}}});if(error)notice(authErrorMessage(error,'signup'),'warn');else if(data.session)notice('Account created. Your access is pending owner approval. You can enter after the owner approves your account.','ok');else notice('Account created. Step 1 of 2: verify your email using the link in your inbox. Step 2: wait for the owner to approve your account, then sign in.','ok');}
   else {const {error}=await supabase.auth.signInWithPassword({email,password});if(error)notice(authErrorMessage(error,'login'),'warn');}
 };
}
async function loadUser(u){
 user=u; $('#userbox').innerHTML=`<span>${html(u.email)}</span><button id="signOut">Sign out</button>`;$('#signOut').onclick=()=>supabase.auth.signOut();
 const {data:p,error}=await supabase.from('profiles').select('*').eq('id',u.id).maybeSingle();
 if(error){notice('Could not load profile: '+error.message,'warn');return}
 profile=p;
 if(!p?.approved && !p?.is_admin){$('#dashboard').hidden=true;$('#auth').hidden=false;$('#adminPanel').hidden=true;notice('Access not active yet: your account is waiting for owner approval. Once approved, sign in again to continue.','warn');return}
 $('#auth').hidden=true; $('#dashboard').hidden=false;
 const firstName=(p?.display_name||u.user_metadata?.display_name||u.email?.split("@")[0]||"player").trim().split(/\s+/)[0];
 if($("#welcomeHeading"))$("#welcomeHeading").innerHTML=`Welcome back, <span>${html(firstName)}.</span>`;
 $('#adminPanel').hidden=!p?.is_admin;
 if($('#profileSettings'))$('#profileSettings').hidden=true;
 if($('#personalTab')){ $('#personalCooldowns').hidden=true; $('#sharedRadar').hidden=false; $('.access-panel').hidden=true; $('.grid').classList.add('single-focus'); $('#personalTab').classList.remove('active'); $('#sharedTab').classList.add('active'); $('#personalTab').setAttribute('aria-selected','false'); $('#sharedTab').setAttribute('aria-selected','true'); }
 ['.dashboard-welcome','#homeQuicknav','.dashboard-section-heading','.stats','.grid','.dashboard-bottom-note'].forEach(sel=>{const el=$(sel);if(el)el.hidden=false;});
 if(p?.is_admin){$('#refreshApprovals').onclick=loadPendingUsers;await loadPendingUsers();}
 notice(p?.is_admin?'Welcome, owner. You can approve new accounts below.':'You are signed in. Shared channel updates sync live across TCG Nexus users.','ok');
 $('#accessStatus').textContent=`Signed in as: ${u.email}`;
 setupProfileSettings(u,p);
 await Promise.all([loadCooldown(),loadChannels()]);
 if(realtime) supabase.removeChannel(realtime);
 realtime=supabase.channel('shared-server-channels').on('postgres_changes',{event:'*',schema:'public',table:'server_channels'},()=>loadChannels()).on('postgres_changes',{event:'*',schema:'public',table:'drop_events'},()=>loadChannels()).subscribe();
 $('#claimBtn').onclick=()=>startCooldown('claim');
 $('#lastDrop').value=(()=>{const d=new Date(Date.now()-new Date().getTimezoneOffset()*60000);return d.toISOString().slice(0,16)})();
 $('#cmdBtn').onclick=()=>startCooldown('command');
 $('#dropForm').onsubmit=saveDrop;
}
function initials(name,email){const source=(name||email||'TCG Nexus').trim();const parts=source.includes(' ')?source.split(/\s+/):[source.split('@')[0]];return parts.slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'TN';}
function setupProfileSettings(u,p){
 const displayName=u.user_metadata?.display_name||p?.display_name||u.email?.split('@')[0]||'TCG Nexus member';
 $('#profileDisplayName').textContent=displayName;$('#profileEmail').textContent=u.email||'';$('#profileAvatar').textContent=initials(displayName,u.email);$('#displayNameInput').value=displayName;
 const verified=!!u.email_confirmed_at;$('#emailStatusBadge').textContent=verified?'EMAIL VERIFIED':'EMAIL NOT VERIFIED';$('#emailStatusBadge').className='pill '+(verified?'ready':'wait');
 const approved=!!(p?.approved||p?.is_admin);$('#approvalStatusBadge').textContent=approved?'APPROVED':'PENDING APPROVAL';$('#approvalStatusBadge').className='pill '+(approved?'ready':'wait');
 document.body.classList.toggle('light-theme',localStorage.getItem('tcg-theme')==='light');$('#themeToggle').checked=localStorage.getItem('tcg-theme')==='light';$('#noticeToggle').checked=localStorage.getItem('tcg-notices')!=='off';$('#timerAlertToggle').checked=localStorage.getItem('tcg-timer-alerts')==='on';
 $('#profileForm').onsubmit=async e=>{e.preventDefault();const name=$('#displayNameInput').value.trim();if(!name)return notice('Enter a display name first.','warn');const submit=$('#profileForm button[type="submit"]');submit.disabled=true;const original=submit.textContent;submit.textContent='Saving…';try{let {data:{session}}=await supabase.auth.getSession();if(!session){const refreshed=await supabase.auth.refreshSession();session=refreshed.data?.session||null;if(refreshed.error&&!session){notice('Your login session expired. Please sign out and log in again, then save your profile.','warn');return;}}if(!session){notice('No active login session found. Please log in again before saving profile changes.','warn');return;}const {data,error}=await supabase.auth.updateUser({data:{display_name:name}});if(error){notice('Could not save display name: '+error.message,'warn');return;}user=data.user||user;profile={...profile,display_name:name};$('#profileDisplayName').textContent=name;$('#profileAvatar').textContent=initials(name,user.email);$('#welcomeHeading').innerHTML='Welcome back, <span>'+html(name.split(/\\s+/)[0])+'.</span>';notice('Display name updated.','ok');}catch(err){notice('Could not save display name. Please check your connection and try again.','warn');}finally{submit.disabled=false;submit.textContent=original;}};
 $('#passwordForm').onsubmit=async e=>{e.preventDefault();const a=$('#newPassword').value,b=$('#confirmNewPassword').value;if(a.length<8)return notice('Use at least 8 characters for the new password.','warn');if(a!==b)return notice('The new passwords do not match.','warn');const {error}=await supabase.auth.updateUser({password:a});if(error){notice('Password update failed: '+error.message,'warn');return;}$('#passwordForm').reset();notice('Password updated successfully.','ok');};
 $('#sendResetEmail').onclick=async()=>{const {error}=await supabase.auth.resetPasswordForEmail(u.email,{redirectTo:location.origin});if(error)notice('Could not send reset link: '+error.message,'warn');else notice('If the account can receive reset emails, a password-reset link has been sent.','ok');};
 $('#themeToggle').onchange=e=>{localStorage.setItem('tcg-theme',e.target.checked?'light':'dark');document.body.classList.toggle('light-theme',e.target.checked);};
 $('#noticeToggle').onchange=e=>{localStorage.setItem('tcg-notices',e.target.checked?'on':'off');if(!e.target.checked)$('#notice').innerHTML='';else notice('In-app status messages enabled.','ok');};
 $('#timerAlertToggle').onchange=async e=>{if(e.target.checked && 'Notification' in window){const permission=await Notification.requestPermission();if(permission!=='granted'){e.target.checked=false;localStorage.setItem('tcg-timer-alerts','off');notice('Browser notifications were not allowed. You can enable them in browser settings.','warn');return;}}else if(e.target.checked && !('Notification' in window)){e.target.checked=false;notice('This browser does not support notifications.','warn');return;}localStorage.setItem('tcg-timer-alerts',e.target.checked?'on':'off');notice(e.target.checked?'Timer completion alerts enabled on this device.':'Timer alerts disabled.','info');};
 $('#settingsSignOut').onclick=async()=>{const {error}=await supabase.auth.signOut();if(error)notice('Sign out failed: '+error.message,'warn');};
}
async function loadPendingUsers(){
 if(!profile?.is_admin)return;
 const list=$('#pendingUsers');list.innerHTML='<p class="muted">Loading requests…</p>';
 const {data,error}=await supabase.from('profiles').select('id,email,display_name,approved,created_at').eq('approved',false).order('created_at',{ascending:true});
 if(error){list.innerHTML=`<p class="muted">Could not load requests: ${html(error.message)}</p>`;return;}
 if(!data?.length){list.innerHTML='<div class="empty">No pending accounts. You are all caught up.</div>';return;}
 list.innerHTML=data.map(x=>`<article class="pending-user"><div><b>${html(x.display_name||'New member')}</b><p>${html(x.email||'Email unavailable')}</p><small>Requested ${html(time(x.created_at))}</small></div><button class="primary approve-btn" data-approve="${html(x.id)}" type="button">Approve</button></article>`).join('');
 list.querySelectorAll('[data-approve]').forEach(btn=>btn.onclick=async()=>{btn.disabled=true;btn.textContent='Approving…';const {error}=await supabase.from('profiles').update({approved:true}).eq('id',btn.dataset.approve);if(error){notice('Approval failed: '+error.message,'warn');btn.disabled=false;btn.textContent='Approve';return;}notice('Account approved. The user can now access TCG Nexus.','ok');await loadPendingUsers();});
}
async function loadCooldown(){const {data,error}=await supabase.from('user_cooldowns').select('*').eq('user_id',user.id).maybeSingle();if(error){notice('Cooldown data error: '+error.message,'warn');return}cooldown=data||{claim_until:null,command_until:null};renderTimers();}
async function startCooldown(kind){const until=new Date(Date.now()+(kind==='claim'?10*60*1000:2*60*60*1000)).toISOString();const patch={user_id:user.id,updated_at:new Date().toISOString()};patch[kind==='claim'?'claim_until':'command_until']=until;
 // Upsert only the chosen cooldown, preserving the other current timer.
 patch.claim_until=kind==='claim'?until:cooldown.claim_until;patch.command_until=kind==='command'?until:cooldown.command_until;
 const {error}=await supabase.from('user_cooldowns').upsert(patch,{onConflict:'user_id'});if(error){notice('Could not save cooldown: '+error.message,'warn');return}await loadCooldown();notice(kind==='claim'?'Your 10-minute claim cooldown started.':'Your 2-hour /tcg drop cooldown started.','ok');}
function renderTimers(){if(!$('#claimTimer'))return;const c=msleft(cooldown.claim_until),d=msleft(cooldown.command_until);if($("#claimStatValue"))$("#claimStatValue").textContent=c?fmt(c):"READY";if($("#cmdStatValue"))$("#cmdStatValue").textContent=d?fmt(d,true):"READY";$('#claimTimer').textContent=fmt(c);$('#cmdTimer').textContent=fmt(d,true);if($('#claimStatValue'))$('#claimStatValue').textContent=c?fmt(c):'READY';if($('#cmdStatValue'))$('#cmdStatValue').textContent=d?fmt(d,true):'READY';$('#claimStatus').textContent=c?'COOLDOWN':'READY';$('#cmdStatus').textContent=d?'COOLDOWN':'READY';$('#claimUntil').textContent=c?'Ready at '+time(cooldown.claim_until):'No active cooldown';$('#cmdUntil').textContent=d?'Ready at '+time(cooldown.command_until):'No active cooldown';$('#claimTimer').className='timer '+(c?'wait':'ready');$('#cmdTimer').className='timer '+(d?'wait':'ready');if(localStorage.getItem('tcg-timer-alerts')==='on'&&'Notification' in window&&Notification.permission==='granted'){if(previousTimerState.claim>0&&c===0)new Notification('TCG Nexus',{body:'Your card claim cooldown is ready.'});if(previousTimerState.command>0&&d===0)new Notification('TCG Nexus',{body:'/tcg drop cooldown is ready.'});}previousTimerState={claim:c,command:d};}
async function loadChannels(){
 const {data,error}=await supabase.from('server_channels').select('*').order('server_name').order('channel_name');
 if(error){notice('Could not load shared channels: '+error.message,'warn');return;}
 channels=data||[];
 const historyResult=await supabase.from('drop_events').select('id,channel_id,occurred_at,recorded_by').order('occurred_at',{ascending:false}).limit(1000);
 historyAvailable=!historyResult.error;
 dropHistory=historyAvailable?(historyResult.data||[]):[];
 renderChannels();
}
function predictionFor(channel){
 const timestamps=[...new Set([...dropHistory.filter(e=>e.channel_id===channel.id).map(e=>e.occurred_at),channel.last_drop_at].filter(Boolean).map(v=>new Date(v).getTime()).filter(Number.isFinite))].sort((a,b)=>b-a).slice(0,8);
 const intervals=[];
 for(let i=0;i<timestamps.length-1;i++){const gap=timestamps[i]-timestamps[i+1];if(gap>=5*60000&&gap<=24*60*60000)intervals.push(gap);}
 const interval=intervals.length?Math.round(intervals.reduce((a,b)=>a+b,0)/intervals.length):61*60000;
 const confidence=intervals.length>=4?'HIGH':intervals.length>=2?'MEDIUM':'LEARNING';
 return {timestamps,interval,confidence,intervals:intervals.length,nextAt:timestamps.length?timestamps[0]+interval:0};
}
function renderChannels(){
 const now=Date.now();
 $('#channelCount').textContent=channels.length;
 const predictions=channels.map(c=>({channel:c,prediction:predictionFor(c)}));
 const search=($('#radarSearch')?.value||'').trim().toLowerCase();
 const filter=$('#radarFilter')?.value||'all';
 const visible=predictions.filter(({channel:c,prediction:p})=>{
  const matchesSearch=!search||[c.server_name,c.channel_name,c.notes].some(v=>String(v||'').toLowerCase().includes(search));
  const passed=!!p.nextAt&&now>=p.nextAt;
  const matchesFilter=filter==='all'||(filter==='trained'&&p.intervals>0)||(filter==='ready'&&passed)||(filter==='learning'&&p.intervals===0);
  return matchesSearch&&matchesFilter;
 });
 $('#windowCount').textContent=predictions.filter(x=>x.prediction.nextAt&&now>=x.prediction.nextAt).length;
 const trained=predictions.filter(x=>x.prediction.intervals>0).length;
 if($('#radarSummary'))$('#radarSummary').innerHTML=`<div class="radar-metric"><span class="radar-metric-icon">⌁</span><div><small>TRACKED CHANNELS</small><b>${channels.length}</b></div></div><div class="radar-metric"><span class="radar-metric-icon">◷</span><div><small>HISTORY-TRAINED</small><b>${trained} / ${channels.length}</b></div></div><div class="radar-metric"><span class="radar-metric-icon">↻</span><div><small>DROP EVENTS</small><b>${dropHistory.length}</b></div></div>`;
 $('#channels').innerHTML=visible.length?visible.map(({channel:c,prediction:p})=>{
  const left=p.nextAt-now,ready=p.nextAt&&left<=0,level=p.intervals>=4?'high':p.intervals>=2?'medium':'learning';
  const intervalLabel=p.intervals?fmt(p.interval,true):'61m starting estimate';
  const confidence=p.intervals>=4?'HIGH':p.intervals>=2?'MEDIUM':'LEARNING';
  return `<article class="channel radar-channel"><div class="between"><b>${html(c.server_name)} <span>/</span> ${html(c.channel_name)}</b><span class="pill ${ready?'ready':p.nextAt?'wait':''}">${!p.nextAt?'NO BASELINE':ready?'ESTIMATE PASSED':'TRACKING'}</span></div><div class="radar-estimate-row"><div><small class="radar-label">NEXT DROP ESTIMATE</small><div class="timer ${ready?'ready':'wait'}">${!p.nextAt?'—':ready?'POSSIBLE NOW':fmt(left,true)}</div></div><div class="confidence ${level}"><span></span>${confidence}</div></div><div class="radar-detail-grid"><div><small>Last actual drop</small><b>${html(time(c.last_drop_at))}</b></div><div><small>Typical interval</small><b>${html(intervalLabel)}</b></div><div><small>Estimated local time</small><b>${p.nextAt?html(new Date(p.nextAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})):'Needs a drop record'}</b></div></div>${c.notes?`<p class="muted">${html(c.notes)}</p>`:''}<p class="radar-explain">${p.intervals?'Estimate from '+p.intervals+' recent interval(s). Real drops can vary.':'Record more actual drops to train this channel estimate. The 61-minute value is only a starting baseline.'}</p><div class="actions"><button class="primary" data-drop-now="${html(c.id)}" type="button">✓ Drop happened now</button><button data-edit="${html(c.id)}" type="button">Edit</button><button class="danger" data-delete="${html(c.id)}" type="button">Delete</button></div></article>`;
 }).join(''):(channels.length?'<div class="empty">No channels match these filters. Try another search or reset the filters.</div>':'<div class="empty">No shared channels yet. Add the first server/channel to start the radar.</div>');
 if($('#radarSearch')&&!$('#radarSearch').dataset.bound){$('#radarSearch').dataset.bound='1';$('#radarSearch').addEventListener('input',renderChannels);$('#radarFilter').addEventListener('change',renderChannels);$('#clearRadarFilters').onclick=()=>{$('#radarSearch').value='';$('#radarFilter').value='all';renderChannels();};}
 $('#channels').querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>{const c=channels.find(x=>x.id===b.dataset.edit);if(!c)return;$('#server').value=c.server_name;$('#channel').value=c.channel_name;$('#lastDrop').value=c.last_drop_at?new Date(new Date(c.last_drop_at).getTime()-new Date(c.last_drop_at).getTimezoneOffset()*60000).toISOString().slice(0,16):'';$('#notes').value=c.notes||'';$('#dropForm').dataset.editId=c.id;$('#dropForm').scrollIntoView({behavior:'smooth'});});
 $('#channels').querySelectorAll('[data-drop-now]').forEach(b=>b.onclick=async()=>{const c=channels.find(x=>x.id===b.dataset.dropNow);if(!c)return;b.disabled=true;b.textContent='Recording…';const now=new Date().toISOString();const {error}=await supabase.from('server_channels').update({last_drop_at:now,updated_by:user.id,updated_at:now}).eq('id',c.id);if(error){notice('Could not record drop: '+error.message,'warn');b.disabled=false;b.textContent='✓ Drop happened now';return;}const historyResult=await supabase.from('drop_events').insert({channel_id:c.id,occurred_at:now,recorded_by:user.id});await loadChannels();notice(historyResult.error?'Drop saved for everyone. Apply the included Supabase migration to enable history-based learning.':'Actual drop recorded. Shared radar and learning history updated.',historyResult.error?'warn':'ok');});
 $('#channels').querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('Delete this shared channel for everyone?'))return;const {error}=await supabase.from('server_channels').delete().eq('id',b.dataset.delete);if(error)notice(error.message,'warn');else await loadChannels();});
}async function saveDrop(e){
 e.preventDefault();
 const server=$('#server').value.trim(),channel=$('#channel').value.trim(),raw=$('#lastDrop').value;
 if(!raw)return;
 const occurredAt=new Date(raw).toISOString();
 const patch={server_name:server,channel_name:channel,last_drop_at:occurredAt,notes:$('#notes').value.trim(),updated_by:user.id,updated_at:new Date().toISOString()};
 const id=$('#dropForm').dataset.editId;
 let savedId=id;
 if(id){const {error}=await supabase.from('server_channels').update(patch).eq('id',id);if(error){notice('Could not publish shared update: '+error.message,'warn');return;}}
 else {const {data,error}=await supabase.from('server_channels').upsert(patch,{onConflict:'server_name,channel_name'}).select('id').single();if(error){notice('Could not publish shared update: '+error.message,'warn');return;}savedId=data?.id;}
 let historyError=null,historyAdded=false;
 const previous=id?channels.find(c=>c.id===id):null;
 const isNewDrop=!previous||!previous.last_drop_at||new Date(previous.last_drop_at).getTime()!==new Date(occurredAt).getTime();
 if(savedId&&isNewDrop){const existing=await supabase.from('drop_events').select('id').eq('channel_id',savedId).eq('occurred_at',occurredAt).limit(1);if(existing.error){historyError=existing.error;}else if(!existing.data?.length){const result=await supabase.from('drop_events').insert({channel_id:savedId,occurred_at:occurredAt,recorded_by:user.id});historyError=result.error;historyAdded=!result.error;}}
 delete $('#dropForm').dataset.editId;$('#dropForm').reset();await loadChannels();
 notice(historyError?'Shared channel saved, but history could not be updated. Check the drop history table and permissions.':historyAdded?'Shared channel update published and actual drop added to history.':'Shared channel details updated without adding a duplicate drop event.',historyError?'warn':'ok');
}
init();tickHandle=setInterval(()=>{renderTimers();renderChannels()},1000);
