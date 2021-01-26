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
var EventEmitter = require('events').EventEmitter

// Server status value
const STATE_ACCEPTING_CONNECTIONS = 0
const STATE_PLAYING = 1
const STATE_FINISHED = 2

// Default game configuration
var default_port = 9999
const min_port = 2048
const max_port = 9999

/**
 * Sequence game network server
 *
 * Exported .on() events:
 *   - players_changed
 *   - all valid message types
 */
class Server extends EventEmitter {
    constructor(port) {
        super()

        const expected_length = 2*(4*(game.suit_max-game.suit_min+1+game.figures_no_joker.length) + (game.joker_codes.length*2))

        this.game = new game.SequenceGame(game.SequenceGame.get_random_card_assignment_xy())
        var all_cards = game.SequenceGame.get_deal_deck_cards()
        assert(all_cards.length == expected_length)
        this.deck = game.SequenceGame.shuffle(all_cards)
        assert(this.deck.length == expected_length)
        this.dealt_cards = 0

        this.port = port
        this.id_to_player = {} // Dictionary of active players
        this.status = STATE_ACCEPTING_CONNECTIONS
        this.next_connection_id = 0

        this.server = net.createServer();
        // Message handles
        this.on("login", this.process_login_message.bind(this))
        this.on("request_start", this.process_request_start_message.bind(this))
        this.on("error", this.process_error_message.bind(this))
        this.on("bye", this.process_bye_message.bind(this))
        this.on("chat", this.process_chat_message.bind(this))

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
                _this.emit(message["type"], _this, new_socket, message, id)
            })
        })
        _this.server.listen(_this.port);
    }

    process_request_start_message(server, socket, message, id) {
        if (this.status == STATE_ACCEPTING_CONNECTIONS) {
            if (Object.keys(this.id_to_player).length >= game.min_players) {
                this.begin_game()
            } else {
                socket.sendMessage({
                    "type": "wait", "reason": "Not enough players"
                })
            }
        } else {
            this.send_error_message(socket, "game previously started")
        }
    }

    /// Process a message of type "login"
    process_login_message(server, socket, message, id) {

        if (this.status == STATE_ACCEPTING_CONNECTIONS) {
            var requested_name = message["name"]
            if (requested_name.length == 0) {
                requested_name = "Player #" + id
            }
            var new_player = new Player(
                id, htmlSanitize(requested_name), socket)

            this.id_to_player[new_player.id] = new_player
            new_player.socket.sendMessage(
                {
                    "type": "logged",
                    "id": new_player.id,
                    "name": new_player.name,
                })
            this.emit("players_changed", this.id_to_player)

            var len = Object.keys(server.id_to_player).length
            if (len == game.max_players) {
                // Automatically start game when max count players are reached
                this.begin_game()
            }
        } else {
            Server.send_error_message(socket, "server not accepting connections")
        }
    }

    process_bye_message(server, socket, message, id) {

    }

    process_chat_message(server, socket, message, id) {

    }

    process_error_message(server, socket, message, id) {

    }

    begin_game() {
        console.log("[Server beginning game]")
        assert(this.status == STATE_ACCEPTING_CONNECTIONS
            && Object.keys(this.id_to_player).length >= game.min_players)
        var msg = {
            "type": "game_started",
            "card_assignment": this.game.card_assignment,
            "id_to_name": this.get_id_to_name(),
        }
        for (var id in this.id_to_player) {
            this.id_to_player[id].socket.sendMessage(msg)
        }


        for (var id in this.id_to_player) {
            for (var i = 0; i < game.cards_in_hand; i++) {
                this.id_to_player[id].deal_card(this.deck[this.dealt_cards % this.deck.length])
                this.dealt_cards++
            }
        }

        this.status = STATE_PLAYING
    }

    get_player_count() {
        return Object.keys(this.id_to_player).length
    }

    /// Return a dictionary indexed by player id and entries being names
    get_id_to_name() {
        var id_to_name = {}
        for (var id in this.id_to_player) {
            id_to_name[id] = this.id_to_player[id].name
        }
        return id_to_name
    }

    send_error_message(socket, message_string) {
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
        this.hand_code_list = []
        // Includes already used
        this.all_cards_dealt = []
    }

    deal_card(card_code) {
        this.hand_code_list.push(card_code)
        this.all_cards_dealt.push(card_code)

        this.socket.sendMessage({
            "type": "card_dealt",
            "card_code": card_code,
        })
    }
}

module.exports.Server = Server
module.exports.Player = Player
module.exports.STATE_ACCEPTING_CONNECTION = STATE_ACCEPTING_CONNECTIONS
module.exports.STATE_PLAYING = STATE_PLAYING
module.exports.STATE_FINISHED = STATE_FINISHED
module.exports.local_port = default_port
module.exports.min_port = min_port
module.exports.max_port = max_port