// ===================
// INITIALIZATION
// ===================
document.addEventListener('DOMContentLoaded', function() {
  console.log('Halo Nusantara - Chat Application loaded');

  // Get all DOM elements
  const elements = {
    // Main menu elements
    mainMenu: document.getElementById('mainMenu'),
    startChatBtn: document.getElementById('startChatBtn'),
    changeUsernameBtn: document.getElementById('changeUsernameBtn'),
    howToUseBtn: document.getElementById('howToUseBtn'),
    aboutBtn: document.getElementById('aboutBtn'),
    currentUsernameDisplay: document.getElementById('currentUsernameDisplay'),

    // Username modal elements
    usernameModal: document.getElementById('usernameModal'),
    closeUsernameModal: document.getElementById('closeUsernameModal'),
    newUsernameInput: document.getElementById('newUsernameInput'),
    usernamePreview: document.getElementById('usernamePreview'),
    cancelUsernameBtn: document.getElementById('cancelUsernameBtn'),
    saveUsernameBtn: document.getElementById('saveUsernameBtn'),
    usernameMsg: document.getElementById('usernameMsg'),

    // How to modal elements
    howToModal: document.getElementById('howToModal'),
    closeHowto: document.querySelectorAll('.close-howto'),

    // About modal elements
    aboutModal: document.getElementById('aboutModal'),
    closeAbout: document.querySelectorAll('.close-about'),

    // CAPTCHA elements
    captchaScreen: document.getElementById('captchaScreen'),
    backToMenu: document.getElementById('backToMenu'),
    captchaText: document.getElementById('captchaText'),
    refreshCaptcha: document.getElementById('refreshCaptcha'),
    captchaInput: document.getElementById('captchaInput'),
    verifyCaptcha: document.getElementById('verifyCaptcha'),
    captchaMsg: document.getElementById('captchaMsg'),

    // Chat elements
    chatScreen: document.getElementById('chatScreen'),
    backToMainFromChat: document.getElementById('backToMainFromChat'),
    changeNameBtn: document.getElementById('changeNameBtn'),
    messageInput: document.getElementById('messageInput'),
    sendBtn: document.getElementById('sendBtn'),
    messages: document.getElementById('messages'),
    meLabel: document.getElementById('meLabel'),

    // Name change modal elements
    nameChangeModal: document.getElementById('nameChangeModal'),
    newNameInput: document.getElementById('newNameInput'),
    cancelNameBtn: document.getElementById('cancelNameBtn'),
    saveNameBtn: document.getElementById('saveNameBtn'),
    nameChangeMsg: document.getElementById('nameChangeMsg')
  };

  // Check if all elements exist
  Object.entries(elements).forEach(([key, element]) => {
    if (!element && !Array.isArray(element)) {
      console.error(`Element not found: ${key}`);
    }
  });

  // User data
  let userData = {
    username: 'Anonymous_User',
    originalUsername: '',
    userId: generateUserId(),
    userRegion: null,
    discoveredRegions: [],
    discoveredCount: 0
  };

  // Socket will be created after CAPTCHA verification to avoid premature connections
  let socket = null;

  function connectSocket() {
    try {
      if (typeof io === 'undefined') {
        console.warn('Socket.io client not loaded; realtime features disabled.');
        return;
      }

      socket = io();
      console.log('🔄 Connecting to server...');

      socket.on('connect', () => {
        console.log('✅ Connected to server with ID:', socket.id);
        userData.userId = socket.id;
      });

      socket.on('connect_error', (error) => {
        console.error('❌ Connection error:', error);
        addSystemMessage('Tidak dapat terhubung ke server realtime. Anda tetap dapat menggunakan chat lokal.');
      });

      socket.on('disconnect', (reason) => {
        console.log('🔌 Disconnected:', reason);
      });

      socket.on('load messages', (msgList) => {
        console.log('📨 Loaded', Array.isArray(msgList) ? msgList.length : 0, 'previous messages');
        elements.messages.innerHTML = '';
        if (Array.isArray(msgList)) msgList.forEach(msg => displayMessage(msg, msg.userId === userData.userId));
      });

      socket.on('chat message', (data) => {
        // Avoid duplicating own messages
        if (data.userId !== userData.userId) displayMessage(data, false);
        if (data.userRegion) checkAndDiscoverUserRegion(data.userRegion);
      });

      socket.on('user joined', (data) => addSystemMessage(data.message || (data.username + ' telah bergabung')));
      socket.on('user left', (data) => addSystemMessage(data.message || (data.username + ' telah keluar')));
      socket.on('user name changed', (data) => addSystemMessage(`${data.oldName} sekarang dikenal sebagai ${data.newName}`));

      socket.on('user typing', (data) => { if (data.userId !== userData.userId) showTypingIndicator(data.username); });
      socket.on('user stop typing', (data) => { if (data.userId !== userData.userId) hideTypingIndicator(); });

    } catch (err) {
      console.warn('Socket init failed:', err);
      socket = null;
    }
  }

  // Simple typing indicator helpers (used by socket events)
  function showTypingIndicator(username) {
    let typingDiv = document.getElementById('typingIndicator');
    if (!typingDiv) {
      typingDiv = document.createElement('div');
      typingDiv.id = 'typingIndicator';
      typingDiv.className = 'typing-indicator';
      elements.messages.appendChild(typingDiv);
    }
    typingDiv.innerHTML = `<div class="typing-content"><div class="typing-dots"><span></span><span></span><span></span></div><span class="typing-text">${username} sedang mengetik...</span></div>`;
    elements.messages.scrollTop = elements.messages.scrollHeight;
  }

  function hideTypingIndicator() {
    const typingDiv = document.getElementById('typingIndicator');
    if (typingDiv) typingDiv.remove();
  }

  // ===================
  // UTILITY FUNCTIONS
  // ===================

  function generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  function generateCaptcha() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    elements.captchaText.textContent = result;
    console.log('CAPTCHA generated:', result);
  }

  function generateRandomName() {
    const adjectives = ['Ramah', 'Ceria', 'Bijaksana', 'Kreatif', 'Berani', 'Santun', 'Luhur'];
    const cities = ['Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Makassar', 'Bali', 'Yogyakarta'];
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const city = cities[Math.floor(Math.random() * cities.length)];
    return `${adj}_dari_${city}`;
  }

  // ===================
  // REGION / CULTURE DATABASE + FUNCTIONS
  // ===================
  const provincesDatabase = [
    { id: 1, name: "Aceh", capital: "Banda Aceh", island: "Sumatera", dominantEthnic: "Aceh", localLanguage: "Aceh", traditionalHouse: "Rumoh Aceh", traditionalClothing: "Ulee Balang (pria), Peukek (wanita)", traditionalDance: "Seudati, Saman, Rapai", characteristics: "Kopi Gayo, adat meukuta alam", flagEmoji: "🏴", discovered: false },
    { id: 2, name: "Sumatera Utara", capital: "Medan", island: "Sumatera", dominantEthnic: "Batak (Toba, Karo, Mandailing, Simalungun, Pakpak)", localLanguage: "Batak (berbagai varian), Melayu, Nias", traditionalHouse: "Rumah Bolon (Batak Toba)", traditionalClothing: "Ulos (Batak)", traditionalDance: "Tor-tor, Serampang 12, Sigale-gale", characteristics: "Adat Dalihan Na Tolu", flagEmoji: "⛰️", discovered: false },
    { id: 3, name: "Sumatera Barat", capital: "Padang", island: "Sumatera", dominantEthnic: "Minangkabau, Mentawai", localLanguage: "Minang, Mentawai", traditionalHouse: "Rumah Gadang", traditionalClothing: "Baju Bundo Kanduang, Saluak", traditionalDance: "Tari Piring, Randai, Tari Indang", characteristics: "Sistem matrilineal, rendang", flagEmoji: "🏔️", discovered: false },
    { id: 4, name: "Riau", capital: "Pekanbaru", island: "Sumatera", dominantEthnic: "Melayu, Talang Mamak, Akit", localLanguage: "Melayu Riau", traditionalHouse: "Rumah Lancang/Lipat", traditionalClothing: "Baju Kurung Melayu", traditionalDance: "Zapin, Joget Lambak", characteristics: "Warisan kerajaan Melayu", flagEmoji: "🌴", discovered: false },
    { id: 5, name: "Kepulauan Riau", capital: "Tanjung Pinang", island: "Sumatera", dominantEthnic: "Melayu, Bugis, Tionghoa", localLanguage: "Melayu, Bajau", traditionalHouse: "Rumah Limas", traditionalClothing: "Kebaya Labuh", traditionalDance: "Zapin", characteristics: "Budaya bahari", flagEmoji: "🏝️", discovered: false },
    { id: 6, name: "Jambi", capital: "Jambi", island: "Sumatera", dominantEthnic: "Melayu Jambi, Kerinci, Batin", localLanguage: "Melayu Jambi, Kerinci", traditionalHouse: "Rumah Panggung Kajang Lako", traditionalClothing: "Baju Kurung Tanggung", traditionalDance: "Sekapur Sirih", characteristics: "Candi Muaro Jambi", flagEmoji: "🌅", discovered: false },
    { id: 7, name: "Sumatera Selatan", capital: "Palembang", island: "Sumatera", dominantEthnic: "Palembang, Ogan, Semendo", localLanguage: "Melayu Palembang, Komering", traditionalHouse: "Rumah Limas", traditionalClothing: "Aesan Gede", traditionalDance: "Gending Sriwijaya", characteristics: "Songket Palembang", flagEmoji: "🛶", discovered: false },
    { id: 8, name: "Bangka Belitung", capital: "Pangkal Pinang", island: "Sumatera", dominantEthnic: "Melayu Bangka, Tionghoa", localLanguage: "Melayu Bangka, Hakka", traditionalHouse: "Rumah Rakit Limas", traditionalClothing: "Baju Seting", traditionalDance: "Sepintu Segantang Lada", characteristics: "Tambang timah", flagEmoji: "⚓", discovered: false },
    { id: 9, name: "Bengkulu", capital: "Bengkulu", island: "Sumatera", dominantEthnic: "Rejang, Serawai, Melayu", localLanguage: "Rejang, Melayu Bengkulu", traditionalHouse: "Rumah Bubungan Lima", traditionalClothing: "Baju Besurek", traditionalDance: "Andun", characteristics: "Bunga Rafflesia", flagEmoji: "🌺", discovered: false },
    { id: 10, name: "Lampung", capital: "Bandar Lampung", island: "Sumatera", dominantEthnic: "Lampung", localLanguage: "Lampung", traditionalHouse: "Rumah Nuwo Sesat", traditionalClothing: "Sigor", traditionalDance: "Bedana", characteristics: "Kain tapis", flagEmoji: "🐘", discovered: false },
    { id: 11, name: "DKI Jakarta", capital: "Jakarta", island: "Jawa", dominantEthnic: "Betawi, Jawa, Sunda", localLanguage: "Betawi", traditionalHouse: "Rumah Kebaya", traditionalClothing: "Baju Sadariah", traditionalDance: "Lenong, Ondel-ondel", characteristics: "Kerak telor", flagEmoji: "🏙️", discovered: false },
    { id: 12, name: "Jawa Barat", capital: "Bandung", island: "Jawa", dominantEthnic: "Sunda", localLanguage: "Sunda", traditionalHouse: "Rumah Julang Ngapak", traditionalClothing: "Kebaya Sunda", traditionalDance: "Jaipong", characteristics: "Angklung", flagEmoji: "🌄", discovered: false },
    { id: 13, name: "Banten", capital: "Serang", island: "Jawa", dominantEthnic: "Sunda Banten", localLanguage: "Sunda Banten", traditionalHouse: "Rumah Panggung Badui", traditionalClothing: "Baju Baduy", traditionalDance: "Rampak Bedug", characteristics: "Ujung Kulon", flagEmoji: "🌋", discovered: false },
    { id: 14, name: "Jawa Tengah", capital: "Semarang", island: "Jawa", dominantEthnic: "Jawa", localLanguage: "Jawa", traditionalHouse: "Rumah Joglo", traditionalClothing: "Kebaya Jawa", traditionalDance: "Gambyong", characteristics: "Borobudur", flagEmoji: "🏯", discovered: false },
    { id: 15, name: "DI Yogyakarta", capital: "Yogyakarta", island: "Jawa", dominantEthnic: "Jawa Mataraman", localLanguage: "Jawa Krama", traditionalHouse: "Joglo", traditionalClothing: "Kebaya", traditionalDance: "Serimpi", characteristics: "Kraton", flagEmoji: "👑", discovered: false },
    { id: 16, name: "Jawa Timur", capital: "Surabaya", island: "Jawa", dominantEthnic: "Jawa, Madura", localLanguage: "Jawa Arekan", traditionalHouse: "Joglo", traditionalClothing: "Pesa'an Madura", traditionalDance: "Reog Ponorogo", characteristics: "Bromo", flagEmoji: "🌄", discovered: false },
    { id: 17, name: "Bali", capital: "Denpasar", island: "Bali & Nusa Tenggara", dominantEthnic: "Bali", localLanguage: "Bali", traditionalHouse: "Gapura Candi Bentar", traditionalClothing: "Kebaya Bali", traditionalDance: "Kecak", characteristics: "Subak, Nyepi", flagEmoji: "🛕", discovered: false },
    { id: 18, name: "Nusa Tenggara Barat", capital: "Mataram", island: "Bali & Nusa Tenggara", dominantEthnic: "Sasak", localLanguage: "Sasak", traditionalHouse: "Bale Tani", traditionalClothing: "Lambung", traditionalDance: "Gandrung Lombok", characteristics: "Tenun ikat", flagEmoji: "🏝️", discovered: false },
    { id: 19, name: "Nusa Tenggara Timur", capital: "Kupang", island: "Bali & Nusa Tenggara", dominantEthnic: "Flores, Timor", localLanguage: "Berbagai bahasa daerah", traditionalHouse: "Sao Ata Mosa", traditionalClothing: "Tenun ikat", traditionalDance: "Caci", characteristics: "Komodo", flagEmoji: "🐉", discovered: false },
    { id: 20, name: "Kalimantan Barat", capital: "Pontianak", island: "Kalimantan", dominantEthnic: "Dayak, Melayu", localLanguage: "Dayak", traditionalHouse: "Rumah Panjang", traditionalClothing: "King Baba", traditionalDance: "Monong", characteristics: "Taman Nasional", flagEmoji: "🌳", discovered: false },
    { id: 21, name: "Kalimantan Tengah", capital: "Palangka Raya", island: "Kalimantan", dominantEthnic: "Dayak Ngaju", localLanguage: "Ngaju", traditionalHouse: "Rumah Betang", traditionalClothing: "Bawahan Loin", traditionalDance: "Mandau", characteristics: "Taman Nasional Tanjung Puting", flagEmoji: "🌲", discovered: false },
    { id: 22, name: "Kalimantan Selatan", capital: "Banjarbaru", island: "Kalimantan", dominantEthnic: "Dayak, Banjar", localLanguage: "Banjar", traditionalHouse: "Rumah Bubungan Tinggi", traditionalClothing: "Bagajah Gamting", traditionalDance: "Baksa Kembang", characteristics: "Pasar terapung", flagEmoji: "🚤", discovered: false },
    { id: 23, name: "Kalimantan Timur", capital: "Samarinda", island: "Kalimantan", dominantEthnic: "Dayak Kenyah", localLanguage: "Banjar", traditionalHouse: "Rumah Lamin", traditionalClothing: "Ta'a", traditionalDance: "Hudoq", characteristics: "Derawan", flagEmoji: "🏞️", discovered: false },
    { id: 24, name: "Kalimantan Utara", capital: "Tanjung Selor", island: "Kalimantan", dominantEthnic: "Dayak Tidung", localLanguage: "Tidung", traditionalHouse: "Rumah Baloy", traditionalClothing: "Ta'a", traditionalDance: "Jepen", characteristics: "Kayan Mentarang", flagEmoji: "🌿", discovered: false },
    { id: 25, name: "Sulawesi Utara", capital: "Manado", island: "Sulawesi", dominantEthnic: "Minahasa", localLanguage: "Manado Malay", traditionalHouse: "Rumah Wale Wanua", traditionalClothing: "Baju Laku Tepu", traditionalDance: "Maengket", characteristics: "Kolintang", flagEmoji: "🌊", discovered: false },
    { id: 26, name: "Gorontalo", capital: "Gorontalo", island: "Sulawesi", dominantEthnic: "Gorontalo", localLanguage: "Gorontalo", traditionalHouse: "Rumah Dulohupa", traditionalClothing: "Bili'u", traditionalDance: "Langga", characteristics: "Sulaman karawo", flagEmoji: "🎨", discovered: false },
    { id: 27, name: "Sulawesi Tengah", capital: "Palu", island: "Sulawesi", dominantEthnic: "Kaili", localLanguage: "Kaili", traditionalHouse: "Souraja", traditionalClothing: "Baju Nggembe", traditionalDance: "Dero", characteristics: "Danau Poso", flagEmoji: "🏞️", discovered: false },
    { id: 28, name: "Sulawesi Barat", capital: "Mamuju", island: "Sulawesi", dominantEthnic: "Mandar", localLanguage: "Mandar", traditionalHouse: "Rumah Boyang", traditionalClothing: "Baju Pokko", traditionalDance: "Patuddu", characteristics: "Perahu Phinisi", flagEmoji: "⛵", discovered: false },
    { id: 29, name: "Sulawesi Selatan", capital: "Makassar", island: "Sulawesi", dominantEthnic: "Bugis", localLanguage: "Bugis", traditionalHouse: "Balla'", traditionalClothing: "Baju Bodo", traditionalDance: "Pakarena", characteristics: "Toraja", flagEmoji: "🌾", discovered: false },
    { id: 30, name: "Sulawesi Tenggara", capital: "Kendari", island: "Sulawesi", dominantEthnic: "Buton", localLanguage: "Wolio", traditionalHouse: "Banua Wolio", traditionalClothing: "Baju Babu", traditionalDance: "Lulo", characteristics: "Wakatobi", flagEmoji: "🏰", discovered: false },
    { id: 31, name: "Maluku", capital: "Ambon", island: "Maluku", dominantEthnic: "Maluku", localLanguage: "Maluku", traditionalHouse: "Rumah Baileo", traditionalClothing: "Baju Cele", traditionalDance: "Cakalele", characteristics: "Rempah", flagEmoji: "🌺", discovered: false },
    { id: 32, name: "Maluku Utara", capital: "Sofifi", island: "Maluku", dominantEthnic: "Ternate, Tidore", localLanguage: "Ternate", traditionalHouse: "Rumah Sasadu", traditionalClothing: "Baju Kofo", traditionalDance: "Soya-soya", characteristics: "Kesultanan", flagEmoji: "🌋", discovered: false },
    { id: 33, name: "Papua Barat", capital: "Manokwari", island: "Papua", dominantEthnic: "Arfak, Biak", localLanguage: "Biak", traditionalHouse: "Rumah Kariwari", traditionalClothing: "Koteka, Noken", traditionalDance: "Yospan", characteristics: "Raja Ampat", flagEmoji: "🏝️", discovered: false },
    { id: 34, name: "Papua", capital: "Jayapura", island: "Papua", dominantEthnic: "Asmat, Dani", localLanguage: "Papua", traditionalHouse: "Honai", traditionalClothing: "Koteka", traditionalDance: "Perang Asmat", characteristics: "Lembah Baliem", flagEmoji: "🗿", discovered: false },
    { id: 35, name: "Papua Selatan", capital: "Merauke", island: "Papua", dominantEthnic: "Marind", localLanguage: "Marind-anim", traditionalHouse: "Rumah Jew", traditionalClothing: "Koteka", traditionalDance: "Selamat Datang", characteristics: "Lorentz", flagEmoji: "🦘", discovered: false },
    { id: 36, name: "Papua Tengah", capital: "Nabire", island: "Papua", dominantEthnic: "Mee", localLanguage: "Mee", traditionalHouse: "Honai", traditionalClothing: "Koteka", traditionalDance: "Waita", characteristics: "Puncak Jaya", flagEmoji: "🏔️", discovered: false },
    { id: 37, name: "Papua Pegunungan", capital: "Wamena", island: "Papua", dominantEthnic: "Lani, Dani", localLanguage: "Lani", traditionalHouse: "Honai Silimo", traditionalClothing: "Koteka", traditionalDance: "Perang Lembah Baliem", characteristics: "Budaya pegunungan", flagEmoji: "⛰️", discovered: false },
    { id: 38, name: "Papua Barat Daya", capital: "Sorong", island: "Papua", dominantEthnic: "Maybrat, Moi", localLanguage: "Moi", traditionalHouse: "Rumah Adat Moi", traditionalClothing: "Noken", traditionalDance: "Suanggi", characteristics: "Sorong", flagEmoji: "🌅", discovered: false }
  ];

  // initialize discovered regions from localStorage
  function initDiscoveredRegions() {
    const saved = localStorage.getItem('haloNusantara_discoveredRegions');
    if (saved) userData.discoveredRegions = JSON.parse(saved);
    provincesDatabase.forEach(p => {
      p.discovered = userData.discoveredRegions.includes(p.id);
    });
    // Load saved username
    const savedUsername = localStorage.getItem('haloNusantara_username');
    if (savedUsername) {
      userData.username = savedUsername;
      userData.originalUsername = savedUsername;
      elements.currentUsernameDisplay.textContent = savedUsername;
    }
    const savedRegion = localStorage.getItem('haloNusantara_userRegion');
    if (savedRegion) {
      userData.userRegion = parseInt(savedRegion);
      if (!userData.discoveredRegions.includes(userData.userRegion)) {
        userData.discoveredRegions.push(userData.userRegion);
      }
    }
    updateDiscoveryStats();
  }

  function saveDiscoveredRegions() {
    localStorage.setItem('haloNusantara_discoveredRegions', JSON.stringify(userData.discoveredRegions));
  }

  function updateDiscoveryStats() {
    const discoveredCount = userData.discoveredRegions.length;
    const percentage = Math.round((discoveredCount / 38) * 100);
    userData.discoveredCount = discoveredCount;
    const discoveredCountEl = document.getElementById('discoveredCount');
    if (discoveredCountEl) discoveredCountEl.textContent = discoveredCount;
    const discoveryPercentageEl = document.getElementById('discoveryPercentage');
    if (discoveryPercentageEl) discoveryPercentageEl.textContent = `${percentage}%`;
    const miniDiscoveredCountEl = document.getElementById('miniDiscoveredCount');
    if (miniDiscoveredCountEl) miniDiscoveredCountEl.textContent = discoveredCount;
    const progressFill = document.getElementById('progressFill');
    if (progressFill) progressFill.style.width = `${percentage}%`;
    const progressTextSpan = document.querySelector('.progress-text span');
    if (progressTextSpan) progressTextSpan.textContent = `${discoveredCount}/38 Provinsi Ditemukan`;
    const regionDisplay = document.getElementById('userRegionDisplay');
    const regionSubtitle = document.getElementById('userRegionSubtitle');
    const userRegionStat = document.getElementById('userRegion');
    if (userData.userRegion) {
      const region = provincesDatabase.find(p => p.id === userData.userRegion);
      if (region) {
        if (regionDisplay) regionDisplay.textContent = region.name;
        if (regionSubtitle) regionSubtitle.textContent = `Berkenalanlah dengan orang dari daerah lain!`;
        if (userRegionStat) userRegionStat.textContent = region.name;
      }
    }
  }

  function showDiscoveryNotification(regionName) {
    const notification = document.getElementById('discoveryNotification');
    const discoveredRegion = document.getElementById('discoveredRegion');
    const discoveryText = document.getElementById('discoveryText');
    if (notification && discoveredRegion && discoveryText) {
      discoveredRegion.textContent = regionName;
      const messages = [
        `Anda telah bertemu dengan seseorang dari <strong>${regionName}</strong>!`,
        `Budaya baru ditemukan: <strong>${regionName}</strong>`,
        `Selamat! Anda telah menemukan budaya dari <strong>${regionName}</strong>`,
        `Perjalanan budaya Anda bertambah: <strong>${regionName}</strong>`
      ];
      discoveryText.innerHTML = messages[Math.floor(Math.random() * messages.length)];
      notification.style.display = 'block';
      // auto hide
      setTimeout(() => { notification.style.display = 'none'; }, 5000);
    }
  }

  function discoverRegion(regionId) {
    if (!regionId) return false;
    if (!userData.discoveredRegions.includes(regionId)) {
      userData.discoveredRegions.push(regionId);
      const province = provincesDatabase.find(p => p.id === regionId);
      if (province) {
        province.discovered = true;
        showDiscoveryNotification(province.name);
        updateDiscoveryStats();
        saveDiscoveredRegions();
        const cultureModal = document.getElementById('cultureModal');
        if (cultureModal && cultureModal.style.display === 'flex') renderCultureList();
        return true;
      }
    }
    return false;
  }

  function renderRegionGrid() {
    const grid = document.getElementById('regionGrid');
    if (!grid) return;
    grid.innerHTML = '';
    provincesDatabase.forEach(province => {
      const card = document.createElement('div');
      card.className = 'region-card';
      card.dataset.id = province.id;
      card.innerHTML = `\n        <div class="region-flag">${province.flagEmoji}</div>\n        <h4>${province.name}</h4>\n        <p>${province.capital}</p>\n      `;
      card.addEventListener('click', () => selectRegion(province.id));
      grid.appendChild(card);
    });
  }

  function selectRegion(regionId) {
    document.querySelectorAll('.region-card').forEach(c => c.classList.remove('selected'));
    const selectedCard = document.querySelector(`.region-card[data-id="${regionId}"]`);
    if (!selectedCard) return;
    selectedCard.classList.add('selected');
    const province = provincesDatabase.find(p => p.id === regionId);
    const selectedInfo = document.getElementById('selectedRegionInfo');
    const selectedCardElement = document.getElementById('selectedRegionCard');
    const saveBtn = document.getElementById('saveRegionBtn');
    if (province && selectedInfo && selectedCardElement && saveBtn) {
      selectedCardElement.innerHTML = `\n        <div class="region-flag">${province.flagEmoji}</div>\n        <div>\n          <h4>${province.name}</h4>\n          <p>Ibu Kota: ${province.capital}</p>\n          <p>Pulau: ${province.island}</p>\n        </div>\n      `;
      selectedInfo.style.display = 'block';
      saveBtn.disabled = false;
    }
  }

  function setUserRegion(regionId) {
    userData.userRegion = regionId;
    localStorage.setItem('haloNusantara_userRegion', regionId);
    discoverRegion(regionId);
    updateDiscoveryStats();
    hideModal('regionModal');
    const province = provincesDatabase.find(p => p.id === regionId);
    if (province) {
      // Generate username based on selected region
      const adjectives = ['Ramah', 'Ceria', 'Bijaksana', 'Kreatif', 'Berani', 'Santun', 'Luhur', 'Sejati', 'Tangguh', 'Mulia'];
      const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
      const newUsername = `${adj}_dari_${province.capital}`;
      userData.username = newUsername;
      userData.originalUsername = newUsername;
      localStorage.setItem('haloNusantara_username', newUsername);
      elements.currentUsernameDisplay.textContent = newUsername;
      alert(`Daerah asal Anda telah ditetapkan: ${province.name}. Identitas Anda: ${newUsername}. Selamat berjelajah budaya Nusantara!`);
    }
  }

  function renderCultureList(filter = 'discovered', searchTerm = '', islandFilter = '') {
    const cultureList = document.getElementById('cultureList');
    if (!cultureList) return;
    let filtered = [...provincesDatabase];
    if (filter === 'discovered') filtered = filtered.filter(p => p.discovered);
    else if (filter === 'undiscovered') filtered = filtered.filter(p => !p.discovered);
    if (searchTerm) {
      filtered = filtered.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.capital.toLowerCase().includes(searchTerm.toLowerCase()) || p.dominantEthnic.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    if (islandFilter) filtered = filtered.filter(p => p.island === islandFilter);
    cultureList.innerHTML = '';
    if (filtered.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.innerHTML = `\n        <i class="fas fa-search"></i>\n        <h4>Tidak ada hasil ditemukan</h4>\n        <p>Coba gunakan kata kunci yang berbeda atau pilih filter lain</p>\n      `;
      cultureList.appendChild(emptyState);
      return;
    }
    filtered.forEach(province => {
      const item = document.createElement('div');
      item.className = `culture-item ${province.discovered ? 'discovered' : 'undiscovered'}`;
      
      let contentHTML;
      if (province.discovered) {
        contentHTML = `
        <div class="culture-item-content">
          <div class="culture-item-row"><i class="fas fa-city"></i><span><strong>Ibu Kota:</strong> ${province.capital}</span></div>
          <div class="culture-item-row"><i class="fas fa-users"></i><span><strong>Suku Dominan:</strong> ${province.dominantEthnic}</span></div>
          <div class="culture-item-row"><i class="fas fa-language"></i><span><strong>Bahasa Daerah:</strong> ${province.localLanguage}</span></div>
          <div class="culture-item-row"><i class="fas fa-home"></i><span><strong>Rumah Adat:</strong> ${province.traditionalHouse}</span></div>
          <div class="culture-item-row"><i class="fas fa-tshirt"></i><span><strong>Pakaian Adat:</strong> ${province.traditionalClothing}</span></div>
          <div class="culture-item-row"><i class="fas fa-music"></i><span><strong>Tarian Khas:</strong> ${province.traditionalDance}</span></div>
          <div class="culture-item-row"><i class="fas fa-star"></i><span><strong>Ciri Khas:</strong> ${province.characteristics}</span></div>
        </div>
        `;
      } else {
        contentHTML = `
        <div class="culture-item-content undiscovered-placeholder">
          <i class="fas fa-lock"></i>
          <span>?</span>
          <p>Temukan budaya ini dengan berkenalan dengan orang dari daerah ini</p>
        </div>
        `;
      }
      
      item.innerHTML = `
        <div class="culture-item-header">
          <h4>${province.name}</h4>
          <span class="badge">${province.discovered ? 'Ditemukan' : 'Belum'}</span>
        </div>
        ${contentHTML}
        ${province.id === userData.userRegion ? '<div class="culture-item-discovery">Daerah Asal Anda</div>' : ''}
      `;
      cultureList.appendChild(item);
    });
  }

  function setupCultureListeners() {
    document.getElementById('changeRegionBtn')?.addEventListener('click', () => { renderRegionGrid(); showModal('regionModal'); });
    document.getElementById('viewCultureBtn')?.addEventListener('click', () => { updateDiscoveryStats(); renderCultureList(); showModal('cultureModal'); const sidebar = document.getElementById('cultureSidebarInfo'); if (sidebar) sidebar.style.display = 'flex'; });
    document.getElementById('viewCultureChatBtn')?.addEventListener('click', () => { updateDiscoveryStats(); renderCultureList(); showModal('cultureModal'); const sidebar = document.getElementById('cultureSidebarInfo'); if (sidebar) sidebar.style.display = 'flex'; });
    document.getElementById('cancelRegionBtn')?.addEventListener('click', () => hideModal('regionModal'));
    document.getElementById('saveRegionBtn')?.addEventListener('click', () => { const sel = document.querySelector('.region-card.selected'); if (sel) setUserRegion(parseInt(sel.dataset.id)); });
    document.getElementById('regionSearch')?.addEventListener('input', (e) => { const term = e.target.value.toLowerCase(); document.querySelectorAll('.region-card').forEach(card => { const provinceName = card.querySelector('h4').textContent.toLowerCase(); const capital = card.querySelector('p').textContent.toLowerCase(); card.style.display = (provinceName.includes(term) || capital.includes(term)) ? 'block' : 'none'; }); });
    document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', (e) => { document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active')); e.currentTarget.classList.add('active'); const tab = e.currentTarget.dataset.tab; const searchTerm = document.getElementById('cultureSearch')?.value || ''; const islandFilter = document.getElementById('islandFilter')?.value || ''; renderCultureList(tab, searchTerm, islandFilter); }));
    document.getElementById('cultureSearch')?.addEventListener('input', (e) => { const searchTerm = e.target.value; const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab || 'discovered'; const islandFilter = document.getElementById('islandFilter')?.value || ''; renderCultureList(activeTab, searchTerm, islandFilter); });
    document.getElementById('islandFilter')?.addEventListener('change', (e) => { const islandFilter = e.target.value; const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab || 'discovered'; const searchTerm = document.getElementById('cultureSearch')?.value || ''; renderCultureList(activeTab, searchTerm, islandFilter); });
    document.querySelectorAll('.close-culture').forEach(btn => btn.addEventListener('click', () => hideModal('cultureModal')));
    document.getElementById('closeNotification')?.addEventListener('click', () => { document.getElementById('discoveryNotification').style.display = 'none'; });
    const notification = document.getElementById('discoveryNotification');
    if (notification) {
      notification.addEventListener('mouseenter', () => clearTimeout(notification.hideTimeout));
      notification.addEventListener('mouseleave', () => { notification.hideTimeout = setTimeout(() => { notification.style.display = 'none'; }, 3000); });
    }
    const savedRegion = localStorage.getItem('haloNusantara_userRegion');
    if (!savedRegion) { setTimeout(() => { renderRegionGrid(); showModal('regionModal'); }, 1000); }
    else { userData.userRegion = parseInt(savedRegion); if (!userData.discoveredRegions.includes(userData.userRegion)) userData.discoveredRegions.push(userData.userRegion); updateDiscoveryStats(); }
  }

  function checkAndDiscoverUserRegion(userRegionId) {
    if (userRegionId && userRegionId !== userData.userRegion) discoverRegion(userRegionId);
  }

  function showModal(modalId) { const modal = document.getElementById(modalId); if (modal) { modal.style.display = 'flex'; document.body.style.overflow = 'hidden'; } }
  function hideModal(modalId) { const modal = document.getElementById(modalId); if (modal) { modal.style.display = 'none'; document.body.style.overflow = 'auto'; } }

  function updateUserLabel() {
    elements.meLabel.innerHTML = `<i class="fas fa-user"></i> Memuat identitas...`;
    setTimeout(() => {
      elements.meLabel.innerHTML = `<i class="fas fa-user"></i> ${userData.username}`;
    }, 500);
  }

  function updateUsernameDisplay() {
    elements.currentUsernameDisplay.textContent = userData.username;
  }

  function updateUsernamePreview() {
    const preview = elements.newUsernameInput.value.trim() || 'Anonymous_User';
    elements.usernamePreview.textContent = preview;
  }

  function addSystemMessage(text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system';
    messageDiv.innerHTML = `
      <div class="msgText">${text}</div>
    `;
    elements.messages.appendChild(messageDiv);
    elements.messages.scrollTop = elements.messages.scrollHeight;
  }

  // ===================
  // MESSAGE FUNCTIONS
  // ===================

  function displayMessage(data, isOwn = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = isOwn ? 'message own' : 'message other';

    messageDiv.innerHTML = `
      <div class="msgMeta">
        <span class="msgUser">${data.username}</span>
        <span class="msgTime">${data.time}</span>
      </div>
      <div class="msgText">${data.message}</div>
    `;

    elements.messages.appendChild(messageDiv);
    elements.messages.scrollTop = elements.messages.scrollHeight;
  }

  function sendMessage() {
    const message = elements.messageInput.value.trim();
    if (message === '') return;

    const messageData = {
      userId: userData.userId,
      username: userData.username,
      message: message,
      time: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      })
      ,
      userRegion: userData.userRegion || null
    };

    // Display own message immediately
    displayMessage(messageData, true);

    // Send to server if socket exists
    if (socket) {
      socket.emit('chat message', messageData);
    }

    // Clear input
    elements.messageInput.value = '';
    elements.messageInput.focus();
  }

  // ===================
  // MODAL FUNCTIONS
  // ===================

  function showUsernameModal() {
    elements.newUsernameInput.value = userData.username;
    updateUsernamePreview();
    elements.usernameModal.style.display = 'flex';
    elements.newUsernameInput.focus();
    elements.usernameMsg.textContent = '';
  }

  function hideUsernameModal() {
    elements.usernameModal.style.display = 'none';
    elements.newUsernameInput.value = '';
    elements.usernameMsg.textContent = '';
  }

  function showHowToModal() {
    elements.howToModal.style.display = 'flex';
  }

  function hideHowToModal() {
    elements.howToModal.style.display = 'none';
  }

  function showAboutModal() {
    elements.aboutModal.style.display = 'flex';
  }

  function hideAboutModal() {
    elements.aboutModal.style.display = 'none';
  }

  function showNameChangeModal() {
    elements.newNameInput.value = userData.username;
    elements.nameChangeModal.style.display = 'flex';
    elements.newNameInput.focus();
    elements.nameChangeMsg.textContent = '';
  }

  function hideNameChangeModal() {
    elements.nameChangeModal.style.display = 'none';
    elements.newNameInput.value = '';
    elements.nameChangeMsg.textContent = '';
  }

  // ===================
  // USERNAME CHANGE FUNCTIONS
  // ===================

  function changeUsername(newName) {
    const trimmedName = newName.trim();

    if (!trimmedName) {
      elements.usernameMsg.textContent = 'Nama tidak boleh kosong!';
      elements.usernameMsg.style.color = 'var(--danger)';
      return;
    }

    if (trimmedName.length > 30) {
      elements.usernameMsg.textContent = 'Maksimal 30 karakter!';
      elements.usernameMsg.style.color = 'var(--danger)';
      return;
    }

    const oldName = userData.username;
    userData.username = trimmedName;

    // Update UI
    updateUsernameDisplay();

    // Close modal
    hideUsernameModal();

    // Show success message
    elements.usernameMsg.textContent = 'Nama berhasil diubah!';
    elements.usernameMsg.style.color = 'var(--secondary)';

    console.log(`Username changed: ${oldName} -> ${userData.username}`);
  }

  function changeUserNameInChat(newName) {
    const trimmedName = newName.trim();

    if (!trimmedName) {
      elements.nameChangeMsg.textContent = 'Nama tidak boleh kosong!';
      elements.nameChangeMsg.style.color = 'var(--danger)';
      return;
    }

    if (trimmedName.length > 30) {
      elements.nameChangeMsg.textContent = 'Maksimal 30 karakter!';
      elements.nameChangeMsg.style.color = 'var(--danger)';
      return;
    }

    const oldName = userData.username;
    userData.username = trimmedName;

    // Update UI
    updateUserLabel();

    // Add system message
    addSystemMessage(`Anda sekarang dikenal sebagai ${userData.username}`);

    // Notify server if socket exists
    if (socket) {
      socket.emit('user name changed', {
        userId: userData.userId,
        oldName: oldName,
        newName: userData.username
      });
    }

    // Close modal
    hideNameChangeModal();

    // Show success message
    elements.nameChangeMsg.textContent = 'Nama berhasil diubah!';
    elements.nameChangeMsg.style.color = 'var(--secondary)';

    console.log(`Username changed: ${oldName} -> ${userData.username}`);
  }

  // ===================
  // EVENT LISTENERS
  // ===================

  // Main menu events
  elements.startChatBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    elements.mainMenu.style.display = 'none';
    elements.captchaScreen.style.display = 'flex';
    generateCaptcha();
    elements.captchaInput.focus();
  });

  elements.changeUsernameBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    showUsernameModal();
  });

  elements.howToUseBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    showHowToModal();
  });

  elements.aboutBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    showAboutModal();
  });

  // Username modal events
  elements.closeUsernameModal?.addEventListener('click', (e) => {
    e.preventDefault();
    hideUsernameModal();
  });

  elements.newUsernameInput?.addEventListener('input', updateUsernamePreview);

  elements.cancelUsernameBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    hideUsernameModal();
  });

  elements.saveUsernameBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    changeUsername(elements.newUsernameInput.value);
  });

  elements.newUsernameInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') elements.saveUsernameBtn.click();
  });

  // How to modal events
  elements.closeHowto.forEach(btn => {
    btn?.addEventListener('click', (e) => {
      e.preventDefault();
      hideHowToModal();
    });
  });

  // About modal events
  elements.closeAbout.forEach(btn => {
    btn?.addEventListener('click', (e) => {
      e.preventDefault();
      hideAboutModal();
    });
  });

  // CAPTCHA events
  elements.backToMenu?.addEventListener('click', (e) => {
    e.preventDefault();
    elements.captchaScreen.style.display = 'none';
    elements.mainMenu.style.display = 'flex';
  });

  elements.refreshCaptcha?.addEventListener('click', (e) => {
    e.preventDefault();
    generateCaptcha();
    elements.captchaInput.value = '';
    elements.captchaMsg.textContent = '';
  });

  elements.verifyCaptcha?.addEventListener('click', (e) => {
    e.preventDefault();

    const userInput = elements.captchaInput.value.trim().toUpperCase();
    const correctCaptcha = elements.captchaText.textContent;

    if (!userInput) {
      elements.captchaMsg.textContent = 'Masukkan kode verifikasi terlebih dahulu';
      elements.captchaMsg.style.color = 'var(--danger)';
      return;
    }

    if (userInput === correctCaptcha) {
      // Generate initial username if not set
      if (!userData.originalUsername) {
        userData.originalUsername = generateRandomName();
        userData.username = userData.originalUsername;
        updateUsernameDisplay();
      }

      // Update UI
      updateUserLabel();

      // Switch screens
      elements.captchaScreen.style.display = 'none';
      elements.chatScreen.style.display = 'flex';

      // Clear CAPTCHA
      elements.captchaInput.value = '';
      elements.captchaMsg.textContent = '';

      // Focus on message input
      elements.messageInput.focus();

      // Add welcome message
      addSystemMessage(`Selamat datang di Halo Nusantara, ${userData.username}!`);

      // Connect to socket server (after verification)
      connectSocket();

      // Notify server about login (server may accept this before or after connect)
      if (socket) {
        socket.emit('user login', {
          username: userData.username
        });
      }

      console.log('User ready:', userData);

    } else {
      elements.captchaMsg.textContent = 'Kode verifikasi salah! Coba lagi.';
      elements.captchaMsg.style.color = 'var(--danger)';
      generateCaptcha();
      elements.captchaInput.value = '';
      elements.captchaInput.focus();
    }
  });

  elements.captchaInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') elements.verifyCaptcha.click();
  });

  // Chat events
  elements.backToMainFromChat?.addEventListener('click', (e) => {
    e.preventDefault();

    // Notify server if socket exists
    if (socket) {
      socket.emit('user left', {
        userId: userData.userId,
        username: userData.username
      });
    }

    // Add leave message
    addSystemMessage(`Anda telah keluar dari chat`);

    // Switch screens
    elements.chatScreen.style.display = 'none';
    elements.mainMenu.style.display = 'flex';

    // Clear messages
    elements.messages.innerHTML = '';
  });

  elements.changeNameBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    showNameChangeModal();
  });

  elements.sendBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    sendMessage();
  });

  elements.messageInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

  // Name change modal events
  elements.cancelNameBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    hideNameChangeModal();
  });

  elements.saveNameBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    changeUserNameInChat(elements.newNameInput.value);
  });

  elements.newNameInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') elements.saveNameBtn.click();
  });

  // Close modals when clicking outside
  [elements.usernameModal, elements.howToModal, elements.aboutModal, elements.nameChangeModal].forEach(modal => {
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) {
        if (modal === elements.usernameModal) hideUsernameModal();
        else if (modal === elements.howToModal) hideHowToModal();
        else if (modal === elements.aboutModal) hideAboutModal();
        else if (modal === elements.nameChangeModal) hideNameChangeModal();
      }
    });
  });

  // ===================
  // INITIAL SETUP
  // ===================

  // Initialize username display
  updateUsernameDisplay();

  // Initialize discovery / culture system
  initDiscoveredRegions();
  setupCultureListeners();

  // Add CSS for system messages
  const style = document.createElement('style');
  style.textContent = `
    .message.system {
      align-self: center;
      background: rgba(0,0,0,0.05);
      color: var(--gray);
      padding: 8px 16px;
      border-radius: 10px;
      font-size: 13px;
      font-style: italic;
      max-width: 90%;
      text-align: center;
      margin: 10px 0;
    }
  `;
  document.head.appendChild(style);

  console.log('Halo Nusantara application initialized successfully!');
});
