const {app, BrowserWindow} = require('electron') // http://electronjs.org/docs/api
const path = require('path') // https://nodejs.org/api/path.html
const url = require('url') // https://nodejs.org/api/url.html

let window = null

// Wait until the app is ready
app.once('ready', () => {
  // Create a new window
  window = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    resizable: true
  })

  window.setMenu(null)

  // Load a URL in the window to the local index.html path
  window.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))

  // Show window when page is ready
  window.once('ready-to-show', () => {
    window.show()
  })
})
