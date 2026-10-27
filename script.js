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
  // true = los bots de prueba NO reciben correo real (se cuentan como "simulados"). Ponlo en false para enviarles de verdad.
  const BOT_SKIP_EMAIL_SEND = true;

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
  let unsubscribeInicioInfo = null;
  let countdownTimer = null;
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
async function sendSecretFriendEmail(toEmail, toName, secretFriendName, sorteoName, budget, extra = {}) {
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
        to_email: toEmail,
        delivery_date_html: extra.deliveryDateText || 'Por definir',
        wishlist_html: extra.wishlistHtml || ''   // vacío si el amigo secreto no tiene lista
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

// Lista de deseados del amigo secreto: del perfil si tiene cuenta, o la guardada al agregarlo manualmente
async function getReceiverWishlistUrl(sorteoData, receiverId) {
  try {
    const rp = (sorteoData.participants || []).find(p => p.userId === receiverId);
    if (!rp) return '';
    if (rp.hasAccount) {
      const u = await db.collection('users').doc(receiverId).get();
      return u.exists ? safeHttpUrl(u.data().wishlistURL) : '';
    }
    return safeHttpUrl(rp.wishlistURL);
  } catch (err) {
    console.warn('No se pudo obtener la lista de deseados:', err);
    return '';
  }
}

// Contenido que va DENTRO del recuadro "Su lista de deseados" de la plantilla.
// Con lista: el enlace. Sin lista: un aviso.
function buildWishlistEmailHtml(url) {
  if (url) {
    return `<a href="${esc(url)}" style="color: #7a2333; font-weight: bold;">Ver lista ↗</a>`;
  }
  return `<span style="color: #5a5f68;">Aún no ha agregado una.</span>`;
}

function formatDeliveryText(ts) {
  if (!ts || !ts.toDate) return 'Por definir';
  const d = ts.toDate();
  // Formato corto para que quepa en una línea en el correo: "sáb, 26 de diciembre · 20:00"
  return d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'long' }).replace('.', '')
    + ' · ' + d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// ==========================================
// 2.6 ENVÍO DE DMs POR DISCORD (cola para el bot)
// ==========================================
async function enqueueDiscordDMs(sorteoId, sorteoData) {
  try {
    const assignmentsSnap = await db.collection('sorteos').doc(sorteoId).collection('assignments').get();
    let queued = 0;

    for (const aDoc of assignmentsSnap.docs) {
      const a = aDoc.data();
      const p = (sorteoData.participants || []).find(x => x.userId === a.giverId);
      if (!p || p.isBot || !p.hasAccount) continue;

      const uDoc = await db.collection('users').doc(a.giverId).get();
      const discordId = uDoc.exists ? uDoc.data().discordId : null;
      if (!discordId) continue;

      const wishlistUrl = await getReceiverWishlistUrl(sorteoData, a.receiverId);
      const lineas = [
        `🎁 **${sorteoData.sorteoName}**`,
        `Tu amigo secreto es: **${a.receiverName}**`,
        `Presupuesto mínimo: $${sorteoData.budget}`,
        `Entrega: ${formatDeliveryText(sorteoData.deliveryDate)}`
      ];
      if (wishlistUrl) lineas.push(`Su lista de deseados: ${wishlistUrl}`);

      await db.collection('dmQueue').add({
        sorteoId,
        giverId: a.giverId,
        discordId: String(discordId),
        texto: lineas.join('\n'),
        estado: 'pendiente',
        creado: firebase.firestore.FieldValue.serverTimestamp()
      });
      queued++;
    }
    console.log(`📨 DMs de Discord encolados: ${queued}`);
    return queued;
  } catch (e) {
    console.error('❌ Error encolando DMs de Discord:', e);
    return 0;
  }
}

