// ==========================================
// ⚠️ 超重要：ここにGASで発行したURLを貼り付けます
// ==========================================
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbxA7rzs1QyhAhA8GQgB97yEMppgvAZVKtFI7EYxY_PfoaAkTBlsnF24_xmKka9Ld8rLAw/exec";

let currentThreadId = null; 
let appData = { consultations: [], messages: [], planners: [] }; 
let currentUser = null; 
let currentGeneratedSummary = ""; 
let currentTab = 'my'; 

window.onload = () => { if(GAS_API_URL.includes("ここに")) alert("GAS_API_URL を設定してください！"); loadInitialData(); };

function login(role, id, name) {
    currentUser = { role: role, id: id, name: name };
    document.getElementById('login-screen').classList.add('hidden');
    const roleDisplay = document.getElementById('user-role-display');
    const aiBtn = document.getElementById('ai-summary-btn');
    const newBtn = document.getElementById('new-thread-btn');
    const tabMy = document.getElementById('tab-my');
    const tabActive = document.getElementById('tab-active');
    
    if(role === 'planner') {
        roleDisplay.innerHTML = `<i class="fa-solid fa-user-tie"></i> プランナーモード`;
        roleDisplay.className = "bg-blue-800 rounded-full px-4 py-1 text-sm font-medium flex items-center gap-2";
        aiBtn.classList.remove('hidden'); aiBtn.classList.add('flex');
        newBtn.classList.add('hidden');
        tabMy.textContent = "💬 すべて"; 
        document.getElementById('tab-public').textContent = "📖 公開済み";
        
        tabActive.classList.remove('hidden'); // プランナーには「未完了」タブを表示
        switchTab('active'); // プランナーは「未完了」タブを初期表示
    } else {
        roleDisplay.innerHTML = `<i class="fa-solid fa-chalkboard-user"></i> 先生モード (${name})`;
        roleDisplay.className = "bg-green-600 rounded-full px-4 py-1 text-sm font-medium flex items-center gap-2";
        aiBtn.classList.add('hidden'); aiBtn.classList.remove('flex');
        newBtn.classList.remove('hidden');
        tabMy.textContent = "💬 自分の相談";
        document.getElementById('tab-public').textContent = "📖 みんなの事例";
        
        tabActive.classList.add('hidden'); // 先生には隠す
        switchTab('my'); // 先生は「自分の相談」タブを初期表示
    }
}

function logout() { location.reload(); }

function switchTab(tab) {
    currentTab = tab;
    const tabActive = document.getElementById('tab-active');
    const tabMy = document.getElementById('tab-my'); 
    const tabPub = document.getElementById('tab-public');
    
    const activeClass = "flex-1 py-2 text-blue-600 border-b-2 border-blue-600 transition truncate px-1 block";
    const inactiveClass = "flex-1 py-2 text-gray-400 border-b-2 border-transparent hover:text-gray-600 transition truncate px-1 block";
    
    if (tabActive) tabActive.className = (tab === 'active') ? activeClass : inactiveClass;
    tabMy.className = (tab === 'my') ? activeClass : inactiveClass;
    tabPub.className = (tab === 'public') ? activeClass : inactiveClass;
    
    // 先生の場合はタブを隠す設定を維持
    if (currentUser && currentUser.role !== 'planner') {
        tabActive.classList.add('hidden');
        tabActive.classList.remove('block');
    }

    currentThreadId = null;
    document.getElementById('current-thread-title').textContent = "スレッドを選択してください";
    document.getElementById('thread-status-select').classList.add('hidden');
    document.getElementById('main-chat-area').classList.remove('hidden'); document.getElementById('main-chat-area').classList.add('flex');
    document.getElementById('main-qa-area').classList.add('hidden'); document.getElementById('main-qa-area').classList.remove('flex');
    document.getElementById('view-toggle-btns').classList.add('hidden');
    document.getElementById('chat-timeline').innerHTML = `<div class="flex justify-center items-center h-full text-gray-400"><span class="text-sm">左側のリストから選択してください</span></div>`;
    document.getElementById('message-input').disabled = true; document.getElementById('send-button').disabled = true;
    
    if(appData.consultations.length > 0) renderThreadList();
}

async function loadInitialData() {
    try {
        const response = await fetch(GAS_API_URL);
        const result = await response.json();
        if(result.status === "success") {
            appData.consultations = result.data.consultations || [];
            appData.messages = result.data.messages || [];
            appData.planners = result.data.planners || []; 
            if(currentUser) renderThreadList();
        }
    } catch (error) { console.error("通信エラー:", error); }
}

