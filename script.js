// Espera a que todo el HTML esté cargado antes de ejecutar el script
document.addEventListener('DOMContentLoaded', () => {

  // --- 1. INICIALIZACIÓN DE FIREBASE ---
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
  let currentUser = null;
  let currentUserName = ''; 
  let unsubscribeSorteos = null;
  let unsubscribeWishlists = null;
  let unsubscribeUserDoc = null;
  let unsubscribeInicio = null;
  
  // --- 2. SELECTORES DE ELEMENTOS ---
  const authModal = document.getElementById('auth-modal-overlay');
  const appWrapper = document.getElementById('app-wrapper');
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  // --- Selectores del Modal de la App ---
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

// --- Lógica del Modal (basada en Promesas) ---
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

    return new Promise((resolve) => {
      modalResolve = resolve;
    });
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

  // --- 3. LÓGICA DE AUTENTICACIÓN ---
  document.getElementById('show-register').addEventListener('click', (e) => { e.preventDefault(); loginForm.style.display = 'none'; registerForm.style.display = 'block'; });
  document.getElementById('show-login').addEventListener('click', (e) => { e.preventDefault(); loginForm.style.display = 'block'; registerForm.style.display = 'none'; });

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

  document.getElementById('logout-btn').addEventListener('click', (e) => { e.preventDefault(); auth.signOut(); });

  auth.onAuthStateChanged(async (user) => {
    if (user) {
      currentUser = user;
      
      if (unsubscribeUserDoc) unsubscribeUserDoc();
      unsubscribeUserDoc = db.collection('users').doc(user.uid)
        .onSnapshot(doc => {
          if (doc.exists) {
            const userData = doc.data();
            currentUserName = userData.name || user.email;
            
            const navUsername = document.getElementById('nav-username');
            if (navUsername) navUsername.textContent = `Hola, ${currentUserName}`;
            
            // --- ACTUALIZADO: Cargar datos en los inputs del Perfil ---
            const wishlistInput = document.getElementById('my-wishlist-url');
            const friendCodeInput = document.getElementById('my-steam-friend-code'); // Nuevo

            if (wishlistInput) wishlistInput.value = userData.wishlistURL || '';
            if (friendCodeInput) friendCodeInput.value = userData.steamCode || ''; // Nuevo
          } else {
            currentUserName = user.email; // Fallback
            const navUsername = document.getElementById('nav-username');
            if (navUsername) navUsername.textContent = `Hola, ${currentUserName}`;
          }
        }, error => {
          console.error("Error al escuchar doc de usuario:", error);
          currentUserName = user.email;
        });
      
      authModal.style.display = 'none'; 
      appWrapper.style.display = 'block'; 
      
      loadAppLogic();
      setupHistorialPage();
      setupWishlistPage();
      setupProfilePage();
      setupSPANavigation();
      displayMySorteos();
      setupInicioPage();
    } else {
      currentUser = null;
      currentUserName = '';
      
      const navUsername = document.getElementById('nav-username');
      if (navUsername) navUsername.textContent = '';
      
      authModal.style.display = 'flex'; 
      appWrapper.style.display = 'none';
      if (unsubscribeSorteos) unsubscribeSorteos();
      if (unsubscribeWishlists) unsubscribeWishlists(); 
      if (unsubscribeUserDoc) unsubscribeUserDoc();
      if (unsubscribeInicio) unsubscribeInicio();
    }
  });

  // --- Algoritmos del Sorteo ---
  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
  function generatePairs(participants) {
    const n = participants.length;
    if (n < 3) throw new Error("Se necesitan al menos 3 participantes.");
    for (let t = 0; t < 10000; t++) { 
      let receivers = [...participants];
      shuffle(receivers);
      let isValid = true;
      for (let i = 0; i < n; i++) {
        if (participants[i].userId === receivers[i].userId) { isValid = false; break; }
        const myReceiverOriginalIndex = participants.findIndex(p => p.userId === receivers[i].userId);
        if (receivers[myReceiverOriginalIndex].userId === participants[i].userId) { isValid = false; break; }
      }
      if (isValid) return receivers; 
    }
    throw new Error("No se pudo generar una asignación válida. Intenta de nuevo.");
  }

  // --- (CORREGIDO) Lógica de Navegación SPA ---
  function setupSPANavigation() {
    const navButtons = document.querySelectorAll('#top-nav .nav-btn, .nav-btn-inline');
    const contentSections = document.querySelectorAll('.content-section');
    
    // Resetear la UI al iniciar sesión
    contentSections.forEach(section => section.classList.add('hidden'));
    document.querySelectorAll('#top-nav .nav-btn').forEach(b => b.classList.remove('active')); // Solo resetear botones del nav

    // Añadir los listeners de clic
    navButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        
        // +++ MODIFICACIÓN CLAVE (Arregla bug de link de Steam) +++
        // Si es un enlace externo (target="_blank"), no hacer nada y dejar que el navegador actúe
        if (btn.getAttribute('target') === '_blank') {
          return; 
        }

        // Si es un enlace de la SPA, prevenir el comportamiento por defecto
        e.preventDefault(); 
        
        const targetId = btn.dataset.target;
        if (!targetId) return; // Si no tiene data-target, no hace nada más

        // Ocultar todas las secciones
        contentSections.forEach(section => section.classList.add('hidden'));
        
        // Mostrar la sección target
        const targetSection = document.getElementById(targetId);
        if (targetSection) targetSection.classList.remove('hidden');
        
        // Actualizar clase activa en botones de la barra de navegación
        document.querySelectorAll('#top-nav .nav-btn').forEach(b => b.classList.remove('active'));
        const navBtn = document.querySelector(`#top-nav .nav-btn[data-target="${targetId}"]`);
        if(navBtn) navBtn.classList.add('active');
      });
    });
    
    // Activar la pestaña por defecto (Inicio)
    const defaultBtn = document.querySelector('#top-nav .nav-btn[data-target="inicio-section"]');
    if (defaultBtn) defaultBtn.classList.add('active');
    const defaultSection = document.getElementById('inicio-section');
    if (defaultSection) defaultSection.classList.remove('hidden');
  }

  // --- (CORREGIDO) Lógica de la Página de Historial (100% Dinámica) ---
  function setupHistorialPage() {
    const btnContainer = document.getElementById("historial-btn-container");
    const contenido = document.getElementById("historial-contenido");
    
    const API_URL = "https://script.google.com/macros/s/AKfycbzeEirq01wkJHpXJmq-8nR97m-vvalVoyB2rclZE44DJIJbrJLzTRzMA2j1mEopqnC7rg/exec"; 

    if (!btnContainer || !contenido) return;
    
    let abierto = null;
    let cacheDatos = {};

    async function fetchHistorial(year) {
      if (cacheDatos[year]) {
        return cacheDatos[year];
      }
      try {
        contenido.innerHTML = '<div class="historial-placeholder">Cargando datos...</div>';
        const response = await fetch(`${API_URL}?year=${year}`); 
        if (!response.ok) {
          throw new Error(`Error de red: ${response.status} ${response.statusText}`);
        }
        const json = await response.json();
        if (json.error) {
          throw new Error(json.error);
        }
        if (!json.data || json.data.length === 0) {
          return `<div class="historial-placeholder">🎁 ¡Próximamente! 🎄</div>`;
        }
        let html = '<div class="grid">';
        json.data.forEach(item => {
          html += `
            <div class="section-box">
              <div class="container">
                <div class="person-box">${item.Giver}</div>
                <div class="arrow">➡️</div>
                <div class="person-box">${item.Receiver}</div>
              </div>
              <a href="${item.GiftURL}" target="_blank" rel="noopener noreferrer">
                <img src="${item.ImageURL}" alt="Regalo" class="gift-image" />
              </a>
            </div>
          `;
        });
        html += '</div>';
        cacheDatos[year] = html;
        return html;
      } catch (error) {
        console.error("Error al cargar historial:", error);
        if (error.name === 'SyntaxError') {
            return `<p class.historial-placeholder.error">Error: La respuesta de la API no es JSON. Revisa los permisos.</p>`;
        }
        return `<p class="historial-placeholder error">Error al cargar los datos: ${error.message}</p>`;
      }
    }

    async function toggleContenido(year) {
      const allBtns = btnContainer.querySelectorAll('.historial-btn');
      if (abierto === year) {
        contenido.style.display = "none";
        abierto = null;
        allBtns.forEach(b => b.classList.remove('active'));
      } else {
        contenido.innerHTML = '<div class="historial-placeholder">Cargando...</div>';
        contenido.style.display = "block";
        const html = await fetchHistorial(year);
        contenido.innerHTML = html;
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
        if (!response.ok) throw new Error("Error de red al buscar años.");
        const json = await response.json();
        if (json.error) throw new Error(json.error);
        if (!json.years || json.years.length === 0) {
          btnContainer.innerHTML = `<p style="color: #888;">No se encontraron años en la base de datos.</p>`;
          return;
        }
        btnContainer.innerHTML = json.years.map(year => {
          // +++ MODIFICADO: Usa el texto del nav-btn como fallback +++
          const navBtnText = document.querySelector('#top-nav .nav-btn[data-target="historial-section"]').textContent;
          const buttonText = (year === "2024") ? navBtnText : `Amigo Secreto ${year}`;
          return `<button class="historial-btn" data-year="${year}">${buttonText}</button>`;
        }).join('');
        btnContainer.querySelectorAll('.historial-btn').forEach(btn => {
          btn.addEventListener("click", () => {
            const year = btn.dataset.year; 
            toggleContenido(year);
          });
        });
      } catch (error) {
        console.error("Error al cargar botones de año:", error);
        btnContainer.innerHTML = `<p class="historial-placeholder error">Error al cargar los años.</p>`;
      }
    }
    loadYearButtons();
  }