async function sendEmailsToAllParticipants(sorteoId, sorteoData) {
    try {
      const assignmentsSnap = await db.collection('sorteos')
        .doc(sorteoId)
        .collection('assignments')
        .get();

      let successCount = 0;
      let simulatedCount = 0;
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

        // Bots de prueba: pasan por toda la lógica pero no gastan envíos reales de EmailJS
        if (participant.isBot && BOT_SKIP_EMAIL_SEND) {
          console.log(`   🤖 Bot "${participant.name}": envío simulado (${participant.email}).`);
          simulatedCount++;
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
            const wishlistUrl = await getReceiverWishlistUrl(sorteoData, assignment.receiverId);
            await sendSecretFriendEmail(
              userEmail,
              assignment.giverName,
              assignment.receiverName,
              sorteoData.sorteoName,
              sorteoData.budget,
              {
                deliveryDateText: formatDeliveryText(sorteoData.deliveryDate),
                wishlistHtml: buildWishlistEmailHtml(wishlistUrl)
              }
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
        simulated: simulatedCount,
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
        if (unsubscribeInicioInfo) { unsubscribeInicioInfo(); unsubscribeInicioInfo = null; }
        clearInterval(countdownTimer);
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
function renderInicioInfo(d) {
  const budgetEl = document.getElementById('inicio-budget-inline');
  const dateEl = document.getElementById('event-date-text');
  const cdEl = document.getElementById('event-countdown');
  clearInterval(countdownTimer);

  if (budgetEl) budgetEl.innerHTML = (d && d.budget) ? ` de <strong>$${d.budget}</strong>` : '';
  if (!dateEl || !cdEl) return;

  const target = (d && d.deliveryDate && d.deliveryDate.toDate) ? d.deliveryDate.toDate() : null;
  if (!target) {
    dateEl.textContent = 'por definir';
    cdEl.textContent = '';
    return;
  }

  dateEl.textContent = target.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    + ' · ' + target.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });

  const tick = () => {
    const diff = target - new Date();
    if (diff <= 0) { cdEl.textContent = '🎉 ¡Es hoy o ya pasó la entrega!'; clearInterval(countdownTimer); return; }
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    cdEl.textContent = `⏳ Faltan ${days} d ${hours} h ${mins} min ${secs} s`;
  };
  tick();
  countdownTimer = setInterval(tick, 1000);
}

function loadInicioInfo() {
  if (unsubscribeInicioInfo) { unsubscribeInicioInfo(); unsubscribeInicioInfo = null; }
  if (isGuestMode || !currentUser) { renderInicioInfo(null); return; }

  // Sorteo vigente = el más reciente que no esté finalizado (sin índices nuevos)
  unsubscribeInicioInfo = db.collection('sorteos')
    .where('participantIds', 'array-contains', currentUser.uid)
    .orderBy('createdAt', 'desc')
    .onSnapshot(snap => {
      const current = snap.docs.map(x => x.data()).find(x => x.status !== 'finalizado');
      renderInicioInfo(current || null);
    }, err => console.warn('Info de inicio:', err));
}

function loadInicioSection() {
  const container = document.getElementById('secret-friend-container');
  if (!container) return;

  loadInicioInfo();

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
            
            // Participantes agregados manualmente que dejaron su lista (opcional)
            const manualCards = participants
              .filter(p => !p.hasAccount && safeHttpUrl(p.wishlistURL))
              .map(p => `
                <div class="wishlist-card">
                  <div style="margin-bottom: 15px;">
                    <h4 style="margin:0; font-size:1.2rem; display:flex; align-items:center; gap:5px;">${esc(p.name)}</h4>
                  </div>
                  <div style="flex-grow:1; display:flex; flex-direction:column; gap:10px; margin-bottom:15px;">
                    <a href="${esc(safeHttpUrl(p.wishlistURL))}" target="_blank" rel="noopener noreferrer" class="btn-wishlist">Ver Lista de Deseos ↗</a>
                  </div>
                </div>`).join('');

            if (usersSnap.empty && !manualCards) {
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
            
            container.innerHTML = wishlistCards + manualCards;
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
          <div class="sorteo-top-actions">
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
      
      if (btn.classList.contains('btn-edit-name')) {
        if (btn.dataset.status === 'finalizado') await handleEditName(id, btn.dataset.name);
        else await handleConfigSorteo(id);
      }
      else if (btn.classList.contains('btn-view-id')) await handleViewId(id);
      else if (btn.classList.contains('btn-add-participant-manual')) await handleAddParticipantManual(id);
      else if (btn.classList.contains('btn-realizar-sorteo')) await handleRealizarSorteo(id);
      else if (btn.classList.contains('btn-reset-sorteo')) await handleResetSorteo(id);
      else if (btn.classList.contains('btn-delete-sorteo')) await handleDeleteSorteo(id, btn.dataset.name);
      else if (btn.classList.contains('btn-ver-resultado')) await handleVerResultado(id);
      else if (btn.classList.contains('btn-clue-start')) await handleClueStarter(id);
      else if (btn.classList.contains('btn-add-bots')) await handleAddBots(id);
      else if (btn.classList.contains('btn-remove-bots')) await handleRemoveBots(id);
      else if (btn.classList.contains('btn-verify-cruces')) await handleVerifyAssignments(id);
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


  // ==========================================
  // CONFIGURACIÓN DEL SORTEO: fecha, restricciones y asignación
  // ==========================================
  const normName = (v) => (v || '').toString().trim().toLowerCase();
  const esc = (v) => (v || '').toString().replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  // Solo acepta enlaces http/https (evita javascript: y similares). Devuelve la URL o ''.
  function safeHttpUrl(u) {
    try {
      const x = new URL((u || '').trim());
      return (x.protocol === 'http:' || x.protocol === 'https:') ? x.href : '';
    } catch (e) { return ''; }
  }

  function tsToInputValue(ts) {
    if (!ts || !ts.toDate) return '';
    const d = ts.toDate();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function inputValueToTs(v) {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d) ? null : firebase.firestore.Timestamp.fromDate(d);
  }

  function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Busca una asignación válida (nadie se regala a sí mismo ni a un par prohibido "giver>receiver").
  // Devuelve el array de receptores en el mismo orden que 'parts', o null si es imposible.
  function buildAssignment(parts, forbidden) {
    const n = parts.length;
    const allowed = parts.map((g, gi) => {
      const opts = [];
      parts.forEach((r, ri) => { if (ri !== gi && !forbidden.has(g.userId + '>' + r.userId)) opts.push(ri); });
      return opts;
    });
    if (allowed.some(o => o.length === 0)) return null;

    // Primero los más restringidos (el desempate es aleatorio)
    const order = shuffleArray(parts.map((_, i) => i)).sort((a, b) => allowed[a].length - allowed[b].length);
    const used = new Array(n).fill(false);
    const result = new Array(n).fill(-1);
    let steps = 0;
    const MAX_STEPS = 300000;

    const solve = (k) => {
      if (k === n) return true;
      if (++steps > MAX_STEPS) return false;
      const g = order[k];
      for (const r of shuffleArray(allowed[g])) {
        if (used[r]) continue;
        used[r] = true; result[g] = r;
        if (solve(k + 1)) return true;
        used[r] = false; result[g] = -1;
        if (steps > MAX_STEPS) return false;
      }
      return false;
    };

    return solve(0) ? result.map(i => parts[i]) : null;
  }

  // Pares del sorteo finalizado más reciente (quién le tocó a quién)
  async function getLastYearPairs(currentSorteoId) {
    const snap = await db.collection('sorteos')
      .where('participantIds', 'array-contains', currentUser.uid)
      .where('status', '==', 'finalizado')
      .orderBy('createdAt', 'desc')
      .get();
    const prev = snap.docs.find(d => d.id !== currentSorteoId);
    if (!prev) return { name: null, pairs: [], prevParts: [] };
    const asg = await db.collection('sorteos').doc(prev.id).collection('assignments').get();
    return { name: prev.data().sorteoName, pairs: asg.docs.map(d => d.data()), prevParts: prev.data().participants || [] };
  }

  // ----- Historial de años anteriores (Google Sheet vía tu Apps Script) -----
  // Usa el mismo Apps Script (MY_API_URL) que alimenta la pestaña "Amigos Secretos":
  //   ?mode=getYears  -> { years: [2024, 2025, ...] }
  //   ?year=2025      -> [{ Giver, Receiver, GiftURL, ... }]  (o { data: [...] })
  // No hace falta compartir el Sheet ni conocer su ID.
  async function getSheetHistoryPairs() {
    const thisYear = new Date().getFullYear();
    let years = [];
    try {
      const res = await fetch(`${MY_API_URL}?mode=getYears`);
      const json = await res.json();
      years = (json.years || []).map(y => parseInt(y, 10)).filter(y => y && y < thisYear);
    } catch (err) {
      console.warn('No se pudo leer la lista de años del Apps Script:', err);
      return { pairs: [], years: [], note: 'No pude leer el historial de años anteriores (Google Script).' };
    }

    const results = await Promise.all(years.map(async (y) => {
      try {
        const res = await fetch(`${MY_API_URL}?year=${y}`);
        const raw = await res.json();
        const rows = raw.data || raw;
        if (!Array.isArray(rows)) throw new Error('Respuesta inesperada');
        return { year: y, rows };
      } catch (err) {
        console.warn(`No se pudo leer el año ${y} del Apps Script:`, err);
        return { year: y, rows: null };
      }
    }));

    const pairs = [], loaded = [];
    results.forEach(({ year, rows }) => {
      if (!rows) return;
      loaded.push(year);
      rows.forEach(r => {
        const giver = String(r.Giver || r.giver || '').trim();
        const receiver = String(r.Receiver || r.receiver || '').trim();
        if (!giver || !receiver) return;
        pairs.push({ giver, receiver, year });
      });
    });
    const note = (years.length && !loaded.length) ? 'No pude leer los años anteriores del historial (Google Script).' : '';
    return { pairs, years: loaded.sort((a, b) => a - b), note };
  }

  // Arma el set de pares prohibidos (grupos + año anterior). Devuelve también un resumen para el admin.
  async function buildForbiddenSet(sorteoId, data) {
    const parts = data.participants || [];
    const forbidden = new Set();
    const reasons = new Map(); // "giver>receiver" -> { giver, receiver, why:Set } (para mostrarlo en el panel)
    const mark = (g, r, why) => {
      const k = g + '>' + r;
      forbidden.add(k);
      let e = reasons.get(k);
      if (!e) { e = { giver: g, receiver: r, why: new Set() }; reasons.set(k, e); }
      e.why.add(why);
    };
    let groupCount = 0, pairCount = 0, lastYearCount = 0, sheetCount = 0, sheetYears = [], note = '';

    (data.restrictionGroups || []).forEach(g => {
      const ids = (g.ids || []).filter(id => parts.some(p => p.userId === id));
      if (ids.length < 2) return;
      groupCount++;
      ids.forEach(a => ids.forEach(b => { if (a !== b) mark(a, b, 'grupo'); }));
    });

    // Reglas manuales simples: "X no puede regalarle a Y" (un solo sentido)
    (data.restrictionPairs || []).forEach(r => {
      if (!r || r.from === r.to) return;
      if (parts.some(p => p.userId === r.from) && parts.some(p => p.userId === r.to)) {
        mark(r.from, r.to, 'regla');
        pairCount++;
      }
    });

    if (data.avoidLastYear) {
      let fsNote = '', sheetNote = '';
      try {
        const prev = await getLastYearPairs(sorteoId);
        if (!prev.pairs.length) {
          fsNote = 'No encontré asignaciones guardadas del año anterior, así que no se aplicó esa regla.';
        } else {
          // Identifica a la misma persona entre años: 1) mismo userId, 2) mismo email, 3) mismo nombre
          const validEmail = (e) => { const x = normName(e); return x && !x.includes('sin_email') ? x : ''; };
          const findCurrent = (prevId, prevName) => {
            const pp = prev.prevParts.find(x => x.userId === prevId);
            const email = pp ? validEmail(pp.email) : '';
            return parts.find(p => p.userId === prevId)
              || (email && parts.find(p => validEmail(p.email) === email))
              || parts.find(p => normName(p.name) === normName((pp && pp.name) || prevName));
          };
          prev.pairs.forEach(a => {
            const g = findCurrent(a.giverId, a.giverName);
            const r = findCurrent(a.receiverId, a.receiverName);
            if (g && r && g.userId !== r.userId) { mark(g.userId, r.userId, 'año anterior'); lastYearCount++; }
          });
        }
      } catch (err) {
        console.warn('No se pudo leer el año anterior:', err);
        fsNote = 'No pude leer las asignaciones del año anterior, así que no se aplicó esa regla.';
      }

      // Historial de años anteriores desde Google Sheets (cruza por nombre)
      try {
        const hist = await getSheetHistoryPairs();
        sheetYears = hist.years;
        hist.pairs.forEach(({ giver, receiver, year }) => {
          const g = parts.find(p => normName(p.name) === normName(giver));
          const r = parts.find(p => normName(p.name) === normName(receiver));
          if (!g || !r || g.userId === r.userId) return; // alguien que no participa este año
          const key = g.userId + '>' + r.userId;
          const isNew = !forbidden.has(key);
          mark(g.userId, r.userId, String(year));
          if (isNew) sheetCount++;
        });
        sheetNote = hist.note;
      } catch (err) {
        console.warn('Error leyendo el historial de Google Sheets:', err);
        sheetNote = 'No pude leer el historial de Google Sheets.';
      }
      note = (lastYearCount || sheetCount) ? sheetNote : [fsNote, sheetNote].filter(Boolean).join(' ');
    }
    return { forbidden, reasons, groupCount, pairCount, lastYearCount, sheetCount, sheetYears, note };
  }

  // ----- Panel de configuración (modal) -----
  const cfgInputStyle = 'width:100%; padding:0.7rem; border:2px solid #e5e7eb; border-radius:8px; box-sizing:border-box;';

  async function handleConfigSorteo(id) {
    try {
      const doc = await db.collection('sorteos').doc(id).get();
      if (!doc.exists) throw new Error('Sorteo no encontrado');
      const d = doc.data();
      const parts = d.participants || [];
      const canEditRestrictions = d.status === 'abierto';
      let groups = (d.restrictionGroups || []).map(g => [...(g.ids || [])]);
      let pairs = (d.restrictionPairs || []).map(r => ({ from: r.from, to: r.to }));
      const nameOf = (uid) => (parts.find(p => p.userId === uid) || {}).name || '(ya no participa)';

      const cfgSelectStyle = 'width:100%; padding:0.6rem; border:2px solid #e5e7eb; border-radius:8px; box-sizing:border-box; margin:0;';
      const partOptions = parts.map(p => `<option value="${esc(p.userId)}">${esc(p.name)}</option>`).join('');

      const restrictionsHtml = !canEditRestrictions ? '' : `
        <hr class="cfg-sep">
        <label class="cfg-check"><input type="checkbox" id="cfg-avoid-last" ${d.avoidLastYear ? 'checked' : ''}> No repetir amigos secretos de años anteriores</label>

        <div class="cfg-cols">
          <div class="cfg-card">
            <label class="cfg-label">➡️ Evitar que a alguien le toque otra persona</label>
            <div id="cfg-pairs-list" class="cfg-groups"></div>
            <div class="cfg-rule-row">
              <select id="cfg-rule-from" style="${cfgSelectStyle}">
                <option value="">¿Quién regala?</option>${partOptions}
              </select>
              <span class="cfg-rule-between">no puede regalarle a</span>
              <select id="cfg-rule-to" style="${cfgSelectStyle}">
                <option value="">¿A quién?</option>${partOptions}
              </select>
            </div>
            <div class="cfg-rule-actions">
              <label class="cfg-check"><input type="checkbox" id="cfg-rule-both"> También al revés</label>
              <button type="button" id="cfg-add-pair" class="cfg-add">+ Agregar regla</button>
            </div>
            <p id="cfg-rule-msg" class="cfg-hint" style="color:#b91c1c;"></p>
            <p class="cfg-hint">Sirve para un solo sentido: "Cata no puede regalarle a Chico" no impide que Chico le regale a Cata.</p>
          </div>

          <div class="cfg-card">
            <label class="cfg-label">🚫 Grupos que no pueden tocarse entre sí</label>
            <div id="cfg-groups-list" class="cfg-groups"></div>
            <div id="cfg-picker" class="cfg-picker">
              ${parts.map(p => `<label class="cfg-pick"><input type="checkbox" value="${esc(p.userId)}"> ${esc(p.name)}</label>`).join('')}
            </div>
            <button type="button" id="cfg-add-group" class="cfg-add">+ Crear grupo con los marcados</button>
            <p class="cfg-hint">Marca 2 o más personas (ej: una pareja) y crea el grupo. Ninguna podrá tocarle a otra del mismo grupo.</p>
          </div>
        </div>

        <div class="cfg-card cfg-blocked">
          <label class="cfg-label">🔒 Cruces que no pueden darse este año</label>
          <p id="cfg-blocked-status" class="cfg-hint"></p>
          <div id="cfg-blocked-list" class="cfg-blocked-grid"></div>
        </div>`;

      const html = `
        <div class="cfg-layout">
          <div class="cfg-general">
            <div>
              <label class="cfg-label">Nombre del sorteo</label>
              <input type="text" id="cfg-name" value="${esc(d.sorteoName)}" style="${cfgInputStyle}">
            </div>
            <div>
              <label class="cfg-label">Presupuesto mínimo ($)</label>
              <input type="number" id="cfg-budget" min="0" value="${d.budget || 0}" style="${cfgInputStyle}">
            </div>
            <div>
              <label class="cfg-label">Fecha y hora de la entrega</label>
              <input type="datetime-local" id="cfg-date" value="${tsToInputValue(d.deliveryDate)}" style="${cfgInputStyle}">
            </div>
            <p class="cfg-hint cfg-general-hint">La fecha se muestra en el Inicio con cuenta regresiva. Déjala vacía si aún no se define.</p>
          </div>
          ${restrictionsHtml}
        </div>`;

      const pending = customConfirm('⚙️ Configurar sorteo', html, 'Guardar');

      // El modal ya está en el DOM: conectamos la lista de grupos
      // Resumen de cruces bloqueados (grupos + reglas + historial), se actualiza en vivo
      let histReasons = null, histNote = '';
      const renderBlocked = () => {
        const box = document.getElementById('cfg-blocked-list');
        const status = document.getElementById('cfg-blocked-status');
        const avoidEl = document.getElementById('cfg-avoid-last');
        if (!box || !status || !avoidEl) return;
        const partIds = new Set(parts.map(p => p.userId));
        const blocked = new Map(); // "giver>receiver" -> { giver, receiver, why:Set }
        const add = (g, r, why) => {
          if (g === r || !partIds.has(g) || !partIds.has(r)) return;
          const k = g + '>' + r;
          if (!blocked.has(k)) blocked.set(k, { giver: g, receiver: r, why: new Set() });
          blocked.get(k).why.add(why);
        };
        groups.forEach(g => g.forEach(a => g.forEach(b => add(a, b, 'grupo'))));
        pairs.forEach(r => add(r.from, r.to, 'regla'));
        const avoid = avoidEl.checked;
        if (avoid && histReasons) histReasons.forEach(e => e.why.forEach(w => add(e.giver, e.receiver, w)));

        // Estado: ¿sigue existiendo alguna combinación válida?
        const lines = [];
        let cls = 'cfg-status-ok';
        if (avoid && !histReasons) lines.push('⏳ Cargando historial de años anteriores…');
        else if (avoid && histNote) lines.push('⚠️ ' + histNote);
        if (parts.length >= 2) {
          const ok = buildAssignment(parts, new Set(blocked.keys()));
          if (ok) lines.push(blocked.size ? `✅ Hay combinaciones posibles con estos ${blocked.size} cruces bloqueados.` : '✅ No hay cruces bloqueados por ahora.');
          else { lines.push('⛔ Con estas reglas no existe ninguna combinación válida: el sorteo daría error. Quita alguna regla o desmarca "años anteriores".'); cls = 'cfg-status-bad'; }
        }
        status.className = 'cfg-hint ' + cls;
        status.innerHTML = lines.map(esc).join('<br>');

        // Lista agrupada por quien regala
        const label = (why) => {
          const w = [...why];
          if (w.includes('año anterior') && w.some(x => /^\d{4}$/.test(x))) w.splice(w.indexOf('año anterior'), 1);
          return w.sort().join(' · ');
        };
        const byGiver = new Map();
        blocked.forEach(e => { if (!byGiver.has(e.giver)) byGiver.set(e.giver, []); byGiver.get(e.giver).push(e); });
        box.innerHTML = [...byGiver.entries()]
          .sort((a, b) => nameOf(a[0]).localeCompare(nameOf(b[0])))
          .map(([g, list]) => `
            <div class="cfg-blk">
              <div class="cfg-blk-giver">${esc(nameOf(g))} <span>no puede regalarle a</span></div>
              <div class="cfg-blk-chips">
                ${list.sort((x, y) => nameOf(x.receiver).localeCompare(nameOf(y.receiver)))
                  .map(e => `<span class="cfg-blk-chip" title="Motivo: ${esc(label(e.why))}">${esc(nameOf(e.receiver))} <small>${esc(label(e.why))}</small></span>`).join('')}
              </div>
            </div>`).join('');
      };

      const renderGroups = () => {
        const list = document.getElementById('cfg-groups-list');
        if (!list) return;
        list.innerHTML = groups.length
          ? groups.map((g, i) => `<div class="cfg-group"><span>${g.map(u => esc(nameOf(u))).join(' ✕ ')}</span><button type="button" data-rm="${i}" title="Quitar grupo">✕</button></div>`).join('')
          : '<p class="cfg-hint" style="margin:0;">Sin restricciones por ahora.</p>';
        renderBlocked();
      };
      const renderPairs = () => {
        const list = document.getElementById('cfg-pairs-list');
        if (!list) return;
        list.innerHTML = pairs.length
          ? pairs.map((r, i) => `<div class="cfg-group"><span><strong>${esc(nameOf(r.from))}</strong> no puede regalarle a <strong>${esc(nameOf(r.to))}</strong></span><button type="button" data-rm-pair="${i}" title="Quitar regla">✕</button></div>`).join('')
          : '<p class="cfg-hint" style="margin:0;">Sin reglas por ahora.</p>';
        renderBlocked();
      };
      if (canEditRestrictions) {
        renderPairs();
        document.getElementById('cfg-pairs-list').addEventListener('click', (e) => {
          const b = e.target.closest('[data-rm-pair]');
          if (!b) return;
          pairs.splice(parseInt(b.dataset.rmPair), 1);
          renderPairs();
        });
        document.getElementById('cfg-add-pair').addEventListener('click', () => {
          const fromEl = document.getElementById('cfg-rule-from');
          const toEl = document.getElementById('cfg-rule-to');
          const bothEl = document.getElementById('cfg-rule-both');
          const msg = document.getElementById('cfg-rule-msg');
          const from = fromEl.value, to = toEl.value;
          msg.textContent = '';
          if (!from || !to) { msg.textContent = 'Elige a las dos personas.'; return; }
          if (from === to) { msg.textContent = 'Elige dos personas distintas.'; return; }
          const add = (a, b) => {
            if (pairs.some(r => r.from === a && r.to === b)) return false;
            pairs.push({ from: a, to: b });
            return true;
          };
          const added1 = add(from, to);
          const added2 = bothEl.checked ? add(to, from) : false;
          if (!added1 && !added2) { msg.textContent = 'Esa regla ya existe.'; return; }
          fromEl.value = ''; toEl.value = ''; bothEl.checked = false;
          renderPairs();
        });

        renderGroups();
        document.getElementById('cfg-groups-list').addEventListener('click', (e) => {
          const b = e.target.closest('[data-rm]');
          if (!b) return;
          groups.splice(parseInt(b.dataset.rm), 1);
          renderGroups();
        });
        document.getElementById('cfg-add-group').addEventListener('click', () => {
          const boxes = [...document.querySelectorAll('#cfg-picker input:checked')];
          if (boxes.length < 2) return;
          groups.push(boxes.map(b => b.value));
          boxes.forEach(b => b.checked = false);
          renderGroups();
        });
      }

      if (canEditRestrictions) {
        document.getElementById('cfg-avoid-last').addEventListener('change', renderBlocked);
        // El historial (Firestore + Google Script) se lee una sola vez al abrir el panel
        buildForbiddenSet(id, { ...d, restrictionGroups: [], restrictionPairs: [], avoidLastYear: true })
          .then(r => { histReasons = r.reasons; histNote = r.note; })
          .catch(err => { console.warn('No se pudo leer el historial:', err); histReasons = new Map(); histNote = 'No pude leer el historial.'; })
          .finally(renderBlocked);
      }

      await pending; // si cancela, lanza 'cancelled'

      const name = document.getElementById('cfg-name').value.trim();
      const budget = parseInt(document.getElementById('cfg-budget').value);
      if (!name) return customAlert('Error', 'El sorteo necesita un nombre.');
      if (isNaN(budget) || budget < 0) return customAlert('Error', 'El presupuesto no es válido.');

      const update = {
        sorteoName: name,
        budget,
        deliveryDate: inputValueToTs(document.getElementById('cfg-date').value)
      };
      if (canEditRestrictions) {
        update.avoidLastYear = document.getElementById('cfg-avoid-last').checked;
        update.restrictionPairs = pairs.filter(r => r.from && r.to && r.from !== r.to);
        update.restrictionGroups = groups.filter(g => g.length >= 2).map(ids => ({ ids })); // Firestore no admite arrays anidados
      }
      await db.collection('sorteos').doc(id).update(update);
      customAlert('¡Guardado!', 'La configuración del sorteo se actualizó.');
    } catch (e) {
      if (e !== 'cancelled') customAlert('Error', e.message || 'No se pudo guardar la configuración.');
    }
  }

  async function handleNewSorteo() {
    try {
      const year = new Date().getFullYear();
      const html = `
        <div style="text-align:left; margin:0.5rem 0;">
          <label class="cfg-label">Nombre del sorteo</label>
          <input type="text" id="new-name" value="Amigo Secreto ${year}" style="${cfgInputStyle}">
          <label class="cfg-label" style="margin-top:12px;">Presupuesto mínimo ($)</label>
          <input type="number" id="new-budget" min="0" value="5000" style="${cfgInputStyle}">
          <label class="cfg-label" style="margin-top:12px;">Fecha y hora de la entrega (opcional)</label>
          <input type="datetime-local" id="new-date" style="${cfgInputStyle}">
          <label class="cfg-check" style="margin-top:14px;"><input type="checkbox" id="new-avoid-last" checked> No repetir amigos secretos de años anteriores</label>
          <p class="cfg-hint">Los grupos que no pueden tocarse se configuran después con el botón ✏️ del sorteo.</p>
        </div>`;
      await customConfirm('Nuevo Sorteo', html, 'Crear');

      const name = document.getElementById('new-name').value.trim();
      const budget = parseInt(document.getElementById('new-budget').value);
      if (!name) return customAlert('Error', 'El sorteo necesita un nombre.');
      if (isNaN(budget) || budget < 0) return customAlert('Error', 'El presupuesto no es válido.');

      await db.collection('sorteos').add({
        sorteoName: name,
        budget,
        deliveryDate: inputValueToTs(document.getElementById('new-date').value),
        avoidLastYear: document.getElementById('new-avoid-last').checked,
        restrictionGroups: [],
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
          <input type="email" id="manual-participant-email" placeholder="Ej: juan@example.com" style="width: 100%; padding: 0.8rem; border: 2px solid #e5e7eb; border-radius: 8px; margin-bottom: 1rem;">

          <label style="display: block; margin-bottom: 0.5rem; font-weight: 600;">Lista de deseados de Steam <span style="font-weight:400; color:#9ca3af;">(opcional)</span>:</label>
          <input type="url" id="manual-participant-wishlist" placeholder="https://store.steampowered.com/wishlist/id/usuario/" style="width: 100%; padding: 0.8rem; border: 2px solid #e5e7eb; border-radius: 8px;">
          <p style="margin-top: 6px; font-size: 0.8rem; color: #9ca3af;">Si la agregas, aparecerá en la pestaña Listas junto a las de los demás.</p>
          
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
      const participantWishlist = document.getElementById('manual-participant-wishlist').value.trim();
      
      if (!participantName || !participantEmail) {
        return customAlert("Error", "Debes completar ambos campos.");
      }
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(participantEmail)) {
        return customAlert("Error", "El email no es válido.");
      }

      if (participantWishlist && !safeHttpUrl(participantWishlist)) {
        return customAlert("Error", "La lista de deseados debe ser un enlace válido que empiece con http:// o https://");
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
          hasAccount: false,
          ...(participantWishlist ? { wishlistURL: participantWishlist } : {})
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

      // Calculamos la asignación ANTES de confirmar, así detectamos restricciones imposibles
      const rules = await buildForbiddenSet(id, data);
      const receivers = buildAssignment(parts, rules.forbidden);
      if (!receivers) {
        throw new Error("Con las restricciones actuales no existe ninguna combinación válida. Revisa los grupos (⚙️) o desactiva \"no repetir años anteriores\".");
      }
      const rulesSummary = [
        rules.groupCount ? `🚫 ${rules.groupCount} grupo${rules.groupCount > 1 ? 's' : ''} de restricción aplicado${rules.groupCount > 1 ? 's' : ''}.` : '',
        rules.pairCount ? `➡️ ${rules.pairCount} regla${rules.pairCount > 1 ? 's' : ''} manual${rules.pairCount > 1 ? 'es' : ''} aplicada${rules.pairCount > 1 ? 's' : ''}.` : '',
        rules.lastYearCount ? `📅 Se evitaron ${rules.lastYearCount} repetidos del año anterior.` : '',
        rules.sheetCount ? `📊 Se evitaron ${rules.sheetCount} cruces más de años anteriores (Google Sheets: ${rules.sheetYears.join(', ')}).` : '',
        rules.note ? `⚠️ ${rules.note}` : ''
      ].filter(Boolean).join('<br>');

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

      await customConfirm("¡Atención!", `Los cambios son definitivos.${rulesSummary ? '<br><br><span style="font-size:0.9rem; color:#555;">' + rulesSummary + '</span>' : ''}<br><br>¿Realizar sorteo ahora?`, "¡Dale!");

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

      await enqueueDiscordDMs(id, data);

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
                ${emailResults.simulated ? `<li>Bots (envío simulado): <strong>${emailResults.simulated}</strong></li>` : ''}
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

  // ==========================================
  // ¿QUIÉN EMPIEZA LAS PISTAS? (ruleta para el día de la entrega)
  // ==========================================
  // Número aleatorio justo (0..n-1) con el generador criptográfico del navegador
  function secureRandomInt(n) {
    if (n <= 1) return 0;
    const max = Math.floor(0x100000000 / n) * n; // descarta valores que sesgarían el resultado
    const buf = new Uint32Array(1);
    do { crypto.getRandomValues(buf); } while (buf[0] >= max);
    return buf[0] % n;
  }

  async function handleClueStarter(sorteoId) {
    if (document.getElementById('clue-overlay')) return; // ya está abierto
    try {
      const doc = await db.collection('sorteos').doc(sorteoId).get();
      if (!doc.exists) throw new Error('Sorteo no encontrado');
      const d = doc.data();
      const names = (d.participants || []).map(p => p.name).filter(Boolean);
      if (names.length < 2) return customAlert('Faltan participantes', 'Se necesitan al menos 2 participantes para sortear quién empieza.');

      const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const picked = [];       // orden en que fueron saliendo
      let spinning = false;

      const overlay = document.createElement('div');
      overlay.id = 'clue-overlay';
      overlay.innerHTML = `
        <div class="clue-card" role="dialog" aria-modal="true" aria-label="Sorteo de quién empieza las pistas">
          <button type="button" class="clue-close" id="clue-close" aria-label="Cerrar">✕</button>
          <p class="clue-kicker">${esc(d.sorteoName)}</p>
          <h2 class="clue-title">🎤 ¿Quién empieza las pistas?</h2>
          <div class="clue-stage" id="clue-stage" aria-live="polite">
            <span class="clue-name" id="clue-name">¿?</span>
          </div>
          <p class="clue-sub" id="clue-sub">Quien salga da la primera pista de su amigo secreto en Discord.</p>
          <div class="clue-actions">
            <button type="button" class="btn-primary clue-spin" id="clue-spin">🎲 ¡Sortear!</button>
            <button type="button" class="btn-secondary clue-reset hidden" id="clue-reset">Reiniciar</button>
          </div>
          <div class="clue-order hidden" id="clue-order"></div>
          <div class="clue-pool" id="clue-pool"></div>
        </div>`;
      document.body.appendChild(overlay);

      const $ = (id) => overlay.querySelector('#' + id);
      const stage = $('clue-stage'), nameEl = $('clue-name'), subEl = $('clue-sub');
      const spinBtn = $('clue-spin'), resetBtn = $('clue-reset'), orderEl = $('clue-order'), poolEl = $('clue-pool');

      const close = () => {
        document.removeEventListener('keydown', onKey);
        overlay.remove();
      };
      const onKey = (e) => { if (e.key === 'Escape' && !spinning) close(); };
      document.addEventListener('keydown', onKey);
      $('clue-close').addEventListener('click', () => { if (!spinning) close(); });
      overlay.addEventListener('click', (e) => { if (e.target === overlay && !spinning) close(); });

      const renderPool = (highlight) => {
        poolEl.innerHTML = names.map(n => {
          const cls = ['clue-chip'];
          if (picked.includes(n)) cls.push('is-done');
          if (n === highlight) cls.push('is-now');
          return `<span class="${cls.join(' ')}">${esc(n)}</span>`;
        }).join('');
      };
      const renderOrder = () => {
        orderEl.classList.toggle('hidden', picked.length === 0);
        orderEl.innerHTML = picked.length
          ? '<strong>Orden de pistas:</strong> ' + picked.map((n, i) => `<span><b>${i + 1}.</b> ${esc(n)}</span>`).join('')
          : '';
      };

      const confetti = () => {
        if (reduceMotion) return;
        const colors = ['#d4af37', '#e6c557', '#c94c4c', '#3d7a51', '#ffffff'];
        for (let i = 0; i < 70; i++) {
          const c = document.createElement('i');
          c.className = 'clue-confetti';
          c.style.left = Math.random() * 100 + '%';
          c.style.background = colors[i % colors.length];
          c.style.animationDelay = (Math.random() * 0.6) + 's';
          c.style.animationDuration = (2.2 + Math.random() * 1.6) + 's';
          c.style.setProperty('--drift', (Math.random() * 200 - 100) + 'px');
          overlay.appendChild(c);
          setTimeout(() => c.remove(), 4500);
        }
      };

      const finish = (winner) => {
        picked.push(winner);
        stage.classList.remove('is-spinning');
        stage.classList.add('is-winner');
        nameEl.textContent = winner;
        const left = names.filter(n => !picked.includes(n));
        subEl.innerHTML = picked.length === 1
          ? `🎉 <strong>${esc(winner)}</strong> empieza dando las pistas.`
          : `🎉 Sigue <strong>${esc(winner)}</strong>.`;
        spinBtn.textContent = left.length ? '➡️ Sortear siguiente' : '✅ Todos sorteados';
        spinBtn.disabled = left.length === 0;
        resetBtn.classList.remove('hidden');
        renderOrder();
        renderPool(winner);
        confetti();
        spinning = false;
      };

      const spin = () => {
        if (spinning) return;
        const remaining = names.filter(n => !picked.includes(n));
        if (!remaining.length) return;

        // El ganador se decide aquí; la animación solo lo "revela"
        const winner = remaining[secureRandomInt(remaining.length)];
        if (reduceMotion) { finish(winner); return; }

        spinning = true;
        spinBtn.disabled = true;
        resetBtn.classList.add('hidden');
        stage.classList.remove('is-winner');
        stage.classList.add('is-spinning');
        subEl.textContent = '…sorteando…';

        // Recorre la lista en círculo y termina exactamente en el ganador
        const total = 34 + secureRandomInt(8);
        const wIdx = remaining.indexOf(winner);
        let idx = ((wIdx - total) % remaining.length + remaining.length) % remaining.length;
        let step = 0;

        const tick = () => {
          idx = (idx + 1) % remaining.length;
          step++;
          const shown = remaining[idx];
          nameEl.textContent = shown;
          renderPool(shown);
          if (step >= total) { finish(winner); return; }
          // empieza rápido (~60ms) y se frena hacia el final (~520ms)
          const t = step / total;
          setTimeout(tick, 60 + Math.pow(t, 3) * 460);
        };
        tick();
      };

      spinBtn.addEventListener('click', spin);
      resetBtn.addEventListener('click', () => {
        if (spinning) return;
        picked.length = 0;
        stage.classList.remove('is-winner');
        nameEl.textContent = '¿?';
        subEl.textContent = 'Quien salga da la primera pista de su amigo secreto en Discord.';
        spinBtn.textContent = '🎲 ¡Sortear!';
        spinBtn.disabled = false;
        resetBtn.classList.add('hidden');
        renderOrder();
        renderPool();
      });

      renderPool();
      spinBtn.focus();
    } catch (e) {
      console.error(e);
      customAlert('Error', e.message || 'No se pudo abrir el sorteo de pistas.');
    }
  }

  // ==========================================
  // 🤖 BOTS DE PRUEBA (para probar restricciones y que no se repitan cruces)
  // ==========================================
  // Nombres de respaldo (los de la hoja "Amigo Secreto 2025") por si no se puede leer el Google Script
  const FALLBACK_BOT_NAMES = ['Angelo', 'Ariel', 'Cata', 'Chico', 'Dann', 'Diego', 'Jaime', 'Lukas', 'Pinilla', 'Seba', 'Tommy'];

  // Correo falso pero válido para el sistema (example.com es un dominio reservado: nunca llega a una persona real)
  function botEmailFor(name) {
    const slug = (name || 'bot').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bot';
    return `bot.${slug}@example.com`;
  }

  // Nombres que han participado en años anteriores (Google Sheet vía Apps Script)
  async function getBotCandidateNames() {
    try {
      const hist = await getSheetHistoryPairs();
      const map = new Map();
      hist.pairs.forEach(({ giver, receiver }) => [giver, receiver].forEach(n => {
        const k = normName(n);
        if (k && !map.has(k)) map.set(k, String(n).trim());
      }));
      if (map.size) return { names: [...map.values()].sort((a, b) => a.localeCompare(b)), source: 'historial de años anteriores' };
    } catch (err) {
      console.warn('No se pudieron leer los nombres del historial:', err);
    }
    return { names: [...FALLBACK_BOT_NAMES], source: 'lista de respaldo' };
  }

  async function handleAddBots(sorteoId) {
    try {
      const docRef = db.collection('sorteos').doc(sorteoId);
      const snap = await docRef.get();
      if (!snap.exists) throw new Error('Sorteo no encontrado');
      const d = snap.data();
      if (d.status !== 'abierto') return customAlert('Sorteo no abierto', 'Solo puedes agregar bots mientras el sorteo está abierto.');
      if (d.adminId !== currentUser.uid) return customAlert('Sin permiso', 'Solo el administrador puede agregar bots.');

      showLoadingModal('Buscando nombres...', 'Leyendo los participantes de años anteriores...');
      const { names, source } = await getBotCandidateNames();

      const parts = d.participants || [];
      const taken = new Set(parts.map(p => normName(p.name)));
      const available = names.filter(n => !taken.has(normName(n)));
      if (!available.length) {
        return customAlert('Nada que agregar', 'Todos los nombres del historial ya están en este sorteo.');
      }

      const html = `
        <div style="text-align:left; margin:0.5rem 0;">
          <p style="margin:0 0 10px; font-size:0.9rem; color:#555;">
            Se agregarán como participantes <strong>sin cuenta</strong>, con correos falsos
            (ej: <code>${esc(botEmailFor(available[0]))}</code>) que pasan la validación pero no llegan a nadie.
            Nombres tomados del <strong>${esc(source)}</strong>, para probar que no se repitan cruces.
          </p>
          <div style="display:flex; flex-wrap:wrap; gap:8px 14px; max-height:240px; overflow-y:auto; padding:10px; border:2px solid #e5e7eb; border-radius:8px;">
            ${available.map(n => `<label style="display:flex; align-items:center; gap:6px; font-size:0.95rem; cursor:pointer;"><input type="checkbox" class="bot-name-check" value="${esc(n)}" checked> ${esc(n)}</label>`).join('')}
          </div>
          <p style="margin:10px 0 0; font-size:0.8rem; color:#9ca3af;">Los nombres que ya están en el sorteo no aparecen aquí.</p>
        </div>`;
      await customConfirm('🤖 Agregar bots de prueba', html, 'Agregar');

      const chosen = [...document.querySelectorAll('.bot-name-check:checked')].map(c => c.value);
      if (!chosen.length) return;

      const stamp = Date.now();
      const bots = chosen.map((name, i) => ({
        userId: `bot_${stamp}_${i}_${Math.random().toString(36).slice(2, 7)}`,
        name,
        email: botEmailFor(name),
        hasAccount: false,
        isBot: true
      }));

      await docRef.update({
        participants: firebase.firestore.FieldValue.arrayUnion(...bots),
        participantIds: firebase.firestore.FieldValue.arrayUnion(...bots.map(b => b.userId))
      });
      customAlert('🤖 Bots agregados', `Se agregaron <strong>${bots.length}</strong> bots: ${bots.map(b => esc(b.name)).join(', ')}.`);
    } catch (e) {
      if (e !== 'cancelled') {
        console.error(e);
        customAlert('Error', e.message || 'No se pudieron agregar los bots.');
      }
    }
  }

  async function handleRemoveBots(sorteoId) {
    try {
      const docRef = db.collection('sorteos').doc(sorteoId);
      const snap = await docRef.get();
      if (!snap.exists) throw new Error('Sorteo no encontrado');
      const d = snap.data();
      if (d.status !== 'abierto') return customAlert('Sorteo no abierto', 'Solo puedes quitar bots mientras el sorteo está abierto. Si ya se realizó, usa "Rehacer" primero.');
      const parts = d.participants || [];
      const botIds = new Set(parts.filter(p => p.isBot).map(p => p.userId));
      if (!botIds.size) return customAlert('Sin bots', 'Este sorteo no tiene bots.');

      await customConfirm('🧹 Quitar bots', `Se quitarán <strong>${botIds.size}</strong> bots de este sorteo (y las reglas que los mencionen).`, 'Quitar bots');

      await docRef.update({
        participants: parts.filter(p => !botIds.has(p.userId)),
        participantIds: (d.participantIds || []).filter(id => !botIds.has(id)),
        restrictionGroups: (d.restrictionGroups || [])
          .map(g => ({ ids: (g.ids || []).filter(id => !botIds.has(id)) }))
          .filter(g => g.ids.length >= 2),
        restrictionPairs: (d.restrictionPairs || []).filter(r => !botIds.has(r.from) && !botIds.has(r.to))
      });
      customAlert('🧹 Listo', 'Los bots fueron eliminados del sorteo.');
    } catch (e) {
      if (e !== 'cancelled') {
        console.error(e);
        customAlert('Error', e.message || 'No se pudieron quitar los bots.');
      }
    }
  }

  // Revisa TODAS las asignaciones contra las reglas del sorteo + historial. Solo para sorteos de prueba (con bots).
  async function handleVerifyAssignments(sorteoId) {
    try {
      showLoadingModal('Verificando cruces...', 'Comparando las asignaciones con las reglas y el historial...');
      const docRef = db.collection('sorteos').doc(sorteoId);
      const snap = await docRef.get();
      if (!snap.exists) throw new Error('Sorteo no encontrado');
      const d = snap.data();
      if (d.adminId !== currentUser.uid) return customAlert('Sin permiso', 'Solo el administrador puede verificar.');

      const asgSnap = await docRef.collection('assignments').get();
      if (asgSnap.empty) return customAlert('Sin asignaciones', 'Este sorteo todavía no tiene asignaciones.');

      // Siempre se compara contra el historial, aunque el sorteo no tuviera activada esa regla
      const rules = await buildForbiddenSet(sorteoId, { ...d, avoidLastYear: true });
      const rows = asgSnap.docs.map(x => x.data()).sort((a, b) => String(a.giverName).localeCompare(String(b.giverName)));
      const label = (why) => {
        const w = [...why];
        if (w.includes('año anterior') && w.some(x => /^\d{4}$/.test(x))) w.splice(w.indexOf('año anterior'), 1);
        return w.sort().join(' · ');
      };

      let bad = 0;
      const lines = rows.map(a => {
        const entry = rules.reasons.get(a.giverId + '>' + a.receiverId);
        if (entry) bad++;
        return `<tr style="${entry ? 'background:#fef2f2;' : ''}">
          <td style="padding:4px 8px; text-align:left;">${esc(a.giverName)}</td>
          <td style="padding:4px 4px;">➔</td>
          <td style="padding:4px 8px; text-align:left;">${esc(a.receiverName)}</td>
          <td style="padding:4px 8px; text-align:left; font-size:0.8rem; color:${entry ? '#b91c1c' : '#059669'};">${entry ? '⚠️ ' + esc(label(entry.why)) : '✅'}</td>
        </tr>`;
      }).join('');

      const yearsTxt = rules.sheetYears && rules.sheetYears.length ? ` (años del historial: ${rules.sheetYears.join(', ')})` : '';
      const summary = bad
        ? `<p style="color:#b91c1c; font-weight:700;">⚠️ ${bad} de ${rows.length} cruces rompen reglas o repiten años anteriores.</p>`
        : `<p style="color:#059669; font-weight:700;">✅ Los ${rows.length} cruces respetan las reglas y no repiten años anteriores.</p>`;
      const note = [
        d.avoidLastYear ? '' : 'Este sorteo NO tenía activada la opción "no repetir años anteriores", así que es esperable ver repetidos.',
        rules.note || ''
      ].filter(Boolean).map(t => `<p style="font-size:0.8rem; color:#92400e;">${esc(t)}</p>`).join('');

      customAlert('🔍 Verificación de cruces', `
        <div style="text-align:left;">
          ${summary}
          <div style="max-height:45vh; overflow-y:auto; border:1px solid #e5e7eb; border-radius:8px;">
            <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">${lines}</table>
          </div>
          <p style="font-size:0.8rem; color:#6b7280; margin-top:8px;">Comparado con grupos, reglas manuales, año anterior${esc(yearsTxt)}. Esta vista muestra todas las asignaciones: úsala solo en sorteos de prueba.</p>
          ${note}
        </div>`);
    } catch (e) {
      console.error(e);
      customAlert('Error', e.message || 'No se pudo verificar.');
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
              const icon = p.isBot ? '🤖' : (p.hasAccount ? '👤' : '✉️');
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
            if (d.deliveryDate && d.deliveryDate.toDate) {
              datesHtml += ` <span class="date-pill" style="${styleBlue}" title="Fecha de entrega">🎁 ${d.deliveryDate.toDate().toLocaleDateString('es-CL')}</span>`;
            }
        }

        const finalizedClass = isFinalized ? 'is-finalized' : '';
        const statusLabel = d.status === 'realizado' ? 'REALIZADO' : (isFinalized ? 'FINALIZADO' : 'ABIERTO');
        const statusClass = d.status === 'realizado' ? 'status-done' : (isFinalized ? 'status-archived' : 'status-open');
        const opacityStyle = isFinalized ? 'opacity:0.9;' : '';

        // --- PARTICIPANTES ---
        const partsHtml = d.participants.map(p => {
            const icon = p.isBot ? '🤖' : (p.hasAccount ? '👤' : '✉️');
            const bgClass = p.hasAccount ? 'bg-user' : 'bg-manual';
            const editBtn = (isAdmin && !p.hasAccount && d.status === 'abierto') 
              ? `<button class="btn-edit-part" onclick="window.handleEditParticipant('${doc.id}', '${p.userId}', '${p.email || ''}')">✏️</button>` : '';
            return `<div class="participant-chip ${bgClass}"><div class="p-icon">${icon}</div><div class="p-info"><span class="p-name">${p.name}</span></div>${editBtn}</div>`;
        }).join('');
        
        // --- BOTONES DE ACCIÓN ---
        const hasBots = (d.participants || []).some(p => p.isBot);
        let btns = '';
        if (isAdmin) {
          // 1. ETIQUETA ARCHIVADO (A la izquierda del lápiz)
          if (isFinalized) {
             btns += `<span style="font-size:0.75rem; color:#6b7280; font-weight:700; border:1px solid #ccc; padding:2px 8px; border-radius:10px; margin-right:10px;">ARCHIVADO</span>`;
          }

          // 2. BOTÓN EDITAR (Lápiz)
          btns += `<button class="btn-icon btn-edit-name" data-id="${doc.id}" data-name="${d.sorteoName}" data-status="${d.status}" title="${isFinalized ? 'Editar Nombre' : 'Configurar sorteo'}">${iconEdit}</button>`;
          
          if (d.status === 'abierto') {
            btns += `<button class="btn-icon btn-view-id" data-id="${doc.id}" title="Copiar ID">${iconLink}</button>`;
            btns += `<button class="btn-icon btn-add-participant-manual" data-id="${doc.id}" title="Agregar Manual">${iconUserPlus}</button>`;
            btns += `<button class="btn-icon btn-add-bots" data-id="${doc.id}" title="Agregar bots de prueba">🤖</button>`;
            if (hasBots) btns += `<button class="btn-icon btn-remove-bots" data-id="${doc.id}" title="Quitar bots">🧹</button>`;
            btns += `<button class="btn-icon btn-realizar-sorteo" data-id="${doc.id}" title="REALIZAR">${iconPlay}</button>`;
          } 
          else if (d.status === 'realizado') {
            btns += `<button class="btn-icon btn-view-id" data-id="${doc.id}" title="Copiar ID">${iconLink}</button>`;
            btns += `<button class="btn-icon btn-reset-sorteo" data-id="${doc.id}" title="Rehacer">${iconReset}</button>`;
            btns += `<button class="btn-icon btn-clue-start" data-id="${doc.id}" title="¿Quién empieza las pistas?">🎤</button>`;
            if (hasBots) btns += `<button class="btn-icon btn-verify-cruces" data-id="${doc.id}" title="Verificar cruces (prueba)">🔍</button>`;
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
  
  // Audio (reproductor estilo lobby)
  const audioPlayer = document.getElementById('audio-player');
  const audioBox = document.getElementById('audio-controls');
  const playBtn = document.getElementById('play-pause-btn');
  const coverBtn = document.getElementById('audio-cover-btn');
  const muteBtn = document.getElementById('mute-btn');
  const volSlider = document.getElementById('volume-slider');
  const audioTitle = document.getElementById('audio-title');

  if (audioPlayer && playBtn && volSlider) {
    const svg = (inner) => `<svg viewBox="0 0 24 24" aria-hidden="true">${inner}</svg>`;
    const ICON_PLAY  = svg('<path d="M8 5v14l11-7z"/>');
    const ICON_PAUSE = svg('<path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>');
    const spk = '<path d="M3 9v6h4l5 4V5L7 9H3z" fill="currentColor"/>';
    const stroke = 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"';
    const ICON_VOL_HIGH = svg(spk + `<path d="M15.5 8.5a5 5 0 0 1 0 7" ${stroke}/><path d="M18.5 5.5a9 9 0 0 1 0 13" ${stroke}/>`);
    const ICON_VOL_LOW  = svg(spk + `<path d="M15.5 8.5a5 5 0 0 1 0 7" ${stroke}/>`);
    const ICON_MUTED    = svg(spk + `<path d="M16 9l5 6M21 9l-5 6" ${stroke}/>`);

    let lastVolume = 5; // % para restaurar al quitar el silencio

    // Volumen guardado (si existe)
    try {
      const saved = parseInt(localStorage.getItem('musicVolume'), 10);
      if (!isNaN(saved) && saved >= 0 && saved <= 100) volSlider.value = saved;
    } catch (e) {}

    const renderVolume = () => {
      const v = parseInt(volSlider.value, 10);
      audioPlayer.volume = v / 100;
      volSlider.style.setProperty('--vol', v + '%');
      if (muteBtn) {
        muteBtn.innerHTML = v === 0 ? ICON_MUTED : (v < 50 ? ICON_VOL_LOW : ICON_VOL_HIGH);
        muteBtn.setAttribute('aria-label', v === 0 ? 'Quitar silencio' : 'Silenciar');
      }
      if (v > 0) lastVolume = v;
      try { localStorage.setItem('musicVolume', String(v)); } catch (e) {}
    };

    const renderPlayState = () => {
      const playing = !audioPlayer.paused;
      playBtn.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
      playBtn.setAttribute('aria-label', playing ? 'Pausar música' : 'Reproducir música');
      if (audioBox) audioBox.classList.toggle('is-playing', playing);
    };

    const togglePlay = () => {
      if (audioPlayer.paused) audioPlayer.play().catch(err => console.warn('No se pudo reproducir:', err));
      else audioPlayer.pause();
    };
    playBtn.addEventListener('click', togglePlay);
    if (coverBtn) coverBtn.addEventListener('click', togglePlay); // también funciona con el panel cerrado
    audioPlayer.addEventListener('play', renderPlayState);
    audioPlayer.addEventListener('pause', renderPlayState);

    volSlider.addEventListener('input', renderVolume);
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        volSlider.value = parseInt(volSlider.value, 10) === 0 ? lastVolume : 0;
        renderVolume();
      });
    }

    // Marquesina: el título solo se desplaza si no cabe en su espacio
    const updateMarquee = () => {
      if (!audioTitle) return;
      audioTitle.classList.remove('is-scrolling');
      const wrap = audioTitle.parentElement;
      const overflow = audioTitle.scrollWidth - wrap.clientWidth;
      if (overflow > 4) {
        audioTitle.style.setProperty('--marquee-shift', overflow + 'px');
        audioTitle.style.setProperty('--marquee-time', Math.max(5, overflow / 20 + 4) + 's');
        audioTitle.classList.add('is-scrolling');
      }
    };
    window.addEventListener('resize', updateMarquee);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(updateMarquee);

    renderVolume();
    renderPlayState();
    updateMarquee();
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