function renderThreadList() {
    const threadList = document.getElementById('thread-list');
    threadList.innerHTML = ''; 
    const searchWord = document.getElementById('search-input').value.toLowerCase();
    
    let displayList = [...appData.consultations]; 
    
    // ★ リストの絞り込み条件アップデート
    if (currentTab === 'active') {
        // プランナー専用「未完了」タブ：ステータスが「完了」以外のものを表示
        displayList = displayList.filter(c => c['ステータス'] !== '完了');
    } else if (currentTab === 'my') {
        // 先生なら自分のものだけ。プランナーなら全件（絞り込みなし）
        if (currentUser.role === 'teacher') displayList = displayList.filter(c => c['作成者(先生ID)'] === currentUser.id);
    } else if (currentTab === 'public') { 
        // みんなの事例：AI要約済み かつ ステータスが完了 かつ テキストが存在するもののみ
        displayList = displayList.filter(c => 
            c['公開ステータス'] === 'Summary' && 
            c['ステータス'] === '完了' && 
            c['公開用テキスト'] && c['公開用テキスト'].trim() !== ''
        ); 
    }

    if (searchWord) { displayList = displayList.filter(c => (c['タイトル/概要'] || '').toLowerCase().includes(searchWord) || (c['公開用テキスト'] || '').toLowerCase().includes(searchWord)); }

    displayList.sort((a, b) => {
        if (currentUser.role === 'planner' && (currentTab === 'my' || currentTab === 'active')) {
            const aUnread = appData.messages.some(m => m['紐づくスレッドID'] === a['スレッドID'] && m['送信者区分'] === '先生' && m['既読ステータス'] !== '既読');
            const bUnread = appData.messages.some(m => m['紐づくスレッドID'] === b['スレッドID'] && m['送信者区分'] === '先生' && m['既読ステータス'] !== '既読');
            if (aUnread && !bUnread) return -1;
            if (!aUnread && bUnread) return 1;
        }
        return b['スレッドID'].localeCompare(a['スレッドID']);
    });

    if(displayList.length === 0) { threadList.innerHTML = `<div class="text-gray-500 text-center p-4 text-sm">該当するデータがありません。</div>`; return; }

    displayList.forEach(cons => {
        const isSelected = (cons['スレッドID'] === currentThreadId) ? 'bg-blue-100 border-l-4 border-blue-500' : 'hover:bg-blue-50 border-l-4 border-transparent';
        const icon = currentTab === 'public' ? '📖' : '💬';
        
        let unreadBadge = '';
        let responderBadge = '';
        if (currentUser.role === 'planner' && (currentTab === 'my' || currentTab === 'active')) {
            const hasUnread = appData.messages.some(m => m['紐づくスレッドID'] === cons['スレッドID'] && m['送信者区分'] === '先生' && m['既読ステータス'] !== '既読');
            if (hasUnread) unreadBadge = `<span class="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1 animate-pulse shrink-0">新着</span>`;

            const threadMsgs = appData.messages.filter(m => m['紐づくスレッドID'] === cons['スレッドID']);
            const plannerMsgs = threadMsgs.filter(m => m['送信者区分'] === 'プランナー');
            
            if (plannerMsgs.length > 0) {
                plannerMsgs.sort((a, b) => new Date(b['送信日時']) - new Date(a['送信日時']));
                const lastPlannerId = plannerMsgs[0]['送信者ID'];
                const plannerObj = (appData.planners && appData.planners.length > 0) ? appData.planners.find(p => p['プランナーID'] === lastPlannerId) : null;
                const plannerName = plannerObj ? plannerObj['氏名'] : lastPlannerId;
                responderBadge = `<span class="bg-blue-100 text-blue-700 border border-blue-200 text-[10px] px-1.5 py-0.5 rounded ml-1 shrink-0"><i class="fa-solid fa-user-check"></i> ${plannerName}</span>`;
            } else {
                responderBadge = `<span class="bg-gray-100 text-gray-500 border border-gray-200 text-[10px] px-1.5 py-0.5 rounded ml-1 shrink-0">未対応</span>`;
            }
        }

        let statusColor = "bg-gray-100 text-gray-600";
        if (cons['ステータス'] === '対応中') statusColor = "bg-yellow-100 text-yellow-700";
        if (cons['ステータス'] === '完了') statusColor = "bg-green-100 text-green-700";

        const html = `
        <div onclick="selectThread('${cons['スレッドID']}')" class="p-3 border-b border-gray-100 cursor-pointer transition mb-1 rounded ${isSelected}">
            <div class="font-bold text-sm text-gray-700 mb-1 flex items-center flex-wrap gap-y-1">
                ${icon} <span class="truncate ml-1 max-w-[150px]">${cons['タイトル/概要'] || 'タイトルなし'}</span> 
                ${unreadBadge} ${responderBadge}
            </div>
            <div class="flex justify-between items-center mt-1">
                <span class="text-xs text-gray-500">ID: ${cons['スレッドID']}</span>
                <span class="${statusColor} text-[10px] px-2 py-0.5 rounded-full font-bold shadow-sm">${cons['ステータス']}</span>
            </div>
        </div>`;
        threadList.insertAdjacentHTML('beforeend', html);
    });
}

