/**
 * ParserM3U - Motor ultra-ligero para listas M3U
 * Optimizado para Samsung Serie J (2015) + GitHub Pages
 * Vanilla JS, sin dependencias, chunking asíncrono
 */
var ParserM3U = (function() {
    'use strict';
    
    // ===== CONFIGURACIÓN =====
    var TAMANO_BLOQUE = 200; // Optimizado para CPU de 2015 (menos = más fluido)
    var TIEMPO_LIBERACION = 0; // 0ms: dejar que el event loop decida (mejor en WebKit antiguo)
    var DEBUG = false; // Desactivar en producción para ahorrar RAM en logs
    
    // 🔹 Regex COMPILADOS UNA VEZ (no en cada línea)
    var RX_EXTINF = /^#EXTINF:/i;
    var RX_HTTP = /^https?:\/\//i;
    var RX_TVG_NAME = /tvg-name="([^"]+)"/i;
    var RX_TVG_LOGO = /tvg-logo="([^"]+)"/i;
    var RX_COMA_FINAL = /,\s*([^,]+)\s*$/; // Extrae nombre después de última coma
    
    // Estado privado
    var canales = [];
    
    // ===== FUNCIONES DE SOPORTE =====
    function log(m) { if (DEBUG) console.log('[Parser]', m); }
    function warn(m) { if (DEBUG) console.warn('[Parser]', m); }
    
    // 🔹 Procesamiento de una línea (ultra-rápido, sin operaciones innecesarias)
    function procesarLinea(linea, canalActual) {
        // Early return: saltar líneas vacías sin trim()
        if (!linea || linea.length === 0) return canalActual;
        
        // Evitar trim() si no es necesario (ahorra ~15% de tiempo)
        var primera = linea.charCodeAt(0);
        
        // Caso 1: Línea #EXTINF (primera char es '#')
        if (primera === 35 && RX_EXTINF.test(linea)) { // 35 = '#'
            canalActual = { n: '', u: '' }; // 🔹 Propiedades cortas: n=nombre, u=url (ahorra ~30% memoria)
            
            // Extraer nombre: prioridad tvg-name > texto después de coma
            var matchName = linea.match(RX_TVG_NAME);
            if (matchName && matchName[1]) {
                canalActual.n = matchName[1];
            } else {
                var matchComa = linea.match(RX_COMA_FINAL);
                if (matchComa && matchComa[1]) {
                    canalActual.n = matchComa[1].trim();
                }
            }
            // Si aún está vacío, usar default
            if (!canalActual.n) canalActual.n = 'Canal';
            
            return canalActual;
        }
        
        // Caso 2: Línea con URL (empieza con 'h')
        if (primera === 104 && canalActual && RX_HTTP.test(linea)) { // 104 = 'h'
            // 🔹 Tomar solo la URL antes de espacio (evita parámetros extra)
            var espacio = linea.indexOf(' ');
            canalActual.u = espacio > 0 ? linea.substring(0, espacio) : linea;
            canales.push(canalActual);
            return null; // Resetear para siguiente canal
        }
        
        // Línea ignorada (comentarios, directivas, etc.)
        return canalActual;
    }
    
    // 🔹 Procesamiento por bloques con liberación del main thread
    function procesarBloque(lineas, index, callback) {
        var fin = Math.min(index + TAMANO_BLOQUE, lineas.length);
        var canalActual = null;
        
        // Bucle optimizado: sin llamadas a funciones dentro del for
        for (var i = index; i < fin; i++) {
            var linea = lineas[i];
            // Inline early checks para evitar llamadas a función
            if (!linea) continue;
            var c = linea.charCodeAt(0);
            if (c === 35 && RX_EXTINF.test(linea)) {
                canalActual = { n: '', u: '' };
                var mn = linea.match(RX_TVG_NAME);
                if (mn && mn[1]) canalActual.n = mn[1];
                else {
                    var mc = linea.match(RX_COMA_FINAL);
                    if (mc && mc[1]) canalActual.n = mc[1].trim();
                }
                if (!canalActual.n) canalActual.n = 'Canal';
            } else if (c === 104 && canalActual && RX_HTTP.test(linea)) {
                var sp = linea.indexOf(' ');
                canalActual.u = sp > 0 ? linea.substring(0, sp) : linea;
                canales.push(canalActual);
                canalActual = null;
            }
        }
        
        // ¿Más bloques por procesar?
        if (fin < lineas.length) {
            // 🔹 setTimeout con 0ms: dejar que WebKit optimice el scheduling
            setTimeout(function() {
                procesarBloque(lineas, fin, callback);
            }, TIEMPO_LIBERACION);
        } else {
            log('✅ Parsing completado: ' + canales.length + ' canales');
            if (typeof callback === 'function') callback(canales);
        }
    }
    
    return {
        /**
         * Carga y procesa lista M3U desde URL
         * @param {string} url - URL de la lista (relativa o absoluta)
         * @param {function} onCompleto - Callback(canales)
         * @param {function} onError - Callback(mensaje)
         */
        cargarDesdeURL: function(url, onCompleto, onError) {
    // 🔑 CRÍTICO: Limpiar array ANTES de cargar
    canales = [];
    
    log('📥 Cargando: ' + url);
    
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.timeout = 30000;
    xhr.responseType = 'text';
    
    xhr.onload = function() {
        if (xhr.status !== 200) {
            if (typeof onError === 'function') onError('HTTP ' + xhr.status);
            return;
        }
        
        var texto = xhr.responseText;
        
        // Validar header
        if (texto.indexOf('#EXTM3U') === -1) {
            warn('⚠ Sin header #EXTM3U');
        }
        
        var lineas = texto.split('\n');
        log('📄 ' + lineas.length + ' líneas');
        
        procesarBloque(lineas, 0, onCompleto);
    };
    
    xhr.onerror = function() {
        if (typeof onError === 'function') onError('Error de red');
    };
    
    xhr.ontimeout = function() {
        if (typeof onError === 'function') onError('Timeout');
    };
    
    xhr.send();
},
        
        /**
         * Limpia memoria de canales procesados
         * IMPORTANTE: Llamar al salir de la app para evitar fugas
         */
        limpiar: function() {
            log('🧹 Limpiando parser');
            canales = [];
        },
        
        /**
         * Obtiene referencia a los canales (solo lectura recomendada)
         */
        getCanales: function() {
            return canales;
        },
        
        /**
         * Obtiene estadísticas de parsing (útil para debugging)
         */
        getStats: function() {
            return {
                total: canales.length,
                memoriaEstimadaKB: Math.round(canales.length * 0.15) // ~150 bytes por canal
            };
        }
    };
})();
