/**
 * @file server.js
 * @author Miguel Hernández Cabronero <miguel.hernandez@uab.cat>
 * @date 24/01/2021
 *
 * @brief Server for the Sequence game
 */

var net = require('net')
var assert = require('assert');
var htmlSanitize = require('sanitize-html')
var game = require("./game.js")
var JsonSocket = require('json-socket')

// Server status value
const STATE_ACCEPTING_CONNECTIONS = 0
const STATE_PLAYING = 1
const STATE_FINISHED = 2

// Default game configuration
var local_port = 9999
const min_port = 2048
const max_port = 9999

class Server extends game.SequenceGame {
    constructor(port) {
        super(SequenceGame.get_random_card_assignment_xy())

        this.port = port
        this.id_to_player = {} // Dictionary of active players
        this.status = STATE_ACCEPTING_CONNECTIONS
        this.next_connection_id = 0

        this.deck = SequenceGame.shuffle(SequenceGame.get_deal_deck_cards())
        this.dealt_cards = 0

        this.server = net.createServer();
        this.start()
    }

    // Starts the server for a game
    start() {
        var _this = this
        _this.server.on("connection", function (socket) {
            var new_socket = new JsonSocket(socket)
            _this.next_connection_id += 1
            var id = _this.next_connection_id
            new_socket.on("message", function (message) {
                Server.handle_player_message(_this, new_socket, message, id)
            })
        })
        _this.server.listen(_this.port);
    }

    static handle_player_message(server, socket, message, connection_id) {
        console.log(message)
        switch (message["type"]) {
            case "login":
                this.process_login_message(server, message, connection_id, socket)
                break
            case "request_start":
                this.process_request_start_message(server, socket);
                break
            case "bye":
                break
            case "error":
                // TODO Player exited. Clean and resshufle?
                break
            case "chat":
                // TODO: implement chat forwarding
                break
        }
    }

    static process_request_start_message(server, socket) {
        if (server.status == STATE_ACCEPTING_CONNECTIONS) {
            if (Object.keys(server.id_to_player).length >= min_players) {
                server.begin_game()
            } else {
                socket.sendMessage({
                    "type": "wait", "reason": "Not enough players"
                })
            }
        } else {
            Server.send_error_message(socket, "game previously started")
        }
    }

    /// Process a message of type "login"
    static process_login_message(server, message, connection_id, socket) {
        if (server.status == STATE_ACCEPTING_CONNECTIONS) {
            var requested_name = message["name"]
            if (requested_name.length == 0) {
                requested_name = "Player #" + connection_id
            }
            var new_player = new Player(
                connection_id, htmlSanitize(requested_name), socket)

            server.id_to_player[new_player.id] = new_player
            new_player.socket.sendMessage(
                {
                    "type": "logged", "id": new_player.id,
                    "name": new_player.name,
                })
            var len = Object.keys(server.id_to_player).length
            if (len == max_players) {
                // Automatically start game when max count players are reached
                server.begin_game()
            }
        } else {
            Server.send_error_message(socket, "server not accepting connections")
        }
    }

    begin_game() {
        assert(server.status == STATE_ACCEPTING_CONNECTIONS
            && Object.keys(this.id_to_player).length >= min_players)
        this.game = new SequenceGame(this.card_assignment)
        for (var id in this.id_to_player) {
            this.id_to_player[id].socket.sendMessage({
                "type": "game_started",
                "id_to_name": this.get_id_to_name()
            })
        }
        this.status = STATE_PLAYING
    }

    /// Return a dictionary indexed by player id and entries being names
    get_id_to_name() {
        var id_to_name = {}
        for (var id in this.id_to_player) {
            id_to_name[id] = this.id_to_player[id].name
        }
        return id_to_name
    }

    static send_error_message(socket, message_string) {
        socket.sendMessage({"type": "error", "msg": "ERROR: " + message_string})
    }
}

// Identify a player and its connection
class Player {
    constructor(id, name, json_socket) {
        // Id string
        this.id = id
        // Custom name
        this.name = name
        // JsonSocket with the Player
        this.socket = json_socket
        // Cards in hand
        this.card_code_list = []
    }
}

module.exports.Server = Server
module.exports.Player = Player
module.exports.STATE_ACCEPTING_CONNECTION = STATE_ACCEPTING_CONNECTIONS
module.exports.STATE_PLAYING = STATE_PLAYING
module.exports.STATE_FINISHED = STATE_FINISHED
module.exports.local_port = local_port
module.exports.min_port = min_port
module.exports.max_port = max_port