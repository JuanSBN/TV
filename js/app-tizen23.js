/**
 * Xuper TV - Versión optimizada para Samsung Tizen 2.3 (2015)
 * Compatibilidad: ES5, DOM Level 2, XMLHttpRequest, sin Promises/Arrow/Template
 */
(function() {
    'use strict';

    // ================= CONFIGURACIÓN =================
    var CONFIG = {
        // Cache-buster para evitar que el TV guarde la lista en caché
        M3U_URL: 'lista.m3u?v=' + new Date().getTime(),
        RENDER_LIMIT: 100 // Límite inicial para no saturar RAM (512MB compartidos)
    };

    // ================= ESTADO GLOBAL =================
    var app = {
        channels: [],
        currentIndex: 0,
        videoEl: null,
        listEl: null,
        loadingEl: null,
        errorEl: null,
        sidebarEl: null,
        isMenuVisible: true,
        hasUserGesture: false
    };

    // ================= INICIALIZACIÓN =================
    function init() {
        // Referencias DOM (getElementById es el más compatible)
        app.videoEl = document.getElementById('tv-player');
        app.listEl = document.getElementById('lista-canales');
        app.loadingEl = document.getElementById('loading');
        app.errorEl = document.getElementById('error-message');
        app.sidebarEl = document.getElementById('sidebar');

        // Forzar foco al body (crítico en navegadores TV antiguos)
        document.body.setAttribute('tabindex', '0');
        document.body.focus();

        // Registrar eventos de teclado
        document.onkeydown = handleKeyDown;
        // Fallback para algunos WebKit antiguos
        if (document.addEventListener) {
            document.addEventListener('keydown', handleKeyDown, false);
        }

        // Cargar lista
        showLoading('Descargando lista...');
        loadM3U();
    }

    // ================= CARGA Y PARSEO M3U =================
    function loadM3U() {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', CONFIG.M3U_URL, true);
        xhr.timeout = 15000; // 15s timeout para redes lentas

        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    parseM3U(xhr.responseText);
                } else {
                    showError('Error HTTP: ' + xhr.status);
                }
            }
        };

        xhr.onerror = function() {
            showError('Sin conexión o CORS bloqueado.');
        };

        xhr.ontimeout = function() {
            showError('Tiempo de espera agotado.');
        };

        xhr.send();
    }

    function parseM3U(text) {
        var lines = text.split('\n');
        var channels = [];
        
        // Parseo simple y robusto
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].replace(/\r/g, '').trim();
            
            if (line.indexOf('#EXTINF:') === 0) {
                // Extraer nombre después de la última coma
                var lastComma = line.lastIndexOf(',');
                var name = (lastComma !== -1) ? line.substring(lastComma + 1).trim() : 'Canal ' + (channels.length + 1);
                var url = (i + 1 < lines.length) ? lines[i + 1].trim() : '';
                
                // Validar URL básica
                if (url && (url.indexOf('http://') === 0 || url.indexOf('https://') === 0)) {
                    channels.push({ name: name, url: url });
                }
            }
        }

        if (channels.length === 0) {
            showError('Lista vacía o formato M3U inválido.');
            return;
        }

        // Limitar renderizado inicial para proteger RAM
        if (channels.length > CONFIG.RENDER_LIMIT) {
            app.channels = channels.slice(0, CONFIG.RENDER_LIMIT);
            showError('Mostrando primeros ' + CONFIG.RENDER_LIMIT + ' canales por limitación de memoria.');
        } else {
            app.channels = channels;
        }

        renderList();
        hideLoading();
        focusChannel(0);
    }

    // ================= RENDERIZADO UI =================
    function renderList() {
        // Usar DocumentFragment para minimizar reflows (crucial en WebKit antiguo)
        var fragment = document.createDocumentFragment();
        
        for (var i = 0; i < app.channels.length; i++) {
            var li = document.createElement('li');
            li.id = 'ch-' + i;
            li.className = (i === app.currentIndex) ? 'canal-item active' : 'canal-item';
            li.setAttribute('data-index', i);
            
            var num = document.createElement('span');
            num.className = 'canal-number';
            num.innerHTML = (i + 1) + '.';
            
            var name = document.createElement('span');
            name.className = 'canal-name';
            // Escape básico para evitar inyección HTML
            name.innerHTML = escapeHtml(app.channels[i].name);
            
            li.appendChild(num);
            li.appendChild(name);
            fragment.appendChild(li);
        }
        
        // Limpiar y insertar en un solo paso
        app.listEl.innerHTML = '';
        app.listEl.appendChild(fragment);
        document.getElementById('total-canales').innerHTML = app.channels.length + ' canales';
    }

    function escapeHtml(text) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(text));
        return div.innerHTML;
    }

    // ================= NAVEGACIÓN Y TECLADO =================
    function handleKeyDown(e) {
        e = e || window.event;
        var keyCode = e.keyCode || e.which;
        
        // Prevenir acciones nativas del navegador TV
        if (e.preventDefault) e.preventDefault();
        e.returnValue = false;

        // Marcar interacción de usuario (necesario para autoplay en algunos WebKit)
        app.hasUserGesture = true;

        switch (keyCode) {
            case 38: // Flecha ARRIBA
                if (app.currentIndex > 0) focusChannel(app.currentIndex - 1);
                break;
                
            case 40: // Flecha ABAJO
                if (app.currentIndex < app.channels.length - 1) focusChannel(app.currentIndex + 1);
                break;
                
            case 13: // ENTER
                playChannel(app.currentIndex);
                break;
                
            case 10009: // RETURN (Tizen)
            case 412:   // EXIT (algunos controles)
                toggleMenu();
                break;
        }
        
        return false;
    }

    function focusChannel(index) {
        // Quitar clase activa anterior
        var prev = document.getElementById('ch-' + app.currentIndex);
        if (prev) prev.className = 'canal-item';
        
        app.currentIndex = index;
        var curr = document.getElementById('ch-' + index);
        if (curr) {
            curr.className = 'canal-item active';
            // scrollIntoView sin opciones (compatible con 2015)
            curr.scrollIntoView();
        }
    }

    function toggleMenu() {
        if (app.isMenuVisible) {
            app.isMenuVisible = false;
            app.sidebarEl.style.display = 'none';
            // Forzar foco al video para que RETURN cierre después
            app.videoEl.focus();
        } else {
            app.isMenuVisible = true;
            app.sidebarEl.style.display = 'block';
            focusChannel(app.currentIndex);
        }
    }

    // ================= REPRODUCTOR DE VIDEO =================
    function playChannel(index) {
        var channel = app.channels[index];
        if (!channel) return;

        hideMenu();
        showLoading('Conectando...');
        hideError();

        var v = app.videoEl;
        
        // Ciclo de vida seguro para Tizen 2.3
        v.pause();
        v.src = '';
        v.removeAttribute('src');
        v.load();

        // Delay obligatorio en WebKit antiguo entre clear y set
        setTimeout(function() {
            v.src = channel.url;
            v.setAttribute('autoplay', 'true');
            v.load();
            
            // Intentar play explícito (algunos TVs lo requieren tras interacción)
            try {
                if (typeof v.play === 'function') v.play();
            } catch (err) {
                // Ignorar si no soporta promesas o está bloqueado
            }
        }, 250);

        // Eventos de estado
        v.onplaying = function() {
            hideLoading();
            hideError();
        };
        
        v.onwaiting = function() {
            showLoading('Buffering...');
        };
        
        v.onerror = function() {
            hideLoading();
            var code = v.error ? v.error.code : 0;
            var msg = 'Error de reproducción';
            if (code === 4) msg = 'Formato/Códec no soportado';
            else if (code === 2) msg = 'Error de red o token expirado';
            else if (code === 3) msg = 'Decodificación fallida';
            
            showError(msg + ' (Err:' + code + ')');
            
            // Volver a mostrar menú tras error
            setTimeout(function() { toggleMenu(); }, 4000);
        };
    }

    // ================= UTILIDADES UI =================
    function showLoading(msg) {
        document.getElementById('loading-text').innerHTML = msg || 'Cargando...';
        app.loadingEl.className = 'visible';
    }
    
    function hideLoading() {
        app.loadingEl.className = '';
    }
    
    function showError(msg) {
        document.getElementById('error-text').innerHTML = msg || 'Error';
        app.errorEl.className = 'visible';
    }
    
    function hideError() {
        app.errorEl.className = '';
    }

    function hideMenu() {
        app.isMenuVisible = false;
        app.sidebarEl.style.display = 'none';
    }

    // ================= ARRANQUE =================
    // Esperar a que el DOM esté 100% listo (TVs lentos)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() { setTimeout(init, 400); });
    } else {
        setTimeout(init, 400);
    }

})();