function selectThread(threadId) {
    currentThreadId = threadId;
    const targetThread = appData.consultations.find(c => c['スレッドID'] === threadId);
    document.getElementById('current-thread-title').textContent = targetThread ? targetThread['タイトル/概要'] : '不明なスレッド';
    
    const statusSelect = document.getElementById('thread-status-select');
    if (targetThread) {
        statusSelect.value = targetThread['ステータス'] || '未対応';
        if (currentUser.role === 'planner' && (currentTab === 'my' || currentTab === 'active')) {
            statusSelect.classList.remove('hidden');
        } else {
            statusSelect.classList.add('hidden');
        }
    }
    
    if (currentUser.role === 'planner') {
        const unreadMsgs = appData.messages.filter(m => m['紐づくスレッドID'] === threadId && m['送信者区分'] === '先生' && m['既読ステータス'] !== '既読');
        if (unreadMsgs.length > 0) {
            unreadMsgs.forEach(m => m['既読ステータス'] = '既読');
            fetch(GAS_API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action: "markAsRead", payload: { threadId: threadId } }) }).catch(e => console.error("既読処理に失敗:", e));
        }
    }

    renderThreadList(); 

    const chatArea = document.getElementById('main-chat-area'); const qaArea = document.getElementById('main-qa-area'); const toggleBtns = document.getElementById('view-toggle-btns');
    
    if (currentTab === 'public' && currentUser.role === 'teacher') {
        chatArea.classList.add('hidden'); chatArea.classList.remove('flex');
        qaArea.classList.remove('hidden'); qaArea.classList.add('flex');
        toggleBtns.classList.add('hidden');
        document.getElementById('qa-title').textContent = targetThread['タイトル/概要'];
        document.getElementById('qa-content').innerHTML = (targetThread['公開用テキスト'] || '内容がありません').replace(/\n/g, '<br>');
    } else {
        chatArea.classList.remove('hidden'); chatArea.classList.add('flex');
        qaArea.classList.add('hidden'); qaArea.classList.remove('flex');
        document.getElementById('message-input').disabled = false; document.getElementById('send-button').disabled = false;
        if (currentUser.role === 'planner' && targetThread['公開ステータス'] === 'Summary') {
            toggleBtns.classList.remove('hidden'); switchViewMode('chat'); 
            document.getElementById('qa-title').textContent = targetThread['タイトル/概要'];
            document.getElementById('qa-content').innerHTML = (targetThread['公開用テキスト'] || '').replace(/\n/g, '<br>');
        } else { toggleBtns.classList.add('hidden'); }
        refreshChatTimeline();
    }
}

async function changeThreadStatus(newStatus) {
    if (!currentThreadId) return;
    const target = appData.consultations.find(c => c['スレッドID'] === currentThreadId);
    if (target) {
        target['ステータス'] = newStatus;
        renderThreadList(); 
    }
    try {
        const payload = { action: "updateThreadStatus", payload: { threadId: currentThreadId, newStatus: newStatus } };
        await fetch(GAS_API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(payload) });
    } catch(e) { console.error("ステータスの更新に失敗しました"); }
}

