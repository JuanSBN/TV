/**
 * App - Orquestador principal de Mi Xuper TV
 * Versión Ultra-Light para Samsung Serie J (2015)
 * Vanilla JS, sin dependencias, objetivo: < 35 MB RAM
 */
var App = (function() {
    'use strict';
    
    // ===== CONFIGURACIÓN =====
    var CONFIG = {
        URL_LISTA: 'lista.m3u',
        TIMEOUT_MS: 30000,
        MSG_CARGANDO: 'Actualizando...',
        MSG_ERROR_RED: 'Sin conexión.',
        MSG_ERROR_LISTA: 'Lista vacía.',
        MSG_ERROR_STREAM: 'Canal no disponible.'
    };
    
    // 🔹 Flag para desactivar logs en producción (ahorra RAM)
    var DEBUG = false;
    
    // 🔹 Regex compilado UNA VEZ (no en cada llamada)
    var RX_FORMATOS = /\.m3u8|\.ts|\.mp4|\.mkv|\.avi|\.flv|application\/x-mpegurl|\?token=/i;
    
    // Variables privadas
    var videoEl = null;
    var uiCargando = null;
    var uiError = null;
    
    // ===== FUNCIONES DE UI =====
    function mostrarCarga(mostrar, mensaje) {
        if (!uiCargando) return; // Early return: evita operaciones innecesarias
        if (mensaje) uiCargando.textContent = mensaje;
        uiCargando.style.display = mostrar ? 'block' : 'none';
    }
    
    function mostrarError(mensaje, ocultarDespues) {
        if (!uiError) return;
        uiError.textContent = mensaje || CONFIG.MSG_ERROR_RED;
        uiError.style.display = 'block';
        if (ocultarDespues !== false) {
            setTimeout(function() { uiError.style.display = 'none'; }, 6000);
        }
    }
    
    function log(mensaje) { if (DEBUG) console.log('[App]', mensaje); }
    function warn(mensaje) { if (DEBUG) console.warn('[App]', mensaje); }
    function error(mensaje) { if (DEBUG) console.error('[App]', mensaje); }
    
    // ===== LÓGICA PRINCIPAL =====
    function validarFormatoUrl(url) {
        return url && RX_FORMATOS.test(url.toLowerCase());
    }
    
    // 🔹 Funciones nombradas (referencias, no creaciones en bucle)
    function onVideoPlaying() {
        mostrarCarga(false);
        log('▶ Reproduciendo');
    }
    
    function onVideoError() {
        mostrarCarga(false);
        error('❌ Error de video: ' + (videoEl.error ? videoEl.error.message : 'desconocido'));
        mostrarError(CONFIG.MSG_ERROR_STREAM);
    }
    
    return {
        inicializar: function() {
            log('🚀 Iniciando...');
            
            // Cache de referencias DOM (una sola búsqueda)
            videoEl = document.getElementById('tv-player');
            uiCargando = document.getElementById('loading-indicator');
            uiError = document.getElementById('error-message');
            
            if (!videoEl) { error('❌ No hay <video>'); return; }
            
            ControlRemoto.inicializar();
            mostrarCarga(true, CONFIG.MSG_CARGANDO);
            
            // 🔹 Cache-busting ultra-rápido: +new Date vs Date.now()
            var sep = CONFIG.URL_LISTA.indexOf('?') === -1 ? '?' : '&';
            var urlFinal = CONFIG.URL_LISTA + sep + 'v=' + (+new Date);
            
            ParserM3U.cargarDesdeURL(urlFinal,
                function(canales) {
                    mostrarCarga(false);
                    if (!canales || !canales.length) {
                        warn('Lista vacía');
                        mostrarError(CONFIG.MSG_ERROR_LISTA);
                        return;
                    }
                    log('✅ ' + canales.length + ' canales');
                    var el = document.getElementById('total-canales');
                    if (el) el.textContent = canales.length;
                    VirtualScroll.inicializar(canales);
                },
                function(err) {
                    mostrarCarga(false);
                    error('Error lista: ' + err);
                    mostrarError(CONFIG.MSG_ERROR_RED);
                }
            );
        },
        
        reproducirUrl: function(url) {
    if (!url || !videoEl) return;
    
    // Validación básica
    if (!validarFormatoUrl(url)) {
        warn('Formato no compatible: ' + url);
        mostrarError('Formato no soportado');
        return;
    }
    
    try {
        mostrarCarga(true, 'Conectando...');
        this.limpiarReproduccion();
        
        // 🔑 CRÍTICO para Samsung 2015:
        // 1. Forzar carga directa sin prefetch
        // 2. Agregar atributos específicos para Tizen
        videoEl.setAttribute('preload', 'auto');
        videoEl.setAttribute('autoplay', 'true');
        videoEl.setAttribute('playsinline', 'true');
        videoEl.setAttribute('webkit-playsinline', 'true');
        
        // 3. Limpiar fuentes anteriores
        videoEl.src = '';
        videoEl.load();
        
        // 4. Pequeño delay antes de cargar nueva URL (evita race conditions)
        setTimeout(function() {
            videoEl.src = url;
            videoEl.load();
            
            // 5. Intentar play con manejo de errores específico Tizen
            var playPromise = videoEl.play();
            
            if (playPromise && typeof playPromise.then === 'function') {
                playPromise
                    .then(function() {
                        log('▶ Reproducción iniciada');
                    })
                    .catch(function(err) {
                        mostrarCarga(false);
                        error('Error play(): ' + err.message);
                        mostrarError('Error al reproducir. Intenta otro canal.');
                    });
            }
        }, 100);
        
        // 6. Eventos específicos para debug
        videoEl.onplaying = function() {
            mostrarCarga(false);
            log('▶ Reproduciendo: ' + url);
        };
        
        videoEl.onerror = function() {
            mostrarCarga(false);
            var err = videoEl.error;
            var msg = 'Error de video';
            if (err) {
                switch(err.code) {
                    case 1: msg = 'Video abortado'; break;
                    case 2: msg = 'Error de red'; break;
                    case 3: msg = 'Video no soportado'; break;
                    case 4: msg = 'Formato inválido'; break;
                }
            }
            error('Video error: ' + msg);
            mostrarError(msg);
        };
        
        videoEl.onwaiting = function() {
            log('⏳ Buffering...');
        };
        
        videoEl.onstalled = function() {
            warn('⚠ Stream stalled');
        };
        
    } catch (e) {
        mostrarCarga(false);
        error('Excepción: ' + e.message);
        mostrarError('Error interno');
    }
},
        
        limpiarReproduccion: function() {
            if (!videoEl) return;
            try {
                videoEl.pause();
                videoEl.src = '';
                videoEl.load(); // Libera buffer de hardware
                log('🧹 Limpio');
            } catch (e) { warn('No se pudo limpiar: ' + e.message); }
        },
        
        salirAplicacion: function() {
            log('🚪 Saliendo...');
            this.limpiarReproduccion();
            
            if (VirtualScroll && typeof VirtualScroll.limpiar === 'function') VirtualScroll.limpiar();
            if (ParserM3U && typeof ParserM3U.limpiar === 'function') ParserM3U.limpiar();
            
            if (typeof tizen !== 'undefined' && tizen.application) {
                try { tizen.application.getCurrentApplication().exit(); return; }
                catch (e) { warn('No se pudo salir vía Tizen'); }
            }
            
            mostrarCarga(false);
            mostrarError('Usa Return para salir', false);
        },
        
        getVersion: function() { return '1.0.1'; }
    };
})();

// Forzar foco inmediato al cargar (crítico para navegadores TV)
window.onload = function() {
    setTimeout(function() {
        document.body.focus();
        App.inicializar();
    }, 200);
};

// ===== PUNTO DE ENTRADA =====
(function() {
    'use strict';
    function iniciar() { setTimeout(function() { App.inicializar(); }, 100); }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', iniciar);
    } else { iniciar(); }
})();
