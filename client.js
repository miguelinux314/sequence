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

/**
 * Emits on:
 *   - hand_updated
 *   - game_ready
 */
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
        this.on("logged_message", this.handle_logged_message.bind(this))
        this.on("game_started", this.handle_game_started_message.bind(this))
        this.on("card_dealt", this.handle_card_dealt_message.bind(this))
        this.on("wait", this.handle_wait_message.bind(this))
        this.on("chat", this.handle_chat_message.bind(this))
        this.on("error", this.handle_error_message.bind(this))
        var _this = this
        this.socket.on('connect', function () {
            _this.player.socket.on("message", function (message) {
                _this.emit(message["type"], _this, _this.player, message)
            })
            _this.status = STATE_LOGGING_IN
            _this.player.socket.sendMessage({"type": "login", "name": _this.player.name})
        })
    }

    handle_logged_message(client, player, message) {
        player.name = message["name"]
        player.id = message["id"]
        client.status = STATE_LOGGED_IN
    }

    handle_game_started_message(client, player, message) {
        client.status = STATE_PLAYING
        this.emit("game_ready", message)
    }

    handle_card_dealt_message(client, player, message) {
        assert(client.status == STATE_PLAYING)
        player.deal_card(message["card_code"])
        this.emit("hand_updated", player.hand_code_list)
    }

    handle_wait_message(client, player, message) {
        // Do nothing
    }

    handle_chat_message(client, player, message) {
        // TODO: implement chat
    }

    handle_error_message(client, player, message) {
        // TODO: disconnect and show some message
    }
}

module.exports.Client = Client