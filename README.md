# AutoFollowVC — v3.0.0

> Plugin de BetterDiscord para seguir automáticamente a usuarios a canales de voz. Configurable, rápido y con panel visual.

La idea es simple: seleccionas a quién quieres seguir (o qué canal de voz quieres vigilar) y el plugin se une automáticamente en cuanto detecta actividad. Sin delays, sin tener que estar pendiente.

## Captura

![Panel de AutoFollowVC](src/Captura%20de%20pantalla%202026-03-21%20003732.png)

*(El panel flotante con el tema azul, tracking activo y configuraciones visibles)*

---

## Cómo funciona

Pegas la **ID de un usuario** o de un **canal de voz**, le das a añadir, y el plugin hace el resto. Tiene dos modos:

- **Seguimiento de usuarios**: cuando el usuario que sigues se mete a un canal de voz, te unes automáticamente
- **Seguimiento de canales**: vigila un canal concreto y te mete cuando alguien entra (o cuando queda hueco si estaba lleno)

El plugin comprueba estados de voz continuamente con un loop configurable (puedes ponerlo hasta a 0ms si quieres velocidad máxima). También escucha los eventos de `VOICE_STATE_UPDATES` del Dispatcher para reaccionar al instante.

---

## Funcionalidades

### 🎯 Tracking
- Sigue a **múltiples usuarios** simultáneamente
- Vigila **múltiples canales de voz** a la vez
- Pausar/reanudar seguimiento individual por usuario o canal
- Detección de estado: en llamada, siguiendo, pausado, sin voz

### ⚡ Velocidad
- **Cooldown de salto** configurable en milisegundos (por defecto 200ms, puedes bajarlo a 0)
- **Intervalo de comprobación** configurable (polling loop con setTimeout ajustable)
- Unión por evento de Discord (no solo por polling), para velocidad casi instantánea
- Sistema de `queueMicrotask` para joins por evento, prácticamente 0 latencia

### 🧠 Lógica inteligente
- Detecta si el canal está **lleno** o **bloqueado** (sin permisos de conexión) y te avisa con toast
- Espera automáticamente a que haya hueco y se une en cuanto puede
- Modo avanzado: ignora bloqueos y reintenta constantemente
- Protección contra spam de joins: sistema de pending join con timeout de 8 segundos

### 🎨 Panel Visual
- Panel flotante **draggable** (lo mueves donde quieras y guarda la posición)
- Se puede **minimizar** sin cerrarlo
- 4 temas de color: **Blanco, Negro, Azul, Amarillo**
- Avatares reales de los usuarios trackeados
- Indicadores visuales: puntos de estado con animación de pulso para usuarios en llamada
- Vista de usuarios conectados en canales vigilados (mini-avatares)
- Accordion para secciones expandibles/colapsables

### ⚙️ Configuración
- Toggle global para pausar/activar todo el tracking
- Abrir panel automáticamente al iniciar Discord
- Ocultar panel con **Numpad 9** (comparte el atajo con FABYP para ocultar ambos paneles a la vez)
- Configuración persistente en archivo JSON y en BdApi.Data (doble respaldo)

---

## Instalación

1. Copia `AutoFollowVC.plugin.js` a tu carpeta de plugins  
   (`%appdata%/BetterDiscord/plugins/`)
2. Actívalo en la pestaña de plugins de BetterDiscord
3. Abre el panel desde los settings del plugin o con el panel flotante
4. Pega IDs de usuarios o canales y empieza a trackear

---

## Notas

- El plugin necesita que los módulos internos de Discord estén accesibles (Webpack stores). Si alguno cambia con una actualización, puede que falle la unión a canales
- El tracking de canales funciona mejor cuando el canal pertenece a un servidor donde ya estás
- Los avatares se cargan directamente desde el CDN de Discord
- Si pones el cooldown y el polling a 0ms vas a ir más rápido que nadie, pero tenlo en cuenta si Discord empieza a rate-limitearte

---

*Hecho por **Undfe** — [github.com/undefined-name12](https://github.com/undefined-name12)*
