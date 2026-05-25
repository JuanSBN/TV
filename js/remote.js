/**
 * ControlRemoto - ENTER contextual (navegar/pausar)
 * Samsung UN48J5300AKXZL (Tizen 2.3) - 45 líneas
 */
var ControlRemoto = (function() {
    'use strict';
    
    var K = { UP: 38, DOWN: 40, ENTER: 13, RETURN: 10009, EXIT: 412 };
    var VS = null, APP = null, VIDEO = null;
    
    function onKey(e) {
        var k = e.keyCode;
        
        switch (k) {
            case K.UP:
                if (VS) VS.moverFoco(-1); e.preventDefault(); return 1;
                
            case K.DOWN:
                if (VS) VS.moverFoco(1); e.preventDefault(); return 1;
                
            case K.ENTER:
                // 🔹 Comportamiento contextual inteligente:
                var v = VIDEO || (VIDEO = document.getElementById('tv-player'));
                
                // Si hay video reproduciéndose → Toggle pause/play
                if (v && v.src && !v.error) {
                    if (v.paused) { v.play(); }
                    else { v.pause(); }
                    e.preventDefault(); return 1;
                }
                
                // Si no → Seleccionar canal de la lista
                if (VS && APP) {
                    var c = VS.obtenerSeleccionado();
                    if (c && c.u) { APP.reproducirUrl(c.u); e.preventDefault(); return 1; }
                }
                break;
                
            case K.RETURN: case K.EXIT:
                e.preventDefault(); e.stopPropagation();
                if (APP) APP.salirAplicacion(); return 1;
        }
        return 0;
    }
    
    return {
        inicializar: function() {
            VS = typeof VirtualScroll === 'object' ? VirtualScroll : null;
            APP = typeof App === 'object' ? App : null;
            if (!VS || !APP) return;
            
            if (typeof tizen !== 'undefined' && tizen.tvinputdevice) {
                try { tizen.tvinputdevice.registerKey('Return'); } catch (err) {}
            }
            document.addEventListener('keydown', onKey, true);
        },
        limpiar: function() {
            document.removeEventListener('keydown', onKey, true);
            VS = APP = VIDEO = null;
        }
    };
})();
