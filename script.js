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

  // --- Configuración EmailJS ---
  const EMAILJS_PUBLIC_KEY = "v4qFF6nN5LGvbBUaE"; 
  const EMAILJS_SERVICE_ID = "service_6i6amwr"; 
  const EMAILJS_TEMPLATE_ID = "template_qyvzkld"; 

  // Inicializar EmailJS una sola vez al cargar
  try {
    emailjs.init(EMAILJS_PUBLIC_KEY);
    console.log("EmailJS inicializado correctamente.");
  } catch (e) {
    console.error("Error inicializando EmailJS:", e);
  }

  // --- Estado Global ---
  let currentUser = null;
  let currentUserName = '';
  let isGuestMode = false;
  
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
    
    // Aseguramos que el botón Aceptar se muestre (por si el Loading lo ocultó antes)
    appModal.confirmBtn.classList.remove('hidden');

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

  // Muestra un modal de carga SIN botones
  function showLoadingModal(title, message) {
    appModal.title.textContent = title;
    appModal.message.innerHTML = `
      <div style="text-align:center;">
        <div class="loading" style="margin: 0 auto 1rem auto; opacity: 1;"></div>
        <div>${message}</div>
      </div>
    `;
    // OCULTAMOS LOS BOTONES
    appModal.confirmBtn.classList.add('hidden');
    appModal.cancelBtn.classList.add('hidden');
    appModal.promptContainer.classList.add('hidden');
    appModal.overlay.classList.remove('hidden');
  }

  // ==========================================
  // TOGGLE PASSWORD (VER/OCULTAR)
  // ==========================================
  function setupPasswordToggle(btnId, inputId) {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    
    if (!btn || !input) return;

    // Iconos SVG
    const eyeOpen = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    const eyeClosed = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

    btn.addEventListener('click', (e) => {
      e.preventDefault(); // Evita submit
      
      if (input.type === 'password') {
        input.type = 'text';
        btn.innerHTML = eyeClosed; // Cambiar a ojo tachado
        btn.style.color = "var(--nav-bg)"; // Resaltar color
      } else {
        input.type = 'password';
        btn.innerHTML = eyeOpen;   // Cambiar a ojo normal
        btn.style.color = "#9ca3af"; // Color normal
      }
    });
  }

  // Inicializar para Login y Registro
  setupPasswordToggle('toggle-login-pass', 'login-password');
  setupPasswordToggle('toggle-register-pass', 'register-password');

// ==========================================
  // 2.5 SISTEMA DE ENVÍO DE EMAILS CON EMAILJS (MEJORADO)
  // ==========================================
async function sendSecretFriendEmail(toEmail, toName, secretFriendName, sorteoName, budget) {
    if (!toEmail || !toEmail.includes('@') || toEmail.length < 5) {
      console.warn(`⚠️ Email inválido detectado para ${toName}: ${toEmail}`);
      throw new Error(`Dirección de correo inválida: ${toEmail}`);
    }

    try {
      const templateParams = {
        to_name: toName,
        secret_friend_name: secretFriendName,
        sorteo_name: sorteoName,
        budget: String(budget),
        to_email: toEmail 
      };

      console.log(`📤 Iniciando envío a: ${toEmail} (${toName})...`);

      const response = await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        templateParams
      );

      if (response.status === 200) {
        console.log(`✅ Enviado correctamente a ${toName}!`);
        return response;
      } else {
        throw new Error(`EmailJS respondió con estado: ${response.status}`);
      }

    } catch (error) {
      const errorMsg = error.text || error.message || JSON.stringify(error);
      console.error(`❌ FALLÓ envío a ${toName} (${toEmail}). Razón:`, errorMsg);
      throw error; 
    }
  }

