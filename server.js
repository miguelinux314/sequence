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

        const expected_length = 2 * (4 * (game.suit_max - game.suit_min + 1 + game.figures_no_joker.length) + (game.joker_codes.length * 2))

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
        // Message handles from clients
        this.on("login", this.process_login_message.bind(this))
        this.on("request_start", this.process_request_start_message.bind(this))
        this.on("error", this.process_error_message.bind(this))
        this.on("bye", this.process_bye_message.bind(this))
        this.on("chat", this.process_chat_message.bind(this))
        this.on("play_card", this.process_play_card_message.bind(this))
        this.on("discard_card", this.process_discard_card_message.bind(this))

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
                this.start_game()
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
            var new_player = new Player(id, htmlSanitize(requested_name), socket)

            this.id_to_player[parseInt(new_player.id)] = new_player
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
                this.start_game()
            }
        } else {
            Server.send_error_message(socket, "server not accepting connections")
        }
    }

    process_play_card_message(server, socket, message, id) {
        if (this.status != STATE_PLAYING) {
            Server.send_error_message(socket, "not playing")
            return
        }

        if (server.id_sequence[server.current_turn % server.id_sequence.length] != id) {
            // TODO: handle roudy player
            return
        }
        server.id_to_player[id].hand_code_list.sort()
        var is_card_in_hand = (server.id_to_player[id].hand_code_list[message.hand_card_index] == message.card_code)
        message.x = parseInt(message.x)
        message.y = parseInt(message.y)
        assert(message.x >= 0)
        assert(message.y >= 0)
        var peg_not_taken = (!(game.xy_to_coordinates_index(message.x, message.y) in server.game.pegs_by_xy))
        var card_matches = (message.card_code == server.game.card_assignment_xy[game.xy_to_coordinates_index(message.x, message.y)])
        for (var i = 0; i < game.joker_codes.length; i++) {
            if (message.hand_card_code == game.joker_codes[i]) {
                card_matches = true
                break
            }
        }
        if (card_matches && is_card_in_hand &&
            ((message.hand_card_code == game.joker_remove_code) && !peg_not_taken)
            || ((message.hand_card_code != game.joker_remove_code) && peg_not_taken)) {
            if (message.hand_card_code != game.joker_remove_code) {
                // Adding peg
                server.game.pegs_by_xy[game.xy_to_coordinates_index(message.x, message.y)] = id
            } else {
                // Removing peg
                delete server.game.pegs_by_xy[game.xy_to_coordinates_index(message.x, message.y)]
            }
            for (var player_id in server.id_to_player) {
                server.id_to_player[player_id].socket.sendMessage({
                    "type": "card_played",
                    "id": id,
                    "x": message.x,
                    "y": message.y,
                    "hand_card_code": message.hand_card_code,
                })
            }
            server.id_to_player[id].hand_code_list.sort()
            server.id_to_player[id].discard_card(message.card_code)
            server.deal_next_card(id)

            // Verify game end
            var winning_id = server.game.get_winning_peg(message.x, message.y)
            if (winning_id != null) {
                assert(winning_id == id)
                server.finish_game(id)
            } else {
                // Otherwise, go to the next turn
                server.current_turn++
                server.notify_next_turn()
            }
        } else {
            // Card not found in player's hand?!
            // TODO: send error, decide what to do with the game
        }
    }

    finish_game(winning_id) {
        for (var id in this.id_to_player) {
            this.id_to_player[id].socket.sendMessage({
                "type": "game_over",
                "winning_id": winning_id,
            })
        }
        this.status = STATE_FINISHED
        console.log("GAME OVER")
    }

    process_discard_card_message(server, socket, message, id) {
        if (this.status != STATE_PLAYING) {
            Server.send_error_message(socket, "not playing")
            return
        }

        if (server.id_sequence[server.current_turn % server.id_sequence.length] != id) {
            // TODO: handle roudy player
            return
        }

        // TODO: check that index is within limits, handle roudy instead
        var card_code = server.id_to_player[id].hand_code_list[message.hand_index]
        server.id_to_player[id].hand_code_list.splice(parseInt(message.hand_index), 1)
        for (var i in server.id_to_player) {
            server.id_to_player[i].socket.sendMessage({
                "type": "discarded_card",
                "id": id,
                "card_code": card_code,
            })
        }
        this.deal_next_card(id)
        server.current_turn++
        this.notify_next_turn()
    }

    process_bye_message(server, socket, message, id) {

    }

    process_chat_message(server, socket, message, id) {

    }

    process_error_message(server, socket, message, id) {

    }

    start_game() {
        assert(this.status == STATE_ACCEPTING_CONNECTIONS
            && Object.keys(this.id_to_player).length >= game.min_players)
        this.id_sequence = Object.keys(this.id_to_player)
        game.SequenceGame.shuffle(this.id_sequence)
        this.status = STATE_PLAYING
        var msg = {
            "type": "game_started",
            "card_assignment_xy": this.game.card_assignment_xy,
            "id_to_name": this.get_id_to_name(),
            "id_sequence": this.id_sequence,
        }
        for (var id in this.id_to_player) {
            this.id_to_player[id].status = STATE_PLAYING
            this.id_to_player[id].socket.sendMessage(msg)
        }

        // Deal initial cards
        for (var id in this.id_to_player) {
            for (var i = 0; i < game.cards_in_hand; i++) {
                this.deal_next_card(id)
            }
        }

        this.current_turn = 0
        this.notify_next_turn()
    }

    deal_next_card(player_id) {
        this.id_to_player[player_id].deal_card(this.deck[this.dealt_cards % this.deck.length])
        this.dealt_cards++
    }

    notify_next_turn() {
        var next_player = this.id_to_player[this.id_sequence[this.current_turn % this.id_sequence.length]]
        var msg = {"type": "turn_start", "turn_number": this.current_turn, "id": next_player.id}
        for (var id in this.id_to_player) {
            this.id_to_player[id].socket.sendMessage(msg)
        }
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
        this.hand_code_list.sort()

        this.socket.sendMessage({
            "type": "card_dealt",
            "card_code": card_code,
        })
    }

    discard_card(card_code) {
        var index = this.hand_code_list.indexOf(card_code)
        this.hand_code_list.splice(index, 1)
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