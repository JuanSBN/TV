/**
 * ControlRemoto - Versión para Navegador Web de Samsung TV
 * Maneja foco, captura en fase early, y códigos alternativos del botón central
 */
var ControlRemoto = (function() {
    'use strict';
    
    // Mapeo extendido: algunos TVs envían Espacio(32) o Return(10009) en lugar de Enter(13)
    var K = { UP: 38, DOWN: 40, ENTER: 13, SPACE: 32, RETURN: 10009, EXIT: 412 };
    var VS = null, APP = null, VIDEO = null;

    function onKey(e) {
        // Normalizar código de tecla (webkit antiguo usa which)
        var k = e.keyCode || e.which || 0;
        
        // Bloquear comportamiento nativo del navegador (scroll, zoom, etc.)
        e.preventDefault();
        e.stopPropagation();

        switch (k) {
            case K.UP:
                if (VS) VS.moverFoco(-1);
                break;
                
            case K.DOWN:
                if (VS) VS.moverFoco(1);
                break;
                
            case K.ENTER: case K.SPACE: case K.RETURN:
                // Si hay video reproduciéndose → toggle pausa/play
                var v = VIDEO || (VIDEO = document.getElementById('tv-player'));
                if (v && v.src && !v.error) {
                    v.paused ? v.play() : v.pause();
                } 
                // Si no → seleccionar canal
                else if (VS && APP) {
                    var c = VS.obtenerSeleccionado();
                    if (c && c.u) APP.reproducirUrl(c.u);
                }
                break;
                
            case K.EXIT:
                if (APP) APP.salirAplicacion();
                break;
        }
        return false;
    }

    return {
        inicializar: function() {
            // 🔑 TRUCO CLAVE: Forzar foco al body para que el navegador capture teclas
            document.body.setAttribute('tabindex', '0');
            document.body.style.outline = 'none';
            document.body.focus();
            
            // También forzar foco en el contenedor principal
            var main = document.getElementById('ui-sidebar');
            if (main) { main.setAttribute('tabindex', '0'); main.focus(); }

            VS = typeof VirtualScroll === 'object' ? VirtualScroll : null;
            APP = typeof App === 'object' ? App : null;
            if (!VS || !APP) return;

            // Escuchar en window con fase de captura (antes que el navegador interfiera)
            window.addEventListener('keydown', onKey, true);
            window.addEventListener('keypress', onKey, true);
            
            // Fallback para TVs muy antiguos
            document.addEventListener('keydown', onKey, true);
        },
        limpiar: function() {
            window.removeEventListener('keydown', onKey, true);
            window.removeEventListener('keypress', onKey, true);
            document.removeEventListener('keydown', onKey, true);
            VS = APP = VIDEO = null;
        }
    };
})();
