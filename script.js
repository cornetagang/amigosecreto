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
  // 2.5 SISTEMA DE ENVÍO DE EMAILS CON EMAILJS (MEJORADO)
  // ==========================================
  
  /**
   * Envía un email usando EmailJS con manejo de errores detallado
   */
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

    /**
   * Envía correos a TODOS (Registrados y Manuales)
   */
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

  const btnLogoutMobile = document.getElementById('logout-btn');
  if(btnLogoutMobile) btnLogoutMobile.addEventListener('click', (e) => { e.preventDefault(); auth.signOut(); });

  const btnLogoutPC = document.getElementById('logout-btn-pc');
  if(btnLogoutPC) btnLogoutPC.addEventListener('click', (e) => { e.preventDefault(); auth.signOut(); });


  // --- MONITOR DE ESTADO (Auth State Observer) ---
  auth.onAuthStateChanged(async (user) => {
    if (user) {
      currentUser = user;
      
      if (unsubscribeUserDoc) unsubscribeUserDoc();
      unsubscribeUserDoc = db.collection('users').doc(user.uid)
        .onSnapshot(doc => {
          if (doc.exists) {
            const userData = doc.data();
            currentUserName = userData.name || 'Usuario';
            const usernamePC = document.getElementById('nav-username-pc');
            const usernameMobile = document.getElementById('nav-username');
            if (usernamePC) usernamePC.textContent = currentUserName;
            if (usernameMobile) usernameMobile.textContent = currentUserName;

            const wishUrlInput = document.getElementById('my-wishlist-url');
            if (wishUrlInput && userData.wishlistURL) wishUrlInput.value = userData.wishlistURL;

            const steamCodeInput = document.getElementById('my-steam-friend-code');
            if (steamCodeInput && userData.steamFriendCode) steamCodeInput.value = userData.steamFriendCode;
          }
        });

      authModal.style.display = 'none';
      appWrapper.style.display = 'block';
      initApp();
    } else {
      currentUser = null;
      currentUserName = '';
      if (unsubscribeUserDoc) { unsubscribeUserDoc(); unsubscribeUserDoc = null; }
      if (unsubscribeSorteos) { unsubscribeSorteos(); unsubscribeSorteos = null; }
      if (unsubscribeWishlists) { unsubscribeWishlists(); unsubscribeWishlists = null; }
      if (unsubscribeInicio) { unsubscribeInicio(); unsubscribeInicio = null; }
      if (unsubscribeUsers) { unsubscribeUsers(); unsubscribeUsers = null; }
      authModal.style.display = 'flex';
      appWrapper.style.display = 'none';
    }
  });

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

  function loadInicioSection() {
    const container = document.getElementById('secret-friend-container');
    if (!container) return;
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
container.innerHTML = `
  <div class="secret-friend-card horizontal-card">
    <div class="card-section section-left">
      <div class="gift-icon">🎁</div>
      <div class="title-group">
        <h2>Tu Amigo<br>Secreto</h2>
      </div>
    </div>

    <div class="card-section section-center">
      <div class="info-block">
        <span class="label">Sorteo</span>
        <span class="value">${sorteoData.sorteoName}</span>
      </div>
      <div class="vertical-divider"></div>
      <div class="info-block">
        <span class="label">Presupuesto</span>
        <span class="value budget">$${sorteoData.budget}</span>
      </div>
    </div>

    <div class="card-section section-right">
      <div class="reveal-text">
        <span class="label">LE REGALAS A:</span>
        <span class="secret-name">............</span>
      </div>
      <button class="btn-reveal-secret" data-name="${assignment.receiverName}">
        ${iconView}
      </button>
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
// SECCIÓN HISTORIAL 2024 (Diseño Álbum)
// ==========================================
function loadHistorialSection() {
  const btnContainer = document.getElementById('historial-btn-container');
  const contenidoDiv = document.getElementById('historial-contenido');
  
  const MY_API_URL = "https://script.google.com/macros/s/AKfycbzeEirq01wkJHpXJmq-8nR97m-vvalVoyB2rclZE44DJIJbrJLzTRzMA2j1mEopqnC7rg/exec"; 
  
  if (!btnContainer || !contenidoDiv) return;

  btnContainer.innerHTML = ''; 
  contenidoDiv.style.display = 'block';

  (async function renderHistory() {
    contenidoDiv.innerHTML = `
      <div style="text-align:center; padding:3rem;">
        <div style="font-size:3rem; margin-bottom:1rem; animation:bounce 1s infinite;">🎁</div>
        <p>Cargando...</p>
      </div>`;

    try {
      const response = await fetch(MY_API_URL);
      if (!response.ok) throw new Error(`Error API: ${response.status}`);
      
      const rawData = await response.json(); 
      
      let data = [];
      if (Array.isArray(rawData)) {
          data = rawData;
      } else if (rawData.data && Array.isArray(rawData.data)) {
          data = rawData.data;
      } else {
          const possibleArray = Object.values(rawData).find(val => Array.isArray(val));
          data = possibleArray || [];
      }

      if (!Array.isArray(data) || data.length === 0) {
        contenidoDiv.innerHTML = '<div class="history-section-container"><p style="text-align:center; color:white;">No se encontraron registros del 2024.</p></div>';
        return;
      }

      const cardsHtml = data.map(row => {
        const giver = row.Giver || row.giver || "Anónimo";
        const receiver = row.Receiver || row.receiver || "Alguien";
        const giftUrl = row.GiftURL || row.giftURL || "#";
        const imgUrl = row.ImageURL || row.imageURL;

        const finalImg = (imgUrl && imgUrl.toString().startsWith('http')) 
          ? imgUrl 
          : 'https://via.placeholder.com/400x250?text=Sin+Imagen';

        return `
          <div class="history-card">
            <div class="history-header">
              <div class="name-badge">${giver}</div>
              <div class="arrow-badge">➔</div>
              <div class="name-badge">${receiver}</div>
            </div>

            <div class="history-image-wrapper">
              <img src="${finalImg}" alt="Regalo de ${giver}" loading="lazy">
              
              ${giftUrl !== '#' && giftUrl.length > 5 
                ? `<a href="${giftUrl}" target="_blank" class="card-link-overlay" title="Ver regalo original"></a>` 
                : ''}
            </div>
          </div>
        `;
      }).join('');

      contenidoDiv.innerHTML = `
        <div class="history-section-container" style="animation: fadeInUp 0.5s ease;">
          <div class="history-year-title">2024</div>
          <div class="history-grid">
            ${cardsHtml}
          </div>
        </div>
      `;

    } catch (error) {
      console.error("❌ Error al cargar historial:", error);
      contenidoDiv.innerHTML = `
        <div class="history-section-container" style="text-align:center; color:#ffcccb; padding:2rem;">
          <p>Ups, no pudimos cargar el álbum.</p>
          <p style="font-size:0.8rem;">Detalle: ${error.message}</p>
        </div>`;
    }
  })();
}

  const savePerfil = document.getElementById('save-profile-btn');
  if (savePerfil) {
    savePerfil.addEventListener('click', async () => {
      const wishlistURL = document.getElementById('my-wishlist-url').value.trim();
      const steamCode = document.getElementById('my-steam-friend-code').value.trim();
      try {
        await db.collection('users').doc(currentUser.uid).update({ 
          wishlistURL,
          steamFriendCode: steamCode
        });
        customAlert("Perfil actualizado", "Tu información se ha guardado correctamente.");
      } catch (error) {
        customAlert("Error", error.message);
      }
    });
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

    sorteoSec.innerHTML = `
      <div class="section-header">
        <h2>Sorteos</h2>
        <button id="btn-new-sorteo" class="btn-primary">+ Nuevo Sorteo</button>
      </div>
      <div id="sorteos-list"></div>
    `;

    document.getElementById('btn-new-sorteo').addEventListener('click', handleNewSorteo);
    
    sorteoSec.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-id]');
      if (!btn) return;
      const id = btn.dataset.id;
      
      if (btn.classList.contains('btn-edit-name')) await handleEditName(id, btn.dataset.name);
      else if (btn.classList.contains('btn-view-id')) await handleViewId(id);
      else if (btn.classList.contains('btn-add-participant-manual')) await handleAddParticipantManual(id);
      else if (btn.classList.contains('btn-realizar-sorteo')) await handleRealizarSorteo(id);
      else if (btn.classList.contains('btn-reset-sorteo')) await handleResetSorteo(id);
      else if (btn.classList.contains('btn-delete-sorteo')) await handleDeleteSorteo(id, btn.dataset.name);
      else if (btn.classList.contains('btn-ver-resultado')) await handleVerResultado(id);
      else if (btn.classList.contains('btn-view-all')) await handleViewAllResults(id);
    });

    displayMySorteos();
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
      
      batch.update(db.collection('sorteos').doc(id), { status: "realizado" });
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
          
          // Fichas de Participantes
          const partsHtml = d.participants.map(p => {
            const icon = p.hasAccount ? '👤' : '✉️';
            const bgClass = p.hasAccount ? 'bg-user' : 'bg-manual';
            
            // LOGICA LÁPIZ: Solo si soy admin, es manual Y el sorteo está ABIERTO
            let editBtn = '';
            if (isAdmin && !p.hasAccount && d.status === 'abierto') {
               editBtn = `<button class="btn-edit-part" onclick="handleEditParticipant('${doc.id}', '${p.userId}', '${p.email || ''}')" title="Corregir correo">✏️</button>`;
            }

            return `
              <div class="participant-chip ${bgClass}" title="${p.email || ''}">
                <div class="p-icon">${icon}</div>
                <div class="p-info"><span class="p-name">${p.name}</span></div>
                ${editBtn}
              </div>`;
          }).join('');
          
          // Botones de Acción
          let btns = '';
          if (isAdmin) {
            btns += `<button class="btn-icon btn-edit-name" data-id="${doc.id}" data-name="${d.sorteoName}" title="Editar nombre">${iconEdit}</button>`;
            btns += `<button class="btn-icon btn-view-id" data-id="${doc.id}" title="Copiar ID">${iconLink}</button>`;
            
            if (d.status === 'abierto') {
              // Si está ABIERTO: Botones de Agregar y Play Verde
              btns += `<button class="btn-icon btn-add-participant-manual" data-id="${doc.id}" title="Agregar manual" style="color:#d4af37; border-color:#d4af37;">${iconUserPlus}</button>`;
              btns += `<button class="btn-icon btn-realizar-sorteo" data-id="${doc.id}" style="color:white; background:#10b981; border:none;" title="REALIZAR">${iconPlay}</button>`;
            } else {
              // Si está REALIZADO: Botón de Reiniciar (Naranja)
              btns += `<button class="btn-icon btn-reset-sorteo" data-id="${doc.id}" title="Rehacer Sorteo" style="color:#f59e0b; border-color:#f59e0b;">${iconReset}</button>`;
            }
            
            btns += `<button class="btn-icon btn-delete-sorteo" data-id="${doc.id}" data-name="${d.sorteoName}" title="Eliminar" style="color:#ef4444;">${iconDelete}</button>`;
          } else {
            // Vista Usuario Normal
            if (d.status === 'realizado') btns += `<button class="btn-icon btn-ver-resultado" data-id="${doc.id}" title="Ver mi resultado" style="width:auto; padding:0 15px; border-radius:20px;">👁️ Ver mi Amigo</button>`;
            else btns += `<span class="waiting-badge">⏳ Esperando...</span>`;
          }

          const statusLabel = d.status === 'realizado' ? 'REALIZADO' : 'ABIERTO';
          const statusClass = d.status === 'realizado' ? 'status-done' : 'status-open';

          return `
            <div class="sorteo-card modern-layout">
              <div class="card-header-modern centered-header">
                <h3 class="centered-title">${d.sorteoName}</h3>
                <div class="actions-block centered-actions">${btns}</div>
                <div class="header-meta-row centered-meta">
                  <span class="status-pill ${statusClass}">${statusLabel}</span>
                  <span class="budget-mini-pill">💰 $${d.budget}</span>
                  <span class="date-pill">📅 ${d.createdAt ? new Date(d.createdAt.seconds * 1000).toLocaleDateString() : 'Reciente'}</span>
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
