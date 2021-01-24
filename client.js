/**
 * @file client.js
 * @author Miguel Hernández Cabronero <miguel.hernandez@uab.cat>
 * @date 24/01/2021
 * 
 * @brief Client for the Sequence game
 */

var game = require("./game.js")
var JsonSocket = require('json-socket')

const CLIENT_STATE_NOT_CONNECTED = 0
const CLIENT_STATE_LOGGING_IN = 1
const CLIENT_STATE_LOGGED_IN = 2
const CLIENT_STATE_PLAYING = 3

class Client extends game.SequenceGame {

    constructor(host, port, player_name) {
        super(null)
        this.host = host
        this.port = port
        this.socket = new JsonSocket(new net.Socket()); //Decorate a standard net.Socket with JsonSocket
        this.socket.connect(this.port, this.host)
        this.player = new Player("-1", player_name, this.socket)
        this.status = CLIENT_STATE_NOT_CONNECTED
        var _this = this
        this.socket.on('connect', function () {
            _this.player.socket.on("message", function (message) {
                console.log(message)
                Client.handle_message(_this, _this.player, message)
            })
            _this.status = CLIENT_STATE_LOGGING_IN
            _this.player.socket.sendMessage({"type": "login", "name": _this.player.name})
        })
    }

    /// Request game start to the sever
    request_game_start() {
        this.socket.sendMessage({"type": "request_start"})
    }

    static handle_message(client, player, message) {
        switch (message["type"]) {
            case "logged":
                player.name = message["name"]
                player.id = message["id"]
                client.status = CLIENT_STATE_LOGGED_IN
                break

            case "game_started":
                client.status = CLIENT_STATE_PLAYING
                break

            case "wait":
                break

            case "chat":
                // TODO: implement chat
                break

            case "error":
                // TODO: disconnect and show some message
                break
        }
    }
}