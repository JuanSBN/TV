/**
 * VirtualScroll - Renderizado virtual ultra-ligero
 * Samsung UN48J5300AKXZL (Tizen 2.3) - ~4 KB, < 2 MB RAM para 2000 canales
 */
var VirtualScroll = (function() {
    'use strict';
    
    // ===== CONFIGURACIÓN =====
    var DEBUG = false;
    var MAX_VISIBLE = 10;
    var ALTURA_ITEM = 68; // px, debe coincidir EXACTAMENTE con CSS
    var MITAD_VISIBLE = 5; // Math.floor(MAX_VISIBLE / 2) pre-calculado
    
    // Estado privado
    var datos = [];
    var indexSeleccionado = 0;
    var listaDOM = null;
    var contenedorDOM = null; // 🔹 Caché del contenedor de scroll
    var nodosLI = [];
    
    // ===== FUNCIONES DE SOPORTE =====
    function log(m) { if (DEBUG) console.log('[Scroll]', m); }
    
    // 🔹 Crear nodos fijos (solo se ejecuta UNA vez al inicializar)
    function crearNodosFijos(cantidad) {
        listaDOM.innerHTML = '';
        nodosLI = [];
        for (var i = 0; i < cantidad; i++) {
            var li = document.createElement('li');
            li.setAttribute('role', 'option');
            listaDOM.appendChild(li);
            nodosLI.push(li);
        }
        log('📦 ' + cantidad + ' nodos creados');
    }
    
    // 🔹 Calcular ventana de renderizado (optimizado)
    function calcularInicioVentana() {
        var inicio = indexSeleccionado - MITAD_VISIBLE;
        if (inicio < 0) inicio = 0;
        var fin = inicio + MAX_VISIBLE;
        if (fin > datos.length) {
            inicio = Math.max(0, datos.length - MAX_VISIBLE);
        }
        return inicio;
    }
    
    // 🔹 Actualizar vista: SOLO modifica texto y clases, sin reflows innecesarios
    function actualizarVista() {
        if (!datos.length) return;
        
        var inicio = calcularInicioVentana();
        var nodo, dato, idx, isSelected;
        
        for (var i = 0; i < nodosLI.length; i++) {
            idx = inicio + i;
            nodo = nodosLI[i];
            
            if (idx < datos.length) {
                dato = datos[idx];
                isSelected = (idx === indexSeleccionado);
                
                // 🔹 Actualizar texto (textContent es más rápido que innerHTML)
                nodo.textContent = dato.n; // 🔹 Propiedad corta 'n' del parser
                
                // 🔹 Toggle de clase: solo cambiar si es diferente (evita reflow)
                if (isSelected) {
                    if (nodo.className !== 'foco-activo') {
                        nodo.className = 'foco-activo';
                    }
                } else {
                    if (nodo.className !== '') {
                        nodo.className = '';
                    }
                }
                nodo.style.display = 'block';
            } else {
                nodo.style.display = 'none';
            }
        }
        
        // 🔹 Scroll SOLO si el elemento seleccionado está fuera de la ventana visible
        var posRelativa = indexSeleccionado - inicio;
        if (posRelativa < 0 || posRelativa >= MAX_VISIBLE) {
            var offset = posRelativa * ALTURA_ITEM;
            if (contenedorDOM.scrollTop !== offset) {
                contenedorDOM.scrollTop = offset;
            }
        }
    }
    
    return {
        /**
         * Inicializa el scroll virtual
         * @param {Array} listaCanales - Array de objetos {n: nombre, u: url}
         */
        inicializar: function(listaCanales) {
            log('🔄 Inicializando con ' + (listaCanales ? listaCanales.length : 0) + ' canales');
            
            datos = listaCanales || [];
            indexSeleccionado = 0;
            listaDOM = document.getElementById('dom-lista');
            contenedorDOM = document.getElementById('scroll-contenedor'); // 🔹 Cachear
            
            if (!listaDOM || !contenedorDOM) {
                if (DEBUG) console.error('[Scroll] Elementos DOM no encontrados');
                return;
            }
            
            var cantidad = Math.min(MAX_VISIBLE, datos.length);
            crearNodosFijos(cantidad);
            actualizarVista();
        },
        
        /**
         * Mueve el foco arriba/abajo
         * @param {number} direccion - 1 o -1
         */
        moverFoco: function(direccion) {
            var nuevo = indexSeleccionado + direccion;
            if (nuevo >= 0 && nuevo < datos.length) {
                indexSeleccionado = nuevo;
                actualizarVista();
                return true;
            }
            return false;
        },
        
        /**
         * Obtiene el canal seleccionado
         */
        obtenerSeleccionado: function() {
            return datos.length ? datos[indexSeleccionado] : null;
        },
        
        /**
         * Actualiza el contador en UI
         */
        actualizarContador: function(total) {
            var el = document.getElementById('total-canales');
            if (el) el.textContent = total;
        },
        
        /**
         * Limpia memoria y referencias
         */
        limpiar: function() {
            log('🧹 Limpiando scroll');
            datos = [];
            indexSeleccionado = 0;
            if (listaDOM) listaDOM.innerHTML = '';
            nodosLI = [];
            contenedorDOM = null;
        },
        
        /**
         * Fuerza re-renderizado (útil si la lista cambia externamente)
         */
        refrescar: function() {
            if (datos.length) actualizarVista();
        }
    };
})();