async function sendEmailsToAllParticipants(sorteoId, sorteoData) {
    try {
      const assignmentsSnap = await db.collection('sorteos')
        .doc(sorteoId)
        .collection('assignments')
        .get();

      let successCount = 0;
      let failedEmails = [];
      const total = assignmentsSnap.docs.length;

      console.log(`🚀 Iniciando proceso masivo para ${total} participantes...`);

      for (let i = 0; i < total; i++) {
        const assignmentDoc = assignmentsSnap.docs[i];
        const assignment = assignmentDoc.data();
        
        console.log(`[${i + 1}/${total}] Procesando: ${assignment.giverName}...`);

        const participant = sorteoData.participants.find(p => p.userId === assignment.giverId);
        
        if (!participant) {
          console.warn(`⚠️ Participante no encontrado en datos: ${assignment.giverName}`);
          continue;
        }

        let userEmail = null;

        if (participant.hasAccount) {
          try {
            const userDoc = await db.collection('users').doc(assignment.giverId).get();
            if (userDoc.exists) {
              userEmail = userDoc.data().email;
              console.log(`   👤 Usuario registrado encontrado. Email: ${userEmail}`);
            } else {
              console.warn(`   ⚠️ Usuario registrado pero sin documento en BD: ${assignment.giverName}`);
            }
          } catch (err) {
            console.error('   ❌ Error leyendo email de BD:', err);
          }
        } else {
          userEmail = participant.email;
          console.log(`   📝 Usuario manual. Email: ${userEmail}`);
        }

        if (userEmail) {
          try {
            await sendSecretFriendEmail(
              userEmail,
              assignment.giverName,
              assignment.receiverName,
              sorteoData.sorteoName,
              sorteoData.budget
            );
            successCount++;
          } catch (emailError) {
            console.error(`   ❌ Falló envío a ${userEmail}`);
            failedEmails.push(`${assignment.giverName} (Error envío)`);
          }
        } else {
          console.warn(`   ⚠️ No hay email para: ${assignment.giverName} (Se saltó el envío)`);
          failedEmails.push(`${assignment.giverName} (Sin email)`);
        }

        if (i < total - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      return {
        success: successCount,
        failed: failedEmails,
        total: total
      };

    } catch (error) {
      console.error('❌ Error crítico en el loop de correos:', error);
      throw error;
    }
  }

  // ==========================================
  // 3. AUTENTICACIÓN (Login / Registro / Logout)
  // ==========================================
  
  document.getElementById('show-register').addEventListener('click', (e) => { e.preventDefault(); loginForm.style.display = 'none'; registerForm.style.display = 'block'; });
  document.getElementById('show-login').addEventListener('click', (e) => { e.preventDefault(); loginForm.style.display = 'block'; registerForm.style.display = 'none'; });

  document.getElementById('register-btn').addEventListener('click', async () => {
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    
    if (!name || !email || !password) return customAlert("Faltan datos", "Por favor completa todos los campos.");

    try {
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      await db.collection('users').doc(cred.user.uid).set({ name, email, wishlistURL: "" });
      // El onAuthStateChanged se encargará de cerrar el modal
    } catch (error) {
      // AQUÍ USAMOS EL TRADUCTOR
      appModal.overlay.classList.add('hidden'); // Ocultar loading si hubo error
      customAlert("No se pudo registrar", getFriendlyErrorMessage(error)); 
    }
  });

  document.getElementById('login-btn').addEventListener('click', async () => {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) return customAlert("Faltan datos", "Ingresa tu correo y contraseña.");

    try {
      await auth.signInWithEmailAndPassword(email, password);
      // El onAuthStateChanged se encargará del resto
    } catch (error) {
      // AQUÍ USAMOS EL TRADUCTOR
      appModal.overlay.classList.add('hidden'); // Ocultar loading si hubo error
      customAlert("Error de acceso", getFriendlyErrorMessage(error)); 
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

  // ==========================================
  // FUNCIÓN DE SALIDA (LOGOUT)
  // ==========================================
  const handleLogout = (e) => { 
    e.preventDefault(); 
    
    if (isGuestMode) {
      // Si es invitado, recargamos la página para volver al inicio
      window.location.reload();
    } else {
      // Si es usuario real, cerramos sesión en Firebase
      auth.signOut(); 
    }
  };

  const btnLogoutMobile = document.getElementById('logout-btn');
  if(btnLogoutMobile) btnLogoutMobile.addEventListener('click', handleLogout);

  const btnLogoutPC = document.getElementById('logout-btn-pc');
  if(btnLogoutPC) btnLogoutPC.addEventListener('click', handleLogout);

  // --- MONITOR DE ESTADO (Auth State Observer) ---
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      // 1. SI HAY USUARIO (LOGIN REAL):
      // Aseguramos desactivar el modo invitado y limpiar estilos
      isGuestMode = false;
      document.body.classList.remove('guest-mode');

      currentUser = user;
      
      // Cancelar listener anterior si existía
      if (unsubscribeUserDoc) unsubscribeUserDoc();

      // Escuchar cambios en el documento del usuario (Nombre, Wishlist, SteamCode)
      unsubscribeUserDoc = db.collection('users').doc(user.uid)
        .onSnapshot(doc => {
          if (doc.exists) {
            const userData = doc.data();
            currentUserName = userData.name || 'Usuario';
            
            // Actualizar nombre en la barra de navegación (PC y Móvil)
            const usernamePC = document.getElementById('nav-username-pc');
            const usernameMobile = document.getElementById('nav-username');
            if (usernamePC) usernamePC.textContent = currentUserName;
            if (usernameMobile) usernameMobile.textContent = currentUserName;

            // Rellenar campos de perfil si existen
            const wishUrlInput = document.getElementById('my-wishlist-url');
            if (wishUrlInput && userData.wishlistURL) wishUrlInput.value = userData.wishlistURL;

            const steamCodeInput = document.getElementById('my-steam-friend-code');
            if (steamCodeInput && userData.steamFriendCode) steamCodeInput.value = userData.steamFriendCode;
          }
        });

      // Ocultar modal de login y mostrar la app
      authModal.style.display = 'none';
      appWrapper.style.display = 'block';
      
      // Iniciar la lógica de la aplicación
      initApp();

    } else {
      // 2. SI NO HAY USUARIO (LOGOUT O CARGA INICIAL):
      
      // 🛑 IMPORTANTE: Si estamos en Modo Invitado, NO bloqueamos la app.
      // Solo reseteamos la vista si NO es invitado.
      if (!isGuestMode) {
        currentUser = null;
        currentUserName = '';
        document.body.classList.remove('guest-mode');

        // Limpiar todos los listeners de Firebase para evitar errores
        if (unsubscribeUserDoc) { unsubscribeUserDoc(); unsubscribeUserDoc = null; }
        if (unsubscribeSorteos) { unsubscribeSorteos(); unsubscribeSorteos = null; }
        if (unsubscribeWishlists) { unsubscribeWishlists(); unsubscribeWishlists = null; }
        if (unsubscribeInicio) { unsubscribeInicio(); unsubscribeInicio = null; }
        if (unsubscribeUsers) { unsubscribeUsers(); unsubscribeUsers = null; }

        // Mostrar modal de login y ocultar la app
        authModal.style.display = 'flex';
        appWrapper.style.display = 'none';
      }
    }
  });

  // ==========================================
  // LÓGICA MODO INVITADO (NUEVO)
  // ==========================================
  const btnGuest = document.getElementById('guest-login-btn');
  if (btnGuest) {
    btnGuest.addEventListener('click', (e) => {
      e.preventDefault();
      isGuestMode = true;

      // 1. Configurar usuario "falso" para evitar errores
      currentUser = { uid: 'guest-user', email: 'invitado@visita.com' };
      currentUserName = 'Visitante';

      // 2. Actualizar UI
      document.body.classList.add('guest-mode');
      
      const usernamePC = document.getElementById('nav-username-pc');
      const usernameMobile = document.getElementById('nav-username');
      if (usernamePC) usernamePC.textContent = "Modo Visita";
      if (usernameMobile) usernameMobile.textContent = "Modo Visita";

      // 3. Ocultar login y mostrar app
      authModal.style.display = 'none';
      appWrapper.style.display = 'block';

      // 4. Iniciar app y forzar navegación a Historial
      initApp();
      
    });
  }

// ==========================================
  // 4. NAVEGACIÓN INTERNA (CORREGIDA)
  // ==========================================
  function initApp() {
    const sections = document.querySelectorAll('.content-section');
    const navBtns = document.querySelectorAll('.nav-btn, .nav-btn-inline, .btn-link-mini');

    function showSection(target) {
      sections.forEach(s => s.classList.add('hidden'));
      
      const targetSection = document.getElementById(target);
      if (targetSection) targetSection.classList.remove('hidden');
      
      navBtns.forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll(`.nav-btn[data-target="${target}"]`).forEach(btn => btn.classList.add('active'));

      if (target === 'sorteo-section') loadSorteoSection();
      if (target === 'deseos-section') loadDeseosSection();
      if (target === 'historial-section') loadHistorialSection();
      if (target === 'inicio-section') loadInicioSection();
    }

    navBtns.forEach(btn => {
      btn.addEventListener('click', e => {
        if (btn.dataset.target) {
          e.preventDefault();
          const target = btn.dataset.target;
          showSection(target);
        }
      });
    });
    showSection('inicio-section');
  }

/* ==========================================
   FUNCIÓN: CARGAR SECCIÓN INICIO (AMIGO SECRETO)
   ========================================== */
function loadInicioSection() {
  const container = document.getElementById('secret-friend-container');
  if (!container) return;

  // Si es modo invitado, no buscamos datos personales
  if (isGuestMode) return; 

  if (unsubscribeInicio) unsubscribeInicio();
  
  unsubscribeInicio = db.collection('sorteos')
    .where('participantIds', 'array-contains', currentUser.uid)
    .where('status', '==', 'realizado')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .onSnapshot(snap => {
      if (snap.empty) {
        container.innerHTML = '<p style="text-align:center; color:#888;">Aún no tienes sorteos activos.</p>';
        return;
      }
      const sorteoDoc = snap.docs[0];
      const sorteoData = sorteoDoc.data();
      
      db.collection('sorteos').doc(sorteoDoc.id).collection('assignments').doc(currentUser.uid).get()
        .then(assignmentDoc => {
          if (!assignmentDoc.exists) {
            container.innerHTML = '<p>No se encontró tu asignación.</p>';
            return;
          }
          const assignment = assignmentDoc.data();
          
          /* --- TARJETA DEFINITIVA --- */
          container.innerHTML = `
            <div class="secret-friend-card">
              
              <div class="card-header-top" style="display: flex; justify-content: space-between; align-items: center; padding: 1.2rem 2.5rem;">
                
                <div class="header-title-group" style="display:flex; align-items:center; gap:15px;">
                  <div style="background:#fffbeb; padding:10px; border-radius:12px; font-size:1.8rem; line-height:1; box-shadow:0 2px 5px rgba(0,0,0,0.05);">🎁</div>
                  <div>
                    <span style="display:block; font-size:0.7rem; color:#9ca3af; font-weight:800; letter-spacing:1px; margin-bottom: 3px; text-transform:uppercase;">Sorteo Actual</span>
                    <h2 style="margin:0; font-size:1.5rem; color:var(--nav-bg); line-height:1; font-weight:800;">${sorteoData.sorteoName}</h2>
                  </div>
                </div>
                
                <div style="display:flex; align-items:center; gap:20px;">
                   
                   <div style="display:flex; flex-direction:column; align-items:center;">
                      <span style="font-size:0.65rem; font-weight:700; color:#9ca3af; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px;">Presupuesto Mínimo</span>
                      <div class="header-budget" style="font-size: 1.1rem; padding: 5px 15px; border: 2px solid var(--accent-gold); color: #92400e; border-radius: 50px; font-weight: 700; background: #fffbeb;">
                        💰 $${sorteoData.budget}
                      </div>
                   </div>

                   <div style="width:1px; height:35px; background:#e5e7eb;"></div>

                   <button class="btn-reveal-secret" data-name="${assignment.receiverName}" 
                      style="width:52px !important; height:52px !important; background:var(--accent-gold) !important; border:none !important; box-shadow: 0 4px 15px rgba(212, 175, 55, 0.3); border-radius: 50%; padding:0; display:flex; align-items:center; justify-content:center; cursor:pointer;">
                      <div style="color: white; display: flex; align-items: center; justify-content: center;">
                        ${iconView}
                      </div>
                   </button>
                </div>

              </div>

              <div class="card-body-reveal" style="padding: 3rem 2rem; min-height:180px;">
                <div class="reveal-label" style="opacity:0.6; margin-bottom: 1rem;">LE REGALAS A:</div>
                
                <div class="reveal-content-row" style="width: 100%; justify-content: center;">
                   <span class="secret-name" style="font-size: clamp(1rem, 5vw, 2.8rem) !important; white-space: nowrap !important; overflow: visible !important;">******</span>
                </div>
              </div>

            </div>
          `;
        });
    });
}

  // ==========================================
  // SECCIÓN LISTAS DE DESEOS (Con Bloqueo < 3)
  // ==========================================
  function loadDeseosSection() {
    // --- GUARDIA: Si es invitado, salimos ---
    if (isGuestMode) return;

    const container = document.getElementById('wishlist-container-dynamic');
    const title = document.getElementById('wishlist-sorteo-title');
    
    if (!container) return;
    
    if (unsubscribeWishlists) unsubscribeWishlists();
    if (unsubscribeUsers) unsubscribeUsers(); 
    
    unsubscribeWishlists = db.collection('sorteos')
      .where('participantIds', 'array-contains', currentUser.uid)
      .where('status', '==', 'realizado')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .onSnapshot(snap => {
        if (snap.empty) {
          container.innerHTML = `
            <div style="text-align:center; padding:3rem; color:#9ca3af;">
              <p style="font-size:2rem; margin-bottom:10px;">📭</p>
              <p>Aún no hay sorteos realizados para ver listas.</p>
            </div>`;
          return;
        }
        
        const sorteoDoc = snap.docs[0];
        const data = sorteoDoc.data();
        const participants = data.participants || [];
        
        if (title) title.textContent = `🎁 ${data.sorteoName} 🎁`;

        const registeredParticipants = participants.filter(p => p.hasAccount);

        if (registeredParticipants.length <= 3) {
           container.innerHTML = `
            <div style="text-align:center; padding:4rem 2rem; opacity:0.5;">
              <p style="font-size:3rem; margin-bottom:1rem; filter: grayscale(1);">⛔</p>
              <p style="font-size:0.9rem;">Las listas de deseos son públicas solo cuando hay<br><strong>más de 3 participantes con cuentas creadas</strong> en el sorteo.</p>
            </div>
           `;
           return; 
        }

        const participantIds = registeredParticipants.map(p => p.userId);
        
        if (unsubscribeUsers) unsubscribeUsers();
        
        unsubscribeUsers = db.collection('users')
          .where(firebase.firestore.FieldPath.documentId(), 'in', participantIds)
          .onSnapshot(usersSnap => {
            
            if (usersSnap.empty) {
              container.innerHTML = '<p>No se encontraron datos de usuarios.</p>';
              return;
            }

            const wishlistCards = usersSnap.docs.map(doc => {
              const userData = doc.data();
              const name = userData.name || 'Usuario';
              const wishlistURL = userData.wishlistURL || '';
              const steamCode = userData.steamFriendCode || '';
              const isMe = doc.id === currentUser.uid; 

              let steamHtml = '';
              if (steamCode) {
                steamHtml = `
                  <div style="margin-top: auto; padding-top: 15px; border-top: 1px solid #eee; width: 100%;">
                    <p style="margin: 0 0 5px 0; font-size: 0.75rem; color: #999; text-transform:uppercase; letter-spacing:0.5px; font-weight:700;">Steam Friend Code</p>
                    <button class="btn-steam-code" onclick="copyToClipboard('${steamCode}', this)" title="Copiar código">
                      <span class="code">${steamCode}</span>
                      <span class="copy-icon">📋</span>
                    </button>
                  </div>
                `;
              }

              let listBtnHtml = '';
              if (wishlistURL) {
                listBtnHtml = `
                  <a href="${wishlistURL}" target="_blank" rel="noopener noreferrer" class="btn-wishlist">
                    Ver Lista de Deseos ↗
                  </a>`;
              } else {
                listBtnHtml = `
                  <div style="background:#f3f4f6; color:#9ca3af; padding:10px; border-radius:8px; font-size:0.9rem; text-align:center;">
                    Sin lista configurada
                  </div>`;
              }

              const borderStyle = isMe ? 'border: 2px solid var(--nav-bg);' : '';
              const badgeMe = isMe ? '<span style="background:var(--nav-bg); color:white; font-size:0.7rem; padding:2px 6px; border-radius:4px; vertical-align:middle; margin-left:5px;">TÚ</span>' : '';

              return `
                <div class="wishlist-card" style="${borderStyle}">
                  <div style="margin-bottom: 15px;">
                    <h4 style="margin:0; font-size:1.2rem; display:flex; align-items:center; gap:5px;">
                      ${name} ${badgeMe}
                    </h4>
                  </div>
                  
                  <div style="flex-grow:1; display:flex; flex-direction:column; gap:10px; margin-bottom:15px;">
                    ${listBtnHtml}
                  </div>

                  ${steamHtml}
                </div>
              `;
            }).join('');
            
            container.innerHTML = wishlistCards;
          });
      });
  }

// ==========================================
  // SECCIÓN HISTORIAL (LÓGICA GLOBAL Y ACCESIBLE)
  // ==========================================
  
  // Variables globales para el Historial (ahora accesibles por Sorteo y Menu)
  let firebaseHistoryData = []; 
  let currentSelectedYear = null;
  const MY_API_URL = "https://script.google.com/macros/s/AKfycbzeEirq01wkJHpXJmq-8nR97m-vvalVoyB2rclZE44DJIJbrJLzTRzMA2j1mEopqnC7rg/exec"; 

  // 1. Función principal para inicializar botones de años
  async function initHistory() {
    const btnContainer = document.getElementById('historial-btn-container');
    const contenidoDiv = document.getElementById('historial-contenido');
    
    if (!btnContainer || !contenidoDiv) return;

    // Spinner de carga inicial
    btnContainer.innerHTML = `
      <div style="display:flex; justify-content:center; gap:10px; align-items:center; width:100%; padding:10px;">
         <div style="width:20px; height:20px; border:3px solid var(--nav-bg); border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite;"></div>
         <span style="color:var(--nav-bg); font-weight:600;">Cargando años...</span>
      </div>`;

    try {
      // A. Obtener años de la API Antigua
      const apiPromise = fetch(`${MY_API_URL}?mode=getYears`)
        .then(res => res.json())
        .then(data => data.years || [])
        .catch(() => []);

      let fbYears = [];
      let apiYears = [];
      
      // B. Obtener años de Firebase solo si NO es modo invitado
      if (!isGuestMode) {
        const firebasePromise = db.collection('sorteos')
          .where('participantIds', 'array-contains', currentUser.uid)
          .where('status', '==', 'finalizado')
          .orderBy('createdAt', 'desc')
          .get()
          .then(snap => {
            firebaseHistoryData = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            return firebaseHistoryData.map(s => {
              const date = s.createdAt ? s.createdAt.toDate() : new Date();
              return date.getFullYear(); 
            });
          });
        
        [apiYears, fbYears] = await Promise.all([apiPromise, firebasePromise]);
      } else {
        // En modo invitado, solo usamos la API
        apiYears = await apiPromise;
        fbYears = [];
      }
      
      // C. Unir y limpiar duplicados
      const allYearsRaw = [...apiYears, ...fbYears].map(y => String(y));
      const uniqueYears = [...new Set(allYearsRaw)];
      const allYears = uniqueYears.map(y => parseInt(y)).sort((a, b) => a - b);

      // Limpiar contenedor y aplicar estilos
      btnContainer.innerHTML = ''; 
      btnContainer.style.cssText = 'display:flex !important; flex-direction:row !important; justify-content:center !important; flex-wrap:wrap !important; gap:15px !important; width:100% !important; padding:20px 0 !important;';

      if (allYears.length === 0) {
        btnContainer.innerHTML = '<p style="color:#888; width:100%; text-align:center;">No hay historial disponible aún.</p>';
        contenidoDiv.style.display = 'none';
        return;
      }
      
      renderYearButtons(allYears); 

      // Mensaje de bienvenida del historial
      contenidoDiv.style.display = 'block';
      contenidoDiv.innerHTML = `
        <div style="text-align: center; padding: 4rem 2rem; background: white; border-radius: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <svg style="width: 80px; height: 80px; margin: 0 auto 1.5rem; opacity: 0.3;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
          </svg>
          <h3 style="color: var(--nav-bg); font-size: 1.5rem; margin-bottom: 0.5rem; font-weight: 700;">📅 Selecciona un año</h3>
          <p style="color: var(--text-secondary); font-size: 1rem; margin: 0;">Haz clic en uno de los botones de arriba para ver el historial.</p>
        </div>
      `;

    } catch (error) {
      console.error("Error historial:", error);
      btnContainer.innerHTML = '<p style="text-align:center; color:red;">Error cargando historial.</p>';
    }
  }

  // 2. Función para cargar datos de un año específico
  async function loadYearData(year) {
  const btnContainer = document.getElementById('historial-btn-container');
  const contenidoDiv = document.getElementById('historial-contenido');

  // 1. Lógica de Toggle (Deselección)
  if (currentSelectedYear === year) {
    currentSelectedYear = null;
    btnContainer.querySelectorAll('button').forEach(b => {
      b.style.background = ''; 
      b.style.color = '';
      b.style.transform = '';
    });
    contenidoDiv.innerHTML = `
      <div style="text-align: center; padding: 4rem 2rem; background: white; border-radius: 20px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
        <h3 style="color: var(--nav-bg); font-size: 1.5rem; margin-bottom: 0.5rem; font-weight: 700;">📅 Selecciona un año</h3>
        <p style="color: var(--text-secondary); font-size: 1rem; margin: 0;">Haz clic en uno de los botones de arriba para ver el historial.</p>
      </div>`;
    return;
  }

  currentSelectedYear = year;
  
  // 2. Actualizar estado visual de los botones (Fila horizontal)
  btnContainer.querySelectorAll('button').forEach(b => {
    if (parseInt(b.textContent) === year) {
      b.style.background = 'var(--nav-bg)';
      b.style.color = 'white';
      b.style.transform = 'scale(1.05)';
    } else {
      b.style.background = ''; 
      b.style.color = '';
      b.style.transform = '';
    }
  });

  contenidoDiv.innerHTML = `<div style="text-align: center; padding: 1.8rem;"><span style="color: var(--nav-bg); font-weight: 600;">⏳ Cargando Amigo Secreto ${year} </span></div>`;

  try {
    // 3. CONSULTA EXCLUSIVA A GOOGLE SCRIPT
    // No usamos Firebase aquí para los datos, solo tu API externa.
    const response = await fetch(`${MY_API_URL}?year=${year}`);
    const rawData = await response.json();
    const finalData = rawData.data || rawData;

    if (!Array.isArray(finalData) || finalData.length === 0) {
      contenidoDiv.innerHTML = `
        <div style="text-align:center; padding:2rem;">
          <p>No se encontraron datos en el Script de Google para el año ${year}.</p>
        </div>`;
      return;
    }

   // Localiza este bloque dentro de loadYearData(year) en script.js
const cardsHtml = finalData.map(row => {
  const giver = row.Giver || row.giver || "???";
  const receiver = row.Receiver || row.receiver || "???";
  const imgUrl = row.ImageURL || row.imageURL || 'https://res.cloudinary.com/djhgmmdjx/image/upload/v1762920149/cornenavidad_lxtqh3.webp';
  
  // Extraemos el link del regalo (GiftURL es la columna C de tu Excel)
  const giftLink = row.GiftURL || row.gifturl || "#";

  return `
    <div class="history-card">
      <a href="${giftLink}" target="_blank" rel="noopener noreferrer" class="card-link-overlay"></a>
      
      <div class="history-header">
        <div class="name-badge">${giver}</div>
        <div class="arrow-badge">➔</div>
        <div class="name-badge">${receiver}</div>
      </div>
      <div class="history-image-wrapper">
        <img src="${imgUrl}" alt="Foto del Amigo Secreto" loading="lazy">
      </div>
    </div>
  `;
}).join('');

    contenidoDiv.innerHTML = `
      <div class="history-section-container">
        <div class="history-year-title">🎄 Amigo Secreto ${year} 🎄</div>
        <div class="history-grid">
          ${cardsHtml}
        </div>
      </div>
    `;

  } catch (error) {
    console.error("Error al consultar Google Script:", error);
    contenidoDiv.innerHTML = `<p style="color:red; text-align:center; padding:2rem;">Error al conectar con el servidor de Google.</p>`;
  }
  }

  // 3. Renderizar botones
  function renderYearButtons(years) {
    const btnContainer = document.getElementById('historial-btn-container');
    years.forEach(year => {
      const btn = document.createElement('button');
      btn.textContent = year;
      btn.className = 'btn-historial-year'; 
      
      // Estilos forzados para asegurar horizontalidad
      btn.style.setProperty('width', 'auto', 'important');
      btn.style.setProperty('min-width', '140px', 'important');
      btn.style.setProperty('display', 'inline-flex', 'important');
      btn.style.setProperty('justify-content', 'center', 'important');
      btn.style.setProperty('align-items', 'center', 'important');
      btn.style.setProperty('flex', '0 0 auto', 'important');
      
      btn.onclick = () => loadYearData(year);
      btnContainer.appendChild(btn);
    });
  }

  // 4. Función de Entrada del Menú
  function loadHistorialSection() {
    const btnContainer = document.getElementById('historial-btn-container');
    const contenidoDiv = document.getElementById('historial-contenido');
    
    if (!btnContainer || !contenidoDiv) return;

    // Si está vacío, inicializamos. Si ya tiene botones, no hacemos nada (mantenemos estado).
    if (btnContainer.innerHTML === '') {
       contenidoDiv.style.display = 'none'; 
       initHistory();
    }
  }


  // ==========================================
  // 5. SORTEOS (Crear, Editar, Realizar, Ver)
  // ==========================================
  
  // Función para editar participantes manuales (Lápiz)
  async function handleEditParticipant(sorteoId, userId, currentEmail) {
    try {
      // 1. Pedir nuevo email
      const newEmail = await customPrompt("Corregir Email", "Ingresa el correo correcto:", currentEmail || "");
      if (newEmail === null) return; // Usuario canceló

      // 2. Validar
      const emailClean = newEmail.trim();
      if (!emailClean || !emailClean.includes('@')) {
        return customAlert("Error", "Debes ingresar un correo válido.");
      }

      // 3. Buscar y actualizar en Firebase
      const docRef = db.collection('sorteos').doc(sorteoId);
      const doc = await docRef.get();
      if (!doc.exists) throw new Error("Sorteo no encontrado");

      const data = doc.data();
      const participants = data.participants || [];
      const index = participants.findIndex(p => p.userId === userId);
      
      if (index === -1) throw new Error("Participante no encontrado");

      participants[index].email = emailClean;
      await docRef.update({ participants: participants });

      customAlert("¡Listo!", "El correo ha sido actualizado correctamente.");

    } catch (error) {
      if (error !== 'cancelled') {
        console.error(error);
        customAlert("Error", "No se pudo actualizar el correo.");
      }
    }
  }
  // Exponerla al HTML para que funcione el onclick
  window.handleEditParticipant = handleEditParticipant;

function loadSorteoSection() {
    const sorteoSec = document.getElementById('sorteo-section');
    if (!sorteoSec) return;

    // En modo invitado, mostrar interfaz similar pero sin botones de crear/unirse
    if (isGuestMode) {
      sorteoSec.innerHTML = `
        <div class="section-header">
          <h2>Sorteos</h2>
          <div style="display:flex; flex-direction:column; gap:15px; align-items:center; width:100%;">
            <div style="text-align: center; padding: 15px; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 12px; color: #92400e; width: 100%; max-width: 600px;">
              <strong>👋 Modo Invitado:</strong> Puedes explorar los sorteos finalizados. Para participar, necesitas iniciar sesión.
            </div>
            <button id="btn-toggle-finalized" class="btn-secondary">Ver Finalizados</button>
          </div>
        </div>
        <div id="sorteos-list"></div>
      `;
      
      // Toggle Finalizados para invitados
      const toggleBtn = document.getElementById('btn-toggle-finalized');
      const listContainer = document.getElementById('sorteos-list');
      toggleBtn.addEventListener('click', () => {
        const isShowing = listContainer.classList.toggle('show-finalized');
        if (isShowing) {
          toggleBtn.textContent = "Ocultar Finalizados";
          toggleBtn.style.borderColor = "var(--nav-bg)";
          toggleBtn.style.color = "var(--nav-bg)";
        } else {
          toggleBtn.textContent = "Ver Finalizados";
          toggleBtn.style.borderColor = "#d1d5db";
          toggleBtn.style.color = "#6b7280";
        }
      });
      
      // DELEGACIÓN DE EVENTOS para invitados
      sorteoSec.addEventListener('click', async (e) => {
        const btn = e.target.closest('.btn-go-history');
        if (!btn) return;

        const year = parseInt(btn.dataset.year);
        
        // Cambiar a sección de historial
        document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('[data-target="historial-section"]').forEach(b => b.classList.add('active'));
        
        document.getElementById('sorteo-section').classList.add('hidden');
        const histSec = document.getElementById('historial-section');
        histSec.classList.remove('hidden');
        
        const btnContainer = document.getElementById('historial-btn-container');
        if (!btnContainer || btnContainer.innerHTML === '') {
            await initHistory();
        }
        
        setTimeout(() => {
            const yearButtons = btnContainer.querySelectorAll('button');
            const targetButton = Array.from(yearButtons).find(b => b.textContent == year);
            
            if (targetButton) {
                targetButton.click();
            } else {
                console.warn('No se encontró el botón del año:', year);
                currentSelectedYear = year;
                loadYearData(year);
            }
        }, 100);
      });
      
      // Cargar los sorteos inmediatamente (estarán ocultos hasta hacer clic en Ver Finalizados)
      displayMySorteos();
      
      return;
    }

    sorteoSec.innerHTML = `
      <div class="section-header">
        <h2>Sorteos</h2>
        <div style="display:flex; flex-direction:column; gap:15px; align-items:center; width:100%;">
          <div style="display:flex; gap:15px; justify-content:center; flex-wrap:wrap; width:100%;">
             <button id="btn-new-sorteo" class="btn-primary" style="margin:0;">+ Nuevo Sorteo</button>
             <button id="btn-join-sorteo" class="btn-secondary" style="margin:0;">🔗 Unirse con Código</button>
          </div>
          <button id="btn-toggle-finalized" class="btn-secondary">Ver Finalizados</button>
        </div>
      </div>
      <div id="sorteos-list"></div>
    `;

    document.getElementById('btn-new-sorteo').addEventListener('click', handleNewSorteo);
    document.getElementById('btn-join-sorteo').addEventListener('click', handleJoinSorteo);

    // Toggle Finalizados
    const toggleBtn = document.getElementById('btn-toggle-finalized');
    const listContainer = document.getElementById('sorteos-list');
    toggleBtn.addEventListener('click', () => {
      const isShowing = listContainer.classList.toggle('show-finalized');
      if (isShowing) {
        toggleBtn.textContent = "Ocultar Finalizados";
        toggleBtn.style.borderColor = "var(--nav-bg)";
        toggleBtn.style.color = "var(--nav-bg)";
      } else {
        toggleBtn.textContent = "Ver Finalizados";
        toggleBtn.style.borderColor = "#d1d5db";
        toggleBtn.style.color = "#6b7280";
      }
    });
    
    // DELEGACIÓN DE EVENTOS
    sorteoSec.addEventListener('click', async (e) => {
      // Aquí detectamos si hicieron clic en el botón de historial
      const btn = e.target.closest('[data-id]') || e.target.closest('.btn-go-history');
      if (!btn) return;

// Lógica del botón 📁: Detecta el año y simula clic en el botón del año correspondiente
      if (btn.classList.contains('btn-go-history')) {
          const year = parseInt(btn.dataset.year); // Lee el año guardado en el botón
          
          // 1. Cambiar visualmente la pestaña activa en el menú
          document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
          document.querySelectorAll('[data-target="historial-section"]').forEach(b => b.classList.add('active'));
          
          // 2. Ocultar sorteos y mostrar sección de historial
          document.getElementById('sorteo-section').classList.add('hidden');
          const histSec = document.getElementById('historial-section');
          histSec.classList.remove('hidden');
          
          // 3. Inicializar el historial si no está inicializado
          const btnContainer = document.getElementById('historial-btn-container');
          if (!btnContainer || btnContainer.innerHTML === '') {
              await initHistory();
          }
          
          // 4. SIMULAR CLIC EN EL BOTÓN DEL AÑO
          // Esperamos un momento para que los botones se rendericen
          setTimeout(() => {
              const yearButtons = btnContainer.querySelectorAll('button');
              const targetButton = Array.from(yearButtons).find(b => b.textContent == year);
              
              if (targetButton) {
                  // Simular clic real en el botón del año
                  targetButton.click();
              } else {
                  // Fallback si no se encuentra el botón (no debería pasar)
                  console.warn('No se encontró el botón del año:', year);
                  currentSelectedYear = year;
                  loadYearData(year);
              }
          }, 100);
          
          return;
      }

      // Resto de botones
      const id = btn.dataset.id;
      if (!id) return;
      
      if (btn.classList.contains('btn-edit-name')) await handleEditName(id, btn.dataset.name);
      else if (btn.classList.contains('btn-view-id')) await handleViewId(id);
      else if (btn.classList.contains('btn-add-participant-manual')) await handleAddParticipantManual(id);
      else if (btn.classList.contains('btn-realizar-sorteo')) await handleRealizarSorteo(id);
      else if (btn.classList.contains('btn-reset-sorteo')) await handleResetSorteo(id);
      else if (btn.classList.contains('btn-delete-sorteo')) await handleDeleteSorteo(id, btn.dataset.name);
      else if (btn.classList.contains('btn-ver-resultado')) await handleVerResultado(id);
      else if (btn.classList.contains('btn-finalizar-sorteo')) await handleFinalizarSorteo(btn.dataset.id, btn.dataset.name);
    });

    displayMySorteos();
}

  async function handleJoinSorteo() {
    try {
      // 1. Pedir el código
      const code = await customPrompt("Unirse a un Sorteo", "Ingresa el ID del sorteo:", "");
      if (!code) return;
      
      const cleanId = code.trim();
      showLoadingModal("Verificando...", "Buscando coincidencias seguras...");

      const docRef = db.collection('sorteos').doc(cleanId);
      const doc = await docRef.get();

      if (!doc.exists) {
        return customAlert("Error", "No existe ningún sorteo con ese ID.");
      }

      const data = doc.data();
      
      // A. Si ya está dentro, avisar
      if (data.participantIds.includes(currentUser.uid)) {
        return customAlert("¡Ya estás dentro!", "Ya formas parte de este sorteo. Búscalo en tu lista de Inicio o Sorteos.");
      }

      // B. SEGURIDAD: Buscar si existe un participante manual con MI MISMO EMAIL
      // currentUser.email viene de Firebase Auth
      const myEmail = currentUser.email.toLowerCase();
      
      const manualMatch = data.participants.find(p => 
        !p.hasAccount && // Que sea manual
        p.email &&       // Que tenga email
        p.email.toLowerCase() === myEmail // Que coincida con el mío
      );

      // C. Lógica de decisión
      if (manualMatch) {
        // --- CASO 1: ENCONTRAMOS COINCIDENCIA DE EMAIL (Anti-Pillo) ---
        const confirm = await customConfirm(
          "Perfil Encontrado", 
          `Hemos encontrado al participante manual <strong>"${manualMatch.name}"</strong> con tu correo (${myEmail}).<br><br>¿Deseas vincular este perfil a tu cuenta para ver tu amigo secreto?`,
          "Sí, soy yo"
        ).catch(() => false);

        if (confirm) {
          showLoadingModal("Vinculando...", "Transfiriendo tu amigo secreto...");
          await claimManualProfile(cleanId, data, manualMatch);
          customAlert("¡Vinculado!", "Tu perfil ha sido actualizado. Ahora puedes ver tu amigo secreto en la sección de Inicio.");
        }
        
      } else {
        // --- CASO 2: NO HAY COINCIDENCIA ---
        // Si el sorteo YA se realizó, no podemos dejar entrar a gente nueva "porque sí".
        if (data.status === 'realizado') {
          return customAlert(
            "Acceso Denegado", 
            `Este sorteo ya fue realizado. <br><br>
             <strong>¿Eres un participante manual?</strong><br>
             Tu correo de registro (${myEmail}) no coincide con ningún participante manual de este sorteo.<br><br>
             <strong>Solución:</strong> Pide al administrador que edite tu participante manual y ponga tu correo exacto.`
          );
        }

        // Si el sorteo está ABIERTO, sí dejamos entrar como nuevo participante
        const confirmNew = await customConfirm(
          "Unirse como Nuevo",
          "No encontramos un perfil manual vinculado a tu correo. ¿Quieres unirte como un participante NUEVO?",
          "Unirme"
        ).catch(() => false);

        if (confirmNew) {
          const newParticipant = {
            userId: currentUser.uid,
            name: currentUserName,
            hasAccount: true,
            email: currentUser.email
          };

          await docRef.update({
            participantIds: firebase.firestore.FieldValue.arrayUnion(currentUser.uid),
            participants: firebase.firestore.FieldValue.arrayUnion(newParticipant)
          });
          customAlert("¡Listo!", "Te has unido al sorteo exitosamente.");
        }
      }

    } catch (error) {
      if (error !== 'cancelled') {
        console.error(error);
        customAlert("Error", "Ocurrió un problema al intentar unirse.");
      }
    }
  }

  // Función para convertir un perfil manual en uno real (Migración)
  async function claimManualProfile(sorteoId, sorteoData, manualParticipant) {
    const oldId = manualParticipant.userId;
    const newId = currentUser.uid;
    const batch = db.batch();
    const sorteoRef = db.collection('sorteos').doc(sorteoId);

    // 1. Actualizar array de participantes
    // Quitamos el viejo y ponemos el nuevo (con los mismos datos pero hasAccount: true y nuevo ID)
    const updatedParticipants = sorteoData.participants.map(p => {
      if (p.userId === oldId) {
        return {
          ...p,
          userId: newId,
          hasAccount: true,
          // Actualizamos el nombre al de la cuenta real por consistencia, o dejamos el que tenía
          name: currentUserName 
        };
      }
      return p;
    });

    // 2. Actualizar participantIds
    const updatedIds = sorteoData.participantIds.filter(id => id !== oldId);
    updatedIds.push(newId);

    batch.update(sorteoRef, {
      participants: updatedParticipants,
      participantIds: updatedIds
    });

    // 3. MIGRAR ASIGNACIONES (Si el sorteo ya se hizo)
    if (sorteoData.status === 'realizado') {
      const assignmentsRef = sorteoRef.collection('assignments');

      // A. Buscar el documento donde YO regalo (Giver)
      // El ID del documento es el ID del usuario (manual en este caso)
      const giverDocRef = assignmentsRef.doc(oldId);
      const giverDocSnapshot = await giverDocRef.get();

      if (giverDocSnapshot.exists) {
        const assignmentData = giverDocSnapshot.data();
        
        // Crear nuevo documento con mi ID real
        const newGiverDocRef = assignmentsRef.doc(newId);
        batch.set(newGiverDocRef, {
          ...assignmentData,
          giverId: newId,
          giverName: currentUserName
        });

        // Borrar el documento viejo (manual)
        batch.delete(giverDocRef);
      }

      // B. Buscar el documento donde A MÍ me regalan (Receiver)
      // Aquí tenemos que buscar en toda la colección quién me tiene asignado
      const receiverQuery = await assignmentsRef.where('receiverId', '==', oldId).get();
      
      receiverQuery.forEach(doc => {
        // Actualizamos ese documento para que apunte a mi nuevo ID
        batch.update(doc.ref, {
          receiverId: newId,
          receiverName: currentUserName
        });
      });
    }

    // Ejecutar todo junto
    await batch.commit();
  }

  async function handleNewSorteo() {
    try {
      const name = await customPrompt("Nuevo Sorteo", "Nombre del sorteo:", "");
      if (!name) return;
      const budget = await customPrompt("Presupuesto", "Monto (ej: 5000):", "5000");
      if (!budget) return;
      
      await db.collection('sorteos').add({
        sorteoName: name,
        budget: parseInt(budget) || 0,
        adminId: currentUser.uid,
        adminName: currentUserName,
        participants: [{ userId: currentUser.uid, name: currentUserName, hasAccount: true }],
        participantIds: [currentUser.uid],
        status: "abierto",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      customAlert("Sorteo creado", "Ya puedes compartir el ID o agregar participantes manualmente.");
    } catch (e) { if (e!=='cancelled') customAlert("Error", e.message); }
  }

  async function handleAddParticipantManual(sorteoId) {
    try {
      const modalHtml = `
        <div style="text-align: left; margin: 1rem 0;">
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Nombre del participante:</label>
          <input type="text" id="manual-participant-name" placeholder="Ej: Juan Pérez" style="width: 100%; padding: 0.8rem; border: 2px solid #e5e7eb; border-radius: 8px; margin-bottom: 1rem;">
          
          <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Email del participante:</label>
          <input type="email" id="manual-participant-email" placeholder="Ej: juan@example.com" style="width: 100%; padding: 0.8rem; border: 2px solid #e5e7eb; border-radius: 8px;">
          
          <p style="margin-top: 1rem; font-size: 0.85rem; color: #6b7280;">
            💡 Este participante recibirá su asignación por email al realizar el sorteo.
          </p>
        </div>
      `;
      
      await customConfirm(
        "Agregar Participante sin Cuenta",
        modalHtml,
        "Agregar"
      );
      
      const participantName = document.getElementById('manual-participant-name').value.trim();
      const participantEmail = document.getElementById('manual-participant-email').value.trim();
      
      if (!participantName || !participantEmail) {
        return customAlert("Error", "Debes completar ambos campos.");
      }
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(participantEmail)) {
        return customAlert("Error", "El email no es válido.");
      }
      
      const sorteoDoc = await db.collection('sorteos').doc(sorteoId).get();
      if (!sorteoDoc.exists) throw new Error("Sorteo no encontrado");
      
      const sorteoData = sorteoDoc.data();
      
      const existingParticipant = sorteoData.participants.find(
        p => p.email === participantEmail || p.name.toLowerCase() === participantName.toLowerCase()
      );
      
      if (existingParticipant) {
        return customAlert("Error", "Ya existe un participante con ese nombre o email.");
      }
      
      const manualParticipantId = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const updatedParticipants = [
        ...sorteoData.participants,
        {
          userId: manualParticipantId,
          name: participantName,
          email: participantEmail,
          hasAccount: false
        }
      ];
      
      const updatedParticipantIds = [
        ...sorteoData.participantIds,
        manualParticipantId
      ];
      
      await db.collection('sorteos').doc(sorteoId).update({
        participants: updatedParticipants,
        participantIds: updatedParticipantIds
      });
      
      customAlert(
        "¡Participante agregado!",
        `<strong>${participantName}</strong> ha sido agregado al sorteo.<br><br>📧 Recibirá su asignación por email cuando realices el sorteo.`
      );
      
    } catch (e) {
      if (e !== 'cancelled') {
        customAlert("Error", e.message || "No se pudo agregar el participante.");
      }
    }
  }

  async function handleEditName(id, oldName) {
    try {
      const newName = await customPrompt("Cambiar nombre", "Nuevo nombre:", oldName);
      if (newName) await db.collection('sorteos').doc(id).update({ sorteoName: newName });
    } catch (e) { if (e!=='cancelled') customAlert("Error", e.message); }
  }

  async function handleViewId(id) {
    const htmlContent = `
      <div style="margin-bottom: 10px;">
        <input type="text" class="id-copy-box" readonly value="${id}" onclick="this.select(); document.execCommand('copy');">
        <p style="font-size: 0.8rem; color: #6b7280; margin-top: 5px;">Click para copiar</p>
      </div>
    `;
    customAlert("ID del Sorteo", htmlContent);
  }

  async function handleDeleteSorteo(id, name) {
    try {
      await customConfirm("¿Eliminar sorteo?", `¿Seguro que quieres eliminar "${name}"?`, "Eliminar");
      await db.collection('sorteos').doc(id).delete();
      customAlert("Eliminado", "Sorteo borrado correctamente.");
    } catch (e) { if (e!=='cancelled') customAlert("Error", e.message); }
  }

  async function handleRealizarSorteo(id) {
    try {
      const doc = await db.collection('sorteos').doc(id).get();
      if (!doc.exists) throw new Error("Sorteo no encontrado");
      
      const data = doc.data();
      const parts = data.participants || [];
      
      if (parts.length < 2) throw new Error("Se necesitan mínimo 2 participantes.");

      const participantsWithoutAccount = parts.filter(p => !p.hasAccount);
      const hasParticipantsWithoutAccount = participantsWithoutAccount.length > 0;

      let sendEmails = false;
      
      if (hasParticipantsWithoutAccount) {
        const emailMessage = `Se realizará el sorteo con ${parts.length} participantes.<br><br>` +
          `📧 Hay <strong>${participantsWithoutAccount.length} participante${participantsWithoutAccount.length > 1 ? 's' : ''} sin cuenta</strong> que recibirá${participantsWithoutAccount.length > 1 ? 'n' : ''} su asignación por email.<br><br>` +
          `¿Deseas también enviar emails a todos los participantes (incluyendo los que tienen cuenta)?`;
        
        sendEmails = await customConfirm(
          "Enviar notificaciones por email",
          emailMessage,
          "Sí, enviar a todos"
        ).catch(() => false);
      } else {
        sendEmails = await customConfirm(
          "Confirmar sorteo", 
          `Se realizará el sorteo con ${parts.length} participantes registrados.<br>¿Quieres enviarles una notificación por correo también?`, 
          "Sí, enviar correos"
        ).catch(() => false); 
      }

      await customConfirm("¡Atención!", `Los cambios son definitivos.<br>¿Realizar sorteo ahora?`, "¡Dale!");
      
      const receivers = [...parts].sort(() => Math.random() - 0.5);
      let valid = false;
      
      while (!valid) {
        receivers.sort(() => Math.random() - 0.5);
        valid = parts.every((p, i) => p.userId !== receivers[i].userId);
      }

      const batch = db.batch();
      parts.forEach((p, i) => {
        batch.set(db.collection('sorteos').doc(id).collection('assignments').doc(p.userId), {
          giverId: p.userId, 
          giverName: p.name, 
          receiverId: receivers[i].userId, 
          receiverName: receivers[i].name
        });
      });
      
      batch.update(db.collection('sorteos').doc(id), { 
        status: "realizado",
        realizedAt: firebase.firestore.FieldValue.serverTimestamp() // <--- Guardamos fecha exacta
      });
      
      await batch.commit();

      if (hasParticipantsWithoutAccount || sendEmails) {
        try {
          // MOSTRAR LOADING (SIN BOTÓN ACEPTAR)
          showLoadingModal("Enviando emails...", "Por favor espera mientras se envían los correos a los participantes...");
          
          const emailResults = await sendEmailsToAllParticipants(id, data);
          
          const resultMessage = `
            <div style="text-align:left;">
              <p style="margin-bottom:10px;">✅ <strong>Sorteo realizado exitosamente.</strong></p>
              <hr style="margin:10px 0; border:0; border-top:1px solid #eee;">
              <p>📊 <strong>Resumen de envíos:</strong></p>
              <ul style="margin:5px 0 15px 20px; color:#555;">
                <li>Exitosos: <strong>${emailResults.success}</strong></li>
                <li>Fallidos: <strong>${emailResults.failed.length}</strong></li>
              </ul>
              ${emailResults.failed.length > 0 ? 
                `<p style="color:#e74c3c; font-size:0.9rem;">⚠️ No se pudo enviar a: ${emailResults.failed.join(', ')}</p>` : 
                '<p style="color:#10b981; font-weight:bold; text-align:center;">✨ ¡Todos los correos llegaron bien!</p>'
              }
            </div>
          `;
          
          // ESTO CERRARÁ EL LOADING Y ABRIRÁ EL RESULTADO
          customAlert("¡Misión Cumplida!", resultMessage);

        } catch (emailError) {
          console.error('Error al enviar emails:', emailError);
          customAlert(
            "Sorteo realizado con advertencia", 
            "El sorteo se guardó en la base de datos, pero hubo un error técnico al intentar enviar los correos. Verifica la consola o tu cuenta de EmailJS."
          );
        }
      } else {
        customAlert("¡Listo!", "Sorteo realizado. Los participantes pueden ver sus asignaciones entrando a la plataforma.");
      }

    } catch (e) { 
      if (e !== 'cancelled') {
        console.error(e);
        customAlert("Error", e.message || "Ocurrió un error inesperado."); 
      }
    }
  }

  // ==========================================
  // REHACER SORTEO (Resetear a estado Abierto)
  // ==========================================
  async function handleResetSorteo(id) {
    try {
      const confirmMessage = `
        <p>¿Estás seguro de que quieres rehacer el sorteo?</p>
        <ul style="text-align:left; font-size:0.9rem; color:#555; margin-top:10px;">
          <li>⚠️ El sorteo volverá a estar <strong>ABIERTO</strong>.</li>
          <li>⚠️ Las asignaciones actuales se perderán al volver a sortear.</li>
          <li>⚠️ Si ya se enviaron correos, los participantes recibirán uno nuevo y podrían confundirse.</li>
        </ul>
        <br>
        <strong>¿Confirmar reinicio?</strong>
      `;
      await customConfirm("Rehacer Sorteo", confirmMessage, "Sí, reiniciar");
      await db.collection('sorteos').doc(id).update({ status: 'abierto' });
      customAlert("¡Sorteo Reiniciado!", "El sorteo está abierto nuevamente. Puedes agregar/quitar participantes y volver a realizarlo.");
      } catch (e) {
    }
  }

  async function handleVerResultado(id) {
    const res = await db.collection('sorteos').doc(id).collection('assignments').doc(currentUser.uid).get();
    if (res.exists) customAlert("Tu Amigo Secreto", `Regalas a: <strong>${res.data().receiverName}</strong>`);
  }

function displayMySorteos() {
  const container = document.getElementById('sorteos-list');
  if (!container) return;
  
  if (unsubscribeSorteos) unsubscribeSorteos();
  
  // Modo invitado: siempre cargar sorteos finalizados
  if (isGuestMode) {
    unsubscribeSorteos = db.collection('sorteos')
      .where('status', '==', 'finalizado')
      .orderBy('createdAt', 'desc')
      .limit(20) // Limitar a 20 para no sobrecargar
      .onSnapshot(snap => {
        if (snap.empty) {
          container.innerHTML = `
            <div style="text-align:center; padding:3rem; color:#888;">
              <div style="font-size:3rem; margin-bottom:1rem;">📭</div>
              <p>No hay sorteos finalizados disponibles aún.</p>
            </div>`;
          return;
        }
        
        container.innerHTML = snap.docs.map(doc => {
          const d = doc.data();
          const isFinalized = true; // Siempre finalizado en modo invitado
          
          const styleGray = "font-size:0.8rem; background:#f3f4f6; padding:3px 10px; border-radius:12px; color:#4b5563; white-space:nowrap;";
          const styleBlue = "font-size:0.8rem; background:#eff6ff; padding:3px 10px; border-radius:12px; color:#2563eb; border: 1px solid #bfdbfe; white-space:nowrap;";
          
          const createdStr = d.createdAt ? new Date(d.createdAt.seconds * 1000).toLocaleDateString() : '---';
          const finalStr = d.finalizedAt ? new Date(d.finalizedAt.seconds * 1000).toLocaleDateString() : '---';

          const datesHtml = `
            <div style="display:inline-flex; align-items:center; gap:8px; flex-wrap:nowrap;">
                <span class="date-pill" style="${styleGray}">📅 ${createdStr}</span>
                <span class="date-pill" style="${styleBlue}">🏁 ${finalStr}</span>
            </div>`;

          const partsHtml = d.participants.map(p => {
              const icon = p.hasAccount ? '👤' : '✉️';
              const bgClass = p.hasAccount ? 'bg-user' : 'bg-manual';
              return `<div class="participant-chip ${bgClass}"><div class="p-icon">${icon}</div><div class="p-info"><span class="p-name">${p.name}</span></div></div>`;
          }).join('');
          
          // Botón para ver el año
          const year = d.createdAt ? new Date(d.createdAt.seconds * 1000).getFullYear() : new Date().getFullYear();
          const btns = `<button class="btn-icon btn-go-history" data-year="${year}" title="Ver Año" style="color:#d97706; border:2px solid #fffbeb !important;">📁</button>`;

          return `
            <div class="sorteo-card modern-layout is-finalized" style="opacity:0.9;">
              <div class="card-header-horizontal">
                <div class="header-info-col">
                  <h3 class="horizontal-title">${d.sorteoName}</h3>
                  <div class="header-meta-row horizontal-meta">
                    <span class="status-pill status-archived">FINALIZADO</span>
                    <span class="budget-mini-pill">💰 $${d.budget}</span>
                    ${datesHtml}
                  </div>
                </div>
                <div class="header-actions-col">
                  <div class="actions-block centered-actions" style="margin:0 !important;">${btns}</div>
                </div>
              </div>

              <div class="participants-section">
                  <p class="section-label">Participantes (${d.participants.length})</p>
                  <div class="participants-grid">${partsHtml}</div>
              </div>
            </div>`;
        }).join('');
      });
    return;
  }
  
  // Admin Fix
  const MY_ID = "I0mzYBfJiJXB4ptXxWuQsBykAGl1"; 
  if (currentUser && currentUser.uid === MY_ID) {
     db.collection('sorteos').where('participantIds', 'array-contains', MY_ID).get().then(snap => {
        snap.forEach(doc => { if (doc.data().adminId !== MY_ID) doc.ref.update({ adminId: MY_ID }); });
     });
  }

  unsubscribeSorteos = db.collection('sorteos')
    .where('participantIds', 'array-contains', currentUser.uid)
    .orderBy('createdAt', 'desc')
    .onSnapshot(snap => {
      if (snap.empty) return container.innerHTML = `
        <div style="text-align:center; padding:3rem; color:#888;">
          <div style="font-size:3rem; margin-bottom:1rem;">🎲</div>
          <p>No tienes sorteos activos.</p>
        </div>`;
      
      container.innerHTML = snap.docs.map(doc => {
        const d = doc.data();
        const isAdmin = d.adminId === currentUser.uid;
        const isFinalized = d.status === 'finalizado';
        
        // --- FECHAS UNIDAS ---
        const styleGray = "font-size:0.8rem; background:#f3f4f6; padding:3px 10px; border-radius:12px; color:#4b5563; white-space:nowrap;";
        const styleBlue = "font-size:0.8rem; background:#eff6ff; padding:3px 10px; border-radius:12px; color:#2563eb; border: 1px solid #bfdbfe; white-space:nowrap;";
        
        const createdStr = d.createdAt ? new Date(d.createdAt.seconds * 1000).toLocaleDateString() : '---';
        const finalStr = d.finalizedAt ? new Date(d.finalizedAt.seconds * 1000).toLocaleDateString() : '---';

        let datesHtml = '';
        if (isFinalized) {
            datesHtml = `
            <div style="display:inline-flex; align-items:center; gap:8px; flex-wrap:nowrap;">
                <span class="date-pill" style="${styleGray}">📅 ${createdStr}</span>
                <span class="date-pill" style="${styleBlue}">🏁 ${finalStr}</span>
            </div>`;
        } else {
            datesHtml = `<span class="date-pill" style="${styleGray}">📅 ${createdStr}</span>`;
        }

        const finalizedClass = isFinalized ? 'is-finalized' : '';
        const statusLabel = d.status === 'realizado' ? 'REALIZADO' : (isFinalized ? 'FINALIZADO' : 'ABIERTO');
        const statusClass = d.status === 'realizado' ? 'status-done' : (isFinalized ? 'status-archived' : 'status-open');
        const opacityStyle = isFinalized ? 'opacity:0.9;' : '';

        // --- PARTICIPANTES ---
        const partsHtml = d.participants.map(p => {
            const icon = p.hasAccount ? '👤' : '✉️';
            const bgClass = p.hasAccount ? 'bg-user' : 'bg-manual';
            const editBtn = (isAdmin && !p.hasAccount && d.status === 'abierto') 
              ? `<button class="btn-edit-part" onclick="window.handleEditParticipant('${doc.id}', '${p.userId}', '${p.email || ''}')">✏️</button>` : '';
            return `<div class="participant-chip ${bgClass}"><div class="p-icon">${icon}</div><div class="p-info"><span class="p-name">${p.name}</span></div>${editBtn}</div>`;
        }).join('');
        
        // --- BOTONES DE ACCIÓN ---
        let btns = '';
        if (isAdmin) {
          // 1. ETIQUETA ARCHIVADO (A la izquierda del lápiz)
          if (isFinalized) {
             btns += `<span style="font-size:0.75rem; color:#6b7280; font-weight:700; border:1px solid #ccc; padding:2px 8px; border-radius:10px; margin-right:10px;">ARCHIVADO</span>`;
          }

          // 2. BOTÓN EDITAR (Lápiz)
          btns += `<button class="btn-icon btn-edit-name" data-id="${doc.id}" data-name="${d.sorteoName}" title="Editar Nombre">${iconEdit}</button>`;
          
          if (d.status === 'abierto') {
            btns += `<button class="btn-icon btn-view-id" data-id="${doc.id}" title="Copiar ID">${iconLink}</button>`;
            btns += `<button class="btn-icon btn-add-participant-manual" data-id="${doc.id}" title="Agregar Manual">${iconUserPlus}</button>`;
            btns += `<button class="btn-icon btn-realizar-sorteo" data-id="${doc.id}" title="REALIZAR">${iconPlay}</button>`;
          } 
          else if (d.status === 'realizado') {
            btns += `<button class="btn-icon btn-view-id" data-id="${doc.id}" title="Copiar ID">${iconLink}</button>`;
            btns += `<button class="btn-icon btn-reset-sorteo" data-id="${doc.id}" title="Rehacer">${iconReset}</button>`;
            btns += `<button class="btn-icon btn-finalizar-sorteo" data-id="${doc.id}" data-name="${d.sorteoName}" title="Finalizar Sorteo">🏁</button>`;
          }
          else if (isFinalized) {
             // 3. BOTÓN CARPETA (Ver Año)
             const year = d.createdAt ? new Date(d.createdAt.seconds * 1000).getFullYear() : new Date().getFullYear();
             btns += `<button class="btn-icon btn-go-history" data-year="${year}" title="Ver Año" style="color:#d97706; border:2px solid #fffbeb !important;">📁</button>`;
          }
          
          // 4. BOTÓN ELIMINAR
          btns += `<button class="btn-icon btn-delete-sorteo" data-id="${doc.id}" data-name="${d.sorteoName}" title="Eliminar">${iconDelete}</button>`;
        } else {
          // Vista Usuario normal
          if (d.status === 'realizado') btns += `<button class="btn-icon btn-ver-resultado" data-id="${doc.id}" style="width:auto; padding:0 15px; border-radius:20px;">👁️ Ver mi Amigo</button>`;
          else if (isFinalized) btns += `<span style="font-size:0.8rem; color:#6b7280; font-weight:700;">FINALIZADO</span>`;
          else btns += `<span class="waiting-badge">⏳ Esperando...</span>`;
        }

        return `
          <div class="sorteo-card modern-layout ${finalizedClass}" style="${opacityStyle}">
            
            <div class="card-header-horizontal">
              <div class="header-info-col">
                <h3 class="horizontal-title">${d.sorteoName}</h3>
                <div class="header-meta-row horizontal-meta">
                  <span class="status-pill ${statusClass}">${statusLabel}</span>
                  <span class="budget-mini-pill">💰 $${d.budget}</span>
                  ${datesHtml}
                </div>
              </div>
              <div class="header-actions-col">
                <div class="actions-block centered-actions" style="margin:0 !important;">${btns}</div>
              </div>
            </div>

            <div class="participants-section">
                <p class="section-label">Participantes (${d.participants.length})</p>
                <div class="participants-grid">${partsHtml}</div>
            </div>
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
    let isPlaying = false; 
    audioPlayer.volume = 0.05; // Un volumen bajito para empezar es mejor

    // Icono Inicial (Play)
    playBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
    
    // --- AQUÍ ESTÁ EL AJUSTE CLAVE A 2PX ---
    playBtn.style.paddingLeft = "2px"; 

    playBtn.addEventListener('click', () => {
      if (isPlaying) { 
        // --- PAUSAR (Se muestra icono Play) ---
        audioPlayer.pause(); 
        playBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
        playBtn.style.paddingLeft = "2px"; // Ajuste centrado óptico del triángulo
      } else { 
        // --- REPRODUCIR (Se muestra icono Pausa) ---
        audioPlayer.play(); 
        playBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
        playBtn.style.paddingLeft = "0"; // Pausa no necesita padding
      }
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

  /* ==========================================
   EVENTO: CLICK EN EL OJO (REVELAR/OCULTAR)
   ========================================== */
  const contentContainer = document.getElementById('content-container');
    if (contentContainer) {
    contentContainer.addEventListener('click', (e) => {
    // Detectar click en el botón del ojo
    const btn = e.target.closest('.btn-reveal-secret');
    if (!btn) return;
    
    // Buscar la tarjeta padre y el span del nombre
    const card = btn.closest('.secret-friend-card');
    const nameSpan = card.querySelector('.secret-name');
    
    // Alternar la clase 'is-revealed'
    const isRev = card.classList.toggle('is-revealed');
    
    // LÓGICA DE CAMBIO DE TEXTO:
    if (isRev) {
      // Si está revelado -> Mostrar nombre real
      nameSpan.textContent = btn.dataset.name;
      btn.innerHTML = iconViewOff; // Icono de ojo tachado
    } else {
      // Si está oculto -> Mostrar asteriscos
      nameSpan.textContent = '******';
      btn.innerHTML = iconView;    // Icono de ojo normal
    }
    });
  }

  /* Función para archivar (Finalizar Sorteo) - DISEÑO ACTUALIZADO CON FECHA */
async function handleFinalizarSorteo(id, name) {
  try {
    // Creamos el mensaje con el diseño visual
    const confirmMessage = `
      <div style="text-align:left; color: var(--text-primary); padding-top: 10px;">
        
        <p style="font-size: 1.1rem; margin-bottom: 1.5rem; line-height: 1.4;">
            Estás a punto de finalizar el evento <strong>"${name}"</strong>
        </p>
        
        <p style="font-weight: 800; margin-bottom: 1rem; color: var(--nav-bg); font-size: 1rem;">
            Ten en cuenta:
        </p>
        
        <ul style="list-style:none; padding-left:5px; margin:0; color: var(--text-secondary); font-size:0.95rem;">
          
          <li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
            <span style="font-size:1.4rem; line-height: 1;">🔒</span>
            <span>El sorteo se cerrará y pasará al <strong>Ver Finalizados</strong>.</span>
          </li>
          
          <li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:12px;">
            <span style="font-size:1.4rem; line-height: 1;">📜</span>
            <span>Quedará guardado para el recuerdo.</span>
          </li>
          
          <li style="display:flex; align-items:flex-start; gap:12px; margin-bottom:0;">
            <span style="font-size:1.4rem; line-height: 1;">🎁</span>
            <span>Se asume que los regalos ya fueron entregados.</span>
          </li>
          
        </ul>
      </div>
    `;

    // Lanzamos el modal de confirmación
    await customConfirm("Finalizar Evento", confirmMessage, "Dar por finalizado");
    
    // Si confirma, actualizamos estado Y guardamos la fecha de finalización
    await db.collection('sorteos').doc(id).update({ 
      status: 'finalizado',
      finalizedAt: firebase.firestore.FieldValue.serverTimestamp() // <--- CRÍTICO para calcular la duración
    });
    
    // Alerta de éxito
    customAlert("¡Evento Finalizado!", "El sorteo ha sido archivado exitosamente en el Historial.");
    
  } catch (e) {
    // Si cancela, no hacemos nada (e === 'cancelled')
    if (e !== 'cancelled') customAlert("Error", e.message);
  }
}

/* ===========================================================
     🛠️ HERRAMIENTA SIMPLIFICADA: HISTORIAL 2024 (SOLO FICHA)
     Solo registra participantes, fechas y dinero. Sin parejas.
     =========================================================== */
  async function importarSorteo2024() {
    
    // 1. CONFIGURACIÓN: EDITA ESTO
    const nombreSorteo = "Amigo Secreto 2024";
    const presupuesto = 1500; // El valor que quieras
    
    // SOLO PON LOS NOMBRES AQUÍ (Sin parejas, solo la lista de gente)
    const nombresParticipantes = [
      "Ariel",
      "Cata",
      "Chico",
      "Dann",
      "Felipe",
      "Jaime",
      "Lukas",
      "Pinilla"
    ];

    try {
      if (!currentUser) return customAlert("Error", "Debes iniciar sesión primero.");

      const confirm = await customConfirm(
        "Crear Ficha 2024", 
        `Se creará el registro de "<strong>${nombreSorteo}</strong>".<br>
         Participantes: <strong>${nombresParticipantes.length}</strong><br>
         Presupuesto: <strong>$${presupuesto}</strong><br><br>
         <em>Nota: Al no definir parejas, este sorteo aparecerá en la lista de finalizados, pero el álbum de 'Amigos Secretos' de 2024 estará vacío.</em>`,
        "Crear Registro"
      ).catch(()=>false);

      if (!confirm) return;

      showLoadingModal("Guardando...", "Generando registro histórico...");

      const batch = db.batch();
      const sorteoRef = db.collection('sorteos').doc(); // ID nuevo
      
      // Creamos la estructura de participantes para la tarjeta
      const participants = nombresParticipantes.map((nombre, index) => ({
        userId: `legacy_24_${index}_${Math.random().toString(36).substr(2,5)}`,
        name: nombre,
        email: "sin_email@historial.com", 
        hasAccount: false 
      }));

      // Agregamos TU USUARIO real a la lista para que puedas ver el sorteo
      // (Si tu nombre ya está en la lista de arriba, esto solo asegura que el sistema sepa que es tuyo)
      const myId = currentUser.uid;
      
      // Generamos el array de IDs
      const participantIds = participants.map(p => p.userId);
      
      // ¡IMPORTANTE! Agregamos tu ID real al array de IDs para que el filtro de Firebase lo encuentre
      if (!participantIds.includes(myId)) {
          participantIds.push(myId);
      }

      // FECHAS DEL 2024
      const fechaInicio = new Date("2024-12-24T12:00:00");
      const fechaFin    = new Date("2024-12-26T10:00:00"); // Fecha en que "terminó"

      // CREAMOS EL DOCUMENTO
      batch.set(sorteoRef, {
        sorteoName: nombreSorteo,
        budget: presupuesto,
        adminId: currentUser.uid, 
        status: 'finalizado',     // Aparece directamente como finalizado
        
        participants: participants,
        participantIds: participantIds, 

        // Timestamps antiguos
        createdAt: firebase.firestore.Timestamp.fromDate(fechaInicio),
        realizedAt: firebase.firestore.Timestamp.fromDate(fechaInicio), // Se realizó el mismo día de inicio
        finalizedAt: firebase.firestore.Timestamp.fromDate(fechaFin)
      });

      // No creamos la colección 'assignments' porque no quieres parejas.
      
      await batch.commit();

      customAlert("¡Registro Creado!", "El sorteo 2024 ya aparece en tu lista de Finalizados.");

    } catch (e) {
      console.error(e);
      customAlert("Error", e.message);
    }
  }
  
  // Exponer a consola
  window.importarSorteo2024 = importarSorteo2024;

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
const iconUserPlus = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>`;
const iconReset = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 2v6h6M21.5 22v-6h-6"/><path d="M22 11.5A10 10 0 0 0 3.2 7.2M2 12.5a10 10 0 0 0 18.8 4.2"/></svg>`;

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

// ==========================================
// TRADUCTOR DE ERRORES FIREBASE (NUEVO)
// ==========================================
function getFriendlyErrorMessage(error) {
  console.error("Error original:", error); // Esto queda en la consola por si acaso

  // 1. Detectar el error específico que te salió a ti (JSON feo)
  const msg = error.message || error.toString();
  if (msg.includes('INVALID_LOGIN_CREDENTIALS') || msg.includes('INVALID_PASSWORD')) {
    return "El correo o la contraseña son incorrectos. Inténtalo de nuevo.";
  }

  // 2. Errores estándar de Firebase (Códigos comunes)
  const code = error.code || '';
  
  switch (code) {
    case 'auth/user-not-found':
      return "No existe ninguna cuenta registrada con este correo.";
    case 'auth/wrong-password':
      return "La contraseña es incorrecta.";
    case 'auth/invalid-email':
      return "El formato del correo no es válido.";
    case 'auth/email-already-in-use':
      return "Ya existe una cuenta registrada con este correo.";
    case 'auth/weak-password':
      return "La contraseña es muy débil (mínimo 6 caracteres).";
    case 'auth/too-many-requests':
      return "Muchos intentos fallidos. Espera unos minutos e intenta de nuevo.";
    case 'auth/network-request-failed':
      return "Error de conexión. Verifica tu internet.";
    default:
      // Si es otro error raro, mostramos un mensaje genérico pero amable
      return "Ocurrió un error al intentar acceder. Por favor verifica tus datos.";
  }
}
