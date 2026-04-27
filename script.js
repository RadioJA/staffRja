const SUPABASE_URL = "https://ryogxtycodsunosfvyyl.supabase.co";
const SUPABASE_KEY = "sb_publishable_CMAvEM14yS1X6wtris5dkg_f71p_qIe";

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
    // Inicializar el cliente dentro del evento para asegurar que las librerías externas estén listas
    if (window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    } else {
        console.error("No se detectó la librería de Supabase. Revisa la conexión o los tags <script>.");
    }

    if (!supabaseClient) {
        console.error("No se pudo inicializar Supabase. Verifique las librerías.");
        return;
    }

    // Verificar sesión al cargar páginas protegidas
    const currentUser = localStorage.getItem('currentUser');
    const role = localStorage.getItem('userRole');

    console.log("Sesión activa:", currentUser, "| Rol:", role);

    const protectedPages = ['panel_principal', 'moderadores', 'locutores', 'dh', 'dg', 'reportes', 'usuarios'];
    const isProtectedPage = protectedPages.some(page => window.location.pathname.includes(page));

    if (!currentUser && isProtectedPage) {
        window.location.href = 'index.html';
        return;
    }

    // Mostrar link de Usuarios solo para admins
    const menuUsuarios = document.querySelector('#menu-usuarios');
    if (menuUsuarios && role === 'admin') {
        menuUsuarios.style.display = 'block';
    }

    // Mostrar tarjeta de Usuarios en el dashboard solo para admins
    const dashUsuarios = document.getElementById('dash-usuarios');
    if (dashUsuarios && role === 'admin') {
        dashUsuarios.style.display = 'flex';
    }

    const loginForm = document.querySelector('#login-form form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

            if (error) {
                alert('Error al iniciar sesión: ' + error.message);
            } else {
                const { data: profile } = await supabaseClient.from('profiles').select('nombre, role').eq('id', data.user.id).single();
                localStorage.setItem('currentUser', data.user.id);
                localStorage.setItem('currentUserName', profile?.nombre || 'Usuario');
                localStorage.setItem('userRole', profile?.role || 'user');
                window.location.href = 'panel_principal.html';
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
    const modForm = document.getElementById('mod-form');
    if (modForm) {
        const tableBody = document.querySelector('#tabla-moderadores tbody');
        
        const displayModerators = async () => {
            const filter = document.getElementById('filter-categoria').value;
            let query = supabaseClient.from('moderadores').select('*');
            if (filter !== 'all') query = query.eq('categoria', filter);
            
            const { data, error } = await query.order('categoria', { ascending: true });
            if (error) return console.error(error);

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
                    <td><button class="btn-delete" onclick="deleteRecord('moderadores', ${mod.id})">Eliminar</button></td>
                `;
                tableBody.appendChild(row);
            });
        };

        modForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const dias = Array.from(document.querySelectorAll('input[name="mod-dia"]:checked')).map(cb => cb.value);
            const formData = {
                categoria: document.getElementById('categoria').value,
                dias_horario: dias,
                inicio: `${document.getElementById('hora-inicio').value} ${document.getElementById('ampm-inicio').value}`,
                fin: `${document.getElementById('hora-fin').value} ${document.getElementById('ampm-fin').value}`,
                nombre: document.getElementById('nombre-mod').value,
                pais: document.getElementById('pais').value,
                fecha_ingreso: document.getElementById('fecha-ingreso').value,
                fecha_cumple: document.getElementById('fecha-cumple').value,
                director_horario: document.getElementById('director-horario').value
            };
            const { error } = await supabaseClient.from('moderadores').insert([formData]);
            if (error) alert(error.message); else { modForm.reset(); displayModerators(); }
        });

        document.getElementById('filter-categoria').addEventListener('change', displayModerators);
        displayModerators();
    }

    // --- LÓGICA DE LOCUTORES ---
    const locForm = document.getElementById('loc-form');
    if (locForm) {
        const tableBody = document.querySelector('#tabla-locutores tbody');
        
        const displayLocutores = async () => {
            const filter = document.getElementById('filter-categoria-loc').value;
            let query = supabaseClient.from('locutores').select('*');
            if (filter !== 'all') query = query.eq('categoria', filter);
            
            const { data, error } = await query;
            if (error) return;

            tableBody.innerHTML = '';
            data.forEach(loc => {
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
                    <td><button class="btn-delete" onclick="deleteRecord('locutores', ${loc.id})">Eliminar</button></td>
                `;
                tableBody.appendChild(row);
            });
        };

        locForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const dias = Array.from(document.querySelectorAll('input[name="loc-dia"]:checked')).map(cb => cb.value);
            const formData = {
                categoria: document.getElementById('loc-categoria').value,
                dias_horario: dias,
                inicio: `${document.getElementById('loc-hora-inicio').value} ${document.getElementById('loc-ampm-inicio').value}`,
                fin: `${document.getElementById('loc-hora-fin').value} ${document.getElementById('loc-ampm-fin').value}`,
                nombre: document.getElementById('loc-nombre').value,
                programa: document.getElementById('loc-programa').value,
                canto: document.getElementById('loc-canto').value,
                slogan: document.getElementById('loc-slogan').value,
                pais: document.getElementById('loc-pais').value,
                fecha_ingreso: document.getElementById('loc-fecha-ingreso').value,
                fecha_cumple: document.getElementById('loc-fecha-cumple').value,
                director: document.getElementById('loc-director').value
            };
            await supabaseClient.from('locutores').insert([formData]);
            locForm.reset(); displayLocutores();
        });

        document.getElementById('filter-categoria-loc').addEventListener('change', displayLocutores);
        displayLocutores();
    }

    // --- LÓGICA DE DIRECTORES (DH) ---
    const dhForm = document.getElementById('dh-form');
    if (dhForm) {
        const tableBody = document.querySelector('#tabla-dh tbody');
        const displayDh = async () => {
            const { data } = await supabaseClient.from('directores_horario').select('*');
            tableBody.innerHTML = '';
            data?.forEach(dh => {
                tableBody.innerHTML += `<tr>
                    <td>${dh.categoria}</td><td>${dh.dias_horario.join(', ')}</td><td>${dh.inicio}</td><td>${dh.fin}</td>
                    <td>${dh.nombre}</td><td>${dh.pais}</td><td>${dh.fecha_ingreso}</td><td>${dh.fecha_cumple}</td>
                    <td><button class="btn-delete" onclick="deleteRecord('directores_horario', ${dh.id})">Eliminar</button></td>
                </tr>`;
            });
        };
        dhForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const dias = Array.from(document.querySelectorAll('input[name="dh-dia"]:checked')).map(cb => cb.value);
            await supabaseClient.from('directores_horario').insert([{
                categoria: document.getElementById('dh-categoria').value,
                dias_horario: dias,
                inicio: `${document.getElementById('dh-hora-inicio').value} ${document.getElementById('dh-ampm-inicio').value}`,
                fin: `${document.getElementById('dh-hora-fin').value} ${document.getElementById('dh-ampm-fin').value}`,
                nombre: document.getElementById('dh-nombre').value,
                pais: document.getElementById('dh-pais').value,
                fecha_ingreso: document.getElementById('dh-fecha-ingreso').value,
                fecha_cumple: document.getElementById('dh-fecha-cumple').value
            }]);
            dhForm.reset(); displayDh();
        });
        displayDh();
    }

    // --- LÓGICA DE DIRECTIVA GENERAL (DG) ---
    const dgForm = document.getElementById('dg-form');
    if (dgForm) {
        const populateSelect = async () => {
            const { data: mods } = await supabaseClient.from('moderadores').select('nombre');
            const { data: locs } = await supabaseClient.from('locutores').select('nombre');
            const { data: dhs } = await supabaseClient.from('directores_horario').select('nombre');
            const nombres = [...new Set([...(mods||[]), ...(locs||[]), ...(dhs||[])].map(i => i.nombre))];
            const select = document.getElementById('dg-nombre');
            nombres.forEach(n => select.innerHTML += `<option value="${n}">${n}</option>`);
        };
        const displayDg = async () => {
            const { data } = await supabaseClient.from('directiva_general').select('*');
            const tbody = document.querySelector('#tabla-dg tbody');
            tbody.innerHTML = '';
            data?.forEach(dg => {
                tbody.innerHTML += `<tr><td>${dg.nombre}</td><td>${dg.cargo}</td><td>${dg.pais}</td><td>${dg.fecha_ingreso}</td><td>${dg.fecha_cumple}</td>
                <td><button class="btn-delete" onclick="deleteRecord('directiva_general', ${dg.id})">Eliminar</button></td></tr>`;
            });
        };
        dgForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await supabaseClient.from('directiva_general').insert([{
                nombre: document.getElementById('dg-nombre').value,
                cargo: document.getElementById('dg-cargo').value,
                pais: document.getElementById('dg-pais').value,
                fecha_ingreso: document.getElementById('dg-fecha-ingreso').value,
                fecha_cumple: document.getElementById('dg-fecha-cumple').value
            }]);
            dgForm.reset(); displayDg();
        });
        populateSelect(); displayDg();
    }

    // --- LÓGICA DE REPORTES ---
    const repForm = document.getElementById('rep-form');
    if (repForm) {
        const populateRepSelects = async () => {
            const { data: locs } = await supabaseClient.from('locutores').select('nombre');
            const { data: mods } = await supabaseClient.from('moderadores').select('nombre');
            const { data: dhs } = await supabaseClient.from('directores_horario').select('nombre');
            
            const fill = (id, list) => {
                const el = document.getElementById(id);
                if (el) list.forEach(i => el.innerHTML += `<option value="${i.nombre}">${i.nombre}</option>`);
            };
            fill('rep-director', dhs || []);
            fill('rep-loc1', locs || []); fill('rep-loc2', locs || []);
            fill('rep-whatsapp', mods || []); fill('rep-chat', mods || []); fill('rep-redes', mods || []);
        };

        const displayReports = async () => {
            const role = localStorage.getItem('userRole');
            let query = supabaseClient.from('reportes').select('*');
            if (role !== 'admin') query = query.eq('user_id', currentUser);
            
            const { data } = await query.order('fecha', { ascending: false });
            const tbody = document.querySelector('#tabla-reportes tbody');
            tbody.innerHTML = '';
            data?.forEach(r => {
                tbody.innerHTML += `<tr>
                    <td>${r.fecha}</td><td>${r.director}</td><td>${r.estuvo} ${r.cubrio ? '('+r.cubrio+')' : ''}</td>
                    <td>1h: ${r.loc1}<br>2h: ${r.loc2}</td><td>C: ${r.chat}<br>R: ${r.redes}</td>
                    <td><button class="btn-delete" onclick="deleteRecord('reportes', ${r.id})">Eliminar</button></td>
                </tr>`;
            });
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
            const { error } = await supabaseClient.from('reportes').insert([formData]);
            if (error) alert(error.message); else { repForm.reset(); displayReports(); }
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

        populateRepSelects(); displayReports();
    }

    // --- LÓGICA DE USUARIOS (ADMIN) ---
    const userTableBody = document.querySelector('#tabla-usuarios tbody');
    if (userTableBody) {
        if (role !== 'admin') {
            window.location.href = 'panel_principal.html';
            return;
        }

        const displayUsers = async () => {
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
        displayUsers();
    }
});

// Función global para eliminar registros
async function deleteRecord(table, id) {
    if (!confirm('¿Está seguro de eliminar este registro?')) return;
    const { error } = await supabaseClient.from(table).delete().eq('id', id);
    if (error) alert(error.message); else window.location.reload();
}

// Función global para actualizar roles de usuario
async function updateUserRole(userId, newRole) {
    const role = localStorage.getItem('userRole');
    if (role !== 'admin') return;
    
    if (!confirm(`¿Está seguro de cambiar el rol de este usuario a "${newRole}"?`)) {
        window.location.reload();
        return;
    }
    
    const { error } = await supabaseClient.from('profiles').update({ role: newRole }).eq('id', userId);
    if (error) {
        alert('Error al actualizar el rol: ' + error.message);
        window.location.reload();
    } else {
        alert('Rol actualizado correctamente.');
    }
}

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
