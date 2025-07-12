// Simple plugin to log browser console messages to terminal
export function consoleLogPlugin() {
  return {
    name: 'console-log',
    configureServer(server) {
      server.ws.on('console-log', (data) => {
        const timestamp = new Date().toISOString().substring(11, 19)
        const level = data.level.toUpperCase().padEnd(5)
        console.log(`[${timestamp}] ${level} ${data.message}`)
        if (data.stack) {
          console.log(`         ${data.stack}`)
        }
      })
    },
    transformIndexHtml: {
      enforce: 'pre',
      transform(html) {
        return html.replace(
          '<head>',
          `<head>
<script>
(function() {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    
    function sendToServer(level, args) {
      try {
        const message = args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
        ).join(' ');
        
        if (window.__vite_ws) {
          window.__vite_ws.send(JSON.stringify({
            type: 'custom',
            event: 'console-log',
            data: { level, message }
          }));
        }
      } catch (e) {
        // Ignore errors in logging
      }
    }
    
    console.log = function(...args) {
      sendToServer('log', args);
      return originalLog.apply(console, args);
    };
    
    console.error = function(...args) {
      sendToServer('error', args);
      return originalError.apply(console, args);
    };
    
    console.warn = function(...args) {
      sendToServer('warn', args);
      return originalWarn.apply(console, args);
    };
    
    // Capture unhandled errors
    window.addEventListener('error', (e) => {
      sendToServer('error', ['Uncaught Error:', e.message, '\\nFile:', e.filename + ':' + e.lineno]);
    });
    
    window.addEventListener('unhandledrejection', (e) => {
      sendToServer('error', ['Unhandled Promise Rejection:', e.reason]);
    });
  }
})();
</script>`
        )
      }
    }
  }
}