function switchViewMode(mode) { const chatArea = document.getElementById('main-chat-area'); const qaArea = document.getElementById('main-qa-area'); const btnChat = document.getElementById('btn-view-chat'); const btnQa = document.getElementById('btn-view-qa'); if (mode === 'chat') { chatArea.classList.remove('hidden'); chatArea.classList.add('flex'); qaArea.classList.add('hidden'); qaArea.classList.remove('flex'); btnChat.className = "px-3 py-1 bg-white shadow rounded text-blue-600"; btnQa.className = "px-3 py-1 text-gray-500 hover:text-gray-700"; } else { chatArea.classList.add('hidden'); chatArea.classList.remove('flex'); qaArea.classList.remove('hidden'); qaArea.classList.add('flex'); btnQa.className = "px-3 py-1 bg-white shadow rounded text-blue-600"; btnChat.className = "px-3 py-1 text-gray-500 hover:text-gray-700"; } }
function openNewThreadModal() { document.getElementById('new-thread-title').value = ''; document.getElementById('new-thread-message').value = ''; document.getElementById('suggest-area').classList.add('hidden'); document.getElementById('new-thread-modal').classList.remove('hidden'); }
function closeModal(modalId) { document.getElementById(modalId).classList.add('hidden'); }
function checkSuggests() { const input = document.getElementById('new-thread-title').value.trim().toLowerCase(); const suggestArea = document.getElementById('suggest-area'); const suggestList = document.getElementById('suggest-list'); if (input.length < 2) { suggestArea.classList.add('hidden'); return; } const hits = appData.consultations.filter(c => c['公開ステータス'] === 'Summary' && ((c['タイトル/概要'] || '').toLowerCase().includes(input) || (c['公開用テキスト'] || '').toLowerCase().includes(input))); if (hits.length > 0) { suggestList.innerHTML = ''; hits.forEach(hit => { const li = `<li onclick="openSuggestedThread('${hit['スレッドID']}')" class="cursor-pointer text-blue-600 hover:bg-blue-100 p-1.5 rounded truncate transition"><i class="fa-solid fa-caret-right mr-1 text-gray-400"></i>${hit['タイトル/概要']}</li>`; suggestList.insertAdjacentHTML('beforeend', li); }); suggestArea.classList.remove('hidden'); } else { suggestArea.classList.add('hidden'); } }
function openSuggestedThread(threadId) { closeModal('new-thread-modal'); switchTab('public'); selectThread(threadId); }
async function createNewThread() { const title = document.getElementById('new-thread-title').value.trim(); const message = document.getElementById('new-thread-message').value.trim(); if(!title || !message) { alert("タイトルと最初のメッセージを入力してください。"); return; } const btn = document.getElementById('create-thread-submit-btn'); btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 送信中...'; const payload = { action: "createNewThread", payload: { title: title, messageContent: message, senderType: "先生", senderId: currentUser.id } }; try { const response = await fetch(GAS_API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(payload) }); const result = await response.json(); if(result.status === "success") { appData.consultations.push(result.data.newConsultation); result.data.newMessage['公開対象フラグ'] = false; result.data.newMessage['既読ステータス'] = ''; appData.messages.push(result.data.newMessage); closeModal('new-thread-modal'); selectThread(result.data.threadId); } else { alert("エラー: " + result.message); } } catch (error) { alert("通信エラーが発生しました"); } finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> 送信する'; } }
function refreshChatTimeline() { const threadMessages = appData.messages.filter(m => m['紐づくスレッドID'] === currentThreadId); const timeline = document.getElementById('chat-timeline'); timeline.innerHTML = ''; if (threadMessages.length === 0) { timeline.innerHTML = `<div class="flex justify-center items-center h-full text-gray-400"><span class="text-sm">まだメッセージがありません</span></div>`; return; } threadMessages.forEach(msg => { appendMessageToTimeline(msg); }); }
async function sendRealMessage() { if (!currentThreadId) return; const input = document.getElementById('message-input'); const button = document.getElementById('send-button'); const text = input.value.trim(); if (!text) return; input.disabled = true; button.disabled = true; const senderType = currentUser.role === 'planner' ? 'プランナー' : '先生'; const payload = { action: "sendMessage", payload: { threadId: currentThreadId, senderType: senderType, senderId: currentUser.id, messageContent: text } }; try { const response = await fetch(GAS_API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(payload) }); const result = await response.json(); if(result.status === "success") { const newMsg = { 'メッセージID': result.data.messageId || ("MSG_" + Date.now()), '紐づくスレッドID': currentThreadId, '送信者区分': senderType, '送信者ID': currentUser.id, 'メッセージ内容': text, '送信日時': new Date().toISOString(), '公開対象フラグ': false, '既読ステータス': '' }; appData.messages.push(newMsg); refreshChatTimeline(); input.value = ''; } } catch (error) { alert("通信エラーが発生しました"); } finally { input.disabled = false; button.disabled = false; input.focus(); } }
async function callGeminiSummary() { if (!currentThreadId) return; const threadMessages = appData.messages.filter(m => m['紐づくスレッドID'] === currentThreadId && (m['公開対象フラグ'] === true || m['公開対象フラグ'] === 'TRUE' || m['公開対象フラグ'] === 'true')); if (threadMessages.length === 0) return alert("公開対象に設定されているメッセージがありません。"); let realChatHistory = ""; threadMessages.forEach(msg => { realChatHistory += `${msg['送信者区分']}: ${msg['メッセージ内容']}\n`; }); const modal = document.getElementById('ai-modal'); const content = document.getElementById('ai-content'); const saveBtn = document.getElementById('save-summary-btn'); modal.classList.remove('hidden'); saveBtn.classList.add('hidden'); content.innerHTML = `<div class="flex flex-col justify-center items-center h-full text-purple-500 gap-3"><div class="loader"></div><span class="text-sm font-bold animate-pulse">Gemini 2.5 Flashで事例を自動生成中...</span></div>`; try { const response = await fetch(GAS_API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action: "generateSummary", payload: { chatHistory: realChatHistory } }) }); const result = await response.json(); if (result.status === "success") { currentGeneratedSummary = result.data.summaryText; content.innerHTML = currentGeneratedSummary.replace(/\n/g, '<br>'); saveBtn.classList.remove('hidden'); saveBtn.classList.add('flex'); } else { content.innerHTML = `<div class="text-red-500 p-4">エラー: ${result.message}</div>`; } } catch (error) { content.innerHTML = `<div class="text-red-500 p-4">通信エラーが発生しました</div>`; } }
async function saveAISummary() { if (!currentThreadId || !currentGeneratedSummary) return; const btn = document.getElementById('save-summary-btn'); btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 保存中...'; try { const response = await fetch(GAS_API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action: "saveSummary", payload: { threadId: currentThreadId, summaryText: currentGeneratedSummary } }) }); const result = await response.json(); if(result.status === "success") { alert("事例として公開設定を保存しました！"); closeModal('ai-modal'); const target = appData.consultations.find(c => c['スレッドID'] === currentThreadId); if(target){ target['公開ステータス'] = 'Summary'; target['公開用テキスト'] = currentGeneratedSummary; } selectThread(currentThreadId); } else { alert("保存エラー: " + result.message); } } catch (error) { alert("通信エラーが発生しました"); } finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> 事例として保存・公開'; } }
async function toggleMsgVisibility(msgId) { const msgIndex = appData.messages.findIndex(m => m['メッセージID'] === msgId); if (msgIndex === -1) return; const currentFlag = appData.messages[msgIndex]['公開対象フラグ']; appData.messages[msgIndex]['公開対象フラグ'] = !(currentFlag === true || currentFlag === 'TRUE' || currentFlag === 'true'); refreshChatTimeline(); try { await fetch(GAS_API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action: "toggleMessageVisibility", payload: { messageId: msgId } }) }); } catch(e) { console.error("設定の保存に失敗しました"); } }
function openEditMessageModal(msgId) { const msg = appData.messages.find(m => m['メッセージID'] === msgId); if(!msg) return; document.getElementById('edit-message-id').value = msgId; document.getElementById('edit-message-content').value = msg['メッセージ内容']; document.getElementById('edit-message-modal').classList.remove('hidden'); }
async function saveEditedMessage() { const msgId = document.getElementById('edit-message-id').value; const newContent = document.getElementById('edit-message-content').value.trim(); if(!newContent) return; const btn = document.getElementById('save-edit-btn'); btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 保存中...'; try { const payload = { action: "updateMessageContent", payload: { messageId: msgId, newContent: newContent } }; const response = await fetch(GAS_API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(payload) }); const result = await response.json(); if(result.status === "success") { const msgIndex = appData.messages.findIndex(m => m['メッセージID'] === msgId); if(msgIndex !== -1) appData.messages[msgIndex]['メッセージ内容'] = newContent; refreshChatTimeline(); closeModal('edit-message-modal'); } else { alert("エラー: " + result.message); } } catch (error) { alert("通信エラーが発生しました"); } finally { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-save"></i> 修正を保存'; } }

