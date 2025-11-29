// ==========================================
// 1. INICIALIZACIÓN Y CONFIGURACIÓN GLOBAL
// ==========================================
document.addEventListener('DOMContentLoaded', () => {

  // --- Configuración Firebase ---
  const firebaseConfig = {
    apiKey: "AIzaSyCaqvn4CQbzgtFQqSxBKB8O8V3PFvaYrVo",
    authDomain: "amigosecretocornetagang.firebaseapp.com",
    projectId: "amigosecretocornetagang",
    storageBucket: "amigosecretocornetagang.firebasestorage.app",
    messagingSenderId: "1011287813426",
    appId: "1:1011287813426:web:2f8ca95eab547e96037b2b"
  };
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();

  // --- Estado Global ---
  let currentUser = null;
  let currentUserName = ''; 
  
  // --- Listeners (Unsubscribes) ---
  let unsubscribeSorteos = null;
  let unsubscribeWishlists = null;
  let unsubscribeUserDoc = null;
  let unsubscribeInicio = null;
  let unsubscribeUsers = null;
  
  // --- Elementos DOM Principales ---
  const authModal = document.getElementById('auth-modal-overlay');
  const appWrapper = document.getElementById('app-wrapper');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');


  // ==========================================
  // 2. SISTEMA DE MODALES Y ALERTAS
  // ==========================================
  const appModal = {
    overlay: document.getElementById('app-modal-overlay'),
    title: document.getElementById('app-modal-title'),
    message: document.getElementById('app-modal-message'),
    promptContainer: document.getElementById('app-modal-prompt-container'),
    promptInput: document.getElementById('app-modal-prompt-input'),
    confirmBtn: document.getElementById('app-modal-confirm-btn'),
    cancelBtn: document.getElementById('app-modal-cancel-btn') 
  };
  let modalResolve = null; 

  function showModal(config) {
    appModal.title.textContent = config.title;
    appModal.message.innerHTML = config.message;
    appModal.confirmBtn.textContent = config.confirmText || 'Aceptar';

    if (config.promptValue != null) {
      appModal.promptInput.value = config.promptValue;
      appModal.promptContainer.classList.remove('hidden');
      appModal.promptInput.readOnly = config.isPrompt ? false : true;
    } else {
      appModal.promptContainer.classList.add('hidden');
    }
    
    appModal.cancelBtn.classList.toggle('hidden', !config.showCancel);
    appModal.overlay.classList.remove('hidden');
    
    if (config.isPrompt) {
      appModal.promptInput.focus();
      appModal.promptInput.select();
    }

    return new Promise((resolve) => { modalResolve = resolve; });
  }

  appModal.confirmBtn.addEventListener('click', () => {
    if (!modalResolve) return;
    const isPrompt = !appModal.promptContainer.classList.contains('hidden') && !appModal.promptInput.readOnly;
    modalResolve(isPrompt ? appModal.promptInput.value : true);
    appModal.overlay.classList.add('hidden');
    modalResolve = null;
  });

  appModal.cancelBtn.addEventListener('click', () => {
    if (!modalResolve) return;
    modalResolve(false); 
    appModal.overlay.classList.add('hidden');
    modalResolve = null;
  });

  // Helpers Globales
  function customAlert(title, message, promptValue = null) {
    return showModal({ title, message, promptValue, showCancel: false });
  }
  async function customConfirm(title, message, confirmText = 'Aceptar') {
    const result = await showModal({ title, message, showCancel: true, confirmText });
    if (!result) throw 'cancelled'; 
    return result;
  }
  async function customPrompt(title, message, defaultValue = '') {
    const result = await showModal({ title, message, showCancel: true, confirmText: 'Guardar', promptValue: defaultValue, isPrompt: true });
    if (result === false) throw 'cancelled';
    return result;
  }


  // ==========================================
  // 3. AUTENTICACIÓN (Login / Registro / Logout)
  // ==========================================
  
  // Switch Login/Registro
  document.getElementById('show-register').addEventListener('click', (e) => { e.preventDefault(); loginForm.style.display = 'none'; registerForm.style.display = 'block'; });
  document.getElementById('show-login').addEventListener('click', (e) => { e.preventDefault(); loginForm.style.display = 'block'; registerForm.style.display = 'none'; });

  // Acción Registro
  document.getElementById('register-btn').addEventListener('click', async () => {
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    if (!name || !email || !password) return customAlert("Error", "Completa todos los campos.");
    try {
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      await db.collection('users').doc(cred.user.uid).set({ name, email, wishlistURL: "" });
    } catch (error) {
      customAlert("Error al registrar", error.message); 
    }
  });

  // Acción Login
  document.getElementById('login-btn').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    if (!email || !password) return customAlert("Error", "Completa todos los campos."); 
    try {
      await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
      customAlert("Error al entrar", error.message); 
    }
  });

  // Logout (Móvil y PC)
  const btnLogoutMobile = document.getElementById('logout-btn');
  if(btnLogoutMobile) btnLogoutMobile.addEventListener('click', (e) => { e.preventDefault(); auth.signOut(); });

  const btnLogoutPC = document.getElementById('logout-btn-pc');
  if(btnLogoutPC) btnLogoutPC.addEventListener('click', (e) => { e.preventDefault(); auth.signOut(); });


  // --- MONITOR DE ESTADO (Auth State Observer) ---
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      currentUser = user;
      
      // Escuchar cambios en perfil de usuario (Nombre, Wishlist)
      if (unsubscribeUserDoc) unsubscribeUserDoc();
      unsubscribeUserDoc = db.collection('users').doc(user.uid)
        .onSnapshot(doc => {
          if (doc.exists) {
            const userData = doc.data();
            currentUserName = userData.name || user.email;
            
            // Actualizar UI Nombre (Móvil y PC)
            const navUserMobile = document.getElementById('nav-username');
            const navUserPC = document.getElementById('nav-username-pc');
            if (navUserMobile) navUserMobile.textContent = `Hola, ${currentUserName}`;
            if (navUserPC) navUserPC.textContent = `Hola, ${currentUserName}`;
            
            // Cargar inputs de perfil
            const wishlistInput = document.getElementById('my-wishlist-url');
            const friendCodeInput = document.getElementById('my-steam-friend-code');
            if (wishlistInput) wishlistInput.value = userData.wishlistURL || '';
            if (friendCodeInput) friendCodeInput.value = userData.steamCode || '';

          } else {
            currentUserName = user.email; 
            const navUsername = document.getElementById('nav-username');
            if (navUsername) navUsername.textContent = `Hola, ${currentUserName}`;
          }
        }, error => console.error("Error usuario:", error));
      
      // Mostrar App
      authModal.style.display = 'none'; 
      appWrapper.style.display = 'block'; 
      
      // Iniciar Módulos
      loadAppLogic();       // Sorteos
      setupHistorialPage(); // Historial
      setupWishlistPage();  // Listas
      setupProfilePage();   // Perfil
      setupSPANavigation(); // Navegación
      displayMySorteos();   // Mis Sorteos
      setupInicioPage();    // Home
      
    } else {
      // Logout / No Auth
      currentUser = null;
      currentUserName = '';
      authModal.style.display = 'flex'; 
      appWrapper.style.display = 'none';
      
      // Limpiar listeners
      if (unsubscribeSorteos) unsubscribeSorteos();
      if (unsubscribeWishlists) unsubscribeWishlists(); 
      if (unsubscribeUserDoc) unsubscribeUserDoc();
      if (unsubscribeInicio) unsubscribeInicio();
    }
  });


  // ==========================================
  // 4. NAVEGACIÓN SPA (PC Y MÓVIL)
  // ==========================================
  function setupSPANavigation() {
    const allNavButtons = document.querySelectorAll('.nav-btn'); // Todos los botones (arriba y abajo)
    const contentSections = document.querySelectorAll('.content-section');
    const internalLinks = document.querySelectorAll('.nav-btn, .nav-btn-inline');

    internalLinks.forEach(btn => {
      btn.addEventListener('click', (e) => {
        if (btn.getAttribute('target') === '_blank') return; // Ignorar links externos
        e.preventDefault(); 
        
        const targetId = btn.dataset.target;
        if (!targetId) return;

        // A. Cambiar Sección
        contentSections.forEach(section => section.classList.add('hidden'));
        const targetSection = document.getElementById(targetId);
        if (targetSection) {
            targetSection.classList.remove('hidden');
            targetSection.style.opacity = 0; 
            setTimeout(() => targetSection.style.opacity = 1, 50);
        }
        
        // B. Actualizar Botones Activos (Sincronizar PC y Móvil)
        allNavButtons.forEach(b => b.classList.remove('active')); // Apagar todos
        const buttonsToActivate = document.querySelectorAll(`.nav-btn[data-target="${targetId}"]`);
        buttonsToActivate.forEach(b => b.classList.add('active')); // Encender los correctos
        
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });
    
    // Estado Inicial: Activar Inicio si no hay nada activo
    if (!document.querySelector('.nav-btn.active')) {
       const startBtns = document.querySelectorAll('.nav-btn[data-target="inicio-section"]');
       startBtns.forEach(b => b.classList.add('active'));
       const startSection = document.getElementById('inicio-section');
       if(startSection) startSection.classList.remove('hidden');
    }
  }


  // ==========================================
  // 5. LÓGICA DE PÁGINAS Y FUNCIONALIDADES
  // ==========================================

  // --- PÁGINA INICIO (Tarjeta Revelación) ---
  function setupInicioPage() {
    const container = document.getElementById('secret-friend-container');
    if (!container) return;
    if (unsubscribeInicio) unsubscribeInicio();

    // Muestra el último sorteo realizado donde participas
    const query = db.collection('sorteos')
      .where('participantIds', 'array-contains', currentUser.uid)
      .where('status', '==', 'realizado')
      .orderBy('createdAt', 'desc')
      .limit(1);

    unsubscribeInicio = query.onSnapshot(async (snapshot) => {
      if (snapshot.empty) {
        container.innerHTML = `<div class="secret-friend-card placeholder"><p>No tienes sorteos activos o realizados aún.</p></div>`;
        return;
      }
      const sorteoDoc = snapshot.docs[0];
      
      try {
        const assignmentDoc = await sorteoDoc.ref.collection('assignments').doc(currentUser.uid).get();
        if (assignmentDoc.exists) {
          const assignment = assignmentDoc.data();
          container.innerHTML = `
            <div class="secret-friend-card">
              <div class="secret-friend-info">
                <span>Tu Amigo Secreto es:</span>
                <span class="secret-name">${assignment.receiverName}</span>
              </div>
              <button class="btn-icon btn-reveal-secret" data-name="${assignment.receiverName}" title="Revelar">${iconView}</button>
            </div>`;
        } else {
           container.innerHTML = `<div class="secret-friend-card placeholder"><p>Error: No se encontró tu asignación.</p></div>`;
        }
      } catch (error) {
        console.error("Error inicio:", error);
      }
    });
  }

  // --- PÁGINA HISTORIAL (API Externa) ---
  function setupHistorialPage() {
    const btnContainer = document.getElementById("historial-btn-container");
    const contenido = document.getElementById("historial-contenido");
    const API_URL = "https://script.google.com/macros/s/AKfycbzeEirq01wkJHpXJmq-8nR97m-vvalVoyB2rclZE44DJIJbrJLzTRzMA2j1mEopqnC7rg/exec"; 

    if (!btnContainer || !contenido) return;
    let abierto = null;
    let cacheDatos = {};

    async function fetchHistorial(year) {
      if (cacheDatos[year]) return cacheDatos[year];
      try {
        contenido.innerHTML = '<div class="historial-placeholder">Cargando datos...</div>';
        const response = await fetch(`${API_URL}?year=${year}`); 
        const json = await response.json();
        if (json.error) throw new Error(json.error);
        
        if (!json.data || json.data.length === 0) return `<div class="historial-placeholder">🎁 ¡Próximamente! 🎄</div>`;
        
        let html = '<div class="grid">';
        json.data.forEach(item => {
          html += `
            <div class="section-box">
              <div class="container">
                <div class="person-box">${item.Giver}</div>
                <div class="arrow">➡️</div>
                <div class="person-box">${item.Receiver}</div>
              </div>
              <a href="${item.GiftURL}" target="_blank"><img src="${item.ImageURL}" class="gift-image" /></a>
            </div>`;
        });
        html += '</div>';
        cacheDatos[year] = html;
        return html;
      } catch (error) {
        return `<p class="historial-placeholder error">Error: ${error.message}</p>`;
      }
    }

    async function toggleContenido(year) {
      const allBtns = btnContainer.querySelectorAll('.historial-btn');
      if (abierto === year) {
        contenido.style.display = "none"; abierto = null;
        allBtns.forEach(b => b.classList.remove('active'));
      } else {
        contenido.style.display = "block";
        contenido.innerHTML = await fetchHistorial(year);
        abierto = year;
        allBtns.forEach(b => b.classList.remove('active'));
        const activeBtn = btnContainer.querySelector(`.historial-btn[data-year="${year}"]`);
        if(activeBtn) activeBtn.classList.add('active');
      }
    }
    
    async function loadYearButtons() {
      btnContainer.innerHTML = `<p style="color: #888;">Cargando años...</p>`;
      try {
        const response = await fetch(`${API_URL}?mode=getYears`);
        const json = await response.json();
        if (!json.years || json.years.length === 0) {
          btnContainer.innerHTML = `<p style="color: #888;">Sin datos.</p>`; return;
        }

        btnContainer.innerHTML = json.years.map(year => {
          // Obtener nombre bonito si es 2024
          const navIconText = document.querySelector('.nav-btn[data-target="historial-section"] .nav-text');
          const buttonText = (year === "2024" && navIconText) ? navIconText.textContent : `Amigo Secreto ${year}`;
          return `<button class="historial-btn" data-year="${year}">${buttonText}</button>`;
        }).join('');

        btnContainer.querySelectorAll('.historial-btn').forEach(btn => {
          btn.addEventListener("click", () => toggleContenido(btn.dataset.year));
        });
      } catch (error) {
        console.error("Error historial:", error);
        btnContainer.innerHTML = `<p class="historial-placeholder error">Error al cargar años.</p>`;
      }
    }
    loadYearButtons();
  }

  // --- PÁGINA PERFIL (Guardar Datos) ---
  function setupProfilePage() {
    const saveBtn = document.getElementById('save-profile-btn');
    const wishlistInput = document.getElementById('my-wishlist-url');
    const friendCodeInput = document.getElementById('my-steam-friend-code');

    if (!saveBtn) return;
    saveBtn.addEventListener('click', async () => {
      const newURL = wishlistInput.value.trim();
      const newCode = friendCodeInput.value.trim();
      const originalText = saveBtn.textContent;
      
      saveBtn.disabled = true; saveBtn.textContent = 'Guardando...';
      try {
        await db.collection('users').doc(currentUser.uid).update({ wishlistURL: newURL, steamCode: newCode });
        saveBtn.textContent = '¡Actualizado!';
        customAlert("Éxito", "Perfil actualizado correctamente.");
        setTimeout(() => { saveBtn.textContent = originalText; saveBtn.disabled = false; }, 2000);
      } catch (error) {
        saveBtn.textContent = 'Error';
        setTimeout(() => { saveBtn.textContent = originalText; saveBtn.disabled = false; }, 2000);
      }
    });
  }

  // --- PÁGINA LISTAS (Wishlists en Tiempo Real) ---
  function setupWishlistPage() {
    const container = document.getElementById('wishlist-container-dynamic');
    const titleElement = document.getElementById('wishlist-sorteo-title');
    if (!container) return; 
    
    // Consulta: último sorteo donde participo
    const query = db.collection('sorteos')
      .where('participantIds', 'array-contains', currentUser.uid)
      .orderBy('createdAt', 'desc').limit(1);

    if (unsubscribeWishlists) unsubscribeWishlists(); 
    if (unsubscribeUsers) unsubscribeUsers();

    unsubscribeWishlists = query.onSnapshot((rafflesSnapshot) => {
      if (rafflesSnapshot.empty) {
        titleElement.innerHTML = 'Sorteos Activos';
        container.innerHTML = '<p style="color: #888; grid-column: 1 / -1;">No estás en ningún sorteo.</p>';
        return;
      }

      const sorteoData = rafflesSnapshot.docs[0].data();
      titleElement.innerHTML = `${sorteoData.sorteoName}`;

      const allParticipants = new Map();
      sorteoData.participants.forEach(p => allParticipants.set(p.userId, p));

      // Función Renderizado
      const renderGrid = (usersMap) => {
        let finalHtml = '';
        const sorted = Array.from(allParticipants.values()).sort((a, b) => a.name.localeCompare(b.name));

        sorted.forEach(p => {
          const userDoc = usersMap[p.userId];
          const url = userDoc ? userDoc.wishlistURL : undefined;
          const friendCode = userDoc ? userDoc.steamCode : undefined; 
          let linksHtml = '';

          if (url) {
            let icon = url.includes('amazon') ? "https://upload.wikimedia.org/wikipedia/commons/4/4a/Amazon_icon.svg" : "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Steam_icon_logo.svg/2048px-Steam_icon_logo.svg.png";
            linksHtml += `<a href="${url}" target="_blank" class="wishlist-icon-link" style="margin-bottom: 8px;"><img src="${icon}"></a>`;
          }
          if (friendCode) {
            if (friendCode.includes('http')) {
               linksHtml += `<a href="${friendCode}" target="_blank" class="steam-profile-link">Ver Perfil Steam</a>`;
            } else {
               linksHtml += `
                 <button class="btn-steam-card" onclick="copyToClipboard('${friendCode}', this)">
                   <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Steam_icon_logo.svg/2048px-Steam_icon_logo.svg.png">
                   <div class="steam-info"><span class="label">CÓDIGO</span><span class="code">${friendCode}</span></div>
                   <span class="copy-icon">❐</span>
                 </button>`;
            }
          }
          if (!url && !friendCode) linksHtml = `<p class="no-wishlist">Sin datos</p>`;

          finalHtml += `
            <div class="wish-box">
              <span class="wish-name">${p.name}</span>
              <div class="wish-actions">${linksHtml}</div>
            </div>`;
        });
        container.innerHTML = finalHtml || '<p>Nadie ha agregado datos.</p>';
      };

      // Escuchar perfiles reales en tiempo real
      if (realUserIds.length > 0) {
        if (unsubscribeUsers) unsubscribeUsers();
        unsubscribeUsers = db.collection('users')
          .where(firebase.firestore.FieldPath.documentId(), 'in', realUserIds.slice(0, 10))
          .onSnapshot(usersSnapshot => {
            const usersMap = {};
            usersSnapshot.forEach(doc => usersMap[doc.id] = doc.data());
            renderGrid(usersMap);
          });
      } else {
        renderGrid({});
      }
    });
  }

  // --- PÁGINA SORTEO (Gestión) ---
  function loadAppLogic() {
    const sorteoSection = document.getElementById('sorteo-section');
    if (sorteoSection.innerHTML.trim() !== "") return; 
    
    // HTML Estático de la sección
    sorteoSection.innerHTML = `
      <div class="sorteo-container">
        <div class="sorteo-actions-card">
          <h3>Crear Sorteo</h3>
          <div class="form-group"><input type="text" id="sorteo-name" placeholder="Nombre (Ej: Navidad 2025)"></div>
          <div class="form-group-inline">
            <input type="number" id="sorteo-budget" placeholder="Presupuesto">
            <button id="suggest-budget-btn" type="button">Sugerir</button>
          </div>
          <button id="create-sorteo-btn" class="btn-primary">Crear Sorteo</button>
          <hr class="card-divider">
          <h3>Unirse a Sorteo</h3>
          <div class="form-group"><input type="text" id="sorteo-id" placeholder="ID del Sorteo"></div>
          <button id="join-sorteo-btn" class="btn-secondary">Unirme</button>
        </div>
        <div class="sorteo-list-container">
          <h2>Mis Sorteos</h2>
          <div id="sorteos-list"><p>Cargando...</p></div>
        </div>
      </div>`;
    
    // Listeners Botones Principales
    document.getElementById('create-sorteo-btn').addEventListener('click', async () => {
      const name = document.getElementById('sorteo-name').value.trim();
      const budget = Number(document.getElementById('sorteo-budget').value) || 0;
      if (!name) return customAlert("Error", "Falta el nombre.");
      try {
        const docRef = await db.collection('sorteos').add({
          sorteoName: name, budget: budget, adminId: currentUser.uid, status: 'abierto',
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          participants: [{ userId: currentUser.uid, name: currentUserName }], 
          participantIds: [currentUser.uid]
        });
        customAlert("¡Creado!", "Comparte este ID:", docRef.id);
        document.getElementById('sorteo-name').value = '';
      } catch (e) { customAlert('Error', 'No se pudo crear.'); }
    });

    document.getElementById('join-sorteo-btn').addEventListener('click', async () => {
      const id = document.getElementById('sorteo-id').value.trim();
      if (!id) return;
      const ref = db.collection('sorteos').doc(id);
      try {
        await db.runTransaction(async (t) => {
          const doc = await t.get(ref);
          if (!doc.exists) throw "No existe.";
          if (doc.data().status !== 'abierto') throw "Cerrado.";
          if (doc.data().participantIds.includes(currentUser.uid)) throw "Ya estás dentro.";
          t.update(ref, {
            participants: firebase.firestore.FieldValue.arrayUnion({ userId: currentUser.uid, name: currentUserName }),
            participantIds: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
          });
        });
        customAlert('Éxito', 'Te has unido.');
      } catch (e) { customAlert('Error', e.message || e); }
    });

    // Listeners Dinámicos (Lista de Sorteos)
    const listContainer = document.getElementById('sorteos-list');
    listContainer.addEventListener('click', (e) => {
      const t = e.target.closest('button'); if (!t) return;
      const id = t.dataset.id; const name = t.dataset.name;
      
      if (t.matches('.btn-edit-name')) handleEditName(id, name);
      if (t.matches('.btn-view-id')) customAlert("ID Sorteo", "Comparte este ID:", id);
      if (t.matches('.btn-delete-sorteo')) handleDeleteSorteo(id, name);
      if (t.matches('.btn-realizar-sorteo')) handleRealizarSorteo(id);
      if (t.matches('.btn-ver-resultado')) handleVerResultado(id);
      if (t.matches('.btn-view-all')) handleViewAllResults(id); 
    });

    // Sugerir Presupuesto (Animación)
    document.getElementById('suggest-budget-btn').addEventListener('click', (e) => {
      const btn = e.target; const input = document.getElementById('sorteo-budget');
      btn.disabled = true; let i = 0;
      const interval = setInterval(() => {
        input.value = (Math.floor(Math.random() * 8) + 3) * 1000;
        if (++i >= 20) { clearInterval(interval); btn.disabled = false; }
      }, 50);
    });
  }

  // Funciones Auxiliares Sorteo
  async function handleEditName(id, current) {
    try {
      const name = await customPrompt("Editar", "Nuevo nombre:", current);
      if (name && name !== current) await db.collection('sorteos').doc(id).update({ sorteoName: name.trim() });
    } catch (e) {}
  }
  async function handleDeleteSorteo(id, name) {
    try {
      await customConfirm("Borrar", `¿Eliminar "${name}"?`);
      const confirm = await customPrompt("Confirmar", `Escribe "${name}" para borrar:`);
      if (confirm !== name) return customAlert("Error", "Nombre incorrecto.");
      
      const batch = db.batch();
      const snaps = await db.collection('sorteos').doc(id).collection('assignments').get();
      snaps.forEach(d => batch.delete(d.ref));
      batch.delete(db.collection('sorteos').doc(id));
      await batch.commit();
    } catch (e) { if (e !== 'cancelled') customAlert("Error", "No se pudo borrar."); }
  }
  async function handleRealizarSorteo(id) {
    try {
      const doc = await db.collection('sorteos').doc(id).get();
      const parts = doc.data().participants;
      if (parts.length < 3) return customAlert("Error", "Mínimo 3 personas.");
      
      await customConfirm("¿Sortear?", "Se cerrará el sorteo.");
      
      // Algoritmo Sorteo
      let receivers = [...parts];
      let isValid = false;
      for(let t=0; t<1000 && !isValid; t++) {
        for (let i = receivers.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1)); [receivers[i], receivers[j]] = [receivers[j], receivers[i]];
        }
        isValid = parts.every((p, i) => p.userId !== receivers[i].userId && receivers.findIndex(r => r.userId === p.userId) !== i);
      }
      if (!isValid) throw new Error("No se pudo generar mezcla válida.");

      const batch = db.batch();
      parts.forEach((p, i) => {
        batch.set(db.collection('sorteos').doc(id).collection('assignments').doc(p.userId), {
          giverId: p.userId, giverName: p.name, receiverId: receivers[i].userId, receiverName: receivers[i].name
        });
      });
      batch.update(db.collection('sorteos').doc(id), { status: "realizado" });
      await batch.commit();
      customAlert("¡Listo!", "Sorteo realizado.");
    } catch (e) { if (e!=='cancelled') customAlert("Error", e.message); }
  }
  async function handleVerResultado(id) {
    const res = await db.collection('sorteos').doc(id).collection('assignments').doc(currentUser.uid).get();
    if (res.exists) customAlert("Tu Amigo Secreto", `Regalas a: <strong>${res.data().receiverName}</strong>`);
  }
  async function handleViewAllResults(id) {
    const snap = await db.collection('sorteos').doc(id).collection('assignments').get();
    const list = snap.docs.map(d => d.data()).sort((a,b) => a.giverName.localeCompare(b.giverName))
      .map(d => `<strong>${d.giverName}</strong> ➔ ${d.receiverName}`).join('<br>');
    customAlert("Resultados (Admin)", list);
  }

  function displayMySorteos() {
    const container = document.getElementById('sorteos-list');
    if (!container) return;
    if (unsubscribeSorteos) unsubscribeSorteos();
    
    unsubscribeSorteos = db.collection('sorteos').where('participantIds', 'array-contains', currentUser.uid).orderBy('createdAt', 'desc')
      .onSnapshot(snap => {
        if (snap.empty) return container.innerHTML = '<p>Sin sorteos.</p>';
        
        container.innerHTML = snap.docs.map(doc => {
          const d = doc.data();
          const isAdmin = d.adminId === currentUser.uid;
          const partsHtml = `<ul>${d.participants.map(p => `<li>${p.name}</li>`).join('')}</ul>`;
          let btns = '';

          if (isAdmin) {
            btns += `<button class="btn-icon btn-edit-name" data-id="${doc.id}" data-name="${d.sorteoName}">${iconEdit}</button>`;
            btns += `<button class="btn-icon btn-view-id" data-id="${doc.id}">${iconLink}</button>`;
            if (d.status === 'abierto') btns += `<button class="btn-icon btn-realizar-sorteo" data-id="${doc.id}" style="color:green">${iconPlay}</button>`;
            else btns += `<button class="btn-icon btn-view-all" data-id="${doc.id}">${iconView}</button>`;
            btns += `<button class="btn-icon btn-delete-sorteo" data-id="${doc.id}" data-name="${d.sorteoName}">${iconDelete}</button>`;
          } else {
            if (d.status === 'realizado') btns += `<button class="btn-icon btn-ver-resultado" data-id="${doc.id}">${iconView}</button>`;
            else btns += `<span style="font-size:0.8rem; color:#666;">Esperando...</span>`;
          }

          return `
            <div class="sorteo-card">
              <div class="sorteo-card-header">
                <div class="sorteo-card-title"><h4>${d.sorteoName}</h4><span class="status-${d.status}">${d.status}</span></div>
                <div class="admin-controls">${btns}</div>
              </div>
              <p>Presupuesto: $${d.budget}</p><p>Participantes:</p>${partsHtml}
            </div>`;
        }).join('');
      });
  }

  // ==========================================
  // 6. EFECTOS (Música y Nieve)
  // ==========================================
  
  // Audio
  const audioPlayer = document.getElementById('audio-player');
  const playBtn = document.getElementById('play-pause-btn');
  const volSlider = document.getElementById('volume-slider');
  if (audioPlayer && playBtn) {
    let isPlaying = false; audioPlayer.volume = 0.02;
    playBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
    playBtn.addEventListener('click', () => {
      if (isPlaying) { audioPlayer.pause(); playBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`; } 
      else { audioPlayer.play(); playBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`; }
      isPlaying = !isPlaying;
    });
    volSlider.addEventListener('input', e => audioPlayer.volume = e.target.value / 100);
    
    // Mostrar volumen al hover
    const audioControls = document.getElementById('audio-controls');
    const volContainer = document.getElementById('volume-container');
    if (audioControls) {
      audioControls.addEventListener('mouseenter', () => { volContainer.style.opacity = '1'; volContainer.style.pointerEvents = 'auto'; });
      audioControls.addEventListener('mouseleave', () => setTimeout(() => { volContainer.style.opacity = '0'; volContainer.style.pointerEvents = 'none'; }, 500));
    }
  }

  // Nieve
  const canvas = document.getElementById("snowfall");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    const img = new Image(); img.src = "https://static.vecteezy.com/system/resources/previews/019/922/808/non_2x/illustration-of-3d-snowflake-png.png";
    let w, h, particles = [];
    const resize = () => { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; };
    const create = () => { particles = Array.from({length: 100}, () => ({
      x: Math.random()*w, y: Math.random()*h, r: Math.random()*4+1, 
      a: Math.random()*Math.PI*2, rs: Math.random()*0.02+0.005, vx: 0, vy: Math.random()+0.5
    })); };
    const draw = () => {
      ctx.clearRect(0,0,w,h);
      particles.forEach(p => {
        p.a += p.rs; p.y += p.vy; p.y > h ? (p.y = -10, p.x = Math.random()*w) : null;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
        ctx.drawImage(img, -p.r*3, -p.r*3, p.r*6, p.r*6); ctx.restore();
      });
      requestAnimationFrame(draw);
    };
    window.addEventListener("resize", () => { resize(); create(); });
    resize(); create(); img.onload = draw;
  }

  // Revelar Amigo Secreto (Click Global)
  const contentContainer = document.getElementById('content-container');
  if (contentContainer) {
    contentContainer.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-reveal-secret');
      if (!btn) return;
      const card = btn.closest('.secret-friend-card');
      const isRev = card.classList.toggle('is-revealed');
      const nameSpan = card.querySelector('.secret-name');
      nameSpan.textContent = isRev ? btn.dataset.name : '............';
      btn.innerHTML = isRev ? iconViewOff : iconView;
    });
  }
});

// ==========================================
// 7. UTILIDADES GLOBALES (Fuera del DOMContentLoaded)
// ==========================================

// Iconos SVG Constantes
const iconEdit = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
const iconLink = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`;
const iconDelete = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
const iconPlay = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>`;
const iconView = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
const iconViewOff = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

// Copiar al portapapeles (Botón Steam)
window.copyToClipboard = function(text, btnElement) {
  navigator.clipboard.writeText(text).then(() => {
    const codeSpan = btnElement.querySelector('.code');
    const iconSpan = btnElement.querySelector('.copy-icon');
    if (!codeSpan || !iconSpan) return;

    const originalCode = codeSpan.textContent;
    const originalIcon = iconSpan.textContent;

    btnElement.classList.add('copied');
    codeSpan.textContent = "¡Copiado!";
    setTimeout(() => {
      btnElement.classList.remove('copied');
      codeSpan.textContent = originalCode;
      iconSpan.textContent = originalIcon;
    }, 2000);
  }).catch(err => alert('Tu código: ' + text));
};
