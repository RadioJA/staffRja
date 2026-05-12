const SUPABASE_URL = "https://ryogxtycodsunosfvyyl.supabase.co";

// IMPORTANTE: El error "Failed to fetch" se debe a que la SUPABASE_KEY es incorrecta.
// Las claves de Supabase (anon key) siempre empiezan con "eyJ...". Revisa tu panel de Supabase > Settings > API.
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ5b2d4dHljb2RzdW5vc2Z2eXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1OTg4NTgsImV4cCI6MjA4NzE3NDg1OH0.Z1try1IGBu8yvZz2sIZQLuB5kaaD-0da4whTeZTApss"; 

// Inicialización global del cliente
let supabaseClient = null;

// Funciones globales
function toggleForm() {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    if (!loginForm || !registerForm) return;
    
    loginForm.classList.toggle('hidden');
    registerForm.classList.toggle('hidden');
}

// Escuchar el evento de envío del formulario de login para redirigir
document.addEventListener('DOMContentLoaded', () => {
    // 1. Verificación de Protocolo (Debe ser http o https para que Supabase funcione)
    if (window.location.protocol === 'file:') {
        const msg = "DETENCIÓN DE SEGURIDAD: No puedes abrir el HTML directamente (file://).\n\n" + 
                    "Supabase requiere un servidor web para gestionar sesiones.\n\n" +
                    "SOLUCIÓN:\n" +
                    "1. Abre esta carpeta en VS Code.\n" +
                    "2. Instala la extensión 'Live Server'.\n" +
                    "3. Haz clic derecho en index.html y elige 'Open with Live Server'.";
        console.error(msg);
        alert(msg);
        return; // Detener ejecución para evitar errores de red y bloqueos de sesión
    }

    // Inicializar el cliente dentro del evento para asegurar que las librerías externas estén listas
    if (window.supabase) {
        try {
            supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                }
            });
        } catch (initError) {
            console.error("Error crítico al inicializar Supabase:", initError.message);
            return;
        }
    } else {
        console.error("No se detectó la librería de Supabase. Revisa la conexión o los tags <script>.");
    }

    if (!supabaseClient) {
        console.error("No se pudo inicializar Supabase. Verifique las librerías.");
    }

    const updateUIPermissions = (role) => {
        const isAdmin = (role === 'admin');

        // Elementos que son exclusivos para administradores (Sidebar y Dashboard)
        const adminOnlyElements = [
            '#menu-inicio', '#menu-moderadores', '#menu-locutores', '#menu-dh', '#menu-dg', 
            '#menu-estadisticas', '#menu-certificados', '#menu-reconocimiento', '#menu-usuarios',
            'dash-moderadores', 'dash-locutores', 'dash-dh', 'dash-dg', 
            'dash-estadisticas', 'dash-certificados', 'dash-reconocimiento', 'dash-usuarios'
        ];

        adminOnlyElements.forEach(selector => {
            const isId = !selector.startsWith('#');
            const el = isId ? document.getElementById(selector) : document.querySelector(selector);
            
            if (el) {
                const isDash = selector.includes('dash-');
                el.style.display = isAdmin ? (isDash ? 'flex' : 'block') : 'none';
            }
        });
    };

    // Cargar estado inicial desde localStorage para evitar parpadeos o menús faltantes al inicio
    const initialRole = localStorage.getItem('userRole') || 'user';
    const initialUserId = localStorage.getItem('currentUser');
    
    // Aplicar permisos de interfaz inmediatamente
    updateUIPermissions(initialRole);

    // Verificar sesión al cargar páginas protegidas
    const checkSession = async () => {
        try {
            const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
            
            if (authError) throw authError;
            if (!user) throw new Error("No hay usuario");

            if (user) {
                // Si el correo es el admin, asegurar que el localStorage y la DB estén sincronizados
                // No intentamos actualizar la DB desde aquí por seguridad (RLS lo bloquea)
                if (user.email.toLowerCase() === 'ministrylion@gmail.com') {
                    localStorage.setItem('userRole', 'admin');
                }
                
                const { data: profile } = await supabaseClient
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .maybeSingle();
                
                const finalRole = profile?.role || (user.email.toLowerCase() === 'ministrylion@gmail.com' ? 'admin' : 'user');
                localStorage.setItem('userRole', finalRole);
                localStorage.setItem('currentUser', user.id);
                updateUIPermissions(finalRole);

                // Redirección forzada para no-admins si intentan acceder a páginas prohibidas
                const adminPages = ['panel_principal.html', 'moderadores.html', 'locutores.html', 'dh.html', 'dg.html', 'estadisticas.html', 'certificado.html', 'reconocimiento.html', 'usuarios.html'];
                const currentPath = window.location.pathname.split('/').pop();
                if (finalRole !== 'admin' && adminPages.includes(currentPath)) {
                    window.location.href = 'reportes.html';
                }
            }
        } catch (err) {
            console.warn("Sesión no disponible:", err.message);
            const protectedPages = ['panel_principal', 'moderadores', 'locutores', 'dh', 'dg', 'reportes', 'usuarios', 'certificado'];
            if (protectedPages.some(page => window.location.pathname.includes(page))) {
                localStorage.clear();
                window.location.href = 'index.html';
            }
        }
    };

    if (supabaseClient) {
        checkSession();
    }

    const loginForm = document.querySelector('#login-form form');
    if (loginForm) {
        // Inicializar UI limpia en login
        updateUIPermissions('user');

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

            if (error) {
                if (error.message === 'Failed to fetch') {
                    alert('Error de conexión: No se pudo contactar con el servidor. ' +
                          'Verifica que no tengas bloqueadores de anuncios activados o que no estés ' +
                          'abriendo el archivo directamente (usa Live Server).');
                } else {
                    alert('Error al iniciar sesión: ' + error.message);
                }
            } else {
                const user = data.user;
                let userRole = 'user'; // Rol por defecto

                // Obtener el perfil del usuario de la tabla 'profiles'
                const { data: profile, error: profileError } = await supabaseClient
                    .from('profiles')
                    .select('nombre, role')
                    .eq('id', user.id)
                    .maybeSingle(); // Usar maybeSingle() es más seguro aquí

                if (profileError) {
                    console.error("Error al obtener el perfil:", profileError.message);
                    // Si hay un error o el perfil no existe, se mantiene el rol por defecto 'user'
                }
                
                if (profile) {
                    userRole = profile.role;
                } else {
                    console.warn("Advertencia: No se encontró un perfil asociado en la tabla 'profiles'. Verifica el Trigger de la base de datos.");
                }

                // Rectificación: Asegurar que ministrylion@gmail.com siempre sea admin
                if (user.email.toLowerCase() === 'ministrylion@gmail.com') {
                    userRole = 'admin';
                }

                localStorage.setItem('currentUser', user.id);
                localStorage.setItem('currentUserName', profile?.nombre || 'Usuario');
                localStorage.setItem('userRole', userRole); // Usar el rol determinado
                
                // Redirección inicial según el rol: admins al panel, otros a reportes
                if (userRole === 'admin') {
                    window.location.href = 'panel_principal.html';
                } else {
                    window.location.href = 'reportes.html';
                }
            }
        });
    }

    // Lógica para el formulario de registro
    const registerForm = document.querySelector('#register-form form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('reg-name').value;
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;

            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: { data: { nombre: name } }
            });

            if (error) {
                alert('Error al registrarse: ' + error.message);
            } else {
                alert('Cuenta creada exitosamente. Verifique su correo o inicie sesión.');
                toggleForm();
            }
        });
    }

    // Lógica para cerrar sesión
    document.querySelectorAll('.logout-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            localStorage.removeItem('currentUser');
            localStorage.removeItem('currentUserName');
            localStorage.removeItem('userRole');
            supabaseClient.auth.signOut();
        });
    });

    // --- LÓGICA DE MODERADORES ---
    // Global variable to store the ID of the moderator being edited
    let editingModeratorId = null;

    const modForm = document.getElementById('mod-form');
    if (modForm) {
        const populateModSelects = async () => {
            const { data: dhs } = await supabaseClient.from('directores_horario').select('nombre');
            const select = document.getElementById('director-horario');
            if (select) {
                // Limpiar y resetear el selector con la opción por defecto
                select.innerHTML = '<option value="">Seleccione un director...</option>';
                dhs?.forEach(d => {
                    const opt = document.createElement('option');
                    opt.value = d.nombre;
                    opt.textContent = d.nombre;
                    select.appendChild(opt);
                });
            }
        };

        const tableBody = document.querySelector('#tabla-moderadores tbody');
        
        window.displayModerators = async () => {
            const filter = document.getElementById('filter-categoria').value;
            let query = supabaseClient.from('moderadores').select('*');
            if (filter !== 'all') query = query.eq('categoria', filter);
            
            const { data, error } = await query.order('categoria', { ascending: true });
            if (error) return console.error(error);

            // Ordenar por categoría y luego cronológicamente por hora de inicio
            data.sort((a, b) => {
                if (a.categoria !== b.categoria) return a.categoria.localeCompare(b.categoria);
                return parseTime(a.inicio).time24.localeCompare(parseTime(b.inicio).time24);
            });

            tableBody.innerHTML = '';
            data.forEach(mod => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${mod.categoria}</td>
                    <td>${mod.dias_horario.join(', ')}</td>
                    <td>${mod.inicio}</td>
                    <td>${mod.fin}</td>
                    <td>${mod.nombre}</td>
                    <td>${mod.pais}</td>
                    <td>${mod.fecha_ingreso || ''}</td>
                    <td>${mod.fecha_cumple || ''}</td>
                    <td>${mod.director_horario}</td>
                    <td>
                        <button class="btn-edit" onclick="editModerator(${mod.id})">Editar</button>
                        <button class="btn-delete" onclick="deleteRecord('moderadores', ${mod.id}, displayModerators)">Eliminar</button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        };

        // Function to populate the form for editing
        window.editModerator = async (id) => {
            const { data, error } = await supabaseClient.from('moderadores').select('*').eq('id', id).single();
            if (error) {
                console.error("Error fetching moderator for edit:", error.message);
                return;
            }

            editingModeratorId = id; // Store the ID of the record being edited

            // Asegurar que el select tenga los nombres de los directores antes de asignar el valor
            await populateModSelects();

            // Populate form fields
            document.getElementById('categoria').value = data.categoria;
            
            // Handle checkboxes for days
            document.querySelectorAll('input[name="mod-dia"]').forEach(cb => {
                cb.checked = data.dias_horario.includes(cb.value);
            });

            const { time24: inicioTime24, ampm: inicioAmpm } = parseTime(data.inicio);
            document.getElementById('hora-inicio').value = inicioTime24;
            document.getElementById('ampm-inicio').value = inicioAmpm;

            const { time24: finTime24, ampm: finAmpm } = parseTime(data.fin);
            document.getElementById('hora-fin').value = finTime24;
            document.getElementById('ampm-fin').value = finAmpm;

            document.getElementById('nombre-mod').value = data.nombre;
            document.getElementById('pais').value = data.pais;
            document.getElementById('fecha-ingreso').value = data.fecha_ingreso;
            document.getElementById('fecha-cumple').value = data.fecha_cumple;
            document.getElementById('director-horario').value = data.director_horario;

            // Change button text
            document.querySelector('#mod-form button[type="submit"]').textContent = 'Actualizar Moderador';
        };

        modForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const dias = Array.from(document.querySelectorAll('input[name="mod-dia"]:checked')).map(cb => cb.value);
            const formData = {
                categoria: document.getElementById('categoria').value,
                dias_horario: dias,
                inicio: formatTimeTo12h(document.getElementById('hora-inicio').value, document.getElementById('ampm-inicio').value),
                fin: formatTimeTo12h(document.getElementById('hora-fin').value, document.getElementById('ampm-fin').value),
                nombre: document.getElementById('nombre-mod').value,
                pais: document.getElementById('pais').value,
                fecha_ingreso: document.getElementById('fecha-ingreso').value,
                fecha_cumple: document.getElementById('fecha-cumple').value,
                director_horario: document.getElementById('director-horario').value
            };

            let error;
            if (editingModeratorId) {
                // Update existing record
                const { error: updateError } = await supabaseClient
                    .from('moderadores')
                    .update(formData)
                    .eq('id', editingModeratorId);
                error = updateError;
            } else {
                // Insert new record
                const { error: insertError } = await supabaseClient.from('moderadores').insert([formData]);
                error = insertError;
            }
            
            if (error) {
                alert(error.message);
            } else {
                modForm.reset();
                editingModeratorId = null; // Reset editing state
                document.querySelector('#mod-form button[type="submit"]').textContent = 'Registrar Moderador'; // Reset button text
                window.displayModerators();
            }
        });

        document.getElementById('filter-categoria').addEventListener('change', () => window.displayModerators());
        populateModSelects();
        window.displayModerators();
    }

    // Global variable to store the ID of the locutor being edited
    let editingLocutorId = null;

    // --- LÓGICA DE LOCUTORES ---
    const locForm = document.getElementById('loc-form');
    const locSubmitBtn = locForm ? locForm.querySelector('button[type="submit"]') : null;
    if (locForm) {
        const tableBody = document.querySelector('#tabla-locutores tbody');
        
        window.displayLocutores = async () => {
            const filter = document.getElementById('filter-categoria-loc').value;
            let query = supabaseClient.from('locutores').select('*');
            if (filter !== 'all') query = query.eq('categoria', filter);
            
            const { data, error } = await query;
            if (error) return console.error(error);

            // Ordenar por categoría y luego cronológicamente por hora de inicio
            data.sort((a, b) => {
                if (a.categoria !== b.categoria) return a.categoria.localeCompare(b.categoria);
                return parseTime(a.inicio).time24.localeCompare(parseTime(b.inicio).time24);
            });

            tableBody.innerHTML = '';
            data?.forEach(loc => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${loc.categoria}</td>
                    <td>${loc.dias_horario.join(', ')}</td>
                    <td>${loc.inicio}</td>
                    <td>${loc.fin}</td>
                    <td>${loc.nombre}</td>
                    <td>${loc.programa}</td>
                    <td>${loc.canto || ''}</td>
                    <td>${loc.slogan || ''}</td>
                    <td>${loc.pais}</td>
                    <td>${loc.fecha_ingreso}</td>
                    <td>${loc.fecha_cumple}</td>
                    <td>${loc.director}</td>
                    <td>
                        <button class="btn-edit" onclick="editLocutor(${loc.id})">Editar</button>
                        <button class="btn-delete" onclick="deleteRecord('locutores', ${loc.id}, displayLocutores)">Eliminar</button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
        };

        window.editLocutor = async (id) => {
            const { data, error } = await supabaseClient.from('locutores').select('*').eq('id', id).single();
            if (error) {
                console.error("Error fetching locutor for edit:", error.message);
                return;
            }

            editingLocutorId = id;

            document.getElementById('loc-categoria').value = data.categoria;
            document.querySelectorAll('input[name="loc-dia"]').forEach(cb => {
                cb.checked = data.dias_horario.includes(cb.value);
            });

            const { time24: inicioTime24, ampm: inicioAmpm } = parseTime(data.inicio);
            document.getElementById('loc-hora-inicio').value = inicioTime24;
            document.getElementById('loc-ampm-inicio').value = inicioAmpm;

            const { time24: finTime24, ampm: finAmpm } = parseTime(data.fin);
            document.getElementById('loc-hora-fin').value = finTime24;
            document.getElementById('loc-ampm-fin').value = finAmpm;

            document.getElementById('loc-nombre').value = data.nombre;
            document.getElementById('loc-programa').value = data.programa;
            document.getElementById('loc-canto').value = data.canto;
            document.getElementById('loc-slogan').value = data.slogan;
            document.getElementById('loc-pais').value = data.pais;
            document.getElementById('loc-fecha-ingreso').value = data.fecha_ingreso;
            document.getElementById('loc-fecha-cumple').value = data.fecha_cumple;
            document.getElementById('loc-director').value = data.director;

            if (locSubmitBtn) locSubmitBtn.textContent = 'Actualizar Locutor';
        };

        locForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const dias = Array.from(document.querySelectorAll('input[name="loc-dia"]:checked')).map(cb => cb.value);
            const formData = {
                categoria: document.getElementById('loc-categoria').value,
                dias_horario: dias,
                inicio: formatTimeTo12h(document.getElementById('loc-hora-inicio').value, document.getElementById('loc-ampm-inicio').value),
                fin: formatTimeTo12h(document.getElementById('loc-hora-fin').value, document.getElementById('loc-ampm-fin').value),
                nombre: document.getElementById('loc-nombre').value,
                programa: document.getElementById('loc-programa').value,
                canto: document.getElementById('loc-canto').value,
                slogan: document.getElementById('loc-slogan').value,
                pais: document.getElementById('loc-pais').value,
                fecha_ingreso: document.getElementById('loc-fecha-ingreso').value,
                fecha_cumple: document.getElementById('loc-fecha-cumple').value,
                director: document.getElementById('loc-director').value
            };

            let error;
            if (editingLocutorId) {
                const { error: updateError } = await supabaseClient
                    .from('locutores')
                    .update(formData)
                    .eq('id', editingLocutorId);
                error = updateError;
            } else {
                const { error: insertError } = await supabaseClient.from('locutores').insert([formData]);
                error = insertError;
            }

            if (error) {
                alert("Error al guardar: " + error.message);
            } else {
                locForm.reset();
                editingLocutorId = null;
                if (locSubmitBtn) locSubmitBtn.textContent = 'Registrar Locutor';
                window.displayLocutores();
            }
        });

        document.getElementById('filter-categoria-loc').addEventListener('change', () => window.displayLocutores());
        window.displayLocutores();
    }
    // Global variable to store the ID of the DH being edited
    let editingDhId = null;

    // --- LÓGICA DE DIRECTORES (DH) ---
    const dhForm = document.getElementById('dh-form');
    const dhSubmitBtn = dhForm ? dhForm.querySelector('button[type="submit"]') : null;
    if (dhForm) {
        const tableBody = document.querySelector('#tabla-dh tbody');
        window.displayDh = async () => {
            const filter = document.getElementById('filter-categoria-dh')?.value || 'all';
            let query = supabaseClient.from('directores_horario').select('*');
            if (filter !== 'all') query = query.eq('categoria', filter);

            const { data, error } = await query;
            if (error) return console.error("Error cargando DH:", error.message);
            
            // Ordenar cronológicamente por la hora de inicio
            if (data) data.sort((a, b) => parseTime(a.inicio).time24.localeCompare(parseTime(b.inicio).time24));

            tableBody.innerHTML = '';
            data?.forEach(dh => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${dh.categoria}</td>
                    <td>${dh.dias_horario.join(', ')}</td>
                    <td>${dh.inicio}</td>
                    <td>${dh.fin}</td>
                    <td>${dh.nombre}</td>
                    <td>${dh.pais}</td>
                    <td>${dh.fecha_ingreso}</td>
                    <td>${dh.fecha_cumple}</td>
                    <td>
                        <button class="btn-edit" onclick="editDh(${dh.id})">Editar</button>
                        <button class="btn-delete" onclick="deleteRecord('directores_horario', ${dh.id}, displayDh)">Eliminar</button>
                    </td>
                </tr>`;
                tableBody.appendChild(row);
            });
        };

        window.editDh = async (id) => {
            const { data, error } = await supabaseClient.from('directores_horario').select('*').eq('id', id).single();
            if (error) {
                console.error("Error fetching DH for edit:", error.message);
                return;
            }

            editingDhId = id;

            document.getElementById('dh-categoria').value = data.categoria;
            document.querySelectorAll('input[name="dh-dia"]').forEach(cb => {
                cb.checked = data.dias_horario.includes(cb.value);
            });

            const { time24: inicioTime24, ampm: inicioAmpm } = parseTime(data.inicio);
            document.getElementById('dh-hora-inicio').value = inicioTime24;
            document.getElementById('dh-ampm-inicio').value = inicioAmpm;

            const { time24: finTime24, ampm: finAmpm } = parseTime(data.fin);
            document.getElementById('dh-hora-fin').value = finTime24;
            document.getElementById('dh-ampm-fin').value = finAmpm;

            document.getElementById('dh-nombre').value = data.nombre;
            document.getElementById('dh-pais').value = data.pais;
            document.getElementById('dh-fecha-ingreso').value = data.fecha_ingreso;
            document.getElementById('dh-fecha-cumple').value = data.fecha_cumple;

            if (dhSubmitBtn) dhSubmitBtn.textContent = 'Actualizar Director';
        };
        dhForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const dias = Array.from(document.querySelectorAll('input[name="dh-dia"]:checked')).map(cb => cb.value);
            let error;
            const formData = {
                categoria: document.getElementById('dh-categoria').value,
                dias_horario: dias,
                inicio: formatTimeTo12h(document.getElementById('dh-hora-inicio').value, document.getElementById('dh-ampm-inicio').value),
                fin: formatTimeTo12h(document.getElementById('dh-hora-fin').value, document.getElementById('dh-ampm-fin').value),
                nombre: document.getElementById('dh-nombre').value,
                pais: document.getElementById('dh-pais').value,
                fecha_ingreso: document.getElementById('dh-fecha-ingreso').value,
                fecha_cumple: document.getElementById('dh-fecha-cumple').value
            };

            if (editingDhId) {
                const { error: updateError } = await supabaseClient
                    .from('directores_horario')
                    .update(formData)
                    .eq('id', editingDhId);
                error = updateError;
            } else {
                const { error: insertError } = await supabaseClient.from('directores_horario').insert([formData]);
                error = insertError;
            }

            if (error) {
                alert("Error al guardar: " + error.message);
            } else {
                dhForm.reset();
                editingDhId = null;
                if (dhSubmitBtn) dhSubmitBtn.textContent = 'Registrar Director';
                window.displayDh();
            }
        });

        document.getElementById('filter-categoria-dh')?.addEventListener('change', () => window.displayDh());
        window.displayDh();
    }
    // Global variable to store the ID of the DG member being edited
    let editingDgId = null;

    // --- LÓGICA DE DIRECTIVA GENERAL (DG) ---
    const dgForm = document.getElementById('dg-form');
    const dgSubmitBtn = dgForm ? dgForm.querySelector('button[type="submit"]') : null;
    if (dgForm) {
        const populateSelect = async () => {
            const { data: mods } = await supabaseClient.from('moderadores').select('nombre');
            const { data: locs } = await supabaseClient.from('locutores').select('nombre');
            const { data: dhs } = await supabaseClient.from('directores_horario').select('nombre');
            const nombres = [...new Set([...(mods||[]), ...(locs||[]), ...(dhs||[])].map(i => i.nombre))];
            const select = document.getElementById('dg-nombre');
            if (select) {
                // Clear existing options except the first one (placeholder)
                while (select.options.length > 1) {
                    select.remove(1);
                }
                select.innerHTML = '<option value="">Seleccione un miembro...</option>';
                nombres.forEach(n => select.innerHTML += `<option value="${n}">${n}</option>`);
            }
        };
        window.displayDg = async () => {
            const { data, error } = await supabaseClient.from('directiva_general').select('*');
            if (error) return console.error("Error cargando DG:", error.message);
            const tbody = document.querySelector('#tabla-dg tbody');
            tbody.innerHTML = '';
            data?.forEach(dg => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${dg.nombre}</td>
                    <td>${dg.cargo}</td>
                    <td>${dg.pais}</td>
                    <td>${dg.fecha_ingreso}</td>
                    <td>${dg.fecha_cumple}</td>
                    <td>
                        <button class="btn-edit" onclick="editDg(${dg.id})">Editar</button>
                        <button class="btn-delete" onclick="deleteRecord('directiva_general', ${dg.id}, displayDg)">Eliminar</button>
                    </td>
                </tr>`;
                tbody.appendChild(row);
            });
        };

        window.editDg = async (id) => {
            const { data, error } = await supabaseClient.from('directiva_general').select('*').eq('id', id).single();
            if (error) {
                console.error("Error fetching DG member for edit:", error.message);
                return;
            }

            editingDgId = id;

            // Ensure the select is populated before trying to set its value
            await populateSelect(); 
            document.getElementById('dg-nombre').value = data.nombre;
            document.getElementById('dg-cargo').value = data.cargo;
            document.getElementById('dg-pais').value = data.pais;
            document.getElementById('dg-fecha-ingreso').value = data.fecha_ingreso;
            document.getElementById('dg-fecha-cumple').value = data.fecha_cumple;

            if (dgSubmitBtn) dgSubmitBtn.textContent = 'Actualizar en DG';
        };

        dgForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            let error;
            const formData = {
                nombre: document.getElementById('dg-nombre').value,
                cargo: document.getElementById('dg-cargo').value,
                pais: document.getElementById('dg-pais').value,
                fecha_ingreso: document.getElementById('dg-fecha-ingreso').value,
                fecha_cumple: document.getElementById('dg-fecha-cumple').value
            };

            if (editingDgId) {
                const { error: updateError } = await supabaseClient.from('directiva_general').update(formData).eq('id', editingDgId);
                error = updateError;
            } else {
                const { error: insertError } = await supabaseClient.from('directiva_general').insert([formData]);
                error = insertError;
            }

            if (error) alert("Error al guardar: " + error.message); else { dgForm.reset(); editingDgId = null; if (dgSubmitBtn) dgSubmitBtn.textContent = 'Registrar en DG'; window.displayDg(); }
        });
        populateSelect(); window.displayDg();
    }
    // Global variable to store the ID of the report being edited
    let editingReportId = null;
    // --- LÓGICA DE REPORTES ---
    const repForm = document.getElementById('rep-form');
    if (repForm) {
        const populateRepSelects = async () => {
            const { data: locs } = await supabaseClient.from('locutores').select('nombre');
            const { data: mods } = await supabaseClient.from('moderadores').select('nombre');
            const { data: dhs } = await supabaseClient.from('directores_horario').select('nombre');
            
            const fill = (id, list) => {
                const el = document.getElementById(id);
                if (el) {
                    while (el.options.length > 1) { el.remove(1); } // Clear existing options except the first one (placeholder)
                    list.forEach(i => el.innerHTML += `<option value="${i.nombre}">${i.nombre}</option>`);
                }
            };
            fill('rep-director', dhs || []);
            fill('rep-loc1', locs || []); fill('rep-loc2', locs || []);
            fill('rep-whatsapp', mods || []); fill('rep-chat', mods || []); fill('rep-redes', mods || []);
        };

        window.displayReports = async () => {
            const role = localStorage.getItem('userRole');
            let query = supabaseClient.from('reportes').select('*');
            if (role !== 'admin') query = query.eq('user_id', localStorage.getItem('currentUser'));
            
            const { data, error } = await query.order('fecha', { ascending: false });
            if (error) return console.error("Error cargando reportes:", error.message);
            const tbody = document.querySelector('#tabla-reportes tbody');
            tbody.innerHTML = '';
            data?.forEach(r => {
                tbody.innerHTML += `<tr>
                    <td>${r.fecha}</td><td>${r.director}</td><td>${r.estuvo} ${r.cubrio ? '('+r.cubrio+')' : ''}</td>
                    <td>1h: ${r.loc1}<br>2h: ${r.loc2}</td>
                    <td>C: ${r.chat}<br>R: ${r.redes}</td>
                    <td>
                        <button class="btn-edit" onclick="editReport(${r.id})">Editar</button>
                        <button class="btn-delete" onclick="deleteRecord('reportes', ${r.id}, displayReports)">Eliminar</button>
                    </td>
                </tr>`;
            });
        };

        window.editReport = async (id) => {
            const { data, error } = await supabaseClient.from('reportes').select('*').eq('id', id).single();
            if (error) {
                console.error("Error fetching report for edit:", error.message);
                return;
            }

            editingReportId = id;

            // Populate selects first to ensure options are available
            await populateRepSelects();

            document.getElementById('rep-categoria').value = data.categoria;
            document.getElementById('rep-mes').value = data.mes;
            document.getElementById('rep-fecha').value = data.fecha;
            document.getElementById('rep-director').value = data.director;
            document.getElementById('rep-estuvo').value = data.estuvo;
            
            // Handle 'cubrio' field visibility
            const groupCubrio = document.getElementById('group-cubrio');
            if (data.estuvo === 'No') {
                groupCubrio.style.display = 'block';
                document.getElementById('rep-cubrio').value = data.cubrio || '';
            } else {
                groupCubrio.style.display = 'none';
                document.getElementById('rep-cubrio').value = '';
            }

            document.getElementById('rep-loc1').value = data.loc1;
            document.getElementById('rep-loc2').value = data.loc2;
            document.getElementById('rep-whatsapp').value = data.whatsapp;
            document.getElementById('rep-chat').value = data.chat;
            document.getElementById('rep-redes').value = data.redes;

            document.querySelector('#rep-form button[type="submit"]').textContent = 'Actualizar Reporte';
        };

        repForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const { data: { user } } = await supabaseClient.auth.getUser();
            const formData = {
                user_id: user.id,
                user_email: user.email,
                categoria: document.getElementById('rep-categoria').value,
                mes: parseInt(document.getElementById('rep-mes').value),
                fecha: document.getElementById('rep-fecha').value,
                director: document.getElementById('rep-director').value,
                estuvo: document.getElementById('rep-estuvo').value,
                cubrio: document.getElementById('rep-cubrio').value,
                loc1: document.getElementById('rep-loc1').value,
                loc2: document.getElementById('rep-loc2').value,
                whatsapp: document.getElementById('rep-whatsapp').value,
                chat: document.getElementById('rep-chat').value,
                redes: document.getElementById('rep-redes').value
            };

            let error;
            if (editingReportId) {
                const { error: updateError } = await supabaseClient
                    .from('reportes')
                    .update(formData)
                    .eq('id', editingReportId);
                error = updateError;
            } else {
                const { error: insertError } = await supabaseClient.from('reportes').insert([formData]);
                error = insertError;
            }

            if (error) {
                alert(error.message);
            } else {
                repForm.reset();
                editingReportId = null;
                document.querySelector('#rep-form button[type="submit"]').textContent = 'Enviar Reporte';
                window.displayReports();
            }
        });
        
        document.getElementById('rep-estuvo').addEventListener('change', (e) => {
            document.getElementById('group-cubrio').style.display = e.target.value === 'No' ? 'block' : 'none';
        });

        // Cálculo de reportes esperados
        const updateCalculo = () => {
            const mes = document.getElementById('rep-mes').value;
            const dias = Array.from(document.querySelectorAll('input[name="rep-dia"]:checked')).map(cb => cb.value);
            if (!mes || dias.length === 0) return;
            
            const year = new Date().getFullYear();
            const daysInMonth = new Date(year, parseInt(mes) + 1, 0).getDate();
            const dayMap = { 'Domingo': 0, 'Lunes': 1, 'Martes': 2, 'Miércoles': 3, 'Jueves': 4, 'Viernes': 5, 'Sábado': 6 };
            const targetDays = dias.map(d => dayMap[d]);
            
            let count = 0;
            for (let d = 1; d <= daysInMonth; d++) {
                if (targetDays.includes(new Date(year, parseInt(mes), d).getDay())) count++;
            }
            document.getElementById('reportes-esperados').textContent = `Se esperan ${count} reportes este mes.`;
        };

        document.getElementById('rep-mes').addEventListener('change', updateCalculo);
        document.querySelectorAll('input[name="rep-dia"]').forEach(cb => cb.addEventListener('change', updateCalculo));

        populateRepSelects(); window.displayReports();
    }

    // --- LÓGICA DE USUARIOS (ADMIN) ---
    const userTableBody = document.querySelector('#tabla-usuarios tbody');
    if (userTableBody) {
        if (initialRole !== 'admin') {
            window.location.href = 'panel_principal.html';
            return;
        }

        window.displayUsers = async () => {
            const { data, error } = await supabaseClient.from('profiles').select('*').order('nombre', { ascending: true });
            if (error) return console.error(error);

            userTableBody.innerHTML = '';
            data.forEach(user => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${user.nombre}</td>
                    <td>${user.email}</td>
                    <td>
                        <select onchange="updateUserRole('${user.id}', this.value)">
                            <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                        </select>
                    </td>
                    <td>${new Date(user.created_at).toLocaleDateString()}</td>
                `;
                userTableBody.appendChild(row);
            });
        };
        window.displayUsers();
    }

    // --- LÓGICA DE ESTADÍSTICAS ---
    const statsPaises = document.getElementById('stats-paises');
    if (statsPaises) {
        const displayStatistics = async () => {
            const countries = {};
            const monthsBirth = Array.from({ length: 12 }, () => []);
            const monthsAnniv = Array.from({ length: 12 }, () => []);
            const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

            const processData = (data, type) => {
                data.forEach(row => {
                    if (row.pais) {
                        if (!countries[row.pais]) countries[row.pais] = { total: 0, moderadores: 0, locutores: 0, dh: 0, personas: [] };
                        countries[row.pais][type]++;
                        countries[row.pais].total++;
                        countries[row.pais].personas.push({ nombre: row.nombre, cargo: type });
                    }
                    if (row.fecha_cumple) {
                        const dateObj = new Date(row.fecha_cumple + 'T00:00:00');
                        const m = dateObj.getMonth();
                        monthsBirth[m].push({ nombre: row.nombre, dia: dateObj.getDate() });
                    }
                    if (row.fecha_ingreso) {
                        const dateObj = new Date(row.fecha_ingreso + 'T00:00:00');
                        const m = dateObj.getMonth();
                        monthsAnniv[m].push({ nombre: row.nombre, dia: dateObj.getDate() });
                    }
                });
            };

            const { data: mods } = await supabaseClient.from('moderadores').select('nombre, pais, fecha_cumple, fecha_ingreso');
            if (mods) processData(mods, 'moderadores');

            const { data: locs } = await supabaseClient.from('locutores').select('nombre, pais, fecha_cumple, fecha_ingreso');
            if (locs) processData(locs, 'locutores');

            const { data: dhs } = await supabaseClient.from('directores_horario').select('nombre, pais, fecha_cumple, fecha_ingreso');
            if (dhs) processData(dhs, 'dh');

            // Renderizar Países
            let paisesHtml = '';
            Object.entries(countries).sort((a,b) => b[1].total - a[1].total).forEach(([name, s]) => {
                // Preparamos la lista de nombres para mostrarla en el alert
                const listaNombres = s.personas
                    .map(p => `- ${p.nombre} (${p.cargo})`)
                    .join('\\n')
                    .replace(/'/g, "\\'"); // Escapamos comillas simples por seguridad
                paisesHtml += `
                    <div class="stat-item-complex" style="cursor:pointer;" onclick="alert('Integrantes en ${name.replace(/'/g, "\\'")}:\\n\\n${listaNombres}')">
                        <div class="stat-main"><span>${name}</span><strong>${s.total}</strong></div>
                        <div class="stat-sub">Mods: ${s.moderadores} | Locs: ${s.locutores} | DH: ${s.dh}</div>
                    </div>`;
            });
            statsPaises.innerHTML = paisesHtml || 'No hay datos.';

            // Renderizar Cumpleaños
            let cumplesHtml = '';
            monthsBirth.forEach((list, i) => {
                if (list.length > 0) {
                    const listaNombres = list
                        .sort((a, b) => a.dia - b.dia)
                        .map(p => `- Día ${p.dia}: ${p.nombre}`)
                        .join('\\n')
                        .replace(/'/g, "\\'");
                    cumplesHtml += `<div class="stat-item" style="cursor:pointer;" onclick="alert('Cumpleaños en ${monthNames[i]}:\\n\\n${listaNombres}')"><span>${monthNames[i]}</span><strong>${list.length}</strong></div>`;
                }
            });
            document.getElementById('stats-cumples').innerHTML = cumplesHtml || 'No hay datos.';

            // Renderizar Aniversarios
            let annivHtml = '';
            monthsAnniv.forEach((list, i) => {
                if (list.length > 0) {
                    const listaNombres = list
                        .sort((a, b) => a.dia - b.dia)
                        .map(p => `- Día ${p.dia}: ${p.nombre}`)
                        .join('\\n')
                        .replace(/'/g, "\\'");
                    annivHtml += `<div class="stat-item" style="cursor:pointer;" onclick="alert('Aniversarios en ${monthNames[i]}:\\n\\n${listaNombres}')"><span>${monthNames[i]}</span><strong>${list.length}</strong></div>`;
                }
            });
            document.getElementById('stats-aniversarios').innerHTML = annivHtml || 'No hay datos.';
        };
        displayStatistics();
    }

    // --- LÓGICA DE DESCARGA PDF UNIVERSAL ---
    // Buscamos ambos posibles IDs de botón (el de DH y el de Moderadores/Locutores)
    const downloadBtn = document.getElementById('btn-download') || document.getElementById('btn-download-dh');
    
    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            const jsPDF = window.jspdf ? window.jspdf.jsPDF : window.jsPDF;
            if (!jsPDF) {
                alert("Error: La librería de PDF no se ha cargado correctamente.");
                return;
            }

            const doc = new jsPDF('landscape');
            if (typeof doc.autoTable !== 'function') {
                alert("Error: La extensión autoTable no está cargada. Revise los scripts en el archivo HTML.");
                return;
            }

            let tableId = '';
            let filterId = '';
            let fileName = '';
            let titleText = '';

            // Detectar en qué página estamos para saber qué tabla usar
            if (document.getElementById('tabla-dh')) {
                tableId = '#tabla-dh';
                filterId = 'filter-categoria-dh';
                fileName = 'Directores';
                titleText = 'Directores de Horario';
            } else if (document.getElementById('tabla-moderadores')) {
                tableId = '#tabla-moderadores';
                filterId = 'filter-categoria';
                fileName = 'Moderadores';
                titleText = 'Moderadores';
            } else if (document.getElementById('tabla-locutores')) {
                tableId = '#tabla-locutores';
                filterId = 'filter-categoria-loc';
                fileName = 'Locutores';
                titleText = 'Locutores';
            }

            const table = document.querySelector(tableId);
            if (!table || table.rows.length <= 1) {
                alert("No hay datos en la tabla para descargar.");
                return;
            }

            const filterVal = document.getElementById(filterId)?.value || 'all';
            const finalTitle = filterVal === 'all' ? `Reporte General: ${titleText}` : `Reporte ${titleText}: ${filterVal}`;

            // Extraer datos excluyendo la última columna (Acciones)
            const headers = Array.from(table.querySelectorAll('thead th')).slice(0, -1).map(th => th.innerText);
            const rows = Array.from(table.querySelectorAll('tbody tr')).map(tr => 
                Array.from(tr.querySelectorAll('td')).slice(0, -1).map(td => td.innerText)
            );

            doc.setFontSize(16);
            doc.text(finalTitle, 14, 15);
            doc.autoTable({
                head: [headers],
                body: rows,
                startY: 25,
                headStyles: { fillColor: [26, 37, 47] }
            });

            doc.save(`${fileName}_${filterVal.replace(/\s+/g, '_')}.pdf`);
        });
    }

    // --- LÓGICA DE CERTIFICADOS ---
    const certForm = document.getElementById('cert-form');
    if (certForm) {
        const canvas = document.getElementById('cert-canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.crossOrigin = "anonymous"; // Evita el error de "Tainted Canvas"
        let firmaImg = null;
        let firmaDgImg = null;
        // El src se asigna después del onload (ver abajo)

        // Función para cambiar de pestañas
        window.openTab = (evt, tabName) => {
            const contents = document.getElementsByClassName("tab-content");
            for (let i = 0; i < contents.length; i++) contents[i].classList.remove("active");
            const links = document.getElementsByClassName("tab-link");
            for (let i = 0; i < links.length; i++) links[i].classList.remove("active");
            document.getElementById(tabName).classList.add("active");
            evt.currentTarget.classList.add("active");
        };
        
        // Ocultar pestaña de configuración si no es admin
        const tabConfig = document.querySelector('.tab-link[onclick*="TabConfig"]');
        if (tabConfig && localStorage.getItem('userRole') !== 'admin') {
            tabConfig.style.display = 'none';
        }

        // Cargar configuración desde Supabase
        const loadCertConfigFromDB = async () => {
            const { data, error } = await supabaseClient
                .from('cert_configs')
                .select('*')
                .eq('config_name', 'default')
                .maybeSingle();

            if (error) {
                console.error("Error al cargar configuración de certificados:", error.message);
                return;
            }

            if (data) {
                document.getElementById('cert-x').value = data.cert_x;
                document.getElementById('cert-y').value = data.cert_y;
                document.getElementById('cert-dir-x').value = data.cert_dir_x;
                document.getElementById('cert-dir-y').value = data.cert_dir_y;
                document.getElementById('cert-firma-x').value = data.cert_firma_x;
                document.getElementById('cert-firma-y').value = data.cert_firma_y;
                document.getElementById('cert-firma-w').value = data.cert_firma_w;
                document.getElementById('cert-firma-dg-x').value = data.cert_firma_dg_x;
                document.getElementById('cert-firma-dg-y').value = data.cert_firma_dg_y;
                document.getElementById('cert-firma-dg-w').value = data.cert_firma_dg_w;
                document.getElementById('cert-director').value = data.director_nombre || "";

                // Cargar y restaurar las imágenes de las firmas si existen en la BD
                if (data.firma_data) {
                    firmaImg = new Image();
                    firmaImg.crossOrigin = "anonymous";
                    firmaImg.onload = drawCertPreview;
                    firmaImg.src = data.firma_data;
                }
                if (data.firma_dg_data) {
                    firmaDgImg = new Image();
                    firmaDgImg.crossOrigin = "anonymous";
                    firmaDgImg.onload = drawCertPreview;
                    firmaDgImg.src = data.firma_dg_data;
                }

                drawCertPreview();
            }

            // Ocultar botón de guardar configuración si el usuario no es admin
            // Esto previene intentos de guardado que violen las políticas RLS
            const btnSavePos = document.getElementById('btn-save-pos');
            if (btnSavePos && localStorage.getItem('userRole') !== 'admin') {
                btnSavePos.style.display = 'none';
            }
        };

        const drawCertPreview = () => {
            const nombre = document.getElementById('cert-nombre').value || "Nombre de Ejemplo";
            const director = document.getElementById('cert-director').value || "";

            const nx = document.getElementById('cert-x').value;
            const ny = document.getElementById('cert-y').value;
            const dx = document.getElementById('cert-dir-x').value;
            const dy = document.getElementById('cert-dir-y').value;
            const fx = document.getElementById('cert-firma-x').value;
            const fy = document.getElementById('cert-firma-y').value;
            const fw = document.getElementById('cert-firma-w').value;
            const dgfx = document.getElementById('cert-firma-dg-x').value;
            const dgfy = document.getElementById('cert-firma-dg-y').value;
            const dgfw = document.getElementById('cert-firma-dg-w').value;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            
            // Dibujar Nombre del Reconocido
            ctx.font = "italic bold 85px 'Times New Roman', serif";
            ctx.fillStyle = "#0c3150";
            ctx.textAlign = "center";
            ctx.fillText(nombre, canvas.width * (nx / 100), canvas.height * (ny / 100));

            // Dibujar Nombre del Director DH
            if (director) {
                ctx.font = "bold 25px Arial, sans-serif";
                ctx.fillStyle = "#333";
                ctx.fillText(director, canvas.width * (dx / 100), canvas.height * (dy / 100));
            }

            // Dibujar Firma si existe
            if (firmaImg) {
                const aspect = firmaImg.height / firmaImg.width;
                const drawW = canvas.width * (fw / 100);
                const drawH = drawW * aspect;
                ctx.drawImage(firmaImg, canvas.width * (fx / 100) - (drawW / 2), canvas.height * (fy / 100) - (drawH / 2), drawW, drawH);
            }
            
            // Dibujar Firma DG si existe
            if (firmaDgImg) {
                const aspect = firmaDgImg.height / firmaDgImg.width;
                const drawW = canvas.width * (dgfw / 100);
                const drawH = drawW * aspect;
                ctx.drawImage(firmaDgImg, canvas.width * (dgfx / 100) - (drawW / 2), canvas.height * (dgfy / 100) - (drawH / 2), drawW, drawH);
            }
            
            // Mostrar el botón de descarga si el canvas tiene contenido
            const btnDownload = document.getElementById('btn-save-cert') || document.getElementById('btn-download-cert');
            if (btnDownload) btnDownload.style.display = 'inline-block';
        };

        img.onload = async () => {
            canvas.width = img.width;
            canvas.height = img.height;
            await loadCertConfigFromDB();
            drawCertPreview();
        };

        img.src = 'certificado.png'; // Se asigna después de definir onload para asegurar captura

        // Manejar subida de firma
        document.getElementById('cert-firma-file')?.addEventListener('change', (e) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                firmaImg = new Image();
                firmaImg.onload = drawCertPreview;
                firmaImg.src = event.target.result;
            };
            if (e.target.files[0]) reader.readAsDataURL(e.target.files[0]);
        });

        // Manejar subida de firma DG
        document.getElementById('cert-firma-dg-file')?.addEventListener('change', (e) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                firmaDgImg = new Image();
                firmaDgImg.onload = drawCertPreview;
                firmaDgImg.src = event.target.result;
            };
            if (e.target.files[0]) reader.readAsDataURL(e.target.files[0]);
        });

        certForm.addEventListener('submit', (e) => { e.preventDefault(); drawCertPreview(); });

        // Guardar configuración de posición en la Base de Datos
        document.getElementById('btn-save-pos')?.addEventListener('click', () => {
            saveCertConfigToDB();
        });

        const saveCertConfigToDB = async () => {
            const config = {
                config_name: 'default',
                cert_x: parseInt(document.getElementById('cert-x').value),
                cert_y: parseInt(document.getElementById('cert-y').value),
                cert_dir_x: parseInt(document.getElementById('cert-dir-x').value),
                cert_dir_y: parseInt(document.getElementById('cert-dir-y').value),
                cert_firma_x: parseInt(document.getElementById('cert-firma-x').value),
                cert_firma_y: parseInt(document.getElementById('cert-firma-y').value),
                cert_firma_w: parseInt(document.getElementById('cert-firma-w').value),
                cert_firma_dg_x: parseInt(document.getElementById('cert-firma-dg-x').value),
                cert_firma_dg_y: parseInt(document.getElementById('cert-firma-dg-y').value),
                cert_firma_dg_w: parseInt(document.getElementById('cert-firma-dg-w').value),
                firma_data: firmaImg ? firmaImg.src : null,
                firma_dg_data: firmaDgImg ? firmaDgImg.src : null,
                director_nombre: document.getElementById('cert-director').value
            };

            const { error } = await supabaseClient.from('cert_configs').upsert(config, { onConflict: 'config_name' }); // Usa onConflict para upsert
            
            if (error) {
                if (error.message.includes('violates row-level security policy')) {
                    alert("Error de seguridad: No tiene permisos de administrador en la base de datos para guardar estos cambios.");
                } else {
                    alert("Error al guardar en BD: " + error.message);
                }
            } else {
                alert('Configuración guardada en la base de datos.');
            }
        };

        // Eventos para actualización en tiempo real
        const certInputs = [
            'cert-x', 'cert-y', 'cert-dir-x', 'cert-dir-y', 
            'cert-firma-x', 'cert-firma-y', 'cert-firma-w', 
            'cert-firma-dg-x', 'cert-firma-dg-y', 'cert-firma-dg-w',
            'cert-nombre', 'cert-director'
        ];
        certInputs.forEach(id => document.getElementById(id)?.addEventListener('input', drawCertPreview));

        window.downloadCert = () => {
            try {
                const nombre = document.getElementById('cert-nombre').value || 'Certificado';
                const link = document.createElement('a');
                link.download = `Certificado_${nombre}.png`;
                
                // Intentar obtener los datos de la imagen
                const dataUrl = canvas.toDataURL('image/png');
                
                if (dataUrl === "data:,") {
                    throw new Error("El canvas está vacío o no se ha inicializado correctamente.");
                }
                
                link.href = dataUrl;
                link.click();
            } catch (err) {
                console.error("Error al descargar el certificado:", err);
                alert("No se pudo generar el archivo de imagen. Esto suele suceder si estás abriendo el archivo HTML directamente desde tu carpeta en lugar de usar un servidor local (como Live Server).");
            }
        };
    }

    // --- LÓGICA DE RECONOCIMIENTOS ---
    const recognitionHistoryDiv = document.getElementById('recognition-history');
    if (recognitionHistoryDiv) {
        const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

        // Función para calcular cumplimiento del mes pasado
        const checkAndRecordCompliance = async (userId, userEmail) => {
            const now = new Date();
            let targetMonth = now.getMonth(); // Mes actual (0-11)
            let targetYear = now.getFullYear();
            
            // Si estamos a principio de mes, evaluamos el mes anterior
            if (targetMonth === 0) { targetMonth = 11; targetYear--; } else { targetMonth--; }

            // Verificar si ya existe el registro para evitar duplicados
            const { data: existing } = await supabaseClient
                .from('user_recognitions')
                .select('id')
                .eq('user_id', userId)
                .eq('month', targetMonth + 1)
                .eq('year', targetYear)
                .maybeSingle();

            if (existing) return;

            // 1. Obtener los días que el usuario debe reportar
            // Buscamos en todas las tablas de personal donde esté vinculado su user_id
            const tables = ['moderadores', 'locutores', 'directores_horario'];
            let userSchedule = [];
            for (const table of tables) {
                const { data } = await supabaseClient.from(table).select('dias_horario').eq('user_id', userId);
                if (data) data.forEach(d => userSchedule = [...userSchedule, ...d.dias_horario]);
            }
            
            if (userSchedule.length === 0) return; // No tiene horario asignado

            // 2. Calcular cuántos reportes se esperaban
            const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
            const dayMap = { 'Domingo': 0, 'Lunes': 1, 'Martes': 2, 'Miércoles': 3, 'Jueves': 4, 'Viernes': 5, 'Sábado': 6 };
            const targetDayIndices = [...new Set(userSchedule)].map(d => dayMap[d]);
            let expectedCount = 0;
            for (let d = 1; d <= daysInMonth; d++) {
                if (targetDayIndices.includes(new Date(targetYear, targetMonth, d).getDay())) expectedCount++;
            }

            // 3. Obtener reportes reales del usuario en ese mes
            const { data: reports } = await supabaseClient
                .from('reportes')
                .select('fecha, created_at')
                .eq('user_id', userId)
                .eq('mes', targetMonth);

            if (!reports || reports.length === 0) return;

            // 4. Validar 100% y retraso <= 2 días
            const has100Percent = reports.length >= expectedCount;
            const noDelays = reports.every(r => {
                const reportDate = new Date(r.fecha + 'T00:00:00');
                const submitDate = new Date(r.created_at);
                const diffTime = submitDate - reportDate;
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                return diffDays <= 2;
            });

            if (has100Percent && noDelays) {
                await supabaseClient.from('user_recognitions').insert([{
                    user_id: userId,
                    user_email: userEmail,
                    month: targetMonth + 1,
                    year: targetYear,
                    is_compliant: true
                }]);
            }
        };

        const displayRecognitions = async () => {
            const userRole = localStorage.getItem('userRole');
            const currentUserId = localStorage.getItem('currentUser');
            
            try {
                const { data: authData, error: authError } = await supabaseClient.auth.getUser();
                if (authError) throw authError;

                const user = authData?.user;

                if (user && userRole !== 'admin') {
                    // Evitamos que un fallo en la verificación bloquee la visualización del historial
                    await checkAndRecordCompliance(user.id, user.email).catch(err => console.error("Error verificando cumplimiento:", err));
                }
            } catch (e) {
                console.error("Error de autenticación:", e.message);
            }
            
            let query = supabaseClient.from('user_recognitions').select('*');

            if (userRole !== 'admin' && currentUserId) {
                query = query.eq('user_id', currentUserId);
            }

            const { data, error } = await query.order('year', { ascending: false }).order('month', { ascending: false });

            if (error) {
                console.error("Error de base de datos en reconocimientos:", error);
                recognitionHistoryDiv.innerHTML = `<p style="color:red;">Error al cargar: ${error.message}. Verifique si la tabla 'user_recognitions' existe.</p>`;
                return;
            }

            if (data && data.length > 0) {
                recognitionHistoryDiv.innerHTML = '';
                data.forEach(rec => {
                    const item = document.createElement('div');
                    item.classList.add('recognition-item');
                    const statusClass = rec.is_compliant ? 'status' : 'status failed';
                    const statusText = rec.is_compliant ? 'Cumplido' : 'No Cumplido';
                    const userName = userRole === 'admin' ? ` (${rec.user_email})` : '';

                    item.innerHTML = `
                        <span>${monthNames[rec.month - 1]} ${rec.year}${userName}</span>
                        <span class="${statusClass}">${statusText}</span>
                        ${rec.is_compliant ? `<button onclick="generateRecognitionCertificatePDF(${rec.id})">Descargar Certificado PDF</button>` : ''}
                    `;
                    recognitionHistoryDiv.appendChild(item);
                });
            } else {
                recognitionHistoryDiv.innerHTML = '<p>No tienes reconocimientos registrados aún.</p>';
            }
        };

        window.generateRecognitionCertificatePDF = async (recognitionId) => {
            // 1. Obtener datos del reconocimiento y perfil
            const { data: rec } = await supabaseClient.from('user_recognitions').select('*').eq('id', recognitionId).single();
            const { data: profile } = await supabaseClient.from('profiles').select('nombre').eq('id', rec.user_id).single();
            
            // 2. Obtener la configuración visual del menú Certificados
            const { data: config } = await supabaseClient.from('cert_configs').select('*').eq('config_name', 'default').maybeSingle();

            if (!config) {
                alert("Debe configurar las posiciones en el menú 'Certificado' primero.");
                return;
            }

            const canvas = document.getElementById('recognition-canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            img.crossOrigin = "anonymous";

            img.onload = async () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                // Dibujar Nombre del Destinatario (usando config de DB)
                ctx.font = "italic bold 85px 'Times New Roman', serif";
                ctx.fillStyle = "#0c3150";
                ctx.textAlign = "center";
                ctx.fillText(profile.nombre, canvas.width * (config.cert_x / 100), canvas.height * (config.cert_y / 100));

                // Texto descriptivo del reconocimiento
                const month = monthNames[rec.month - 1];
                ctx.font = "bold 25px Arial";
                ctx.fillStyle = "#333";
                ctx.fillText(`Cumplimiento 100% - ${month} ${rec.year}`, canvas.width / 2, (canvas.height * (config.cert_y / 100)) + 80);

                // Dibujar Director si existe
                if (config.director_nombre) {
                    ctx.font = "bold 25px Arial";
                    ctx.fillText(config.director_nombre, canvas.width * (config.cert_dir_x / 100), canvas.height * (config.cert_dir_y / 100));
                }

                // Función auxiliar para cargar y dibujar firmas
                const drawFirma = (base64, x, y, w) => {
                    return new Promise(resolve => {
                        if (!base64) return resolve();
                        const fImg = new Image();
                        fImg.onload = () => {
                            const aspect = fImg.height / fImg.width;
                            const dW = canvas.width * (w / 100);
                            const dH = dW * aspect;
                            ctx.drawImage(fImg, canvas.width * (x / 100) - (dW / 2), canvas.height * (y / 100) - (dH / 2), dW, dH);
                            resolve();
                        };
                        fImg.src = base64;
                    });
                };

                await drawFirma(config.firma_data, config.cert_firma_x, config.cert_firma_y, config.cert_firma_w);
                await drawFirma(config.firma_dg_data, config.cert_firma_dg_x, config.cert_firma_dg_y, config.cert_firma_dg_w);

                const doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width, canvas.height] });
                doc.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
                doc.save(`Reconocimiento_${profile.nombre}_${month}.pdf`);
            };

            img.src = 'certificado.png';
        };

        displayRecognitions();
    }
});

// --- FUNCIONES GLOBALES DE MANTENIMIENTO ---
window.deleteRecord = async (table, id, refreshCallback) => {
    if (!confirm('¿Está seguro de eliminar este registro?')) return;
    
    const { error } = await supabaseClient.from(table).delete().eq('id', id);
    if (error) {
        alert("Error al eliminar: " + error.message);
    } else {
        if (refreshCallback) refreshCallback(); else window.location.reload();
    }
};

window.updateUserRole = async (userId, newRole) => {
    if (!supabaseClient) {
        alert('Error: Cliente de base de datos no inicializado.');
        return;
    }
    const { error } = await supabaseClient.from('profiles').update({ role: newRole }).eq('id', userId);
    if (error) {
        alert('Error al actualizar el rol: ' + error.message);
    } else {
        alert('Rol actualizado con éxito');
        if (window.displayUsers) window.displayUsers();
    }
};

// Helper function to parse "HH:MM AM/PM" to { time24: "HH:MM", ampm: "AM/PM" }
function parseTime(timeString) {
    if (!timeString || typeof timeString !== 'string') return { time24: "00:00", ampm: "AM" };
    
    const parts = timeString.split(' ');
    const time = parts[0] || "00:00";
    const ampm = parts[1] || "AM";

    let [hours, minutes] = time.split(':').map(Number);
    if (isNaN(hours)) hours = 0;
    if (isNaN(minutes)) minutes = 0;

    if (ampm === 'PM' && hours < 12) {
        hours += 12;
    } else if (ampm === 'AM' && hours === 12) {
        hours = 0;
    }

    const formattedHours = String(hours).padStart(2, '0');
    const formattedMinutes = String(minutes).padStart(2, '0');

    return {
        time24: `${formattedHours}:${formattedMinutes}`,
        ampm: ampm
    };
}

// Función auxiliar para asegurar que la hora se guarde en formato de 12h (HH:MM AM/PM)
function formatTimeTo12h(timeValue, ampm) {
    if (!timeValue) return `12:00 ${ampm}`;
    let [hours, minutes] = timeValue.split(':').map(Number);
    // Convertir a base 12
    hours = hours % 12;
    if (hours === 0) hours = 12;
    const formattedHours = String(hours).padStart(2, '0');
    return `${formattedHours}:${String(minutes).padStart(2, '0')} ${ampm}`;
}