function appendMessageToTimeline(msg) {
    const timeline = document.getElementById('chat-timeline');
    if(timeline.innerText.includes("メッセージがありません") || timeline.innerText.includes("選択してください")) timeline.innerHTML = ''; 
    
    const isMe = (msg['送信者ID'] === currentUser.id);
    let isMySide = false;
    if (currentUser.role === 'planner' && msg['送信者区分'] === 'プランナー') isMySide = true; 
    else if (currentUser.role === 'teacher' && msg['送信者区分'] === '先生') isMySide = true; 
    
    let senderName = '';
    if (isMe) { senderName = 'あなた'; } 
    else if (msg['送信者区分'] === 'プランナー') {
        const plannerObj = (appData.planners && appData.planners.length > 0) ? appData.planners.find(p => p['プランナーID'] === msg['送信者ID']) : null;
        senderName = plannerObj ? plannerObj['氏名'] : `プランナー (${msg['送信者ID']})`;
    } else { senderName = `先生 (${msg['送信者ID']})`; }

    const dateObj = new Date(msg['送信日時']);
    const timeString = isNaN(dateObj) ? '' : dateObj.toLocaleTimeString('ja-JP', {hour: '2-digit', minute:'2-digit'});
    const isPublic = (msg['公開対象フラグ'] === true || msg['公開対象フラグ'] === 'TRUE' || msg['公開対象フラグ'] === 'true');
    
    let controlsHtml = "";
    if (currentUser.role === 'planner') {
        const icon = isPublic ? '<i class="fa-solid fa-eye"></i> 公開中' : '<i class="fa-solid fa-eye-slash"></i> 非公開';
        const color = isPublic ? 'text-blue-600 bg-blue-100' : 'text-gray-600 bg-gray-200';
        controlsHtml = `<div class="flex gap-2 ml-3"><button onclick="toggleMsgVisibility('${msg['メッセージID']}')" class="text-[10px] font-bold ${color} hover:opacity-70 px-2 py-0.5 rounded shadow-sm transition">${icon}</button><button onclick="openEditMessageModal('${msg['メッセージID']}')" class="text-[10px] font-bold text-gray-600 bg-gray-100 hover:bg-gray-300 px-2 py-0.5 rounded shadow-sm transition"><i class="fa-solid fa-pen"></i> 修正</button></div>`;
    }

    let msgHtml = "";
    if (isMySide) {
        const bubbleColor = isPublic ? "bg-blue-500 text-white border-none" : "bg-slate-500 text-gray-50 border-2 border-dashed border-slate-700 shadow-none";
        msgHtml = `<div class="flex items-end gap-2 justify-end mb-6 animate-[fadeIn_0.3s_ease-out]"><div class="max-w-[75%] flex flex-col items-end"><div class="text-[11px] text-gray-500 mb-1 flex items-center">${senderName} - ${timeString} ${controlsHtml}</div><div class="${bubbleColor} p-3 rounded-2xl rounded-br-none shadow-sm text-sm whitespace-pre-wrap">${msg['メッセージ内容']}</div></div></div>`;
    } else {
        const iconStr = msg['送信者区分'] === 'プランナー' ? '<i class="fa-solid fa-user-tie"></i>' : '先';
        const iconBg = msg['送信者区分'] === 'プランナー' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600';
        const bubbleColor = isPublic ? "bg-white text-gray-800 border-gray-100 border" : "bg-gray-100 text-gray-600 border-gray-400 border-2 border-dashed shadow-none";
        msgHtml = `<div class="flex items-end gap-2 mb-6 animate-[fadeIn_0.3s_ease-out]"><div class="w-8 h-8 rounded-full ${iconBg} flex items-center justify-center font-bold text-sm shrink-0">${iconStr}</div><div class="max-w-[75%]"><div class="text-[11px] text-gray-500 mb-1 flex items-center"><span class="font-bold">${senderName}</span> <span class="ml-1">- ${timeString}</span> ${controlsHtml}</div><div class="${bubbleColor} p-3 rounded-2xl rounded-bl-none shadow-sm text-sm whitespace-pre-wrap">${msg['メッセージ内容']}</div></div></div>`;
    }
    timeline.insertAdjacentHTML('beforeend', msgHtml); timeline.scrollTop = timeline.scrollHeight;
}