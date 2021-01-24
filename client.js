/**
 * @file client.js
 * @author Miguel Hernández Cabronero <miguel.hernandez@uab.cat>
 * @date 24/01/2021
 * 
 * @brief Client for the Sequence game
 */
var net = require('net')
var assert = require('assert');
var EventEmitter = require('events').EventEmitter
var game = require("./game.js")
var server = require("./server.js")
var JsonSocket = require('json-socket')

const STATE_NOT_CONNECTED = 0
const STATE_LOGGING_IN = 1
const STATE_LOGGED_IN = 2
const STATE_PLAYING = 3

class Client extends EventEmitter {

    constructor(host, port, player_name) {
        super()
        this.game = null
        this.host = host
        this.port = port
        this.socket = new JsonSocket(new net.Socket()); //Decorate a standard net.Socket with JsonSocket
        this.socket.connect(this.port, this.host)
        this.player = new server.Player("-1", player_name, this.socket)
        this.status = STATE_NOT_CONNECTED
        var _this = this
        this.socket.on('connect', function () {
            _this.player.socket.on("message", function (message) {
                console.log(message)
                Client.handle_message(_this, _this.player, message)
            })
            _this.status = STATE_LOGGING_IN
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
                client.status = STATE_LOGGED_IN
                break

            case "game_started":
                client.status = STATE_PLAYING
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

module.exports.Client = Client