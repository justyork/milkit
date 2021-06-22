const WS_ENDPOINT = 'wss://ext-ws-server-dev.milkit.workers.dev/ws';

class App {
    run (userId) {
        this.connectToWs(userId)
    }

    connectToWs(userId) {
        const websocket = new WebSocket(`${WS_ENDPOINT}?user_id=${userId}`)

        websocket.addEventListener('message', event => {
            console.log('Message received from server')
            console.log(event.data)
        })

        websocket.onopen = function(e) {
            console.log('[open] Connection established')
            console.log('Sending to server')
            websocket.send(JSON.stringify({ message: 'My name is John' }))
        }

    }

}
(new App).run(USER_ID);