// --- NUEVA LÓGICA: PÁGINA DE PERFIL (Guardar datos) ---
function setupProfilePage() {
  const saveBtn = document.getElementById('save-profile-btn');
  const wishlistInput = document.getElementById('my-wishlist-url');
  const friendCodeInput = document.getElementById('my-steam-friend-code');

  if (!saveBtn || !wishlistInput || !friendCodeInput) return;

  saveBtn.addEventListener('click', async () => {
    const newURL = wishlistInput.value.trim();
    const newCode = friendCodeInput.value.trim();
    
    const originalText = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';

    try {
      // Guardamos ambos campos en el documento del usuario
      await db.collection('users').doc(currentUser.uid).update({
        wishlistURL: newURL,
        steamCode: newCode
      });
      
      saveBtn.textContent = '¡Perfil Actualizado!';
      customAlert("Éxito", "Tus datos de Steam se han guardado.");

      setTimeout(() => {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
      }, 2000);

    } catch (error) {
      console.error("Error al guardar perfil:", error);
      saveBtn.textContent = 'Error';
      customAlert("Error", "No se pudo guardar tu perfil.");
      setTimeout(() => {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
      }, 3000);
    }
  });
}

  function setupWishlistPage() {
  const container = document.getElementById('wishlist-container-dynamic');
  const titleElement = document.getElementById('wishlist-sorteo-title');
  
  if (!container || !titleElement) return; 
  
  const query = db.collection('sorteos')
    .where('participantIds', 'array-contains', currentUser.uid)
    .orderBy('createdAt', 'desc')
    .limit(1);

  if (unsubscribeWishlists) unsubscribeWishlists(); 

  unsubscribeWishlists = query.onSnapshot(async (rafflesSnapshot) => {
    container.innerHTML = '<p style="color: #888; grid-column: 1 / -1;">Cargando listas...</p>';
    
    if (rafflesSnapshot.empty) {
      titleElement.innerHTML = '🎁 Tus Sorteos 🎁';
      container.innerHTML = '<p style="color: #888; grid-column: 1 / -1;">No estás en ningún sorteo.</p>';
      return;
    }

    const sorteoDoc = rafflesSnapshot.docs[0];
    const sorteoData = sorteoDoc.data();
    titleElement.innerHTML = `${sorteoData.sorteoName}`;

    const allParticipants = new Map();
    rafflesSnapshot.forEach(doc => {
      doc.data().participants.forEach(p => {
        allParticipants.set(p.userId, p); 
      });
    });

    const realUserIds = Array.from(allParticipants.keys()).filter(id => !id.startsWith('fake_'));
    const usersMap = {};

    if (realUserIds.length > 0) {
      try {
        const usersQuery = await db.collection('users')
          .where(firebase.firestore.FieldPath.documentId(), 'in', realUserIds)
          .get();
        usersQuery.forEach(doc => {
          usersMap[doc.id] = doc.data();
        });
      } catch (error) {
        console.error("Error al buscar perfiles:", error);
      }
    }

    let finalHtml = '';
    const sortedParticipants = Array.from(allParticipants.values()).sort((a, b) => a.name.localeCompare(b.name));

    sortedParticipants.forEach(participant => {
      const name = participant.name;
      const userDoc = usersMap[participant.userId]; 
      const url = userDoc ? userDoc.wishlistURL : undefined;
      const friendCode = userDoc ? userDoc.steamCode : undefined; 

      let linksHtml = '';

      // 1. Icono de Wishlist (Si puso URL)
      if (url) {
        let icon = "https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Steam_icon_logo.svg/2048px-Steam_icon_logo.svg.png"; 
        if (url.includes('amazon')) icon = "https://upload.wikimedia.org/wikipedia/commons/4/4a/Amazon_icon.svg";
        // Nota: Agregamos style margin-bottom para separarlo un poco de la tarjeta
        linksHtml += `
          <a href="${url}" target="_blank" rel="noopener noreferrer" title="Ver Lista de Deseos" class="wishlist-icon-link" style="margin-bottom: 8px;">
            <img src="${icon}" alt="Wishlist">
          </a>
        `;
      }

      // 2. Tarjeta de Código de Amigo (OPCIÓN 1: STEAM CARD)
      if (friendCode) {
        if (friendCode.includes('http')) {
             // Si por error pusieron un link completo, mostramos enlace simple
             linksHtml += `<a href="${friendCode}" target="_blank" class="steam-profile-link">Ver Perfil Steam</a>`;
        } else {
             // AQUÍ ESTÁ EL CAMBIO: Usamos la estructura de tarjeta oscura
             linksHtml += `
               <button class="btn-steam-card" onclick="copyToClipboard('${friendCode}', this)">
                 <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Steam_icon_logo.svg/2048px-Steam_icon_logo.svg.png" alt="Steam">
                 <div class="steam-info">
                   <span class="label">Friend Code</span>
                   <span class="code">${friendCode}</span>
                 </div>
                 <span class="copy-icon">❐</span>
               </button>
             `;
        }
      }

      if (!url && !friendCode) {
         linksHtml = `<p class="no-wishlist">Sin datos</p>`;
      }

      finalHtml += `
        <div class="wish-box">
          <span class="wish-name">${name}</span>
          <div class="wish-actions">
            ${linksHtml}
          </div>
        </div>
      `;
    });
    
    container.innerHTML = finalHtml;
    if (finalHtml === '') {
      container.innerHTML = '<p style="color: #888; grid-column: 1 / -1;">Nadie ha agregado datos todavía.</p>';
    }
  }, (error) => {
    console.error("Error:", error);
    container.innerHTML = '<p style="color: red;">Error al cargar.</p>';
  });
}

  function displayMySorteos() {
    const sorteosListDiv = document.getElementById('sorteos-list');
    if (!sorteosListDiv) return;
    if (unsubscribeSorteos) unsubscribeSorteos();

    const iconEdit = `<svg fill="currentColor" enable-background="new 0 0 64 64" viewBox="0 0 64 64" xml:space="preserve" xmlns="http://www.w3.org/2000/svg"><g><path d="M55.736,13.636l-4.368-4.362c-0.451-0.451-1.044-0.677-1.636-0.677c-0.592,0-1.184,0.225-1.635,0.676l-3.494,3.484 l7.639,7.626l3.494-3.483C56.639,15.998,56.639,14.535,55.736,13.636z"/><polygon points="21.922,35.396 29.562,43.023 50.607,22.017 42.967,14.39 "/><polygon points="20.273,37.028 18.642,46.28 27.913,44.654 "/><path d="M41.393,50.403H12.587V21.597h20.329l5.01-5H10.82c-1.779,0-3.234,1.455-3.234,3.234v32.339 c0,1.779,1.455,3.234,3.234,3.234h32.339c1.779,0,3.234-1.455,3.234-3.234V29.049l-5,4.991V50.403z"/></g></svg>`;
    const iconLink = `<svg fill="currentColor" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><path d="M11.9474,19a4.9476,4.9476,0,0,1-3.4991-8.4465l5.1053-5.1043a4.9482,4.9482,0,0,1,6.9981,6.9976l-.5523.5526-1.4158-1.4129.5577-.5579a2.95,2.95,0,0,0-.0039-4.1653,3.02,3.02,0,0,0-4.17,0l-5.1047,5.104a2.9474,2.9474,0,0,0,0,4.1692,3.02,3.02,0,0,0,4.17,0l1.4143,1.4145A4.9176,4.9176,0,0,1,11.9474,19Z"/><path d="M19.9474,17a4.9476,4.9476,0,0,1-3.4991-8.4465l.5526-.5526,1.4143,1.4146-.5526.5523a2.9476,2.9476,0,0,0,0,4.1689,3.02,3.02,0,0,0,4.17,0c.26-.26,4.7293-4.7293,5.1053-5.1045a2.951,2.951,0,0,0,0-4.1687,3.02,3.02,0,0,0-4.17,0L21.5536,3.449a4.9483,4.9483,0,0,1,6.9981,6.9978c-.3765.376-4.844,4.8428-5.1038,5.1035A4.9193,4.9193,0,0,1,19.9474,17Z"/><path d="M24,30H4a2.0021,2.0021,0,0,1-2-2V8A2.0021,2.0021,0,0,1,4,6H8V8H4V28H24V18h2V28A2.0021,2.0021,0,0,1,24,30Z"/></svg>`;
    const iconTrash = `<svg fill="currentColor" enable-background="new 0 0 91 91" viewBox="0 0 91 91" xml:space="preserve" xmlns="http://www.w3.org/2000/svg"><g><path d="M67.305,36.442v-8.055c0-0.939-0.762-1.701-1.7-1.701H54.342v-5.524c0-0.938-0.761-1.7-1.699-1.7h-12.75 c-0.939,0-1.701,0.762-1.701,1.7v5.524H26.93c-0.939,0-1.7,0.762-1.7,1.701v8.055c0,0.938,0.761,1.699,1.7,1.699h0.488v34.021 c0,0.938,0.761,1.7,1.699,1.7h29.481c3.595,0,6.52-2.924,6.52-6.518V38.142h0.486C66.543,38.142,67.305,37.381,67.305,36.442z M41.592,22.862h9.35v3.824h-9.35V22.862z M61.719,67.345c0,1.719-1.4,3.117-3.12,3.117h-27.78v-32.32l30.9,0.002V67.345z M63.904,34.742H28.629v-4.655h11.264h12.75h11.262V34.742z"/><rect height="19.975" width="3.4" x="36.066" y="44.962"/><rect height="19.975" width="3.4" x="44.566" y="44.962"/><rect height="19.975" width="3.4" x="53.066" y="44.962"/></g></svg>`;
    const iconViewAll = `<svg fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" /><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.022 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" /></svg>`;

    const query = db.collection('sorteos')
      .where('participantIds', 'array-contains', currentUser.uid)
      .orderBy('createdAt', 'desc');
      
    unsubscribeSorteos = query.onSnapshot(snapshot => {
      sorteosListDiv.innerHTML = ''; 
      if (snapshot.empty) {
        sorteosListDiv.innerHTML = '<p style="color: #888;">No participas en ningún sorteo. ¡Crea o únete a uno!</p>';
        return;
      }
      
      snapshot.forEach(doc => {
        const sorteo = doc.data();
        const sorteoId = doc.id;
        const isUserAdmin = sorteo.adminId === currentUser.uid;
        
        const card = document.createElement('div');
        card.className = 'sorteo-card';
        
        let adminControlsHTML = '';
        if (isUserAdmin) {
          adminControlsHTML = `
            <div class="admin-controls">
              <button class="btn-icon btn-edit-name" data-id="${sorteoId}" data-name="${sorteo.sorteoName}" title="Editar Nombre">${iconEdit}</button>
              <button class="btn-icon btn-view-id" data-id="${sorteoId}" title="Ver ID para Compartir">${iconLink}</button>
          `;
          if (sorteo.status === 'realizado') {
            adminControlsHTML += `<button class="btn-icon btn-view-all" data-id="${sorteoId}" title="Ver todos los resultados (Admin)">${iconViewAll}</button>`;
          }
          adminControlsHTML += `
              <button class="btn-icon btn-delete-sorteo" data-id="${sorteoId}" data-name="${sorteo.sorteoName}" title="Borrar Sorteo">${iconTrash}</button>
            </div>
          `;
        }

        const statusClass = `status-${sorteo.status}`;
        const cardHeader = `
          <div class="sorteo-card-header">
            <div class="sorteo-card-title">
              <h4>${sorteo.sorteoName}</h4>
              <span class="${statusClass}">${sorteo.status}</span>
            </div>
            ${adminControlsHTML}
          </div>
        `;
        
        const participantsHTML = sorteo.participants.map(p => {
          const isAdminTag = sorteo.adminId === p.userId ? ' (Admin)' : '';
          return `<li>${p.name}${isAdminTag}</li>`;
        }).join('');

        const budgetHTML = sorteo.budget > 0 
          ? `<p style="font-weight: 600; color: #333;">Presupuesto: <span style="color: var(--btn-green);">$${sorteo.budget.toLocaleString('es-CL')}</span></p>`
          : '';
        
        let buttonsHTML = '';
        if (sorteo.status === 'abierto') {
          if (isUserAdmin) {
            buttonsHTML = `<button class="btn-primary btn-realizar-sorteo" data-id="${sorteoId}">¡Realizar Sorteo!</button>`;
          } else {
            buttonsHTML = `<button class="btn-secondary" disabled>Esperando al admin</button>`;
          }
        } else {
          buttonsHTML = `<button class="btn-secondary btn-ver-resultado" data-id="${sorteoId}">Ver mi Amigo Secreto</button>`;
        }
        
        card.innerHTML = `
          ${cardHeader}
          ${budgetHTML} 
          <p>Participantes (${sorteo.participants.length}):</p>
          <ul>${participantsHTML}</ul>
          <div class="sorteo-card-actions">
            ${buttonsHTML}
          </div>
        `;
        
        sorteosListDiv.appendChild(card);
      });
    }, error => {
      console.error("Error al cargar sorteos: ", error);
      sorteosListDiv.innerHTML = '<p style="color: red;">Error al cargar los sorteos.</p>';
    });
  }
  
  // --- Funciones para los botones de las tarjetas ---
  
  async function handleEditName(sorteoId, currentName) {
    try {
      const newName = await customPrompt("Editar Nombre", "Introduce el nuevo nombre para el sorteo:", currentName);
      if (newName && newName.trim() !== "" && newName !== currentName) {
        await db.collection('sorteos').doc(sorteoId).update({ sorteoName: newName.trim() });
        customAlert("Éxito", "Nombre actualizado.");
      }
    } catch (error) {
      if (error !== 'cancelled') console.error("Error editando:", error);
    }
  }

  async function handleDeleteSorteo(sorteoId, sorteoName) {
    try {
      await customConfirm("¿Borrar Sorteo?", `¿Seguro que quieres borrar "${sorteoName}"? Esta acción no se puede deshacer.`, "Borrar");
      const confirmationName = await customPrompt("Confirmación Final", `Escribe el nombre del sorteo para confirmar: "${sorteoName}"`);
      if (confirmationName !== sorteoName) {
         return customAlert("Cancelado", "El nombre no coincide. No se ha borrado.");
      }
      const assignmentsRef = db.collection('sorteos').doc(sorteoId).collection('assignments');
      const assignmentsSnapshot = await assignmentsRef.get();
      const batch = db.batch();
      assignmentsSnapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();

      await db.collection('sorteos').doc(sorteoId).delete();
    } catch (error) {
       if (error !== 'cancelled') {
         console.error("Error borrando:", error);
         customAlert("Error", "No se pudo borrar el sorteo.");
       }
    }
  }

  async function handleRealizarSorteo(sorteoId) {
    try {
      const sorteoRef = db.collection('sorteos').doc(sorteoId);
      const sorteoDoc = await sorteoRef.get();
      const participants = sorteoDoc.data().participants;

      if (participants.length < 3) {
        return customAlert("Error", "Se necesitan al menos 3 participantes para realizar el sorteo.");
      }

      await customConfirm("¿Realizar Sorteo?", `Se asignarán las parejas para ${participants.length} personas y se cerrará el sorteo. ¿Continuar?`);
      
      const assignments = generatePairs(participants);
      
      const batch = db.batch();
      participants.forEach((giver, i) => {
        const receiver = assignments[i];
        const assignmentRef = sorteoRef.collection('assignments').doc(giver.userId);
        batch.set(assignmentRef, {
          giverId: giver.userId,
          giverName: giver.name,
          receiverId: receiver.userId,
          receiverName: receiver.name
        });
      });
      batch.update(sorteoRef, { status: "realizado" });
      await batch.commit();
      
      customAlert("¡Sorteo Realizado!", "¡Ya puedes ver tu amigo secreto!");
    } catch (error) {
      if (error !== 'cancelled') {
        console.error("Error al realizar sorteo:", error);
        customAlert("Error", "Error: " + error.message);
      }
    }
  }

  async function handleVerResultado(sorteoId) {
    try {
      const resultDoc = await db.collection('sorteos').doc(sorteoId).collection('assignments').doc(currentUser.uid).get();
      if (!resultDoc.exists) {
        return customAlert("Error", "No se encontró tu asignación.");
      }
      const result = resultDoc.data();
      customAlert("Tu Amigo Secreto es...", `¡Te toca regalarle a ${result.receiverName}!`);
    } catch (error) {
      console.error("Error al ver resultado:", error);
      customAlert("Error", "No se pudo obtener el resultado.");
    }
  }

  async function handleViewAllResults(sorteoId) {
    try {
      const assignmentsRef = db.collection('sorteos').doc(sorteoId).collection('assignments');
      const snapshot = await assignmentsRef.get();
      
      if (snapshot.empty) {
        return customAlert("Error", "No se encontraron asignaciones. Esto no debería pasar.");
      }

      const assignments = [];
      snapshot.forEach(doc => {
        assignments.push(doc.data());
      });

      assignments.sort((a, b) => a.giverName.localeCompare(b.giverName));
      
      let resultsList = assignments.map(data => {
        return `<strong>${data.giverName}</strong> ➔ ${data.receiverName}`;
      }).join('<br>'); 

      customAlert("Resultados (Modo Dios)", resultsList);

    } catch (error) {
      console.error("Error al ver todos los resultados:", error);
      customAlert("Error", "No se pudieron cargar los resultados.");
    }
  }


  // --- 4. LÓGICA DE LA APP (Conexión de botones) ---
  function loadAppLogic() {
    const sorteoSection = document.getElementById('sorteo-section');
    if (sorteoSection.innerHTML.trim() !== "") return; 
    
    sorteoSection.innerHTML = `
      <div class="sorteo-container">
        <div class="sorteo-actions-card">
          <h3>Crear Sorteo</h3>
          <p>Inicia un nuevo grupo de amigo secreto.</p>
          <div class="form-group">
            <input type="text" id="sorteo-name" placeholder="Nombre del Sorteo (Ej: Navidad 2025)">
          </div>
          
          <div class="form-group-inline">
            <input type="number" id="sorteo-budget" placeholder="Presupuesto (Ej: 10000)">
            <button id="suggest-budget-btn" type="button">Sugerir</button>
          </div>
          
          <button id="create-sorteo-btn" class="btn-primary">Crear Sorteo</button>
          <hr class="card-divider">
          <h3>Unirse a Sorteo</h3>
          <p>¿Te invitaron? Ingresa el ID aquí.</p>
          <div class="form-group"><input type="text" id="sorteo-id" placeholder="Pegar ID del Sorteo"></div>
          <button id="join-sorteo-btn" class="btn-secondary">Unirme</button>

          <div id="test-environment-box">
            <h4>🧪 Entorno de Pruebas</h4>
            <button id="add-fakes-btn">Añadir 5 Fakes al Sorteo Reciente</button>
          </div>

        </div>
        
        <div class="sorteo-list-container">
          <h2>Mis Sorteos</h2>
          <div id="sorteos-list">
            <p style="color: #888;">Cargando tus sorteos...</p>
          </div>
        </div>
      </div>
    `;
    
    // --- Conexión de botones ---
    document.getElementById('create-sorteo-btn').addEventListener('click', async () => {
      const sorteoNameInput = document.getElementById('sorteo-name');
      const sorteoName = sorteoNameInput.value.trim();
      const sorteoBudgetInput = document.getElementById('sorteo-budget');
      const sorteoBudget = Number(sorteoBudgetInput.value) || 0; 

      if (!sorteoName) return customAlert("Error", "Por favor, dale un nombre al sorteo.");
      
      try {
        const newSorteoRef = await db.collection('sorteos').add({
          sorteoName: sorteoName,
          budget: sorteoBudget,
          adminId: currentUser.uid,
          status: 'abierto',
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          participants: [{ userId: currentUser.uid, name: currentUserName }], 
          participantIds: [currentUser.uid]
        });
        
        customAlert("¡Sorteo Creado!", "Comparte este ID con tus amigos:", newSorteoRef.id);
        sorteoNameInput.value = '';
        sorteoBudgetInput.value = '';
      } catch (error) {
        console.error("Error al crear sorteo: ", error);
        customAlert('Error', 'Hubo un error al crear el sorteo.');
      }
    });

    document.getElementById('join-sorteo-btn').addEventListener('click', async () => {
      const sorteoIdInput = document.getElementById('sorteo-id');
      const sorteoId = sorteoIdInput.value.trim();
      if (!sorteoId) return customAlert("Error", "Por favor, ingresa el ID del sorteo.");
      const sorteoRef = db.collection('sorteos').doc(sorteoId);
      try {
        await db.runTransaction(async (t) => {
          const doc = await t.get(sorteoRef);
          if (!doc.exists) throw "¡El sorteo no existe!";
          const data = doc.data();
          if (data.status !== 'abierto') throw "Este sorteo ya no acepta nuevos participantes.";
          if (data.participantIds.includes(currentUser.uid)) throw "¡Ya estás en este sorteo!";
          t.update(sorteoRef, {
            participants: firebase.firestore.FieldValue.arrayUnion({ userId: currentUser.uid, name: currentUserName }),
            participantIds: firebase.firestore.FieldValue.arrayUnion(currentUser.uid)
          });
        });
        customAlert('Éxito', '¡Te has unido al sorteo con éxito!');
        sorteoIdInput.value = '';
      } catch (error) {
        console.error("Error al unirse: ", error);
        customAlert('Error al unirse', (error.message || error)); 
      }
    });

    document.getElementById('suggest-budget-btn').addEventListener('click', (e) => {
      e.preventDefault(); 
      const budgetInput = document.getElementById('sorteo-budget');
      const suggestBtn = e.target;
      
      suggestBtn.disabled = true;
      suggestBtn.textContent = '...';

      function getRandomBudget() {
        return (Math.floor(Math.random() * 8) + 3) * 1000; // 3000 a 10000
      }

      let count = 0;
      const intervalTime = 50;
      const iterations = 30; // 1.5 segundos
      
      const interval = setInterval(() => {
        const randomNum = getRandomBudget();
        budgetInput.value = randomNum; 
        count++;
        if (count >= iterations) {
          clearInterval(interval);
          suggestBtn.disabled = false;
          suggestBtn.textContent = 'Sugerir';
        }
      }, intervalTime);
    });

    document.getElementById('add-fakes-btn').addEventListener('click', async () => {
      try {
        const query = db.collection('sorteos')
          .where('adminId', '==', currentUser.uid);
          
        const snapshot = await query.get();
        if (snapshot.empty) {
          return customAlert("Error", "No se encontró ningún sorteo tuyo. Crea uno primero.");
        }
        
        const sorteosAbiertos = snapshot.docs
          .map(doc => ({ ref: doc.ref, data: doc.data() }))
          .filter(sorteo => sorteo.data.status === 'abierto');
          
        if (sorteosAbiertos.length === 0) {
          return customAlert("Error", "No tienes ningún sorteo 'abierto' para añadir fakes.");
        }
        
        sorteosAbiertos.sort((a, b) => {
          const timeA = a.data.createdAt ? a.data.createdAt.seconds : 0;
          const timeB = b.data.createdAt ? b.data.createdAt.seconds : 0;
          return timeB - timeA;
        });
        
        const sorteoRef = sorteosAbiertos[0].ref; 
        
        const fakeParticipants = [
          { userId: 'fake_001', name: 'Goku' },
          { userId: 'fake_002', name: 'Vegeta' },
          { userId: 'fake_003', name: 'Piccolo' },
          { userId: 'fake_004', name: 'Gohan' },
          { userId: 'fake_005', name: 'Krillin' }
        ];
        const fakeParticipantIds = fakeParticipants.map(p => p.userId);

        await sorteoRef.update({
          participants: firebase.firestore.FieldValue.arrayUnion(...fakeParticipants),
          participantIds: firebase.firestore.FieldValue.arrayUnion(...fakeParticipantIds)
        });
        
        customAlert("¡Éxito!", "5 Guerreros Z han sido añadidos a tu sorteo más reciente.");
        
      } catch (error) {
        console.error("Error al añadir fakes:", error);
        customAlert("Error", "No se pudieron añadir los participantes fake.");
      }
    });
    
    // El listener para la lista vuelve a estar aquí
    const sorteosListContainer = document.getElementById('sorteos-list');
    if (sorteosListContainer) {
      sorteosListContainer.addEventListener('click', (e) => {
        const target = e.target.closest('button'); 
        if (!target) return;

        const sorteoId = target.dataset.id;
        const sorteoName = target.dataset.name;

        if (target.matches('.btn-edit-name')) handleEditName(sorteoId, sorteoName);
        if (target.matches('.btn-view-id')) customAlert("ID para Compartir", "Copia este ID y envíalo a tus amigos:", sorteoId);
        if (target.matches('.btn-delete-sorteo')) handleDeleteSorteo(sorteoId, sorteoName);
        if (target.matches('.btn-realizar-sorteo')) handleRealizarSorteo(sorteoId);
        if (target.matches('.btn-ver-resultado')) handleVerResultado(sorteoId);
        if (target.matches('.btn-view-all')) handleViewAllResults(sorteoId); 
      });
    }
  }

  // --- 5. LÓGICA DE MÚSICA Y EFECTOS ---
  
  // --- Música ---
  const audioPlayer = document.getElementById('audio-player');
  const volumeSlider = document.getElementById('volume-slider');
  const playPauseBtn = document.getElementById('play-pause-btn');
  if (audioPlayer && volumeSlider && playPauseBtn) {
    audioPlayer.volume = 0.02;
    volumeSlider.value = 2;
    const playIcon = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
    const pauseIcon = `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
    let isPlaying = false;
    playPauseBtn.innerHTML = playIcon;
    playPauseBtn.setAttribute("aria-label", "Reproducir música");
    playPauseBtn.addEventListener('click', () => {
      if (isPlaying) {
        audioPlayer.pause();
        playPauseBtn.innerHTML = playIcon;
        playPauseBtn.setAttribute("aria-label", "Reproducir música");
      } else {
        audioPlayer.play().catch(err => { console.warn('Error al reproducir audio:', err.message); });
        playPauseBtn.innerHTML = pauseIcon;
        playPauseBtn.setAttribute("aria-label", "Pausar música");
      }
      isPlaying = !isPlaying;
    });
    volumeSlider.addEventListener('input', (e) => {
      audioPlayer.volume = e.target.value / 100;
    });
    audioPlayer.addEventListener('ended', () => {
      isPlaying = false;
      playPauseBtn.innerHTML = playIcon;
      playPauseBtn.setAttribute("aria-label", "Reproducir música");
    });
  }
  const audioControls = document.getElementById('audio-controls');
  const volumeContainer = document.getElementById('volume-container');
  if (audioControls && volumeContainer) {
    let hideTimeout;
    audioControls.addEventListener('mouseenter', () => {
      clearTimeout(hideTimeout);
      volumeContainer.style.opacity = '1';
      volumeContainer.style.pointerEvents = 'auto';
    });
    audioControls.addEventListener('mouseleave', () => {
      hideTimeout = setTimeout(() => {
        volumeContainer.style.opacity = '0';
        volumeContainer.style.pointerEvents = 'none';
      }, 500);
    });
  }
  
  // --- Nieve ---
  const snowflakeImage = new Image();
  snowflakeImage.src = "https://static.vecteezy.com/system/resources/previews/019/922/808/non_2x/illustration-of-3d-snowflake-png.png";
  const canvas = document.getElementById("snowfall");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    let width, height;
    let particles = [];
    let animationFrameId;
    let mouse = { x: -100, y: -100 };
    window.addEventListener("mousemove", e => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    });
    function resize() {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    }
    function createSnowflakes() {
      particles = [];
      for (let i = 0; i < 100; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          r: Math.random() * 4 + 1,
          angle: Math.random() * Math.PI * 2,
          rotationSpeed: Math.random() * 0.02 + 0.005,
          vx: 0,
          vy: Math.random() * 1 + 0.5
        });
      }
    }
    function updateSnowflakes() {
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.angle += p.rotationSpeed;
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = 80;
        if (dist < minDist) {
          const force = (minDist - dist) / minDist;
          const angle = Math.atan2(dy, dx);
          p.vx += Math.cos(angle) * force * 0.5;
          p.vy += Math.sin(angle) * force * 0.5;
        }
        p.vy += 0.02;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.98;
        p.vy *= 0.995;
        if (p.y > height) {
          p.y = -10;
          p.x = Math.random() * width;
          p.vy = Math.random() * 1 + 0.5;
        }
        if (p.x > width) p.x = 0;
        else if (p.x < 0) p.x = width;
      }
    }
    function drawSnowflakes() {
      ctx.clearRect(0, 0, width, height);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.drawImage(snowflakeImage, -p.r * 3, -p.r * 3, p.r * 6, p.r * 6);
        ctx.restore();
      }
      updateSnowflakes();
      animationFrameId = requestAnimationFrame(drawSnowflakes);
    }
    window.addEventListener("resize", () => {
      resize();
      createSnowflakes();
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        if (!animationFrameId) drawSnowflakes();
      } else {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    });
    resize();
    createSnowflakes();
    if (snowflakeImage.complete) {
      drawSnowflakes();
    } else {
      snowflakeImage.onload = () => drawSnowflakes();
    }
  }

  // +++ Listener de clic para el botón de revelar en la página de INICIO +++
  const contentContainer = document.getElementById('content-container');
  if (contentContainer) {
    contentContainer.addEventListener('click', (e) => {
      const revealBtn = e.target.closest('.btn-reveal-secret');
      if (!revealBtn) return;

      const card = revealBtn.closest('.secret-friend-card');
      const nameSpan = card.querySelector('.secret-name');
      const realName = revealBtn.dataset.name;
      const isRevealed = card.classList.toggle('is-revealed');

      if (isRevealed) {
        nameSpan.textContent = realName;
        revealBtn.innerHTML = iconViewOff;
        revealBtn.setAttribute('title', 'Ocultar');
      } else {
        nameSpan.textContent = '............';
        revealBtn.innerHTML = iconView;
        revealBtn.setAttribute('title', 'Revelar');
      }
    });
  }

});

// --- Función Global para Copiar (Estilo Steam Card) ---
window.copyToClipboard = function(text, btnElement) {
  // 1. Copiar al portapapeles
  navigator.clipboard.writeText(text).then(() => {
    
    // 2. Buscar los elementos internos de la tarjeta para animarlos
    const codeSpan = btnElement.querySelector('.code');
    const iconSpan = btnElement.querySelector('.copy-icon');

    // Protección: Si por alguna razón no los encuentra, no hacemos nada visual (para no romper)
    if (!codeSpan || !iconSpan) return;

    // 3. Guardar texto original
    const originalCode = codeSpan.textContent;
    const originalIcon = iconSpan.textContent;

    // 4. Aplicar estado de "Éxito"
    btnElement.classList.add('copied'); // Se pone verde
    codeSpan.textContent = "¡Copiado!";

    // 5. Revertir después de 2 segundos
    setTimeout(() => {
      btnElement.classList.remove('copied');
      codeSpan.textContent = originalCode;
      iconSpan.textContent = originalIcon;
    }, 2000);

  }).catch(err => {
    console.error('Error al copiar:', err);
    alert('No se pudo copiar automáticamente. Tu código es: ' + text);
  });
};